import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import crypto from "crypto";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

// ─── Local JWT Secret ──────────────────────────────────────────────
// Uses JWT_SECRET env var if available, otherwise generates a stable
// fallback secret based on DATABASE_URL (so it persists across restarts)
function getJwtSecret(): string {
  if (ENV.cookieSecret && ENV.cookieSecret.length > 0) {
    return ENV.cookieSecret;
  }
  // Fallback: derive a secret from DATABASE_URL or use a fixed default
  const seed = ENV.databaseUrl || "pegasus-local-default-secret-2024";
  return crypto.createHash("sha256").update(seed).digest("hex");
}

const JWT_SECRET = getJwtSecret();

class SDKServer {
  constructor() {
    console.log("[Auth] Initialized with local JWT authentication");
    console.log("[Auth] JWT Secret configured:", JWT_SECRET.length > 0 ? "YES" : "NO");
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    return new TextEncoder().encode(JWT_SECRET);
  }

  /**
   * Create a session token for a user openId
   * Uses local JWT signing - no external OAuth dependency
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId || "pegasus",
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing openId");
        return null;
      }

      return {
        openId,
        appId: (appId as string) || "pegasus",
        name: (name as string) || "",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Verify session from request cookies
   */
  async verifySessionFromRequest(req: Request): Promise<{ openId: string; appId: string; name: string } | null> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    return this.verifySession(sessionCookie);
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Try Bearer token first (from localStorage)
    const authHeader = req.headers.authorization;
    let session: { openId: string; appId: string; name: string } | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      session = await this.verifySession(token);
    }

    // Fallback to cookie
    if (!session) {
      const cookies = this.parseCookies(req.headers.cookie);
      const sessionCookie = cookies.get(COOKIE_NAME);
      session = await this.verifySession(sessionCookie);
    }

    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    return user;
  }
}

export const sdk = new SDKServer();

import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    let session: { openId: string; appId: string; name: string } | null = null;

    // Prefer Authorization Bearer token (compatibilidade com client atual)
    const authHeader = opts.req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      session = await sdk.verifySession(token);
    }

    // Fallback para cookie HTTP-only emitido no login/register
    if (!session) {
      session = await sdk.verifySessionFromRequest(opts.req);
    }

    if (session) {
      const dbUser = await db.getUserByOpenId(session.openId);
      if (dbUser) {
        user = dbUser;
      }
    }
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

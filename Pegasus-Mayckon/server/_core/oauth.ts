import type { Express, Request, Response } from "express";

export function registerOAuthRoutes(app: Express) {
  // OAuth callback is no longer used - system uses local email/password auth
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(200).json({
      message: "Este sistema usa autenticação local (email/senha). OAuth não é necessário.",
      redirect: "/",
    });
  });
}

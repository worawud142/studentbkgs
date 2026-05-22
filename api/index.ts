import type { Express, Request, Response } from "express";

let app: Express | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!app) {
      // Lazy init: import createApp only when needed
      const { createApp } = await import("../server/_core/index");
      app = createApp();
    }

    if (!app) {
      throw new Error("Failed to initialize express application");
    }

    return app(req, res);
  } catch (error) {
    console.error("[Vercel API] Failed to handle request:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

import type { Express, Request, Response } from "express";

let app: Express | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!app) {
      const { createApp } = await import("../dist/index.js");
      app = createApp();
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

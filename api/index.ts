import type { Express, Request, Response } from "express";
import { createApp } from "../server/_core/index";

const app: Express = createApp();

export default async function handler(req: Request, res: Response) {
  try {
    return app(req, res);
  } catch (error) {
    console.error("[Vercel API] Failed to handle request:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

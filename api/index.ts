import type { Request, RequestHandler, Response } from "express";

type BuiltServerModule = {
  createApp: () => RequestHandler;
};

const importBuiltServer = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<BuiltServerModule>;

let app: RequestHandler | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!app) {
      const { createApp } = await importBuiltServer("../dist/index.js");
      app = createApp();
    }

    const activeApp = app;
    return activeApp(req, res, error => {
      if (error) throw error;
    });
  } catch (error) {
    console.error("[Vercel API] Failed to handle request:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

type ExpressLikeHandler = (
  req: unknown,
  res: unknown,
  next?: (error?: unknown) => void
) => unknown;

type VercelResponse = {
  status: (code: number) => {
    json: (body: unknown) => unknown;
  };
};

type BuiltServerModule = {
  createApp: () => ExpressLikeHandler;
};

const importBuiltServer = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<BuiltServerModule>;

let app: ExpressLikeHandler | null = null;

export default async function handler(req: unknown, res: VercelResponse) {
  try {
    if (!app) {
      const { createApp } = await importBuiltServer("../dist/index.cjs");
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

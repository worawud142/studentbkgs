import "dotenv/config";
import { spawn } from "child_process";
import express from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import { createServer } from "http";
import net from "net";
import os from "os";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { buildExport } from "./excelExport";
import {
  academicPrintContentType,
  getAcademicPrintTemplateCandidates,
} from "./academicPrintTemplates";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { isNodeExcelRuntime, isRemoteExcelRuntime } from "./excelRuntime";
import {
  proxyRemoteExcelDownload,
  requireExcelServiceAuth,
} from "./remoteExcel";
import { parseStudentsWorkbookForExcelService } from "./studentImport";

type TemplateId = "secondary-demo" | "primary-score" | "academic-print";

const TEMPLATE_FILES: Record<
  TemplateId,
  { fileName: string; downloadName: string; contentType: string }
> = {
  "secondary-demo": {
    fileName: "ตัวอย่างมัธยม.xlsx",
    downloadName: "ตัวอย่างมัธยม.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "primary-score": {
    fileName: "เก็บคะแนนประถม.xlsx",
    downloadName: "เก็บคะแนนประถม.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "academic-print": {
    fileName: "ปริ้นส่งวิชาการ.xlsm",
    downloadName: "ปพ.5 ส่งวิชาการ.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

function getTemplatePath(fileName: string) {
  return path.resolve(process.cwd(), fileName);
}

function studentImportTemplateScriptPath() {
  const candidates = [
    path.resolve(import.meta.dirname, "student_import_template.py"),
    path.resolve(
      process.cwd(),
      "server",
      "_core",
      "student_import_template.py"
    ),
  ];
  return (
    candidates.find(candidate => fs.existsSync(candidate)) ?? candidates[0]
  );
}

async function createStudentImportTemplate(outputPath: string) {
  if (isNodeExcelRuntime()) {
    const { createStudentImportTemplateNode } = await import("./nodeExcel");
    await createStudentImportTemplateNode(outputPath);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "python3",
      [studentImportTemplateScriptPath(), outputPath],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            stderr.trim() || `student import template exited with code ${code}`
          )
        );
    });
  });
}

async function proxyRemoteExcelRoute(
  req: express.Request,
  res: express.Response,
  remotePath: string
) {
  try {
    await proxyRemoteExcelDownload(req, res, remotePath);
  } catch (error) {
    console.error("[Remote Excel] proxy failed", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Remote Excel failed",
    });
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export function createApp() {
  const app = express();
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/excel/student-import-template", async (req, res) => {
    if (!requireExcelServiceAuth(req, res)) return;

    const tmpDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), "studentbkgs-template-")
    );
    const filePath = path.join(tmpDir, "student-import-template.xlsx");

    try {
      await createStudentImportTemplate(filePath);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.download(filePath, "เทมเพลตนำเข้านักเรียน.xlsx", async err => {
        await fsPromises
          .rm(tmpDir, { recursive: true, force: true })
          .catch(() => {});
        if (err)
          console.error("[Student Import Template] download failed", err);
      });
    } catch (error) {
      await fsPromises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(() => {});
      console.error("[Student Import Template] failed", error);
      res
        .status(500)
        .json({ error: "Failed to generate student import template" });
    }
  });

  app.post("/api/excel/student-import", async (req, res) => {
    if (!requireExcelServiceAuth(req, res)) return;

    try {
      if (
        typeof req.body?.fileName !== "string" ||
        typeof req.body?.fileContentBase64 !== "string"
      ) {
        res
          .status(400)
          .json({ error: "fileName and fileContentBase64 are required" });
        return;
      }

      const workbook = await parseStudentsWorkbookForExcelService({
        fileName: req.body.fileName,
        fileContentBase64: req.body.fileContentBase64,
      });
      res.json(workbook);
    } catch (error) {
      console.error("[Excel Service] failed to parse student import", error);
      res
        .status(500)
        .json({ error: "Failed to parse student import workbook" });
    }
  });

  app.get("/api/student-import-template", async (req, res) => {
    if (isRemoteExcelRuntime()) {
      await proxyRemoteExcelRoute(
        req,
        res,
        "/api/excel/student-import-template"
      );
      return;
    }

    const tmpDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), "studentbkgs-template-")
    );
    const filePath = path.join(tmpDir, "student-import-template.xlsx");

    try {
      await createStudentImportTemplate(filePath);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.download(filePath, "เทมเพลตนำเข้านักเรียน.xlsx", async err => {
        await fsPromises
          .rm(tmpDir, { recursive: true, force: true })
          .catch(() => {});
        if (err)
          console.error("[Student Import Template] download failed", err);
      });
    } catch (error) {
      await fsPromises
        .rm(tmpDir, { recursive: true, force: true })
        .catch(() => {});
      console.error("[Student Import Template] failed", error);
      res
        .status(500)
        .json({ error: "Failed to generate student import template" });
    }
  });
  app.get(
    ["/api/templates/:templateId", "/api/excel/templates/:templateId"],
    async (req, res) => {
      const isExcelServiceRoute = req.path.startsWith("/api/excel/");
      if (isExcelServiceRoute && !requireExcelServiceAuth(req, res)) return;

      const template = TEMPLATE_FILES[req.params.templateId as TemplateId];

      if (!template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      const shouldExport =
        req.query.export === "1" || req.query.export === "true";

      if (!isExcelServiceRoute && isRemoteExcelRuntime()) {
        await proxyRemoteExcelRoute(
          req,
          res,
          `/api/excel/templates/${encodeURIComponent(req.params.templateId)}`
        );
        return;
      }

      const assignmentId =
        typeof req.query.assignmentId === "string"
          ? Number(req.query.assignmentId)
          : undefined;
      const studentId =
        typeof req.query.studentId === "string"
          ? Number(req.query.studentId)
          : undefined;
      const level =
        typeof req.query.level === "string" &&
        ["primary", "secondary"].includes(req.query.level)
          ? (req.query.level as "primary" | "secondary")
          : undefined;

      if (shouldExport) {
        try {
          if (req.params.templateId === "academic-print") {
            if (assignmentId && !Number.isNaN(assignmentId)) {
              const result = await buildExport({
                templateId: "academic-print",
                assignmentId,
              });
              res.setHeader("Content-Type", result.contentType);
              res.download(result.filePath, result.fileName, async err => {
                await result.cleanup().catch(() => {});
                if (err) console.error("[Export] download failed", err);
              });
              return;
            }

            if (studentId && !Number.isNaN(studentId)) {
              const result = await buildExport({
                templateId: "academic-print",
                studentId,
              });
              res.setHeader("Content-Type", result.contentType);
              res.download(result.filePath, result.fileName, async err => {
                await result.cleanup().catch(() => {});
                if (err) console.error("[Export] download failed", err);
              });
              return;
            }

            res
              .status(400)
              .json({ error: "assignmentId or studentId is required" });
            return;
          }

          if (!assignmentId || Number.isNaN(assignmentId)) {
            res.status(400).json({ error: "assignmentId is required" });
            return;
          }

          const result = await buildExport({
            templateId:
              template.fileName === "เก็บคะแนนประถม.xlsx"
                ? "primary-score"
                : "secondary-demo",
            assignmentId,
          });

          res.setHeader("Content-Type", result.contentType);
          res.download(result.filePath, result.fileName, async err => {
            await result.cleanup().catch(() => {});
            if (err) console.error("[Export] download failed", err);
          });
          return;
        } catch (error) {
          console.error("[Export] Failed to generate workbook", error);
          res.status(500).json({ error: "Failed to generate workbook" });
          return;
        }
      }

      if (req.params.templateId === "academic-print") {
        const candidates = getAcademicPrintTemplateCandidates(
          level ?? "primary"
        );
        const matched = candidates.find(candidate => fs.existsSync(candidate));
        if (!matched) {
          res.status(404).json({ error: "Template file missing" });
          return;
        }
        res.setHeader(
          "Content-Type",
          academicPrintContentType(path.basename(matched))
        );
        res.download(matched, path.basename(matched));
        return;
      }

      const filePath = getTemplatePath(template.fileName);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Template file missing" });
        return;
      }

      res.setHeader("Content-Type", template.contentType);
      res.download(filePath, template.downloadName);
    }
  );
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}

export async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // development mode uses Vite, production mode uses static files
  const { serveStatic, setupVite } = await import("./vite");
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port =
    process.env.NODE_ENV === "development"
      ? await findAvailablePort(preferredPort)
      : preferredPort;

  if (process.env.NODE_ENV === "development" && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(console.error);
}

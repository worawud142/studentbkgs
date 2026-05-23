import type { Request, Response } from "express";

const SECRET_HEADER = "x-excel-service-secret";

export function getExcelServiceSecret() {
  return process.env.EXCEL_SERVICE_SECRET?.trim() || "";
}

export function requireExcelServiceAuth(req: Request, res: Response) {
  const secret = getExcelServiceSecret();
  if (!secret) {
    res.status(503).json({ error: "EXCEL_SERVICE_SECRET is not configured" });
    return false;
  }

  if (req.header(SECRET_HEADER) !== secret) {
    res.status(401).json({ error: "Unauthorized Excel service request" });
    return false;
  }

  return true;
}

function excelServiceBaseUrl() {
  const baseUrl = process.env.EXCEL_SERVICE_URL?.trim();
  if (!baseUrl) {
    throw new Error("EXCEL_SERVICE_URL is required when EXCEL_RUNTIME=remote");
  }
  return baseUrl.replace(/\/+$/, "");
}

function excelServiceHeaders(contentType?: string) {
  const secret = getExcelServiceSecret();
  if (!secret) {
    throw new Error(
      "EXCEL_SERVICE_SECRET is required when EXCEL_RUNTIME=remote"
    );
  }

  const headers: Record<string, string> = {
    [SECRET_HEADER]: secret,
  };
  if (contentType) headers["content-type"] = contentType;
  return headers;
}

function copyResponseHeader(
  source: globalThis.Response,
  target: Response,
  headerName: string
) {
  const value = source.headers.get(headerName);
  if (value) target.setHeader(headerName, value);
}

async function readErrorMessage(response: globalThis.Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const fallback = `Remote Excel service responded with ${response.status}`;

  try {
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { error?: unknown };
      return typeof json.error === "string" ? json.error : fallback;
    }
    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function proxyRemoteExcelDownload(
  req: Request,
  res: Response,
  remotePath: string
) {
  const query = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  const response = await fetch(
    `${excelServiceBaseUrl()}${remotePath}${query}`,
    {
      headers: excelServiceHeaders(),
    }
  );

  if (!response.ok) {
    res
      .status(response.status)
      .json({ error: await readErrorMessage(response) });
    return;
  }

  copyResponseHeader(response, res, "content-type");
  copyResponseHeader(response, res, "content-disposition");
  copyResponseHeader(response, res, "content-length");

  const buffer = Buffer.from(await response.arrayBuffer());
  res.status(response.status).send(buffer);
}

export async function parseStudentsWorkbookRemote(input: {
  fileName: string;
  fileContentBase64: string;
}) {
  const response = await fetch(
    `${excelServiceBaseUrl()}/api/excel/student-import`,
    {
      method: "POST",
      headers: excelServiceHeaders("application/json"),
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as {
    sheetName: string | null;
    rows: Array<{
      rowNumber: number;
      studentCode: string;
      prefix: string;
      firstName: string;
      lastName: string;
      nationalId: string;
      birthDate: string;
      gender: "male" | "female" | "";
      studentNumber: number | null;
      status: "active" | "transferred" | "graduated" | "dropped";
    }>;
    errors: { rowNumber: number; message: string }[];
  };
}

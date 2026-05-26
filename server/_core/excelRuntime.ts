export type ExcelRuntime = "node" | "python" | "remote";

export function getExcelRuntime(): ExcelRuntime {
  if (process.env.VERCEL && process.env.EXCEL_RUNTIME !== "remote") {
    return "node";
  }

  if (
    process.env.EXCEL_RUNTIME === "remote" ||
    process.env.EXCEL_RUNTIME === "node" ||
    process.env.EXCEL_RUNTIME === "python"
  ) {
    return process.env.EXCEL_RUNTIME;
  }

  return process.env.VERCEL ? "node" : "python";
}

export function isNodeExcelRuntime() {
  return getExcelRuntime() === "node";
}

export function isRemoteExcelRuntime() {
  return getExcelRuntime() === "remote";
}

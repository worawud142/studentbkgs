export type ExcelRuntime = "node" | "python";

export function getExcelRuntime(): ExcelRuntime {
  return process.env.EXCEL_RUNTIME === "node" || process.env.VERCEL
    ? "node"
    : "python";
}

export function isNodeExcelRuntime() {
  return getExcelRuntime() === "node";
}

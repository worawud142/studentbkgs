import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { upsertStudentByCode } from "../db";

type ParsedStudentRow = {
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
};

type ParsedWorkbook = {
  sheetName: string | null;
  rows: ParsedStudentRow[];
  errors: { rowNumber: number; message: string }[];
};

function helperScriptPath() {
  return path.resolve(import.meta.dirname, "excel_importer.py");
}

async function runPythonParser(workbookPath: string): Promise<ParsedWorkbook> {
  const script = helperScriptPath();

  return await new Promise<ParsedWorkbook>((resolve, reject) => {
    const child = spawn("python3", [script, workbookPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `excel importer exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout || "{}") as ParsedWorkbook);
      } catch (error) {
        reject(new Error(`Failed to parse Excel import output: ${(error as Error).message}`));
      }
    });
  });
}

function normalizeStatus(status: ParsedStudentRow["status"] | string | undefined) {
  if (status === "transferred" || status === "graduated" || status === "dropped") {
    return status;
  }
  return "active";
}

export async function importStudentsFromWorkbook(options: {
  classroomId: number;
  fileName: string;
  fileContentBase64: string;
}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studentbkgs-import-"));
  const safeName = options.fileName.replace(/[^a-zA-Z0-9ก-๙._-]+/g, "_");
  const inputPath = path.join(tmpDir, safeName || "import.xlsx");

  try {
    await fs.writeFile(inputPath, Buffer.from(options.fileContentBase64, "base64"));
    const workbook = await runPythonParser(inputPath);
    const created: number[] = [];
    const warnings = [...workbook.errors];

    for (const row of workbook.rows) {
      await upsertStudentByCode({
        studentCode: row.studentCode,
        prefix: row.prefix || undefined,
        firstName: row.firstName,
        lastName: row.lastName,
        nationalId: row.nationalId || undefined,
        birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
        gender: row.gender || undefined,
        classroomId: options.classroomId,
        studentNumber: row.studentNumber ?? undefined,
        status: normalizeStatus(row.status),
      });
      created.push(row.rowNumber);
    }

    return {
      sheetName: workbook.sheetName,
      importedCount: created.length,
      skippedCount: warnings.length,
      warnings,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

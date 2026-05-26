import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

let tmpDirs: string[] = [];

async function makeTmpDir() {
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "studentbkgs-excel-export-test-")
  );
  tmpDirs.push(tmpDir);
  return tmpDir;
}

afterEach(async () => {
  await Promise.all(
    tmpDirs.map(tmpDir => fs.rm(tmpDir, { recursive: true, force: true }))
  );
  tmpDirs = [];
});

async function runPythonExporter(templatePath: string, payload: any) {
  const tmpDir = await makeTmpDir();
  const outputPath = path.join(tmpDir, "output.xlsx");
  const scriptPath = path.resolve(process.cwd(), "server/_core/excel_exporter.py");

  await new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [scriptPath, templatePath, outputPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `python exporter exited with code ${code}`));
    });

    child.stdin.end(JSON.stringify(payload), "utf8");
  });
  return { outputPath };
}

async function readCells(
  outputPath: string,
  sheetName: string,
  cells: string[]
) {
  const script = `
import json
import sys
from openpyxl import load_workbook

path = sys.argv[1]
sheet_name = sys.argv[2]
cells = json.loads(sys.argv[3])
wb = load_workbook(path)
ws = wb[sheet_name]
print(json.dumps({cell: ws[cell].value for cell in cells}, ensure_ascii=False))
`;

  const result = await new Promise<string>((resolve, reject) => {
    const child = spawn("python3", ["-c", script, outputPath, sheetName, JSON.stringify(cells)], {
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
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `cell reader exited with code ${code}`));
    });
  });

  return JSON.parse(result) as Record<string, any>;
}

describe("excel exporter", () => {
  const basePayload = {
    mode: "class",
    assignment: {
      subjectCode: "ท11101",
      subjectName: "ภาษาไทย",
      subjectCredits: "1.0",
      hoursPerWeek: 2,
      teacherName: "ครูผู้สอนตัวอย่าง",
      homeroomTeacherName: "นางสมหญิง ใจดี",
      classroomName: "ป.5/1",
      classroomLevel: "primary",
      classroomGrade: 5,
      classroomRoom: 1,
      academicYear: {
        year: 2569,
        semester: 1,
        level: "primary",
      },
    },
    students: [
      {
        id: 1,
        studentNumber: 1,
        studentCode: "1001",
        prefix: "เด็กหญิง",
        firstName: "สมใจ",
        lastName: "รักเรียน",
      },
    ],
    categories: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `หน่วย ${index + 1}`,
      maxScore: index === 0 || index === 7 ? 100 : 0,
      order: index + 1,
      term: "midyear",
    })),
    scores: Array.from({ length: 8 }, (_, index) => ({
      studentId: 1,
      categoryId: index + 1,
      score: index === 0 || index === 7 ? 72 : 0,
    })),
    gradeResults: [
      {
        studentId: 1,
        totalScore: "72",
        grade: "3",
        result: "pass",
        attendanceHours: 0,
        totalHours: 0,
        isFinalized: true,
      },
    ],
    attendance: [],
  };

  it(
    "writes homeroom teacher and preserves assessment formulas for the primary template",
    async () => {
      const { outputPath } = await runPythonExporter(
        path.resolve(process.cwd(), "templates/academic/ปพ.5-ป.1.xlsx"),
        basePayload
      );

      const cover = await readCells(outputPath, "ปก (1)", ["E12"]);
      const summary = await readCells(outputPath, "สรุปผลรวม (10)", ["C8", "Q8"]);
      const sheet = await readCells(outputPath, "คุณลักษณะ -อ่าน -สมรรถนะ(11)", [
        "C5",
        "K5",
        "M5",
        "R5",
        "T5",
        "Y5",
      ]);

      expect(cover.E12).toBe("นางสมหญิง ใจดี");
      expect(summary.C8).toBe(72);
      expect(summary.Q8).toBe("=SUM(C8:P8)");
      expect(sheet.C5).toBe("=K5");
      expect(sheet.K5).toContain("'สรุปผลรวม (10)'!Q8");
      expect(sheet.M5).toBe("=R5");
      expect(sheet.R5).toContain("'สรุปผลรวม (10)'!Q8");
      expect(sheet.T5).toBe("=Y5");
      expect(sheet.Y5).toContain("'สรุปผลรวม (10)'!Q8");
    },
    20000
  );

  it(
    "writes homeroom teacher and preserves assessment formulas for the secondary template",
    async () => {
      const payload = {
        ...basePayload,
        assignment: {
          ...basePayload.assignment,
          classroomLevel: "secondary",
          classroomName: "ม.2/1",
          classroomGrade: 2,
          subjectCode: "ท22101",
          subjectName: "ภาษาไทย",
          homeroomTeacherName: "นางสาวกาญจนา คำดี",
        },
      };

      const { outputPath } = await runPythonExporter(
        path.resolve(process.cwd(), "templates/academic/ปพ.5-ม2.xlsx"),
        payload
      );

      const cover = await readCells(outputPath, "ปก (1)", ["E12"]);
      const summary = await readCells(outputPath, "สรุปผลรวม (8)", ["J7", "Q7"]);
      const sheet = await readCells(outputPath, "คุณลักษณะ อ่าน สมรรถนะ (9)", [
        "C5",
        "K5",
        "M5",
        "R5",
        "T5",
        "Y5",
      ]);

      expect(cover.E12).toBe("นางสาวกาญจนา คำดี");
      expect(summary.J7).toBe(72);
      expect(summary.Q7).toBe("=SUM(C7:P7)");
      expect(sheet.C5).toBe("=K5");
      expect(sheet.K5).toContain("'สรุปผลรวม (8)'!J7");
      expect(sheet.M5).toBe("=R5");
      expect(sheet.R5).toContain("'สรุปผลรวม (8)'!Q7");
      expect(sheet.T5).toBe("=R5");
      expect(sheet.Y5).toBe("=_xlfn.MODE.MULT(T5:X5)");
    },
    20000
  );
});

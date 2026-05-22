import ExcelJS from "exceljs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildNodeExportFile,
  createStudentImportTemplateNode,
  parseStudentsWorkbookNode,
} from "./nodeExcel";

let tmpDirs: string[] = [];

async function makeTmpDir() {
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "studentbkgs-node-excel-test-")
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

describe("node Excel runtime", () => {
  it("creates an import template that can be parsed by ExcelJS", async () => {
    const tmpDir = await makeTmpDir();
    const filePath = path.join(tmpDir, "student-import-template.xlsx");

    await createStudentImportTemplateNode(filePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    expect(workbook.getWorksheet("รายชื่อนักเรียน")).toBeTruthy();
    expect(workbook.getWorksheet("คำอธิบาย")).toBeTruthy();
    expect(workbook.getWorksheet("รายชื่อนักเรียน")?.getCell("B4").value).toBe(
      "รหัสนักเรียน"
    );
  });

  it("parses student rows from a workbook buffer", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("import");
    worksheet.addRow([
      "เลขที่",
      "รหัสนักเรียน",
      "คำนำหน้า",
      "ชื่อ",
      "นามสกุล",
      "เพศ",
      "สถานะ",
    ]);
    worksheet.addRow([
      1,
      "1001",
      "เด็กชาย",
      "สมชาย",
      "รักเรียน",
      "ชาย",
      "ปกติ",
    ]);
    worksheet.addRow([
      2,
      "1002",
      "เด็กหญิง",
      "สมหญิง",
      "ตั้งใจ",
      "หญิง",
      "ย้าย",
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseStudentsWorkbookNode(buffer);

    expect(result.sheetName).toBe("import");
    expect(result.errors).toEqual([]);
    expect(result.rows).toMatchObject([
      {
        studentCode: "1001",
        firstName: "สมชาย",
        gender: "male",
        status: "active",
      },
      {
        studentCode: "1002",
        firstName: "สมหญิง",
        gender: "female",
        status: "transferred",
      },
    ]);
  });

  it("exports a class workbook that can be read back", async () => {
    const tmpDir = await makeTmpDir();
    const outputPath = path.join(tmpDir, "export.xlsx");
    const templatePath = path.join(tmpDir, "template.xlsx");
    const template = new ExcelJS.Workbook();
    template.addWorksheet("ต้นแบบ").getCell("A1").value = "template";
    await template.xlsx.writeFile(templatePath);

    await buildNodeExportFile({
      outputPath,
      templateFileName: templatePath,
      payload: {
        mode: "class",
        assignment: {
          classroomName: "ป.1/1",
          subjectCode: "ค11101",
          subjectName: "คอมพิวเตอร์",
        },
        students: [
          {
            id: 1,
            studentCode: "1001",
            firstName: "สมชาย",
            lastName: "รักเรียน",
          },
        ],
        categories: [{ id: 1, name: "หน่วยที่ 1", maxScore: "10" }],
        scores: [{ categoryId: 1, studentId: 1, score: "9" }],
        gradeResults: [{ studentId: 1, totalScore: "90", grade: "4" }],
        attendance: [{ studentId: 1, date: "2026-05-22", status: "present" }],
      },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputPath);
    expect(workbook.getWorksheet("สรุปส่งออก")?.getCell("B1").value).toContain(
      "ป.1/1"
    );
    expect(workbook.getWorksheet("นักเรียน")?.getCell("B2").value).toBe("1001");
  });
});

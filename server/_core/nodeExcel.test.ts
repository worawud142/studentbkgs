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

  it("fills latest secondary academic print workbook without replacing assessment formulas", async () => {
    const tmpDir = await makeTmpDir();
    const outputPath = path.join(tmpDir, "academic-print.xlsx");

    await buildNodeExportFile({
      outputPath,
      templateFileName: path.resolve(process.cwd(), "templates/academic/ปพ.5-ม2.xlsx"),
      payload: {
        mode: "class",
        assignment: {
          subjectCode: "ท22101",
          subjectName: "ภาษาไทย",
          subjectCredits: "1.0",
          hoursPerWeek: 2,
          teacherName: "ครูผู้สอนตัวอย่าง",
          homeroomTeacherName: "นางสาวกาญจนา คำดี",
          classroomName: "ม.2/1",
          classroomLevel: "secondary",
          classroomGrade: 2,
          academicYear: { year: 2569, semester: 1, level: "secondary" },
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
        gradeResults: [{ studentId: 1, totalScore: "72", grade: "3" }],
        attendance: [],
      },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputPath);
    expect(workbook.getWorksheet("ปก (1)")?.getCell("E12").value).toBe(
      "นางสาวกาญจนา คำดี"
    );
    expect(workbook.getWorksheet("สรุปผลรวม (8)")?.getCell("J7").value).toBe(72);
    const attributeFormula = workbook
      .getWorksheet("คุณลักษณะ อ่าน สมรรถนะ (9)")
      ?.getCell("K5").value;
    expect(attributeFormula).toMatchObject({
      formula: expect.stringContaining("'สรุปผลรวม (8)'!Q7"),
    });
  });
});

import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";

export type ParsedStudentRow = {
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

export type ParsedWorkbook = {
  sheetName: string | null;
  rows: ParsedStudentRow[];
  errors: { rowNumber: number; message: string }[];
};

type ExportPayload = Record<string, any>;

const workbookContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const STUDENT_HEADERS = [
  "เลขที่",
  "รหัสนักเรียน",
  "คำนำหน้า",
  "ชื่อ",
  "นามสกุล",
  "เลขประชาชน",
  "วันเกิด",
  "เพศ",
  "สถานะ",
];

const STUDENT_EXAMPLES = [
  [1, "1234", "เด็กชาย", "สมชาย", "รักเรียน", "", "2016-05-21", "ชาย", "ปกติ"],
  [2, "1235", "เด็กหญิง", "สมหญิง", "ตั้งใจ", "", "2016-08-10", "หญิง", "ปกติ"],
];

const ALIASES: Record<string, string[]> = {
  studentCode: [
    "studentcode",
    "studentid",
    "studentno",
    "code",
    "รหัส",
    "รหัสนักเรียน",
    "รหัสประจำตัวนักเรียน",
  ],
  prefix: ["prefix", "คำนำหน้า", "คำนำหน้าชื่อ"],
  firstName: ["firstname", "firstชื่อ", "ชื่อ", "ชื่อจริง"],
  lastName: ["lastname", "นามสกุล", "surname", "ชื่อสกุล"],
  fullName: [
    "fullname",
    "ชื่อ-สกุล",
    "ชื่อสกุล",
    "ชื่อและนามสกุล",
    "name",
    "นักเรียน",
  ],
  nationalId: [
    "nationalid",
    "idcard",
    "เลขประชาชน",
    "เลขบัตรประชาชน",
    "เลขประจำตัวประชาชน",
  ],
  birthDate: ["birthdate", "dob", "วันเกิด", "วัน/เดือน/ปีเกิด"],
  gender: ["gender", "เพศ"],
  studentNumber: ["studentnumber", "no", "เลขที่", "ลำดับ", "number"],
  status: ["status", "สถานะ"],
};

const PREFIXES = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว", "ด.ช.", "ด.ญ."];

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/.()[\]{}:]+/g, "");
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as any))
    return cleanText((value as any).text);
  if (typeof value === "object" && "result" in (value as any))
    return cleanText((value as any).result);
  return String(value).trim();
}

function formatDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cleanText(value);
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean")
    return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const text = cleanText(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isInteger(numeric) ? numeric : null;
}

function mapGender(value: unknown): ParsedStudentRow["gender"] {
  const text = normalize(value);
  if (["m", "male", "ชาย", "ช"].includes(text)) return "male";
  if (["f", "female", "หญิง", "ญ"].includes(text)) return "female";
  return "";
}

function mapStatus(value: unknown): ParsedStudentRow["status"] | "" {
  const text = normalize(value);
  if (["active", "ใช้งาน", "ปกติ"].includes(text)) return "active";
  if (["transferred", "ย้าย", "ย้ายออก"].includes(text)) return "transferred";
  if (["graduated", "จบ", "จบการศึกษา"].includes(text)) return "graduated";
  if (["dropped", "drop", "ลาออก"].includes(text)) return "dropped";
  return "";
}

function splitFullName(fullName: unknown) {
  let remaining = cleanText(fullName);
  let prefix = "";

  for (const candidate of PREFIXES) {
    if (remaining.startsWith(`${candidate} `)) {
      prefix = candidate;
      remaining = remaining.slice(candidate.length).trim();
      break;
    }
  }

  const parts = remaining.split(/\s+/).filter(Boolean);
  return {
    prefix,
    firstName: parts[0] ?? "",
    lastName: parts.length >= 2 ? parts.slice(1).join(" ") : "",
  };
}

function rowValues(row: ExcelJS.Row) {
  const values = Array.isArray(row.values) ? row.values.slice(1) : [];
  return values.map(value => cleanText(value));
}

function findHeader(rows: string[][]) {
  let bestIndex: number | null = null;
  let bestMap: Record<string, number> = {};

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const mapping: Record<string, number> = {};
    const nonEmpty = row.filter(Boolean).length;

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const value = row[colIndex];
      if (!value) continue;
      const normalized = normalize(value);
      for (const [canonical, aliases] of Object.entries(ALIASES)) {
        if (aliases.some(alias => normalize(alias) === normalized)) {
          mapping[canonical] = colIndex;
          break;
        }
      }
    }

    if (
      mapping.studentCode !== undefined &&
      (mapping.firstName !== undefined || mapping.fullName !== undefined)
    ) {
      return { index, mapping };
    }
    if (
      bestIndex === null &&
      Object.keys(mapping).length > 0 &&
      nonEmpty >= 2
    ) {
      bestIndex = index;
      bestMap = mapping;
    }
  }

  return bestIndex === null ? null : { index: bestIndex, mapping: bestMap };
}

export async function parseStudentsWorkbookNode(
  buffer: Buffer
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  for (const worksheet of workbook.worksheets) {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, row =>
      rows.push(rowValues(row))
    );
    const header = findHeader(rows.slice(0, 20));
    if (!header) continue;

    const parsedRows: ParsedStudentRow[] = [];
    const errors: ParsedWorkbook["errors"] = [];
    const seenCodes = new Set<string>();

    for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.every(value => !value)) continue;

      const record: ParsedStudentRow & { fullName?: string } = {
        rowNumber: rowIndex + 1,
        studentCode: "",
        prefix: "",
        firstName: "",
        lastName: "",
        nationalId: "",
        birthDate: "",
        gender: "",
        studentNumber: null,
        status: "active",
      };

      for (const [canonical, colIndex] of Object.entries(header.mapping)) {
        const value = row[colIndex];
        if (canonical === "studentNumber")
          record.studentNumber = formatNumber(value);
        else if (canonical === "birthDate")
          record.birthDate = formatDate(value);
        else if (canonical === "gender") record.gender = mapGender(value);
        else if (canonical === "status")
          record.status = mapStatus(value) || "active";
        else (record as any)[canonical] = cleanText(value);
      }

      if (!record.firstName && !record.lastName) {
        const split = splitFullName(record.fullName);
        if (split.prefix && !record.prefix) record.prefix = split.prefix;
        record.firstName ||= split.firstName;
        record.lastName ||= split.lastName;
      }

      if (!record.studentCode) {
        errors.push({
          rowNumber: record.rowNumber,
          message: "ไม่พบรหัสนักเรียน",
        });
        continue;
      }
      if (seenCodes.has(record.studentCode)) {
        errors.push({
          rowNumber: record.rowNumber,
          message: "รหัสนักเรียนซ้ำในไฟล์",
        });
        continue;
      }
      if (!record.firstName || !record.lastName) {
        errors.push({
          rowNumber: record.rowNumber,
          message: "ต้องมีชื่อและนามสกุล",
        });
        continue;
      }

      seenCodes.add(record.studentCode);
      delete record.fullName;
      parsedRows.push(record);
    }

    return { sheetName: worksheet.name, rows: parsedRows, errors };
  }

  return {
    sheetName: null,
    rows: [],
    errors: [{ rowNumber: 0, message: "ไม่พบแถวหัวตารางในไฟล์ Excel" }],
  };
}

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "CBD5E1" } },
    left: { style: "thin", color: { argb: "CBD5E1" } },
    bottom: { style: "thin", color: { argb: "CBD5E1" } },
    right: { style: "thin", color: { argb: "CBD5E1" } },
  };
}

export async function createStudentImportTemplateNode(outputPath: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "studentbkgs";
  const worksheet = workbook.addWorksheet("รายชื่อนักเรียน");

  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").value = "เทมเพลตนำเข้ารายชื่อนักเรียน";
  worksheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "1E3A8A" },
  };
  worksheet.mergeCells("A2:I2");
  worksheet.getCell("A2").value =
    "กรอกข้อมูลตั้งแต่แถวที่ 5 เป็นต้นไป ช่องที่จำเป็นคือ รหัสนักเรียน, ชื่อ, นามสกุล";
  worksheet.getCell("A2").font = { color: { argb: "475569" } };

  const headerRow = worksheet.getRow(4);
  STUDENT_HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "0F172A" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "DBEAFE" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    applyThinBorder(cell);
  });

  STUDENT_EXAMPLES.forEach((values, rowOffset) => {
    const row = worksheet.getRow(5 + rowOffset);
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.alignment = { vertical: "middle" };
      applyThinBorder(cell);
    });
  });

  for (let rowIndex = 7; rowIndex <= 56; rowIndex++) {
    for (let col = 1; col <= STUDENT_HEADERS.length; col++)
      applyThinBorder(worksheet.getCell(rowIndex, col));
  }

  [8, 18, 14, 18, 22, 20, 14, 10, 14].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.views = [{ state: "frozen", ySplit: 4 }];
  worksheet.autoFilter = "A4:I56";
  worksheet.getCell("C5").dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"เด็กชาย,เด็กหญิง,นาย,นางสาว"'],
  };
  worksheet.getCell("H5").dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"ชาย,หญิง"'],
  };
  worksheet.getCell("I5").dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: ['"ปกติ,ย้าย,จบ,ลาออก"'],
  };

  const note = workbook.addWorksheet("คำอธิบาย");
  note.getCell("A1").value = "คำอธิบายคอลัมน์";
  note.getCell("A1").font = { bold: true, size: 14 };
  [
    ["เลขที่", "เลขที่ในห้อง เช่น 1, 2, 3"],
    ["รหัสนักเรียน", "จำเป็น และต้องไม่ซ้ำ เช่น 1234"],
    ["คำนำหน้า", "เด็กชาย, เด็กหญิง, นาย, นางสาว"],
    ["ชื่อ", "จำเป็น"],
    ["นามสกุล", "จำเป็น"],
    ["เลขประชาชน", "ใส่หรือเว้นว่างได้"],
    ["วันเกิด", "แนะนำรูปแบบ yyyy-mm-dd เช่น 2016-05-21"],
    ["เพศ", "ชาย หรือ หญิง"],
    ["สถานะ", "ปกติ, ย้าย, จบ, ลาออก ถ้าเว้นว่างจะถือว่า ปกติ"],
  ].forEach(([name, description], index) => {
    note.getCell(index + 3, 1).value = name;
    note.getCell(index + 3, 1).font = { bold: true };
    note.getCell(index + 3, 2).value = description;
  });
  note.getColumn(1).width = 18;
  note.getColumn(2).width = 60;

  await workbook.xlsx.writeFile(outputPath);
}

function sheetName(name: string) {
  return name.slice(0, 31).replace(/[\\/*?:[\]]/g, " ");
}

function addRowsSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Record<string, unknown>[]
) {
  const worksheet = workbook.addWorksheet(sheetName(name));
  if (!rows.length) {
    worksheet.addRow(["ไม่มีข้อมูล"]);
    return worksheet;
  }

  const headers = Object.keys(rows[0]);
  worksheet.addRow(headers);
  worksheet.getRow(1).font = { bold: true };
  rows.forEach(row =>
    worksheet.addRow(headers.map(header => row[header] ?? ""))
  );
  worksheet.columns.forEach(column => {
    column.width = Math.min(
      32,
      Math.max(
        12,
        ...(column.values ?? []).map(value => cleanText(value).length + 2)
      )
    );
  });
  return worksheet;
}

function addCommonDataSheets(
  workbook: ExcelJS.Workbook,
  payload: ExportPayload
) {
  const mode = payload.mode;
  const meta = mode === "student" ? payload.student : payload.assignment;
  const title =
    mode === "student"
      ? [meta?.studentCode, meta?.firstName, meta?.lastName]
          .filter(Boolean)
          .join(" ")
      : [meta?.classroomName, meta?.subjectCode, meta?.subjectName]
          .filter(Boolean)
          .join(" ");

  const summary = workbook.addWorksheet("สรุปส่งออก");
  summary.addRows([
    ["หัวข้อ", title],
    ["ชนิด", mode],
    ["สร้างโดย", "studentbkgs Node Excel runtime"],
  ]);
  summary.getColumn(1).width = 18;
  summary.getColumn(2).width = 50;

  if (mode === "class") {
    addRowsSheet(workbook, "นักเรียน", payload.students ?? []);
    addRowsSheet(workbook, "หมวดคะแนน", payload.categories ?? []);
    addRowsSheet(workbook, "คะแนนดิบ", payload.scores ?? []);
    addRowsSheet(workbook, "ผลการเรียน", payload.gradeResults ?? []);
    addRowsSheet(workbook, "เช็คชื่อ", payload.attendance ?? []);
  } else {
    addRowsSheet(workbook, "ผลการเรียนรายบุคคล", payload.gradeResults ?? []);
  }
}

async function loadTemplateWorkbook(templateFileName: string) {
  const templatePath = path.isAbsolute(templateFileName)
    ? templateFileName
    : path.resolve(process.cwd(), templateFileName);
  const workbook = new ExcelJS.Workbook();
  try {
    await fs.access(templatePath);
    await workbook.xlsx.readFile(templatePath);
    return workbook;
  } catch (error) {
    console.warn(
      "[Node Excel] Falling back to generated workbook:",
      error instanceof Error ? error.message : String(error)
    );
    return new ExcelJS.Workbook();
  }
}

export async function buildNodeExportFile(options: {
  payload: ExportPayload;
  templateFileName: string;
  outputPath: string;
}) {
  const workbook = await loadTemplateWorkbook(options.templateFileName);
  addCommonDataSheets(workbook, options.payload);
  await workbook.xlsx.writeFile(options.outputPath);
  return {
    contentType: workbookContentType,
  };
}

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

const LATEST_PRIMARY_TERM_SHEETS = {
  midyear: "ภาค1(8)",
  endyear: "ภาค2 (9)",
} as const;
const LATEST_PRIMARY_SUMMARY_SHEET = "สรุปผลรวม (10)";
const LATEST_PRIMARY_UNIT_SCORE_COLUMNS = [3, 8, 13, 18, 23];
const LATEST_PRIMARY_UNIT_SUMMARY_COLUMNS = {
  midyear: [3, 4, 5, 6, 7],
  endyear: [9, 10, 11, 12, 13],
} as const;
const LATEST_PRIMARY_FINAL_SUMMARY_COLUMNS = {
  midyear: 15,
  endyear: 16,
} as const;
const LATEST_SECONDARY_UNIT_SHEETS: Array<[string, number[]]> = [
  ["หน่วย 1,4 (5)", [3, 10, 17, 24]],
  ["หน่วย 5,8 (6)", [3, 10, 17, 24]],
  ["หน่วย 9,12 (7)", [3, 10, 17, 24]],
];
const LATEST_SECONDARY_SUMMARY_SHEET = "สรุปผลรวม (8)";
const LATEST_SECONDARY_UNIT_SUMMARY_COLUMNS = Array.from(
  { length: 12 },
  (_, index) => index + 3
);
const LATEST_SECONDARY_FINAL_SUMMARY_COLUMNS = {
  midyear: 15,
  endyear: 16,
} as const;

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

function studentName(student: Record<string, any>) {
  return `${student.prefix ?? ""}${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
}

function visibleStudents(payload: ExportPayload) {
  return (payload.students ?? []).filter(
    (student: Record<string, any>) => student.status !== "dropped"
  );
}

function classroomGrade(assignment: Record<string, any>) {
  if (assignment.classroomGrade !== null && assignment.classroomGrade !== undefined) {
    return assignment.classroomGrade;
  }
  const match = String(assignment.classroomName ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : "";
}

function assignedTeacherLabel(assignment: Record<string, any>) {
  return assignment.classroomLevel === "primary" ? "ครูประจำชั้น" : "ครูที่ปรึกษา";
}

function assignedTeacherName(assignment: Record<string, any>) {
  return cleanText(assignment.homeroomTeacherName || assignment.teacherName);
}

function excelNumberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Number.isInteger(numeric) ? numeric : numeric;
}

function writeExcelNumber(cell: ExcelJS.Cell, value: unknown) {
  const normalized = excelNumberValue(value);
  cell.value = normalized as any;
  if (normalized === "") return;
  cell.numFmt = Number.isInteger(normalized) ? "0" : "0.##";
}

function writeFormula(cell: ExcelJS.Cell, formula: string) {
  cell.value = { formula: formula.replace(/^=/, "") };
}

function normalizeTerm(category: Record<string, any>): "midyear" | "endyear" {
  return category.term === "endyear" ? "endyear" : "midyear";
}

function isFinalCategory(category: Record<string, any>) {
  return ["ปลายภาค 1", "ปลายภาค 2", "กลางภาค", "ปลายภาค"].includes(
    cleanText(category.name)
  );
}

function sortCategories(categories: Record<string, any>[]) {
  return [...categories].sort((a, b) => {
    const term = (normalizeTerm(a) === "endyear" ? 1 : 0) - (normalizeTerm(b) === "endyear" ? 1 : 0);
    if (term) return term;
    const final = (isFinalCategory(a) ? 1 : 0) - (isFinalCategory(b) ? 1 : 0);
    if (final) return final;
    const order = Number(a.order ?? 0) - Number(b.order ?? 0);
    if (order) return order;
    return cleanText(a.name).localeCompare(cleanText(b.name), "th");
  });
}

function termCategories(categories: Record<string, any>[], term: "midyear" | "endyear") {
  return categories.filter(category => normalizeTerm(category) === term && !isFinalCategory(category));
}

function primaryFinalCategory(categories: Record<string, any>[], term: "midyear" | "endyear") {
  const expected = term === "midyear" ? "ปลายภาค 1" : "ปลายภาค 2";
  return categories.find(category => cleanText(category.name) === expected) ?? null;
}

function secondaryFinalCategory(categories: Record<string, any>[], term: "midyear" | "endyear") {
  const expected = term === "midyear" ? new Set(["กลางภาค", "ปลายภาค 1"]) : new Set(["ปลายภาค", "ปลายภาค 2"]);
  return (
    categories.find(category => expected.has(cleanText(category.name))) ??
    categories.find(category => normalizeTerm(category) === term && isFinalCategory(category)) ??
    null
  );
}

function scoreMap(payload: ExportPayload): Map<string, unknown> {
  return new Map(
    (payload.scores ?? []).map((score: Record<string, any>) => [
      `${score.categoryId}:${score.studentId}`,
      score.score,
    ])
  );
}

function categoryScore(
  scores: Map<string, unknown>,
  category: Record<string, any>,
  student: Record<string, any>
) {
  return scores.get(`${category.id}:${student.id}`) ?? "";
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

function uniqueSheetName(workbook: ExcelJS.Workbook, preferredName: string) {
  const baseName = sheetName(preferredName).slice(0, 28) || "Sheet";
  if (!workbook.getWorksheet(baseName)) return baseName;
  for (let index = 2; index < 100; index++) {
    const candidate = `${baseName.slice(0, 28)} (${index})`.slice(0, 31);
    if (!workbook.getWorksheet(candidate)) return candidate;
  }
  return `${baseName.slice(0, 24)} ${Date.now().toString().slice(-6)}`.slice(0, 31);
}

function addRowsSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Record<string, unknown>[]
) {
  const worksheet = workbook.addWorksheet(uniqueSheetName(workbook, name));
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

function hasSheets(workbook: ExcelJS.Workbook, sheetNames: string[]) {
  return sheetNames.every(name => workbook.getWorksheet(name));
}

function clearColumns(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  columns: number[]
) {
  for (let row = startRow; row <= worksheet.rowCount; row++) {
    for (const column of columns) {
      worksheet.getCell(row, column).value = null;
    }
  }
}

function clearScoreEntryColumns(
  worksheet: ExcelJS.Worksheet,
  columns: number[],
  startRow: number,
  detailWidth: number
) {
  const clearCols = columns.flatMap(column =>
    Array.from({ length: detailWidth }, (_, index) => column + index)
  );
  clearColumns(worksheet, startRow, clearCols);
}

function writeStudentLists(
  workbook: ExcelJS.Workbook,
  students: Record<string, any>[]
) {
  for (const worksheet of workbook.worksheets) {
    if (!worksheet.name.startsWith("เวลาเรียน")) continue;
    for (let row = 6; row <= worksheet.rowCount; row++) {
      for (const column of [1, 2, 3]) worksheet.getCell(row, column).value = null;
    }
    students.forEach((student, index) => {
      const row = 6 + index;
      worksheet.getCell(row, 1).value = student.studentNumber || index + 1;
      worksheet.getCell(row, 2).value = student.studentCode || "";
      worksheet.getCell(row, 3).value = studentName(student);
    });
  }
}

function writeScoreStudentNames(
  workbook: ExcelJS.Workbook,
  students: Record<string, any>[]
) {
  const rows: Array<[string, number]> = [];
  if (
    hasSheets(workbook, [
      "ปก (1)",
      "เวลาเรียน (2)",
      LATEST_PRIMARY_TERM_SHEETS.midyear,
      LATEST_PRIMARY_TERM_SHEETS.endyear,
      LATEST_PRIMARY_SUMMARY_SHEET,
    ])
  ) {
    rows.push(
      [LATEST_PRIMARY_TERM_SHEETS.midyear, 7],
      [LATEST_PRIMARY_TERM_SHEETS.endyear, 7],
      [LATEST_PRIMARY_SUMMARY_SHEET, 8]
    );
  }
  if (hasSheets(workbook, ["ปก (1)", "เวลาเรียน (2)", LATEST_SECONDARY_SUMMARY_SHEET])) {
    rows.push(
      ...LATEST_SECONDARY_UNIT_SHEETS.map(([sheetName]) => [sheetName, 6] as [string, number]),
      [LATEST_SECONDARY_SUMMARY_SHEET, 7]
    );
  }

  for (const [sheetName, startRow] of rows) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;
    for (let row = startRow; row <= worksheet.rowCount; row++) {
      worksheet.getCell(row, 1).value = null;
      worksheet.getCell(row, 2).value = null;
    }
    students.forEach((student, index) => {
      const row = startRow + index;
      worksheet.getCell(row, 1).value = student.studentNumber || index + 1;
      worksheet.getCell(row, 2).value = studentName(student);
    });
  }
}

function writeCover(workbook: ExcelJS.Workbook, assignment: Record<string, any>) {
  const worksheet = workbook.getWorksheet("ปก (1)");
  if (!worksheet) return;
  worksheet.getCell(9, 7).value = classroomGrade(assignment);
  worksheet.getCell(9, 15).value = assignment.academicYear?.year ?? "";
  worksheet.getCell(10, 5).value = assignment.subjectName ?? "";
  worksheet.getCell(10, 12).value = assignment.subjectCode ?? "";
  worksheet.getCell(11, 5).value = assignment.hoursPerWeek ?? "";
  worksheet.getCell(11, 14).value = assignment.subjectCredits ?? "";
  worksheet.getCell(12, 3).value = assignedTeacherLabel(assignment);
  worksheet.getCell(12, 5).value = assignedTeacherName(assignment);
}

function writeCategoryToColumn(
  worksheet: ExcelJS.Worksheet,
  category: Record<string, any>,
  students: Record<string, any>[],
  scores: Map<string, unknown>,
  column: number,
  headerRow: number,
  firstStudentRow: number
) {
  writeExcelNumber(worksheet.getCell(headerRow, column), category.maxScore);
  students.forEach((student, index) => {
    writeExcelNumber(
      worksheet.getCell(firstStudentRow + index, column),
      categoryScore(scores, category, student)
    );
  });
}

function writePrimaryScores(
  workbook: ExcelJS.Workbook,
  categories: Record<string, any>[],
  students: Record<string, any>[],
  scores: Map<string, unknown>
) {
  const summary = workbook.getWorksheet(LATEST_PRIMARY_SUMMARY_SHEET);
  if (!summary) return;
  clearColumns(summary, 7, [
    ...LATEST_PRIMARY_UNIT_SUMMARY_COLUMNS.midyear,
    ...LATEST_PRIMARY_UNIT_SUMMARY_COLUMNS.endyear,
  ]);
  clearColumns(summary, 8, Object.values(LATEST_PRIMARY_FINAL_SUMMARY_COLUMNS));

  for (const term of ["midyear", "endyear"] as const) {
    const worksheet = workbook.getWorksheet(LATEST_PRIMARY_TERM_SHEETS[term]);
    if (!worksheet) continue;
    clearScoreEntryColumns(worksheet, LATEST_PRIMARY_UNIT_SCORE_COLUMNS, 6, 3);
    termCategories(categories, term)
      .slice(0, LATEST_PRIMARY_UNIT_SCORE_COLUMNS.length)
      .forEach((category, index) => {
        writeCategoryToColumn(
          worksheet,
          category,
          students,
          scores,
          LATEST_PRIMARY_UNIT_SCORE_COLUMNS[index],
          6,
          7
        );
        writeCategoryToColumn(
          summary,
          category,
          students,
          scores,
          LATEST_PRIMARY_UNIT_SUMMARY_COLUMNS[term][index],
          7,
          8
        );
      });

    const finalCategory = primaryFinalCategory(categories, term);
    if (finalCategory) {
      const column = LATEST_PRIMARY_FINAL_SUMMARY_COLUMNS[term];
      writeExcelNumber(summary.getCell(7, column), finalCategory.maxScore);
      students.forEach((student, index) => {
        writeExcelNumber(
          summary.getCell(8 + index, column),
          categoryScore(scores, finalCategory, student)
        );
      });
    }
  }
}

function writeSecondaryScores(
  workbook: ExcelJS.Workbook,
  categories: Record<string, any>[],
  students: Record<string, any>[],
  scores: Map<string, unknown>
) {
  const summary = workbook.getWorksheet(LATEST_SECONDARY_SUMMARY_SHEET);
  if (!summary) return;
  const unitSlots: Array<[ExcelJS.Worksheet, number]> = [];

  for (const [sheetName, columns] of LATEST_SECONDARY_UNIT_SHEETS) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;
    clearScoreEntryColumns(worksheet, columns, 5, 5);
    columns.forEach(column => unitSlots.push([worksheet, column]));
  }

  clearColumns(summary, 6, LATEST_SECONDARY_UNIT_SUMMARY_COLUMNS);
  clearColumns(summary, 7, Object.values(LATEST_SECONDARY_FINAL_SUMMARY_COLUMNS));

  categories
    .filter(category => !isFinalCategory(category))
    .slice(0, unitSlots.length)
    .forEach((category, index) => {
      const [worksheet, scoreColumn] = unitSlots[index];
      writeCategoryToColumn(worksheet, category, students, scores, scoreColumn, 5, 6);
      writeCategoryToColumn(
        summary,
        category,
        students,
        scores,
        LATEST_SECONDARY_UNIT_SUMMARY_COLUMNS[index],
        6,
        7
      );
    });

  for (const term of ["midyear", "endyear"] as const) {
    const finalCategory = secondaryFinalCategory(categories, term);
    if (!finalCategory) continue;
    const column = LATEST_SECONDARY_FINAL_SUMMARY_COLUMNS[term];
    writeExcelNumber(summary.getCell(6, column), finalCategory.maxScore);
    students.forEach((student, index) => {
      writeExcelNumber(
        summary.getCell(7 + index, column),
        categoryScore(scores, finalCategory, student)
      );
    });
  }
}

function repairSecondaryAssessmentFormulas(
  workbook: ExcelJS.Workbook,
  students: Record<string, any>[]
) {
  const worksheet = workbook.getWorksheet("คุณลักษณะ อ่าน สมรรถนะ (9)");
  if (!worksheet) return;
  students.forEach((_student, index) => {
    const assessmentRow = 5 + index;
    const summaryRow = 7 + index;
    writeFormula(
      worksheet.getCell(assessmentRow, 11),
      `IF('${LATEST_SECONDARY_SUMMARY_SHEET}'!Q${summaryRow}>70,3,IF('${LATEST_SECONDARY_SUMMARY_SHEET}'!Q${summaryRow}>59,2,IF('${LATEST_SECONDARY_SUMMARY_SHEET}'!Q${summaryRow}>49,1,IF('${LATEST_SECONDARY_SUMMARY_SHEET}'!Q${summaryRow}<50,0))))`
    );
  });
}

function fillLatestAcademicPrintWorkbook(
  workbook: ExcelJS.Workbook,
  payload: ExportPayload
) {
  if (payload.mode !== "class") return false;
  const assignment = payload.assignment ?? {};
  const students = visibleStudents(payload);
  const categories = sortCategories(payload.categories ?? []);
  const scores = scoreMap(payload);

  writeCover(workbook, assignment);
  writeStudentLists(workbook, students);
  writeScoreStudentNames(workbook, students);
  repairSecondaryAssessmentFormulas(workbook, students);

  if (
    hasSheets(workbook, [
      "ปก (1)",
      "เวลาเรียน (2)",
      LATEST_PRIMARY_TERM_SHEETS.midyear,
      LATEST_PRIMARY_TERM_SHEETS.endyear,
      LATEST_PRIMARY_SUMMARY_SHEET,
    ])
  ) {
    writePrimaryScores(workbook, categories, students, scores);
    return true;
  }

  if (hasSheets(workbook, ["ปก (1)", "เวลาเรียน (2)", LATEST_SECONDARY_SUMMARY_SHEET])) {
    writeSecondaryScores(workbook, categories, students, scores);
    return true;
  }

  return false;
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
  fillLatestAcademicPrintWorkbook(workbook, options.payload);
  addCommonDataSheets(workbook, options.payload);
  workbook.calcProperties.fullCalcOnLoad = true;
  await workbook.xlsx.writeFile(options.outputPath);
  return {
    contentType: workbookContentType,
  };
}

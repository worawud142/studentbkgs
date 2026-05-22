import { spawn } from "child_process";
import { existsSync } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  getClassroomById,
  getAcademicYearById,
  getAssignmentById,
  getAttendanceByAssignment,
  getGradeResults,
  getScoreCategories,
  getScoresByAssignment,
  getStudentById,
  getStudentGradeResults,
  getStudentsByClassroom,
} from "../db";
import {
  academicPrintContentType,
  getAcademicPrintTemplateCandidates,
} from "./academicPrintTemplates";
import { isNodeExcelRuntime } from "./excelRuntime";
import { buildNodeExportFile } from "./nodeExcel";

export type ExportTemplateId =
  | "secondary-demo"
  | "primary-score"
  | "academic-print";
export type ExportKind = "class" | "student";

type TemplateMeta = {
  fileName: string;
  outputName: string;
  contentType: string;
  kind: ExportKind;
};

const TEMPLATES: Record<ExportTemplateId, TemplateMeta> = {
  "secondary-demo": {
    fileName: "ตัวอย่างมัธยม.xlsx",
    outputName: "secondary-demo.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "class",
  },
  "primary-score": {
    fileName: "เก็บคะแนนประถม.xlsx",
    outputName: "primary-score.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "class",
  },
  "academic-print": {
    fileName: "ปริ้นส่งวิชาการ.xlsm",
    outputName: "academic-print.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "student",
  },
};

export type ExportRequest =
  | {
      templateId: "secondary-demo" | "primary-score" | "academic-print";
      assignmentId: number;
    }
  | {
      templateId: "academic-print";
      studentId: number;
    };

export type ExportResult = {
  filePath: string;
  fileName: string;
  contentType: string;
  cleanup: () => Promise<void>;
};

function templatePath(fileName: string) {
  if (path.isAbsolute(fileName)) return fileName;
  return path.resolve(process.cwd(), fileName);
}

function helperScriptPath() {
  const candidates = [
    path.resolve(import.meta.dirname, "excel_exporter.py"),
    path.resolve(process.cwd(), "server", "_core", "excel_exporter.py"),
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0];
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildClassExportName(
  payload: Awaited<ReturnType<typeof buildClassPayload>>
) {
  const parts = [
    payload.assignment.classroomName,
    payload.assignment.subjectCode,
    payload.assignment.subjectName,
  ]
    .map(safeFilePart)
    .filter(Boolean);

  return `${parts.join("_") || "export"}.xlsx`;
}

function buildStudentExportName(
  payload: Awaited<ReturnType<typeof buildStudentPayload>>,
  extension = ".xlsx"
) {
  const parts = [
    payload.student.studentCode,
    payload.student.firstName,
    payload.student.lastName,
  ]
    .map(safeFilePart)
    .filter(Boolean);

  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return `${parts.join("_") || "student"}${safeExtension}`;
}

async function runPythonExporter(
  payload: unknown,
  templateFileName: string,
  outputPath: string
) {
  const script = helperScriptPath();
  const template = templatePath(templateFileName);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [script, template, outputPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else
        reject(
          new Error(stderr.trim() || `excel exporter exited with code ${code}`)
        );
    });

    child.stdin.end(JSON.stringify(payload), "utf8");
  });
}

async function resolveAcademicPrintTemplateCandidates(
  level?: "primary" | "secondary"
) {
  const candidates = getAcademicPrintTemplateCandidates(level);
  const existing: string[] = [];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      existing.push(candidate);
    } catch {
      continue;
    }
  }

  const fallback = path.resolve(process.cwd(), "ปริ้นส่งวิชาการ.xlsm");
  return existing.length > 0 ? existing : [fallback];
}

async function runAcademicPrintExporter(
  payload: unknown,
  candidates: string[],
  tmpDir: string,
  buildName: (templateFileName: string) => string
) {
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const templateFileName = path.basename(candidate);
    const filePath = path.join(tmpDir, buildName(templateFileName));

    try {
      await runPythonExporter(payload, candidate, filePath);
      return { filePath, templateFileName };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to generate academic print workbook");
}

async function runNodeExporter(
  payload: unknown,
  templateFileName: string,
  outputPath: string
) {
  return buildNodeExportFile({
    payload: payload as Record<string, any>,
    templateFileName,
    outputPath,
  });
}

async function buildClassPayload(assignmentId: number) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw new Error("Assignment not found");

  const classroom = assignment.classroom;
  const subject = assignment.subject;
  const academicYear = await getAcademicYearById(
    assignment.assignment.academicYearId
  );
  const students = await getStudentsByClassroom(
    assignment.assignment.classroomId
  );
  const categories = await getScoreCategories(assignmentId);
  const scores = await getScoresByAssignment(assignmentId);
  const gradeResults = await getGradeResults(assignmentId);
  const attendance = await getAttendanceByAssignment(assignmentId);

  const studentRows = students.map(student => ({
    id: student.id,
    studentNumber: student.studentNumber,
    studentCode: student.studentCode,
    prefix: student.prefix,
    firstName: student.firstName,
    lastName: student.lastName,
    nationalId: student.nationalId,
    birthDate: normalizeCellValue(student.birthDate),
    gender: student.gender,
    status: student.status,
  }));

  const scoreRows = scores.map(score => ({
    categoryId: score.categoryId,
    studentId: score.studentId,
    score: normalizeCellValue(score.score),
    note: score.note,
    recordedBy: score.recordedBy,
  }));

  const gradeRows = gradeResults.map(result => ({
    studentId: result.studentId,
    totalScore: normalizeCellValue(result.totalScore),
    grade: result.grade,
    result: result.result,
    attendanceHours: result.attendanceHours,
    totalHours: result.totalHours,
    isFinalized: result.isFinalized,
  }));

  const attendanceRows = attendance.map(item => ({
    assignmentId: item.assignmentId,
    studentId: item.studentId,
    date: normalizeCellValue(item.date),
    status: item.status,
    note: item.note,
    recordedBy: item.recordedBy,
  }));

  return {
    mode: "class" as const,
    assignment: {
      id: assignment.assignment.id,
      subjectCode: subject?.subjectCode ?? "",
      subjectName: subject?.name ?? "",
      subjectGroup: subject?.subjectGroup ?? "",
      classroomName: classroom?.name ?? "",
      classroomLevel: classroom?.level ?? "",
      classroomGrade: classroom?.grade ?? null,
      classroomRoom: classroom?.room ?? null,
      academicYear: academicYear
        ? {
            year: academicYear.year,
            semester: academicYear.semester,
            level: academicYear.level,
          }
        : null,
    },
    students: studentRows,
    categories: categories.map(category => ({
      id: category.id,
      name: category.name,
      maxScore: normalizeCellValue(category.maxScore),
      order: category.order,
      term: (category as any).term ?? "",
    })),
    scores: scoreRows,
    gradeResults: gradeRows,
    attendance: attendanceRows,
    firstStudent: studentRows[0] ?? null,
  };
}

async function buildStudentPayload(studentId: number) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error("Student not found");
  const classroom = await getClassroomById(student.classroomId);

  const gradeResults = await getStudentGradeResults(studentId);
  const assignmentIds = Array.from(
    new Set(
      gradeResults
        .map(row => row.assignment?.id)
        .filter((value): value is number => typeof value === "number")
    )
  );
  const classAverageByAssignmentId = new Map<number, string>();

  for (const assignmentId of assignmentIds) {
    const results = await getGradeResults(assignmentId);
    const numericValues = results
      .map(row => Number(row.totalScore))
      .filter(value => Number.isFinite(value));
    const average =
      numericValues.length > 0
        ? numericValues.reduce((sum, value) => sum + value, 0) /
          numericValues.length
        : null;
    classAverageByAssignmentId.set(
      assignmentId,
      average === null ? "" : average.toFixed(2)
    );
  }

  return {
    mode: "student" as const,
    student: {
      id: student.id,
      studentCode: student.studentCode,
      prefix: student.prefix,
      firstName: student.firstName,
      lastName: student.lastName,
      nationalId: student.nationalId,
      birthDate: normalizeCellValue(student.birthDate),
      gender: student.gender,
      status: student.status,
    },
    classroom: classroom
      ? {
          id: classroom.id,
          name: classroom.name,
          level: classroom.level,
          grade: classroom.grade,
          room: classroom.room,
          academicYearId: classroom.academicYearId,
        }
      : null,
    gradeResults: gradeResults.map(row => ({
      assignmentId: row.assignment?.id,
      subjectCode: row.subject?.subjectCode ?? "",
      subjectName: row.subject?.name ?? "",
      subjectGroup: row.subject?.subjectGroup ?? "",
      classroomName: row.classroom?.name ?? "",
      classroomLevel: row.classroom?.level ?? "",
      totalHours: row.result.totalHours,
      totalScore: normalizeCellValue(row.result.totalScore),
      classAverage:
        classAverageByAssignmentId.get(row.assignment?.id ?? -1) ?? "",
      grade: row.result.grade ?? "",
      result: row.result.result ?? "",
      attendanceHours: row.result.attendanceHours ?? 0,
    })),
  };
}

export async function buildExport(
  request: ExportRequest
): Promise<ExportResult> {
  const template = TEMPLATES[request.templateId];
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "studentbkgs-export-")
  );
  const useNodeExcel = isNodeExcelRuntime();
  if (request.templateId === "academic-print" && "studentId" in request) {
    const payload = await buildStudentPayload(request.studentId);
    const candidates = await resolveAcademicPrintTemplateCandidates(
      payload.classroom?.level
    );
    if (useNodeExcel) {
      const templateFileName =
        candidates.find(
          candidate => path.extname(candidate).toLowerCase() === ".xlsx"
        ) ?? template.fileName;
      const filePath = path.join(
        tmpDir,
        buildStudentExportName(payload, ".xlsx")
      );
      const result = await runNodeExporter(payload, templateFileName, filePath);
      return {
        filePath,
        fileName: path.basename(filePath),
        contentType: result.contentType,
        cleanup: async () => {
          await fs.rm(tmpDir, { recursive: true, force: true });
        },
      };
    }
    const { filePath, templateFileName } = await runAcademicPrintExporter(
      payload,
      candidates,
      tmpDir,
      templateName =>
        buildStudentExportName(payload, path.extname(templateName) || ".xlsx")
    );

    return {
      filePath,
      fileName: path.basename(filePath),
      contentType: academicPrintContentType(templateFileName),
      cleanup: async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
      },
    };
  }

  const payload = await buildClassPayload(request.assignmentId);
  if (request.templateId === "academic-print") {
    const candidates = await resolveAcademicPrintTemplateCandidates(
      payload.assignment.classroomLevel as "primary" | "secondary" | undefined
    );
    if (useNodeExcel) {
      const templateFileName =
        candidates.find(
          candidate => path.extname(candidate).toLowerCase() === ".xlsx"
        ) ?? template.fileName;
      const filePath = path.join(
        tmpDir,
        `${safeFilePart(`ปพ5_${payload.assignment.classroomName}_${payload.assignment.subjectCode}_${payload.assignment.subjectName}`) || "academic-print"}.xlsx`
      );
      const result = await runNodeExporter(payload, templateFileName, filePath);
      return {
        filePath,
        fileName: path.basename(filePath),
        contentType: result.contentType,
        cleanup: async () => {
          await fs.rm(tmpDir, { recursive: true, force: true });
        },
      };
    }
    const { filePath, templateFileName } = await runAcademicPrintExporter(
      payload,
      candidates,
      tmpDir,
      templateName =>
        `${safeFilePart(`ปพ5_${payload.assignment.classroomName}_${payload.assignment.subjectCode}_${payload.assignment.subjectName}`) || "academic-print"}${path.extname(templateName) || ".xlsx"}`
    );

    return {
      filePath,
      fileName: path.basename(filePath),
      contentType: academicPrintContentType(templateFileName),
      cleanup: async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
      },
    };
  }

  const filePath = path.join(tmpDir, buildClassExportName(payload));

  const result = useNodeExcel
    ? await runNodeExporter(payload, template.fileName, filePath)
    : (await runPythonExporter(payload, template.fileName, filePath),
      { contentType: template.contentType });

  return {
    filePath,
    fileName: path.basename(filePath),
    contentType: result.contentType,
    cleanup: async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

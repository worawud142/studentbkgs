import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const APP_DB_SCHEMA = process.env.DB_SCHEMA ?? "studentbkgs";
const scopedSchema: any =
  APP_DB_SCHEMA === "public"
    ? {
        enum: pgEnum,
        table: pgTable,
      }
    : pgSchema(APP_DB_SCHEMA);

export const appSchema = scopedSchema;

export const userRoleEnum = appSchema.enum("user_role", ["user", "teacher", "admin", "reviewer"]);
export const schoolLevelEnum = appSchema.enum("school_level", [
  "primary",
  "secondary",
]);
export const studentStatusEnum = appSchema.enum("student_status", [
  "active",
  "transferred",
  "graduated",
  "dropped",
]);
export const genderEnum = appSchema.enum("gender", ["male", "female"]);
export const subjectLevelEnum = appSchema.enum("subject_level", [
  "primary",
  "secondary",
  "both",
]);
export const teachingLevelEnum = appSchema.enum("teaching_level", [
  "primary",
  "secondary",
  "both",
]);
export const attendanceStatusEnum = appSchema.enum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);
export const gradeResultEnum = appSchema.enum("grade_result", [
  "pass",
  "fail",
  "incomplete",
  "exempted",
]);
export const documentTypeEnum = appSchema.enum("document_type", [
  "por1",
  "por5",
  "por6",
]);

// ─── QR Scan Boxes ────────────────────────────────────────────────────────────
export const qrScanDevices = appSchema.table("qr_scan_devices", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  assignmentId: integer("assignmentId").notNull(),
  deviceTokenHash: varchar("deviceTokenHash", { length: 128 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  lastSeenAt: timestamp("lastSeenAt", { mode: "date", withTimezone: true }),
  lastScanAt: timestamp("lastScanAt", { mode: "date", withTimezone: true }),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type QrScanDevice = typeof qrScanDevices.$inferSelect;
export type InsertQrScanDevice = typeof qrScanDevices.$inferInsert;

export const qrScanLogs = appSchema.table("qr_scan_logs", {
  id: serial("id").primaryKey(),
  deviceId: integer("deviceId").notNull(),
  assignmentId: integer("assignmentId").notNull(),
  studentId: integer("studentId"),
  rawValue: text("rawValue").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  message: text("message"),
  scannedAt: timestamp("scannedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type QrScanLog = typeof qrScanLogs.$inferSelect;
export type InsertQrScanLog = typeof qrScanLogs.$inferInsert;

export const qrScanSessions = appSchema.table("qr_scan_sessions", {
  id: serial("id").primaryKey(),
  deviceId: integer("deviceId").notNull(),
  teacherUserId: integer("teacherUserId").notNull(),
  assignmentId: integer("assignmentId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  openedAt: timestamp("openedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  lastScanAt: timestamp("lastScanAt", { mode: "date", withTimezone: true }),
  closedAt: timestamp("closedAt", { mode: "date", withTimezone: true }),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type QrScanSession = typeof qrScanSessions.$inferSelect;
export type InsertQrScanSession = typeof qrScanSessions.$inferInsert;

// ─── Users / Teachers ─────────────────────────────────────────────────────────
export const users = appSchema.table("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Teacher Profiles ─────────────────────────────────────────────────────────
export const teacherProfiles = appSchema.table("teacher_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  teacherCode: varchar("teacherCode", { length: 20 }),
  prefix: varchar("prefix", { length: 10 }),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  // ระดับที่สอน: primary=ประถม, secondary=มัธยม, both=ทั้งสอง
  teachingLevel: teachingLevelEnum("teachingLevel")
    .default("secondary")
    .notNull(),
  isHomeroom: boolean("isHomeroom").default(false).notNull(), // ครูประจำชั้น
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type InsertTeacherProfile = typeof teacherProfiles.$inferInsert;

// ─── School Settings ─────────────────────────────────────────────────────────
export const schoolSettings = appSchema.table("school_settings", {
  id: serial("id").primaryKey(),
  schoolName: varchar("schoolName", { length: 200 })
    .default("โรงเรียนบ้านขัวก่าย")
    .notNull(),
  officeName: varchar("officeName", { length: 300 }).default(
    "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสกลนคร เขต 3"
  ),
  homeroomTeacherName: varchar("homeroomTeacherName", { length: 200 }),
  academicHeadName: varchar("academicHeadName", { length: 200 }),
  directorName: varchar("directorName", { length: 200 }),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type SchoolSettings = typeof schoolSettings.$inferSelect;
export type InsertSchoolSettings = typeof schoolSettings.$inferInsert;

// ─── Academic Years ────────────────────────────────────────────────────────────
export const academicYears = appSchema.table("academic_years", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(), // พ.ศ. เช่น 2567
  semester: integer("semester"), // 1 หรือ 2 (null สำหรับประถมที่วัดผลรายปี)
  level: schoolLevelEnum("level").notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  startDate: date("startDate", { mode: "date" }),
  endDate: date("endDate", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AcademicYear = typeof academicYears.$inferSelect;
export type InsertAcademicYear = typeof academicYears.$inferInsert;

// ─── Classrooms ────────────────────────────────────────────────────────────────
export const classrooms = appSchema.table("classrooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(), // เช่น "ป.1/1", "ม.3/2"
  level: schoolLevelEnum("level").notNull(),
  grade: integer("grade").notNull(), // 1-6 สำหรับประถม, 1-6 สำหรับมัธยม
  room: integer("room").notNull(), // ห้อง เช่น 1, 2, 3
  academicYearId: integer("academicYearId").notNull(),
  homeroomTeacherId: integer("homeroomTeacherId"), // ครูประจำชั้น (userId)
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Classroom = typeof classrooms.$inferSelect;
export type InsertClassroom = typeof classrooms.$inferInsert;

// ─── Classroom Homeroom Teachers ──────────────────────────────────────────────
export const classroomHomeroomTeachers = appSchema.table(
  "classroom_homeroom_teachers",
  {
    id: serial("id").primaryKey(),
    classroomId: integer("classroomId").notNull(),
    teacherUserId: integer("teacherUserId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

export type ClassroomHomeroomTeacher =
  typeof classroomHomeroomTeachers.$inferSelect;
export type InsertClassroomHomeroomTeacher =
  typeof classroomHomeroomTeachers.$inferInsert;

// ─── Students ─────────────────────────────────────────────────────────────────
export const students = appSchema.table("students", {
  id: serial("id").primaryKey(),
  studentCode: varchar("studentCode", { length: 20 }).notNull().unique(),
  prefix: varchar("prefix", { length: 10 }),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  nationalId: varchar("nationalId", { length: 13 }),
  birthDate: date("birthDate", { mode: "date" }),
  gender: genderEnum("gender"),
  classroomId: integer("classroomId").notNull(),
  studentNumber: integer("studentNumber"), // เลขที่ในห้อง
  status: studentStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const subjects = appSchema.table("subjects", {
  id: serial("id").primaryKey(),
  subjectCode: varchar("subjectCode", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  credits: numeric("credits", { precision: 3, scale: 1 }).default("1.0"),
  level: subjectLevelEnum("level").notNull(),
  gradeGroup: varchar("gradeGroup", { length: 20 }), // เช่น "ป.1-3", "ม.1-3"
  subjectGroup: varchar("subjectGroup", { length: 100 }), // กลุ่มสาระ
  description: text("description"),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = typeof subjects.$inferInsert;

// ─── Teaching Assignments (วิชาที่ครูสอน) ─────────────────────────────────────
export const teachingAssignments = appSchema.table("teaching_assignments", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacherId").notNull(), // users.id
  subjectId: integer("subjectId").notNull(),
  classroomId: integer("classroomId").notNull(),
  academicYearId: integer("academicYearId").notNull(),
  hoursPerWeek: integer("hoursPerWeek").default(1),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TeachingAssignment = typeof teachingAssignments.$inferSelect;
export type InsertTeachingAssignment = typeof teachingAssignments.$inferInsert;

// ─── Teaching Schedule Slots (ตารางสอนรายสัปดาห์) ───────────────────────────
export const teachingScheduleSlots = appSchema.table("teaching_schedule_slots", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull(), // teachingAssignments.id
  dayOfWeek: integer("dayOfWeek").notNull(), // 0=อาทิตย์ ... 6=เสาร์
  startTime: varchar("startTime", { length: 5 }).notNull(), // HH:mm
  endTime: varchar("endTime", { length: 5 }).notNull(), // HH:mm
  label: varchar("label", { length: 120 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TeachingScheduleSlot = typeof teachingScheduleSlots.$inferSelect;
export type InsertTeachingScheduleSlot = typeof teachingScheduleSlots.$inferInsert;

// ─── Attendance ────────────────────────────────────────────────────────────────
export const attendance = appSchema.table("attendance", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull(), // teachingAssignments.id
  studentId: integer("studentId").notNull(),
  date: date("date", { mode: "date" }).notNull(),
  status: attendanceStatusEnum("status").notNull(),
  note: text("note"),
  recordedBy: integer("recordedBy").notNull(), // users.id
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

// ─── Score Categories ──────────────────────────────────────────────────────────
export const scoreCategories = appSchema.table("score_categories", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull(), // teachingAssignments.id
  name: varchar("name", { length: 100 }).notNull(), // เช่น "คะแนนระหว่างเรียน", "สอบกลางภาค"
  maxScore: numeric("maxScore", { precision: 6, scale: 2 }).notNull(),
  weight: numeric("weight", { precision: 5, scale: 2 }).default("100.00"), // น้ำหนักคะแนน %
  order: integer("order").default(0),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ScoreCategory = typeof scoreCategories.$inferSelect;
export type InsertScoreCategory = typeof scoreCategories.$inferInsert;

// ─── Scores ────────────────────────────────────────────────────────────────────
export const scores = appSchema.table("scores", {
  id: serial("id").primaryKey(),
  categoryId: integer("categoryId").notNull(), // scoreCategories.id
  studentId: integer("studentId").notNull(),
  score: numeric("score", { precision: 6, scale: 2 }),
  note: text("note"),
  recordedBy: integer("recordedBy").notNull(), // users.id
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;

// ─── Grade Results (ผลการเรียน) ────────────────────────────────────────────────
export const gradeResults = appSchema.table("grade_results", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignmentId").notNull(),
  studentId: integer("studentId").notNull(),
  totalScore: numeric("totalScore", { precision: 6, scale: 2 }),
  grade: varchar("grade", { length: 5 }), // 4, 3.5, 3, 2.5, 2, 1.5, 1, 0, ผ, มผ, มส, ร
  result: gradeResultEnum("result"),
  attendanceHours: integer("attendanceHours").default(0),
  totalHours: integer("totalHours").default(0),
  isFinalized: boolean("isFinalized").default(false).notNull(),
  finalizedAt: timestamp("finalizedAt", { mode: "date", withTimezone: true }),
  finalizedBy: integer("finalizedBy"),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GradeResult = typeof gradeResults.$inferSelect;
export type InsertGradeResult = typeof gradeResults.$inferInsert;

// ─── Por6 Assessments ─────────────────────────────────────────────────────────
export const studentPor6Assessments = appSchema.table(
  "student_por6_assessments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("studentId").notNull(),
    academicYearId: integer("academicYearId").notNull(),
    competencies: jsonb("competencies"),
    readingThinkingWriting: varchar("readingThinkingWriting", {
      length: 50,
    }).default("ดีเยี่ยม"),
    attributes: jsonb("attributes"),
    activities: jsonb("activities"),
    activityLabels: jsonb("activityLabels"),
    updatedBy: integer("updatedBy"),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

export type StudentPor6Assessment =
  typeof studentPor6Assessments.$inferSelect;
export type InsertStudentPor6Assessment =
  typeof studentPor6Assessments.$inferInsert;

// ─── Exported Documents (เอกสาร ปพ.1 และ ปพ.6) ────────────────────────────────
export const exportedDocuments = appSchema.table("exported_documents", {
  id: serial("id").primaryKey(),
  documentType: documentTypeEnum("documentType").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  classroomId: integer("classroomId"),
  studentId: integer("studentId"), // สำหรับ ปพ.6 (รายบุคคล)
  academicYearId: integer("academicYearId").notNull(),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileSize: integer("fileSize"),
  exportedBy: integer("exportedBy").notNull(), // users.id
  metadata: jsonb("metadata"), // ข้อมูลเพิ่มเติม
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ExportedDocument = typeof exportedDocuments.$inferSelect;
export type InsertExportedDocument = typeof exportedDocuments.$inferInsert;

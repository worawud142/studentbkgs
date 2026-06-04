import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createHash, randomUUID } from "crypto";
import { Pool } from "pg";
import {
  InsertUser,
  academicYears,
  attendance,
  classroomHomeroomTeachers,
  classrooms,
  exportedDocuments,
  gradeResults,
  qrScanDevices,
  qrScanLogs,
  qrScanSessions,
  scoreCategories,
  schoolSettings,
  scores,
  studentPor6Assessments,
  students,
  subjects,
  teacherProfiles,
  teachingAssignments,
  teachingScheduleSlots,
  users,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./_core/password";

let _pool: Pool | null = null;
type Database = ReturnType<typeof drizzle>;
let _db: Database | null = null;

const DEFAULT_POR6_COMPETENCIES = {
  communication: "ดีเยี่ยม",
  thinking: "ดีเยี่ยม",
  problemSolving: "ดีเยี่ยม",
  lifeSkills: "ดีเยี่ยม",
  technology: "ดีเยี่ยม",
};

const DEFAULT_POR6_ATTRIBUTES = {
  nationReligionKing: "ดีเยี่ยม",
  honesty: "ดีเยี่ยม",
  discipline: "ดีเยี่ยม",
  eagerness: "ดีเยี่ยม",
  sufficiency: "ดีเยี่ยม",
  dedication: "ดีเยี่ยม",
  thaiIdentity: "ดีเยี่ยม",
  publicMind: "ดีเยี่ยม",
};

const DEFAULT_POR6_ACTIVITIES = {
  guidance: "ผ่าน",
  scout: "ผ่าน",
  environment: "ผ่าน",
  volunteer: "ผ่าน",
};

const DEFAULT_POR6_ACTIVITY_LABELS = {
  guidance: "แนะแนว",
  scout: "ลูกเสือ/เนตรนารี",
  environment: "สิ่งแวดล้อม",
  volunteer: "จิตอาสา",
};

function getPoolOptions() {
  const connectionUrl = new URL(ENV.databaseUrl);
  const isSupabase = /supabase\.co|pooler\.supabase\.com/i.test(
    ENV.databaseUrl
  );

  return {
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || "5432"),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, "") || "postgres",
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    max: process.env.VERCEL ? 1 : undefined,
  } satisfies ConstructorParameters<typeof Pool>[0];
}

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _pool = new Pool(getPoolOptions());
      _db = drizzle(_pool, { schema });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function getNextNumericId(table: any, idColumn: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .select({ nextId: sql<number>`coalesce(max(${idColumn}), 0) + 1` })
    .from(table);
  return Number(result?.nextId ?? 1);
}

function quotedSchemaName() {
  return `"${ENV.dbSchema.replace(/"/g, '""')}"`;
}

async function ensurePor6Tables() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const schemaName = quotedSchemaName();
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."school_settings" (
      "id" integer PRIMARY KEY,
      "schoolName" varchar(200) NOT NULL DEFAULT 'โรงเรียนบ้านขัวก่าย',
      "officeName" varchar(300),
      "homeroomTeacherName" varchar(200),
      "academicHeadName" varchar(200),
      "directorName" varchar(200),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."student_por6_assessments" (
      "id" integer PRIMARY KEY,
      "studentId" integer NOT NULL,
      "academicYearId" integer NOT NULL,
      "competencies" jsonb,
      "readingThinkingWriting" varchar(50) DEFAULT 'ดีเยี่ยม',
      "attributes" jsonb,
      "activities" jsonb,
      "activityLabels" jsonb,
      "updatedBy" integer,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("studentId", "academicYearId")
    )
  `));
  await db.execute(sql.raw(`
    ALTER TABLE ${schemaName}."student_por6_assessments"
    ADD COLUMN IF NOT EXISTS "activityLabels" jsonb
  `));
}

async function ensureClassroomHomeroomTable() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const schemaName = quotedSchemaName();
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."classroom_homeroom_teachers" (
      "id" integer PRIMARY KEY,
      "classroomId" integer NOT NULL,
      "teacherUserId" integer NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("classroomId", "teacherUserId")
    )
  `));
}

async function ensureQrScanTables() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const schemaName = quotedSchemaName();
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."qr_scan_devices" (
      "id" serial PRIMARY KEY,
      "name" varchar(120) NOT NULL,
      "assignmentId" integer NOT NULL,
      "deviceTokenHash" varchar(128) NOT NULL UNIQUE,
      "isActive" boolean NOT NULL DEFAULT true,
      "lastSeenAt" timestamptz,
      "lastScanAt" timestamptz,
      "createdBy" integer NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."qr_scan_logs" (
      "id" serial PRIMARY KEY,
      "deviceId" integer NOT NULL,
      "assignmentId" integer NOT NULL,
      "studentId" integer,
      "rawValue" text NOT NULL,
      "status" varchar(32) NOT NULL,
      "message" text,
      "scannedAt" timestamptz NOT NULL DEFAULT now(),
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."qr_scan_sessions" (
      "id" serial PRIMARY KEY,
      "deviceId" integer NOT NULL,
      "teacherUserId" integer NOT NULL,
      "assignmentId" integer NOT NULL,
      "isActive" boolean NOT NULL DEFAULT true,
      "openedAt" timestamptz NOT NULL DEFAULT now(),
      "lastScanAt" timestamptz,
      "closedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `));
}

async function ensureTeachingScheduleTables() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const schemaName = quotedSchemaName();
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${schemaName}."teaching_schedule_slots" (
      "id" serial PRIMARY KEY,
      "assignmentId" integer NOT NULL,
      "dayOfWeek" integer NOT NULL,
      "startTime" varchar(5) NOT NULL,
      "endTime" varchar(5) NOT NULL,
      "label" varchar(120),
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `));
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    if (ENV.isProduction || !user.openId.startsWith("dev-")) {
      console.warn("[Database] Cannot upsert user: database not available");
    }
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    const isOwner =
      ENV.ownerOpenId &&
      (user.openId === ENV.ownerOpenId || user.email === ENV.ownerOpenId);
    if (isOwner) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByTeacherCode(teacherCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedCode = teacherCode.trim().toLowerCase();
  if (!normalizedCode) return undefined;
  const result = await db
    .select({ user: users })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(sql`lower(${teacherProfiles.teacherCode}) = ${normalizedCode}`)
    .limit(1);
  return result.length > 0 ? result[0].user : undefined;
}

export async function resolveLoginUser(identifier: string) {
  const normalized = identifier.trim();
  if (!normalized)
    return {
      email: null as string | null,
      user: undefined as typeof users.$inferSelect | undefined,
    };

  const teacherCodeUser = await getUserByTeacherCode(normalized);
  if (teacherCodeUser) {
    return {
      email:
        teacherCodeUser.email ?? `${normalized.toLowerCase()}@school.local`,
      user: teacherCodeUser,
    };
  }

  const emailUser = normalized.includes("@")
    ? await getUserByEmail(normalized)
    : undefined;
  if (emailUser) {
    return {
      email: emailUser.email ?? normalized,
      user: emailUser,
    };
  }

  const openIdUser = await getUserByOpenId(normalized);
  if (openIdUser) {
    return {
      email: openIdUser.email ?? `${normalized.toLowerCase()}@school.local`,
      user: openIdUser,
    };
  }

  return {
    email: normalized.includes("@")
      ? normalized
      : `${normalized.toLowerCase()}@school.local`,
    user: undefined,
  };
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map(sanitizeUserRow);
}

export async function updateUserRole(
  userId: number,
  role: "teacher" | "admin" | "reviewer"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateTeacherPassword(userId: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing) {
    throw new Error("ไม่พบผู้ใช้งาน");
  }
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(password),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// ─── Teacher Profiles ─────────────────────────────────────────────────────────
export async function getTeacherProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, userId))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.warn("[Database] Failed to read teacher profile:", error);
    return null;
  }
}

export async function upsertTeacherProfile(
  data: typeof teacherProfiles.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getTeacherProfile(data.userId);
  if (existing) {
    await db
      .update(teacherProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teacherProfiles.userId, data.userId));
    return existing.id;
  } else {
    const [result] = await db
      .insert(teacherProfiles)
      .values({
        ...data,
        id:
          data.id ??
          (await getNextNumericId(teacherProfiles, teacherProfiles.id)),
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
      })
      .returning({ id: teacherProfiles.id });
    return result.id;
  }
}

export async function getAllTeacherProfiles() {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ profile: teacherProfiles, user: users })
      .from(teacherProfiles)
      .leftJoin(users, eq(teacherProfiles.userId, users.id))
      .orderBy(teacherProfiles.firstName);
    return rows.map(row => ({
      ...row,
      user: sanitizeUserRow(row.user),
    }));
  } catch (error) {
    console.warn("[Database] Failed to list teacher profiles:", error);
    return [];
  }
}

export async function updateTeacherAccount(
  userId: number,
  data: {
    teacherCode: string;
    email?: string;
    prefix?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    teachingLevel: "primary" | "secondary" | "both";
    isHomeroom?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const normalizedTeacherCode = data.teacherCode.trim();
  if (!normalizedTeacherCode) {
    throw new Error("กรุณากรอกรหัสครู");
  }

  const [profile] = await db
    .select()
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);
  if (!profile) {
    throw new Error("ไม่พบข้อมูลครู");
  }

  const duplicateUser = await getUserByTeacherCode(normalizedTeacherCode);
  if (duplicateUser && duplicateUser.id !== userId) {
    throw new Error("รหัสครูนี้ถูกใช้แล้ว");
  }

  const displayName =
    `${data.prefix || ""}${data.firstName} ${data.lastName}`.trim();
  await db.transaction(async tx => {
    await tx
      .update(users)
      .set({
        name: displayName,
        email:
          data.email || `${normalizedTeacherCode.toLowerCase()}@school.local`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx
      .update(teacherProfiles)
      .set({
        teacherCode: normalizedTeacherCode,
        prefix: data.prefix || null,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        teachingLevel: data.teachingLevel,
        isHomeroom: data.isHomeroom ?? false,
        updatedAt: new Date(),
      })
      .where(eq(teacherProfiles.userId, userId));
  });
}

export async function createTeacherAccount(data: {
  teacherCode: string;
  password: string;
  email?: string;
  prefix?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  teachingLevel: "primary" | "secondary" | "both";
  isHomeroom?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const normalizedTeacherCode = data.teacherCode.trim();
  if (!normalizedTeacherCode) {
    throw new Error("กรุณากรอกรหัสครู");
  }

  const existingUser = await getUserByTeacherCode(normalizedTeacherCode);
  if (existingUser) {
    throw new Error("รหัสครูนี้ถูกใช้แล้ว");
  }

  const userId = await getNextNumericId(users, users.id);
  await db.insert(users).values({
    id: userId,
    openId: `teacher-${normalizedTeacherCode}-${randomUUID().slice(0, 8)}`,
    name: `${data.prefix || ""}${data.firstName} ${data.lastName}`.trim(),
    email: data.email ?? `${normalizedTeacherCode.toLowerCase()}@school.local`,
    loginMethod: "manual",
    passwordHash: hashPassword(data.password),
    role: "teacher",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  });

  const teacherProfileId = await getNextNumericId(
    teacherProfiles,
    teacherProfiles.id
  );
  await db.insert(teacherProfiles).values({
    id: teacherProfileId,
    userId,
    teacherCode: normalizedTeacherCode,
    prefix: data.prefix ?? null,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone ?? null,
    teachingLevel: data.teachingLevel,
    isHomeroom: data.isHomeroom ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { userId, teacherProfileId };
}

export async function deleteTeacherAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [profile] = await db
    .select()
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, userId))
    .limit(1);
  if (!profile) {
    throw new Error("ไม่พบข้อมูลครู");
  }

  const [assignmentUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teachingAssignments)
    .where(eq(teachingAssignments.teacherId, userId));

  if (Number(assignmentUsage?.count ?? 0) > 0) {
    throw new Error("ครูคนนี้ยังมีการมอบหมายวิชาอยู่ กรุณาลบการมอบหมายก่อน");
  }

  const [homeroomUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classrooms)
    .where(eq(classrooms.homeroomTeacherId, userId));

  if (Number(homeroomUsage?.count ?? 0) > 0) {
    throw new Error(
      "ครูคนนี้ยังเป็นครูประจำชั้นอยู่ กรุณาเปลี่ยนครูประจำชั้นก่อน"
    );
  }

  const [attendanceUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendance)
    .where(eq(attendance.recordedBy, userId));
  if (Number(attendanceUsage?.count ?? 0) > 0) {
    throw new Error("ครูคนนี้มีประวัติการเช็คชื่ออยู่ จึงยังลบไม่ได้");
  }

  const [scoreUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scores)
    .where(eq(scores.recordedBy, userId));
  if (Number(scoreUsage?.count ?? 0) > 0) {
    throw new Error("ครูคนนี้มีประวัติการบันทึกคะแนนอยู่ จึงยังลบไม่ได้");
  }

  const [finalizeUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gradeResults)
    .where(eq(gradeResults.finalizedBy, userId));
  if (Number(finalizeUsage?.count ?? 0) > 0) {
    throw new Error("ครูคนนี้มีประวัติการยืนยันผลการเรียนอยู่ จึงยังลบไม่ได้");
  }

  const [documentUsage] = await db
    .select({ count: sql<number>`count(*)` })
    .from(exportedDocuments)
    .where(eq(exportedDocuments.exportedBy, userId));
  if (Number(documentUsage?.count ?? 0) > 0) {
    throw new Error("ครูคนนี้มีประวัติการส่งออกเอกสารอยู่ จึงยังลบไม่ได้");
  }

  await db.delete(teacherProfiles).where(eq(teacherProfiles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Academic Years ────────────────────────────────────────────────────────────
export async function getAcademicYears(level?: "primary" | "secondary") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(academicYears);
  if (level)
    return query
      .where(eq(academicYears.level, level))
      .orderBy(desc(academicYears.year));
  return query.orderBy(desc(academicYears.year));
}

export async function getAcademicYearById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveAcademicYear(level: "primary" | "secondary") {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(academicYears)
    .where(
      and(eq(academicYears.level, level), eq(academicYears.isActive, true))
    )
    .limit(1);
  return result[0] ?? null;
}

export async function createAcademicYear(
  data: typeof academicYears.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(academicYears)
    .values({
      ...data,
      id: data.id ?? (await getNextNumericId(academicYears, academicYears.id)),
      createdAt: data.createdAt ?? new Date(),
    })
    .returning({ id: academicYears.id });
  return result.id;
}

export async function updateAcademicYear(
  id: number,
  data: Partial<typeof academicYears.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicYears).set(data).where(eq(academicYears.id, id));
}

export async function deleteAcademicYear(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(academicYears).where(eq(academicYears.id, id));
}

export async function setActiveAcademicYear(
  id: number,
  level: "primary" | "secondary"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(academicYears)
    .set({ isActive: false })
    .where(eq(academicYears.level, level));
  await db
    .update(academicYears)
    .set({ isActive: true })
    .where(eq(academicYears.id, id));
}

// ─── Classrooms ────────────────────────────────────────────────────────────────
export async function getClassrooms(
  academicYearId?: number,
  level?: "primary" | "secondary"
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (academicYearId)
    conditions.push(eq(classrooms.academicYearId, academicYearId));
  if (level) conditions.push(eq(classrooms.level, level));
  const query = db.select().from(classrooms);
  const rows =
    conditions.length > 0
      ? await query
      .where(and(...conditions))
          .orderBy(classrooms.grade, classrooms.room)
      : await query.orderBy(classrooms.grade, classrooms.room);
  return Promise.all(rows.map(classroom => attachHomeroomTeachers(classroom)));
}

export async function getClassroomById(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(classrooms)
    .where(eq(classrooms.id, id))
    .limit(1);
  return result[0] ? attachHomeroomTeachers(result[0]) : null;
}

export async function getClassroomHomeroomTeachers(classroomId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureClassroomHomeroomTable();
  return db
    .select({
      link: classroomHomeroomTeachers,
      profile: teacherProfiles,
      user: users,
    })
    .from(classroomHomeroomTeachers)
    .leftJoin(
      teacherProfiles,
      eq(classroomHomeroomTeachers.teacherUserId, teacherProfiles.userId)
    )
    .leftJoin(users, eq(classroomHomeroomTeachers.teacherUserId, users.id))
    .where(eq(classroomHomeroomTeachers.classroomId, classroomId))
    .orderBy(teacherProfiles.firstName, teacherProfiles.lastName);
}

async function attachHomeroomTeachers(classroom: any) {
  const homeroomTeachers = await getClassroomHomeroomTeachers(classroom.id);
  const ids = new Set(homeroomTeachers.map(row => row.link.teacherUserId));
  if (classroom.homeroomTeacherId && !ids.has(classroom.homeroomTeacherId)) {
    ids.add(classroom.homeroomTeacherId);
  }
  return {
    ...classroom,
    homeroomTeacherIds: Array.from(ids),
    homeroomTeachers,
  };
}

export async function setClassroomHomeroomTeachers(
  classroomId: number,
  teacherUserIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureClassroomHomeroomTable();
  const uniqueIds = Array.from(new Set(teacherUserIds.filter(Boolean)));
  await db
    .delete(classroomHomeroomTeachers)
    .where(eq(classroomHomeroomTeachers.classroomId, classroomId));
  for (const teacherUserId of uniqueIds) {
    await db.insert(classroomHomeroomTeachers).values({
      id: await getNextNumericId(
        classroomHomeroomTeachers,
        classroomHomeroomTeachers.id
      ),
      classroomId,
      teacherUserId,
      createdAt: new Date(),
    } as any);
  }
  await db
    .update(classrooms)
    .set({
      homeroomTeacherId: uniqueIds[0] ?? null,
      updatedAt: new Date(),
    } as any)
    .where(eq(classrooms.id, classroomId));
}

export async function setTeacherHomeroomClassrooms(
  teacherUserId: number,
  classroomIds: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureClassroomHomeroomTable();

  const selectedIds = new Set(classroomIds.filter(Boolean));
  const currentLinks = await db
    .select()
    .from(classroomHomeroomTeachers)
    .where(eq(classroomHomeroomTeachers.teacherUserId, teacherUserId));
  const affectedIds = new Set([
    ...Array.from(selectedIds),
    ...currentLinks.map(link => link.classroomId),
  ]);

  for (const classroomId of Array.from(affectedIds)) {
    const currentTeachers = await getClassroomHomeroomTeachers(classroomId);
    const teacherIds = currentTeachers
      .map(row => row.link.teacherUserId)
      .filter(id => id !== teacherUserId);
    if (selectedIds.has(classroomId)) {
      teacherIds.push(teacherUserId);
    }
    await setClassroomHomeroomTeachers(classroomId, teacherIds);
  }
}

export async function createClassroom(data: typeof classrooms.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(classrooms)
    .values({
      ...data,
      id: data.id ?? (await getNextNumericId(classrooms, classrooms.id)),
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning({ id: classrooms.id });
  return result.id;
}

export async function updateClassroom(
  id: number,
  data: Partial<typeof classrooms.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(classrooms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(classrooms.id, id));
}

export async function deleteClassroom(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(classrooms).where(eq(classrooms.id, id));
}

// ─── Subjects ─────────────────────────────────────────────────────────────────
export async function getSubjects(level?: "primary" | "secondary" | "both") {
  const db = await getDb();
  if (!db) return [];
  if (level) {
    return db
      .select()
      .from(subjects)
      .where(sql`${subjects.level} = ${level} OR ${subjects.level} = 'both'`)
      .orderBy(subjects.subjectGroup, subjects.name);
  }
  return db
    .select()
    .from(subjects)
    .orderBy(subjects.subjectGroup, subjects.name);
}

export async function getSubjectById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createSubject(data: typeof subjects.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(subjects)
    .values({
      ...data,
      id: data.id ?? (await getNextNumericId(subjects, subjects.id)),
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning({ id: subjects.id });
  return result.id;
}

export async function updateSubject(
  id: number,
  data: Partial<typeof subjects.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(subjects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subjects.id, id));
}

export async function deleteSubject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(subjects).where(eq(subjects.id, id));
}

// ─── Students ─────────────────────────────────────────────────────────────────
export async function getStudentsByClassroom(classroomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(students)
    .where(
      and(eq(students.classroomId, classroomId), eq(students.status, "active"))
    )
    .orderBy(students.studentNumber, students.firstName);
}

export async function getStudentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createStudent(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(students)
    .values({
      ...data,
      id: data.id ?? (await getNextNumericId(students, students.id)),
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    })
    .returning({ id: students.id });
  return result.id;
}

export async function upsertStudentByCode(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(students)
    .values({
      ...data,
      status: data.status ?? "active",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: students.studentCode,
      set: {
        prefix: data.prefix,
        firstName: data.firstName,
        lastName: data.lastName,
        nationalId: data.nationalId,
        birthDate: data.birthDate,
        gender: data.gender,
        classroomId: data.classroomId,
        studentNumber: data.studentNumber,
        status: data.status ?? "active",
        updatedAt: new Date(),
      },
    })
    .returning({ id: students.id });
  return result.id;
}

export async function updateStudent(
  id: number,
  data: Partial<typeof students.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.id, id));
}

export async function deleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(students)
    .set({ status: "dropped", updatedAt: new Date() })
    .where(eq(students.id, id));
}

// ─── Teaching Assignments ─────────────────────────────────────────────────────
export async function getTeacherAssignments(
  teacherId: number,
  academicYearId?: number
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(teachingAssignments.teacherId, teacherId)];
  if (academicYearId)
    conditions.push(eq(teachingAssignments.academicYearId, academicYearId));
  return db
    .select({
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
    })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(and(...conditions))
    .orderBy(classrooms.level, classrooms.grade, classrooms.room);
}

export async function getTeacherLatestUsedAssignment(teacherId: number) {
  const db = await getDb();
  if (!db) return null;
  const recentAttendance = await db
    .select({ assignmentId: attendance.assignmentId })
    .from(attendance)
    .where(eq(attendance.recordedBy, teacherId))
    .orderBy(desc(attendance.updatedAt), desc(attendance.id))
    .limit(1);
  if (recentAttendance.length > 0) {
    return getAssignmentById(recentAttendance[0].assignmentId);
  }

  const assignments = await getTeacherAssignments(teacherId);
  return assignments[0] ?? null;
}

export async function getTeacherPreferredAssignment(teacherId: number) {
  const assignment = await getTeacherLatestUsedAssignment(teacherId);
  return assignment?.assignment?.id ? assignment : null;
}

export async function getAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    )
    .where(eq(teachingAssignments.id, id))
    .limit(1);
  const row = result[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    teacher: sanitizeUserRow(row.teacher),
  };
}

export async function createTeachingAssignment(
  data: typeof teachingAssignments.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(teachingAssignments)
    .values({
      ...data,
      id:
        data.id ??
        (await getNextNumericId(teachingAssignments, teachingAssignments.id)),
      createdAt: data.createdAt ?? new Date(),
    })
    .returning({ id: teachingAssignments.id });
  return result.id;
}

export async function updateTeachingAssignment(
  id: number,
  data: Partial<typeof teachingAssignments.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(teachingAssignments)
    .set(data)
    .where(eq(teachingAssignments.id, id));
}

export async function deleteTeachingAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(teachingAssignments).where(eq(teachingAssignments.id, id));
}

export async function getAllTeachingAssignments() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      assignment: teachingAssignments,
      teacher: users,
      teacherProfile: teacherProfiles,
      subject: subjects,
      classroom: classrooms,
      academicYear: academicYears,
    })
    .from(teachingAssignments)
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(
      academicYears,
      eq(teachingAssignments.academicYearId, academicYears.id)
    )
    .orderBy(
      desc(academicYears.year),
      classrooms.grade,
      classrooms.room,
      subjects.name
    );
  return rows.map(row => ({
    ...row,
    teacher: sanitizeUserRow(row.teacher),
  }));
}

export async function getTeachingScheduleSlots(options?: {
  assignmentId?: number;
  classroomId?: number;
  activeOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  await ensureTeachingScheduleTables();
  const conditions = [] as any[];
  if (options?.assignmentId) {
    conditions.push(eq(teachingScheduleSlots.assignmentId, options.assignmentId));
  }
  if (options?.classroomId) {
    conditions.push(eq(teachingAssignments.classroomId, options.classroomId));
  }
  if (options?.activeOnly !== false) {
    conditions.push(eq(teachingScheduleSlots.isActive, true));
  }
  const query = db
    .select({
      slot: teachingScheduleSlots,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(teachingScheduleSlots)
    .leftJoin(
      teachingAssignments,
      eq(teachingScheduleSlots.assignmentId, teachingAssignments.id)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    );

  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(
          classrooms.level,
          classrooms.grade,
          classrooms.room,
          teachingScheduleSlots.dayOfWeek,
          teachingScheduleSlots.startTime
        )
      : await query.orderBy(
          classrooms.level,
          classrooms.grade,
          classrooms.room,
          teachingScheduleSlots.dayOfWeek,
          teachingScheduleSlots.startTime
        );

  return rows.map(row => ({
    ...row,
    teacher: sanitizeUserRow(row.teacher),
  }));
}

export async function getTeachingScheduleSlotById(id: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureTeachingScheduleTables();
  const result = await db
    .select({
      slot: teachingScheduleSlots,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(teachingScheduleSlots)
    .leftJoin(
      teachingAssignments,
      eq(teachingScheduleSlots.assignmentId, teachingAssignments.id)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    )
    .where(eq(teachingScheduleSlots.id, id))
    .limit(1);
  if (result.length === 0) return null;
  const row = result[0];
  return {
    ...row,
    teacher: sanitizeUserRow(row.teacher),
  };
}

export async function createTeachingScheduleSlot(
  data: typeof teachingScheduleSlots.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureTeachingScheduleTables();
  const id =
    data.id ?? (await getNextNumericId(teachingScheduleSlots, teachingScheduleSlots.id));
  await db.insert(teachingScheduleSlots).values({
    ...data,
    id,
    label: data.label ?? null,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  });
  return id;
}

export async function updateTeachingScheduleSlot(
  id: number,
  data: Partial<typeof teachingScheduleSlots.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureTeachingScheduleTables();
  await db
    .update(teachingScheduleSlots)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teachingScheduleSlots.id, id));
}

export async function deleteTeachingScheduleSlot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureTeachingScheduleTables();
  await db
    .delete(teachingScheduleSlots)
    .where(eq(teachingScheduleSlots.id, id));
}

export async function getCurrentTeachingScheduleSlotForClassroom(
  classroomId: number,
  at = new Date()
) {
  const db = await getDb();
  if (!db) return null;
  await ensureTeachingScheduleTables();
  const nowParts = currentBangkokDateTimeParts(at);
  const rows = await db
    .select({
      slot: teachingScheduleSlots,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(teachingScheduleSlots)
    .leftJoin(
      teachingAssignments,
      eq(teachingScheduleSlots.assignmentId, teachingAssignments.id)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    )
    .where(
      and(
        eq(teachingAssignments.classroomId, classroomId),
        eq(teachingScheduleSlots.isActive, true)
      )
    )
    .orderBy(teachingScheduleSlots.dayOfWeek, teachingScheduleSlots.startTime);

  const matched = rows.find(row => slotMatchesNow(row.slot, nowParts));
  if (!matched) return null;
  return {
    ...matched,
    teacher: sanitizeUserRow(matched.teacher),
  };
}

export async function getCurrentTeachingScheduleSlot(at = new Date()) {
  const db = await getDb();
  if (!db) return null;
  await ensureTeachingScheduleTables();
  const nowParts = currentBangkokDateTimeParts(at);
  const rows = await db
    .select({
      slot: teachingScheduleSlots,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(teachingScheduleSlots)
    .leftJoin(
      teachingAssignments,
      eq(teachingScheduleSlots.assignmentId, teachingAssignments.id)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(users, eq(teachingAssignments.teacherId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(teachingAssignments.teacherId, teacherProfiles.userId)
    )
    .where(eq(teachingScheduleSlots.isActive, true))
    .orderBy(
      teachingScheduleSlots.dayOfWeek,
      teachingScheduleSlots.startTime,
      teachingScheduleSlots.id
    );

  const matched = rows.find(row => slotMatchesNow(row.slot, nowParts));
  if (!matched) return null;
  return {
    ...matched,
    teacher: sanitizeUserRow(matched.teacher),
  };
}

export async function getCurrentTeachingScheduleSlotForAssignment(
  assignmentId: number,
  at = new Date()
) {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment?.assignment?.classroomId) return null;
  return getCurrentTeachingScheduleSlotForClassroom(
    assignment.assignment.classroomId,
    at
  );
}

export async function getCurrentTeachingScheduleAssignmentForClassroom(
  classroomId: number,
  at = new Date()
) {
  const slot = await getCurrentTeachingScheduleSlotForClassroom(classroomId, at);
  if (!slot?.slot?.assignmentId) return null;
  const assignment = await getAssignmentById(slot.slot.assignmentId);
  if (!assignment) return null;
  return {
    slot: slot.slot,
    assignment,
    teacher: assignment.teacher,
    teacherProfile: assignment.teacherProfile,
    subject: assignment.subject,
    classroom: assignment.classroom,
  };
}

function generateQrBoxToken() {
  return randomUUID().replace(/-/g, "");
}

function hashQrBoxToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function currentBangkokDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function currentBangkokDateTimeParts(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const weekdayText = parts.find(part => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dayOfWeek: weekdayMap[weekdayText] ?? 1,
    minutesOfDay: hour * 60 + minute,
    displayTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function timeStringToMinutes(value: string) {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutesAsTime(minutes: number) {
  const normalized = Math.max(0, Math.min(Math.floor(minutes), 23 * 60 + 59));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function slotMatchesNow(slot: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}, nowParts = currentBangkokDateTimeParts()) {
  if (slot.isActive === false) return false;
  if (slot.dayOfWeek !== nowParts.dayOfWeek) return false;
  const start = timeStringToMinutes(slot.startTime);
  const end = timeStringToMinutes(slot.endTime);
  if (start === null || end === null) return false;
  if (end <= start) return false;
  return nowParts.minutesOfDay >= start && nowParts.minutesOfDay < end;
}

function sanitizeUserRow(user: typeof users.$inferSelect | null | undefined) {
  if (!user) return user;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getQrScanDevices() {
  const db = await getDb();
  if (!db) return [];
  await ensureQrScanTables();
  const rows = await db
    .select({
      device: qrScanDevices,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(qrScanDevices)
    .leftJoin(users, eq(qrScanDevices.createdBy, users.id))
    .leftJoin(
      teacherProfiles,
      eq(qrScanDevices.createdBy, teacherProfiles.userId)
    )
    .orderBy(desc(qrScanDevices.updatedAt), desc(qrScanDevices.id));

  return Promise.all(
    rows.map(async row => {
      const assignment = await getAssignmentById(row.device.assignmentId);
      const activeTimetableAssignment = assignment?.assignment?.classroomId
        ? await getCurrentTeachingScheduleAssignmentForClassroom(
            assignment.assignment.classroomId
          )
        : null;
      return {
        ...row.device,
        assignment,
        activeTimetableAssignment,
        createdByUser: sanitizeUserRow(row.teacher),
        createdByProfile: row.teacherProfile,
      };
    })
  );
}

export async function getQrScanDeviceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureQrScanTables();
  const result = await db
    .select({
      device: qrScanDevices,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(qrScanDevices)
    .leftJoin(users, eq(qrScanDevices.createdBy, users.id))
    .leftJoin(
      teacherProfiles,
      eq(qrScanDevices.createdBy, teacherProfiles.userId)
    )
    .where(eq(qrScanDevices.id, id))
    .limit(1);
  if (result.length === 0) return null;
  const row = result[0];
  const assignment = await getAssignmentById(row.device.assignmentId);
  return {
    ...row.device,
    assignment,
    activeTimetableAssignment: row.device.assignmentId
      ? await getCurrentTeachingScheduleAssignmentForClassroom(
          assignment?.assignment?.classroomId ?? 0
        )
      : null,
    createdByUser: sanitizeUserRow(row.teacher),
    createdByProfile: row.teacherProfile,
    activeSession: await getActiveQrScanSessionByDeviceId(row.device.id),
  };
}

export async function getActiveQrScanSessionByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureQrScanTables();
  const result = await db
    .select({
      session: qrScanSessions,
      teacher: users,
      teacherProfile: teacherProfiles,
    })
    .from(qrScanSessions)
    .leftJoin(users, eq(qrScanSessions.teacherUserId, users.id))
    .leftJoin(
      teacherProfiles,
      eq(qrScanSessions.teacherUserId, teacherProfiles.userId)
    )
    .where(and(eq(qrScanSessions.deviceId, deviceId), eq(qrScanSessions.isActive, true)))
    .orderBy(desc(qrScanSessions.updatedAt), desc(qrScanSessions.id))
    .limit(1);
  if (result.length === 0) return null;
  const row = result[0];
  return {
    ...row.session,
    teacher: sanitizeUserRow(row.teacher),
    teacherProfile: row.teacherProfile,
    assignment: await getAssignmentById(row.session.assignmentId),
  };
}

export async function closeActiveQrScanSession(deviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  await db
    .update(qrScanSessions)
    .set({
      isActive: false,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(qrScanSessions.deviceId, deviceId), eq(qrScanSessions.isActive, true)));
}

export async function getTeacherQrSessionPayload(teacherUserId: number) {
  const assignment = await getTeacherPreferredAssignment(teacherUserId);
  const teacherProfile = await getTeacherProfile(teacherUserId);
  if (!assignment?.assignment?.id || !teacherProfile) return null;
  return {
    teacherProfile,
    assignment,
  };
}

export async function openTeacherQrSession(data: {
  deviceId: number;
  teacherUserId: number;
  assignmentId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();

  const preferredAssignment = data.assignmentId
    ? await getAssignmentById(data.assignmentId)
    : await getTeacherPreferredAssignment(data.teacherUserId);
  const assignment = preferredAssignment;
  if (!assignment?.assignment?.id) {
    return null;
  }

  const currentSession = await getActiveQrScanSessionByDeviceId(data.deviceId);
  const now = new Date();

  if (
    currentSession &&
    currentSession.teacherUserId === data.teacherUserId &&
    currentSession.assignmentId === assignment.assignment.id
  ) {
    await db
      .update(qrScanSessions)
      .set({
        lastScanAt: now,
        updatedAt: now,
      })
      .where(eq(qrScanSessions.id, currentSession.id));
    await touchQrScanDevice(data.deviceId, {
      lastSeenAt: now,
    });
    return {
      ...currentSession,
      teacher: currentSession.teacher,
      teacherProfile: currentSession.teacherProfile,
      assignment,
      refreshed: true,
    };
  }

  if (currentSession) {
    await db
      .update(qrScanSessions)
      .set({
        isActive: false,
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(qrScanSessions.id, currentSession.id));
  }

  const id = await getNextNumericId(qrScanSessions, qrScanSessions.id);
  const [result] = await db
    .insert(qrScanSessions)
    .values({
      id,
      deviceId: data.deviceId,
      teacherUserId: data.teacherUserId,
      assignmentId: assignment.assignment.id,
      isActive: true,
      openedAt: now,
      lastScanAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: qrScanSessions.id });

  await touchQrScanDevice(data.deviceId, {
    lastSeenAt: now,
  });

  const session = await getActiveQrScanSessionByDeviceId(data.deviceId);
  return session ?? { id: result.id, assignment, teacherUserId: data.teacherUserId };
}

export async function createQrScanDevice(data: {
  name: string;
  assignmentId: number;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  const token = generateQrBoxToken();
  const id = await getNextNumericId(qrScanDevices, qrScanDevices.id);
  const [result] = await db
    .insert(qrScanDevices)
    .values({
      id,
      name: data.name,
      assignmentId: data.assignmentId,
      deviceTokenHash: hashQrBoxToken(token),
      createdBy: data.createdBy,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: qrScanDevices.id });
  return { id: result.id, token };
}

export async function updateQrScanDevice(
  id: number,
  data: Partial<{
    name: string;
    assignmentId: number;
    isActive: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  await db
    .update(qrScanDevices)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(qrScanDevices.id, id));
}

export async function rotateQrScanDeviceToken(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  const token = generateQrBoxToken();
  await db
    .update(qrScanDevices)
    .set({
      deviceTokenHash: hashQrBoxToken(token),
      updatedAt: new Date(),
    })
    .where(eq(qrScanDevices.id, id));
  return token;
}

export async function deleteQrScanDevice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  await db.delete(qrScanDevices).where(eq(qrScanDevices.id, id));
}

export async function touchQrScanDevice(
  id: number,
  data: { lastSeenAt?: Date; lastScanAt?: Date }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  await db
    .update(qrScanDevices)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(qrScanDevices.id, id));
}

export async function verifyQrScanDeviceToken(
  id: number,
  token: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await ensureQrScanTables();
  const result = await db
    .select({
      deviceTokenHash: qrScanDevices.deviceTokenHash,
    })
    .from(qrScanDevices)
    .where(and(eq(qrScanDevices.id, id), eq(qrScanDevices.isActive, true)))
    .limit(1);
  if (result.length === 0) return false;
  return result[0].deviceTokenHash === hashQrBoxToken(token);
}

export async function getQrScanLogs(options?: {
  deviceId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  await ensureQrScanTables();
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
  const conditions = [] as any[];
  if (options?.deviceId) {
    conditions.push(eq(qrScanLogs.deviceId, options.deviceId));
  }
  const query = db
    .select({
      log: qrScanLogs,
      device: qrScanDevices,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
      student: students,
      teacher: users,
    })
    .from(qrScanLogs)
    .leftJoin(qrScanDevices, eq(qrScanLogs.deviceId, qrScanDevices.id))
    .leftJoin(teachingAssignments, eq(qrScanLogs.assignmentId, teachingAssignments.id))
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(students, eq(qrScanLogs.studentId, students.id))
    .leftJoin(users, eq(qrScanDevices.createdBy, users.id));
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(qrScanLogs.scannedAt), desc(qrScanLogs.id)).limit(limit)
      : await query.orderBy(desc(qrScanLogs.scannedAt), desc(qrScanLogs.id)).limit(limit);
  return rows.map(row => ({
    ...row,
    teacher: sanitizeUserRow(row.teacher),
  }));
}

export async function recordQrScanLog(data: {
  deviceId: number;
  assignmentId: number;
  studentId?: number | null;
  rawValue: string;
  status: string;
  message?: string | null;
  scannedAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureQrScanTables();
  const scannedAt = data.scannedAt ?? new Date();
  const id = await getNextNumericId(qrScanLogs, qrScanLogs.id);
  await db.transaction(async tx => {
    await tx.insert(qrScanLogs).values({
      id,
      deviceId: data.deviceId,
      assignmentId: data.assignmentId,
      studentId: data.studentId ?? null,
      rawValue: data.rawValue,
      status: data.status,
      message: data.message ?? null,
      scannedAt,
      createdAt: scannedAt,
    });
    await tx
      .update(qrScanDevices)
      .set({
        lastSeenAt: scannedAt,
        lastScanAt: scannedAt,
        updatedAt: new Date(),
      })
      .where(eq(qrScanDevices.id, data.deviceId));
  });
}

export async function resolveBangkokTodayAttendanceDate() {
  return currentBangkokDateKey();
}

// ─── Attendance ────────────────────────────────────────────────────────────────
function attendanceDateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text.slice(0, 10);
}

function attendanceDateFilter(value: string | Date) {
  const key = attendanceDateKey(value);
  return sql`${attendance.date} = ${key}::date`;
}

export async function getAttendanceByAssignmentAndDate(
  assignmentId: number,
  date: string
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.assignmentId, assignmentId),
        attendanceDateFilter(date)
      )
    );
}

export async function getAttendanceByAssignment(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attendance)
    .where(eq(attendance.assignmentId, assignmentId))
    .orderBy(desc(attendance.date));
}

export async function getAttendanceHistoryForStudent(
  assignmentId: number,
  studentId: number,
  limit = 30
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.assignmentId, assignmentId),
        eq(attendance.studentId, studentId)
      )
    )
    .orderBy(desc(attendance.date))
    .limit(limit);
}

export async function getAttendanceDatesByAssignment(
  assignmentId: number,
  limit = 20
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ date: attendance.date })
    .from(attendance)
    .where(eq(attendance.assignmentId, assignmentId))
    .groupBy(attendance.date)
    .orderBy(desc(attendance.date))
    .limit(limit);
}

export async function getAttendanceSession(assignmentId: number, date: string) {
  const db = await getDb();
  if (!db) return { assignment: null, students: [], attendance: [], dates: [] };

  const [assignment] = await db
    .select({
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
    })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(eq(teachingAssignments.id, assignmentId))
    .limit(1);

  if (!assignment?.assignment.classroomId) {
    return {
      assignment: assignment ?? null,
      students: [],
      attendance: [],
      dates: [],
    };
  }

  const [studentRows, attendanceRows, dateRows] = await Promise.all([
    db
      .select({
        id: students.id,
        studentNumber: students.studentNumber,
        studentCode: students.studentCode,
        prefix: students.prefix,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .where(
        and(
          eq(students.classroomId, assignment.assignment.classroomId),
          eq(students.status, "active")
        )
      )
      .orderBy(students.studentNumber, students.firstName),
    db
      .select({
        id: attendance.id,
        assignmentId: attendance.assignmentId,
        studentId: attendance.studentId,
        date: attendance.date,
        status: attendance.status,
        note: attendance.note,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.assignmentId, assignmentId),
          attendanceDateFilter(date)
        )
      ),
    db
      .select({ date: attendance.date })
      .from(attendance)
      .where(eq(attendance.assignmentId, assignmentId))
      .groupBy(attendance.date)
      .orderBy(desc(attendance.date))
      .limit(20),
  ]);

  return {
    assignment,
    students: studentRows,
    attendance: attendanceRows,
    dates: dateRows,
  };
}

export async function upsertAttendance(data: typeof attendance.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.assignmentId, data.assignmentId),
        eq(attendance.studentId, data.studentId),
        attendanceDateFilter(data.date as Date)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(attendance)
      .set({ status: data.status, note: data.note, updatedAt: new Date() })
      .where(eq(attendance.id, existing[0].id));
  } else {
    await db.insert(attendance).values(data);
  }
}

export async function deleteAttendanceForStudentDate(
  assignmentId: number,
  studentId: number,
  date: string | Date
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(attendance)
    .where(
      and(
        eq(attendance.assignmentId, assignmentId),
        eq(attendance.studentId, studentId),
        attendanceDateFilter(date)
      )
    );
}

export async function replaceAttendanceForDate(
  records: Array<typeof attendance.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (records.length === 0) return;

  const first = records[0];
  await db.transaction(async tx => {
    await tx
      .delete(attendance)
      .where(
        and(
          eq(attendance.assignmentId, first.assignmentId),
          attendanceDateFilter(first.date as Date)
        )
      );
    await tx.insert(attendance).values(records);
  });
}

export async function getAttendanceSummary(
  assignmentId: number,
  studentId: number
) {
  const db = await getDb();
  if (!db) return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  const records = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.assignmentId, assignmentId),
        eq(attendance.studentId, studentId)
      )
    );
  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: records.length,
  };
  for (const r of records) summary[r.status as keyof typeof summary]++;
  return summary;
}

function scoreCategoryTermFromWeight(
  weight: unknown
): "midyear" | "endyear" | undefined {
  if (weight === null || weight === undefined) return undefined;
  const normalized = String(weight).trim();
  if (["1", "1.0", "1.00"].includes(normalized)) return "midyear";
  if (["2", "2.0", "2.00"].includes(normalized)) return "endyear";
  return undefined;
}

function scoreCategoryWeightFromTerm(term?: "midyear" | "endyear") {
  if (term === "midyear") return "1";
  if (term === "endyear") return "2";
  return undefined;
}

const PRIMARY_FIXED_FINAL_CATEGORIES = [
  { name: "ปลายภาค 1", term: "midyear" as const, order: 999, maxScore: "20" },
  { name: "ปลายภาค 2", term: "endyear" as const, order: 1999, maxScore: "20" },
];

const SECONDARY_FIXED_FINAL_CATEGORIES = [
  { name: "กลางภาค", term: "midyear" as const, order: 999, maxScore: "20" },
  { name: "ปลายภาค", term: "endyear" as const, order: 1999, maxScore: "20" },
];

const ALL_FIXED_FINAL_CATEGORIES = [
  ...PRIMARY_FIXED_FINAL_CATEGORIES,
  ...SECONDARY_FIXED_FINAL_CATEGORIES,
];

function isPrimaryFixedFinalCategoryName(name: unknown) {
  return ALL_FIXED_FINAL_CATEGORIES.some(
    category => category.name === String(name ?? "").trim()
  );
}

function sortScoreCategoriesForDisplay<
  T extends { name?: unknown; order?: unknown; term?: unknown },
>(categories: T[]) {
  return [...categories].sort((a, b) => {
    const termRank = (term: unknown) => (term === "endyear" ? 1 : 0);
    const fixedRank = (name: unknown) =>
      isPrimaryFixedFinalCategoryName(name) ? 1 : 0;
    return (
      termRank(a.term) - termRank(b.term) ||
      fixedRank(a.name) - fixedRank(b.name) ||
      Number(a.order ?? 0) - Number(b.order ?? 0) ||
      String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
  });
}

async function ensureFixedFinalCategories(
  assignmentId: number,
  categories: any[]
) {
  const assignment = await getAssignmentById(assignmentId);
  const fixedCategories =
    assignment?.classroom?.level === "primary"
      ? PRIMARY_FIXED_FINAL_CATEGORIES
      : assignment?.classroom?.level === "secondary"
        ? SECONDARY_FIXED_FINAL_CATEGORIES
        : [];

  if (fixedCategories.length === 0) {
    return categories;
  }

  const db = await getDb();
  if (!db) return categories;

  const nextCategories = [...categories];

  for (const fixedCategory of fixedCategories) {
    const existing = nextCategories.find(
      category => String(category.name ?? "").trim() === fixedCategory.name
    );

    if (!existing) {
      const insertedRows = (await db
        .insert(scoreCategories)
        .values({
          id: await getNextNumericId(scoreCategories, scoreCategories.id),
          assignmentId,
          name: fixedCategory.name,
          maxScore: fixedCategory.maxScore,
          weight: scoreCategoryWeightFromTerm(fixedCategory.term),
          order: fixedCategory.order,
          createdAt: new Date(),
        })
        .returning()) as any[];
      const inserted = insertedRows[0];

      nextCategories.push({
        ...inserted,
        term: fixedCategory.term,
      });
      continue;
    }

    const nextWeight = scoreCategoryWeightFromTerm(fixedCategory.term);
    if (
      scoreCategoryTermFromWeight(existing.weight) !== fixedCategory.term ||
      Number(existing.order ?? 0) !== fixedCategory.order
    ) {
      await db
        .update(scoreCategories)
        .set({
          weight: nextWeight,
          order: fixedCategory.order,
        })
        .where(eq(scoreCategories.id, existing.id));
      existing.weight = nextWeight;
      existing.order = fixedCategory.order;
    }
  }

  return nextCategories;
}

export async function getScoreCategories(assignmentId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db
    .select()
    .from(scoreCategories)
    .where(eq(scoreCategories.assignmentId, assignmentId))
    .orderBy(scoreCategories.order, scoreCategories.createdAt);
  const ensured = await ensureFixedFinalCategories(
    assignmentId,
    existing as any[]
  );
  return sortScoreCategoriesForDisplay(
    ensured.map(category => ({
      ...category,
      term: scoreCategoryTermFromWeight(category.weight),
    }))
  );
}

export async function createScoreCategory(
  data: typeof scoreCategories.$inferInsert & { term?: "midyear" | "endyear" }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { term, ...rest } = data;
  const [result] = await db
    .insert(scoreCategories)
    .values({
      ...rest,
      weight: rest.weight ?? scoreCategoryWeightFromTerm(term),
      id:
        data.id ??
        (await getNextNumericId(scoreCategories, scoreCategories.id)),
      createdAt: data.createdAt ?? new Date(),
    })
    .returning({ id: scoreCategories.id });
  return result.id;
}

export async function updateScoreCategory(
  id: number,
  data: Partial<typeof scoreCategories.$inferInsert> & {
    term?: "midyear" | "endyear";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { term, ...rest } = data;
  const [existing] = await db
    .select()
    .from(scoreCategories)
    .where(eq(scoreCategories.id, id))
    .limit(1);
  const isFixedCategory = isPrimaryFixedFinalCategoryName(existing?.name);
  await db
    .update(scoreCategories)
    .set({
      ...(isFixedCategory ? { maxScore: rest.maxScore } : rest),
      ...(term && !isFixedCategory
        ? { weight: scoreCategoryWeightFromTerm(term) }
        : {}),
    })
    .where(eq(scoreCategories.id, id));
}

export async function deleteScoreCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [existing] = await db
    .select()
    .from(scoreCategories)
    .where(eq(scoreCategories.id, id))
    .limit(1);
  if (isPrimaryFixedFinalCategoryName(existing?.name)) {
    throw new Error("หมวดสอบเป็นหมวดคงที่ของเทมเพลต ไม่สามารถลบได้");
  }
  await db.delete(scores).where(eq(scores.categoryId, id));
  await db.delete(scoreCategories).where(eq(scoreCategories.id, id));
}

// ─── Scores ────────────────────────────────────────────────────────────────────
export async function getScoresByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scores).where(eq(scores.categoryId, categoryId));
}

export async function getScoresByAssignment(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  const cats = await getScoreCategories(assignmentId);
  if (cats.length === 0) return [];
  const catIds = cats.map(c => c.id);
  return db.select().from(scores).where(inArray(scores.categoryId, catIds));
}

export async function upsertScore(data: typeof scores.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(scores)
    .where(
      and(
        eq(scores.categoryId, data.categoryId),
        eq(scores.studentId, data.studentId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(scores)
      .set({
        score: data.score,
        note: data.note,
        recordedBy: data.recordedBy,
        updatedAt: new Date(),
      })
      .where(eq(scores.id, existing[0].id));
  } else {
    await db.insert(scores).values(data);
  }
}

export async function upsertScoresBatch(items: (typeof scores.$inferInsert)[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return { inserted: 0, updated: 0, skipped: 0 };

  const categoryIds = Array.from(new Set(items.map(item => item.categoryId)));
  const studentIds = Array.from(new Set(items.map(item => item.studentId)));
  const existing = await db
    .select()
    .from(scores)
    .where(
      and(
        inArray(scores.categoryId, categoryIds),
        inArray(scores.studentId, studentIds)
      )
    );
  const existingByKey = new Map(
    existing.map(score => [`${score.categoryId}-${score.studentId}`, score])
  );

  let updated = 0;
  let skipped = 0;
  const inserts: (typeof scores.$inferInsert)[] = [];

  await Promise.all(
    items.map(async item => {
      const existingScore = existingByKey.get(
        `${item.categoryId}-${item.studentId}`
      );
      if (existingScore) {
        updated += 1;
        await db
          .update(scores)
          .set({
            score: item.score,
            note: item.note,
            recordedBy: item.recordedBy,
            updatedAt: new Date(),
          })
          .where(eq(scores.id, existingScore.id));
        return;
      }

      if (item.score === null || item.score === undefined || item.score === "") {
        skipped += 1;
        return;
      }

      inserts.push(item);
    })
  );

  if (inserts.length > 0) {
    await db.insert(scores).values(inserts);
  }

  return { inserted: inserts.length, updated, skipped };
}

// ─── Grade Results ─────────────────────────────────────────────────────────────
export async function getGradeResults(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gradeResults)
    .where(eq(gradeResults.assignmentId, assignmentId));
}

export async function upsertGradeResult(
  data: typeof gradeResults.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(gradeResults)
    .where(
      and(
        eq(gradeResults.assignmentId, data.assignmentId),
        eq(gradeResults.studentId, data.studentId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(gradeResults)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(gradeResults.id, existing[0].id));
  } else {
    await db.insert(gradeResults).values(data);
  }
}

export async function getStudentGradeResults(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      result: gradeResults,
      assignment: teachingAssignments,
      subject: subjects,
      classroom: classrooms,
    })
    .from(gradeResults)
    .leftJoin(
      teachingAssignments,
      eq(gradeResults.assignmentId, teachingAssignments.id)
    )
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(eq(gradeResults.studentId, studentId));
}

export async function getSchoolSettings() {
  const db = await getDb();
  if (!db) {
    return {
      id: 1,
      schoolName: "โรงเรียนบ้านขัวก่าย",
      officeName: "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสกลนคร เขต 3",
      homeroomTeacherName: "",
      academicHeadName: "",
      directorName: "",
      updatedAt: new Date(),
    };
  }
  await ensurePor6Tables();
  const [row] = await db
    .select()
    .from(schoolSettings)
    .where(eq(schoolSettings.id, 1))
    .limit(1);
  if (row) return row;
  const initial = {
    id: 1,
    schoolName: "โรงเรียนบ้านขัวก่าย",
    officeName: "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสกลนคร เขต 3",
    homeroomTeacherName: "",
    academicHeadName: "",
    directorName: "",
    updatedAt: new Date(),
  };
  await db.insert(schoolSettings).values(initial as any).catch(() => {});
  return initial;
}

export async function updateSchoolSettings(
  data: Partial<typeof schoolSettings.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensurePor6Tables();
  const existing = await getSchoolSettings();
  if (existing) {
    await db
      .update(schoolSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schoolSettings.id, 1));
  } else {
    await db
      .insert(schoolSettings)
      .values({ id: 1, ...data, updatedAt: new Date() } as any);
  }
  return getSchoolSettings();
}

function defaultPor6Assessment(studentId: number, academicYearId: number) {
  return {
    id: 0,
    studentId,
    academicYearId,
    competencies: DEFAULT_POR6_COMPETENCIES,
    readingThinkingWriting: "ดีเยี่ยม",
    attributes: DEFAULT_POR6_ATTRIBUTES,
    activities: DEFAULT_POR6_ACTIVITIES,
    activityLabels: DEFAULT_POR6_ACTIVITY_LABELS,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getPor6Assessment(
  studentId: number,
  academicYearId: number
) {
  const db = await getDb();
  if (!db) return defaultPor6Assessment(studentId, academicYearId);
  await ensurePor6Tables();
  const [row] = await db
    .select()
    .from(studentPor6Assessments)
    .where(
      and(
        eq(studentPor6Assessments.studentId, studentId),
        eq(studentPor6Assessments.academicYearId, academicYearId)
      )
    )
    .limit(1);
  return row ?? defaultPor6Assessment(studentId, academicYearId);
}

export async function upsertPor6Assessment(data: {
  studentId: number;
  academicYearId: number;
  competencies?: Record<string, string>;
  readingThinkingWriting?: string;
  attributes?: Record<string, string>;
  activities?: Record<string, string>;
  activityLabels?: Record<string, string>;
  updatedBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensurePor6Tables();
  const existing = await getPor6Assessment(data.studentId, data.academicYearId);
  const values = {
    studentId: data.studentId,
    academicYearId: data.academicYearId,
    competencies: data.competencies ?? DEFAULT_POR6_COMPETENCIES,
    readingThinkingWriting: data.readingThinkingWriting ?? "ดีเยี่ยม",
    attributes: data.attributes ?? DEFAULT_POR6_ATTRIBUTES,
    activities: data.activities ?? DEFAULT_POR6_ACTIVITIES,
    activityLabels: data.activityLabels ?? DEFAULT_POR6_ACTIVITY_LABELS,
    updatedBy: data.updatedBy,
    updatedAt: new Date(),
  };
  if (existing.id) {
    await db
      .update(studentPor6Assessments)
      .set(values as any)
      .where(eq(studentPor6Assessments.id, existing.id));
  } else {
    await db.insert(studentPor6Assessments).values({
      id: await getNextNumericId(
        studentPor6Assessments,
        studentPor6Assessments.id
      ),
      ...values,
      createdAt: new Date(),
    } as any);
  }
  return getPor6Assessment(data.studentId, data.academicYearId);
}

export async function updatePor6ClassroomActivities(data: {
  classroomId: number;
  academicYearId: number;
  activities?: Record<string, string>;
  activityLabels?: Record<string, string>;
  updatedBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensurePor6Tables();
  const classroomStudents = await getStudentsByClassroom(data.classroomId);
  if (classroomStudents.length === 0) return [];

  const studentIds = classroomStudents.map(student => student.id);
  const existingRows = await db
    .select()
    .from(studentPor6Assessments)
    .where(
      and(
        eq(studentPor6Assessments.academicYearId, data.academicYearId),
        inArray(studentPor6Assessments.studentId, studentIds)
      )
    );
  const existingByStudentId = new Map(
    existingRows.map(row => [row.studentId, row])
  );
  const now = new Date();

  for (const student of classroomStudents) {
    const existing = existingByStudentId.get(student.id);
    const values = {
      activities: data.activities ?? DEFAULT_POR6_ACTIVITIES,
      activityLabels: data.activityLabels ?? DEFAULT_POR6_ACTIVITY_LABELS,
      updatedBy: data.updatedBy,
      updatedAt: now,
    };
    if (existing) {
      await db
        .update(studentPor6Assessments)
        .set(values as any)
        .where(eq(studentPor6Assessments.id, existing.id));
    } else {
      await db.insert(studentPor6Assessments).values({
        id: await getNextNumericId(
          studentPor6Assessments,
          studentPor6Assessments.id
        ),
        studentId: student.id,
        academicYearId: data.academicYearId,
        competencies: null,
        readingThinkingWriting: null,
        attributes: null,
        ...values,
        createdAt: now,
      } as any);
    }
  }

  return getPor6ClassroomReports(data.classroomId);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function subjectType(subject: any) {
  const text = `${subject?.name ?? ""} ${subject?.subjectGroup ?? ""}`;
  return /เพิ่มเติม/.test(text) ? "เพิ่มเติม" : "พื้นฐาน";
}

function numericGrade(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPor6StudentReport(studentId: number) {
  const db = await getDb();
  if (!db) return null;
  const student = await getStudentById(studentId);
  if (!student) return null;
  const classroom = await getClassroomById(student.classroomId);
  if (!classroom) return null;
  const academicYear = await getAcademicYearById(classroom.academicYearId);
  const school = await getSchoolSettings();
  const assessment = await getPor6Assessment(student.id, classroom.academicYearId);
  const homeroomTeachers = await getClassroomHomeroomTeachers(classroom.id);
  const homeroomTeacherNames = homeroomTeachers
    .map(row =>
      `${row.profile?.prefix ?? ""}${row.profile?.firstName ?? ""} ${row.profile?.lastName ?? ""}`.trim() ||
      row.user?.name ||
      row.user?.email ||
      ""
    )
    .filter(Boolean);
  const classmates = await getStudentsByClassroom(classroom.id);
  const assignmentRows = await db
    .select({
      assignment: teachingAssignments,
      subject: subjects,
    })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .where(
      and(
        eq(teachingAssignments.classroomId, classroom.id),
        eq(teachingAssignments.academicYearId, classroom.academicYearId)
      )
    )
    .orderBy(subjects.subjectCode, subjects.name);

  const assignmentIds = assignmentRows.map(row => row.assignment.id);
  const allResults =
    assignmentIds.length === 0
      ? []
      : await db
          .select()
          .from(gradeResults)
          .where(inArray(gradeResults.assignmentId, assignmentIds));
  const resultsByAssignmentStudent = new Map(
    allResults.map(result => [
      `${result.assignmentId}-${result.studentId}`,
      result,
    ])
  );
  const classAverageByAssignment = new Map<number, number>();
  assignmentIds.forEach(id => {
    const values = allResults
      .filter(result => result.assignmentId === id)
      .map(result => toNumber(result.totalScore))
      .filter((value): value is number => value !== null);
    if (values.length > 0) {
      classAverageByAssignment.set(
        id,
        Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
      );
    }
  });

  const rankRows = classmates.map(classmate => {
    const totals = assignmentIds
      .map(id => toNumber(resultsByAssignmentStudent.get(`${id}-${classmate.id}`)?.totalScore))
      .filter((value): value is number => value !== null);
    const percent =
      totals.length > 0
        ? totals.reduce((sum, value) => sum + value, 0) / totals.length
        : null;
    return { studentId: classmate.id, percent };
  });
  const ranked = rankRows
    .filter(row => row.percent !== null)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const rankIndex = ranked.findIndex(row => row.studentId === student.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  const subjectsReport = assignmentRows.map(row => {
    const result = resultsByAssignmentStudent.get(
      `${row.assignment.id}-${student.id}`
    );
    return {
      assignmentId: row.assignment.id,
      subjectType: subjectType(row.subject),
      subjectCode: row.subject?.subjectCode ?? "",
      subjectName: row.subject?.name ?? "รายวิชา",
      hours: Number(row.assignment.hoursPerWeek ?? 1) * 40,
      maxScore: 100,
      classAverage: classAverageByAssignment.get(row.assignment.id) ?? null,
      score: toNumber(result?.totalScore),
      grade: result?.grade ?? null,
      result: result?.result ?? null,
      note: "",
    };
  });
  const scoredSubjects = subjectsReport.filter(subject => subject.score !== null);
  const totalScore = scoredSubjects.reduce(
    (sum, subject) => sum + (subject.score ?? 0),
    0
  );
  const totalMaxScore = subjectsReport.length * 100;
  const percentage =
    scoredSubjects.length > 0
      ? Math.round((totalScore / (scoredSubjects.length * 100)) * 10000) / 100
      : null;
  const grades = subjectsReport
    .map(subject => numericGrade(subject.grade))
    .filter((value): value is number => value !== null);
  const gpa =
    grades.length > 0
      ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 100) /
        100
      : null;

  return {
    student,
    classroom,
    academicYear,
    school,
    homeroomTeacherNames,
    assessment,
    subjects: subjectsReport,
    summary: {
      totalHours: subjectsReport.reduce((sum, subject) => sum + subject.hours, 0),
      totalMaxScore,
      totalScore: scoredSubjects.length > 0 ? Math.round(totalScore * 100) / 100 : null,
      percentage,
      gpa,
      rank,
      rankedCount: ranked.length,
    },
  };
}

export async function getPor6ClassroomReports(classroomId: number) {
  const db = await getDb();
  if (!db) return [];
  const classroom = await getClassroomById(classroomId);
  if (!classroom) return [];
  const students = await getStudentsByClassroom(classroomId);
  if (students.length === 0) return [];

  await ensurePor6Tables();
  const academicYear = await getAcademicYearById(classroom.academicYearId);
  const school = await getSchoolSettings();
  const homeroomTeachers = await getClassroomHomeroomTeachers(classroom.id);
  const homeroomTeacherNames = homeroomTeachers
    .map(row =>
      `${row.profile?.prefix ?? ""}${row.profile?.firstName ?? ""} ${row.profile?.lastName ?? ""}`.trim() ||
      row.user?.name ||
      row.user?.email ||
      ""
    )
    .filter(Boolean);
  const studentIds = students.map(student => student.id);
  const assessmentRows = await db
    .select()
    .from(studentPor6Assessments)
    .where(
      and(
        eq(studentPor6Assessments.academicYearId, classroom.academicYearId),
        inArray(studentPor6Assessments.studentId, studentIds)
      )
    );
  const assessmentsByStudentId = new Map(
    assessmentRows.map(row => [row.studentId, row])
  );

  const assignmentRows = await db
    .select({
      assignment: teachingAssignments,
      subject: subjects,
    })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .where(
      and(
        eq(teachingAssignments.classroomId, classroom.id),
        eq(teachingAssignments.academicYearId, classroom.academicYearId)
      )
    )
    .orderBy(subjects.subjectCode, subjects.name);

  const assignmentIds = assignmentRows.map(row => row.assignment.id);
  const allResults =
    assignmentIds.length === 0
      ? []
      : await db
          .select()
          .from(gradeResults)
          .where(inArray(gradeResults.assignmentId, assignmentIds));
  const resultsByAssignmentStudent = new Map(
    allResults.map(result => [
      `${result.assignmentId}-${result.studentId}`,
      result,
    ])
  );

  const classAverageByAssignment = new Map<number, number>();
  const totalsByAssignment = new Map<number, { sum: number; count: number }>();
  allResults.forEach(result => {
    const score = toNumber(result.totalScore);
    if (score === null) return;
    const current = totalsByAssignment.get(result.assignmentId) ?? {
      sum: 0,
      count: 0,
    };
    current.sum += score;
    current.count += 1;
    totalsByAssignment.set(result.assignmentId, current);
  });
  totalsByAssignment.forEach((value, assignmentId) => {
    classAverageByAssignment.set(
      assignmentId,
      Math.round((value.sum / value.count) * 100) / 100
    );
  });

  const rankRows = students.map(student => {
    const totals = assignmentIds
      .map(id =>
        toNumber(resultsByAssignmentStudent.get(`${id}-${student.id}`)?.totalScore)
      )
      .filter((value): value is number => value !== null);
    const percent =
      totals.length > 0
        ? totals.reduce((sum, value) => sum + value, 0) / totals.length
        : null;
    return { studentId: student.id, percent };
  });
  const ranked = rankRows
    .filter(row => row.percent !== null)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const rankByStudentId = new Map(
    ranked.map((row, index) => [row.studentId, index + 1])
  );

  return students.map(student => {
    const subjectsReport = assignmentRows.map(row => {
      const result = resultsByAssignmentStudent.get(
        `${row.assignment.id}-${student.id}`
      );
      return {
        assignmentId: row.assignment.id,
        subjectType: subjectType(row.subject),
        subjectCode: row.subject?.subjectCode ?? "",
        subjectName: row.subject?.name ?? "รายวิชา",
        hours: Number(row.assignment.hoursPerWeek ?? 1) * 40,
        maxScore: 100,
        classAverage: classAverageByAssignment.get(row.assignment.id) ?? null,
        score: toNumber(result?.totalScore),
        grade: result?.grade ?? null,
        result: result?.result ?? null,
        note: "",
      };
    });
    const scoredSubjects = subjectsReport.filter(
      subject => subject.score !== null
    );
    const totalScore = scoredSubjects.reduce(
      (sum, subject) => sum + (subject.score ?? 0),
      0
    );
    const totalMaxScore = subjectsReport.length * 100;
    const percentage =
      scoredSubjects.length > 0
        ? Math.round((totalScore / (scoredSubjects.length * 100)) * 10000) / 100
        : null;
    const grades = subjectsReport
      .map(subject => numericGrade(subject.grade))
      .filter((value): value is number => value !== null);
    const gpa =
      grades.length > 0
        ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 100) /
          100
        : null;

    return {
      student,
      classroom,
      academicYear,
      school,
      homeroomTeacherNames,
      assessment:
        assessmentsByStudentId.get(student.id) ??
        defaultPor6Assessment(student.id, classroom.academicYearId),
      subjects: subjectsReport,
      summary: {
        totalHours: subjectsReport.reduce(
          (sum, subject) => sum + subject.hours,
          0
        ),
        totalMaxScore,
        totalScore:
          scoredSubjects.length > 0 ? Math.round(totalScore * 100) / 100 : null,
        percentage,
        gpa,
        rank: rankByStudentId.get(student.id) ?? null,
        rankedCount: ranked.length,
      },
    };
  });
}

// ─── Exported Documents ────────────────────────────────────────────────────────
export async function getExportedDocuments(
  exportedBy?: number,
  documentType?: "por1" | "por5" | "por6"
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (exportedBy) conditions.push(eq(exportedDocuments.exportedBy, exportedBy));
  if (documentType)
    conditions.push(eq(exportedDocuments.documentType, documentType));
  const query = db.select().from(exportedDocuments);
  if (conditions.length > 0)
    return query
      .where(and(...conditions))
      .orderBy(desc(exportedDocuments.createdAt));
  return query.orderBy(desc(exportedDocuments.createdAt));
}

export async function createExportedDocument(
  data: typeof exportedDocuments.$inferInsert
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.documentType === "por5") {
    const schemaName = ENV.dbSchema.replace(/"/g, '""');
    await db
      .execute(
        sql.raw(
          `ALTER TYPE "${schemaName}"."document_type" ADD VALUE IF NOT EXISTS 'por5'`
        )
      )
      .catch(error => {
        console.warn("[Documents] Unable to ensure por5 document type", error);
      });
  }
  const [result] = await db
    .insert(exportedDocuments)
    .values({
      ...data,
      id:
        data.id ??
        (await getNextNumericId(exportedDocuments, exportedDocuments.id)),
      createdAt: data.createdAt ?? new Date(),
    })
    .returning({ id: exportedDocuments.id });
  return result.id;
}

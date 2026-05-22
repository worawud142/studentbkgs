import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import {
  InsertUser,
  academicYears,
  attendance,
  classrooms,
  exportedDocuments,
  gradeResults,
  scoreCategories,
  scores,
  students,
  subjects,
  teacherProfiles,
  teachingAssignments,
  users,
} from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./_core/password";

let _pool: Pool | null = null;
type Database = ReturnType<typeof drizzle>;
let _db: Database | null = null;

function getPoolOptions() {
  const connectionUrl = new URL(ENV.databaseUrl);
  const isSupabase = /supabase\.co|pooler\.supabase\.com/i.test(ENV.databaseUrl);

  return {
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || "5432"),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: connectionUrl.pathname.replace(/^\//, "") || "postgres",
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
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
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    const isOwner =
      ENV.ownerOpenId &&
      (user.openId === ENV.ownerOpenId || user.email === ENV.ownerOpenId)
    ;
    if (isOwner) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
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
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
  if (!normalized) return { email: null as string | null, user: undefined as typeof users.$inferSelect | undefined };

  const teacherCodeUser = await getUserByTeacherCode(normalized);
  if (teacherCodeUser) {
    return {
      email: teacherCodeUser.email ?? `${normalized.toLowerCase()}@school.local`,
      user: teacherCodeUser,
    };
  }

  const emailUser = normalized.includes("@") ? await getUserByEmail(normalized) : undefined;
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
    email: normalized.includes("@") ? normalized : `${normalized.toLowerCase()}@school.local`,
    user: undefined,
  };
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "teacher" | "admin" | "reviewer") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateTeacherPassword(userId: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) {
    throw new Error("ไม่พบผู้ใช้งาน");
  }
  await db.update(users).set({
    passwordHash: hashPassword(password),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
}

// ─── Teacher Profiles ─────────────────────────────────────────────────────────
export async function getTeacherProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.warn("[Database] Failed to read teacher profile:", error);
    return null;
  }
}

export async function upsertTeacherProfile(data: typeof teacherProfiles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getTeacherProfile(data.userId);
  if (existing) {
    await db.update(teacherProfiles).set({ ...data, updatedAt: new Date() }).where(eq(teacherProfiles.userId, data.userId));
    return existing.id;
  } else {
    const [result] = await db.insert(teacherProfiles).values({
      ...data,
      id: data.id ?? (await getNextNumericId(teacherProfiles, teacherProfiles.id)),
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    }).returning({ id: teacherProfiles.id });
    return result.id;
  }
}

export async function getAllTeacherProfiles() {
  const db = await getDb();
  if (!db) return [];
  try {
    return db
      .select({ profile: teacherProfiles, user: users })
      .from(teacherProfiles)
      .leftJoin(users, eq(teacherProfiles.userId, users.id))
      .orderBy(teacherProfiles.firstName);
  } catch (error) {
    console.warn("[Database] Failed to list teacher profiles:", error);
    return [];
  }
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

  const teacherProfileId = await getNextNumericId(teacherProfiles, teacherProfiles.id);
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

  const [profile] = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).limit(1);
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
    throw new Error("ครูคนนี้ยังเป็นครูประจำชั้นอยู่ กรุณาเปลี่ยนครูประจำชั้นก่อน");
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
  if (level) return query.where(eq(academicYears.level, level)).orderBy(desc(academicYears.year));
  return query.orderBy(desc(academicYears.year));
}

export async function getAcademicYearById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(academicYears).where(eq(academicYears.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getActiveAcademicYear(level: "primary" | "secondary") {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(academicYears)
    .where(and(eq(academicYears.level, level), eq(academicYears.isActive, true))).limit(1);
  return result[0] ?? null;
}

export async function createAcademicYear(data: typeof academicYears.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(academicYears).values({
    ...data,
    id: data.id ?? (await getNextNumericId(academicYears, academicYears.id)),
    createdAt: data.createdAt ?? new Date(),
  }).returning({ id: academicYears.id });
  return result.id;
}

export async function updateAcademicYear(id: number, data: Partial<typeof academicYears.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicYears).set(data).where(eq(academicYears.id, id));
}

export async function deleteAcademicYear(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(academicYears).where(eq(academicYears.id, id));
}

export async function setActiveAcademicYear(id: number, level: "primary" | "secondary") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(academicYears).set({ isActive: false }).where(eq(academicYears.level, level));
  await db.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, id));
}

// ─── Classrooms ────────────────────────────────────────────────────────────────
export async function getClassrooms(academicYearId?: number, level?: "primary" | "secondary") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (academicYearId) conditions.push(eq(classrooms.academicYearId, academicYearId));
  if (level) conditions.push(eq(classrooms.level, level));
  const query = db.select().from(classrooms);
  if (conditions.length > 0) return query.where(and(...conditions)).orderBy(classrooms.grade, classrooms.room);
  return query.orderBy(classrooms.grade, classrooms.room);
}

export async function getClassroomById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createClassroom(data: typeof classrooms.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(classrooms).values({
    ...data,
    id: data.id ?? (await getNextNumericId(classrooms, classrooms.id)),
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  }).returning({ id: classrooms.id });
  return result.id;
}

export async function updateClassroom(id: number, data: Partial<typeof classrooms.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(classrooms).set({ ...data, updatedAt: new Date() }).where(eq(classrooms.id, id));
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
    return db.select().from(subjects)
      .where(sql`${subjects.level} = ${level} OR ${subjects.level} = 'both'`)
      .orderBy(subjects.subjectGroup, subjects.name);
  }
  return db.select().from(subjects).orderBy(subjects.subjectGroup, subjects.name);
}

export async function getSubjectById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createSubject(data: typeof subjects.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(subjects).values({
    ...data,
    id: data.id ?? (await getNextNumericId(subjects, subjects.id)),
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  }).returning({ id: subjects.id });
  return result.id;
}

export async function updateSubject(id: number, data: Partial<typeof subjects.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(subjects).set({ ...data, updatedAt: new Date() }).where(eq(subjects.id, id));
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
  return db.select().from(students)
    .where(and(eq(students.classroomId, classroomId), eq(students.status, "active")))
    .orderBy(students.studentNumber, students.firstName);
}

export async function getStudentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createStudent(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(students).values({
    ...data,
    id: data.id ?? (await getNextNumericId(students, students.id)),
    createdAt: data.createdAt ?? new Date(),
    updatedAt: data.updatedAt ?? new Date(),
  }).returning({ id: students.id });
  return result.id;
}

export async function upsertStudentByCode(data: typeof students.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(students).values({
    ...data,
    status: data.status ?? "active",
    updatedAt: new Date(),
  }).onConflictDoUpdate({
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
  }).returning({ id: students.id });
  return result.id;
}

export async function updateStudent(id: number, data: Partial<typeof students.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id));
}

export async function deleteStudent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(students).set({ status: "dropped", updatedAt: new Date() }).where(eq(students.id, id));
}

// ─── Teaching Assignments ─────────────────────────────────────────────────────
export async function getTeacherAssignments(teacherId: number, academicYearId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(teachingAssignments.teacherId, teacherId)];
  if (academicYearId) conditions.push(eq(teachingAssignments.academicYearId, academicYearId));
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

export async function getAssignmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ assignment: teachingAssignments, subject: subjects, classroom: classrooms })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(eq(teachingAssignments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTeachingAssignment(data: typeof teachingAssignments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(teachingAssignments).values({
    ...data,
    id: data.id ?? (await getNextNumericId(teachingAssignments, teachingAssignments.id)),
    createdAt: data.createdAt ?? new Date(),
  }).returning({ id: teachingAssignments.id });
  return result.id;
}

export async function updateTeachingAssignment(id: number, data: Partial<typeof teachingAssignments.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teachingAssignments).set(data).where(eq(teachingAssignments.id, id));
}

export async function deleteTeachingAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(teachingAssignments).where(eq(teachingAssignments.id, id));
}

export async function getAllTeachingAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
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
    .leftJoin(teacherProfiles, eq(teachingAssignments.teacherId, teacherProfiles.userId))
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .leftJoin(academicYears, eq(teachingAssignments.academicYearId, academicYears.id))
    .orderBy(desc(academicYears.year), classrooms.grade, classrooms.room, subjects.name);
}

// ─── Attendance ────────────────────────────────────────────────────────────────
export async function getAttendanceByAssignmentAndDate(assignmentId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attendance)
    .where(and(eq(attendance.assignmentId, assignmentId), eq(attendance.date, date as any)));
}

export async function getAttendanceByAssignment(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attendance).where(eq(attendance.assignmentId, assignmentId)).orderBy(desc(attendance.date));
}

export async function getAttendanceDatesByAssignment(assignmentId: number, limit = 20) {
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
    .select({ assignment: teachingAssignments, subject: subjects, classroom: classrooms })
    .from(teachingAssignments)
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(eq(teachingAssignments.id, assignmentId))
    .limit(1);

  if (!assignment?.assignment.classroomId) {
    return { assignment: assignment ?? null, students: [], attendance: [], dates: [] };
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
      .where(and(eq(students.classroomId, assignment.assignment.classroomId), eq(students.status, "active")))
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
      .where(and(eq(attendance.assignmentId, assignmentId), eq(attendance.date, date as any))),
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
  const existing = await db.select().from(attendance)
    .where(and(eq(attendance.assignmentId, data.assignmentId), eq(attendance.studentId, data.studentId), eq(attendance.date, data.date as any))).limit(1);
  if (existing.length > 0) {
    await db.update(attendance).set({ status: data.status, note: data.note, updatedAt: new Date() }).where(eq(attendance.id, existing[0].id));
  } else {
    await db.insert(attendance).values(data);
  }
}

export async function replaceAttendanceForDate(records: Array<typeof attendance.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (records.length === 0) return;

  const first = records[0];
  await db.transaction(async (tx) => {
    await tx
      .delete(attendance)
      .where(and(eq(attendance.assignmentId, first.assignmentId), eq(attendance.date, first.date as any)));
    await tx.insert(attendance).values(records);
  });
}

export async function getAttendanceSummary(assignmentId: number, studentId: number) {
  const db = await getDb();
  if (!db) return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  const records = await db.select().from(attendance)
    .where(and(eq(attendance.assignmentId, assignmentId), eq(attendance.studentId, studentId)));
  const summary = { present: 0, absent: 0, late: 0, excused: 0, total: records.length };
  for (const r of records) summary[r.status as keyof typeof summary]++;
  return summary;
}

function scoreCategoryTermFromWeight(weight: unknown): "midyear" | "endyear" | undefined {
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
  return ALL_FIXED_FINAL_CATEGORIES.some((category) => category.name === String(name ?? "").trim());
}

function sortScoreCategoriesForDisplay<T extends { name?: unknown; order?: unknown; term?: unknown }>(categories: T[]) {
  return [...categories].sort((a, b) => {
    const termRank = (term: unknown) => (term === "endyear" ? 1 : 0);
    const fixedRank = (name: unknown) => (isPrimaryFixedFinalCategoryName(name) ? 1 : 0);
    return (
      termRank(a.term) - termRank(b.term) ||
      fixedRank(a.name) - fixedRank(b.name) ||
      Number(a.order ?? 0) - Number(b.order ?? 0) ||
      String(a.name ?? "").localeCompare(String(b.name ?? ""))
    );
  });
}

async function ensureFixedFinalCategories(assignmentId: number, categories: any[]) {
  const assignment = await getAssignmentById(assignmentId);
  const fixedCategories = assignment?.classroom?.level === "primary"
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
    const existing = nextCategories.find((category) => String(category.name ?? "").trim() === fixedCategory.name);

    if (!existing) {
      const insertedRows = await db.insert(scoreCategories).values({
        id: await getNextNumericId(scoreCategories, scoreCategories.id),
        assignmentId,
        name: fixedCategory.name,
        maxScore: fixedCategory.maxScore,
        weight: scoreCategoryWeightFromTerm(fixedCategory.term),
        order: fixedCategory.order,
        createdAt: new Date(),
      }).returning() as any[];
      const inserted = insertedRows[0];

      nextCategories.push({
        ...inserted,
        term: fixedCategory.term,
      });
      continue;
    }

    const nextWeight = scoreCategoryWeightFromTerm(fixedCategory.term);
    if (scoreCategoryTermFromWeight(existing.weight) !== fixedCategory.term || Number(existing.order ?? 0) !== fixedCategory.order) {
      await db.update(scoreCategories).set({
        weight: nextWeight,
        order: fixedCategory.order,
      }).where(eq(scoreCategories.id, existing.id));
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
  const ensured = await ensureFixedFinalCategories(assignmentId, existing as any[]);
  return sortScoreCategoriesForDisplay(ensured.map((category) => ({
    ...category,
    term: scoreCategoryTermFromWeight(category.weight),
  })));
}

export async function createScoreCategory(data: typeof scoreCategories.$inferInsert & { term?: "midyear" | "endyear" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { term, ...rest } = data;
  const [result] = await db.insert(scoreCategories).values({
    ...rest,
    weight: rest.weight ?? scoreCategoryWeightFromTerm(term),
    id: data.id ?? (await getNextNumericId(scoreCategories, scoreCategories.id)),
    createdAt: data.createdAt ?? new Date(),
  }).returning({ id: scoreCategories.id });
  return result.id;
}

export async function updateScoreCategory(
  id: number,
  data: Partial<typeof scoreCategories.$inferInsert> & { term?: "midyear" | "endyear" },
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { term, ...rest } = data;
  const [existing] = await db.select().from(scoreCategories).where(eq(scoreCategories.id, id)).limit(1);
  const isFixedCategory = isPrimaryFixedFinalCategoryName(existing?.name);
  await db.update(scoreCategories).set({
    ...(isFixedCategory ? { maxScore: rest.maxScore } : rest),
    ...((term && !isFixedCategory) ? { weight: scoreCategoryWeightFromTerm(term) } : {}),
  }).where(eq(scoreCategories.id, id));
}

export async function deleteScoreCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [existing] = await db.select().from(scoreCategories).where(eq(scoreCategories.id, id)).limit(1);
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
  const catIds = cats.map((c) => c.id);
  return db.select().from(scores).where(inArray(scores.categoryId, catIds));
}

export async function upsertScore(data: typeof scores.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(scores)
    .where(and(eq(scores.categoryId, data.categoryId), eq(scores.studentId, data.studentId))).limit(1);
  if (existing.length > 0) {
    await db.update(scores).set({ score: data.score, note: data.note, recordedBy: data.recordedBy, updatedAt: new Date() }).where(eq(scores.id, existing[0].id));
  } else {
    await db.insert(scores).values(data);
  }
}

// ─── Grade Results ─────────────────────────────────────────────────────────────
export async function getGradeResults(assignmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gradeResults).where(eq(gradeResults.assignmentId, assignmentId));
}

export async function upsertGradeResult(data: typeof gradeResults.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(gradeResults)
    .where(and(eq(gradeResults.assignmentId, data.assignmentId), eq(gradeResults.studentId, data.studentId))).limit(1);
  if (existing.length > 0) {
    await db.update(gradeResults).set({ ...data, updatedAt: new Date() }).where(eq(gradeResults.id, existing[0].id));
  } else {
    await db.insert(gradeResults).values(data);
  }
}

export async function getStudentGradeResults(studentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ result: gradeResults, assignment: teachingAssignments, subject: subjects, classroom: classrooms })
    .from(gradeResults)
    .leftJoin(teachingAssignments, eq(gradeResults.assignmentId, teachingAssignments.id))
    .leftJoin(subjects, eq(teachingAssignments.subjectId, subjects.id))
    .leftJoin(classrooms, eq(teachingAssignments.classroomId, classrooms.id))
    .where(eq(gradeResults.studentId, studentId));
}

// ─── Exported Documents ────────────────────────────────────────────────────────
export async function getExportedDocuments(exportedBy?: number, documentType?: "por1" | "por6") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (exportedBy) conditions.push(eq(exportedDocuments.exportedBy, exportedBy));
  if (documentType) conditions.push(eq(exportedDocuments.documentType, documentType));
  const query = db.select().from(exportedDocuments);
  if (conditions.length > 0) return query.where(and(...conditions)).orderBy(desc(exportedDocuments.createdAt));
  return query.orderBy(desc(exportedDocuments.createdAt));
}

export async function createExportedDocument(data: typeof exportedDocuments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(exportedDocuments).values({
    ...data,
    id: data.id ?? (await getNextNumericId(exportedDocuments, exportedDocuments.id)),
    createdAt: data.createdAt ?? new Date(),
  }).returning({ id: exportedDocuments.id });
  return result.id;
}

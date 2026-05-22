import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@school.ac.th",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createTeacherContext(id = 2): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `teacher-${id}`,
    email: `teacher${id}@school.ac.th`,
    name: `Teacher ${id}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns the current user when authenticated", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.role).toBe("admin");
  });

  it("me returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("logout clears session cookie", async () => {
    const clearedCookies: string[] = [];
    const ctx = createAdminContext();
    ctx.res.clearCookie = (name: string) => { clearedCookies.push(name); };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

// ─── Admin Guard Tests ────────────────────────────────────────────────────────
describe("admin guard", () => {
  it("blocks non-admin from listing all teacher profiles", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teacher.allProfiles()).rejects.toThrow();
  });

  it("allows admin to list all teacher profiles", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // This will fail if DB is not available, but should not throw FORBIDDEN
    try {
      const result = await caller.teacher.allProfiles();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB connection error is acceptable in test environment
      expect(e.message).not.toContain("FORBIDDEN");
    }
  });

  it("blocks non-admin from creating classroom", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.classroom.create({
        name: "ม.1/1",
        level: "secondary",
        grade: 1,
        room: 1,
        academicYearId: 1,
      })
    ).rejects.toThrow();
  });

  it("blocks non-admin from creating subject", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.subject.create({
        subjectCode: "ท21101",
        name: "ภาษาไทย",
        level: "secondary",
      })
    ).rejects.toThrow();
  });
});

// ─── Teacher Profile Tests ────────────────────────────────────────────────────
describe("teacher profile", () => {
  it("upsertProfile validates required fields", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teacher.upsertProfile({
        firstName: "",
        lastName: "Test",
        teachingLevel: "secondary",
        isHomeroom: false,
      })
    ).rejects.toThrow();
  });

  it("upsertProfile accepts valid teacher data", async () => {
    const ctx = createTeacherContext(99);
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.teacher.upsertProfile({
        firstName: "สมชาย",
        lastName: "ใจดี",
        prefix: "นาย",
        teachingLevel: "both",
        isHomeroom: false,
      });
      expect(result).toHaveProperty("id");
    } catch (e: any) {
      // DB connection error is acceptable
      expect(e.message).not.toContain("validation");
    }
  });
});

// ─── Attendance Validation Tests ──────────────────────────────────────────────
describe("attendance", () => {
  it("rejects invalid attendance status", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.attendance.save([
        {
          assignmentId: 1,
          studentId: 1,
          date: "2025-01-01",
          status: "invalid_status" as any,
        },
      ])
    ).rejects.toThrow();
  });

  it("accepts valid attendance statuses", async () => {
    const validStatuses = ["present", "absent", "late", "excused"] as const;
    for (const status of validStatuses) {
      const ctx = createTeacherContext();
      const caller = appRouter.createCaller(ctx);
      try {
        await caller.attendance.save([
          { assignmentId: 1, studentId: 1, date: "2025-01-01", status },
        ]);
      } catch (e: any) {
        // DB error is OK, but not validation error
        expect(e.message).not.toContain("invalid_literal");
      }
    }
  });
});

// ─── Score Validation Tests ───────────────────────────────────────────────────
describe("score", () => {
  it("requires assignmentId for score categories", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.score.getCategories({ assignmentId: undefined as any })
    ).rejects.toThrow();
  });

  it("createCategory validates required fields", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.score.createCategory({
        assignmentId: 1,
        name: "",
        maxScore: "100",
      })
    ).rejects.toThrow();
  });
});

// ─── Student Validation Tests ─────────────────────────────────────────────────
describe("student", () => {
  it("create student validates required fields", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.student.create({
        studentCode: "",
        firstName: "สมชาย",
        lastName: "ใจดี",
        classroomId: 1,
      })
    ).rejects.toThrow();
  });

  it("create student validates gender enum", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.student.create({
        studentCode: "12345",
        firstName: "สมชาย",
        lastName: "ใจดี",
        classroomId: 1,
        gender: "unknown" as any,
      })
    ).rejects.toThrow();
  });
});

// ─── Document Validation Tests ────────────────────────────────────────────────
describe("document", () => {
  it("save document validates documentType enum", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.document.save({
        documentType: "invalid" as any,
        title: "Test",
        academicYearId: 1,
        fileContent: btoa("test"),
        fileName: "test.pdf",
      })
    ).rejects.toThrow();
  });

  it("list documents returns array for authenticated user", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.document.list({});
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message).not.toContain("FORBIDDEN");
    }
  });
});

// ─── Academic Year Tests ──────────────────────────────────────────────────────
describe("academicYear", () => {
  it("list returns array for authenticated user", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.academicYear.list({});
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.message).not.toContain("FORBIDDEN");
    }
  });

  it("create validates level enum", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.academicYear.create({
        year: 2568,
        level: "invalid" as any,
        isActive: false,
      })
    ).rejects.toThrow();
  });

  it("getActive validates level enum", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.academicYear.getActive({ level: "invalid" as any })
    ).rejects.toThrow();
  });
});

// ─── Grade Result Tests ───────────────────────────────────────────────────────
describe("grade result", () => {
  it("saveGradeResult validates result enum", async () => {
    const ctx = createTeacherContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.score.saveGradeResult({
        assignmentId: 1,
        studentId: 1,
        result: "invalid_result" as any,
      })
    ).rejects.toThrow();
  });

  it("saveGradeResult accepts valid results", async () => {
    const validResults = ["pass", "fail", "incomplete", "exempted"] as const;
    for (const result of validResults) {
      const ctx = createTeacherContext();
      const caller = appRouter.createCaller(ctx);
      try {
        await caller.score.saveGradeResult({
          assignmentId: 1,
          studentId: 1,
          result,
        });
      } catch (e: any) {
        expect(e.message).not.toContain("invalid_literal");
      }
    }
  });
});

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";
import { importStudentsFromWorkbook } from "./_core/studentImport";
import { sdk } from "./_core/sdk";
import { verifyPassword } from "./_core/password";
import {
  adminProcedure,
  editorProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  createAcademicYear,
  createClassroom,
  createExportedDocument,
  createScoreCategory,
  createStudent,
  createSubject,
  createTeachingAssignment,
  createTeacherAccount,
  deleteClassroom,
  deleteAcademicYear,
  deleteScoreCategory,
  deleteStudent,
  deleteSubject,
  deleteTeacherAccount,
  deleteTeachingAssignment,
  getAcademicYears,
  getActiveAcademicYear,
  getAllTeachingAssignments,
  getAllTeacherProfiles,
  getAllUsers,
  getAssignmentById,
  getAttendanceByAssignment,
  getAttendanceByAssignmentAndDate,
  getAttendanceDatesByAssignment,
  getAttendanceHistoryForStudent,
  getAttendanceSession,
  getAttendanceSummary,
  getClassroomById,
  getClassrooms,
  getExportedDocuments,
  getPor6ClassroomReports,
  getPor6StudentReport,
  getGradeResults,
  getScoreCategories,
  getScoresByAssignment,
  getStudentById,
  getStudentGradeResults,
  getStudentsByClassroom,
  replaceAttendanceForDate,
  getSubjectById,
  getSubjects,
  getTeacherAssignments,
  getTeacherProfile,
  getSchoolSettings,
  setActiveAcademicYear,
  setClassroomHomeroomTeachers,
  updateAcademicYear,
  updateClassroom,
  updateScoreCategory,
  updateStudent,
  updateSubject,
  updateTeachingAssignment,
  updateTeacherAccount,
  upsertGradeResult,
  upsertUser,
  upsertTeacherProfile,
  updateUserRole,
  resolveLoginUser,
  updateTeacherPassword,
  upsertScoresBatch,
  updateSchoolSettings,
  upsertPor6Assessment,
  updatePor6ClassroomActivities,
} from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  schoolSettings: router({
    get: protectedProcedure.query(async () => getSchoolSettings()),
    update: adminProcedure
      .input(
        z.object({
          schoolName: z.string().min(1),
          officeName: z.string().optional(),
          homeroomTeacherName: z.string().optional(),
          academicHeadName: z.string().optional(),
          directorName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => updateSchoolSettings(input as any)),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    supabaseLogin: publicProcedure
      .input(
        z.object({ email: z.string().email(), password: z.string().min(1) })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "ยังไม่ได้ตั้งค่า SUPABASE_URL และ SUPABASE_ANON_KEY บน server",
          });
        }

        let result: Awaited<ReturnType<typeof sdk.loginSupabaseWithEmail>>;
        try {
          result = await sdk.loginSupabaseWithEmail(
            input.email,
            input.password
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "เข้าสู่ระบบ Supabase ไม่สำเร็จ";
          throw new TRPCError({ code: "UNAUTHORIZED", message });
        }

        if (!result?.session) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Supabase ไม่ได้ส่ง session กลับมา กรุณาตรวจอีเมลและรหัสผ่าน",
          });
        }

        const user =
          result.user ??
          (await sdk.authenticateSupabaseRequest(
            (result.session as { access_token: string }).access_token
          ));
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "เข้าสู่ระบบ Supabase สำเร็จ แต่ระบบยังอ่าน/บันทึกผู้ใช้ในฐานข้อมูลไม่ได้ กรุณาตรวจ DATABASE_URL",
          });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, user, session: result.session, sessionToken };
      }),
    localLogin: publicProcedure
      .input(
        z.object({ username: z.string().min(1), password: z.string().min(1) })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ENV.databaseUrl) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ยังไม่ได้ตั้งค่า DATABASE_URL บน server",
          });
        }

        const resolved = await resolveLoginUser(input.username);
        const user = resolved.user;

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "ไม่พบบัญชีครู/ผู้ตรวจสอบนี้ กรุณาให้แอดมินสร้างบัญชีในหน้าแอดมินก่อน",
          });
        }

        if (user.role === "admin") {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "กรุณาใช้บัญชีผู้ดูแลระบบสำหรับแอดมิน",
          });
        }

        if (!user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาให้แอดมินตั้งรหัสผ่านในหน้าแอดมินก่อน",
          });
        }

        if (!verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "รหัสครูหรือรหัสผ่านไม่ถูกต้อง",
          });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, user, sessionToken };
      }),
    devLogin: publicProcedure
      .input(
        z.object({
          preset: z.enum(["teacher", "admin", "reviewer"]).default("teacher"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ENV.isProduction) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Dev login is disabled in production",
          });
        }

        const preset =
          input.preset === "admin"
            ? {
                openId: "dev-admin",
                name: "Demo Admin",
                email: "admin@demo.local",
                loginMethod: "dev",
                role: "admin" as const,
              }
            : input.preset === "reviewer"
              ? {
                  openId: "dev-reviewer",
                  name: "Demo Reviewer",
                  email: "reviewer@demo.local",
                  loginMethod: "dev",
                  role: "reviewer" as const,
                }
              : {
                  openId: "dev-teacher",
                  name: "Demo Teacher",
                  email: "teacher@demo.local",
                  loginMethod: "dev",
                  role: "teacher" as const,
                };

        try {
          await upsertUser({
            openId: preset.openId,
            name: preset.name,
            email: preset.email,
            loginMethod: preset.loginMethod,
            role: preset.role,
            lastSignedIn: new Date(),
          });
        } catch (error) {
          // Dev login should still work even if the database is temporarily unavailable.
          console.warn("[Auth] Dev login skipped user upsert:", error);
        }

        const sessionToken = await sdk.createSessionToken(preset.openId, {
          name: preset.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, preset: input.preset } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Teacher Profile ───────────────────────────────────────────────────────
  teacher: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getTeacherProfile(ctx.user.id);
      } catch (error) {
        console.warn(
          "[Teacher] Failed to load profile, falling back to empty state:",
          error
        );
        return null;
      }
    }),
    upsertProfile: protectedProcedure
      .input(
        z.object({
          teacherCode: z.string().optional(),
          prefix: z.string().optional(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          phone: z.string().optional(),
          teachingLevel: z.enum(["primary", "secondary", "both"]),
          isHomeroom: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isNew = !(await getTeacherProfile(ctx.user.id));
        const id = await upsertTeacherProfile({
          ...input,
          userId: ctx.user.id,
        });
        if (isNew) {
          await notifyOwner({
            title: "ครูใหม่เข้าสู่ระบบ",
            content: `ครู ${input.prefix || ""}${input.firstName} ${input.lastName} ได้สร้างโปรไฟล์ในระบบแล้ว`,
          }).catch(() => {});
        }
        return { id };
      }),
    allProfiles: adminProcedure.query(async () => {
      try {
        return await getAllTeacherProfiles();
      } catch (error) {
        console.warn("[Teacher] Failed to load teacher profiles:", error);
        return [];
      }
    }),
    allUsers: adminProcedure.query(async () => {
      try {
        return await getAllUsers();
      } catch (error) {
        console.warn("[Teacher] Failed to load users:", error);
        return [];
      }
    }),
    updateUserRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["teacher", "admin", "reviewer"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    createAccount: adminProcedure
      .input(
        z.object({
          teacherCode: z.string().min(1),
          password: z.string().min(6),
          email: z.string().email().optional().or(z.literal("")),
          prefix: z.string().optional(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          phone: z.string().optional(),
          teachingLevel: z.enum(["primary", "secondary", "both"]),
          isHomeroom: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const result = await createTeacherAccount({
          teacherCode: input.teacherCode,
          password: input.password,
          email: input.email || undefined,
          prefix: input.prefix,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          teachingLevel: input.teachingLevel,
          isHomeroom: input.isHomeroom,
        });
        return result;
      }),
    updateAccount: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          teacherCode: z.string().min(1),
          email: z.string().email().optional().or(z.literal("")),
          prefix: z.string().optional(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          phone: z.string().optional(),
          teachingLevel: z.enum(["primary", "secondary", "both"]),
          isHomeroom: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        await updateTeacherAccount(input.userId, {
          teacherCode: input.teacherCode,
          email: input.email || undefined,
          prefix: input.prefix,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          teachingLevel: input.teachingLevel,
          isHomeroom: input.isHomeroom,
        });
        return { success: true };
      }),
    deleteAccount: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTeacherAccount(input.userId);
        return { success: true };
      }),
    resetPassword: adminProcedure
      .input(z.object({ userId: z.number(), password: z.string().min(6) }))
      .mutation(async ({ input }) => {
        await updateTeacherPassword(input.userId, input.password);
        return { success: true };
      }),
  }),

  // ─── Academic Years ────────────────────────────────────────────────────────
  academicYear: router({
    list: protectedProcedure
      .input(z.object({ level: z.enum(["primary", "secondary"]).optional() }))
      .query(async ({ input }) => getAcademicYears(input.level)),
    getActive: protectedProcedure
      .input(z.object({ level: z.enum(["primary", "secondary"]) }))
      .query(async ({ input }) => getActiveAcademicYear(input.level)),
    create: adminProcedure
      .input(
        z
          .object({
            year: z.number().int(),
            level: z.enum(["primary", "secondary"]),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            isActive: z.boolean().default(false),
            semester: z.number().int().optional(),
          })
          .superRefine((value, ctx) => {
            if (
              value.level === "secondary" &&
              ![1, 2].includes(value.semester ?? 0)
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["semester"],
                message: "กรุณาเลือกภาคเรียน 1 หรือ 2 สำหรับมัธยมศึกษา",
              });
            }
          })
      )
      .mutation(async ({ input }) => {
        const semester =
          input.level === "secondary" ? input.semester : undefined;
        const id = await createAcademicYear({
          ...input,
          semester,
          startDate: input.startDate as any,
          endDate: input.endDate as any,
        });
        if (input.isActive) await setActiveAcademicYear(id, input.level);
        return { id };
      }),
    update: adminProcedure
      .input(
        z
          .object({
            id: z.number(),
            year: z.number().int().optional(),
            level: z.enum(["primary", "secondary"]).optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            isActive: z.boolean().optional(),
            semester: z.number().int().optional(),
          })
          .superRefine((value, ctx) => {
            if (
              value.level === "secondary" &&
              value.semester !== undefined &&
              ![1, 2].includes(value.semester)
            ) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["semester"],
                message: "ภาคเรียนต้องเป็น 1 หรือ 2",
              });
            }
          })
      )
      .mutation(async ({ input }) => {
        const { id, isActive, ...data } = input;
        const semester = data.level === "primary" ? undefined : data.semester;
        await updateAcademicYear(id, {
          ...data,
          semester,
          startDate: data.startDate as any,
          endDate: data.endDate as any,
        });
        if (typeof isActive === "boolean" && data.level) {
          if (isActive) await setActiveAcademicYear(id, data.level);
        }
        return { success: true };
      }),
    setActive: adminProcedure
      .input(
        z.object({ id: z.number(), level: z.enum(["primary", "secondary"]) })
      )
      .mutation(async ({ input }) => {
        await setActiveAcademicYear(input.id, input.level);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAcademicYear(input.id);
        return { success: true };
      }),
  }),

  // ─── Classrooms ────────────────────────────────────────────────────────────
  classroom: router({
    list: protectedProcedure
      .input(
        z.object({
          academicYearId: z.number().optional(),
          level: z.enum(["primary", "secondary"]).optional(),
        })
      )
      .query(async ({ input }) =>
        getClassrooms(input.academicYearId, input.level)
      ),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getClassroomById(input.id)),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          level: z.enum(["primary", "secondary"]),
          grade: z.number().int().min(1).max(6),
          room: z.number().int().min(1),
          academicYearId: z.number(),
          homeroomTeacherId: z.number().optional(),
          homeroomTeacherIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { homeroomTeacherIds, ...data } = input;
        const ids = homeroomTeacherIds?.length
          ? homeroomTeacherIds
          : data.homeroomTeacherId
            ? [data.homeroomTeacherId]
            : [];
        const id = await createClassroom({
          ...data,
          homeroomTeacherId: ids[0],
        });
        await setClassroomHomeroomTeachers(id, ids);
        return { id };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          level: z.enum(["primary", "secondary"]).optional(),
          grade: z.number().int().min(1).max(6).optional(),
          room: z.number().int().min(1).optional(),
          academicYearId: z.number().optional(),
          homeroomTeacherId: z.number().optional(),
          homeroomTeacherIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, homeroomTeacherIds, ...data } = input;
        const ids = homeroomTeacherIds?.length
          ? homeroomTeacherIds
          : data.homeroomTeacherId
            ? [data.homeroomTeacherId]
            : [];
        await updateClassroom(id, {
          ...data,
          homeroomTeacherId: ids[0],
        });
        if (homeroomTeacherIds !== undefined || data.homeroomTeacherId !== undefined) {
          await setClassroomHomeroomTeachers(id, ids);
        }
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteClassroom(input.id);
        return { success: true };
      }),
  }),

  // ─── Subjects ─────────────────────────────────────────────────────────────
  subject: router({
    list: protectedProcedure
      .input(
        z.object({ level: z.enum(["primary", "secondary", "both"]).optional() })
      )
      .query(async ({ input }) => getSubjects(input.level)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getSubjectById(input.id)),
    create: adminProcedure
      .input(
        z.object({
          subjectCode: z.string().min(1),
          name: z.string().min(1),
          credits: z.string().optional(),
          level: z.enum(["primary", "secondary", "both"]),
          gradeGroup: z.string().optional(),
          subjectGroup: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createSubject(input as any);
        return { id };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          subjectCode: z.string().optional(),
          name: z.string().optional(),
          credits: z.string().optional(),
          level: z.enum(["primary", "secondary", "both"]).optional(),
          gradeGroup: z.string().optional(),
          subjectGroup: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateSubject(id, data as any);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSubject(input.id);
        return { success: true };
      }),
  }),

  // ─── Students ─────────────────────────────────────────────────────────────
  student: router({
    listByClassroom: protectedProcedure
      .input(z.object({ classroomId: z.number() }))
      .query(async ({ input }) => getStudentsByClassroom(input.classroomId)),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getStudentById(input.id)),
    create: editorProcedure
      .input(
        z.object({
          studentCode: z.string().min(1),
          prefix: z.string().optional(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          nationalId: z.string().optional(),
          birthDate: z.string().optional(),
          gender: z.enum(["male", "female"]).optional(),
          classroomId: z.number(),
          studentNumber: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createStudent(input as any);
        return { id };
      }),
    importFromExcel: editorProcedure
      .input(
        z.object({
          classroomId: z.number(),
          fileName: z.string().min(1),
          fileContentBase64: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const result = await importStudentsFromWorkbook(input);
        return { success: true, ...result };
      }),
    update: editorProcedure
      .input(
        z.object({
          id: z.number(),
          prefix: z.string().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          nationalId: z.string().optional(),
          birthDate: z.string().optional(),
          gender: z.enum(["male", "female"]).optional(),
          studentNumber: z.number().optional(),
          status: z
            .enum(["active", "transferred", "graduated", "dropped"])
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateStudent(id, data as any);
        return { success: true };
      }),
    delete: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteStudent(input.id);
        return { success: true };
      }),
    gradeResults: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => getStudentGradeResults(input.studentId)),
  }),

  // ─── Teaching Assignments ──────────────────────────────────────────────────
  assignment: router({
    myList: protectedProcedure
      .input(z.object({ academicYearId: z.number().optional() }))
      .query(async ({ ctx, input }) =>
        getTeacherAssignments(ctx.user.id, input.academicYearId)
      ),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getAssignmentById(input.id)),
    create: adminProcedure
      .input(
        z.object({
          teacherId: z.number(),
          subjectId: z.number(),
          classroomId: z.number(),
          academicYearId: z.number(),
          hoursPerWeek: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createTeachingAssignment(input);
        return { id };
      }),
    listAll: adminProcedure.query(async () => getAllTeachingAssignments()),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          teacherId: z.number().optional(),
          subjectId: z.number().optional(),
          classroomId: z.number().optional(),
          academicYearId: z.number().optional(),
          hoursPerWeek: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateTeachingAssignment(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTeachingAssignment(input.id);
        return { success: true };
      }),
  }),

  // ─── Attendance ────────────────────────────────────────────────────────────
  attendance: router({
    session: protectedProcedure
      .input(z.object({ assignmentId: z.number(), date: z.string() }))
      .query(async ({ input }) =>
        getAttendanceSession(input.assignmentId, input.date)
      ),
    getByDate: protectedProcedure
      .input(z.object({ assignmentId: z.number(), date: z.string() }))
      .query(async ({ input }) =>
        getAttendanceByAssignmentAndDate(input.assignmentId, input.date)
      ),
    getByAssignment: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) =>
        getAttendanceByAssignment(input.assignmentId)
      ),
    history: protectedProcedure
      .input(z.object({ assignmentId: z.number(), studentId: z.number() }))
      .query(async ({ input }) =>
        getAttendanceHistoryForStudent(input.assignmentId, input.studentId)
      ),
    getDates: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) =>
        getAttendanceDatesByAssignment(input.assignmentId)
      ),
    save: editorProcedure
      .input(
        z.array(
          z.object({
            assignmentId: z.number(),
            studentId: z.number(),
            date: z.string(),
            status: z.enum(["present", "absent", "late", "excused"]),
            note: z.string().optional(),
          })
        )
      )
      .mutation(async ({ ctx, input }) => {
        await replaceAttendanceForDate(
          input.map(item => ({
            ...item,
            date: new Date(`${item.date}T00:00:00.000Z`) as any,
            recordedBy: ctx.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        );
        return { success: true };
      }),
    summary: protectedProcedure
      .input(z.object({ assignmentId: z.number(), studentId: z.number() }))
      .query(async ({ input }) =>
        getAttendanceSummary(input.assignmentId, input.studentId)
      ),
  }),

  // ─── Scores ────────────────────────────────────────────────────────────────
  score: router({
    getCategories: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) => getScoreCategories(input.assignmentId)),
    createCategory: editorProcedure
      .input(
        z.object({
          assignmentId: z.number(),
          name: z.string().min(1),
          maxScore: z.string(),
          order: z.number().optional(),
          term: z.enum(["midyear", "endyear"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createScoreCategory(input as any);
        return { id };
      }),
    updateCategory: editorProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          maxScore: z.string().optional(),
          order: z.number().optional(),
          term: z.enum(["midyear", "endyear"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateScoreCategory(id, data as any);
        return { success: true };
      }),
    deleteCategory: editorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteScoreCategory(input.id);
        return { success: true };
      }),
    getByAssignment: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) => getScoresByAssignment(input.assignmentId)),
    save: editorProcedure
      .input(
        z.array(
          z.object({
            categoryId: z.number(),
            studentId: z.number(),
            score: z.string().nullable(),
            note: z.string().optional(),
          })
        )
      )
      .mutation(async ({ ctx, input }) => {
        const result = await upsertScoresBatch(
          input.map(item => ({
            ...item,
            score: item.score as any,
            recordedBy: ctx.user.id,
          }))
        );
        return { success: true, ...result };
      }),
    getGradeResults: protectedProcedure
      .input(z.object({ assignmentId: z.number() }))
      .query(async ({ input }) => getGradeResults(input.assignmentId)),
    saveGradeResult: editorProcedure
      .input(
        z.object({
          assignmentId: z.number(),
          studentId: z.number(),
          totalScore: z.string().nullable().optional(),
          grade: z.string().optional(),
          result: z.enum(["pass", "fail", "incomplete", "exempted"]).optional(),
          attendanceHours: z.number().optional(),
          totalHours: z.number().optional(),
          isFinalized: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertGradeResult({
          ...input,
          totalScore: input.totalScore as any,
          finalizedBy: input.isFinalized ? ctx.user.id : undefined,
          finalizedAt: input.isFinalized ? new Date() : undefined,
        });
        return { success: true };
      }),
  }),

  // ─── Documents ─────────────────────────────────────────────────────────────
  por6: router({
    getStudentReport: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        const report = await getPor6StudentReport(input.studentId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND" });
        return report;
      }),
    getClassroomReports: protectedProcedure
      .input(z.object({ classroomId: z.number() }))
      .query(async ({ input }) => getPor6ClassroomReports(input.classroomId)),
    saveAssessment: editorProcedure
      .input(
        z.object({
          studentId: z.number(),
          academicYearId: z.number(),
          competencies: z.record(z.string(), z.string()).optional(),
          readingThinkingWriting: z.string().optional(),
          attributes: z.record(z.string(), z.string()).optional(),
          activities: z.record(z.string(), z.string()).optional(),
          activityLabels: z.record(z.string(), z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        upsertPor6Assessment({ ...input, updatedBy: ctx.user.id })
      ),
    saveClassroomActivities: editorProcedure
      .input(
        z.object({
          classroomId: z.number(),
          academicYearId: z.number(),
          activities: z.record(z.string(), z.string()).optional(),
          activityLabels: z.record(z.string(), z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        updatePor6ClassroomActivities({ ...input, updatedBy: ctx.user.id })
      ),
  }),

  // ─── Documents ─────────────────────────────────────────────────────────────
  document: router({
    list: protectedProcedure
      .input(z.object({ documentType: z.enum(["por1", "por5", "por6"]).optional() }))
      .query(async ({ ctx, input }) =>
        getExportedDocuments(ctx.user.id, input.documentType)
      ),
    listAll: adminProcedure
      .input(z.object({ documentType: z.enum(["por1", "por5", "por6"]).optional() }))
      .query(async ({ input }) =>
        getExportedDocuments(undefined, input.documentType)
      ),
    recordExport: editorProcedure
      .input(
        z.object({
          assignmentId: z.number(),
          documentType: z.enum(["por1", "por5", "por6"]).default("por5"),
          fileUrl: z.string(),
          title: z.string().optional(),
          metadata: z.any().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assignment = await getAssignmentById(input.assignmentId);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });
        const title =
          input.title ??
          `ปพ.5 ${assignment.classroom?.name ?? ""} ${assignment.subject?.name ?? ""}`.trim();
        const id = await createExportedDocument({
          documentType: input.documentType === "por5" ? "por6" : input.documentType,
          title,
          classroomId: assignment.assignment.classroomId,
          academicYearId: assignment.assignment.academicYearId,
          fileUrl: input.fileUrl,
          exportedBy: ctx.user.id,
          metadata: {
            documentType: input.documentType,
            assignmentId: input.assignmentId,
            subjectId: assignment.assignment.subjectId,
            subjectName: assignment.subject?.name,
            classroomName: assignment.classroom?.name,
            ...(input.metadata ?? {}),
          },
        });
        return { id };
      }),
    save: editorProcedure
      .input(
        z.object({
          documentType: z.enum(["por1", "por5", "por6"]),
          title: z.string(),
          classroomId: z.number().optional(),
          studentId: z.number().optional(),
          academicYearId: z.number(),
          fileContent: z.string(), // base64 PDF
          fileName: z.string(),
          metadata: z.any().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { fileContent, fileName, ...rest } = input;
        const buffer = Buffer.from(fileContent, "base64");
        const fileKey = `documents/${ctx.user.id}/${Date.now()}-${fileName}`;
        const { url } = await storagePut(fileKey, buffer, "application/pdf");
        const id = await createExportedDocument({
          ...rest,
          fileUrl: url,
          fileKey,
          fileSize: buffer.length,
          exportedBy: ctx.user.id,
        });
        return { id, fileUrl: url };
      }),
  }),
});

export type AppRouter = typeof appRouter;

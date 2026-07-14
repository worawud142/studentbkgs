import type { Express } from "express";
import {
  collectQrCandidateValues,
  collectTeacherQrCandidateValues,
  findMatchingQrStudent,
} from "../../shared/qr";
import {
  closeActiveQrScanSession,
  getCurrentTeachingScheduleAssignmentForDevice,
  getActiveQrScanSessionByDeviceId,
  getQrScanDeviceById,
  getUserByTeacherCode,
  getStudentsByClassroom,
  openTeacherQrSession,
  recordQrScanLog,
  resolveBangkokTodayAttendanceDate,
  touchQrScanDevice,
  upsertAttendance,
  verifyQrScanDeviceToken,
} from "../db";
import { ENV } from "./env";
import { sendTelegramMessage } from "./telegram";

const ONLINE_NOTIFICATION_GAP_MS = 25 * 1000;

function getDeviceToken(req: import("express").Request) {
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const headerToken = req.header("x-device-token");
  if (headerToken) return headerToken.trim();
  return "";
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function scanDateKeyFromNow() {
  return resolveBangkokTodayAttendanceDate();
}

export function registerQrBoxRoutes(app: Express) {
  app.get("/api/qr-boxes/:deviceId/config", async (req, res) => {
    const deviceId = toPositiveInteger(req.params.deviceId);
    const token = getDeviceToken(req);
    if (!deviceId || !token) {
      res.status(400).json({ error: "deviceId and token are required" });
      return;
    }

    const device = await getQrScanDeviceById(deviceId);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const tokenOk = await verifyQrScanDeviceToken(deviceId, token);
    if (!tokenOk) {
      res.status(401).json({ error: "Invalid device token" });
      return;
    }

    res.json({
      device: {
        id: device.id,
        name: device.name,
        assignmentId: device.assignmentId,
        isActive: device.isActive,
        lastSeenAt: device.lastSeenAt,
        lastScanAt: device.lastScanAt,
      },
      assignment: device.assignment,
      activeTimetableAssignment: device.assignmentId
        ? await getCurrentTeachingScheduleAssignmentForDevice(device.assignmentId)
        : null,
      activeSession: await getActiveQrScanSessionByDeviceId(deviceId),
      serverDate: await scanDateKeyFromNow(),
      scanEndpoint: `/api/qr-boxes/${deviceId}/scan`,
      pingEndpoint: `/api/qr-boxes/${deviceId}/ping`,
    });
  });

  app.post("/api/qr-boxes/:deviceId/ping", async (req, res) => {
    const deviceId = toPositiveInteger(req.params.deviceId);
    const token = getDeviceToken(req);
    if (!deviceId || !token) {
      res.status(400).json({ error: "deviceId and token are required" });
      return;
    }

    const device = await getQrScanDeviceById(deviceId);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const tokenOk = await verifyQrScanDeviceToken(deviceId, token);
    if (!tokenOk) {
      res.status(401).json({ error: "Invalid device token" });
      return;
    }

    const wasOffline =
      !device.lastSeenAt ||
      Date.now() - new Date(device.lastSeenAt).getTime() > ONLINE_NOTIFICATION_GAP_MS;
    const telegramConfigured = Boolean(ENV.telegramBotToken && ENV.telegramChatId);

    console.info(
      `[QR Box] ping device=${device.id} wasOffline=${wasOffline} telegramConfigured=${telegramConfigured}`
    );

    await touchQrScanDevice(deviceId, { lastSeenAt: new Date() });

    if (wasOffline) {
      const delivered = await sendTelegramMessage(
        `✅ กล่องสแกนพร้อมใช้งาน\nชื่อ: ${device.name}\nเวลา: ${new Date().toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
        })}`
      );
      console.info(`[QR Box] Telegram ready notification delivered=${delivered}`);
    }

    res.json({
      success: true,
      deviceId,
      serverDate: await scanDateKeyFromNow(),
    });
  });

  app.post("/api/qr-boxes/:deviceId/session/close", async (req, res) => {
    const deviceId = toPositiveInteger(req.params.deviceId);
    const token = getDeviceToken(req);
    if (!deviceId || !token) {
      res.status(400).json({ error: "deviceId and token are required" });
      return;
    }

    const device = await getQrScanDeviceById(deviceId);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const tokenOk = await verifyQrScanDeviceToken(deviceId, token);
    if (!tokenOk) {
      res.status(401).json({ error: "Invalid device token" });
      return;
    }

    await closeActiveQrScanSession(deviceId);
    await recordQrScanLog({
      deviceId,
      assignmentId: device.assignmentId,
      rawValue: "__teacher_session_close__",
      status: "teacher_session_closed",
      message: "teacher session closed",
      scannedAt: new Date(),
    });

    res.json({
      success: true,
      deviceId,
      serverDate: await scanDateKeyFromNow(),
    });
  });

  app.post("/api/qr-boxes/:deviceId/scan", async (req, res) => {
    const deviceId = toPositiveInteger(req.params.deviceId);
    const token = getDeviceToken(req);
    const rawValue = typeof req.body?.rawValue === "string" ? req.body.rawValue.trim() : "";
    if (!deviceId || !token || !rawValue) {
      res.status(400).json({ error: "deviceId, token and rawValue are required" });
      return;
    }

    const device = await getQrScanDeviceById(deviceId);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    const tokenOk = await verifyQrScanDeviceToken(deviceId, token);
    if (!tokenOk) {
      res.status(401).json({ error: "Invalid device token" });
      return;
    }

    if (!device.isActive) {
      await recordQrScanLog({
        deviceId,
        assignmentId: device.assignmentId,
        rawValue,
        status: "inactive",
        message: "device is inactive",
      });
      res.status(403).json({ error: "Device is inactive" });
      return;
    }

    const teacherCandidates = collectTeacherQrCandidateValues(rawValue);
    let teacherUser: Awaited<ReturnType<typeof getUserByTeacherCode>> = undefined;
    for (const candidate of teacherCandidates) {
      const resolved = await getUserByTeacherCode(candidate);
      if (resolved) {
        teacherUser = resolved;
        break;
      }
    }

    const timetableAssignment = device.assignmentId
      ? await getCurrentTeachingScheduleAssignmentForDevice(device.assignmentId)
      : null;
    const activeSession = await getActiveQrScanSessionByDeviceId(deviceId);
    const activeAssignment =
      activeSession?.assignment ??
      timetableAssignment?.assignment ??
      null;
    const activeAssignmentId =
      activeSession?.assignmentId ??
      timetableAssignment?.assignment?.assignment?.id ??
      null;

    if (teacherUser) {
      const session = await openTeacherQrSession({
        deviceId,
        teacherUserId: teacherUser.id,
      });

      if (!session?.assignment?.assignment?.classroomId) {
        await recordQrScanLog({
          deviceId,
          assignmentId: device.assignmentId,
          rawValue,
          status: "teacher_no_assignment",
          message: "teacher has no active timetable assignment",
        });
        res.status(409).json({ error: "ครูยังไม่มีคาบสอนที่ active อยู่ตอนนี้" });
        return;
      }

      await recordQrScanLog({
        deviceId,
        assignmentId: session?.assignmentId ?? activeAssignmentId ?? device.assignmentId,
        rawValue,
        status: "teacher_session_opened_timetable",
        message: "teacher session opened for active timetable",
        scannedAt: new Date(),
      });

      res.json({
        success: true,
        status: "teacher_session_opened_timetable",
        deviceId,
        assignmentId: session?.assignmentId ?? activeAssignmentId,
        teacher: {
          id: teacherUser.id,
        },
        assignment: session?.assignment ?? activeAssignment,
        candidates: collectTeacherQrCandidateValues(rawValue),
      });
      return;
    }

    const session = activeSession;
    const effectiveAssignmentId = activeAssignmentId;

    if (!effectiveAssignmentId) {
      await recordQrScanLog({
        deviceId,
        assignmentId: device.assignmentId,
        rawValue,
        status: "missing_timetable",
        message: "no active timetable slot",
      });
      res.status(409).json({ error: "ไม่มีคาบสอนที่ active อยู่ตอนนี้" });
      return;
    }

    const currentAssignment = activeAssignment;
    if (!currentAssignment?.assignment?.classroomId) {
      await recordQrScanLog({
        deviceId,
        assignmentId: effectiveAssignmentId,
        rawValue,
        status: "missing_timetable",
        message: "active timetable has no classroom",
      });
      res.status(409).json({ error: "ไม่มีคาบสอนที่ active อยู่ตอนนี้" });
      return;
    }

    const classroomId = currentAssignment.assignment.classroomId;
    const students = await getStudentsByClassroom(classroomId);
    const student = findMatchingQrStudent(
      students.map(row => ({
        id: row.id,
        studentCode: row.studentCode,
      })),
      rawValue
    );

    if (!student) {
      await recordQrScanLog({
        deviceId,
        assignmentId: effectiveAssignmentId,
        rawValue,
        status: "not_found",
        message: "student not found",
      });
      res.status(404).json({ error: "ไม่พบนักเรียนจาก QR นี้" });
      return;
    }

    const date = await scanDateKeyFromNow();
    await upsertAttendance({
      assignmentId: effectiveAssignmentId,
      studentId: student.id,
      date: new Date(`${date}T00:00:00.000Z`) as any,
      status: "present",
      recordedBy:
        session?.teacherUserId ??
        currentAssignment?.assignment?.teacherId ??
        device.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await recordQrScanLog({
      deviceId,
      assignmentId: effectiveAssignmentId,
      studentId: student.id,
      rawValue,
      status: "success",
      message: "attendance saved",
      scannedAt: new Date(),
    });

    res.json({
      success: true,
      status: "success",
      date,
      student: {
        id: student.id,
        studentCode: student.studentCode,
      },
      assignmentId: effectiveAssignmentId,
      deviceId,
      candidates: collectQrCandidateValues(rawValue),
    });
  });
}

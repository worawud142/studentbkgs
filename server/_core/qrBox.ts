import type { Express } from "express";
import { collectQrCandidateValues, findMatchingQrStudent } from "../../shared/qr";
import {
  getQrScanDeviceById,
  getStudentsByClassroom,
  recordQrScanLog,
  resolveBangkokTodayAttendanceDate,
  upsertAttendance,
  verifyQrScanDeviceToken,
} from "../db";

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

    await recordQrScanLog({
      deviceId,
      assignmentId: device.assignmentId,
      rawValue: "__ping__",
      status: "ping",
      message: "device heartbeat",
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

    if (!device.assignment?.assignment?.classroomId) {
      await recordQrScanLog({
        deviceId,
        assignmentId: device.assignmentId,
        rawValue,
        status: "missing_assignment",
        message: "device has no classroom assignment",
      });
      res.status(409).json({ error: "Device has no assignment" });
      return;
    }

    const classroomId = device.assignment.assignment.classroomId;
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
        assignmentId: device.assignmentId,
        rawValue,
        status: "not_found",
        message: "student not found",
      });
      res.status(404).json({ error: "ไม่พบนักเรียนจาก QR นี้" });
      return;
    }

    const date = await scanDateKeyFromNow();
    await upsertAttendance({
      assignmentId: device.assignmentId,
      studentId: student.id,
      date: new Date(`${date}T00:00:00.000Z`) as any,
      status: "present",
      recordedBy: device.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await recordQrScanLog({
      deviceId,
      assignmentId: device.assignmentId,
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
      assignmentId: device.assignmentId,
      deviceId,
      candidates: collectQrCandidateValues(rawValue),
    });
  });
}

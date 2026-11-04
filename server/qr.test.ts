import { describe, expect, it } from "vitest";
import {
  collectQrCandidateValues,
  collectTeacherQrCandidateValues,
  findMatchingQrStudent,
  selectQrAttendanceAssignment,
} from "../shared/qr";

describe("qr helper", () => {
  it("collects plain text, json, and url candidates", () => {
    expect(collectQrCandidateValues("1234")).toEqual(["1234"]);
    expect(
      collectQrCandidateValues(
        JSON.stringify({ studentId: 7, studentCode: "A001" })
      )
    ).toEqual(expect.arrayContaining(["7", "A001"]));
    expect(
      collectQrCandidateValues("https://example.com/?studentCode=B009")
    ).toEqual(
      expect.arrayContaining(["https://example.com/?studentCode=B009", "B009"])
    );
  });

  it("collects teacher QR candidates", () => {
    expect(
      collectTeacherQrCandidateValues(
        JSON.stringify({ type: "teacher-session", teacherCode: "T001" })
      )
    ).toEqual(expect.arrayContaining(["T001"]));
    expect(collectTeacherQrCandidateValues("T002")).toEqual(["T002"]);
  });

  it("finds student by id or studentCode", () => {
    const students = [
      { id: 10, studentCode: "S-010" },
      { id: 11, studentCode: "S-011" },
    ];

    expect(findMatchingQrStudent(students, "10")).toEqual(students[0]);
    expect(findMatchingQrStudent(students, "S-011")).toEqual(students[1]);
    expect(findMatchingQrStudent(students, "unknown")).toBeNull();
  });

  it("reads legacy, nested, and scanner-decorated student QR values", () => {
    const students = [
      { id: 21, studentCode: "00123" },
      { id: 22, studentCode: "ST-022" },
    ];

    expect(findMatchingQrStudent(students, "123")).toEqual(students[0]);
    expect(
      findMatchingQrStudent(
        students,
        `\u0002${JSON.stringify({ student: { student_code: "ST-022" } })}\u0003`
      )
    ).toEqual(students[1]);
    expect(
      findMatchingQrStudent(
        students,
        "SCAN:" + JSON.stringify({ payload: { student_id: 21 } })
      )
    ).toEqual(students[0]);
  });

  it("falls back to the assignment bound to the QR box", () => {
    const deviceAssignment = { classroomId: 42 };

    expect(
      selectQrAttendanceAssignment({
        session: null,
        timetable: null,
        device: { id: 9, assignment: deviceAssignment },
      })
    ).toEqual({
      source: "device_assignment",
      id: 9,
      assignment: deviceAssignment,
    });
  });

  it("prefers a teacher session and timetable over the device fallback", () => {
    const sessionAssignment = { classroomId: 1 };
    const timetableAssignment = { classroomId: 2 };
    const deviceAssignment = { classroomId: 3 };

    expect(
      selectQrAttendanceAssignment({
        session: { id: 10, assignment: sessionAssignment },
        timetable: { id: 20, assignment: timetableAssignment },
        device: { id: 30, assignment: deviceAssignment },
      })
    ).toMatchObject({ source: "teacher_session", id: 10 });

    expect(
      selectQrAttendanceAssignment({
        timetable: { id: 20, assignment: timetableAssignment },
        device: { id: 30, assignment: deviceAssignment },
      })
    ).toMatchObject({ source: "timetable", id: 20 });
  });
});

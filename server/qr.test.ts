import { describe, expect, it } from "vitest";
import { collectQrCandidateValues, findMatchingQrStudent } from "../shared/qr";

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
      expect.arrayContaining([
        "https://example.com/?studentCode=B009",
        "B009",
      ])
    );
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
});

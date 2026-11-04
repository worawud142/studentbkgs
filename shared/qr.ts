function cleanQrValue(value: unknown) {
  return String(value ?? "")
    .replace(/^[\u0000-\u001f\u007f]+|[\u0000-\u001f\u007f]+$/g, "")
    .trim();
}

function addQrCandidate(target: Set<string>, value: unknown) {
  const cleaned = cleanQrValue(value);
  if (cleaned) target.add(cleaned);
}

function collectStudentValuesFromObject(
  target: Set<string>,
  value: unknown,
  depth = 0
) {
  if (!value || typeof value !== "object" || depth > 2) return;
  const record = value as Record<string, unknown>;
  for (const key of [
    "studentId",
    "student_id",
    "id",
    "studentCode",
    "student_code",
    "code",
  ]) {
    addQrCandidate(target, record[key]);
  }
  for (const key of ["student", "payload", "data"]) {
    collectStudentValuesFromObject(target, record[key], depth + 1);
  }
}

export function collectQrCandidateValues(rawValue: string): string[] {
  const value = cleanQrValue(rawValue);
  if (!value) return [];

  const possibleValues = new Set<string>([value]);

  try {
    const parsed = JSON.parse(value);
    collectStudentValuesFromObject(possibleValues, parsed);
  } catch {
    const jsonStart = value.indexOf("{");
    const jsonEnd = value.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        collectStudentValuesFromObject(
          possibleValues,
          JSON.parse(value.slice(jsonStart, jsonEnd + 1))
        );
      } catch {
        // Plain text and URLs are handled below.
      }
    }
  }

  try {
    const url = new URL(value);
    for (const key of [
      "studentId",
      "student_id",
      "id",
      "studentCode",
      "student_code",
      "code",
    ]) {
      const param = url.searchParams.get(key);
      addQrCandidate(possibleValues, param);
    }
  } catch {
    // Not a URL, keep the collected plain text value.
  }

  return Array.from(possibleValues);
}

export function collectTeacherQrCandidateValues(rawValue: string): string[] {
  const value = rawValue.trim();
  if (!value) return [];

  const possibleValues = new Set<string>([value]);

  try {
    const parsed = JSON.parse(value);
    if (
      parsed?.type === "teacher-session" ||
      parsed?.type === "teacher" ||
      parsed?.kind === "teacher"
    ) {
      for (const key of ["teacherCode", "code", "teacherId", "id"]) {
        if (parsed?.[key] !== undefined && parsed?.[key] !== null) {
          possibleValues.add(String(parsed[key]));
        }
      }
    }
  } catch {
    // Plain teacher codes are handled below.
  }

  try {
    const url = new URL(value);
    for (const key of ["teacherCode", "code", "teacherId", "id"]) {
      const param = url.searchParams.get(key);
      if (param) possibleValues.add(param);
    }
  } catch {
    // Not a URL, keep the collected plain text value.
  }

  return Array.from(possibleValues);
}

export function findMatchingQrStudent<
  T extends { id: number; studentCode: string },
>(students: T[], rawValue: string): T | null {
  const candidateValues = collectQrCandidateValues(rawValue);
  const candidates = new Set(candidateValues);
  if (candidates.size === 0) return null;

  const exact = students.find(
    student =>
      candidates.has(String(student.id)) || candidates.has(student.studentCode)
  );
  if (exact) return exact;

  const normalizedCodes = new Set(
    candidateValues.map(value => value.replace(/\s+/g, "").toLowerCase())
  );
  const normalized = students.find(student =>
    normalizedCodes.has(
      cleanQrValue(student.studentCode).replace(/\s+/g, "").toLowerCase()
    )
  );
  if (normalized) return normalized;

  const numericCandidates = new Set(
    candidateValues
      .filter(value => /^\d+$/.test(value))
      .map(value => value.replace(/^0+(?=\d)/, ""))
  );
  if (numericCandidates.size === 0) return null;
  const numericMatches = students.filter(student => {
    const id = String(student.id).replace(/^0+(?=\d)/, "");
    const code = cleanQrValue(student.studentCode).replace(/^0+(?=\d)/, "");
    return numericCandidates.has(id) || numericCandidates.has(code);
  });
  return numericMatches.length === 1 ? numericMatches[0] : null;
}

export function selectQrAttendanceAssignment<T>(options: {
  session?: { id?: number | null; assignment?: T | null } | null;
  timetable?: { id?: number | null; assignment?: T | null } | null;
  device?: { id?: number | null; assignment?: T | null } | null;
}) {
  const candidates = [
    { source: "teacher_session" as const, ...options.session },
    { source: "timetable" as const, ...options.timetable },
    { source: "device_assignment" as const, ...options.device },
  ];

  return (
    candidates.find(
      candidate =>
        Number.isInteger(candidate.id) &&
        Number(candidate.id) > 0 &&
        Boolean(candidate.assignment)
    ) ?? null
  );
}

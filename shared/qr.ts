export function collectQrCandidateValues(rawValue: string): string[] {
  const value = rawValue.trim();
  if (!value) return [];

  const possibleValues = new Set<string>([value]);

  try {
    const parsed = JSON.parse(value);
    for (const key of ["studentId", "id", "studentCode", "code"]) {
      if (parsed?.[key] !== undefined) {
        possibleValues.add(String(parsed[key]));
      }
    }
  } catch {
    // Plain text and URLs are handled below.
  }

  try {
    const url = new URL(value);
    for (const key of ["studentId", "id", "studentCode", "code"]) {
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
  const candidates = new Set(collectQrCandidateValues(rawValue));
  if (candidates.size === 0) return null;

  return (
    students.find(
      student =>
        candidates.has(String(student.id)) ||
        candidates.has(student.studentCode)
    ) ?? null
  );
}

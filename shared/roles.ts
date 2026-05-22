export type UserRole = "user" | "teacher" | "admin" | "reviewer";
export type NormalizedUserRole = "teacher" | "admin" | "reviewer";

export function normalizeUserRole(role: string | null | undefined): NormalizedUserRole {
  if (role === "admin" || role === "reviewer" || role === "teacher") {
    return role;
  }
  return "teacher";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "admin";
}

export function isReviewerRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "reviewer";
}

export function isTeacherRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "teacher";
}

export function canEditData(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "teacher" || normalized === "admin";
}

export function roleLabel(role: string | null | undefined): string {
  const normalized = normalizeUserRole(role);
  if (normalized === "admin") return "ผู้ดูแลระบบ";
  if (normalized === "reviewer") return "ผู้ตรวจสอบ";
  return "ครูผู้สอน";
}

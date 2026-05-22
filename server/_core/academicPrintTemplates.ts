import path from "path";

export type AcademicPrintLevel = "primary" | "secondary";

const LEGACY_ACADEMIC_PRINT_ROOT = "/Users/worawut/Library/CloudStorage/GoogleDrive-mungthisanwork@gmail.com/Other computers/My Computer/งานโรงเรียนบ้านขัวก่าย/ปพ.นักเรียนโรงเรียนบ้านขัวก่าย วิชาคอมพิวเตอร์/2569";
const FALLBACK_TEMPLATE_FILE = "ปริ้นส่งวิชาการ.xlsm";

const ACADEMIC_PRINT_FILES: Record<AcademicPrintLevel, string> = {
  primary: "ปพ.5-ป.1.xlsx",
  secondary: "ปพ.5-ม2.xlsx",
};

export function getAcademicPrintTemplateFileName(level: AcademicPrintLevel) {
  return ACADEMIC_PRINT_FILES[level] ?? null;
}

export function getAcademicPrintTemplateCandidates(level: AcademicPrintLevel | undefined) {
  const candidates: string[] = [];
  const templateRoots = [
    process.env.ACADEMIC_PRINT_TEMPLATE_DIR,
    path.resolve(process.cwd(), "templates", "academic"),
    LEGACY_ACADEMIC_PRINT_ROOT,
  ].filter((root): root is string => Boolean(root));

  if (level) {
    const fileName = getAcademicPrintTemplateFileName(level);
    if (fileName) {
      candidates.push(...templateRoots.map(root => path.join(root, fileName)));
    }

    candidates.push(path.resolve(
      process.cwd(),
      level === "primary" ? "เก็บคะแนนประถม.xlsx" : "ตัวอย่างมัธยม.xlsx",
    ));
  }

  candidates.push(path.resolve(process.cwd(), FALLBACK_TEMPLATE_FILE));
  return candidates;
}

export function academicPrintContentType(fileName: string) {
  return fileName.toLowerCase().endsWith(".xlsm")
    ? "application/vnd.ms-excel.sheet.macroEnabled.12"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

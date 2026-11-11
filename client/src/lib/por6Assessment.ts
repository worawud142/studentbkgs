export const COMPETENCY_LABELS = [
  ["communication", "ความสามารถในการสื่อสาร"],
  ["thinking", "ความสามารถในการคิด"],
  ["problemSolving", "ความสามารถในการแก้ปัญหา"],
  ["lifeSkills", "ความสามารถในการใช้ทักษะชีวิต"],
  ["technology", "ความสามารถในการใช้เทคโนโลยี"],
] as const;

export const ATTRIBUTE_LABELS = [
  ["nationReligionKing", "รักชาติ ศาสน์ กษัตริย์"],
  ["honesty", "ซื่อสัตย์สุจริต"],
  ["discipline", "มีวินัย"],
  ["eagerness", "ใฝ่เรียนรู้"],
  ["sufficiency", "อยู่อย่างพอเพียง"],
  ["dedication", "มุ่งมั่นในการทำงาน"],
  ["thaiIdentity", "รักความเป็นไทย"],
  ["publicMind", "มีจิตสาธารณะ"],
] as const;

export const ACTIVITY_LABELS = [
  ["guidance", "แนะแนว"],
  ["scout", "ลูกเสือ"],
  ["environment", "สิ่งแวดล้อม"],
  ["volunteer", "จิตอาสา"],
] as const;

export const ASSESSMENT_LEVEL_OPTIONS = [
  "ดีเยี่ยม",
  "ดี",
  "ผ่าน",
  "ผ่านเกณฑ์",
  "ควรปรับปรุง",
] as const;

export type AssessmentForm = {
  competencies: Record<string, string>;
  readingThinkingWriting: string;
  attributes: Record<string, string>;
  activities: Record<string, string>;
  activityLabels: Record<string, string>;
};

export const ASSESSMENT_LEVEL_LABELS: Record<number, string> = {
  3: "ดีเยี่ยม",
  2: "ดี",
  1: "ผ่านเกณฑ์",
  0: "ควรปรับปรุง",
};

function assessmentLabelFromScore(value: unknown, excellentThreshold: number) {
  const score = Number(value);
  if (!Number.isFinite(score)) return ASSESSMENT_LEVEL_LABELS[3];
  if (score > excellentThreshold) return ASSESSMENT_LEVEL_LABELS[3];
  if (score > 59) return ASSESSMENT_LEVEL_LABELS[2];
  if (score > 49) return ASSESSMENT_LEVEL_LABELS[1];
  return ASSESSMENT_LEVEL_LABELS[0];
}

function normalizeAssessmentValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (text === "3" || text === "3.0") return ASSESSMENT_LEVEL_LABELS[3];
  if (text === "2" || text === "2.0") return ASSESSMENT_LEVEL_LABELS[2];
  if (text === "1" || text === "1.0") return ASSESSMENT_LEVEL_LABELS[1];
  if (text === "0" || text === "0.0") return ASSESSMENT_LEVEL_LABELS[0];
  return text;
}

export function mostCommonAssessmentValue(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    ASSESSMENT_LEVEL_LABELS[3]
  );
}

function autoAssessmentForm(report: any): AssessmentForm {
  const percentage = report?.summary?.percentage;
  const attributeLabel = assessmentLabelFromScore(percentage, 70);
  const readingLabel = assessmentLabelFromScore(percentage, 74);

  return {
    competencies: Object.fromEntries(
      COMPETENCY_LABELS.map(([key]) => [key, readingLabel])
    ),
    readingThinkingWriting: readingLabel,
    attributes: Object.fromEntries(
      ATTRIBUTE_LABELS.map(([key]) => [key, attributeLabel])
    ),
    activities: Object.fromEntries(
      ACTIVITY_LABELS.map(([key]) => [key, "ผ่าน"])
    ),
    activityLabels: Object.fromEntries(
      ACTIVITY_LABELS.map(([key, label]) => [key, label])
    ),
  };
}

export function buildAssessmentForm(report: any): AssessmentForm {
  const auto = autoAssessmentForm(report);
  if (!report?.assessment?.id) return auto;

  return {
    competencies: {
      ...auto.competencies,
      ...Object.fromEntries(
        Object.entries(report?.assessment?.competencies ?? {}).map(
          ([key, value]) => [key, normalizeAssessmentValue(value)]
        )
      ),
    },
    readingThinkingWriting:
      normalizeAssessmentValue(report?.assessment?.readingThinkingWriting) ||
      auto.readingThinkingWriting,
    attributes: {
      ...auto.attributes,
      ...Object.fromEntries(
        Object.entries(report?.assessment?.attributes ?? {}).map(
          ([key, value]) => [key, normalizeAssessmentValue(value)]
        )
      ),
    },
    activities: {
      ...auto.activities,
      ...(report?.assessment?.activities ?? {}),
    },
    activityLabels: {
      ...auto.activityLabels,
      ...(report?.assessment?.activityLabels ?? {}),
    },
  };
}

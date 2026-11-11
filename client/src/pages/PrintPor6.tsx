import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, ArrowLeft, Loader2, Save, Edit2, X } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const COMPETENCY_LABELS = [
  ["communication", "ความสามารถในการสื่อสาร"],
  ["thinking", "ความสามารถในการคิด"],
  ["problemSolving", "ความสามารถในการแก้ปัญหา"],
  ["lifeSkills", "ความสามารถในการใช้ทักษะชีวิต"],
  ["technology", "ความสามารถในการใช้เทคโนโลยี"],
] as const;

const ATTRIBUTE_LABELS = [
  ["nationReligionKing", "รักชาติ ศาสน์ กษัตริย์"],
  ["honesty", "ซื่อสัตย์สุจริต"],
  ["discipline", "มีวินัย"],
  ["eagerness", "ใฝ่เรียนรู้"],
  ["sufficiency", "อยู่อย่างพอเพียง"],
  ["dedication", "มุ่งมั่นในการทำงาน"],
  ["thaiIdentity", "รักความเป็นไทย"],
  ["publicMind", "มีจิตสาธารณะ"],
] as const;

const ACTIVITY_LABELS = [
  ["guidance", "แนะแนว"],
  ["scout", "ลูกเสือ"],
  ["environment", "สิ่งแวดล้อม"],
  ["volunteer", "จิตอาสา"],
] as const;

type AssessmentForm = {
  competencies: Record<string, string>;
  readingThinkingWriting: string;
  attributes: Record<string, string>;
  activities: Record<string, string>;
  activityLabels: Record<string, string>;
};

const ASSESSMENT_LEVEL_LABELS: Record<number, string> = {
  3: "ดีเยี่ยม",
  2: "ดี",
  1: "ผ่านเกณฑ์",
  0: "ควรปรับปรุง",
};

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function numberOrDash(value: unknown, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toFixed(digits);
}

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

function mostCommonAssessmentValue(values: string[]) {
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

function buildAssessmentForm(report: any): AssessmentForm {
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

const SUBJECT_ROW_COUNT = 16;

function academicPeriodLabel(classroom: any, academicYear: any) {
  const period =
    classroom?.level === "primary"
      ? "ปลายปี"
      : `ภาคเรียนที่ ${academicYear?.semester || "-"}`;
  return `ชั้น${classroom?.name || "-"} ${period} ปีการศึกษา ${academicYear?.year || "-"}`;
}

function thaiLongDate(value?: string | Date | null) {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Por6Page({ report, pageIndex }: { report: any; pageIndex: number }) {
  const student = report.student;
  const classroom = report.classroom;
  const academicYear = report.academicYear;
  const school = report.school;
  const assessment = buildAssessmentForm(report);
  const competencies = assessment.competencies;
  const competencySummary = mostCommonAssessmentValue(
    COMPETENCY_LABELS.map(([key]) => competencies[key])
  );
  const attributes = assessment.attributes;
  const attributeSummary = mostCommonAssessmentValue(
    ATTRIBUTE_LABELS.map(([key]) => attributes[key])
  );
  const activities = assessment.activities ?? {};
  const activityLabels = assessment.activityLabels ?? {};
  const homeroomTeacherNames =
    report.homeroomTeacherNames?.length > 0
      ? report.homeroomTeacherNames
      : school?.homeroomTeacherName
        ? [school.homeroomTeacherName]
        : [];
  const blankSubjectRows = Math.max(
    0,
    SUBJECT_ROW_COUNT - report.subjects.length
  );
  const documentDate = thaiLongDate(academicYear?.endDate);

  return (
    <section
      className="por6-page mx-auto bg-white text-black shadow-lg print:shadow-none"
      style={{
        width: "210mm",
        height: "297mm",
        padding: "8mm 10mm 7mm",
        fontFamily:
          "'TH Sarabun New', 'Sarabun', 'IBM Plex Sans Thai', sans-serif",
        fontSize: "10pt",
        overflow: "hidden",
        pageBreakBefore: pageIndex === 0 ? "auto" : "always",
        pageBreakAfter: "always",
      }}
    >
      <header className="grid grid-cols-[23mm_1fr_23mm] items-center leading-tight">
        <div className="flex h-[22mm] items-center justify-center">
          {school?.schoolLogoUrl ? (
            <img
              src={school.schoolLogoUrl}
              alt="ตราโรงเรียน"
              className="max-h-[21mm] max-w-[21mm] object-contain"
            />
          ) : (
            <div className="flex h-[18mm] w-[18mm] items-center justify-center rounded-full border border-black text-center text-[7pt] leading-tight">
              ตรา
              <br />
              โรงเรียน
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-[13pt] font-bold">
            แบบรายงานประจำตัวนักเรียน : ผลการพัฒนาคุณภาพผู้เรียนรายบุคคล
          </p>
          <p className="mt-1 text-[11pt]">
            {school?.schoolName || "โรงเรียน"} {school?.officeName || ""}
          </p>
          <p className="mt-1 text-[11pt]">
            {academicPeriodLabel(classroom, academicYear)}
          </p>
        </div>
        <div />
      </header>

      <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-end gap-x-8 px-5 text-[11pt]">
        <p className="min-w-0">
          <span className="font-semibold">ชื่อ</span>{" "}
          <span className="ml-5 font-semibold">
            {student?.prefix}
            {student?.firstName} {student?.lastName}
          </span>
        </p>
        <p>
          <span className="font-semibold">เลขประจำตัว</span>{" "}
          <span className="ml-5">{student?.studentCode || "-"}</span>
        </p>
        <p>
          <span className="font-semibold">เลขที่</span>{" "}
          <span className="ml-5">{student?.studentNumber || "-"}</span>
        </p>
      </div>

      <table className="por6-subject-table mt-1.5 w-full table-fixed border-collapse text-[8.2pt] leading-tight">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "8.5%" }} />
          <col style={{ width: "25.5%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "10.5%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "9.5%" }} />
        </colgroup>
        <thead>
          <tr className="h-[13mm]">
            <th className="border border-black p-0.5 [writing-mode:vertical-rl]">
              ประเภทรายวิชา
            </th>
            <th className="border border-black p-0.5">รหัสวิชา</th>
            <th className="border border-black p-0.5">รายวิชา</th>
            <th className="border border-black p-0.5">
              เวลาเรียน/
              <br />
              ชั่วโมง
            </th>
            <th className="border border-black p-0.5">คะแนนเต็ม</th>
            <th className="border border-black p-0.5">
              คะแนน
              <br />
              เฉลี่ยชั้นเรียน
            </th>
            <th className="border border-black p-0.5">คะแนนที่ได้</th>
            <th className="border border-black p-0.5">
              ระดับ
              <br />
              ผลการเรียน
            </th>
            <th className="border border-black p-0.5">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {report.subjects.map((subject: any) => (
            <tr key={subject.assignmentId} className="h-[5.7mm]">
              <td className="border border-black px-0.5 text-center text-[7pt]">
                {subject.subjectType}
              </td>
              <td className="border border-black px-0.5 text-center">
                {subject.subjectCode || "-"}
              </td>
              <td className="border border-black px-1">
                {subject.subjectName}
              </td>
              <td className="border border-black px-0.5 text-center">
                {numberOrDash(subject.hours, 1)}
              </td>
              <td className="border border-black px-0.5 text-center">
                {valueOrDash(subject.maxScore)}
              </td>
              <td className="border border-black px-0.5 text-center">
                {numberOrDash(subject.classAverage, 2)}
              </td>
              <td className="border border-black px-0.5 text-center">
                {numberOrDash(subject.score, 2)}
              </td>
              <td className="border border-black px-0.5 text-center font-semibold">
                {valueOrDash(subject.grade)}
              </td>
              <td className="border border-black px-0.5 text-center">
                {subject.note || ""}
              </td>
            </tr>
          ))}
          {Array.from({ length: blankSubjectRows }, (_, index) => (
            <tr key={`blank-${index}`} className="h-[5.7mm]">
              {Array.from({ length: 9 }, (__, cellIndex) => (
                <td key={cellIndex} className="border border-black" />
              ))}
            </tr>
          ))}
          <tr className="h-[6.5mm] font-semibold">
            <td className="border border-black px-1 text-center" colSpan={3}>
              รวม/เฉลี่ย
            </td>
            <td className="border border-black px-1 text-center">
              {numberOrDash(report.summary.totalHours, 1)}
            </td>
            <td className="border border-black px-1 text-center">
              {valueOrDash(report.summary.totalMaxScore)}
            </td>
            <td className="border border-black px-1 text-center">
              {numberOrDash(
                report.subjects.length
                  ? report.subjects.reduce(
                      (sum: number, subject: any) =>
                        sum + (Number(subject.classAverage) || 0),
                      0
                    ) / report.subjects.length
                  : null,
                2
              )}
            </td>
            <td className="border border-black px-1 text-center">
              {numberOrDash(report.summary.totalScore, 2)}
            </td>
            <td className="border border-black px-1 text-center" />
            <td className="border border-black px-1" />
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-[49%_51%] items-start text-[8.4pt] leading-tight">
        <div>
          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr className="h-[6.2mm]">
                <td className="border border-black px-1" colSpan={2}>
                  คะแนนคิดเป็นร้อยละ
                </td>
                <td className="w-[18%] border border-black text-center font-semibold">
                  {numberOrDash(report.summary.percentage, 2)}
                </td>
              </tr>
              <tr className="h-[6.2mm]">
                <td className="border border-black px-1" colSpan={2}>
                  ผลการเรียนเฉลี่ย
                </td>
                <td className="border border-black text-center font-semibold">
                  {numberOrDash(report.summary.gpa, 2)}
                </td>
              </tr>
              <tr className="h-[6.2mm]">
                <td className="border border-black px-1" colSpan={2}>
                  ลำดับที่สอบได้ (ตามคะแนนร้อยละ) สอบได้ลำดับที่
                </td>
                <td className="border border-black text-center font-semibold">
                  {report.summary.rank || "-"}
                </td>
              </tr>
              {ACTIVITY_LABELS.map(([key, label], index) => (
                <tr key={key} className="h-[6mm]">
                  {index === 0 && (
                    <td
                      className="w-[28%] border border-black px-1 text-center font-semibold leading-snug"
                      rowSpan={ACTIVITY_LABELS.length}
                    >
                      ผลการประเมิน
                      <br />
                      กิจกรรมพัฒนา
                      <br />
                      ผู้เรียน
                    </td>
                  )}
                  <td className="border border-black px-1">
                    {activityLabels[key] || label}
                  </td>
                  <td className="border border-black text-center">
                    {activities[key] || "ผ่าน"}
                  </td>
                </tr>
              ))}
              {ATTRIBUTE_LABELS.map(([key, label], index) => (
                <tr key={key} className="h-[6mm]">
                  {index === 0 && (
                    <td
                      className="border border-black px-1 text-center font-semibold leading-snug"
                      rowSpan={10}
                    >
                      ผลการประเมิน
                      <br />
                      คุณลักษณะอันพึง
                      <br />
                      ประสงค์
                    </td>
                  )}
                  <td className="border border-black px-1">
                    {index + 1}. {label}
                  </td>
                  <td className="border border-black text-center">
                    {attributes[key] || ASSESSMENT_LEVEL_LABELS[3]}
                  </td>
                </tr>
              ))}
              {[9, 10].map(index => (
                <tr key={index} className="h-[6mm]">
                  <td className="border border-black px-1">{index}.</td>
                  <td className="border border-black" />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-center text-[9pt]">
            ลงชื่อ........................................ ผู้ปกครองนักเรียน
          </p>
        </div>

        <div>
          <table className="w-full table-fixed border-collapse">
            <tbody>
              <tr className="h-[6.2mm]">
                <td
                  className="border border-black px-1 font-semibold"
                  colSpan={3}
                >
                  ผลการประเมินสมรรถนะสำคัญของผู้เรียน
                </td>
              </tr>
              {COMPETENCY_LABELS.map(([key, label], index) => (
                <tr key={key} className="h-[6mm]">
                  {index === 0 && (
                    <td
                      className="w-[22%] border border-black px-1 text-center font-semibold leading-snug"
                      rowSpan={COMPETENCY_LABELS.length}
                    >
                      สมรรถนะ
                      <br />
                      สำคัญของ
                      <br />
                      ผู้เรียน
                    </td>
                  )}
                  <td className="border border-black px-1">
                    {index + 1}. {label}
                  </td>
                  <td className="w-[21%] border border-black text-center">
                    {competencies[key] || ASSESSMENT_LEVEL_LABELS[3]}
                  </td>
                </tr>
              ))}
              <tr className="h-[6.2mm] font-semibold">
                <td className="border border-black px-1" colSpan={2}>
                  สรุปผลการประเมินสมรรถนะสำคัญของผู้เรียน
                </td>
                <td className="border border-black text-center">
                  {competencySummary}
                </td>
              </tr>
              <tr className="h-[6.2mm] font-semibold">
                <td className="border border-black px-1" colSpan={2}>
                  สรุปผลการประเมินการอ่าน คิดวิเคราะห์และเขียน
                </td>
                <td className="border border-black text-center">
                  {assessment.readingThinkingWriting ||
                    ASSESSMENT_LEVEL_LABELS[3]}
                </td>
              </tr>
              <tr className="h-[6.2mm] font-semibold">
                <td className="border border-black px-1" colSpan={2}>
                  สรุปผลการประเมินคุณลักษณะอันพึงประสงค์
                </td>
                <td className="border border-black text-center">
                  {attributeSummary}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 space-y-4 text-center text-[9pt] leading-snug">
            <div>
              <p>
                ลงชื่อ ..................................................
                ครูประจำชั้น
              </p>
              <p>
                (
                {homeroomTeacherNames[0] ||
                  ".................................................."}
                )
              </p>
            </div>
            <div>
              <p>
                ลงชื่อ ..................................................
                หัวหน้างานวิชาการ
              </p>
              <p>
                (
                {school?.academicHeadName ||
                  ".................................................."}
                )
              </p>
            </div>
            <div>
              <p>ลงชื่อ ..................................................</p>
              <p>
                (
                {school?.directorName ||
                  ".................................................."}
                )
              </p>
              <p>ผู้อำนวยการสถานศึกษา{school?.schoolName || ""}</p>
              <p>วันที่ {documentDate}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PrintPor6() {
  const params = useParams<{
    studentId?: string;
    classroomId?: string;
    assignmentId?: string;
  }>();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const studentId = params.studentId ? parseInt(params.studentId) : undefined;
  const classroomId = params.classroomId
    ? parseInt(params.classroomId)
    : params.assignmentId
      ? parseInt(params.assignmentId)
      : undefined;
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    studentId ?? null
  );
  const [form, setForm] = useState<AssessmentForm | null>(null);
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [isSavingAssessment, setIsSavingAssessment] = useState(false);

  const studentReport = trpc.por6.getStudentReport.useQuery(
    { studentId: studentId || 0 },
    { enabled: Boolean(studentId) }
  );
  const classroomReports = trpc.por6.getClassroomReports.useQuery(
    { classroomId: classroomId || 0 },
    { enabled: Boolean(!studentId && classroomId) }
  );
  const saveAssessment = trpc.por6.saveAssessment.useMutation({
    onSuccess: async () => {
      await utils.por6.getStudentReport.invalidate();
      await utils.por6.getClassroomReports.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveClassroomActivities = trpc.por6.saveClassroomActivities.useMutation(
    {
      onSuccess: async () => {
        await utils.por6.getStudentReport.invalidate();
        await utils.por6.getClassroomReports.invalidate();
      },
      onError: error => toast.error(error.message),
    }
  );

  const reports = useMemo(() => {
    if (studentReport.data) return [studentReport.data];
    return (classroomReports.data ?? []) as any[];
  }, [studentReport.data, classroomReports.data]);
  const selectedReport =
    reports.find(report => report.student.id === selectedStudentId) ??
    reports[0] ??
    null;
  const isLoading = studentReport.isLoading || classroomReports.isLoading;

  useEffect(() => {
    if (!selectedStudentId && reports[0])
      setSelectedStudentId(reports[0].student.id);
  }, [reports, selectedStudentId]);

  useEffect(() => {
    setForm(selectedReport ? buildAssessmentForm(selectedReport) : null);
  }, [
    selectedReport?.student?.id,
    selectedReport?.assessment?.updatedAt,
    selectedReport?.summary?.percentage,
  ]);

  const updateFormMap = (
    group: "competencies" | "attributes" | "activities" | "activityLabels",
    key: string,
    value: string
  ) => {
    setForm(prev =>
      prev
        ? {
            ...prev,
            [group]: { ...prev[group], [key]: value },
          }
        : prev
    );
  };

  const handleSaveAssessment = async () => {
    if (!selectedReport || !form) return;
    setIsSavingAssessment(true);
    try {
      await saveAssessment.mutateAsync({
        studentId: selectedReport.student.id,
        academicYearId: selectedReport.classroom.academicYearId,
        competencies: form.competencies,
        readingThinkingWriting: form.readingThinkingWriting,
        attributes: form.attributes,
        activities: form.activities,
        activityLabels: form.activityLabels,
      });
      if (reports.length > 1) {
        await saveClassroomActivities.mutateAsync({
          classroomId: selectedReport.classroom.id,
          academicYearId: selectedReport.classroom.academicYearId,
          activities: form.activities,
          activityLabels: form.activityLabels,
        });
      }
      toast.success(
        reports.length > 1
          ? "บันทึกการประเมิน และปรับกิจกรรมให้ทั้งห้องเรียบร้อย"
          : "บันทึกการประเมินเรียบร้อย"
      );
      setIsEditingAssessment(false);
    } finally {
      setIsSavingAssessment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const error = studentReport.error ?? classroomReports.error;
  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-red-700">
            โหลดข้อมูล ปพ.6 ไม่สำเร็จ
          </p>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1 as any)}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            กลับ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1 as any)}
            className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับ
          </button>
          <div className="text-center">
            <p className="font-medium text-slate-800">ปพ.6 รายบุคคล</p>
            <p className="text-xs text-slate-500">
              {reports.length > 1
                ? `${reports.length} คน`
                : selectedReport?.student?.firstName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedReport && form && (
              <Button
                variant={isEditingAssessment ? "outline" : "secondary"}
                size="sm"
                onClick={() => setIsEditingAssessment(value => !value)}
              >
                {isEditingAssessment ? (
                  <X className="w-4 h-4 mr-1" />
                ) : (
                  <Edit2 className="w-4 h-4 mr-1" />
                )}
                {isEditingAssessment ? "ปิดแก้ไข" : "แก้ไขประเมิน"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />
              พิมพ์ / Save PDF
            </Button>
          </div>
        </div>

        {isEditingAssessment && selectedReport && form && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label className="text-xs">แก้ประเมินนักเรียน</Label>
                <select
                  value={selectedReport.student.id}
                  onChange={event =>
                    setSelectedStudentId(Number(event.target.value))
                  }
                  className="mt-1 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {reports.map(report => (
                    <option key={report.student.id} value={report.student.id}>
                      {report.student.studentNumber || "-"}{" "}
                      {report.student.prefix}
                      {report.student.firstName} {report.student.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAssessment}
                disabled={isSavingAssessment}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-1" />
                {isSavingAssessment ? "กำลังบันทึก..." : "บันทึกประเมิน"}
              </Button>
            </div>

            <div className="mb-2 text-xs font-semibold text-slate-600">
              ผลประเมินรายคน
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">อ่าน คิดวิเคราะห์ และเขียน</Label>
                <Input
                  value={form.readingThinkingWriting}
                  onChange={event =>
                    setForm(prev =>
                      prev
                        ? {
                            ...prev,
                            readingThinkingWriting: event.target.value,
                          }
                        : prev
                    )
                  }
                  className="mt-1 h-8"
                />
              </div>
              {COMPETENCY_LABELS.map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={form.competencies[key] ?? "ดีเยี่ยม"}
                    onChange={event =>
                      updateFormMap("competencies", key, event.target.value)
                    }
                    className="mt-1 h-8"
                  />
                </div>
              ))}
              {ATTRIBUTE_LABELS.map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={form.attributes[key] ?? "ดีเยี่ยม"}
                    onChange={event =>
                      updateFormMap("attributes", key, event.target.value)
                    }
                    className="mt-1 h-8"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">
                  กิจกรรมพัฒนาผู้เรียน
                </p>
                {reports.length > 1 && (
                  <p className="text-xs text-blue-600">
                    แก้ครั้งเดียวและบันทึกให้ทุกคนในห้องนี้
                  </p>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {ACTIVITY_LABELS.map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs">ชื่อกิจกรรม: {label}</Label>
                    <Input
                      value={form.activityLabels[key] ?? label}
                      onChange={event =>
                        updateFormMap("activityLabels", key, event.target.value)
                      }
                      className="mt-1 h-8"
                    />
                    <Label className="mt-2 block text-xs">ผลกิจกรรม</Label>
                    <Input
                      value={form.activities[key] ?? "ผ่าน"}
                      onChange={event =>
                        updateFormMap("activities", key, event.target.value)
                      }
                      className="mt-1 h-8"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8 p-8 print:space-y-0 print:p-0">
        {reports.length === 0 ? (
          <div className="text-center text-slate-400">ไม่มีข้อมูล ปพ.6</div>
        ) : (
          reports.map((report, index) => (
            <Por6Page
              key={report.student.id}
              report={report}
              pageIndex={index}
            />
          ))
        )}
      </div>
    </div>
  );
}

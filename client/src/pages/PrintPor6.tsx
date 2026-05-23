import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, ArrowLeft, Loader2, Save } from "lucide-react";
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

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function numberOrDash(value: unknown, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toFixed(digits);
}

function buildAssessmentForm(report: any): AssessmentForm {
  return {
    competencies: { ...(report?.assessment?.competencies ?? {}) },
    readingThinkingWriting:
      report?.assessment?.readingThinkingWriting ?? "ดีเยี่ยม",
    attributes: { ...(report?.assessment?.attributes ?? {}) },
    activities: { ...(report?.assessment?.activities ?? {}) },
    activityLabels: { ...(report?.assessment?.activityLabels ?? {}) },
  };
}

function Por6Page({ report, pageIndex }: { report: any; pageIndex: number }) {
  const student = report.student;
  const classroom = report.classroom;
  const academicYear = report.academicYear;
  const school = report.school;
  const assessment = report.assessment ?? {};
  const competencies = assessment.competencies ?? {};
  const attributes = assessment.attributes ?? {};
  const activities = assessment.activities ?? {};
  const activityLabels = assessment.activityLabels ?? {};
  const homeroomTeacherNames =
    report.homeroomTeacherNames?.length > 0
      ? report.homeroomTeacherNames
      : school?.homeroomTeacherName
        ? [school.homeroomTeacherName]
        : [];

  return (
    <section
      className="bg-white shadow-lg print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "10mm 12mm",
        fontFamily: "'IBM Plex Sans Thai', sans-serif",
        fontSize: "9pt",
        pageBreakBefore: pageIndex === 0 ? "auto" : "always",
      }}
    >
      <div className="text-center leading-tight">
        <p className="font-bold text-base">
          แบบรายงานประจำตัวนักเรียน : ผลการพัฒนาคุณภาพผู้เรียนรายบุคคล
        </p>
        <p className="font-semibold">
          {school?.schoolName || "โรงเรียน"} {school?.officeName || ""}
        </p>
        <p>
          ชั้น{classroom?.name || "-"} ภาคเรียนที่ 2 ปีการศึกษา{" "}
          {academicYear?.year || "-"}
        </p>
      </div>

      <div className="mt-3 flex justify-between text-xs">
        <p>
          ชื่อ {student?.prefix}
          {student?.firstName} {student?.lastName}
        </p>
        <p>เลขประจำตัว {student?.studentCode || "-"}</p>
        <p>เลขที่ {student?.studentNumber || "-"}</p>
      </div>

      <table className="mt-2 w-full border-collapse text-[8.5pt]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-500 px-1 py-1">ประเภทรายวิชา</th>
            <th className="border border-slate-500 px-1 py-1">รหัสวิชา</th>
            <th className="border border-slate-500 px-1 py-1 text-left">
              รายวิชา
            </th>
            <th className="border border-slate-500 px-1 py-1">เวลาเรียน/ชั่วโมง</th>
            <th className="border border-slate-500 px-1 py-1">คะแนนเต็ม</th>
            <th className="border border-slate-500 px-1 py-1">คะแนนเฉลี่ยชั้นเรียน</th>
            <th className="border border-slate-500 px-1 py-1">คะแนนที่ได้</th>
            <th className="border border-slate-500 px-1 py-1">ระดับผลการเรียน</th>
            <th className="border border-slate-500 px-1 py-1">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {report.subjects.map((subject: any) => (
            <tr key={subject.assignmentId}>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {subject.subjectType}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {subject.subjectCode || "-"}
              </td>
              <td className="border border-slate-400 px-1 py-0.5">
                {subject.subjectName}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {numberOrDash(subject.hours, 1)}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {valueOrDash(subject.maxScore)}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {numberOrDash(subject.classAverage, 2)}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {numberOrDash(subject.score, 2)}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {valueOrDash(subject.grade)}
              </td>
              <td className="border border-slate-400 px-1 py-0.5 text-center">
                {subject.note || ""}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border border-slate-500 px-1 py-1 text-center" colSpan={3}>
              รวม/เฉลี่ย
            </td>
            <td className="border border-slate-500 px-1 py-1 text-center">
              {numberOrDash(report.summary.totalHours, 1)}
            </td>
            <td className="border border-slate-500 px-1 py-1 text-center">
              {valueOrDash(report.summary.totalMaxScore)}
            </td>
            <td className="border border-slate-500 px-1 py-1 text-center">-</td>
            <td className="border border-slate-500 px-1 py-1 text-center">
              {numberOrDash(report.summary.totalScore, 2)}
            </td>
            <td className="border border-slate-500 px-1 py-1 text-center">
              {numberOrDash(report.summary.gpa, 2)}
            </td>
            <td className="border border-slate-500 px-1 py-1" />
          </tr>
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <p>คะแนนคิดเป็นร้อยละ {numberOrDash(report.summary.percentage, 2)}</p>
          <p>ผลการเรียนเฉลี่ย {numberOrDash(report.summary.gpa, 2)}</p>
          <p>
            ลำดับที่สอบได้{" "}
            {report.summary.rank
              ? `สอบได้ลำดับที่ ${report.summary.rank}`
              : "-"}
          </p>
          {ACTIVITY_LABELS.map(([key, label]) => (
            <p key={key}>
              {activityLabels[key] || label} {activities[key] || "ผ่าน"}
            </p>
          ))}
        </div>

        <div className="space-y-1">
          <p className="font-semibold">ผลการประเมินสมรรถนะสำคัญของผู้เรียน</p>
          {COMPETENCY_LABELS.map(([key, label], index) => (
            <p key={key}>
              {index + 1}. {label} {competencies[key] || "ดีเยี่ยม"}
            </p>
          ))}
          <p className="font-semibold">
            สรุปผลการประเมินสมรรถนะสำคัญของผู้เรียน ดีเยี่ยม
          </p>
          <p>
            สรุปผลการประเมินการอ่าน คิดวิเคราะห์และเขียน{" "}
            {assessment.readingThinkingWriting || "ดีเยี่ยม"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold">ผลการประเมินคุณลักษณะอันพึงประสงค์</p>
          {ATTRIBUTE_LABELS.map(([key, label], index) => (
            <p key={key}>
              {index + 1}. {label} {attributes[key] || "ดีเยี่ยม"}
            </p>
          ))}
          <p className="font-semibold">
            สรุปผลการประเมินคุณลักษณะอันพึงประสงค์ ดีเยี่ยม
          </p>
        </div>

        <div className="space-y-5 pt-2 text-center">
          {homeroomTeacherNames.length > 0 ? (
            homeroomTeacherNames.map((name: string, index: number) => (
              <div key={`${name}-${index}`}>
                <p>ลงชื่อ ........................................ ครูประจำชั้น</p>
                <p>({name})</p>
              </div>
            ))
          ) : (
            <div>
              <p>ลงชื่อ ........................................ ครูประจำชั้น</p>
              <p>(........................................)</p>
            </div>
          )}
          <div>
            <p>ลงชื่อ ........................................ หัวหน้างานวิชาการ</p>
            <p>({school?.academicHeadName || "........................................"})</p>
          </div>
          <div>
            <p>ลงชื่อ ........................................ ผู้อำนวยการสถานศึกษา</p>
            <p>({school?.directorName || "........................................"})</p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-xs">
        ลงชื่อ…………....…………………………. ผู้ปกครองนักเรียน วันที่{" "}
        {new Date().toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
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
      toast.success("บันทึกการประเมินเรียบร้อย");
      await utils.por6.getStudentReport.invalidate();
      await utils.por6.getClassroomReports.invalidate();
    },
    onError: error => toast.error(error.message),
  });

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
    if (!selectedStudentId && reports[0]) setSelectedStudentId(reports[0].student.id);
  }, [reports, selectedStudentId]);

  useEffect(() => {
    setForm(selectedReport ? buildAssessmentForm(selectedReport) : null);
  }, [selectedReport?.student?.id, selectedReport?.assessment?.updatedAt]);

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

  const handleSaveAssessment = () => {
    if (!selectedReport || !form) return;
    saveAssessment.mutate({
      studentId: selectedReport.student.id,
      academicYearId: selectedReport.classroom.academicYearId,
      competencies: form.competencies,
      readingThinkingWriting: form.readingThinkingWriting,
      attributes: form.attributes,
      activities: form.activities,
      activityLabels: form.activityLabels,
    });
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
          <p className="font-semibold text-red-700">โหลดข้อมูล ปพ.6 ไม่สำเร็จ</p>
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
              {reports.length > 1 ? `${reports.length} คน` : selectedReport?.student?.firstName}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" />
            พิมพ์ / Save PDF
          </Button>
        </div>

        {selectedReport && form && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label className="text-xs">แก้ประเมินนักเรียน</Label>
                <select
                  value={selectedReport.student.id}
                  onChange={event => setSelectedStudentId(Number(event.target.value))}
                  className="mt-1 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {reports.map(report => (
                    <option key={report.student.id} value={report.student.id}>
                      {report.student.studentNumber || "-"} {report.student.prefix}
                      {report.student.firstName} {report.student.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                onClick={handleSaveAssessment}
                disabled={saveAssessment.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-1" />
                {saveAssessment.isPending ? "กำลังบันทึก..." : "บันทึกประเมิน"}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">อ่าน คิดวิเคราะห์ และเขียน</Label>
                <Input
                  value={form.readingThinkingWriting}
                  onChange={event =>
                    setForm(prev =>
                      prev
                        ? { ...prev, readingThinkingWriting: event.target.value }
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
        )}
      </div>

      <div className="space-y-8 p-8 print:space-y-0 print:p-0">
        {reports.length === 0 ? (
          <div className="text-center text-slate-400">ไม่มีข้อมูล ปพ.6</div>
        ) : (
          reports.map((report, index) => (
            <Por6Page key={report.student.id} report={report} pageIndex={index} />
          ))
        )}
      </div>
    </div>
  );
}

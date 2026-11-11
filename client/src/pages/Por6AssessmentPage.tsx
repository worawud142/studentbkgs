import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTIVITY_LABELS,
  ASSESSMENT_LEVEL_OPTIONS,
  ATTRIBUTE_LABELS,
  buildAssessmentForm,
  COMPETENCY_LABELS,
  type AssessmentForm,
} from "@/lib/por6Assessment";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  BookOpenCheck,
  Loader2,
  Save,
  School,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const selectClassName =
  "mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function AssessmentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = ASSESSMENT_LEVEL_OPTIONS.includes(value as any)
    ? ASSESSMENT_LEVEL_OPTIONS
    : ([value, ...ASSESSMENT_LEVEL_OPTIONS] as readonly string[]);

  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className={selectClassName}
    >
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function Por6AssessmentPage() {
  const params = useParams<{ studentId?: string; classroomId?: string }>();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const studentId = params.studentId ? Number(params.studentId) : undefined;
  const classroomId = params.classroomId
    ? Number(params.classroomId)
    : undefined;
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    studentId ?? null
  );
  const [form, setForm] = useState<AssessmentForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const studentReport = trpc.por6.getStudentReport.useQuery(
    { studentId: studentId || 0 },
    { enabled: Boolean(studentId) }
  );
  const classroomReports = trpc.por6.getClassroomReports.useQuery(
    { classroomId: classroomId || 0 },
    { enabled: Boolean(!studentId && classroomId) }
  );
  const reports = useMemo(() => {
    if (studentReport.data) return [studentReport.data];
    return (classroomReports.data ?? []) as any[];
  }, [studentReport.data, classroomReports.data]);
  const selectedReport =
    reports.find(report => report.student.id === selectedStudentId) ??
    reports[0] ??
    null;
  const isClassroomMode = reports.length > 1 || Boolean(classroomId);
  const printHref = studentId
    ? `/print/por6/student/${studentId}`
    : `/print/por6/classroom/${classroomId}`;

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
        await utils.por6.getClassroomReports.invalidate();
      },
      onError: error => toast.error(error.message),
    }
  );

  useEffect(() => {
    if (!selectedStudentId && reports[0]) {
      setSelectedStudentId(reports[0].student.id);
    }
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
    setForm(previous =>
      previous
        ? {
            ...previous,
            [group]: { ...previous[group], [key]: value },
          }
        : previous
    );
  };

  const handleSave = async () => {
    if (!selectedReport || !form) return;
    setIsSaving(true);
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
      if (isClassroomMode) {
        await saveClassroomActivities.mutateAsync({
          classroomId: selectedReport.classroom.id,
          academicYearId: selectedReport.classroom.academicYearId,
          activities: form.activities,
          activityLabels: form.activityLabels,
        });
      }
      toast.success(
        isClassroomMode
          ? "บันทึกผลประเมินรายคนและกิจกรรมของทั้งห้องแล้ว"
          : "บันทึกผลประเมินแล้ว"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (studentReport.isLoading || classroomReports.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const error = studentReport.error ?? classroomReports.error;
  if (error || !selectedReport || !form) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-red-700">
            {error ? "โหลดข้อมูลประเมินไม่สำเร็จ" : "ไม่พบข้อมูลนักเรียน"}
          </p>
          {error && (
            <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          )}
          <Button
            variant="outline"
            onClick={() => navigate(printHref)}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            กลับหน้าพิมพ์
          </Button>
        </div>
      </div>
    );
  }

  const student = selectedReport.student;
  const classroom = selectedReport.classroom;
  const academicYear = selectedReport.academicYear;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(printHref)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              กลับหน้าพิมพ์
            </Button>
            <div>
              <h1 className="font-semibold">ประเมินนักเรียนสำหรับ ปพ.6</h1>
              <p className="text-xs text-slate-500">
                ห้อง {classroom?.name || "-"} · ปีการศึกษา{" "}
                {academicYear?.year || "-"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "กำลังบันทึก..." : "บันทึกผลประเมิน"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  นักเรียนที่กำลังประเมิน
                </p>
                <p className="text-lg font-semibold">
                  {student.prefix}
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  เลขที่ {student.studentNumber || "-"} · รหัส{" "}
                  {student.studentCode || "-"}
                </p>
              </div>
            </div>
            {reports.length > 1 && (
              <div className="w-full sm:w-80">
                <Label className="text-xs">เลือกนักเรียน</Label>
                <select
                  value={student.id}
                  onChange={event =>
                    setSelectedStudentId(Number(event.target.value))
                  }
                  className={selectClassName}
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
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold">การอ่านและสมรรถนะสำคัญ</h2>
              <p className="text-sm text-slate-500">ผลส่วนนี้เป็นรายบุคคล</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <Label>อ่าน คิดวิเคราะห์ และเขียน</Label>
              <AssessmentSelect
                value={form.readingThinkingWriting}
                onChange={value =>
                  setForm(previous =>
                    previous
                      ? { ...previous, readingThinkingWriting: value }
                      : previous
                  )
                }
              />
            </div>
            {COMPETENCY_LABELS.map(([key, label], index) => (
              <div key={key} className="rounded-xl border border-slate-200 p-4">
                <Label>
                  {index + 1}. {label}
                </Label>
                <AssessmentSelect
                  value={form.competencies[key] || "ดีเยี่ยม"}
                  onChange={value => updateFormMap("competencies", key, value)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="font-semibold">คุณลักษณะอันพึงประสงค์</h2>
              <p className="text-sm text-slate-500">
                ประเมินทั้ง 8 ด้านของนักเรียนคนนี้
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ATTRIBUTE_LABELS.map(([key, label], index) => (
              <div key={key} className="rounded-xl border border-slate-200 p-4">
                <Label>
                  {index + 1}. {label}
                </Label>
                <AssessmentSelect
                  value={form.attributes[key] || "ดีเยี่ยม"}
                  onChange={value => updateFormMap("attributes", key, value)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <School className="h-5 w-5 text-violet-600" />
              <div>
                <h2 className="font-semibold">กิจกรรมพัฒนาผู้เรียน</h2>
                <p className="text-sm text-slate-500">
                  ชื่อกิจกรรมและผลการประเมิน
                </p>
              </div>
            </div>
            {isClassroomMode && (
              <p className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                บันทึกส่วนนี้ให้ทุกคนในห้อง
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ACTIVITY_LABELS.map(([key, label]) => (
              <div key={key} className="rounded-xl border border-slate-200 p-4">
                <Label>ชื่อกิจกรรม</Label>
                <Input
                  value={form.activityLabels[key] || label}
                  onChange={event =>
                    updateFormMap("activityLabels", key, event.target.value)
                  }
                  className="mt-1"
                />
                <Label className="mt-3 block">ผลกิจกรรม</Label>
                <select
                  value={form.activities[key] || "ผ่าน"}
                  onChange={event =>
                    updateFormMap("activities", key, event.target.value)
                  }
                  className={selectClassName}
                >
                  <option value="ผ่าน">ผ่าน</option>
                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "กำลังบันทึก..." : "บันทึกผลประเมิน"}
          </Button>
        </div>
      </main>
    </div>
  );
}

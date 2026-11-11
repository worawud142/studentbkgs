import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_LABELS,
  ASSESSMENT_LEVEL_LABELS,
  ATTRIBUTE_LABELS,
  buildAssessmentForm,
  COMPETENCY_LABELS,
  mostCommonAssessmentValue,
} from "@/lib/por6Assessment";
import { Printer, ArrowLeft, Loader2, ClipboardEdit } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useMemo } from "react";

function valueOrDash(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function numberOrDash(value: unknown, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toFixed(digits);
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
          "'TH SarabunPSK', 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif",
        fontSize: "10pt",
        overflow: "hidden",
        pageBreakBefore: pageIndex === 0 ? "auto" : "always",
        pageBreakAfter: "always",
      }}
    >
      <header className="grid grid-cols-[23mm_1fr_23mm] items-center leading-tight">
        <div className="flex h-[22mm] items-center justify-center">
          <img
            src={school?.schoolLogoUrl || "/school-logo.png"}
            alt="ตราโรงเรียน"
            className="max-h-[21mm] max-w-[21mm] object-contain"
          />
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
                  <td className="whitespace-nowrap border border-black px-1 text-[7.7pt]">
                    {index + 1}. {label}
                  </td>
                  <td className="w-[18%] border border-black text-center">
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

          <div className="mt-3 space-y-3 text-center text-[9pt] leading-snug">
            <div>
              <p>
                ลงชื่อ ..................................................
                ครูประจำชั้น
              </p>
              {homeroomTeacherNames.length > 0 ? (
                <div className="mt-0.5 grid grid-cols-2 gap-x-2">
                  {homeroomTeacherNames.map((name: string, index: number) => (
                    <p key={`${name}-${index}`}>
                      ( {name} )
                    </p>
                  ))}
                </div>
              ) : (
                <p>( .................................................. )</p>
              )}
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
  const studentId = params.studentId ? parseInt(params.studentId) : undefined;
  const classroomId = params.classroomId
    ? parseInt(params.classroomId)
    : params.assignmentId
      ? parseInt(params.assignmentId)
      : undefined;

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
  const firstReport = reports[0] ?? null;
  const isLoading = studentReport.isLoading || classroomReports.isLoading;
  const assessmentHref = studentId
    ? `/por6/assessment/student/${studentId}`
    : `/por6/assessment/classroom/${classroomId}`;

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
                : firstReport?.student?.firstName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {firstReport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(assessmentHref)}
              >
                <ClipboardEdit className="w-4 h-4 mr-1" />
                แก้ไขประเมิน
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />
              พิมพ์ / Save PDF
            </Button>
          </div>
        </div>
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

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Download } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useRef } from "react";

export default function PrintPor6() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const aId = parseInt(assignmentId);
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: assignment, isLoading } = trpc.assignment.get.useQuery({ id: aId });
  const classroomId = assignment?.assignment.classroomId || 0;
  const academicYearId = assignment?.assignment.academicYearId || 0;
  const { data: students = [] } = trpc.student.listByClassroom.useQuery(
    { classroomId },
    { enabled: !!assignment }
  );
  const { data: gradeResults = [] } = trpc.score.getGradeResults.useQuery({ assignmentId: aId });
  const { data: categories = [] } = trpc.score.getCategories.useQuery({ assignmentId: aId });
  const { data: scores = [] } = trpc.score.getByAssignment.useQuery({ assignmentId: aId });
  const { data: academicYears = [] } = trpc.academicYear.list.useQuery({});
  const academicYear = academicYears.find(y => y.id === academicYearId);

  const handlePrint = () => window.print();

  const gradeMap: Record<number, { grade: string; totalScore: string; result: string }> = {};
  gradeResults.forEach((g) => {
    gradeMap[g.studentId] = {
      grade: g.grade || "-",
      totalScore: g.totalScore?.toString() || "-",
      result: g.result || "-",
    };
  });

  const scoreMap: Record<string, string> = {};
  scores.forEach((s) => { scoreMap[`${s.categoryId}-${s.studentId}`] = s.score?.toString() || ""; });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const subject = assignment?.subject;
  const classroom = assignment?.classroom;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar */}
      <div className="no-print bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(-1 as any)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          กลับ
        </button>
        <div className="flex items-center gap-2">
          <span className="text-slate-700 font-medium">ปพ.6 - {subject?.name}</span>
          <span className="badge-primary-level">ประถม</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/templates/primary-score?export=1&assignmentId=${aId}`} download>
              <Download className="w-4 h-4 mr-1" />
              ส่งออก Excel
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="p-8 flex justify-center">
        <div ref={printRef} className="bg-white shadow-lg print-page" style={{ width: "210mm", minHeight: "297mm", padding: "15mm 20mm", fontFamily: "'IBM Plex Sans Thai', sans-serif", fontSize: "10pt" }}>
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
            <h1 className="text-xl font-bold">รายงานการเรียนรายบุคคล</h1>
            <h2 className="text-lg font-bold">ปพ.6 : ระเบียนแสดงผลการเรียน</h2>
            <p className="text-sm mt-1">ระดับประถมศึกษา (วัดผลแบบรายปี)</p>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="space-y-1">
              <p><span className="font-semibold">วิชา:</span> {subject?.subjectCode} {subject?.name}</p>
              <p><span className="font-semibold">กลุ่มสาระ:</span> {subject?.subjectGroup || "-"}</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-semibold">ห้องเรียน:</span> {classroom?.name}</p>
              <p><span className="font-semibold">ปีการศึกษา:</span> {academicYear?.year || "-"} (รายปี)</p>
              <p><span className="font-semibold">จำนวนนักเรียน:</span> {students.length} คน</p>
            </div>
          </div>

          {/* Score Table */}
          <table className="w-full text-xs border-collapse mb-6">
            <thead>
              <tr className="bg-green-50">
                <th className="border border-slate-400 px-2 py-1.5 text-center w-8">ที่</th>
                <th className="border border-slate-400 px-2 py-1.5 text-center w-20">รหัส</th>
                <th className="border border-slate-400 px-2 py-1.5 text-left min-w-[140px]">ชื่อ-สกุล</th>
                {categories.map((cat) => (
                  <th key={cat.id} className="border border-slate-400 px-1 py-1.5 text-center min-w-[50px]">
                    <div>{cat.name}</div>
                    <div className="text-slate-500 font-normal">({cat.maxScore})</div>
                  </th>
                ))}
                <th className="border border-slate-400 px-2 py-1.5 text-center w-16">รวม</th>
                <th className="border border-slate-400 px-2 py-1.5 text-center w-16">ผลการเรียน</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const g = gradeMap[s.id];
                return (
                  <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-green-50/30"}>
                    <td className="border border-slate-300 px-2 py-1 text-center">{s.studentNumber || idx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center text-xs">{s.studentCode}</td>
                    <td className="border border-slate-300 px-2 py-1">{s.prefix}{s.firstName} {s.lastName}</td>
                    {categories.map((cat) => (
                      <td key={cat.id} className="border border-slate-300 px-1 py-1 text-center">
                        {scoreMap[`${cat.id}-${s.id}`] || "-"}
                      </td>
                    ))}
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">
                      {g?.totalScore || "-"}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center">
                      {/* Primary school uses descriptive result */}
                      <span className={`font-semibold ${
                        g?.result === "pass" ? "text-green-700" :
                        g?.result === "fail" ? "text-red-700" : "text-slate-500"
                      }`}>
                        {g?.result === "pass" ? "ผ่าน" :
                         g?.result === "fail" ? "ไม่ผ่าน" :
                         g?.result === "incomplete" ? "ไม่สมบูรณ์" : "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Primary school note */}
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded text-xs">
            <p className="font-semibold text-green-800 mb-1">หมายเหตุ: การวัดผลระดับประถมศึกษา</p>
            <p className="text-green-700">ระดับประถมศึกษาวัดผลแบบรายปี โดยใช้เกณฑ์ผ่าน/ไม่ผ่าน ตามมาตรฐานการเรียนรู้ของหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8 text-xs">
            <div className="border border-slate-300 rounded p-3">
              <p className="font-semibold text-center mb-2">สรุปผลการเรียน</p>
              <p>ผ่าน: {Object.values(gradeMap).filter(g => g.result === "pass").length} คน</p>
              <p>ไม่ผ่าน: {Object.values(gradeMap).filter(g => g.result === "fail").length} คน</p>
              <p>รวม: {students.length} คน</p>
            </div>
            <div className="border border-slate-300 rounded p-3">
              <p className="font-semibold text-center mb-2">ลายมือชื่อครูผู้สอน</p>
              <div className="mt-6 border-b border-slate-400 mx-4" />
              <p className="text-center mt-1 text-slate-500">( .................................................. )</p>
            </div>
            <div className="border border-slate-300 rounded p-3">
              <p className="font-semibold text-center mb-2">ลายมือชื่อผู้บริหาร</p>
              <div className="mt-6 border-b border-slate-400 mx-4" />
              <p className="text-center mt-1 text-slate-500">( .................................................. )</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-400 border-t border-slate-200 pt-3">
            พิมพ์เมื่อ: {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}

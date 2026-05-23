import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { useParams } from "wouter";
import { User, BookOpen, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const studentId = parseInt(id);

  const { data: student, isLoading } = trpc.student.get.useQuery({ id: studentId });
  const { data: gradeResults = [] } = trpc.student.gradeResults.useQuery({ studentId });

  if (isLoading) {
    return (
      <TeacherLayout title="ข้อมูลนักเรียน" backHref="/dashboard">
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      </TeacherLayout>
    );
  }

  if (!student) {
    return (
      <TeacherLayout title="ข้อมูลนักเรียน" backHref="/dashboard">
        <div className="text-center py-12 text-slate-400">ไม่พบข้อมูลนักเรียน</div>
      </TeacherLayout>
    );
  }

  const passCount = gradeResults.filter((r) => r.result?.result === "pass").length;
  const failCount = gradeResults.filter((r) => r.result?.result === "fail").length;

  return (
    <TeacherLayout
      title={`${student.prefix}${student.firstName} ${student.lastName}`}
      backHref="/dashboard"
    >
      <div className="space-y-6 animate-fade-in max-w-3xl">
        {/* Student Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {student.prefix}{student.firstName} {student.lastName}
                </h2>
                <p className="text-slate-500">รหัสนักเรียน: {student.studentCode}</p>
                {student.nationalId && <p className="text-slate-500 text-sm">เลขประชาชน: {student.nationalId}</p>}
                {student.birthDate && <p className="text-slate-500 text-sm">วันเกิด: {String(student.birthDate)}</p>}
              </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/print/por6/student/${studentId}`}>
                    <FileText className="w-4 h-4 mr-1" />
                    ปพ.6 รายคน
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/templates/academic-print?export=1&studentId=${studentId}`}>
                    <Download className="w-4 h-4 mr-1" />
                    ส่งออก ปพ.5
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grade Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{gradeResults.length}</p>
              <p className="text-slate-500 text-sm">วิชาทั้งหมด</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{passCount}</p>
              <p className="text-slate-500 text-sm">ผ่าน</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{failCount}</p>
              <p className="text-slate-500 text-sm">ไม่ผ่าน</p>
            </CardContent>
          </Card>
        </div>

        {/* Grade Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              ผลการเรียน
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {gradeResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400">ยังไม่มีผลการเรียน</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">วิชา</th>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium">ห้อง</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">คะแนน</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">เกรด</th>
                    <th className="text-center px-4 py-3 text-slate-600 font-medium">ผล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeResults.map((r) => (
                    <tr key={r.result.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{r.subject?.name || "-"}</p>
                        <p className="text-slate-400 text-xs">{r.subject?.subjectCode}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.classroom?.name || "-"}</td>
                      <td className="px-4 py-3 text-center text-slate-700">
                        {r.result.totalScore ? Number(r.result.totalScore).toFixed(1) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-lg ${
                          parseFloat(r.result.grade || "0") >= 2 ? "text-green-600" :
                          parseFloat(r.result.grade || "0") >= 1 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {r.result.grade || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.result.result === "pass" ? "bg-green-100 text-green-700" :
                          r.result.result === "fail" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {r.result.result === "pass" ? "ผ่าน" :
                           r.result.result === "fail" ? "ไม่ผ่าน" :
                           r.result.result === "incomplete" ? "ไม่สมบูรณ์" : "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
}

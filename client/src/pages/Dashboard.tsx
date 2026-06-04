import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Users,
  ClipboardList,
  ChevronRight,
  AlertCircle,
  Plus,
  GraduationCap,
  School,
  Download,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeLevel, setActiveLevel] = useState<"all" | "primary" | "secondary">("all");
  const [teacherQrSvg, setTeacherQrSvg] = useState("");

  const { data: profile, isLoading: profileLoading } = trpc.teacher.myProfile.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Get active academic years
  const { data: activeYearPrimary } = trpc.academicYear.getActive.useQuery(
    { level: "primary" },
    { enabled: isAuthenticated }
  );
  const { data: activeYearSecondary } = trpc.academicYear.getActive.useQuery(
    { level: "secondary" },
    { enabled: isAuthenticated }
  );

  // Get teacher's assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = trpc.assignment.myList.useQuery(
    {},
    { enabled: isAuthenticated }
  );

  const filteredAssignments = useMemo(() => {
    if (activeLevel === "all") return assignments;
    return assignments.filter((a) => a.classroom?.level === activeLevel);
  }, [assignments, activeLevel]);

  const primaryAssignments = assignments.filter((a) => a.classroom?.level === "primary");
  const secondaryAssignments = assignments.filter((a) => a.classroom?.level === "secondary");

  useEffect(() => {
    let cancelled = false;

    async function buildTeacherQr() {
      if (!profile?.teacherCode) {
        setTeacherQrSvg("");
        return;
      }
      const payload = JSON.stringify({
        type: "teacher-session",
        teacherCode: profile.teacherCode,
      });
      const svg = await QRCode.toString(payload, {
        type: "svg",
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      if (!cancelled) {
        setTeacherQrSvg(svg);
      }
    }

    buildTeacherQr();
    return () => {
      cancelled = true;
    };
  }, [profile?.teacherCode]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <TeacherLayout title="หน้าหลัก">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">กำลังโหลด...</p>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  // If no profile, redirect to setup
  if (!profile) {
    return (
      <TeacherLayout title="ยินดีต้อนรับ">
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">ยินดีต้อนรับสู่ระบบ</h2>
          <p className="text-slate-500 mb-6">กรุณาตั้งค่าโปรไฟล์ครูของคุณก่อนเริ่มใช้งาน</p>
          <Button onClick={() => navigate("/setup")} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            ตั้งค่าโปรไฟล์ครู
          </Button>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="หน้าหลัก">
      <div className="space-y-6 animate-fade-in">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
          <p className="text-blue-200 text-sm mb-1">สวัสดี</p>
          <h2 className="text-2xl font-bold mb-1">
            {profile.prefix}{profile.firstName} {profile.lastName}
          </h2>
          <p className="text-blue-200 text-sm">
            {profile.teachingLevel === "primary" && "ครูระดับประถมศึกษา"}
            {profile.teachingLevel === "secondary" && "ครูระดับมัธยมศึกษา"}
            {profile.teachingLevel === "both" && "ครูระดับประถมและมัธยมศึกษา"}
            {profile.isHomeroom && " · ครูประจำชั้น"}
          </p>
        </div>

        {/* Export highlight */}
        <Card className="overflow-hidden border-amber-200 bg-gradient-to-r from-amber-50 via-white to-blue-50">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
                  ส่งออกไฟล์
                </Badge>
                <CardTitle className="mt-3 text-slate-900 text-xl">
                  ส่งออก Excel / XLSM ได้จากการ์ดรายวิชา
                </CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  ใช้ปุ่มส่งออกบนแต่ละวิชาเพื่อดาวน์โหลดไฟล์ที่เติมข้อมูลจริงแล้ว หรือไปหน้าเอกสารเพื่อหยิบไฟล์ต้นแบบ
                </CardDescription>
              </div>
              <Button asChild size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">
                <Link href="/documents">
                  <Download className="w-4 h-4" />
                  ไปหน้าเอกสาร ปพ.
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{assignments.length}</p>
                  <p className="text-slate-500 text-xs">วิชาที่สอน</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{primaryAssignments.length}</p>
                  <p className="text-slate-500 text-xs">วิชาประถม</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{secondaryAssignments.length}</p>
                  <p className="text-slate-500 text-xs">วิชามัธยม</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {new Set(assignments.map((a) => a.classroom?.id)).size}
                  </p>
                  <p className="text-slate-500 text-xs">ห้องเรียน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Academic Year Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeYearPrimary && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-primary-level">ประถม</span>
                <span className="text-green-700 font-semibold text-sm">ปีการศึกษาที่ใช้งาน</span>
              </div>
              <p className="text-green-900 font-bold">ปีการศึกษา {activeYearPrimary.year}</p>
              <p className="text-green-600 text-xs">วัดผลแบบรายปี</p>
            </div>
          )}
          {activeYearSecondary && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-secondary-level">มัธยม</span>
                <span className="text-blue-700 font-semibold text-sm">ปีการศึกษาที่ใช้งาน</span>
              </div>
              <p className="text-blue-900 font-bold">
                ปีการศึกษา {activeYearSecondary.year}
                {activeYearSecondary.semester && ` ภาคเรียนที่ ${activeYearSecondary.semester}`}
              </p>
              <p className="text-blue-600 text-xs">วัดผลแบบรายภาคเรียน</p>
            </div>
          )}
        </div>

        {profile.teacherCode && (
          <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <Badge variant="outline" className="border-indigo-300 bg-indigo-100 text-indigo-900">
                    QR ครู
                  </Badge>
                  <CardTitle className="mt-3 text-slate-900">สแกน QR นี้เพื่อเปิดคาบอัตโนมัติ</CardTitle>
                  <CardDescription className="mt-2 text-slate-600">
                    เครื่องสแกนจะใช้ห้องล่าสุดที่คุณเคยเช็คชื่อไว้ แล้วลงนักเรียนต่อได้เลย
                  </CardDescription>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-900">
                  รหัสครู: {profile.teacherCode}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm">
                  {teacherQrSvg ? (
                    <div
                      className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: teacherQrSvg }}
                      aria-label={`QR ครู ${profile.prefix ?? ""}${profile.firstName} ${profile.lastName}`}
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      กำลังสร้าง QR...
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">
                    ใช้งานอย่างไร
                  </p>
                  <p>1. เปิดเครื่อง ESP32 + GM65</p>
                  <p>2. สแกน QR ครูของคุณ 1 ครั้ง</p>
                  <p>3. เครื่องจะเปิดห้องล่าสุดที่คุณใช้โดยอัตโนมัติ</p>
                  <p>4. จากนั้นให้นักเรียนสแกน QR ได้เลย</p>
                  <p className="text-xs text-slate-400">
                    ถ้าต้องการเปลี่ยนห้อง ระบบจะใช้ห้องล่าสุดที่คุณเคยเช็คชื่อไว้เป็นค่าหลัก
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignments */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">รายวิชาที่สอน</h3>
            <div className="flex gap-2">
              {(["all", "primary", "secondary"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevel(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeLevel === lvl
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {lvl === "all" ? "ทั้งหมด" : lvl === "primary" ? "ประถม" : "มัธยม"}
                </button>
              ))}
            </div>
          </div>

          {assignmentsLoading ? (
            <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">ยังไม่มีรายวิชาที่สอน</p>
              <p className="text-slate-400 text-sm mt-1">ติดต่อผู้ดูแลระบบเพื่อกำหนดรายวิชา</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssignments.map((a) => (
                <Card key={a.assignment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className={a.classroom?.level === "primary" ? "badge-primary-level" : "badge-secondary-level"}>
                        {a.classroom?.level === "primary" ? "ประถม" : "มัธยม"}
                      </span>
                      <span className="text-slate-400 text-xs">{a.subject?.subjectCode}</span>
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1 line-clamp-2">{a.subject?.name}</h4>
                    <p className="text-slate-500 text-sm mb-4">
                      ห้อง {a.classroom?.name} · {a.subject?.credits} หน่วยกิต
                    </p>
                    <div className="flex gap-2">
                      <Link href={`/attendance/${a.assignment.id}?classroomId=${a.assignment.classroomId}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <ClipboardList className="w-3 h-3 mr-1" />
                          เช็คชื่อ
                        </Button>
                      </Link>
                      <Link href={`/scores/${a.assignment.id}`} className="flex-1">
                        <Button size="sm" className="w-full text-xs bg-blue-600 hover:bg-blue-700">
                          <BookOpen className="w-3 h-3 mr-1" />
                          คะแนน
                        </Button>
                      </Link>
                    </div>
                    <Button asChild size="sm" className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm">
                      <a
                        href={`/api/templates/academic-print?export=1&assignmentId=${a.assignment.id}`}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        ส่งออก ปพ.5
                      </a>
                    </Button>
                    <Link href={`/classroom/${a.assignment.classroomId}`} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs mt-3 transition-colors">
                      <Users className="w-3 h-3" />
                      ดูรายชื่อนักเรียน
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

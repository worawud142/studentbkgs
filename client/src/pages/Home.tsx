import { useAuth } from "@/_core/hooks/useAuth";
import { clearDevSession, getLoginUrl, setAppSessionToken } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Users, ClipboardList, FileText, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { isSupabaseAuthConfigured, setSupabaseAuthSession } from "@/lib/supabase";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const loginUrl = getLoginUrl();
  const isDevLogin = loginUrl === "/dev-login";
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [teacherSubmitting, setTeacherSubmitting] = useState(false);
  const adminLoginMutation = trpc.auth.supabaseLogin.useMutation();
  const teacherLoginMutation = trpc.auth.localLogin.useMutation();

  const loginLabel = "เข้าสู่ระบบ";

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = adminEmail.trim();
    const trimmedPassword = adminPassword.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    if (!isSupabaseAuthConfigured) {
      toast.error("ยังไม่ได้ตั้งค่า Supabase Auth บนเครื่องนี้");
      return;
    }

    setAdminSubmitting(true);
  try {
      clearDevSession();
      const result = await adminLoginMutation.mutateAsync({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (result.session) {
        setAppSessionToken(result.sessionToken);
        setSupabaseAuthSession(result.session as never);
        if (result.user) {
          utils.auth.me.setData(undefined, result.user);
        }
        await utils.auth.me.invalidate();
        toast.success("เข้าสู่ระบบสำเร็จ");
        window.location.assign("/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ";
      toast.error(message);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUsername = teacherUsername.trim();
    const trimmedPassword = teacherPassword.trim();

    if (!trimmedUsername || !trimmedPassword) {
      toast.error("กรุณากรอกรหัสครูและรหัสผ่าน");
      return;
    }

    setTeacherSubmitting(true);
    try {
      clearDevSession();
      setSupabaseAuthSession(null);
      const result = await teacherLoginMutation.mutateAsync({
        username: trimmedUsername,
        password: trimmedPassword,
      });
      if (result.user) {
        setAppSessionToken(result.sessionToken);
        utils.auth.me.setData(undefined, result.user);
        await utils.auth.me.invalidate();
        toast.success("เข้าสู่ระบบสำเร็จ");
        window.location.assign("/dashboard");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ";
      toast.error(message);
    } finally {
      setTeacherSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">ระบบบริหารจัดการชั้นเรียน</h1>
            <p className="text-blue-300 text-xs">School Management System</p>
          </div>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-400 text-white px-6">
          <a href="#login">{loginLabel}</a>
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            แอดมินใช้ Supabase Auth ส่วนครูและผู้ตรวจสอบใช้บัญชีในระบบ
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            ระบบจัดการการเรียนการสอน
            <br />
            <span className="text-blue-400">สำหรับครูทุกระดับชั้น</span>
          </h2>

          <p className="text-slate-300 text-lg mb-10 leading-relaxed max-w-2xl mx-auto">
            เช็คชื่อ ลงคะแนน และออกเอกสาร ปพ.1 / ปพ.6 ในระบบเดียวกัน
            แยกการเข้าสู่ระบบระหว่างแอดมินกับครู/ผู้ตรวจสอบให้ชัดเจน
          </p>

          <Card id="login" className="mx-auto max-w-4xl border-white/10 bg-white/8 shadow-2xl shadow-black/20 backdrop-blur">
            <CardHeader className="text-left">
              <CardTitle className="text-white text-2xl">เข้าสู่ระบบ</CardTitle>
              <CardDescription className="text-blue-100/70">
                เลือกช่องทางที่ตรงกับบทบาทของคุณ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 text-left">
                <form onSubmit={handleAdminSubmit} className="rounded-2xl border border-blue-400/20 bg-slate-950/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <ShieldCheck className="w-4 h-4 text-blue-300" />
                    <h3 className="font-semibold">ผู้ดูแลระบบ</h3>
                  </div>
                  <p className="text-xs text-blue-100/70">
                    ใช้ Supabase Auth ด้วยอีเมลและรหัสผ่านสำหรับแอดมินเท่านั้น
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="admin-email" className="text-blue-50">
                      อีเมลแอดมิน
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminEmail}
                      onChange={(event) => setAdminEmail(event.target.value)}
                      placeholder="admin@school.ac.th"
                      autoComplete="email"
                      className="bg-white/90"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="admin-password" className="text-blue-50">
                      รหัสผ่าน
                    </Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      placeholder="รหัสผ่านแอดมิน"
                      autoComplete="current-password"
                      className="bg-white/90"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white rounded-xl shadow-lg shadow-blue-500/30"
                    disabled={adminSubmitting || !isSupabaseAuthConfigured}
                  >
                    {adminSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบแอดมิน"}
                  </Button>
                  {!isSupabaseAuthConfigured ? (
                    <p className="text-xs text-amber-200">
                      ยังไม่ได้ตั้งค่า Supabase Auth บนเครื่องนี้
                    </p>
                  ) : null}
                </form>

                <form onSubmit={handleTeacherSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <UserRound className="w-4 h-4 text-emerald-300" />
                    <h3 className="font-semibold">ครู / ผู้ตรวจสอบ</h3>
                  </div>
                  <p className="text-xs text-blue-100/70">
                    ใช้รหัสครูที่แอดมินกำหนดให้ เช่น `T001` และรหัสผ่านที่บันทึกไว้ในระบบ
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="teacher-username" className="text-blue-50">
                      รหัสครู / Username
                    </Label>
                    <Input
                      id="teacher-username"
                      type="text"
                      value={teacherUsername}
                      onChange={(event) => setTeacherUsername(event.target.value)}
                      placeholder="T001"
                      autoComplete="username"
                      className="bg-white/90"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="teacher-password" className="text-blue-50">
                      รหัสผ่าน
                    </Label>
                    <Input
                      id="teacher-password"
                      type="password"
                      value={teacherPassword}
                      onChange={(event) => setTeacherPassword(event.target.value)}
                      placeholder="รหัสผ่านครู"
                      autoComplete="current-password"
                      className="bg-white/90"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20"
                    disabled={teacherSubmitting}
                  >
                    {teacherSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบครู / ผู้ตรวจสอบ"}
                  </Button>
                </form>
              </div>
              {isDevLogin ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <div>
                    <p className="text-sm font-medium text-white">โหมดพัฒนา</p>
                    <p className="text-xs text-blue-100/70">
                      ยังสามารถกดเข้าใช้งานบัญชีตัวอย่างเพื่อทดสอบระบบได้
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <a href={loginUrl ?? "/dev-login"}>บัญชีตัวอย่าง</a>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-4xl w-full">
          {[
            { icon: ClipboardList, label: "เช็คชื่อนักเรียน", desc: "บันทึกการเข้าเรียนรายวัน", color: "text-green-400" },
            { icon: BookOpen, label: "ลงคะแนน", desc: "ประถม: รายปี | มัธยม: รายภาค", color: "text-blue-400" },
            { icon: FileText, label: "ปพ.1 / ปพ.6", desc: "ออกเอกสารและจัดเก็บ Cloud", color: "text-purple-400" },
            { icon: Users, label: "จัดการนักเรียน", desc: "ข้อมูลครบทุกห้องเรียน", color: "text-orange-400" },
          ].map((f) => (
            <div key={f.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left hover:bg-white/10 transition-colors">
              <f.icon className={`w-8 h-8 mb-3 ${f.color}`} />
              <p className="text-white font-semibold text-sm">{f.label}</p>
              <p className="text-slate-400 text-xs mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm border-t border-white/5">
        ระบบบริหารจัดการชั้นเรียน · รองรับประถมและมัธยมศึกษา
      </footer>
    </div>
  );
}

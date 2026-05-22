import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, LogIn, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  DEV_SESSION_STORAGE_KEY,
  getLoginUrl,
  safeLocalStorageSetItem,
} from "@/const";

const presets = [
  {
    preset: "teacher" as const,
    title: "ครูตัวอย่าง",
    description: "ใช้ทดสอบหน้าหลัก เช็คชื่อ ลงคะแนน และส่งออกไฟล์",
    icon: UserRound,
  },
  {
    preset: "admin" as const,
    title: "ผู้ดูแลระบบตัวอย่าง",
    description: "ใช้ทดสอบหน้าผู้ดูแลระบบและการจัดการข้อมูลหลัก",
    icon: ShieldCheck,
  },
  {
    preset: "reviewer" as const,
    title: "ผู้ตรวจสอบตัวอย่าง",
    description: "ใช้ทดสอบการดูข้อมูล คะแนน และเอกสารแบบอ่านอย่างเดียว",
    icon: ShieldCheck,
  },
];

export default function DevLogin() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const loginUrl = getLoginUrl();
  const devModeEnabled = loginUrl === "/dev-login";

  const loginMutation = trpc.auth.devLogin.useMutation({
    onError: (error) => {
      toast.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
    },
  });

  const startLocalDevSession = (preset: "teacher" | "admin" | "reviewer") => {
    const devOpenId =
      preset === "admin" ? "dev-admin" : preset === "reviewer" ? "dev-reviewer" : "dev-teacher";
    const devUser = {
      id: preset === "admin" ? 2 : preset === "reviewer" ? 3 : 1,
      openId: devOpenId,
      name: preset === "admin" ? "Demo Admin" : preset === "reviewer" ? "Demo Reviewer" : "Demo Teacher",
      email: preset === "admin" ? "admin@demo.local" : preset === "reviewer" ? "reviewer@demo.local" : "teacher@demo.local",
      loginMethod: "dev",
      role: preset === "admin" ? "admin" : preset === "reviewer" ? "reviewer" : "teacher",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    if (typeof window !== "undefined") {
      window.__DEV_SESSION_OPEN_ID__ = devOpenId;
      safeLocalStorageSetItem(DEV_SESSION_STORAGE_KEY, devOpenId);
    }

    utils.auth.me.setData(undefined, devUser as never);
    navigate("/dashboard");
  };

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Badge className="bg-white/10 text-white border-white/15 px-3 py-1">
            <Sparkles className="w-3 h-3" />
            โหมดพัฒนา
          </Badge>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold">เข้าสู่ระบบด้วยบัญชีตัวอย่าง</h1>
          <p className="mt-3 text-sm md:text-base text-blue-100/80 max-w-2xl mx-auto">
            หน้านี้มีไว้สำหรับเครื่องพัฒนาเท่านั้น ใช้บัญชีตัวอย่างเพื่อทดลองระบบได้ทันที
          </p>
        </div>

        {!devModeEnabled && (
          <Card className="border-white/10 bg-white/5 text-white mb-6">
            <CardContent className="p-6">
              <p className="text-sm text-blue-100/80">
                ระบบนี้ถูกตั้งค่า OAuth จริงแล้ว กรุณากลับไปใช้ปุ่มเข้าสู่ระบบด้านหน้า
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => navigate("/")}
              >
                กลับหน้าหลัก
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presets.map((preset) => (
            <Card key={preset.preset} className="border-white/10 bg-white/5 text-white shadow-xl shadow-black/10">
              <CardHeader className="space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-300/20 flex items-center justify-center">
                  <preset.icon className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <CardTitle className="text-white text-xl">{preset.title}</CardTitle>
                  <CardDescription className="text-blue-100/70 mt-1">
                    {preset.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pb-6">
                <Button
                  className="w-full bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-500/20"
                  size="lg"
                  onClick={() => {
                    startLocalDevSession(preset.preset);
                    loginMutation.mutate({ preset: preset.preset });
                  }}
                  disabled={loginMutation.isPending || !devModeEnabled}
                >
                  <LogIn className="w-4 h-4" />
                  {loginMutation.isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                </Button>
                <p className="mt-3 text-xs text-blue-100/65 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  หลังจากเข้าสู่ระบบ ระบบจะพากลับไปหน้า Dashboard ทันที
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

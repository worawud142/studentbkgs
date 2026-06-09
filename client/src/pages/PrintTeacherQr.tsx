import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import QRCode from "qrcode";

export default function PrintTeacherQr() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: profile } = trpc.teacher.myProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [teacherQrSvg, setTeacherQrSvg] = useState("");

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
        width: 150,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      if (!cancelled) {
        setTeacherQrSvg(svg);
      }
    }

    if (isAuthenticated) {
      buildTeacherQr();
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, profile?.teacherCode]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) {
    return null;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-900 font-semibold">ยังไม่มีโปรไฟล์ครู</p>
          <p className="mt-2 text-sm text-slate-500">กรุณาตั้งค่าโปรไฟล์ครูก่อนสร้าง QR</p>
          <Button asChild className="mt-5 bg-blue-600 hover:bg-blue-700">
            <Link href="/setup">ไปตั้งค่าโปรไฟล์</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .print-shell { padding: 0 !important; }
          .qr-card { box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" />
                กลับ
              </Link>
            </Button>
            <div>
              <h1 className="font-bold">พิมพ์ QR ครู</h1>
              <p className="text-xs text-slate-500">รหัสครู {profile.teacherCode}</p>
            </div>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์
          </Button>
        </div>
      </div>

      <main className="print-shell mx-auto flex min-h-[calc(100vh-61px)] max-w-6xl items-center justify-center p-5">
        <div className="qr-card w-full max-w-[520px] rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">
                QR ครูสำหรับเปิดคาบ
              </p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-slate-900 md:text-xl">
                {profile.prefix || ""}{profile.firstName} {profile.lastName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {profile.teachingLevel === "primary" && "ครูระดับประถมศึกษา"}
                {profile.teachingLevel === "secondary" && "ครูระดับมัธยมศึกษา"}
                {profile.teachingLevel === "both" && "ครูระดับประถมและมัธยมศึกษา"}
                {profile.isHomeroom ? " · ครูประจำชั้น" : ""}
              </p>
            </div>
            <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
              รหัสครู {profile.teacherCode}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[150px_1fr] md:items-center">
            <div className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {teacherQrSvg ? (
                <div
                  className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: teacherQrSvg }}
                  aria-label={`QR ครู ${profile.prefix ?? ""}${profile.firstName} ${profile.lastName}`}
                />
              ) : (
                <div className="text-center text-slate-400">
                  <QrCode className="mx-auto mb-2 h-10 w-10" />
                  กำลังสร้าง QR...
                </div>
              )}
            </div>

            <div className="min-w-0 text-sm">
              <p className="text-slate-500">รหัสครู</p>
              <p className="font-mono text-xl font-bold text-slate-900">{profile.teacherCode}</p>
              <p className="mt-3 text-slate-500">สถานะการใช้งาน</p>
              <p className="font-semibold text-slate-900">ใช้สแกนเพื่อเปิดคาบเรียน</p>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                ใช้ร่วมกับเครื่องสแกนเพื่อเปิด session ของครูตอนเริ่มคาบ
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

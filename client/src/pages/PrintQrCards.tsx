import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import QRCode from "qrcode";

type QrCard = {
  studentId: number;
  svg: string;
};

function qrPayload(student: { id?: number; studentCode?: string }) {
  return JSON.stringify({
    type: "student-attendance",
    studentId: student.id,
    studentCode: student.studentCode,
  });
}

export default function PrintQrCards() {
  const { classroomId } = useParams<{ classroomId: string }>();
  const cId = parseInt(classroomId);
  const { data: classroom } = trpc.classroom.get.useQuery({ id: cId });
  const { data: students = [], isLoading } = trpc.student.listByClassroom.useQuery({ classroomId: cId });
  const [cards, setCards] = useState<QrCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function buildCards() {
      const nextCards = await Promise.all(
        students.map(async (student) => ({
          studentId: student.id,
          svg: await QRCode.toString(qrPayload(student), {
            type: "svg",
            width: 150,
            margin: 1,
            errorCorrectionLevel: "M",
          }),
        }))
      );
      if (!cancelled) setCards(nextCards);
    }

    if (students.length === 0) {
      setCards([]);
      return;
    }

    buildCards();
    return () => {
      cancelled = true;
    };
  }, [students]);

  const svgByStudentId = new Map(cards.map((card) => [card.studentId, card.svg]));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
          .qr-grid { gap: 5mm !important; }
          .qr-card { break-inside: avoid; box-shadow: none !important; border-color: #111827 !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href={`/classroom/${cId}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                กลับ
              </Link>
            </Button>
            <div>
              <h1 className="font-bold">บัตร QR เช็คชื่อนักเรียน</h1>
              <p className="text-xs text-slate-500">
                ห้อง {classroom?.name || "-"} · {students.length} คน
              </p>
            </div>
          </div>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์บัตร QR
          </Button>
        </div>
      </div>

      <main className="print-page mx-auto max-w-6xl p-5">
        <div className="no-print mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          ให้นักเรียนถือบัตรนี้มาสแกนในหน้าเช็คชื่อได้ทุกคาบ QR จะผูกกับรหัสนักเรียนและเลขระบบของนักเรียนคนนั้น
        </div>

        {isLoading ? (
          <div className="rounded-xl bg-white p-10 text-center text-slate-400">กำลังสร้าง QR...</div>
        ) : students.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-slate-400">ไม่มีนักเรียนในห้องนี้</div>
        ) : (
          <div className="qr-grid grid grid-cols-2 gap-4 md:grid-cols-3">
            {students.map((student) => {
              const svg = svgByStudentId.get(student.id);
              return (
                <div key={student.id} className="qr-card rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">บัตรเช็คชื่อ</p>
                      <h2 className="text-lg font-bold leading-tight">
                        {student.prefix}{student.firstName} {student.lastName}
                      </h2>
                    </div>
                    <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                      เลขที่ {student.studentNumber || "-"}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-[150px] w-[150px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                      {svg ? (
                        <div dangerouslySetInnerHTML={{ __html: svg }} />
                      ) : (
                        <QrCode className="h-10 w-10 animate-pulse text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="text-slate-500">รหัสนักเรียน</p>
                      <p className="font-mono text-xl font-bold text-slate-900">{student.studentCode}</p>
                      <p className="mt-3 text-slate-500">ห้อง</p>
                      <p className="font-semibold">{classroom?.name || "-"}</p>
                      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                        ใช้สแกนเช็คชื่อในระบบบริหารชั้นเรียน
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

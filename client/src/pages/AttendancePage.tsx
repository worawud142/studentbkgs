import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Save,
  QrCode,
  Camera,
  CameraOff,
  History,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import jsQR from "jsqr";
import { collectQrCandidateValues } from "../../../shared/qr";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

const statusConfig: Record<
  AttendanceStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  present: {
    label: "มา",
    color: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200",
    icon: CheckCircle2,
  },
  absent: {
    label: "ขาด",
    color: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
    icon: XCircle,
  },
  late: {
    label: "สาย",
    color:
      "bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200",
    icon: Clock,
  },
  excused: {
    label: "ลา",
    color: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
    icon: BookOpen,
  },
};

const EMPTY_STUDENTS: {
  id: number;
  studentNumber: number | null;
  studentCode: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
}[] = [];
type AttendanceStudent = (typeof EMPTY_STUDENTS)[number];
const EMPTY_ATTENDANCE: { studentId: number; status: AttendanceStatus }[] = [];
const EMPTY_DATES: { date: string | Date }[] = [];
const EMPTY_HISTORY: {
  date: string | Date;
  status: AttendanceStatus;
  note: string | null;
}[] = [];
const SCANNER_MESSAGE_RESET_MS = 1800;

const THAI_WEEKDAYS = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatThaiFullDate(value: string | Date) {
  const date = parseDateOnly(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${THAI_WEEKDAYS[date.getDay()]} ที่ ${date.getDate()} ${
    THAI_MONTHS[date.getMonth()]
  } ${date.getFullYear() + 543}`;
}

function formatDateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return text.slice(0, 10);
}

function parseDateOnly(value: string | Date) {
  const key = formatDateKey(value);
  return new Date(`${key}T00:00:00`);
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
    };
  }
}

export default function AttendancePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const aId = parseInt(assignmentId);
  const classroomIdHint = Number(
    new URLSearchParams(window.location.search).get("classroomId") || 0
  );

  const today = formatDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<number, AttendanceStatus>
  >({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerMessage, setScannerMessage] = useState({
    text: "วาง QR ให้อยู่ในกรอบ",
    tone: "idle" as "idle" | "success" | "error",
  });
  const [qrInput, setQrInput] = useState("");
  const [historyStudent, setHistoryStudent] = useState<AttendanceStudent | null>(
    null
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScanRef = useRef("");
  const scannerMessageTimeoutRef = useRef<number | null>(null);
  const scannerAudioContextRef = useRef<AudioContext | null>(null);
  const savingScanRef = useRef<Set<number>>(new Set());

  const utils = trpc.useUtils();
  const { data: assignment } = trpc.assignment.get.useQuery(
    { id: aId },
    {
      enabled: Number.isFinite(aId),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const classroomId =
    classroomIdHint || assignment?.assignment.classroomId || 0;
  const { data: students = EMPTY_STUDENTS, isLoading: studentsLoading } =
    trpc.student.listByClassroom.useQuery(
      { classroomId },
      {
        enabled: classroomId > 0,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      }
    );
  const { data: existingAttendance = EMPTY_ATTENDANCE } =
    trpc.attendance.getByDate.useQuery(
      { assignmentId: aId, date: selectedDate },
      {
        enabled: Number.isFinite(aId),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      }
    );
  const { data: attendanceDates = EMPTY_DATES } =
    trpc.attendance.getDates.useQuery(
      { assignmentId: aId },
      {
        enabled: Number.isFinite(aId),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      }
    );
  const { data: studentHistory = EMPTY_HISTORY } =
    trpc.attendance.history.useQuery(
      { assignmentId: aId, studentId: historyStudent?.id ?? 0 },
      {
        enabled: Number.isFinite(aId) && !!historyStudent,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      }
    );

  const saveAttendance = trpc.attendance.save.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการเช็คชื่อเรียบร้อย");
      utils.attendance.getByDate.invalidate({
        assignmentId: aId,
        date: selectedDate,
      });
      utils.attendance.getByAssignment.invalidate({ assignmentId: aId });
      utils.attendance.getDates.invalidate({ assignmentId: aId });
    },
    onError: e => toast.error(e.message),
  });
  const saveOneAttendance = trpc.attendance.saveOne.useMutation({
    onSuccess: () => {
      utils.attendance.getByDate.invalidate({
        assignmentId: aId,
        date: selectedDate,
      });
      utils.attendance.getByAssignment.invalidate({ assignmentId: aId });
      utils.attendance.getDates.invalidate({ assignmentId: aId });
    },
    onError: e => toast.error(e.message),
  });

  const clearScannerMessageTimeout = () => {
    if (scannerMessageTimeoutRef.current) {
      window.clearTimeout(scannerMessageTimeoutRef.current);
      scannerMessageTimeoutRef.current = null;
    }
  };

  const resetScannerMessageSoon = () => {
    clearScannerMessageTimeout();
    scannerMessageTimeoutRef.current = window.setTimeout(() => {
      setScannerMessage({ text: "วาง QR ให้อยู่ในกรอบ", tone: "idle" });
      scannerMessageTimeoutRef.current = null;
    }, SCANNER_MESSAGE_RESET_MS);
  };

  const playScannerSuccessSound = () => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const context =
        scannerAudioContextRef.current ?? new AudioContextClass();
      scannerAudioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        1320,
        context.currentTime + 0.08
      );
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    } catch {
      // Browsers can block audio in some contexts; scanning should still succeed.
    }
  };
  const deleteOneAttendance = trpc.attendance.deleteOne.useMutation({
    onSuccess: () => {
      utils.attendance.getByDate.invalidate({
        assignmentId: aId,
        date: selectedDate,
      });
      utils.attendance.getByAssignment.invalidate({ assignmentId: aId });
      utils.attendance.getDates.invalidate({ assignmentId: aId });
    },
    onError: e => toast.error(e.message),
  });

  // Initialize from loaded attendance only when the class/date data changes,
  // not after every teacher click.
  useEffect(() => {
    if (students.length === 0) {
      setAttendanceMap({});
      return;
    }
    const map: Record<number, AttendanceStatus> = {};
    existingAttendance.forEach(a => {
      map[a.studentId] = a.status;
    });
    setAttendanceMap(map);
  }, [selectedDate, students, existingAttendance]);

  const handleSave = () => {
    const records = students.flatMap(s => {
      const status = attendanceMap[s.id];
      if (!status) return [];
      return [
        {
          assignmentId: aId,
          studentId: s.id,
          date: selectedDate,
          status,
        },
      ];
    });
    if (records.length === 0) {
      toast.message(
        "ยังไม่มีการเช็คชื่อในวันนี้ ถ้าไม่บันทึก ระบบจะถือว่าไม่มีเรียน"
      );
      return;
    }
    saveAttendance.mutate(records);
  };

  const setAll = (status: AttendanceStatus) => {
    const map: Record<number, AttendanceStatus> = {};
    students.forEach(s => {
      map[s.id] = status;
    });
    setAttendanceMap(map);
    saveAttendance.mutate(
      students.map(s => ({
        assignmentId: aId,
        studentId: s.id,
        date: selectedDate,
        status,
      }))
    );
  };

  const setStudentStatus = (studentId: number, status: AttendanceStatus) => {
    setAttendanceMap(current => ({
      ...current,
      [studentId]: status,
    }));
    saveOneAttendance.mutate({
      assignmentId: aId,
      studentId,
      date: selectedDate,
      status,
    });
  };

  const clearStudentStatus = (studentId: number) => {
    setAttendanceMap(current => {
      const next = { ...current };
      delete next[studentId];
      return next;
    });
    deleteOneAttendance.mutate({
      assignmentId: aId,
      studentId,
      date: selectedDate,
    });
  };

  const findStudentFromQr = (rawValue: string) => {
    const candidates = new Set(collectQrCandidateValues(rawValue));
    if (candidates.size === 0) return null;
    return (
      students.find(
        student =>
          candidates.has(String(student.id)) ||
          candidates.has(student.studentCode)
      ) ?? null
    );
  };

  const markPresentFromQr = async (rawValue: string) => {
    const student = findStudentFromQr(rawValue);
    if (!student) {
      toast.error("ไม่พบนักเรียนจาก QR นี้");
      setScannerMessage({ text: "ไม่พบนักเรียนจาก QR นี้", tone: "error" });
      resetScannerMessageSoon();
      return;
    }

    setAttendanceMap(current => ({ ...current, [student.id]: "present" }));
    if (savingScanRef.current.has(student.id)) return;
    savingScanRef.current.add(student.id);
    try {
      await saveOneAttendance.mutateAsync({
        assignmentId: aId,
        studentId: student.id,
        date: selectedDate,
        status: "present",
      });
      toast.success(
        `บันทึกแล้ว: ${student.prefix || ""}${student.firstName} ${student.lastName}`
      );
      setScannerMessage({
        text: `เช็คชื่อแล้ว: ${student.prefix || ""}${student.firstName} ${student.lastName}`,
        tone: "success",
      });
      playScannerSuccessSound();
      resetScannerMessageSoon();
    } finally {
      window.setTimeout(() => {
        savingScanRef.current.delete(student.id);
      }, 1500);
    }
  };

  const stopScanner = () => {
    clearScannerMessageTimeout();
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScannerActive(false);
    setScannerMessage({ text: "วาง QR ให้อยู่ในกรอบ", tone: "idle" });
  };

  const startScanner = async () => {
    setScannerOpen(true);
    setScannerError("");
    clearScannerMessageTimeout();
    setScannerMessage({ text: "กำลังเปิดกล้อง...", tone: "idle" });
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        "Browser นี้ยังไม่รองรับการเปิดกล้อง หรือยังไม่ได้เปิดผ่าน HTTPS กรุณาใช้ Chrome/Edge เวอร์ชันล่าสุด หรือกรอกรหัสจาก QR ด้านล่างแทนได้ครับ"
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const detector = window.BarcodeDetector
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;
      if (!detector) {
        setScannerError(
          "Browser นี้ไม่มี BarcodeDetector ระบบจะใช้ตัวอ่าน QR สำรองแทน หากสแกนยากให้ถือ QR ให้นิ่งและมีแสงพอ หรือกรอกรหัสเองด้านล่างได้ครับ"
        );
      }
      setScannerActive(true);
      setScannerMessage({ text: "วาง QR ให้อยู่ในกรอบ", tone: "idle" });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        if (videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play().catch(() => {});
        }
        try {
          let rawValue = "";
          if (detector) {
            const results = await detector.detect(videoRef.current);
            rawValue = results[0]?.rawValue?.trim() || "";
          } else {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (canvas && width > 0 && height > 0) {
              canvas.width = width;
              canvas.height = height;
              const context = canvas.getContext("2d", {
                willReadFrequently: true,
              });
              if (context) {
                context.drawImage(video, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                rawValue =
                  jsQR(
                    imageData.data,
                    imageData.width,
                    imageData.height
                  )?.data?.trim() || "";
              }
            }
          }
          if (rawValue && rawValue !== lastScanRef.current) {
            lastScanRef.current = rawValue;
            markPresentFromQr(rawValue);
            window.setTimeout(() => {
              lastScanRef.current = "";
            }, 1500);
          }
        } catch {
          // Keep scanning. Some frames cannot be decoded.
        }
        scanLoopRef.current = requestAnimationFrame(scan);
      };
      scanLoopRef.current = requestAnimationFrame(scan);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ไม่สามารถเปิดกล้องได้";
      setScannerError(
        `${message} หากใช้งานบน Windows ให้ตรวจว่า browser ได้รับสิทธิ์กล้องแล้ว หรือกรอกรหัสจาก QR ด้านล่างแทนได้ครับ`
      );
      stopScanner();
    }
  };

  const prepareQrScan = () => {
    startScanner();
  };

  useEffect(() => () => stopScanner(), []);

  useEffect(() => {
    if (
      !scannerOpen ||
      !scannerActive ||
      !streamRef.current ||
      !videoRef.current
    )
      return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(error => {
      setScannerError(
        error instanceof Error
          ? error.message
          : "เปิดภาพกล้องไม่สำเร็จ กรุณากดอนุญาตกล้องหรือรีเฟรชหน้า"
      );
    });
  }, [scannerActive, scannerOpen]);

  const changeDate = (days: number) => {
    const d = parseDateOnly(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDateKey(d));
  };

  // Summary
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  Object.values(attendanceMap).forEach(s => counts[s]++);
  const uncheckedCount = Math.max(
    students.length - Object.keys(attendanceMap).length,
    0
  );
  const selectedDateLabel = formatThaiFullDate(selectedDate);
  const hasSavedAttendanceForDate = existingAttendance.length > 0;

  return (
    <TeacherLayout
      title={`เช็คชื่อ - ${assignment?.subject?.name || ""}`}
      backHref="/dashboard"
    >
      <div className="space-y-5 animate-fade-in">
        {/* Assignment Info */}
        {assignment && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">
                {assignment.subject?.name}
              </p>
              <p className="text-blue-600 text-sm">
                ห้อง {assignment.classroom?.name} ·{" "}
                <span
                  className={
                    assignment.classroom?.level === "primary"
                      ? "badge-primary-level"
                      : "badge-secondary-level"
                  }
                >
                  {assignment.classroom?.level === "primary"
                    ? "ประถม"
                    : "มัธยม"}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Date Selector */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="text-center">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-lg font-bold text-slate-900 border-none outline-none text-center bg-transparent cursor-pointer"
                max={today}
              />
              {selectedDate === today && (
                <p className="text-blue-600 text-xs font-medium">วันนี้</p>
              )}
            </div>
            <button
              onClick={() => changeDate(1)}
              disabled={selectedDate >= today}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {(
            Object.entries(statusConfig) as [
              AttendanceStatus,
              (typeof statusConfig)[AttendanceStatus],
            ][]
          ).map(([status, cfg]) => (
            <div
              key={status}
              className={`rounded-xl p-3 border text-center ${cfg.color}`}
            >
              <p className="text-2xl font-bold">{counts[status]}</p>
              <p className="text-xs font-medium">{cfg.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
          {hasSavedAttendanceForDate
            ? `กำลังแสดงข้อมูลเช็คชื่อย้อนหลังของ${selectedDateLabel} สถานะเดิมจะถูกติ๊กไว้ที่ปุ่ม มา/ขาด/สาย/ลา ของแต่ละคน`
            : `ยังไม่มีข้อมูลเช็คชื่อของ${selectedDateLabel}`}{" "}
          · ยังไม่เช็ค {uncheckedCount} คน
        </div>

        {/* Quick Set All */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-slate-500 self-center">
            ตั้งค่าทั้งหมด:
          </span>
          {(
            Object.entries(statusConfig) as [
              AttendanceStatus,
              (typeof statusConfig)[AttendanceStatus],
            ][]
          ).map(([status, cfg]) => (
            <button
              key={status}
              onClick={() => setAll(status)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${cfg.color}`}
            >
              {cfg.label}ทั้งหมด
            </button>
          ))}
          <button
            type="button"
            onClick={prepareQrScan}
            disabled={students.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-40"
          >
            <QrCode className="w-3.5 h-3.5" />
            สแกน QR
          </button>
        </div>

        {scannerOpen && (
          <div className="bg-white rounded-xl border border-indigo-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  เช็คชื่อด้วย QR Code
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  QR ใช้ได้ทั้งรหัสนักเรียน เช่น 1234 หรือข้อความ JSON/URL ที่มี
                  studentId หรือ studentCode
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  stopScanner();
                  setScannerOpen(false);
                }}
              >
                <CameraOff className="w-4 h-4 mr-1" />
                ปิด
              </Button>
            </div>

            <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 xl:grid-cols-[minmax(560px,760px)_360px]">
              <div className="rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center">
                <div className="relative aspect-[4/3] max-h-[56vh] min-h-[280px] w-full">
                  <video
                    ref={videoRef}
                    className={`h-full w-full object-cover ${scannerActive ? "block" : "hidden"}`}
                    muted
                    playsInline
                    autoPlay
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                    aria-hidden="true"
                  />
                  {scannerActive ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-64 w-64 rounded-[2rem] border-4 border-white/95 shadow-[0_0_0_999px_rgba(15,23,42,0.16)] md:h-80 md:w-80 xl:h-[22rem] xl:w-[22rem]" />
                      <div
                        className={`absolute bottom-5 left-1/2 flex w-[min(90%,32rem)] -translate-x-1/2 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-center text-base font-semibold shadow-lg backdrop-blur ${
                          scannerMessage.tone === "success"
                            ? "border-green-200 bg-green-50/95 text-green-800"
                            : scannerMessage.tone === "error"
                              ? "border-red-200 bg-red-50/95 text-red-800"
                              : "border-slate-700 bg-slate-950/80 text-white"
                          }`}
                      >
                        {scannerMessage.tone === "success" && (
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                        )}
                        <span>{scannerMessage.text}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-300 p-6">
                      <Camera className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">กดสแกน QR เพื่อเปิดกล้อง</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 xl:w-[360px]">
                {scannerError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {scannerError}
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    กรอกรหัสจาก QR เอง
                  </label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row xl:flex-col">
                    <input
                      value={qrInput}
                      onChange={event => setQrInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          markPresentFromQr(qrInput);
                          setQrInput("");
                        }
                      }}
                      placeholder="เช่น 1234 หรือ studentCode"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button
                      type="button"
                      className="shrink-0"
                      onClick={() => {
                        markPresentFromQr(qrInput);
                        setQrInput("");
                      }}
                    >
                      เช็คชื่อ
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  ระบบจะบันทึกเฉพาะนักเรียนที่ถูกสแกนหรือถูกกดสถานะเท่านั้น
                  คนที่ยังไม่ถูกเช็คจะไม่ถูกบันทึกอัตโนมัติ
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Student List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-medium text-slate-700 text-sm">
              รายชื่อนักเรียน ({students.length} คน)
            </span>
            <Button
              onClick={handleSave}
              disabled={saveAttendance.isPending || students.length === 0}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-1" />
              {saveAttendance.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
          {studentsLoading ? (
            <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              ไม่มีนักเรียนในห้องนี้
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {students.map(s => {
                const status = attendanceMap[s.id];
                return (
                  <div
                    key={s.id}
                    className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="w-8 text-slate-400 text-sm text-center shrink-0">
                      {s.studentNumber || "-"}
                    </span>
                    <div className="flex-1 min-w-0 mx-3">
                      <p className="font-medium text-slate-900 text-sm truncate">
                        {s.prefix}
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-slate-400 text-xs">{s.studentCode}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setHistoryStudent(s as AttendanceStudent)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                      >
                        <History className="inline w-3 h-3 mr-1" />
                        ประวัติ
                      </button>
                      {(
                        Object.entries(statusConfig) as [
                          AttendanceStatus,
                          (typeof statusConfig)[AttendanceStatus],
                        ][]
                      ).map(([st, cfg]) => (
                        <button
                          key={st}
                          onClick={() => setStudentStatus(s.id, st)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            status === st
                              ? cfg.color + " scale-105 shadow-sm"
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                      {status && (
                        <button
                          type="button"
                          onClick={() => clearStudentStatus(s.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                        >
                          ล้าง
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        {attendanceDates.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-medium text-slate-700 text-sm mb-3">
              ประวัติการเช็คชื่อ
            </h3>
            <div className="flex flex-wrap gap-2">
              {attendanceDates.slice(0, 10).map(item => {
                const dateKey = formatDateKey(item.date);
                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                      selectedDate === dateKey
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                    title={formatThaiFullDate(item.date)}
                  >
                    {dateKey}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {historyStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    ประวัติการมาเรียน
                  </h3>
                  <p className="text-sm text-slate-500">
                    {historyStudent.prefix}
                    {historyStudent.firstName} {historyStudent.lastName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryStudent(null)}
                  className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
                >
                  ปิด
                </button>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-4">
                {studentHistory.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    ยังไม่มีประวัติการเช็คชื่อของนักเรียนคนนี้
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {studentHistory.map(item => {
                      const cfg = statusConfig[item.status as AttendanceStatus];
                      return (
                        <div
                          key={`${item.date}-${item.status}`}
                          className="flex items-center justify-between py-3"
                        >
                          <span className="text-sm text-slate-700">
                            {formatThaiFullDate(item.date)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

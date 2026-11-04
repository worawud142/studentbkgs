import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Camera, CheckCircle2, QrCode, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
    };
  }
}

type CaptureState = "idle" | "scanning" | "submitting" | "success" | "error";

export default function SubmissionBoxPage() {
  const { assignmentId, categoryId } = useParams<{
    assignmentId: string;
    categoryId: string;
  }>();
  const aId = Number(assignmentId);
  const cId = Number(categoryId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const lastQrRef = useRef("");
  const submittingRef = useRef(false);

  const [state, setState] = useState<CaptureState>("idle");
  const [message, setMessage] = useState("กดเปิดกล้อง แล้ววางใบงานให้เห็น QR และช่อง Pin 1-8");
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: assignment } = trpc.assignment.get.useQuery({ id: aId });
  const { data: categories = [] } = trpc.score.getCategories.useQuery({
    assignmentId: aId,
  });
  const category = categories.find(cat => cat.id === cId);
  const { data: answerKeys = [] } = trpc.assignmentBox.getAnswerKeys.useQuery(
    { categoryId: cId },
    { enabled: Number.isFinite(cId) }
  );
  const answerKey = answerKeys[0];

  const submit = trpc.assignmentBox.submit.useMutation({
    onSuccess: result => {
      setLastResult(result);
      setState("success");
      setMessage(
        result.status === "auto_scored"
          ? `รับงานแล้ว ลงคะแนน ${result.suggestedScore} คะแนน`
          : "รับงานแล้ว ส่งให้ครูตรวจ"
      );
      toast.success("รับงานแล้ว");
      window.setTimeout(() => {
        lastQrRef.current = "";
        submittingRef.current = false;
        setState("scanning");
        setMessage("พร้อมรับใบงานถัดไป");
      }, 2500);
    },
    onError: error => {
      submittingRef.current = false;
      setState("error");
      setMessage(error.message);
      toast.error(error.message);
    },
  });

  const stopCamera = () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return "";
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  };

  const scanWithJsQr = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return "";
    const scanWidth = Math.min(video.videoWidth, 960);
    const scale = scanWidth / video.videoWidth;
    const scanHeight = Math.round(video.videoHeight * scale);
    canvas.width = scanWidth;
    canvas.height = scanHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, scanWidth, scanHeight);
    const image = ctx.getImageData(0, 0, scanWidth, scanHeight);
    return jsQR(image.data, image.width, image.height)?.data ?? "";
  };

  const submitCurrentSheet = (qrRawValue: string) => {
    if (!answerKey) {
      setMessage("ยังไม่มีเฉลยของหน่วยนี้ กรุณาให้ครูบันทึกเฉลยก่อน");
      setState("error");
      return;
    }
    const imageDataUrl = captureFrame();
    if (!imageDataUrl) return;
    submittingRef.current = true;
    setState("submitting");
    setMessage("กำลังส่งรูปให้ระบบตรวจ...");
    submit.mutate({
      assignmentId: aId,
      categoryId: cId,
      answerKeyId: answerKey.id,
      qrRawValue,
      imageDataUrl,
    });
  };

  const scanLoop = async () => {
    const video = videoRef.current;
    if (!video || submittingRef.current) {
      loopRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    let rawValue = "";
    try {
      if (window.BarcodeDetector) {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const detected = await detector.detect(video);
        rawValue = detected[0]?.rawValue ?? "";
      }
    } catch {
      rawValue = "";
    }
    if (!rawValue) rawValue = scanWithJsQr();

    if (rawValue && rawValue !== lastQrRef.current) {
      lastQrRef.current = rawValue;
      setMessage("พบ QR แล้ว กำลังถ่ายภาพใบงาน");
      window.setTimeout(() => submitCurrentSheet(rawValue), 450);
    }

    loopRef.current = requestAnimationFrame(scanLoop);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("scanning");
      setMessage("วางใบงานให้ QR อยู่ในภาพ ระบบจะถ่ายให้อัตโนมัติ");
      scanLoop();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "เปิดกล้องไม่ได้"
      );
    }
  };

  const tone =
    state === "success"
      ? "border-green-300 bg-green-50 text-green-800"
      : state === "error"
        ? "border-red-300 bg-red-50 text-red-800"
        : "border-blue-300 bg-blue-50 text-blue-900";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">Smart Assignment Box</p>
          <h1 className="font-semibold">
            {assignment?.subject?.name ?? "กล่องส่งงาน"} · {category?.name ?? ""}
          </h1>
        </div>
        <Link href={`/assignment-box/${aId}/${cId}`}>
          <Button variant="secondary" size="sm">หน้าครู</Button>
        </Link>
      </header>

      <main className="p-4 space-y-4">
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full object-contain"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[72%] w-[82%] rounded-lg border-2 border-white/70" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className={`rounded-lg border px-4 py-3 ${tone}`}>
          <div className="flex items-center gap-2">
            {state === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : state === "error" ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <QrCode className="w-5 h-5" />
            )}
            <p className="font-medium">{message}</p>
          </div>
          {lastResult && (
            <p className="mt-1 text-sm">
              คะแนนแนะนำ {lastResult.suggestedScore} · confidence {lastResult.confidence}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={startCamera}
            className="h-12 bg-blue-600 hover:bg-blue-700"
            disabled={state === "submitting"}
          >
            <Camera className="w-4 h-4 mr-2" />
            เปิดกล้อง
          </Button>
          <Button
            variant="secondary"
            className="h-12"
            onClick={() => {
              lastQrRef.current = "";
              setLastResult(null);
              setMessage("พร้อมรับใบงานถัดไป");
              setState(streamRef.current ? "scanning" : "idle");
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            รีเซ็ต
          </Button>
        </div>
      </main>
    </div>
  );
}

import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ExternalLink, RefreshCw, Save, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

const DEFAULT_T568B = [
  "ขาวส้ม",
  "ส้ม",
  "ขาวเขียว",
  "น้ำเงิน",
  "ขาวน้ำเงิน",
  "เขียว",
  "ขาวน้ำตาล",
  "น้ำตาล",
];

function scoreText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export default function AssignmentBoxReview() {
  const { assignmentId, categoryId } = useParams<{
    assignmentId: string;
    categoryId: string;
  }>();
  const aId = Number(assignmentId);
  const cId = Number(categoryId);
  const utils = trpc.useUtils();

  const { data: assignment } = trpc.assignment.get.useQuery({ id: aId });
  const { data: categories = [] } = trpc.score.getCategories.useQuery({
    assignmentId: aId,
  });
  const category = categories.find(cat => cat.id === cId);
  const { data: answerKeys = [] } = trpc.assignmentBox.getAnswerKeys.useQuery(
    { categoryId: cId },
    { enabled: Number.isFinite(cId) }
  );
  const activeKey = answerKeys[0];
  const { data: submissions = [], isLoading: submissionsLoading } =
    trpc.assignmentBox.getSubmissions.useQuery(
      { categoryId: cId },
      {
        enabled: Number.isFinite(cId),
        refetchInterval: 5000,
      }
    );

  const [answers, setAnswers] = useState(DEFAULT_T568B);
  const [minConfidence, setMinConfidence] = useState("0.85");

  useEffect(() => {
    if (!activeKey?.answers) return;
    const pins = (activeKey.answers as any).pins;
    if (!Array.isArray(pins)) return;
    setAnswers(
      Array.from({ length: 8 }, (_, index) => {
        const pin = pins.find((item: any) => item.pin === index + 1);
        return pin?.accepted?.[0] ?? DEFAULT_T568B[index];
      })
    );
    setMinConfidence(activeKey.autoScoreMinConfidence?.toString() ?? "0.85");
  }, [activeKey]);

  const maxScore = category?.maxScore?.toString() ?? "8";
  const perPinScore = useMemo(() => Number(maxScore || 0) / 8, [maxScore]);

  const saveAnswerKey = trpc.assignmentBox.saveAnswerKey.useMutation({
    onSuccess: () => {
      toast.success("บันทึกเฉลยเรียบร้อย");
      utils.assignmentBox.getAnswerKeys.invalidate({ categoryId: cId });
    },
    onError: error => toast.error(error.message),
  });

  const reviewSubmission = trpc.assignmentBox.review.useMutation({
    onSuccess: () => {
      toast.success("บันทึกผลตรวจเรียบร้อย");
      utils.assignmentBox.getSubmissions.invalidate({ categoryId: cId });
      utils.score.getByAssignment.invalidate({ assignmentId: aId });
    },
    onError: error => toast.error(error.message),
  });

  const handleSaveKey = () => {
    saveAnswerKey.mutate({
      id: activeKey?.id,
      assignmentId: aId,
      categoryId: cId,
      title: category?.name ? `เฉลย ${category.name}` : "เฉลย T568B",
      maxScore,
      autoScoreMinConfidence: minConfidence,
      template: "network_boarding_pass_t568b",
      isActive: true,
      answers: {
        pins: answers.map((answer, index) => ({
          pin: index + 1,
          accepted: answer
            .split(",")
            .map(value => value.trim())
            .filter(Boolean),
          score: Math.round(perPinScore * 100) / 100,
        })),
      },
    });
  };

  return (
    <TeacherLayout
      title={`กล่องส่งงาน - ${category?.name ?? ""}`}
      backHref={`/scores/${aId}`}
    >
      <div className="space-y-5">
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">เฉลยใบงาน Boarding Pass</h2>
              <p className="text-sm text-slate-500">
                ตั้งคำตอบที่ยอมรับได้ของ Pin 1-8 ใช้คอมม่าแยกคำตอบหลายรูปแบบ
              </p>
            </div>
            <Link href={`/submission-box/${aId}/${cId}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-1" />
                เปิดหน้ามือถือ
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {answers.map((answer, index) => (
              <div key={index}>
                <Label className="text-xs">Pin {index + 1}</Label>
                <Input
                  value={answer}
                  onChange={event => {
                    const next = [...answers];
                    next[index] = event.target.value;
                    setAnswers(next);
                  }}
                  className="mt-1"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Label className="text-xs">Confidence ขั้นต่ำ</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={minConfidence}
                onChange={event => setMinConfidence(event.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleSaveKey}
              disabled={saveAnswerKey.isPending || !category}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-1" />
              {saveAnswerKey.isPending ? "กำลังบันทึก..." : "บันทึกเฉลย"}
            </Button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">งานที่ส่งจากกล่อง</h2>
              <p className="text-sm text-slate-500">
                ระบบลงคะแนนเองเฉพาะใบที่มั่นใจสูง ใบอื่นให้ครูยืนยันตรงนี้
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                utils.assignmentBox.getSubmissions.invalidate({ categoryId: cId })
              }
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              รีเฟรช
            </Button>
          </div>

          {submissionsLoading ? (
            <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">ยังไม่มีงานที่ส่ง</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map((submission: any) => {
                const student = submission.student;
                const matched = Array.isArray(submission.matchedAnswers)
                  ? submission.matchedAnswers
                  : [];
                const suggested = scoreText(submission.suggestedScore);
                return (
                  <div key={submission.id} className="p-4 grid gap-4 lg:grid-cols-[220px_1fr_220px]">
                    <img
                      src={submission.imageDataUrl}
                      alt="ใบงานที่ส่ง"
                      className="w-full rounded border border-slate-200 bg-slate-50 object-contain"
                    />
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {student
                            ? `${student.prefix ?? ""}${student.firstName} ${student.lastName}`
                            : "ไม่พบนักเรียนจาก QR"}
                        </p>
                        <p className="text-xs text-slate-500">
                          สถานะ: {submission.status} · คะแนนแนะนำ {suggested} · confidence{" "}
                          {scoreText(submission.confidence)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {matched.map((item: any) => (
                          <div
                            key={item.pin}
                            className={`rounded border p-2 text-xs ${
                              item.correct
                                ? "border-green-200 bg-green-50"
                                : "border-amber-200 bg-amber-50"
                            }`}
                          >
                            <p className="font-medium">Pin {item.pin}</p>
                            <p>อ่านได้: {item.detected || "-"}</p>
                            <p>{item.correct ? "ถูก" : "รอตรวจ"}</p>
                          </div>
                        ))}
                      </div>
                      {submission.aiFeedback && (
                        <p className="text-sm text-slate-600">{submission.aiFeedback}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        defaultValue={
                          submission.confirmedScore ??
                          submission.suggestedScore ??
                          ""
                        }
                        id={`score-${submission.id}`}
                        step="0.5"
                        min="0"
                        max={maxScore}
                      />
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={reviewSubmission.isPending || !student}
                        onClick={() => {
                          const input = document.getElementById(
                            `score-${submission.id}`
                          ) as HTMLInputElement | null;
                          reviewSubmission.mutate({
                            id: submission.id,
                            status: "confirmed",
                            score: input?.value || suggested,
                          });
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        ยืนยันคะแนน
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full text-red-600"
                        disabled={reviewSubmission.isPending}
                        onClick={() =>
                          reviewSubmission.mutate({
                            id: submission.id,
                            status: "rejected",
                            score: null,
                            note: "ครูปฏิเสธผลตรวจ",
                          })
                        }
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        ไม่ลงคะแนน
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </TeacherLayout>
  );
}

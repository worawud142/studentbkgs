import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { FileText, Download, FileDown, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

const templateDownloads = [
  {
    title: "ตัวอย่างมัธยม.xlsx",
    description: "ไฟล์ตัวอย่างสำหรับงานระดับมัธยมศึกษา",
    href: "/api/templates/secondary-demo",
    badge: "มัธยม",
  },
  {
    title: "เก็บคะแนนประถม.xlsx",
    description: "ไฟล์ตัวอย่างสำหรับงานเก็บคะแนนระดับประถมศึกษา",
    href: "/api/templates/primary-score",
    badge: "ประถม",
  },
  {
    title: "ปพ.5 ส่งวิชาการ",
    description: "ไฟล์ต้นแบบสำหรับเอกสารที่ส่งงานวิชาการ",
    href: "/api/templates/academic-print",
    badge: "ปพ.5",
  },
];

export default function DocumentsPage() {
  const { data: assignments = [], isLoading: assignmentsLoading } =
    trpc.assignment.myList.useQuery({});
  const por6Classrooms = useMemo(() => {
    const map = new Map<number, any>();
    assignments.forEach((assignment: any) => {
      const classroom = assignment.classroom;
      const classroomId = assignment.assignment?.classroomId;
      if (!classroomId || !classroom) return;
      if (!map.has(classroomId)) map.set(classroomId, classroom);
    });
    return Array.from(map.entries()).map(([id, classroom]) => ({
      id,
      classroom,
    }));
  }, [assignments]);
  const recordExport = trpc.document.recordExport.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const handleExportAcademicPrint = async (assignment: any) => {
    const href = `/api/templates/academic-print?export=1&assignmentId=${assignment.assignment.id}`;
    try {
      await recordExport.mutateAsync({
        assignmentId: assignment.assignment.id,
        documentType: "por5",
        fileUrl: href,
      });
    } finally {
      window.location.href = href;
    }
  };

  return (
    <TeacherLayout title="เอกสาร ปพ.">
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-900">พิมพ์ ปพ.6 รวมทั้งห้องเรียน</p>
              <p className="text-sm text-slate-500">
                เปิดหน้าพิมพ์ ปพ.6 รายบุคคลแบบรวมทั้งห้อง จากห้องเรียนที่คุณสอน
              </p>
            </div>
          </div>

          {assignmentsLoading ? (
            <div className="text-center py-8 text-slate-400">กำลังโหลดห้องเรียน...</div>
          ) : por6Classrooms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              ยังไม่มีห้องเรียนที่สอน
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {por6Classrooms.map(({ id, classroom }) => (
                <a
                  key={id}
                  href={`/print/por6/classroom/${id}`}
                  className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        ปพ.6 ทั้งห้อง · {classroom?.level === "primary" ? "ประถม" : "มัธยม"}
                      </span>
                      <p className="mt-2 font-semibold text-slate-900">
                        ห้อง {classroom?.name || "-"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        คลิกเพื่อเปิดหน้าพิมพ์ / Save PDF
                      </p>
                    </div>
                    <FileText className="w-4 h-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:text-emerald-600" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileDown className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-900">ไฟล์ต้นแบบสำหรับดาวน์โหลด</p>
              <p className="text-sm text-slate-500">
                ดาวน์โหลดไฟล์ต้นฉบับจากโฟลเดอร์ตัวอย่างได้โดยตรง
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {templateDownloads.map((template) => (
              <a
                key={template.title}
                href={template.href}
                download
                className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {template.badge}
                    </span>
                    <p className="mt-2 font-semibold text-slate-900">{template.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{template.description}</p>
                  </div>
                  <Download className="w-4 h-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:text-blue-600" />
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-900">ส่งออก ปพ.5 ตามรายวิชาที่สอน</p>
              <p className="text-sm text-slate-500">
                เลือกรายวิชาเพื่อสร้างไฟล์ ปพ.5 ที่เติมคะแนนและข้อมูลห้องเรียนล่าสุด
              </p>
            </div>
          </div>

          {assignmentsLoading ? (
            <div className="text-center py-8 text-slate-400">กำลังโหลดรายวิชา...</div>
          ) : assignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              ยังไม่มีรายวิชาที่สอน
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.assignment.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {assignment.subject?.name || "รายวิชา"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        ห้อง {assignment.classroom?.name || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {assignment.subject?.subjectCode || "-"} ·{" "}
                        {assignment.classroom?.level === "primary" ? "ประถม" : "มัธยม"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportAcademicPrint(assignment)}
                      disabled={recordExport.isPending}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="w-3 h-3" />
                      ปพ.5
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { FileText, Download, Calendar, FileDown, BookOpen } from "lucide-react";
import { toast } from "sonner";

type ListedDocument = {
  documentType?: string;
  metadata?: unknown;
};

function effectiveDocumentType(doc: ListedDocument) {
  const metadata =
    doc.metadata && typeof doc.metadata === "object"
      ? (doc.metadata as { documentType?: unknown })
      : null;
  return typeof metadata?.documentType === "string"
    ? metadata.documentType
    : doc.documentType ?? "";
}

function documentLabel(type: string) {
  if (type === "por1") return "ปพ.1";
  if (type === "por5") return "ปพ.5";
  return "ปพ.6";
}

function documentBadgeClass(type: string) {
  if (type === "por1") return "bg-blue-100 text-blue-700";
  if (type === "por5") return "bg-violet-100 text-violet-700";
  return "bg-green-100 text-green-700";
}

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
  const { data: documents = [], isLoading } = trpc.document.list.useQuery({});
  const { data: assignments = [], isLoading: assignmentsLoading } =
    trpc.assignment.myList.useQuery({});
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-blue-900 font-medium">เอกสารที่ส่งออกแล้ว</p>
          <p className="text-blue-600 text-sm mt-1">
            เอกสาร ปพ.1, ปพ.5 และ ปพ.6 ที่เคยสร้างไว้จะถูกเก็บที่นี่ สามารถดาวน์โหลดย้อนหลังได้
          </p>
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

        {isLoading ? (
          <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">ยังไม่มีเอกสาร</p>
            <p className="text-slate-400 text-sm mt-1">
              ไปที่หน้าคะแนนเพื่อสร้างเอกสาร ปพ.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">ประเภทเอกสาร</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">ชื่อเอกสาร</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium hidden md:table-cell">วันที่สร้าง</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => {
                  const type = effectiveDocumentType(doc);
                  return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${documentBadgeClass(type)}`}>
                        {documentLabel(type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{doc.title}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(doc.createdAt).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {doc.fileUrl ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          ดาวน์โหลด
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">ไม่มีไฟล์</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

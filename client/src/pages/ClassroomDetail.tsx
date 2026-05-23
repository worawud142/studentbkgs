import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Search, Edit2, Trash2, FileText, Upload, Download, QrCode } from "lucide-react";
import { useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { Link } from "wouter";

type StudentFormState = {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  gender: "male" | "female";
  studentNumber: string;
  birthDate: string;
};

const initialStudentForm: StudentFormState = {
  studentCode: "",
  prefix: "เด็กชาย",
  firstName: "",
  lastName: "",
  nationalId: "",
  gender: "male",
  studentNumber: "",
  birthDate: "",
};

function StudentFields({
  form,
  setForm,
  disableStudentCode = false,
}: {
  form: StudentFormState;
  setForm: React.Dispatch<React.SetStateAction<StudentFormState>>;
  disableStudentCode?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">รหัสนักเรียน *</Label>
          <Input
            value={form.studentCode}
            onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
            className="h-9 mt-1"
            required
            disabled={disableStudentCode}
          />
        </div>
        <div>
          <Label className="text-xs">เลขที่</Label>
          <Input
            type="number"
            value={form.studentNumber}
            onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
            className="h-9 mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">คำนำหน้า</Label>
          <Select value={form.prefix} onValueChange={(v) => setForm({ ...form, prefix: v })}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="เด็กชาย">เด็กชาย</SelectItem>
              <SelectItem value="เด็กหญิง">เด็กหญิง</SelectItem>
              <SelectItem value="นาย">นาย</SelectItem>
              <SelectItem value="นางสาว">นางสาว</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">ชื่อ *</Label>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-9 mt-1" required />
        </div>
        <div>
          <Label className="text-xs">นามสกุล *</Label>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-9 mt-1" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">เลขประจำตัวประชาชน</Label>
          <Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className="h-9 mt-1" maxLength={13} />
        </div>
        <div>
          <Label className="text-xs">วันเกิด</Label>
          <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="h-9 mt-1" />
        </div>
      </div>
    </>
  );
}

function StudentForm({
  onSubmit,
  isPending,
  form,
  setForm,
  disableStudentCode = false,
}: {
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  form: StudentFormState;
  setForm: React.Dispatch<React.SetStateAction<StudentFormState>>;
  disableStudentCode?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <StudentFields
        form={form}
        setForm={setForm}
        disableStudentCode={disableStudentCode}
      />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isPending}>
        {isPending ? "กำลังบันทึก..." : "บันทึก"}
      </Button>
    </form>
  );
}

export default function ClassroomDetail() {
  const { id } = useParams<{ id: string }>();
  const classroomId = parseInt(id);
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [addForm, setAddForm] = useState<StudentFormState>(initialStudentForm);
  const [editForm, setEditForm] = useState<StudentFormState>(initialStudentForm);
  const importInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: classroom } = trpc.classroom.get.useQuery({ id: classroomId });
  const { data: students = [], isLoading } = trpc.student.listByClassroom.useQuery({ classroomId });
  const importStudents = trpc.student.importFromExcel.useMutation({
    onSuccess: (result) => {
      toast.success(
        `นำเข้าข้อมูลแล้ว ${result.importedCount} แถว${result.skippedCount > 0 ? `, ข้าม ${result.skippedCount} แถว` : ""}`
      );
      if (result.warnings?.length) {
        toast.message("มีบางแถวที่ถูกข้าม");
      }
      utils.student.listByClassroom.invalidate({ classroomId });
      setImporting(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setImporting(false);
    },
  });

  const createStudent = trpc.student.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มนักเรียนเรียบร้อย");
      utils.student.listByClassroom.invalidate({ classroomId });
      setShowAdd(false);
      setAddForm(initialStudentForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStudent = trpc.student.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขข้อมูลเรียบร้อย");
      utils.student.listByClassroom.invalidate({ classroomId });
      setEditStudent(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteStudent = trpc.student.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบนักเรียนเรียบร้อย");
      utils.student.listByClassroom.invalidate({ classroomId });
    },
    onError: (e) => toast.error(e.message),
  });

  const resetAddForm = () => setAddForm(initialStudentForm);
  const openAddDialog = () => {
    resetAddForm();
    setShowAdd(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.studentCode || !addForm.firstName || !addForm.lastName) return toast.error("กรุณากรอกข้อมูลที่จำเป็น");
    createStudent.mutate({
      ...addForm,
      classroomId,
      studentNumber: addForm.studentNumber ? parseInt(addForm.studentNumber) : undefined,
      birthDate: addForm.birthDate || undefined,
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    updateStudent.mutate({
      id: editStudent.id,
      prefix: editForm.prefix,
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      nationalId: editForm.nationalId || undefined,
      gender: editForm.gender,
      studentNumber: editForm.studentNumber ? parseInt(editForm.studentNumber) : undefined,
      birthDate: editForm.birthDate || undefined,
    });
  };

  const openEdit = (s: any) => {
    setEditForm({
      studentCode: s.studentCode,
      prefix: s.prefix || "เด็กชาย",
      firstName: s.firstName,
      lastName: s.lastName,
      nationalId: s.nationalId || "",
      gender: s.gender || "male",
      studentNumber: s.studentNumber?.toString() || "",
      birthDate: s.birthDate || "",
    });
    setEditStudent(s);
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const fileContentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
            return;
          }
          const commaIndex = result.indexOf(",");
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("ไม่สามารถอ่านไฟล์ได้"));
        reader.readAsDataURL(file);
      });

      await importStudents.mutateAsync({
        classroomId,
        fileName: file.name,
        fileContentBase64,
      });
    } finally {
      setImporting(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.firstName.includes(search) ||
      s.lastName.includes(search) ||
      s.studentCode.includes(search)
  );

  return (
    <TeacherLayout
      title={classroom ? `ห้อง ${classroom.name}` : "รายชื่อนักเรียน"}
      backHref="/dashboard"
    >
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                {classroom?.name} · {students.length} คน
              </h2>
              <p className="text-slate-500 text-xs">
                {classroom?.level === "primary" ? "ระดับประถมศึกษา" : "ระดับมัธยมศึกษา"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {classroom && (
              <Link href={`/print/por6/classroom/${classroomId}`}>
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-1" />
                  ปพ.6
                </Button>
              </Link>
            )}
            <Link href={`/print/qr/${classroomId}`}>
              <Button variant="outline" size="sm">
                <QrCode className="w-4 h-4 mr-1" />
                พิมพ์ QR
              </Button>
            </Link>
            <Button asChild variant="outline" size="sm">
              <a href="/api/student-import-template">
                <Download className="w-4 h-4 mr-1" />
                โหลดเทมเพลต
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload className="w-4 h-4 mr-1" />
              {importing ? "กำลังนำเข้า..." : "นำเข้า Excel"}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={handleImportFile}
            />
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={openAddDialog}>
                  <Plus className="w-4 h-4 mr-1" />
                  เพิ่มนักเรียน
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>เพิ่มนักเรียน</DialogTitle>
                </DialogHeader>
                <StudentForm
                  onSubmit={handleAdd}
                  isPending={createStudent.isPending}
                  form={addForm}
                  setForm={setAddForm}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="ค้นหาชื่อ หรือรหัสนักเรียน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium w-12">เลขที่</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">รหัส</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium hidden md:table-cell">เลขประชาชน</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">ไม่พบนักเรียน</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 text-center">{s.studentNumber || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{s.studentCode}</td>
                    <td className="px-4 py-3">
                      <Link href={`/student/${s.id}`} className="text-slate-900 font-medium hover:text-blue-600 transition-colors">
                        {s.prefix}{s.firstName} {s.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell font-mono text-xs">
                      {s.nationalId || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Dialog open={editStudent?.id === s.id} onOpenChange={(open) => !open && setEditStudent(null)}>
                          <DialogTrigger asChild>
                            <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>แก้ไขข้อมูลนักเรียน</DialogTitle></DialogHeader>
                            <StudentForm
                              onSubmit={handleEdit}
                              isPending={updateStudent.isPending}
                              form={editForm}
                              setForm={setEditForm}
                              disableStudentCode
                            />
                          </DialogContent>
                        </Dialog>
                        <button
                          onClick={() => { if (confirm("ยืนยันการลบนักเรียน?")) deleteStudent.mutate({ id: s.id }); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TeacherLayout>
  );
}

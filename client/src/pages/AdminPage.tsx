import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Settings,
  BookOpen,
  Users,
  Calendar,
  GraduationCap,
  CheckCircle2,
  Edit2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAdminRole, roleLabel } from "@shared/roles";
import { useLocation } from "wouter";

export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  if (!isAdminRole(user?.role)) {
    return (
      <TeacherLayout title="ผู้ดูแลระบบ">
        <div className="text-center py-16">
          <Settings className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout title="ผู้ดูแลระบบ">
      <div className="space-y-5 animate-fade-in">
        <Tabs defaultValue="academic">
          <TabsList className="grid grid-cols-5 w-full max-w-4xl">
            <TabsTrigger value="academic">
              <Calendar className="w-3 h-3 mr-1" />
              ปีการศึกษา
            </TabsTrigger>
            <TabsTrigger value="classrooms">
              <Users className="w-3 h-3 mr-1" />
              ห้องเรียน
            </TabsTrigger>
            <TabsTrigger value="subjects">
              <BookOpen className="w-3 h-3 mr-1" />
              วิชา
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <GraduationCap className="w-3 h-3 mr-1" />
              มอบหมายวิชา
            </TabsTrigger>
            <TabsTrigger value="data">
              <Settings className="w-3 h-3 mr-1" />
              ข้อมูล
            </TabsTrigger>
          </TabsList>

          <TabsContent value="academic" className="mt-4">
            <AcademicYearTab />
          </TabsContent>
          <TabsContent value="classrooms" className="mt-4">
            <ClassroomsTab />
          </TabsContent>
          <TabsContent value="subjects" className="mt-4">
            <SubjectsTab />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab />
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            <SystemDataTab />
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  );
}

// ─── System Data Tab ─────────────────────────────────────────────────────────
function SystemDataTab() {
  const utils = trpc.useUtils();
  const { data: teacherRows = [] } = trpc.teacher.allProfiles.useQuery();
  const { data: userRows = [] } = trpc.teacher.allUsers.useQuery();
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [editTeacher, setEditTeacher] = useState<any>(null);
  const [resetTeacher, setResetTeacher] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const { data: schoolSettings } = trpc.schoolSettings.get.useQuery();
  const [schoolForm, setSchoolForm] = useState({
    schoolName: "",
    officeName: "",
    homeroomTeacherName: "",
    academicHeadName: "",
    directorName: "",
  });
  const [teacherForm, setTeacherForm] = useState({
    email: "",
    teacherCode: "",
    password: "",
    prefix: "",
    firstName: "",
    lastName: "",
    phone: "",
    teachingLevel: "secondary" as "primary" | "secondary" | "both",
    isHomeroom: false,
  });
  useEffect(() => {
    if (!schoolSettings) return;
    setSchoolForm({
      schoolName: schoolSettings.schoolName || "",
      officeName: schoolSettings.officeName || "",
      homeroomTeacherName: schoolSettings.homeroomTeacherName || "",
      academicHeadName: schoolSettings.academicHeadName || "",
      directorName: schoolSettings.directorName || "",
    });
  }, [schoolSettings]);
  const updateSchool = trpc.schoolSettings.update.useMutation({
    onSuccess: () => {
      toast.success("บันทึกตั้งค่าโรงเรียนเรียบร้อย");
      utils.schoolSettings.get.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateUserRole = trpc.teacher.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตสิทธิ์ผู้ใช้เรียบร้อย");
      utils.teacher.allUsers.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createTeacher = trpc.teacher.createAccount.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มครูเรียบร้อย");
      utils.teacher.allProfiles.invalidate();
      utils.teacher.allUsers.invalidate();
      setShowAddTeacher(false);
      setTeacherForm({
        email: "",
        teacherCode: "",
        password: "",
        prefix: "",
        firstName: "",
        lastName: "",
        phone: "",
        teachingLevel: "secondary",
        isHomeroom: false,
      });
    },
    onError: error => toast.error(error.message),
  });
  const updateTeacher = trpc.teacher.updateAccount.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตข้อมูลครูเรียบร้อย");
      utils.teacher.allProfiles.invalidate();
      utils.teacher.allUsers.invalidate();
      setEditTeacher(null);
    },
    onError: error => toast.error(error.message),
  });
  const deleteTeacher = trpc.teacher.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("ลบครูเรียบร้อย");
      utils.teacher.allProfiles.invalidate();
      utils.teacher.allUsers.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const resetTeacherPassword = trpc.teacher.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("รีเซ็ตรหัสผ่านเรียบร้อย");
      setResetTeacher(null);
      setResetPassword("");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">ตั้งค่าโรงเรียนสำหรับ ปพ.6</h3>
          <p className="text-xs text-slate-500 mt-1">
            ข้อมูลนี้จะใช้เป็นหัวเอกสารและรายชื่อผู้ลงนามในหน้าพิมพ์ ปพ.6
          </p>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            updateSchool.mutate(schoolForm);
          }}
          className="p-4 space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">ชื่อโรงเรียน *</Label>
              <Input
                value={schoolForm.schoolName}
                onChange={e =>
                  setSchoolForm({ ...schoolForm, schoolName: e.target.value })
                }
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs">สังกัด / เขตพื้นที่</Label>
              <Input
                value={schoolForm.officeName}
                onChange={e =>
                  setSchoolForm({ ...schoolForm, officeName: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">ครูประจำชั้น</Label>
              <Input
                value={schoolForm.homeroomTeacherName}
                onChange={e =>
                  setSchoolForm({
                    ...schoolForm,
                    homeroomTeacherName: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">หัวหน้างานวิชาการ</Label>
              <Input
                value={schoolForm.academicHeadName}
                onChange={e =>
                  setSchoolForm({
                    ...schoolForm,
                    academicHeadName: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">ผู้อำนวยการ</Label>
              <Input
                value={schoolForm.directorName}
                onChange={e =>
                  setSchoolForm({ ...schoolForm, directorName: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={updateSchool.isPending}
            >
              {updateSchool.isPending ? "กำลังบันทึก..." : "บันทึกตั้งค่า"}
            </Button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">ข้อมูลครู</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {teacherRows.length} รายการ
              </span>
              <Dialog open={showAddTeacher} onOpenChange={setShowAddTeacher}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" />
                    เพิ่มครู
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>เพิ่มครู</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      createTeacher.mutate(teacherForm);
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">รหัสครู / Username *</Label>
                        <Input
                          value={teacherForm.teacherCode}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              teacherCode: e.target.value,
                            })
                          }
                          className="mt-1"
                          required
                          placeholder="T001"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">อีเมล (ไม่บังคับ)</Label>
                        <Input
                          type="email"
                          value={teacherForm.email}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              email: e.target.value,
                            })
                          }
                          className="mt-1"
                          placeholder="ปล่อยว่างเพื่อใช้รหัสครูเป็นอีเมลระบบ"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">รหัสผ่านเริ่มต้น *</Label>
                      <Input
                        type="password"
                        value={teacherForm.password}
                        onChange={e =>
                          setTeacherForm({
                            ...teacherForm,
                            password: e.target.value,
                          })
                        }
                        className="mt-1"
                        required
                        placeholder="กำหนดรหัสผ่านให้ครูใช้เข้าสู่ระบบ"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">คำนำหน้า</Label>
                        <Input
                          value={teacherForm.prefix}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              prefix: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ชื่อ *</Label>
                        <Input
                          value={teacherForm.firstName}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              firstName: e.target.value,
                            })
                          }
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs">นามสกุล *</Label>
                        <Input
                          value={teacherForm.lastName}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              lastName: e.target.value,
                            })
                          }
                          className="mt-1"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">เบอร์โทรศัพท์</Label>
                        <Input
                          value={teacherForm.phone}
                          onChange={e =>
                            setTeacherForm({
                              ...teacherForm,
                              phone: e.target.value,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ระดับสอน *</Label>
                        <Select
                          value={teacherForm.teachingLevel}
                          onValueChange={v =>
                            setTeacherForm({
                              ...teacherForm,
                              teachingLevel: v as any,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">ประถม</SelectItem>
                            <SelectItem value="secondary">มัธยม</SelectItem>
                            <SelectItem value="both">ทั้งสองระดับ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="teacher-is-homeroom"
                        checked={teacherForm.isHomeroom}
                        onChange={e =>
                          setTeacherForm({
                            ...teacherForm,
                            isHomeroom: e.target.checked,
                          })
                        }
                      />
                      <Label
                        htmlFor="teacher-is-homeroom"
                        className="text-sm cursor-pointer"
                      >
                        เป็นครูประจำชั้น
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={createTeacher.isPending}
                    >
                      {createTeacher.isPending ? "กำลังเพิ่ม..." : "บันทึก"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">
                    ชื่อ
                  </th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">
                    อีเมล
                  </th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">
                    ระดับสอน
                  </th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherRows.map(row => (
                  <tr key={row.profile.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {row.profile.prefix || ""}
                      {row.profile.firstName} {row.profile.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.user?.email || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.profile.teachingLevel === "primary"
                            ? "badge-primary-level"
                            : row.profile.teachingLevel === "both"
                              ? "bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold"
                              : "badge-secondary-level"
                        }
                      >
                        {row.profile.teachingLevel === "primary"
                          ? "ประถม"
                          : row.profile.teachingLevel === "both"
                            ? "ทั้งสอง"
                            : "มัธยม"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            setEditTeacher({
                              userId: row.profile.userId,
                              email: row.user?.email || "",
                              teacherCode: row.profile.teacherCode || "",
                              prefix: row.profile.prefix || "",
                              firstName: row.profile.firstName,
                              lastName: row.profile.lastName,
                              phone: row.profile.phone || "",
                              teachingLevel: row.profile.teachingLevel,
                              isHomeroom: row.profile.isHomeroom,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="แก้ไขข้อมูลครู"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setResetTeacher({
                              userId: row.profile.userId,
                              name: `${row.profile.prefix || ""}${row.profile.firstName} ${row.profile.lastName}`.trim(),
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="รีเซ็ตรหัสผ่าน"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `ลบครู ${row.profile.prefix || ""}${row.profile.firstName} ${row.profile.lastName} ?`
                              )
                            ) {
                              deleteTeacher.mutate({
                                userId: row.profile.userId,
                              });
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="ลบครู"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {teacherRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      ยังไม่มีข้อมูลครู
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">ข้อมูลผู้ใช้</h3>
            <span className="text-xs text-slate-500">
              {userRows.length} รายการ
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">
                    ชื่อ
                  </th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">
                    อีเมล
                  </th>
                  <th className="text-center px-4 py-3 text-slate-600 font-medium">
                    สิทธิ์
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userRows.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {user.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={
                            user.role === "admin"
                              ? "bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold"
                              : user.role === "reviewer"
                                ? "bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-semibold"
                                : "bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold"
                          }
                        >
                          {roleLabel(user.role)}
                        </span>
                        <Select
                          value={user.role === "user" ? "teacher" : user.role}
                          onValueChange={(
                            value: "teacher" | "admin" | "reviewer"
                          ) =>
                            updateUserRole.mutate({
                              userId: user.id,
                              role: value,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teacher">ครู</SelectItem>
                            <SelectItem value="reviewer">ผู้ตรวจสอบ</SelectItem>
                            <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
                {userRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      ยังไม่มีข้อมูลผู้ใช้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(editTeacher)}
        onOpenChange={open => {
          if (!open) setEditTeacher(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลครู</DialogTitle>
          </DialogHeader>
          {editTeacher && (
            <form
              onSubmit={e => {
                e.preventDefault();
                updateTeacher.mutate(editTeacher);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">รหัสครู / Username *</Label>
                  <Input
                    value={editTeacher.teacherCode}
                    onChange={e =>
                      setEditTeacher({
                        ...editTeacher,
                        teacherCode: e.target.value,
                      })
                    }
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">อีเมล</Label>
                  <Input
                    type="email"
                    value={editTeacher.email}
                    onChange={e =>
                      setEditTeacher({ ...editTeacher, email: e.target.value })
                    }
                    className="mt-1"
                    placeholder="ปล่อยว่างเพื่อใช้รหัสครูเป็นอีเมลระบบ"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">คำนำหน้า</Label>
                  <Input
                    value={editTeacher.prefix}
                    onChange={e =>
                      setEditTeacher({ ...editTeacher, prefix: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">ชื่อ *</Label>
                  <Input
                    value={editTeacher.firstName}
                    onChange={e =>
                      setEditTeacher({
                        ...editTeacher,
                        firstName: e.target.value,
                      })
                    }
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">นามสกุล *</Label>
                  <Input
                    value={editTeacher.lastName}
                    onChange={e =>
                      setEditTeacher({
                        ...editTeacher,
                        lastName: e.target.value,
                      })
                    }
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">เบอร์โทรศัพท์</Label>
                  <Input
                    value={editTeacher.phone}
                    onChange={e =>
                      setEditTeacher({ ...editTeacher, phone: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">ระดับสอน *</Label>
                  <Select
                    value={editTeacher.teachingLevel}
                    onValueChange={v =>
                      setEditTeacher({ ...editTeacher, teachingLevel: v })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">ประถม</SelectItem>
                      <SelectItem value="secondary">มัธยม</SelectItem>
                      <SelectItem value="both">ทั้งสองระดับ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-teacher-is-homeroom"
                  checked={editTeacher.isHomeroom}
                  onChange={e =>
                    setEditTeacher({
                      ...editTeacher,
                      isHomeroom: e.target.checked,
                    })
                  }
                />
                <Label
                  htmlFor="edit-teacher-is-homeroom"
                  className="text-sm cursor-pointer"
                >
                  เป็นครูประจำชั้น
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={updateTeacher.isPending}
              >
                {updateTeacher.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetTeacher)}
        onOpenChange={open => {
          if (!open) {
            setResetTeacher(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รีเซ็ตรหัสผ่านครู</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!resetTeacher) return;
              resetTeacherPassword.mutate({
                userId: resetTeacher.userId,
                password: resetPassword,
              });
            }}
            className="space-y-3"
          >
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
              กำลังรีเซ็ตรหัสผ่านของ:{" "}
              <span className="font-semibold text-slate-900">
                {resetTeacher?.name}
              </span>
            </div>
            <div>
              <Label className="text-xs">รหัสผ่านใหม่ *</Label>
              <Input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="mt-1"
                required
                placeholder="รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={resetTeacherPassword.isPending}
            >
              {resetTeacherPassword.isPending
                ? "กำลังบันทึก..."
                : "รีเซ็ตรหัสผ่าน"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Academic Year Tab ─────────────────────────────────────────────────────────
function AcademicYearTab() {
  const utils = trpc.useUtils();
  const { data: years = [] } = trpc.academicYear.list.useQuery({});
  const [showAdd, setShowAdd] = useState(false);
  const [editYear, setEditYear] = useState<any>(null);
  const [form, setForm] = useState({
    year: new Date().getFullYear() + 543,
    semester: "1",
    level: "secondary" as "primary" | "secondary",
    isActive: false,
  });
  const [editForm, setEditForm] = useState({
    year: new Date().getFullYear() + 543,
    semester: "1",
    level: "secondary" as "primary" | "secondary",
    isActive: false,
  });

  const create = trpc.academicYear.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มปีการศึกษาเรียบร้อย");
      utils.academicYear.list.invalidate({});
      setShowAdd(false);
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.academicYear.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขปีการศึกษาเรียบร้อย");
      utils.academicYear.list.invalidate({});
      setEditYear(null);
    },
    onError: e => toast.error(e.message),
  });
  const setActive = trpc.academicYear.setActive.useMutation({
    onSuccess: () => {
      toast.success("ตั้งค่าปีการศึกษาที่ใช้งานเรียบร้อย");
      utils.academicYear.list.invalidate({});
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.academicYear.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบปีการศึกษาเรียบร้อย");
      utils.academicYear.list.invalidate({});
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900">ปีการศึกษา</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มปีการศึกษา
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มปีการศึกษา</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                create.mutate({
                  year: form.year,
                  semester:
                    form.level === "secondary"
                      ? parseInt(form.semester)
                      : undefined,
                  level: form.level,
                  isActive: form.isActive,
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ปีการศึกษา (พ.ศ.) *</Label>
                  <Input
                    type="number"
                    value={form.year}
                    onChange={e =>
                      setForm({ ...form, year: parseInt(e.target.value) })
                    }
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">ภาคเรียน (มัธยมเท่านั้น)</Label>
                  <Select
                    value={form.level === "secondary" ? form.semester : ""}
                    onValueChange={v => setForm({ ...form, semester: v })}
                    disabled={form.level !== "secondary"}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue
                        placeholder={
                          form.level === "secondary" ? "เลือกภาคเรียน" : "-"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">ระดับ *</Label>
                <Select
                  value={form.level}
                  onValueChange={v => setForm({ ...form, level: v as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">ประถมศึกษา</SelectItem>
                    <SelectItem value="secondary">มัธยมศึกษา</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={e =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                <Label htmlFor="isActive" className="text-sm cursor-pointer">
                  ตั้งเป็นปีการศึกษาที่ใช้งาน
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={create.isPending}
              >
                บันทึก
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ปีการศึกษา
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ภาคเรียน
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ระดับ
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                สถานะ
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {years.map(y => (
              <tr key={y.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{y.year}</td>
                <td className="px-4 py-3 text-slate-600">
                  {y.semester || "-"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      y.level === "primary"
                        ? "badge-primary-level"
                        : "badge-secondary-level"
                    }
                  >
                    {y.level === "primary" ? "ประถม" : "มัธยม"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {y.isActive ? (
                    <span className="flex items-center justify-center gap-1 text-green-600 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ใช้งาน
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">ไม่ใช้งาน</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Dialog
                      open={editYear?.id === y.id}
                      onOpenChange={open => !open && setEditYear(null)}
                    >
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            setEditForm({
                              year: y.year,
                              semester: y.semester ? String(y.semester) : "",
                              level: y.level,
                              isActive: y.isActive,
                            });
                            setEditYear(y);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>แก้ไขปีการศึกษา</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            update.mutate({
                              id: y.id,
                              year: editForm.year,
                              semester:
                                editForm.level === "secondary"
                                  ? parseInt(editForm.semester)
                                  : undefined,
                              level: editForm.level,
                              isActive: editForm.isActive,
                            });
                          }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">
                                ปีการศึกษา (พ.ศ.) *
                              </Label>
                              <Input
                                type="number"
                                value={editForm.year}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    year: parseInt(e.target.value),
                                  })
                                }
                                className="mt-1"
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">ภาคเรียน</Label>
                              <Select
                                value={
                                  editForm.level === "secondary"
                                    ? editForm.semester
                                    : ""
                                }
                                onValueChange={v =>
                                  setEditForm({ ...editForm, semester: v })
                                }
                                disabled={editForm.level !== "secondary"}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue
                                    placeholder={
                                      editForm.level === "secondary"
                                        ? "เลือกภาคเรียน"
                                        : "-"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">ระดับ *</Label>
                            <Select
                              value={editForm.level}
                              onValueChange={v =>
                                setEditForm({ ...editForm, level: v as any })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">
                                  ประถมศึกษา
                                </SelectItem>
                                <SelectItem value="secondary">
                                  มัธยมศึกษา
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`active-${y.id}`}
                              checked={editForm.isActive}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  isActive: e.target.checked,
                                })
                              }
                            />
                            <Label
                              htmlFor={`active-${y.id}`}
                              className="text-sm cursor-pointer"
                            >
                              ตั้งเป็นปีการศึกษาที่ใช้งาน
                            </Label>
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={update.isPending}
                          >
                            บันทึก
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    {!y.isActive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() =>
                            setActive.mutate({ id: y.id, level: y.level })
                          }
                        >
                          ตั้งเป็นปัจจุบัน
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm("ลบปีการศึกษานี้?"))
                              del.mutate({ id: y.id });
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="ลบปีการศึกษา"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {y.isActive && (
                      <span className="text-[11px] text-slate-400">
                        ต้องเปลี่ยนปีที่ใช้งานก่อนลบ
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Classrooms Tab ────────────────────────────────────────────────────────────
function ClassroomsTab() {
  const utils = trpc.useUtils();
  const { data: classrooms = [] } = trpc.classroom.list.useQuery({});
  const { data: years = [] } = trpc.academicYear.list.useQuery({});
  const { data: teachers = [] } = trpc.teacher.allProfiles.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [editClassroom, setEditClassroom] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    level: "secondary" as "primary" | "secondary",
    grade: "1",
    room: "1",
    academicYearId: "",
    homeroomTeacherId: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    level: "secondary" as "primary" | "secondary",
    grade: "1",
    room: "1",
    academicYearId: "",
    homeroomTeacherId: "",
  });

  const create = trpc.classroom.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มห้องเรียนเรียบร้อย");
      utils.classroom.list.invalidate({});
      setShowAdd(false);
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.classroom.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขห้องเรียนเรียบร้อย");
      utils.classroom.list.invalidate({});
      setEditClassroom(null);
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.classroom.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบห้องเรียนเรียบร้อย");
      utils.classroom.list.invalidate({});
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900">ห้องเรียน</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มห้องเรียน
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มห้องเรียน</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!form.academicYearId)
                  return toast.error("กรุณาเลือกปีการศึกษา");
                create.mutate({
                  name:
                    form.name ||
                    `${form.level === "primary" ? "ป" : "ม"}.${form.grade}/${form.room}`,
                  level: form.level,
                  grade: parseInt(form.grade),
                  room: parseInt(form.room),
                  academicYearId: parseInt(form.academicYearId),
                  homeroomTeacherId: form.homeroomTeacherId
                    ? parseInt(form.homeroomTeacherId)
                    : undefined,
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label className="text-xs">ระดับ *</Label>
                <Select
                  value={form.level}
                  onValueChange={v => setForm({ ...form, level: v as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">
                      ประถมศึกษา (ป.1-ป.6)
                    </SelectItem>
                    <SelectItem value="secondary">
                      มัธยมศึกษา (ม.1-ม.6)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ชั้น *</Label>
                  <Select
                    value={form.grade}
                    onValueChange={v => setForm({ ...form, grade: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(g => (
                        <SelectItem key={g} value={String(g)}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">ห้อง *</Label>
                  <Input
                    type="number"
                    value={form.room}
                    onChange={e => setForm({ ...form, room: e.target.value })}
                    className="mt-1"
                    min="1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  ชื่อห้อง (ปล่อยว่างเพื่อสร้างอัตโนมัติ)
                </Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                  placeholder="เช่น ม.3/2"
                />
              </div>
              <div>
                <Label className="text-xs">ปีการศึกษา *</Label>
                <Select
                  value={form.academicYearId}
                  onValueChange={v => setForm({ ...form, academicYearId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกปีการศึกษา" />
                  </SelectTrigger>
                  <SelectContent>
                    {years
                      .filter(y => y.level === form.level)
                      .map(y => (
                        <SelectItem key={y.id} value={String(y.id)}>
                          {y.year}
                          {y.semester ? ` ภาค ${y.semester}` : ""} (
                          {y.level === "primary" ? "ประถม" : "มัธยม"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ครูประจำชั้น</Label>
                <Select
                  value={form.homeroomTeacherId}
                  onValueChange={v =>
                    setForm({ ...form, homeroomTeacherId: v })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกครูประจำชั้น" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem
                        key={t.profile.id}
                        value={String(t.user?.id ?? t.profile.userId)}
                      >
                        {t.profile.prefix}
                        {t.profile.firstName} {t.profile.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={create.isPending}
              >
                บันทึก
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ห้องเรียน
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ระดับ
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium hidden md:table-cell">
                ปีการศึกษา
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classrooms.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      c.level === "primary"
                        ? "badge-primary-level"
                        : "badge-secondary-level"
                    }
                  >
                    {c.level === "primary" ? "ประถม" : "มัธยม"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                  {c.academicYearId}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Dialog
                      open={editClassroom?.id === c.id}
                      onOpenChange={open => !open && setEditClassroom(null)}
                    >
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            setEditForm({
                              name: c.name,
                              level: c.level,
                              grade: String(c.grade),
                              room: String(c.room),
                              academicYearId: String(c.academicYearId),
                              homeroomTeacherId: c.homeroomTeacherId
                                ? String(c.homeroomTeacherId)
                                : "",
                            });
                            setEditClassroom(c);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>แก้ไขห้องเรียน</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            update.mutate({
                              id: c.id,
                              name:
                                editForm.name ||
                                `${editForm.level === "primary" ? "ป" : "ม"}.${editForm.grade}/${editForm.room}`,
                              level: editForm.level,
                              grade: parseInt(editForm.grade),
                              room: parseInt(editForm.room),
                              academicYearId: parseInt(editForm.academicYearId),
                              homeroomTeacherId: editForm.homeroomTeacherId
                                ? parseInt(editForm.homeroomTeacherId)
                                : undefined,
                            });
                          }}
                          className="space-y-3"
                        >
                          <div>
                            <Label className="text-xs">ระดับ *</Label>
                            <Select
                              value={editForm.level}
                              onValueChange={v =>
                                setEditForm({ ...editForm, level: v as any })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">
                                  ประถมศึกษา (ป.1-ป.6)
                                </SelectItem>
                                <SelectItem value="secondary">
                                  มัธยมศึกษา (ม.1-ม.6)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">ชั้น *</Label>
                              <Select
                                value={editForm.grade}
                                onValueChange={v =>
                                  setEditForm({ ...editForm, grade: v })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6].map(g => (
                                    <SelectItem key={g} value={String(g)}>
                                      {g}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">ห้อง *</Label>
                              <Input
                                type="number"
                                value={editForm.room}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    room: e.target.value,
                                  })
                                }
                                className="mt-1"
                                min="1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">ชื่อห้อง</Label>
                            <Input
                              value={editForm.name}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                              className="mt-1"
                              placeholder="เช่น ม.3/2"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">ปีการศึกษา *</Label>
                            <Select
                              value={editForm.academicYearId}
                              onValueChange={v =>
                                setEditForm({ ...editForm, academicYearId: v })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="เลือกปีการศึกษา" />
                              </SelectTrigger>
                              <SelectContent>
                                {years
                                  .filter(y => y.level === editForm.level)
                                  .map(y => (
                                    <SelectItem key={y.id} value={String(y.id)}>
                                      {y.year}
                                      {y.semester ? ` ภาค ${y.semester}` : ""} (
                                      {y.level === "primary"
                                        ? "ประถม"
                                        : "มัธยม"}
                                      )
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">ครูประจำชั้น</Label>
                            <Select
                              value={editForm.homeroomTeacherId}
                              onValueChange={v =>
                                setEditForm({
                                  ...editForm,
                                  homeroomTeacherId: v,
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="เลือกครูประจำชั้น" />
                              </SelectTrigger>
                              <SelectContent>
                                {teachers.map(t => (
                                  <SelectItem
                                    key={t.profile.id}
                                    value={String(
                                      t.user?.id ?? t.profile.userId
                                    )}
                                  >
                                    {t.profile.prefix}
                                    {t.profile.firstName} {t.profile.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={update.isPending}
                          >
                            บันทึก
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <button
                      onClick={() => {
                        if (confirm("ลบห้องเรียนนี้?"))
                          del.mutate({ id: c.id });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Subjects Tab ──────────────────────────────────────────────────────────────
function SubjectsTab() {
  const utils = trpc.useUtils();
  const { data: subjects = [] } = trpc.subject.list.useQuery({});
  const [showAdd, setShowAdd] = useState(false);
  const [editSubject, setEditSubject] = useState<any>(null);
  const [form, setForm] = useState({
    subjectCode: "",
    name: "",
    credits: "1.0",
    level: "secondary" as "primary" | "secondary" | "both",
    subjectGroup: "",
    gradeGroup: "",
  });
  const [editForm, setEditForm] = useState({
    subjectCode: "",
    name: "",
    credits: "1.0",
    level: "secondary" as "primary" | "secondary" | "both",
    subjectGroup: "",
    gradeGroup: "",
  });

  const create = trpc.subject.create.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มวิชาเรียบร้อย");
      utils.subject.list.invalidate({});
      setShowAdd(false);
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.subject.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขวิชาเรียบร้อย");
      utils.subject.list.invalidate({});
      setEditSubject(null);
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.subject.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบวิชาเรียบร้อย");
      utils.subject.list.invalidate({});
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900">รายวิชา</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              เพิ่มวิชา
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มรายวิชา</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                create.mutate(form);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">รหัสวิชา *</Label>
                  <Input
                    value={form.subjectCode}
                    onChange={e =>
                      setForm({ ...form, subjectCode: e.target.value })
                    }
                    className="mt-1"
                    required
                    placeholder="เช่น ท21101"
                  />
                </div>
                <div>
                  <Label className="text-xs">หน่วยกิต</Label>
                  <Input
                    value={form.credits}
                    onChange={e =>
                      setForm({ ...form, credits: e.target.value })
                    }
                    className="mt-1"
                    placeholder="1.0"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">ชื่อวิชา *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1"
                  required
                  placeholder="เช่น ภาษาไทย"
                />
              </div>
              <div>
                <Label className="text-xs">ระดับ *</Label>
                <Select
                  value={form.level}
                  onValueChange={v => setForm({ ...form, level: v as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">ประถมศึกษา</SelectItem>
                    <SelectItem value="secondary">มัธยมศึกษา</SelectItem>
                    <SelectItem value="both">ทั้งสองระดับ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">กลุ่มสาระ</Label>
                  <Input
                    value={form.subjectGroup}
                    onChange={e =>
                      setForm({ ...form, subjectGroup: e.target.value })
                    }
                    className="mt-1"
                    placeholder="เช่น ภาษาไทย"
                  />
                </div>
                <div>
                  <Label className="text-xs">ระดับชั้น</Label>
                  <Input
                    value={form.gradeGroup}
                    onChange={e =>
                      setForm({ ...form, gradeGroup: e.target.value })
                    }
                    className="mt-1"
                    placeholder="เช่น ม.1-ม.3"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={create.isPending}
              >
                บันทึก
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                รหัส
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ชื่อวิชา
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ระดับ
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                หน่วยกิต
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {s.subjectCode}
                </td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      s.level === "primary"
                        ? "badge-primary-level"
                        : s.level === "both"
                          ? "bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold"
                          : "badge-secondary-level"
                    }
                  >
                    {s.level === "primary"
                      ? "ประถม"
                      : s.level === "both"
                        ? "ทั้งสอง"
                        : "มัธยม"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {s.credits || "-"}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Dialog
                      open={editSubject?.id === s.id}
                      onOpenChange={open => !open && setEditSubject(null)}
                    >
                      <DialogTrigger asChild>
                        <button
                          onClick={() => {
                            setEditForm({
                              subjectCode: s.subjectCode,
                              name: s.name,
                              credits: s.credits?.toString() || "1.0",
                              level: s.level,
                              subjectGroup: s.subjectGroup || "",
                              gradeGroup: s.gradeGroup || "",
                            });
                            setEditSubject(s);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>แก้ไขรายวิชา</DialogTitle>
                        </DialogHeader>
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            update.mutate({
                              id: s.id,
                              subjectCode: editForm.subjectCode,
                              name: editForm.name,
                              credits: editForm.credits,
                              level: editForm.level,
                              subjectGroup: editForm.subjectGroup || undefined,
                              gradeGroup: editForm.gradeGroup || undefined,
                            });
                          }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">รหัสวิชา *</Label>
                              <Input
                                value={editForm.subjectCode}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    subjectCode: e.target.value,
                                  })
                                }
                                className="mt-1"
                                required
                                placeholder="เช่น ท21101"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">หน่วยกิต</Label>
                              <Input
                                value={editForm.credits}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    credits: e.target.value,
                                  })
                                }
                                className="mt-1"
                                placeholder="1.0"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">ชื่อวิชา *</Label>
                            <Input
                              value={editForm.name}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  name: e.target.value,
                                })
                              }
                              className="mt-1"
                              required
                              placeholder="เช่น ภาษาไทย"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">ระดับ *</Label>
                            <Select
                              value={editForm.level}
                              onValueChange={v =>
                                setEditForm({ ...editForm, level: v as any })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">
                                  ประถมศึกษา
                                </SelectItem>
                                <SelectItem value="secondary">
                                  มัธยมศึกษา
                                </SelectItem>
                                <SelectItem value="both">
                                  ทั้งสองระดับ
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">กลุ่มสาระ</Label>
                              <Input
                                value={editForm.subjectGroup}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    subjectGroup: e.target.value,
                                  })
                                }
                                className="mt-1"
                                placeholder="เช่น ภาษาไทย"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">ระดับชั้น</Label>
                              <Input
                                value={editForm.gradeGroup}
                                onChange={e =>
                                  setEditForm({
                                    ...editForm,
                                    gradeGroup: e.target.value,
                                  })
                                }
                                className="mt-1"
                                placeholder="เช่น ม.1-ม.3"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={update.isPending}
                          >
                            บันทึก
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <button
                      onClick={() => {
                        if (confirm("ลบวิชานี้?")) del.mutate({ id: s.id });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab() {
  const utils = trpc.useUtils();
  const { data: teachers = [] } = trpc.teacher.allProfiles.useQuery();
  const { data: subjects = [] } = trpc.subject.list.useQuery({});
  const { data: classrooms = [] } = trpc.classroom.list.useQuery({});
  const { data: years = [] } = trpc.academicYear.list.useQuery({});
  const { data: assignments = [] } = trpc.assignment.listAll.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [editAssignment, setEditAssignment] = useState<any>(null);
  const [form, setForm] = useState({
    teacherId: "",
    subjectId: "",
    classroomId: "",
    academicYearId: "",
  });
  const [editForm, setEditForm] = useState({
    teacherId: "",
    subjectId: "",
    classroomId: "",
    academicYearId: "",
    hoursPerWeek: "",
  });

  const create = trpc.assignment.create.useMutation({
    onSuccess: () => {
      toast.success("มอบหมายวิชาเรียบร้อย");
      utils.assignment.listAll.invalidate();
      setShowAdd(false);
      setForm({
        teacherId: "",
        subjectId: "",
        classroomId: "",
        academicYearId: "",
      });
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.assignment.update.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขการมอบหมายเรียบร้อย");
      utils.assignment.listAll.invalidate();
      setEditAssignment(null);
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.assignment.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบการมอบหมายเรียบร้อย");
      utils.assignment.listAll.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const selectedTeacherSubjects = assignments
    .filter(a => String(a.assignment.teacherId) === form.teacherId)
    .map(a =>
      `${a.subject?.subjectCode || "-"} ${a.subject?.name || ""}`.trim()
    )
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-900">มอบหมายวิชาให้ครู</h3>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              มอบหมายวิชา
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>มอบหมายวิชาให้ครู</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (
                  !form.teacherId ||
                  !form.subjectId ||
                  !form.classroomId ||
                  !form.academicYearId
                )
                  return toast.error("กรุณากรอกข้อมูลให้ครบ");
                create.mutate({
                  teacherId: parseInt(form.teacherId),
                  subjectId: parseInt(form.subjectId),
                  classroomId: parseInt(form.classroomId),
                  academicYearId: parseInt(form.academicYearId),
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label className="text-xs">ครู *</Label>
                <Select
                  value={form.teacherId}
                  onValueChange={v => setForm({ ...form, teacherId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกครู" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem
                        key={t.profile.id}
                        value={String(t.user?.id ?? t.profile.userId)}
                      >
                        {t.profile.prefix}
                        {t.profile.firstName} {t.profile.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.teacherId && (
                  <p className="text-xs text-slate-500 mt-1">
                    วิชาที่ครูคนนี้มีอยู่แล้ว:{" "}
                    {selectedTeacherSubjects.length > 0
                      ? selectedTeacherSubjects.join(", ")
                      : "ยังไม่มี"}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">วิชา *</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={v => setForm({ ...form, subjectId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกวิชา" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.subjectCode} - {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ห้องเรียน *</Label>
                <Select
                  value={form.classroomId}
                  onValueChange={v => setForm({ ...form, classroomId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกห้องเรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} ({c.level === "primary" ? "ประถม" : "มัธยม"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ปีการศึกษา *</Label>
                <Select
                  value={form.academicYearId}
                  onValueChange={v => setForm({ ...form, academicYearId: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกปีการศึกษา" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y.id} value={String(y.id)}>
                        {y.year}
                        {y.semester ? ` ภาค ${y.semester}` : ""} (
                        {y.level === "primary" ? "ประถม" : "มัธยม"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={create.isPending}
              >
                บันทึก
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ครู
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                วิชา
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium">
                ห้อง
              </th>
              <th className="text-left px-4 py-3 text-slate-600 font-medium hidden md:table-cell">
                ปีการศึกษา
              </th>
              <th className="text-center px-4 py-3 text-slate-600 font-medium">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  ยังไม่มีการมอบหมายวิชา
                </td>
              </tr>
            ) : (
              assignments.map(a => {
                const teacherName =
                  `${a.teacherProfile?.prefix || ""}${a.teacherProfile?.firstName || a.teacher?.name || ""} ${a.teacherProfile?.lastName || ""}`.trim();
                const classroomName = a.classroom?.name || "-";
                const academicYearLabel = a.academicYear
                  ? `${a.academicYear.year}${a.academicYear.semester ? ` ภาค ${a.academicYear.semester}` : ""}`
                  : "-";
                const subjectLabel =
                  `${a.subject?.subjectCode || "-"} ${a.subject?.name || ""}`.trim();
                return (
                  <tr key={a.assignment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {teacherName || "-"}
                    </td>
                    <td className="px-4 py-3">{subjectLabel}</td>
                    <td className="px-4 py-3">{classroomName}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {academicYearLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Dialog
                          open={
                            editAssignment?.assignment?.id === a.assignment.id
                          }
                          onOpenChange={open =>
                            !open && setEditAssignment(null)
                          }
                        >
                          <DialogTrigger asChild>
                            <button
                              onClick={() => {
                                setEditForm({
                                  teacherId: String(a.assignment.teacherId),
                                  subjectId: String(a.assignment.subjectId),
                                  classroomId: String(a.assignment.classroomId),
                                  academicYearId: String(
                                    a.assignment.academicYearId
                                  ),
                                  hoursPerWeek:
                                    a.assignment.hoursPerWeek?.toString() || "",
                                });
                                setEditAssignment(a);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>แก้ไขการมอบหมายวิชา</DialogTitle>
                            </DialogHeader>
                            <form
                              onSubmit={e => {
                                e.preventDefault();
                                update.mutate({
                                  id: a.assignment.id,
                                  teacherId: editForm.teacherId
                                    ? parseInt(editForm.teacherId)
                                    : undefined,
                                  subjectId: parseInt(editForm.subjectId),
                                  classroomId: parseInt(editForm.classroomId),
                                  academicYearId: parseInt(
                                    editForm.academicYearId
                                  ),
                                  hoursPerWeek: editForm.hoursPerWeek
                                    ? parseInt(editForm.hoursPerWeek)
                                    : undefined,
                                });
                              }}
                              className="space-y-3"
                            >
                              <div>
                                <Label className="text-xs">ครู *</Label>
                                <Select
                                  value={editForm.teacherId}
                                  onValueChange={v =>
                                    setEditForm({ ...editForm, teacherId: v })
                                  }
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="เลือกครู" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teachers.map(t => (
                                      <SelectItem
                                        key={t.profile.id}
                                        value={String(
                                          t.user?.id ?? t.profile.userId
                                        )}
                                      >
                                        {t.profile.prefix}
                                        {t.profile.firstName}{" "}
                                        {t.profile.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">วิชา *</Label>
                                <Select
                                  value={editForm.subjectId}
                                  onValueChange={v =>
                                    setEditForm({ ...editForm, subjectId: v })
                                  }
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="เลือกวิชา" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {subjects.map(s => (
                                      <SelectItem
                                        key={s.id}
                                        value={String(s.id)}
                                      >
                                        {s.subjectCode} - {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">ห้องเรียน *</Label>
                                <Select
                                  value={editForm.classroomId}
                                  onValueChange={v =>
                                    setEditForm({ ...editForm, classroomId: v })
                                  }
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="เลือกห้องเรียน" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {classrooms.map(c => (
                                      <SelectItem
                                        key={c.id}
                                        value={String(c.id)}
                                      >
                                        {c.name} (
                                        {c.level === "primary"
                                          ? "ประถม"
                                          : "มัธยม"}
                                        )
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">ปีการศึกษา *</Label>
                                <Select
                                  value={editForm.academicYearId}
                                  onValueChange={v =>
                                    setEditForm({
                                      ...editForm,
                                      academicYearId: v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="เลือกปีการศึกษา" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {years.map(y => (
                                      <SelectItem
                                        key={y.id}
                                        value={String(y.id)}
                                      >
                                        {y.year}
                                        {y.semester
                                          ? ` ภาค ${y.semester}`
                                          : ""}{" "}
                                        (
                                        {y.level === "primary"
                                          ? "ประถม"
                                          : "มัธยม"}
                                        )
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">
                                  ชั่วโมงต่อสัปดาห์
                                </Label>
                                <Input
                                  type="number"
                                  value={editForm.hoursPerWeek}
                                  onChange={e =>
                                    setEditForm({
                                      ...editForm,
                                      hoursPerWeek: e.target.value,
                                    })
                                  }
                                  className="mt-1"
                                  min="1"
                                />
                              </div>
                              <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700"
                                disabled={update.isPending}
                              >
                                บันทึก
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <button
                          onClick={() => {
                            if (confirm("ลบการมอบหมายนี้?"))
                              del.mutate({ id: a.assignment.id });
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

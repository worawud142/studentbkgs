import { useAuth } from "@/_core/hooks/useAuth";
import TeacherLayout from "@/components/TeacherLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { isAdminRole } from "@shared/roles";
import {
  Activity,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Trash2,
  TimerReset,
  Wifi,
  WifiOff,
  QrCode,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type QrBoxFormState = {
  name: string;
  assignmentId: string;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// The ESP32 reports every 30 seconds. Allow a small network-delay margin,
// then mark it offline without making the admin wait several minutes.
const QR_BOX_ONLINE_WINDOW_MS = 45 * 1000;
const QR_BOX_REFRESH_INTERVAL_MS = 30 * 1000;

function isOnline(lastSeenAt?: string | Date | null, now = Date.now()) {
  if (!lastSeenAt) return false;
  const diff = now - new Date(lastSeenAt).getTime();
  return Number.isFinite(diff) && diff < QR_BOX_ONLINE_WINDOW_MS;
}

function assignmentLabel(row: any) {
  const subject = row?.subject?.name ?? "-";
  const classroom = row?.classroom?.name ?? "-";
  const academicYear = row?.academicYear?.year ?? "";
  const semester = row?.academicYear?.semester ? ` ภาค ${row.academicYear.semester}` : "";
  return `${subject} · ${classroom}${academicYear ? ` · ${academicYear}${semester}` : ""}`;
}

function dayOfWeekLongLabel(dayOfWeek: number) {
  return [
    "อาทิตย์",
    "จันทร์",
    "อังคาร",
    "พุธ",
    "พฤหัสบดี",
    "ศุกร์",
    "เสาร์",
  ][dayOfWeek] || "-";
}

export default function QrBoxPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<QrBoxFormState>({ name: "", assignmentId: "" });
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const classroomIdHint = Number(new URLSearchParams(window.location.search).get("classroomId") || 0);

  useEffect(() => {
    const timer = window.setInterval(() => setStatusNow(Date.now()), 10 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: devices = [], isLoading: devicesLoading } = trpc.qrBox.list.useQuery(undefined, {
    refetchInterval: QR_BOX_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const { data: selectedDeviceDetails } = trpc.qrBox.get.useQuery(
    { id: Number(selectedDeviceId) },
    {
      enabled: selectedDeviceId !== "all",
      refetchInterval: QR_BOX_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    }
  );
  const { data: assignments = [] } = trpc.assignment.listAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const visibleAssignments = useMemo(() => {
    if (!classroomIdHint) return assignments;
    return assignments.filter((row: any) => row.assignment?.classroomId === classroomIdHint);
  }, [assignments, classroomIdHint]);

  const logQuery = trpc.qrBox.logs.useQuery(
    {
      deviceId: selectedDeviceId === "all" ? undefined : Number(selectedDeviceId),
      limit: 50,
    },
    {
      refetchInterval: QR_BOX_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    }
  );

  const createMutation = trpc.qrBox.create.useMutation({
    onSuccess: async result => {
      toast.success("สร้างกล่องสแกนแล้ว");
      await utils.qrBox.list.invalidate();
      setCreateOpen(false);
      setForm({ name: "", assignmentId: "" });
      setSelectedDeviceId(String(result.id));
      await navigator.clipboard.writeText(result.token).catch(() => {});
      toast.message("คัดลอก token ใหม่ไว้ให้แล้ว");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.qrBox.update.useMutation({
    onSuccess: async () => {
      toast.success("บันทึกการตั้งค่ากล่องแล้ว");
      await utils.qrBox.list.invalidate();
      setEditingDevice(null);
    },
    onError: error => toast.error(error.message),
  });

  const rotateMutation = trpc.qrBox.rotateToken.useMutation({
    onSuccess: async result => {
      toast.success("หมุน token ใหม่แล้ว");
      await navigator.clipboard.writeText(result.token).catch(() => {});
      toast.message("token ใหม่ถูกคัดลอกแล้ว");
      await utils.qrBox.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.qrBox.delete.useMutation({
    onSuccess: async () => {
      toast.success("ลบกล่องสแกนแล้ว");
      await utils.qrBox.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const closeSessionMutation = trpc.qrBox.closeSession.useMutation({
    onSuccess: async () => {
      toast.success("ปิด session ครูเรียบร้อย");
      await utils.qrBox.list.invalidate();
      if (selectedDeviceId !== "all") {
        await utils.qrBox.get.invalidate({ id: Number(selectedDeviceId) });
      }
    },
    onError: error => toast.error(error.message),
  });

  if (!isAdminRole(user?.role)) {
    return (
      <TeacherLayout title="กล่องสแกน QR" backHref="/dashboard">
        <div className="py-16 text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-slate-200" />
          <p className="text-slate-500">หน้านี้สำหรับผู้ดูแลระบบ</p>
        </div>
      </TeacherLayout>
    );
  }

  const selectedDevice =
    selectedDeviceId === "all"
      ? null
      : selectedDeviceDetails ??
        devices.find((device: any) => String(device.id) === selectedDeviceId) ??
        null;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("กรุณาตั้งชื่อกล่องสแกน");
      return;
    }
    if (!form.assignmentId) {
      toast.error("กรุณาเลือกวิชา/ห้องเรียน");
      return;
    }
    if (editingDevice) {
      await updateMutation.mutateAsync({
        id: editingDevice.id,
        name: form.name.trim(),
        assignmentId: Number(form.assignmentId),
      });
      return;
    }
    await createMutation.mutateAsync({
      name: form.name.trim(),
      assignmentId: Number(form.assignmentId),
    });
  };

  const openCreateDialog = () => {
    setEditingDevice(null);
    setForm({
      name: "",
      assignmentId: visibleAssignments[0]?.assignment?.id
        ? String(visibleAssignments[0].assignment.id)
        : "",
    });
    setCreateOpen(true);
  };

  const openEditDialog = (device: any) => {
    setEditingDevice(device);
    setForm({
      name: device.name ?? "",
      assignmentId: String(device.assignmentId ?? ""),
    });
    setCreateOpen(true);
  };

  return (
    <TeacherLayout title="กล่องสแกน QR" backHref="/dashboard">
      <div className="space-y-5 animate-fade-in">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">QR Box Console</p>
              <h1 className="mt-2 text-2xl font-bold">จัดการกล่องสแกนเช็คชื่อ</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                ผูกกล่องกับวิชา/ห้องเรียน, ดูสถานะออนไลน์, คัดลอก token, และเปิด log ล่าสุดจากหน้าเดียว
              </p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="bg-white text-slate-950 hover:bg-slate-100">
                  <Plus className="mr-2 h-4 w-4" />
                  สร้างกล่องใหม่
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingDevice ? "แก้ไขกล่องสแกน" : "สร้างกล่องสแกน"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>ชื่อกล่อง</Label>
                    <Input
                      value={form.name}
                      onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                      placeholder="เช่น หน้าอาคาร 1 / ป.4/2"
                    />
                  </div>
                  <div>
                    <Label>วิชา / ห้องเรียน</Label>
                    <Select
                      value={form.assignmentId}
                      onValueChange={value => setForm(current => ({ ...current, assignmentId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือก assignment" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleAssignments.map((row: any) => (
                          <SelectItem key={row.assignment.id} value={String(row.assignment.id)}>
                            {assignmentLabel(row)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      ยกเลิก
                    </Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {editingDevice ? "บันทึก" : "สร้าง"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <QrCode className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{devices.length}</p>
                  <p className="text-xs text-slate-500">กล่องทั้งหมด</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{devices.filter((device: any) => isOnline(device.lastSeenAt, statusNow)).length}</p>
                  <p className="text-xs text-slate-500">ออนไลน์</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{logQuery.data?.length ?? 0}</p>
                  <p className="text-xs text-slate-500">log ล่าสุด</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                  <LinkIcon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{visibleAssignments.length}</p>
                  <p className="text-xs text-slate-500">assignment ที่พร้อมผูก</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>กล่องสแกน</CardTitle>
              <CardDescription>
                {classroomIdHint
                  ? `กรองเฉพาะ assignment ของห้อง ${classroomIdHint}`
                  : "ทุกกล่องที่มีอยู่ในระบบ"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {devicesLoading ? (
                <div className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
              ) : devices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  ยังไม่มีกล่องสแกน
                </div>
              ) : (
                devices.map((device: any) => {
                  const online = isOnline(device.lastSeenAt, statusNow);
                  const endpointBase = window.location.origin;
                  const scanUrl = `${endpointBase}/api/qr-boxes/${device.id}/scan`;
                  const pingUrl = `${endpointBase}/api/qr-boxes/${device.id}/ping`;
                  const configUrl = `${endpointBase}/api/qr-boxes/${device.id}/config`;
                  const isSelected = String(device.id) === selectedDeviceId;
                  return (
                    <div
                      key={device.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isSelected ? "border-blue-300 bg-blue-50/50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{device.name}</h3>
                            <Badge className={online ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                              {online ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                              {online ? "ออนไลน์" : "ออฟไลน์"}
                            </Badge>
                            <Badge variant={device.isActive ? "default" : "secondary"}>
                              {device.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">{assignmentLabel(device.assignment)}</p>
                          {device.activeTimetableAssignment?.assignment && (
                            <p className="text-xs text-indigo-600">
                              คาบปัจจุบัน: {device.activeTimetableAssignment.slot?.label || "คาบ"} ·{" "}
                              {assignmentLabel(device.activeTimetableAssignment.assignment)}
                            </p>
                          )}
                          <p className="text-xs text-slate-400">
                            last seen {formatDateTime(device.lastSeenAt)} · last scan {formatDateTime(device.lastScanAt)}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium text-slate-700">scan</span> {scanUrl}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium text-slate-700">ping</span> {pingUrl}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium text-slate-700">config</span> {configUrl}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedDeviceId(String(device.id))}>
                            ดู log
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(device)}>
                            แก้ไข
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await rotateMutation.mutateAsync({ id: device.id });
                            }}
                            disabled={rotateMutation.isPending}
                          >
                            <RefreshCcw className="mr-1 h-4 w-4" />
                            หมุน token
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm(`ลบกล่อง ${device.name} ?`)) return;
                              await deleteMutation.mutateAsync({ id: device.id });
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            ลบ
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Log ล่าสุด</CardTitle>
              <CardDescription>
                {selectedDevice ? `เฉพาะกล่อง ${selectedDevice.name}` : "ทุกกล่อง"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกกล่อง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกกล่อง</SelectItem>
                    {devices.map((device: any) => (
                      <SelectItem key={device.id} value={String(device.id)}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => logQuery.refetch()}>
                  รีเฟรช
                </Button>
              </div>
              {logQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</div>
              ) : (logQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  ยังไม่มี log
                </div>
              ) : (
                <div className="space-y-2">
                  {logQuery.data?.map((row: any) => {
                    const status = String(row.log.status);
                    const statusStyle =
                      status === "success"
                        ? "bg-green-100 text-green-700"
                        : status === "not_found"
                          ? "bg-red-100 text-red-700"
                          : status === "ping"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600";
                    return (
                      <div key={row.log.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={statusStyle}>{status}</Badge>
                              <span className="text-sm font-medium text-slate-900">{row.device?.name ?? "-"}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {row.student
                                ? `${row.student.prefix ?? ""}${row.student.firstName} ${row.student.lastName}`
                                : row.log.message ?? row.log.rawValue}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {row.subject?.name ?? "-"} · {row.classroom?.name ?? "-"} · {formatDateTime(row.log.scannedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedDevice && (
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลกล่องที่เลือก</CardTitle>
              <CardDescription>ลิงก์และการตั้งค่าที่ ESP32-S3 ใช้ได้ทันที</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {selectedDevice.activeTimetableAssignment?.assignment && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
                  <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">คาบตามตารางสอนตอนนี้</p>
                  <p className="mt-1 font-semibold">
                    {selectedDevice.activeTimetableAssignment.slot?.label || "คาบ"}
                  </p>
                  <p className="text-sm text-indigo-700">
                    {assignmentLabel(selectedDevice.activeTimetableAssignment.assignment)}
                  </p>
                  <p className="text-xs text-indigo-600">
                    {dayOfWeekLongLabel(selectedDevice.activeTimetableAssignment.slot?.dayOfWeek ?? 0)} ·{" "}
                    {selectedDevice.activeTimetableAssignment.slot?.startTime} - {selectedDevice.activeTimetableAssignment.slot?.endTime}
                  </p>
                </div>
              )}
              {selectedDevice.activeSession ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Session ครูที่เปิดอยู่</p>
                      <p className="mt-1 font-semibold">
                        {selectedDevice.activeSession.teacherProfile
                          ? `${selectedDevice.activeSession.teacherProfile.prefix ?? ""}${selectedDevice.activeSession.teacherProfile.firstName} ${selectedDevice.activeSession.teacherProfile.lastName}`
                          : `ครู userId ${selectedDevice.activeSession.teacherUserId}`}
                      </p>
                      <p className="text-sm text-emerald-700">
                        {assignmentLabel(selectedDevice.activeSession.assignment)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await closeSessionMutation.mutateAsync({ deviceId: selectedDevice.id });
                      }}
                      disabled={closeSessionMutation.isPending}
                    >
                      <TimerReset className="mr-1 h-4 w-4" />
                      ปิดคาบ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-slate-600">
                  ยังไม่มี session ครูที่เปิดอยู่
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Scan Endpoint</p>
                  <p className="font-mono break-all text-slate-900">{`${window.location.origin}/api/qr-boxes/${selectedDevice.id}/scan`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Ping Endpoint</p>
                  <p className="font-mono break-all text-slate-900">{`${window.location.origin}/api/qr-boxes/${selectedDevice.id}/ping`}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Config Endpoint</p>
                  <p className="font-mono break-all text-slate-900">{`${window.location.origin}/api/qr-boxes/${selectedDevice.id}/config`}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">คำแนะนำสำหรับ ESP32-S3</p>
                <p className="mt-1 text-sm text-slate-600">
                  ตั้งค่าให้ส่ง `rawValue` ที่อ่านจาก GM65 ไปยัง scan endpoint พร้อม header
                  `x-device-token` หรือ `Authorization: Bearer ...`
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherLayout>
  );
}

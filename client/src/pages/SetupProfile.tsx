import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function SetupProfile() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    prefix: "นาย",
    firstName: "",
    lastName: "",
    teacherCode: "",
    phone: "",
    teachingLevel: "secondary" as "primary" | "secondary" | "both",
    isHomeroom: false,
  });

  const upsert = trpc.teacher.upsertProfile.useMutation({
    onSuccess: () => {
      toast.success("บันทึกโปรไฟล์เรียบร้อยแล้ว");
      navigate("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!isAuthenticated) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) return toast.error("กรุณากรอกชื่อ-นามสกุล");
    upsert.mutate(form);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">ตั้งค่าโปรไฟล์ครู</h1>
          <p className="text-slate-500 text-sm mt-1">กรุณากรอกข้อมูลเพื่อเริ่มใช้งาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">คำนำหน้า</Label>
              <Select value={form.prefix} onValueChange={(v) => setForm({ ...form, prefix: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="นาย">นาย</SelectItem>
                  <SelectItem value="นาง">นาง</SelectItem>
                  <SelectItem value="นางสาว">นางสาว</SelectItem>
                  <SelectItem value="ดร.">ดร.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">ชื่อ *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="ชื่อจริง"
                className="h-9"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">นามสกุล *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="นามสกุล"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">รหัสครู</Label>
              <Input
                value={form.teacherCode}
                onChange={(e) => setForm({ ...form, teacherCode: e.target.value })}
                placeholder="เช่น T001"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">เบอร์โทรศัพท์</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08x-xxx-xxxx"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-600 mb-1 block">ระดับที่สอน *</Label>
            <Select
              value={form.teachingLevel}
              onValueChange={(v) => setForm({ ...form, teachingLevel: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">ประถมศึกษา (ป.1-ป.6)</SelectItem>
                <SelectItem value="secondary">มัธยมศึกษา (ม.1-ม.6)</SelectItem>
                <SelectItem value="both">ทั้งประถมและมัธยม</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              id="homeroom"
              checked={form.isHomeroom}
              onChange={(e) => setForm({ ...form, isHomeroom: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="homeroom" className="text-sm text-slate-700 cursor-pointer">
              เป็นครูประจำชั้น (Homeroom Teacher)
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
            disabled={upsert.isPending}
          >
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            บันทึกและเริ่มใช้งาน
          </Button>
        </form>
      </div>
    </div>
  );
}

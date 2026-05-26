import { trpc } from "@/lib/trpc";
import TeacherLayout from "@/components/TeacherLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Save, Trash2, BookOpen, Award, FileText, Download, Edit2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { Link } from "wouter";

const templateByLevel = {
  secondary: {
    title: "ปพ.5 ส่งวิชาการ",
    description: "ดาวน์โหลดไฟล์ ปพ.5 ที่เติมข้อมูลจริงสำหรับระดับมัธยม",
    href: "/api/templates/academic-print?export=1",
  },
  primary: {
    title: "ปพ.5 ส่งวิชาการ",
    description: "ดาวน์โหลดไฟล์ ปพ.5 ที่เติมข้อมูลจริงสำหรับระดับประถม",
    href: "/api/templates/academic-print?export=1",
  },
} as const;

function sortScoreCategories(a: any, b: any) {
  return (a.order || 0) - (b.order || 0);
}

const TERM_OPTIONS = [
  { value: "midyear", label: "กลางปี" },
  { value: "endyear", label: "ปลายปี" },
] as const;

const FIXED_FINAL_CATEGORY_NAMES = ["ปลายภาค 1", "ปลายภาค 2", "กลางภาค", "ปลายภาค"];
const NORMALIZED_TOTAL_SCORE = 100;

function isFixedFinalCategory(category: { name?: string }) {
  return FIXED_FINAL_CATEGORY_NAMES.includes(category.name || "");
}

function sortPrimaryDisplayCategories(categories: any[]) {
  return [...categories].sort((a, b) => {
    const termRank = (term?: string) => (term === "endyear" ? 1 : 0);
    const fixedRank = (category: any) => (isFixedFinalCategory(category) ? 1 : 0);
    return (
      termRank(a.term) - termRank(b.term) ||
      fixedRank(a) - fixedRank(b) ||
      (a.order || 0) - (b.order || 0)
    );
  });
}

export default function ScorePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const aId = parseInt(assignmentId);
  const utils = trpc.useUtils();

  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: "", maxScore: "", term: "midyear" as "midyear" | "endyear" });
  const [editCat, setEditCat] = useState<any>(null);
  const [editCatForm, setEditCatForm] = useState({ name: "", maxScore: "", order: 0, term: "midyear" as "midyear" | "endyear" });
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [dirtyScoreKeys, setDirtyScoreKeys] = useState<Set<string>>(() => new Set());
  const [pendingSave, setPendingSave] = useState(false);

  const { data: assignment } = trpc.assignment.get.useQuery({ id: aId });
  const { data: students = [] } = trpc.student.listByClassroom.useQuery(
    { classroomId: assignment?.assignment.classroomId || 0 },
    { enabled: !!assignment }
  );
  const { data: categories = [], isLoading: catsLoading } = trpc.score.getCategories.useQuery({ assignmentId: aId });
  const { data: scores = [] } = trpc.score.getByAssignment.useQuery({ assignmentId: aId });
  const isSecondary = assignment?.classroom?.level === "secondary";
  const isPrimary = assignment?.classroom?.level === "primary";
  const displayCategories = isPrimary
    ? sortPrimaryDisplayCategories(categories)
    : [...categories].sort(sortScoreCategories);

  const createCategory = trpc.score.createCategory.useMutation({
    onSuccess: () => {
      toast.success("เพิ่มหน่วยคะแนนเรียบร้อย");
      utils.score.getCategories.invalidate({ assignmentId: aId });
      setShowAddCat(false);
      setCatForm({ name: "", maxScore: "", term: "midyear" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCategory = trpc.score.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("แก้ไขหน่วยคะแนนเรียบร้อย");
      utils.score.getCategories.invalidate({ assignmentId: aId });
      setEditCat(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCategory = trpc.score.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("ลบหน่วยคะแนนเรียบร้อย");
      utils.score.getCategories.invalidate({ assignmentId: aId });
      utils.score.getByAssignment.invalidate({ assignmentId: aId });
      setEditCat(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveScores = trpc.score.save.useMutation({
    onSuccess: (result) => {
      toast.success(`บันทึกคะแนนเรียบร้อย (${(result.inserted ?? 0) + (result.updated ?? 0)} รายการ)`);
      utils.score.getByAssignment.invalidate({ assignmentId: aId });
      utils.score.getGradeResults.invalidate({ assignmentId: aId });
      setDirtyScoreKeys(new Set());
      setPendingSave(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const recordExport = trpc.document.recordExport.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const saveGrade = trpc.score.saveGradeResult.useMutation({
    onSuccess: () => {
      utils.score.getGradeResults.invalidate({ assignmentId: aId });
    },
  });

  // Build score map from DB
  useEffect(() => {
    const map: Record<string, string> = {};
    scores.forEach((s) => {
      map[`${s.categoryId}-${s.studentId}`] = s.score?.toString() || "";
    });
    setScoreInputs(map);
    setDirtyScoreKeys(new Set());
    setPendingSave(false);
  }, [scores]);

  const handleScoreChange = (catId: number, studentId: number, value: string) => {
    const key = `${catId}-${studentId}`;
    setScoreInputs((prev) => ({ ...prev, [key]: value }));
    setDirtyScoreKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setPendingSave(true);
  };

  const handleSaveAll = () => {
    const records: { categoryId: number; studentId: number; score: string | null }[] = [];
    dirtyScoreKeys.forEach((key) => {
      const [categoryId, studentId] = key.split("-").map(Number);
      const val = scoreInputs[key];
      if (!Number.isFinite(categoryId) || !Number.isFinite(studentId)) return;
      records.push({ categoryId, studentId, score: val !== undefined && val !== "" ? val : null });
    });
    if (records.length === 0) {
      setPendingSave(false);
      toast.info("ไม่มีคะแนนที่เปลี่ยนแปลง");
      return;
    }
    saveScores.mutate(records);
  };

  const handleExportAcademicPrint = async () => {
    const href = `${isSecondary ? templateByLevel.secondary.href : templateByLevel.primary.href}&assignmentId=${aId}`;
    try {
      await recordExport.mutateAsync({
        assignmentId: aId,
        documentType: "por5",
        fileUrl: href,
      });
    } finally {
      window.location.href = href;
    }
  };

  // Calculate total score for a student
  const calcTotal = (studentId: number) => {
    if (categories.length === 0) return null;
    let total = 0;
    let maxTotal = 0;
    categories.forEach((cat) => {
      const key = `${cat.id}-${studentId}`;
      const val = parseFloat(scoreInputs[key] || "0") || 0;
      const max = parseFloat(cat.maxScore?.toString() || "0");
      total += val;
      maxTotal += max;
    });
    const normalizedTotal =
      maxTotal > 0 ? (total / maxTotal) * NORMALIZED_TOTAL_SCORE : 0;
    return {
      rawTotal: Math.round(total * 100) / 100,
      rawMax: Math.round(maxTotal * 100) / 100,
      total: Math.round(normalizedTotal * 100) / 100,
      max: NORMALIZED_TOTAL_SCORE,
    };
  };

  const scoreToGrade = (score: number, max: number): string => {
    const pct = max > 0 ? (score / max) * 100 : 0;
    if (pct >= 80) return "4";
    if (pct >= 75) return "3.5";
    if (pct >= 70) return "3";
    if (pct >= 65) return "2.5";
    if (pct >= 60) return "2";
    if (pct >= 55) return "1.5";
    if (pct >= 50) return "1";
    return "0";
  };

  const handleFinalizeAll = () => {
    students.forEach((s) => {
      const calc = calcTotal(s.id);
      if (!calc) return;
      const grade = scoreToGrade(calc.total, calc.max);
      saveGrade.mutate({
        assignmentId: aId,
        studentId: s.id,
        totalScore: calc.total.toString(),
        grade,
        result: parseFloat(grade) >= 1 ? "pass" : "fail",
        isFinalized: true,
      });
    });
    toast.success("ยืนยันผลการเรียนเรียบร้อย");
  };

  const termLabel = (term?: string) => TERM_OPTIONS.find((option) => option.value === term)?.label ?? "กลางปี";

  return (
    <TeacherLayout
      title={`คะแนน - ${assignment?.subject?.name || ""}`}
      backHref="/dashboard"
    >
      <div className="space-y-5 animate-fade-in">
        {/* Assignment Info */}
        {assignment && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">{assignment.subject?.name}</p>
                <p className="text-blue-600 text-sm">
                  ห้อง {assignment.classroom?.name} ·{" "}
                  {isSecondary ? "วัดผลรายภาคเรียน" : "วัดผลรายปี"}
                </p>
              </div>
            </div>
            {isSecondary && (
              <Link href={`/print/por1/${aId}`}>
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-1" />
                  ปพ.1
                </Button>
              </Link>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-slate-900">ไฟล์ ปพ.5 สำหรับส่งวิชาการ</p>
              <p className="text-sm text-slate-500">
                ดาวน์โหลดไฟล์ Excel ที่เติมข้อมูลจากคะแนนและเช็คชื่อของห้องนี้
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAcademicPrint}
              disabled={recordExport.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {recordExport.isPending ? "กำลังเตรียม..." : "ส่งออก ปพ.5"}
            </button>
          </div>
        </div>

        {/* Score Categories */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">หน่วยคะแนน</h3>
              <p className="text-xs text-slate-500">
                {isPrimary
                  ? "ครูกำหนดได้ว่าหมวดนี้วัดผลกลางปีหรือปลายปี"
                  : "มีหมวดกลางภาคและปลายภาคให้คงไว้ตามเทมเพลต"}
              </p>
            </div>
            <div className="flex gap-2">
              {pendingSave && (
                <Button
                  onClick={handleSaveAll}
                  disabled={saveScores.isPending}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {saveScores.isPending ? "กำลังบันทึก..." : "บันทึกคะแนน"}
                </Button>
              )}
              <Dialog open={showAddCat} onOpenChange={setShowAddCat}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" />
                    เพิ่มหน่วยคะแนน
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>เพิ่มหน่วยคะแนน</DialogTitle></DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!catForm.name || !catForm.maxScore) return toast.error("กรุณากรอกข้อมูลให้ครบ");
                      createCategory.mutate({
                        assignmentId: aId,
                        name: catForm.name,
                        maxScore: catForm.maxScore,
                        order: displayCategories.length,
                        ...(isPrimary ? { term: catForm.term } : {}),
                      });
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label className="text-xs">ชื่อหน่วย *</Label>
                      <Input
                        value={catForm.name}
                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                        placeholder="เช่น หน่วย 1, หน่วย 2"
                        className="mt-1"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">คะแนนเต็ม *</Label>
                        <Input
                          type="number"
                          value={catForm.maxScore}
                          onChange={(e) => setCatForm({ ...catForm, maxScore: e.target.value })}
                          placeholder="20"
                          className="mt-1"
                          required
                          min="0"
                        />
                      </div>
                      {isPrimary && (
                        <div>
                          <Label className="text-xs">วัดผล *</Label>
                          <select
                            value={catForm.term}
                            onChange={(e) => setCatForm({ ...catForm, term: e.target.value as "midyear" | "endyear" })}
                            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            {TERM_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={createCategory.isPending}>
                      {createCategory.isPending ? "กำลังเพิ่ม..." : "เพิ่มหน่วยคะแนน"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {catsLoading ? (
            <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>ยังไม่มีหน่วยคะแนน กดปุ่ม "เพิ่มหน่วยคะแนน" เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-600 font-medium sticky left-0 bg-slate-50 min-w-[180px]">นักเรียน</th>
                    {displayCategories.map((cat) => (
                      <th key={cat.id} className="text-center px-3 py-3 text-slate-600 font-medium min-w-[120px]">
                        <div className="flex items-center justify-center gap-1">
                          <span>{cat.name}</span>
                          <Dialog open={editCat?.id === cat.id} onOpenChange={(open) => !open && setEditCat(null)}>
                            <DialogTrigger asChild>
                              <button
                                onClick={() => {
                                  setEditCatForm({
                                    name: cat.name,
                                    maxScore: cat.maxScore?.toString() || "",
                                    order: cat.order || 0,
                                    term: (cat.term as "midyear" | "endyear") || "midyear",
                                  });
                                  setEditCat(cat);
                                }}
                                className="text-slate-300 hover:text-blue-500 transition-colors"
                                title="แก้ไขหน่วย"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader><DialogTitle>แก้ไขหน่วยคะแนน</DialogTitle></DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (!editCatForm.name || !editCatForm.maxScore) return toast.error("กรุณากรอกข้อมูลให้ครบ");
                                  updateCategory.mutate({
                                    id: cat.id,
                                    name: editCatForm.name,
                                    maxScore: editCatForm.maxScore,
                                    order: editCatForm.order,
                                    ...(isPrimary ? { term: editCatForm.term } : {}),
                                  });
                                }}
                                className="space-y-3"
                              >
                                <div>
                                  <Label className="text-xs">ชื่อหน่วย *</Label>
                                  <Input
                                    value={editCatForm.name}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
                                    placeholder="เช่น หน่วย 1, หน่วย 2"
                                    className="mt-1"
                                    required
                                    disabled={isFixedFinalCategory(cat)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">คะแนนเต็ม *</Label>
                                  <Input
                                    type="number"
                                    value={editCatForm.maxScore}
                                    onChange={(e) => setEditCatForm({ ...editCatForm, maxScore: e.target.value })}
                                    placeholder="20"
                                    className="mt-1"
                                    required
                                    min="0"
                                  />
                                </div>
                                {isPrimary && (
                                  <div>
                                    <Label className="text-xs">วัดผล *</Label>
                                    <select
                                      value={editCatForm.term}
                                      onChange={(e) => setEditCatForm({ ...editCatForm, term: e.target.value as "midyear" | "endyear" })}
                                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      disabled={isFixedFinalCategory(cat)}
                                    >
                                      {TERM_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={updateCategory.isPending}>
                                  {updateCategory.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <button
                            onClick={() => {
                              if (confirm(`ลบหน่วย "${cat.name}"? คะแนนที่บันทึกไว้ในหมวดนี้จะถูกลบด้วย`)) {
                                deleteCategory.mutate({ id: cat.id });
                              }
                            }}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="ลบหน่วย"
                            disabled={isFixedFinalCategory(cat)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-400 font-normal">
                          เต็ม {cat.maxScore}
                        </div>
                        {isPrimary && (
                          <div className="text-xs text-blue-500 font-normal">
                            {termLabel(cat.term)}
                          </div>
                        )}
                        {isFixedFinalCategory(cat) && (
                          <div className="text-xs text-amber-600 font-normal">
                            หมวดคงที่
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 text-slate-600 font-medium min-w-[100px]">รวม</th>
                    <th className="text-center px-3 py-3 text-slate-600 font-medium min-w-[80px]">เกรด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const calc = calcTotal(s.id);
                    const grade = calc ? scoreToGrade(calc.total, calc.max) : "-";
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 sticky left-0 bg-white">
                          <p className="font-medium text-slate-900 text-sm">{s.prefix}{s.firstName} {s.lastName}</p>
                          <p className="text-slate-400 text-xs">{s.studentCode}</p>
                        </td>
                        {displayCategories.map((cat) => {
                          const key = `${cat.id}-${s.id}`;
                          const max = parseFloat(cat.maxScore?.toString() || "0");
                          const val = parseFloat(scoreInputs[key] || "0") || 0;
                          const isOver = val > max;
                          return (
                            <td key={cat.id} className="px-3 py-2 text-center">
                              <input
                                type="number"
                                value={scoreInputs[key] ?? ""}
                                onChange={(e) => handleScoreChange(cat.id, s.id, e.target.value)}
                                className={`score-input ${isOver ? "border-red-400 bg-red-50" : ""}`}
                                min="0"
                                max={max}
                                step="0.5"
                                placeholder="-"
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center">
                          {calc ? (
                            <span className="font-semibold text-slate-900">
                              {calc.total}/{calc.max}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-bold text-lg ${
                            parseFloat(grade) >= 2 ? "text-green-600" :
                            parseFloat(grade) >= 1 ? "text-yellow-600" : "text-red-600"
                          }`}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Finalize */}
        {categories.length > 0 && students.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-900">ยืนยันผลการเรียน</p>
              <p className="text-amber-700 text-sm">
                {isSecondary ? "บันทึกผลการเรียนรายภาคเรียน" : "บันทึกผลการเรียนรายปี"}
              </p>
            </div>
            <Button
              onClick={() => { if (confirm("ยืนยันการบันทึกผลการเรียน?")) handleFinalizeAll(); }}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={saveGrade.isPending}
            >
              ยืนยันผลการเรียน
            </Button>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

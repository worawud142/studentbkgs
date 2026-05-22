import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isAdminRole, roleLabel } from "@shared/roles";
import {
  BookOpen,
  ChevronLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Loader2 } from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "หน้าหลัก" },
  { href: "/documents", icon: FileText, label: "เอกสาร ปพ." },
  { href: "/admin", icon: Settings, label: "ผู้ดูแลระบบ", adminOnly: true },
];

interface TeacherLayoutProps {
  children: ReactNode;
  title?: string;
  backHref?: string;
}

export default function TeacherLayout({ children, title, backHref }: TeacherLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { data: profile } = trpc.teacher.myProfile.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = profile
    ? `${profile.prefix || ""}${profile.firstName} ${profile.lastName}`
    : user?.name || "ครู";

  const initials = profile
    ? `${profile.firstName[0]}${profile.lastName[0]}`
    : (user?.name?.[0] || "T");

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">ระบบบริหารชั้นเรียน</p>
              <p className="text-slate-400 text-xs">School Management</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdminRole(user?.role)) return null;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{displayName}</p>
              <p className="text-slate-400 text-xs truncate">
                {roleLabel(user?.role)}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shrink-0">
          {backHref && (
            <Link href={backHref} className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" />
              กลับ
            </Link>
          )}
          {title && (
            <h1 className="text-slate-900 font-semibold text-lg">{title}</h1>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

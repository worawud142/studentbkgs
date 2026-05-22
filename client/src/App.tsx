import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DevLogin from "./pages/DevLogin";
import Dashboard from "./pages/Dashboard";
import SetupProfile from "./pages/SetupProfile";
import ClassroomDetail from "./pages/ClassroomDetail";
import AttendancePage from "./pages/AttendancePage";
import ScorePage from "./pages/ScorePage";
import StudentDetail from "./pages/StudentDetail";
import DocumentsPage from "./pages/DocumentsPage";
import AdminPage from "./pages/AdminPage";
import PrintPor1 from "./pages/PrintPor1";
import PrintPor6 from "./pages/PrintPor6";
import PrintQrCards from "./pages/PrintQrCards";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dev-login" component={DevLogin} />
      <Route path="/setup" component={SetupProfile} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/classroom/:id" component={ClassroomDetail} />
      <Route path="/attendance/:assignmentId" component={AttendancePage} />
      <Route path="/scores/:assignmentId" component={ScorePage} />
      <Route path="/student/:id" component={StudentDetail} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/print/por1/:assignmentId" component={PrintPor1} />
      <Route path="/print/por6/:assignmentId" component={PrintPor6} />
      <Route path="/print/qr/:classroomId" component={PrintQrCards} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

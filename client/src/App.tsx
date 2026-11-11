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
import AssignmentBoxReview from "./pages/AssignmentBoxReview";
import SubmissionBoxPage from "./pages/SubmissionBoxPage";
import StudentDetail from "./pages/StudentDetail";
import DocumentsPage from "./pages/DocumentsPage";
import AdminPage from "./pages/AdminPage";
import QrBoxPage from "./pages/QrBoxPage";
import PrintPor1 from "./pages/PrintPor1";
import PrintPor6 from "./pages/PrintPor6";
import Por6AssessmentPage from "./pages/Por6AssessmentPage";
import PrintQrCards from "./pages/PrintQrCards";
import PrintTeacherQr from "./pages/PrintTeacherQr";

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
      <Route path="/assignment-box/:assignmentId/:categoryId" component={AssignmentBoxReview} />
      <Route path="/submission-box/:assignmentId/:categoryId" component={SubmissionBoxPage} />
      <Route path="/student/:id" component={StudentDetail} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/qr-boxes" component={QrBoxPage} />
      <Route path="/print/por1/:assignmentId" component={PrintPor1} />
      <Route path="/print/por6/student/:studentId" component={PrintPor6} />
      <Route path="/print/por6/classroom/:classroomId" component={PrintPor6} />
      <Route path="/print/por6/:assignmentId" component={PrintPor6} />
      <Route path="/por6/assessment/student/:studentId" component={Por6AssessmentPage} />
      <Route path="/por6/assessment/classroom/:classroomId" component={Por6AssessmentPage} />
      <Route path="/print/qr/:classroomId" component={PrintQrCards} />
      <Route path="/print/teacher-qr" component={PrintTeacherQr} />
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

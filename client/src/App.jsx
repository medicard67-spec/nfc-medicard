import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { useUnread } from "./context/UnreadContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PortalLayout from "./components/PortalLayout.jsx";
import BackgroundImage from "./components/BackgroundImage.jsx";
import { SkeletonList } from "./components/Skeleton.jsx";
import Login from "./pages/Login.jsx";

const PatientHome = lazy(() => import("./pages/patient/PatientHome.jsx"));
const PatientHistory = lazy(() => import("./pages/patient/PatientHistory.jsx"));
const PatientLabs = lazy(() => import("./pages/patient/PatientLabs.jsx"));
const PatientRadiology = lazy(() => import("./pages/patient/PatientRadiology.jsx"));
const PatientMessages = lazy(() => import("./pages/patient/PatientMessages.jsx"));
const PatientProfile = lazy(() => import("./pages/patient/PatientProfile.jsx"));
const PatientAppointments = lazy(() => import("./pages/patient/PatientAppointments.jsx"));

const DoctorDashboard = lazy(() => import("./pages/doctor/DoctorDashboard.jsx"));
const DoctorScan = lazy(() => import("./pages/doctor/DoctorScan.jsx"));
const DoctorDirectory = lazy(() => import("./pages/doctor/DoctorDirectory.jsx"));
const DoctorPatientDetail = lazy(() => import("./pages/doctor/DoctorPatientDetail.jsx"));
const DoctorAddPatient = lazy(() => import("./pages/doctor/DoctorAddPatient.jsx"));
const DoctorAppointments = lazy(() => import("./pages/doctor/DoctorAppointments.jsx"));
const DoctorProfile = lazy(() => import("./pages/doctor/DoctorProfile.jsx"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminRegisterCard = lazy(() => import("./pages/admin/AdminRegisterCard.jsx"));
const AdminPatients = lazy(() => import("./pages/admin/AdminPatients.jsx"));
const AdminDoctorReports = lazy(() => import("./pages/admin/AdminDoctorReports.jsx"));
const AdminAddPatient = lazy(() => import("./pages/admin/AdminAddPatient.jsx"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog.jsx"));

const doctorNav = [
  { to: "/doctor", label: "Dashboard", icon: "🏠", end: true },
  { to: "/doctor/scan", label: "Scan NFC Card", icon: "📶" },
  { to: "/doctor/directory", label: "Patient Directory", icon: "📁" },
  { to: "/doctor/add-patient", label: "Register Patient", icon: "➕" },
  { to: "/doctor/appointments", label: "Appointments", icon: "📅" },
  { to: "/doctor/profile", label: "Profile", icon: "👤" },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: "🏠", end: true },
  { to: "/admin/register-card", label: "Register New Card", icon: "📶" },
  { to: "/admin/add-patient", label: "Add Patient", icon: "➕" },
  { to: "/admin/patients", label: "Patients Data Entry", icon: "🗂️" },
  { to: "/admin/doctor-reports", label: "Doctor's Reports", icon: "🩺" },
  { to: "/admin/audit-log", label: "Audit Log", icon: "🛡️" },
];

function RoleRedirect() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={`/${role}`} replace />;
}

function PageFallback() {
  return (
    <div className="p-4 md:p-6">
      <SkeletonList rows={2} />
    </div>
  );
}

export default function App() {
  const { count: unreadCount } = useUnread();

  const patientNav = [
    { to: "/patient", label: "Home", icon: "🏠", end: true },
    { to: "/patient/history", label: "Medical History", icon: "📋" },
    { to: "/patient/labs", label: "Lab Results", icon: "🧪" },
    { to: "/patient/radiology", label: "Imaging", icon: "🩻" },
    { to: "/patient/messages", label: "Messages", icon: "💬", badge: unreadCount },
    { to: "/patient/appointments", label: "Appointments", icon: "📅" },
    { to: "/patient/profile", label: "Profile", icon: "👤" },
  ];

  return (
    <>
      <BackgroundImage />
      <Suspense fallback={<PageFallback />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RoleRedirect />} />

        <Route
          path="/patient"
          element={
            <ProtectedRoute roles={["patient"]}>
              <PortalLayout navItems={patientNav} title="Patient Portal" />
            </ProtectedRoute>
          }
        >
          <Route index element={<PatientHome />} />
          <Route path="history" element={<PatientHistory />} />
          <Route path="labs" element={<PatientLabs />} />
          <Route path="radiology" element={<PatientRadiology />} />
          <Route path="messages" element={<PatientMessages />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="profile" element={<PatientProfile />} />
        </Route>

        <Route
          path="/doctor"
          element={
            <ProtectedRoute roles={["doctor"]}>
              <PortalLayout navItems={doctorNav} title="Doctor Portal" />
            </ProtectedRoute>
          }
        >
          <Route index element={<DoctorDashboard />} />
          <Route path="scan" element={<DoctorScan />} />
          <Route path="directory" element={<DoctorDirectory />} />
          <Route path="add-patient" element={<DoctorAddPatient />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="patient/:id" element={<DoctorPatientDetail />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <PortalLayout navItems={adminNav} title="Admin Portal" />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="register-card" element={<AdminRegisterCard />} />
          <Route path="add-patient" element={<AdminAddPatient />} />
          <Route path="patients" element={<AdminPatients />} />
          <Route path="patients/:id" element={<AdminPatients />} />
          <Route path="doctor-reports" element={<AdminDoctorReports />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

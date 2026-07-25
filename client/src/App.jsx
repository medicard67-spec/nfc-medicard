import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { useUnread } from "./context/UnreadContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PortalLayout from "./components/PortalLayout.jsx";
import BackgroundImage from "./components/BackgroundImage.jsx";
import Login from "./pages/Login.jsx";

import PatientHome from "./pages/patient/PatientHome.jsx";
import PatientHistory from "./pages/patient/PatientHistory.jsx";
import PatientLabs from "./pages/patient/PatientLabs.jsx";
import PatientRadiology from "./pages/patient/PatientRadiology.jsx";
import PatientMessages from "./pages/patient/PatientMessages.jsx";
import PatientProfile from "./pages/patient/PatientProfile.jsx";
import PatientAppointments from "./pages/patient/PatientAppointments.jsx";

import DoctorDashboard from "./pages/doctor/DoctorDashboard.jsx";
import DoctorScan from "./pages/doctor/DoctorScan.jsx";
import DoctorDirectory from "./pages/doctor/DoctorDirectory.jsx";
import DoctorPatientDetail from "./pages/doctor/DoctorPatientDetail.jsx";
import DoctorAddPatient from "./pages/doctor/DoctorAddPatient.jsx";
import DoctorAppointments from "./pages/doctor/DoctorAppointments.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminRegisterCard from "./pages/admin/AdminRegisterCard.jsx";
import AdminPatients from "./pages/admin/AdminPatients.jsx";
import AdminDoctorReports from "./pages/admin/AdminDoctorReports.jsx";
import AdminAddPatient from "./pages/admin/AdminAddPatient.jsx";
import AdminAuditLog from "./pages/admin/AdminAuditLog.jsx";

const doctorNav = [
  { to: "/doctor", label: "Dashboard", icon: "🏠", end: true },
  { to: "/doctor/scan", label: "Scan NFC Card", icon: "📶" },
  { to: "/doctor/directory", label: "Patient Directory", icon: "📁" },
  { to: "/doctor/add-patient", label: "Register Patient", icon: "➕" },
  { to: "/doctor/appointments", label: "Appointments", icon: "📅" },
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
    </>
  );
}

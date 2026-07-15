import { useNavigate } from "react-router-dom";
import PatientRegistrationForm from "../../components/PatientRegistrationForm.jsx";

export default function DoctorAddPatient() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Register Patient</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Register a new patient directly, without needing an NFC card scan or an admin.
        </p>
      </div>
      <PatientRegistrationForm onRegistered={(patient) => navigate(`/doctor/patient/${patient.uid}`)} />
    </div>
  );
}

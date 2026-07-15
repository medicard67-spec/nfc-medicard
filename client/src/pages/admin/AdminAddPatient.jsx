import PatientRegistrationForm from "../../components/PatientRegistrationForm.jsx";

export default function AdminAddPatient() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add Patient</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Register a patient directly without scanning an NFC card first. A card can be issued to
          them later via Register New Card.
        </p>
      </div>
      <PatientRegistrationForm />
    </div>
  );
}

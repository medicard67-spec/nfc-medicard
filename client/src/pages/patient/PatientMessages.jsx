import { useAuth } from "../../context/AuthContext.jsx";
import Conversation from "../../components/Conversation.jsx";
import { t } from "../../i18n/index.js";

// The patient's chat with their care team: the same conversation view the
// doctor sees on the patient's record, from the patient's side.
export default function PatientMessages() {
  const { profile } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t("Messages")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("Your conversation with your care team.")}</p>
      </div>
      <Conversation
        patientId={profile?.uid}
        emptyText="No messages yet. Write to your care team below."
        placeholder="Message your care team..."
        listClass="max-h-[60vh]"
      />
    </div>
  );
}

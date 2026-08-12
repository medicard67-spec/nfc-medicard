import { supabase } from "./supabase.js";

export async function logAudit(user, action, targetType, targetId, details = null) {
  try {
    let mergedDetails = details;
    // Tag the actor's hospital onto doctor-initiated actions so the audit
    // trail shows which hospital a scan/registration/record update came from.
    if (user.role === "doctor") {
      const { data: doctor } = await supabase.from("doctors").select("hospital").eq("id", user.uid).single();
      if (doctor?.hospital) {
        mergedDetails = { ...(details || {}), hospital: doctor.hospital };
      }
    }

    await supabase.from("audit_log").insert({
      actor_id: user.uid,
      actor_name: user.name || user.email,
      actor_role: user.role,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      details: mergedDetails,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

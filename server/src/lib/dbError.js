// Turns a database error into a plain answer for the person using the app,
// instead of showing them Postgres wording. The real message goes to the log.
export function sendDbError(res, error) {
  const byCode = {
    23503: [404, "Patient not found."], // the patient (or record) it points to doesn't exist
    "22P02": [400, "Some of the details are not in the right format."],
    22007: [400, "Please pick a valid date."],
    22008: [400, "Please pick a valid date."],
    23505: [409, "This already exists."],
  };
  const [status, message] = byCode[error?.code] || [400, "This could not be saved. Please check the details and try again."];
  console.error("Database error:", error?.code, error?.message);
  return res.status(status).json({ error: message });
}

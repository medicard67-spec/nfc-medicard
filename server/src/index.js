import "dotenv/config";
import express from "express";
import cors from "cors";

import { ensureStorageBuckets } from "./lib/supabase.js";
import { catchAsyncErrors } from "./lib/asyncErrors.js";
import usersRoutes from "./routes/users.js";
import patientsRoutes from "./routes/patients.js";
import medicalHistoryRoutes from "./routes/medicalHistory.js";
import medicationsRoutes from "./routes/medications.js";
import admissionsRoutes from "./routes/admissions.js";
import labResultsRoutes from "./routes/labResults.js";
import radiologyRoutes from "./routes/radiology.js";
import messagesRoutes from "./routes/messages.js";
import nfcRoutes from "./routes/nfc.js";
import appointmentsRoutes from "./routes/appointments.js";
import adminRoutes from "./routes/admin.js";
import doctorRoutes from "./routes/doctor.js";
import auditRoutes from "./routes/audit.js";
import queueRoutes from "./routes/queue.js";
import notificationsRoutes from "./routes/notifications.js";
import cardsRoutes from "./routes/cards.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

const app = express();

// CLIENT_ORIGIN accepts a comma-separated list, e.g. for both a production
// domain and Vercel preview deployments.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  })
);
app.use(express.json());

// API answers change from one moment to the next (a card lost, found or
// replaced), so browsers must never reuse a saved answer.
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Record IDs are UUIDs. A malformed one (a typo, a cut-off link) gets a plain
// answer here instead of a raw database error further down.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_PATHS = /^\/(patients|medications|admissions|medical-history|queue|cards\/online)\/([^/]+)/;
app.use("/api", (req, res, next) => {
  for (const id of [req.query.patientId, req.body?.patientId]) {
    if (id !== undefined && id !== "" && !UUID.test(String(id))) {
      return res.status(400).json({ error: "Invalid patient ID." });
    }
  }
  const m = ID_PATHS.exec(req.path);
  if (m && !["mine", "self"].includes(m[2]) && !UUID.test(m[2])) {
    return res.status(404).json({ error: "Record not found." });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/users", catchAsyncErrors(usersRoutes));
app.use("/api/patients", catchAsyncErrors(patientsRoutes));
app.use("/api/medical-history", catchAsyncErrors(medicalHistoryRoutes));
app.use("/api/medications", catchAsyncErrors(medicationsRoutes));
app.use("/api/admissions", catchAsyncErrors(admissionsRoutes));
app.use("/api/lab-results", catchAsyncErrors(labResultsRoutes));
app.use("/api/radiology", catchAsyncErrors(radiologyRoutes));
app.use("/api/messages", catchAsyncErrors(messagesRoutes));
app.use("/api/nfc", catchAsyncErrors(nfcRoutes));
app.use("/api/appointments", catchAsyncErrors(appointmentsRoutes));
app.use("/api/admin", catchAsyncErrors(adminRoutes));
app.use("/api/doctor", catchAsyncErrors(doctorRoutes));
app.use("/api/audit", catchAsyncErrors(auditRoutes));
app.use("/api/queue", catchAsyncErrors(queueRoutes));
app.use("/api/notifications", catchAsyncErrors(notificationsRoutes));
app.use("/api/cards", catchAsyncErrors(cardsRoutes));

app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "This file is too large." });
  if (err.name === "MulterError") return res.status(400).json({ error: "This file could not be uploaded." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});

const port = process.env.PORT || 4001;
ensureStorageBuckets()
  .catch((err) => console.error("Failed to ensure storage buckets:", err.message))
  .finally(() => {
    app.listen(port, () => {
      console.log(`NFC MediCard API listening on http://localhost:${port}`);
    });
  });

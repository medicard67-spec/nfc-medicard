import "dotenv/config";
import express from "express";
import cors from "cors";

import { ensureStorageBuckets } from "./lib/supabase.js";
import usersRoutes from "./routes/users.js";
import patientsRoutes from "./routes/patients.js";
import medicalHistoryRoutes from "./routes/medicalHistory.js";
import labResultsRoutes from "./routes/labResults.js";
import radiologyRoutes from "./routes/radiology.js";
import messagesRoutes from "./routes/messages.js";
import nfcRoutes from "./routes/nfc.js";
import appointmentsRoutes from "./routes/appointments.js";
import adminRoutes from "./routes/admin.js";
import doctorRoutes from "./routes/doctor.js";
import auditRoutes from "./routes/audit.js";

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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/users", usersRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/medical-history", medicalHistoryRoutes);
app.use("/api/lab-results", labResultsRoutes);
app.use("/api/radiology", radiologyRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/nfc", nfcRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/audit", auditRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 4001;
ensureStorageBuckets()
  .catch((err) => console.error("Failed to ensure storage buckets:", err.message))
  .finally(() => {
    app.listen(port, () => {
      console.log(`NFC MediCard API listening on http://localhost:${port}`);
    });
  });

import "dotenv/config";
import express from "express";
import cors from "cors";
import { overrideAttendanceStatus } from "./routes/attendance";
import { sendReminder } from "./routes/send-reminder";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Attendance routes
  app.post("/api/attendance/override", overrideAttendanceStatus);
  app.post("/api/send-reminder", sendReminder);

  return app;
}

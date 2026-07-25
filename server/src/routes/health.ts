import { Router } from "express";
import { db } from "../db/index.js";

export const healthRouter = Router();

// Endpoint dummy — buktiin server jalan DAN koneksi ke SQLite jalan.
// Bakal diganti/ditambah endpoint beneran mulai Slice 1.
healthRouter.get("/health", (_req, res) => {
  const row = db.prepare("SELECT COUNT(*) as count FROM sessions").get() as {
    count: number;
  };
  res.json({
    status: "ok",
    message: "Server dan database jalan",
    sessionCount: row.count,
  });
});

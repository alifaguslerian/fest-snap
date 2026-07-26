import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "../templates");

export const templatesRouter = Router();

export interface TemplateSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateData {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  slots: TemplateSlot[];
  frameUrl: string; // path relatif yang bisa langsung dipakai <img src>
}

// GET /api/templates — daftar template statis (dari panitia, sistem tidak
// bisa membuat/edit template — sesuai requirement).
templatesRouter.get("/templates", (_req, res) => {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    return res.json({ templates: [] });
  }

  const folders = fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const templates: TemplateData[] = [];

  for (const folder of folders) {
    const slotsPath = path.join(TEMPLATES_DIR, folder, "slots.json");
    const framePath = path.join(TEMPLATES_DIR, folder, "frame.png");
    if (!fs.existsSync(slotsPath) || !fs.existsSync(framePath)) continue;

    const data = JSON.parse(fs.readFileSync(slotsPath, "utf-8"));
    templates.push({
      id: data.id,
      name: data.name,
      canvasWidth: data.canvasWidth,
      canvasHeight: data.canvasHeight,
      slots: data.slots,
      frameUrl: `/templates/${folder}/frame.png`,
    });
  }

  res.json({ templates });
});

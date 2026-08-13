import express from "express";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadDir = join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "video/mp4", "video/webm", "application/pdf"];
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "webm", "pdf"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = file.originalname.split(".").pop();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error("File type not allowed. نوع الملف غير مسموح به."), false);
    }
    cb(null, true);
  }
});

const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const host = req.headers["x-forwarded-host"] || req.get("host") || "everest-academy-production.up.railway.app";
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    res.json({ url: `${proto}://${host}/uploads/${req.file.filename}`, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/base64", async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!data || !filename) return res.status(400).json({ error: "Missing filename or data" });
    const matches = data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid base64 format" });
    const ext = filename.split(".").pop() || "png";
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(matches[2], "base64");
    fs.writeFileSync(join(uploadDir, fname), buffer);
    res.json({ url: `/uploads/${fname}`, filename: fname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
export { upload };

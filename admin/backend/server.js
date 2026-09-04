import "dotenv/config";
console.log(`[DB-CONFIG] TURSO_URL=${process.env.TURSO_URL ? `SET(${process.env.TURSO_URL.slice(0, 30)}...)` : "MISSING"} | TURSO_TOKEN=${process.env.TURSO_TOKEN ? `SET(len=${process.env.TURSO_TOKEN.length})` : "MISSING"} | NODE_ENV=${process.env.NODE_ENV || "unset"}`);
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { initDb, execute, query, queryOne, resetAllRanksOnce, migrateLegacyPasswords } from "./db.js";
import { pool as geminiPool } from "./geminiKeys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN === "*" ? true : process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:4000","http://localhost:3000"],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(join(__dirname, "uploads")));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: { error: "Too many requests. يرجى المحاولة لاحقاً." } });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: { error: "Too many uploads." } });

// Serve built frontends if dist folders exist
// Admin frontend at /admin
const adminDist = join(__dirname, "../frontend/dist");
if (fs.existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist, { maxAge: 0, etag: false, lastModified: false, index: false }));
  const serveAdmin = (req, res) => {
    if (req.path.startsWith("/admin/assets/")) {
      const fParam = req.query.f;
      if (fParam) {
        const filePath = join(adminDist, "assets", fParam);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
      }
    }
    const indexPath = join(adminDist, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    const buildVersion = Date.now().toString(36);
    html = html.replace('src="./assets/', `src="./assets/?v=${buildVersion}&f=`);
    html = html.replace('href="./assets/', `href="./assets/?v=${buildVersion}&f=`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  };
  app.get("/admin", serveAdmin);
  app.get("/admin/", serveAdmin);
  app.get("/admin/*", serveAdmin);
  console.log("✅ Serving admin frontend from", adminDist);
}
// User frontend at root
const userDist = join(__dirname, "../../user/dist");
const userPublic = join(__dirname, "../../user/public");
if (fs.existsSync(userDist)) {
  app.use("/assets", express.static(join(userDist, "assets"), { maxAge: 0, etag: false, lastModified: false }));
  app.use(express.static(userDist, { maxAge: 0, etag: false, lastModified: false, index: false }));
  const buildVersion = Date.now().toString(36);
  const serveUser = (req, res) => {
    const indexPath = join(userDist, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    html = html.replace('src="/assets/', `src="/assets/?v=${buildVersion}&f=`);
    html = html.replace('href="/assets/', `href="/assets/?v=${buildVersion}&f=`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  };
  app.get("/", serveUser);
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/admin")) return next();
    if (req.path.startsWith("/assets/")) {
      const fParam = req.query.f;
      if (fParam) {
        const filePath = join(userDist, "assets", fParam);
        if (fs.existsSync(filePath)) {
          return res.sendFile(filePath);
        }
      }
    }
    serveUser(req, res);
  });
  console.log("✅ Serving user frontend from", userDist);
}
// Serve public assets (images, videos) as fallback
if (fs.existsSync(userPublic)) {
  app.use(express.static(userPublic));
  console.log("✅ Serving public assets from", userPublic);
}

import sessionAuth, { adminAuth } from "./middleware/sessionAuth.js";
import { getSettlementSettings, runWeeklySettlement, getSettlementWeek, partsInTz, ensureSettlementSettings } from "./services/weeklySettlement.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import coursesRoutes from "./routes/courses.js";
import walletsRoutes from "./routes/wallets.js";
import mlmRoutes from "./routes/mlm.js";
import ranksRoutes from "./routes/ranks.js";
import leadersRoutes from "./routes/leaders.js";
import notificationsRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes from "./routes/upload.js";
import paymentGatewayRoutes from "./routes/payment_gateways.js";
import chatRoutes from "./routes/chat.js";
import { loadGroqKey } from "./routes/chat.js";
import feedbacksRoutes from "./routes/feedbacks.js";
import proofsRoutes from "./routes/proofs.js";
import adminLogsRoutes from "./routes/admin_logs.js";
import settingsRoutes from "./routes/settings.js";
import bunnyRoutes from "./routes/bunny.js";
import adminAuthRoutes, { seedAdmins } from "./routes/admin_auth.js";
import transactionsRoutes from "./routes/transactions.js";
import activityFeedRoutes from "./routes/activityFeed.js";

app.use("/api", sessionAuth, apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/wallets", adminAuth, walletsRoutes);
app.use("/api/mlm", mlmRoutes);
app.use("/api/ranks", ranksRoutes);
app.use("/api/leaders", leadersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/dashboard", adminAuth, dashboardRoutes);
app.use("/api/upload", adminAuth, uploadLimiter, uploadRoutes);
app.use("/api/payment-gateways", paymentGatewayRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/feedbacks", feedbacksRoutes);
app.use("/api/proofs", proofsRoutes);
app.use("/api/admin-logs", adminAuth, adminLogsRoutes);
app.use("/api/bunny", adminAuth, bunnyRoutes);
app.use("/api/settings", adminAuth, settingsRoutes);
app.use("/api/transactions", adminAuth, transactionsRoutes);
app.use("/api/activity-feed", adminAuth, activityFeedRoutes);

// Public customer service settings (no auth needed)
app.get("/api/customer-service", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM settings WHERE key IN ('customer_service_whatsapp', 'customer_service_email', 'social_instagram', 'social_telegram', 'social_tiktok')");
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public pricing settings (no auth needed — used by landing page & registration)
app.get("/api/pricing", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM settings WHERE key IN ('content_price', 'create_account_cost')");
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    if (!obj.content_price) obj.content_price = "0";
    if (!obj.create_account_cost) obj.create_account_cost = "5500";
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public upload for registration (no auth needed, rate-limited, images only)
const pubUploadDir = join(__dirname, "uploads");
if (!fs.existsSync(pubUploadDir)) fs.mkdirSync(pubUploadDir, { recursive: true });
const pubStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pubUploadDir),
  filename: (req, file, cb) => { const ext = file.originalname.split(".").pop(); cb(null, `reg-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`); }
});
const pubUpload = multer({ storage: pubStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = ["image/jpeg","image/png","image/webp"].includes(file.mimetype); cb(ok ? null : new Error("Images only"), ok); }});
app.post("/api/public-upload", pubUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  res.json({ url: `${proto}://${host}/uploads/${req.file.filename}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Membership expiry checker — runs every hour
function startMembershipExpiryCheck() {
  const check = async () => {
    try {
      // Block expired users
      const expired = await query("SELECT id, full_name FROM users WHERE membership_expires_at IS NOT NULL AND membership_expires_at <= datetime('now','localtime') AND blocked = 0");
      for (const u of expired) {
        await execute("UPDATE users SET blocked = 1, updated_at = datetime('now','localtime') WHERE id = ?", [u.id]);
        const nid = uuidv4();
        await execute(
          "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'warning')",
          [nid, u.id, "🚫 تم حظر حسابك", "انتهت مدة عضويتك. تواصل مع خدمة العملاء لتجديد العضوية."]
        );
        console.log(`🚫 Membership expired — blocked user: ${u.full_name} (${u.id})`);
      }

      // Warn users expiring in 5 days
      const expiring = await query(
        "SELECT id, full_name FROM users WHERE membership_expires_at IS NOT NULL AND blocked = 0 AND membership_expires_at > datetime('now','localtime') AND membership_expires_at <= datetime('now','localtime','+5 days')"
      );
      for (const u of expiring) {
        // Check if already warned today to avoid duplicate spam
        const existing = await query(
          "SELECT id FROM notifications WHERE user_id = ? AND title = '⚠️ العضوية ستنتهي قريباً' AND created_at >= datetime('now','localtime','-1 day')",
          [u.id]
        );
        if (existing.length === 0) {
          const nid = uuidv4();
          await execute(
            "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'warning')",
            [nid, u.id, "⚠️ العضوية ستنتهي قريباً", "ستنتهي عضويتك خلال 5 أيام أو أقل. تواصل مع خدمة العملاء لتجديد العضوية لعدم انقطاع الخدمات."]
          );
          console.log(`⚠️ Warned user: ${u.full_name} (${u.id}) — membership expiring soon`);
        }
      }
    } catch (e) { console.error("Membership check error:", e.message); }
  };
  check(); // Run immediately on start
  setInterval(check, 3600000); // every hour
  console.log("🕐 Membership expiry checker started (every 1h)");
}

// Weekly settlement scheduler — reads settlement settings (day/hour/minute/timezone)
// every tick so admin changes take effect without restart.
function startWeeklyCommissionScheduler() {
  async function check() {
    try {
      const settings = await getSettlementSettings();
      if (settings.settlement_enabled !== "true") return;
      const tz = settings.settlement_timezone || "Africa/Cairo";
      const day = parseInt(settings.settlement_day, 10) || 0;
      const hour = parseInt(settings.settlement_hour, 10) || 0;
      const minute = parseInt(settings.settlement_minute, 10) || 0;
      const p = partsInTz(new Date(), tz);
      if (p.dow === day && p.hour === hour && p.minute === minute) {
        const week = await getSettlementWeek(settings);
        const done = await queryOne(
          "SELECT id FROM weekly_settlements WHERE week_start = ? AND status IN ('completed','running')",
          [week.weekStart]
        );
        if (!done) {
          console.log(`⏰ [SETTLEMENT] Time reached — processing week ${week.weekStart}...`);
          await runWeeklySettlement({ triggeredBy: "auto" });
        }
      }
    } catch (e) { console.error("Settlement checker error:", e.message); }
  }
  check();
  setInterval(check, 30000); // every 30s — adapts instantly to settings changes
  console.log("⏰ Weekly settlement scheduler started (settings-driven, every 30s)");
}

// Initialize database then start server
initDb().then(async () => {
  await seedAdmins();
  console.log("✅ Admin accounts seeded");
  const pwMigrate = await migrateLegacyPasswords();
  if (pwMigrate.fixed > 0) console.log(`✅ Migrated ${pwMigrate.fixed} legacy plaintext password(s)`);
  await ensureSettlementSettings();
  console.log("✅ Weekly settlement settings ensured");
  // One-time rank reset: everyone with a rank goes back to the beginning
  const rankReset = await resetAllRanksOnce();
  if (rankReset.success && !rankReset.skipped) console.log("✅ Ranks reset - everyone starts from the beginning");
  else if (rankReset.error) console.warn("⚠️ Rank reset skipped:", rankReset.error);
  // Load Gemini API keys (env first, then settings DB override)
  geminiPool.load(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "");
  try {
    const rows = await query("SELECT value FROM settings WHERE key = 'gemini_api_keys'");
    if (rows.length > 0 && rows[0].value) {
      geminiPool.load(rows[0].value);
      console.log("🔑 Loaded Gemini keys from settings DB");
    }
  } catch {}
  // Load Groq API key from settings DB (insert env default if not set)
  try {
    const existing = await query("SELECT value FROM settings WHERE key = 'groq_api_key'");
    if (existing.length === 0 || !existing[0].value) {
      const defaultKey = process.env.GROQ_API_KEY || "";
      if (defaultKey) {
        await execute("INSERT INTO settings (key, value) VALUES ('groq_api_key', ?)", [defaultKey]);
        console.log("🔑 Default Groq API key inserted into settings DB");
      }
    }
  } catch {}
  await loadGroqKey();
  // Clean up orphaned sessions
  try { await execute("DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users)"); } catch(e) {}
  app.listen(PORT, () => {
    console.log(`✅ Everest Admin Backend running on http://localhost:${PORT}`);
  });
  startMembershipExpiryCheck();
  startWeeklyCommissionScheduler();
}).catch(err => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});


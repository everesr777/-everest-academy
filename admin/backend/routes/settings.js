import { v4 as uuidv4 } from "uuid";
import express from "express";
import { query, queryOne, execute } from "../db.js";
import { pool as geminiPool } from "../geminiKeys.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM settings");
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Search users by name, email, or ID (must be BEFORE /:key)
router.get("/membership-search/:query", async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const users = await query(
      "SELECT id, referral_code, full_name, email, phone, membership_expires_at, blocked FROM users WHERE id = ? OR referral_code = ? OR email LIKE ? OR full_name LIKE ? OR phone LIKE ? LIMIT 10",
      [req.params.query, req.params.query, q, q, q]
    );
    const results = users.map(u => {
      const days_remaining = u.membership_expires_at
        ? Math.max(0, Math.round((new Date(u.membership_expires_at) - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
      return { ...u, days_remaining };
    });
    res.json(results || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get membership expiration info for a user (must be BEFORE /:key)
router.get("/membership-expiry/:userId", async (req, res) => {
  try {
    const user = await queryOne(
      "SELECT id, full_name, email, phone, membership_expires_at, blocked FROM users WHERE id = ?",
      [req.params.userId]
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const daysRemaining = user.membership_expires_at
      ? Math.max(0, Math.round((new Date(user.membership_expires_at) - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      membership_expires_at: user.membership_expires_at,
      days_remaining: daysRemaining,
      blocked: user.blocked
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update user membership expiry (PUT)
router.put("/membership-expiry/:userId", async (req, res) => {
  try {
    const { membership_expires_at, admin_id } = req.body;
    if (!admin_id) return res.status(400).json({ error: "admin_id required" });

    const user = await queryOne("SELECT id, full_name, email, blocked FROM users WHERE id = ?", [req.params.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    // If new expiry is in the future and user is blocked, unblock them
    const shouldUnblock = user.blocked && membership_expires_at && new Date(membership_expires_at) > new Date();

    if (shouldUnblock) {
      await query("UPDATE users SET membership_expires_at = ?, blocked = 0 WHERE id = ?", [membership_expires_at, req.params.userId]);
    } else {
      await query("UPDATE users SET membership_expires_at = ? WHERE id = ?", [membership_expires_at, req.params.userId]);
    }

    try {
      await query(
        "INSERT INTO activity_logs (admin_id, action, details, created_at) VALUES (?, ?, ?, datetime('now'))",
        [admin_id, "membership_expiry_update", `Updated membership for ${user.full_name || user.email} (${user.id}) to ${membership_expires_at || "null"}${shouldUnblock ? " + unblocked" : ""}`]
      );
    } catch (_) {}

    // Send notification to the user
    try {
      const notifyDate = membership_expires_at ? new Date(membership_expires_at).toLocaleDateString("ar-EG") : "غير محدد";
      await execute(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
        [
          uuidv4(),
          req.params.userId,
          "تم تحديث العضوية ✅",
          `تم تعديل تاريخ انتهاء عضويتك. التاريخ الجديد: ${notifyDate}${shouldUnblock ? "\nتم فك حظرك تلقائياً." : ""}`
        ]
      );
    } catch (nErr) { console.log("Notification error:", nErr.message); }

    res.json({ success: true, user, unblocked: shouldUnblock });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Unblock a user from membership settings
router.put("/membership-unblock/:userId", async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (!admin_id) return res.status(400).json({ error: "admin_id required" });

    const user = await queryOne("SELECT id, full_name, email, blocked FROM users WHERE id = ?", [req.params.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    await execute("UPDATE users SET blocked = 0, updated_at = datetime('now','localtime') WHERE id = ?", [req.params.userId]);

    // Log the action
    const logId = uuidv4();
    await execute(
      "INSERT INTO admin_logs (id, admin_id, admin_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))",
      [logId, admin_id, "Admin", "Unblock User (Membership)", `Unblocked user ${user.full_name || user.email} (${user.id}) from membership settings`]
    );

    // Notify user
    const nid = uuidv4();
    await execute(
      "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
      [nid, user.id, "✅ تم فك الحظر", "تم فك حظر حسابك. يمكنك الآن تسجيل الدخول."]
    );

    res.json({ success: true, blocked: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Gemini API Keys Management ───

router.get("/gemini-keys", (req, res) => {
  res.json({
    keys: geminiPool.getStatus(),
    raw: process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "",
  });
});

router.put("/gemini-keys", async (req, res) => {
  try {
    const { keys } = req.body; // comma-separated string
    if (typeof keys !== "string") return res.status(400).json({ error: "keys must be a comma-separated string" });

    // Save to settings table
    await execute("INSERT INTO settings (key, value) VALUES ('gemini_api_keys', ?) ON CONFLICT(key) DO UPDATE SET value = ?", [keys, keys]);

    // Reload the pool
    geminiPool.load(keys);

    // Also update process.env for consistency
    process.env.GEMINI_API_KEYS = keys;

    res.json({ success: true, totalKeys: geminiPool.keys.length, keys: geminiPool.getStatus() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Generic setting by key (MUST be after specific routes)
router.get("/:key", async (req, res) => {
  try {
    const row = await queryOne("SELECT * FROM settings WHERE key = ?", [req.params.key]);
    if (!row) return res.status(404).json({ error: "Setting not found" });
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:key", async (req, res) => {
  try {
    const { value, admin_id } = req.body;
    if (!admin_id) return res.status(400).json({ error: "admin_id required" });

    const oldRow = await queryOne("SELECT value FROM settings WHERE key = ?", [req.params.key]);

    await execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [req.params.key, String(value)]);

    const admin = await queryOne("SELECT full_name FROM users WHERE id = ?", [admin_id]);
    const adminName = admin ? admin.full_name : "Unknown";

    const details = oldRow
      ? `Changed "${req.params.key}" from "${oldRow.value}" to "${String(value)}"`
      : `Set "${req.params.key}" to "${String(value)}"`;

    const logId = uuidv4();
    await execute(
      "INSERT INTO admin_logs (id, admin_id, admin_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))",
      [logId, admin_id, adminName, "Update Setting", details]
    );

    if (req.params.key === "membership_duration" && (!oldRow || String(oldRow.value) !== String(value))) {
      const users = await query("SELECT id FROM users WHERE role != 'admin'");
      console.log(`📢 Sending membership duration change notification to ${users.length} users...`);
      // Insert in chunks with one multi-row statement per chunk instead of one
      // round-trip per user: 500 users used to take several minutes and the
      // admin's Save button stayed on "Saving..." the whole time.
      const CHUNK = 100;
      let sent = 0;
      for (let i = 0; i < users.length; i += CHUNK) {
        const chunk = users.slice(i, i + CHUNK);
        const placeholders = [];
        const params = [];
        for (const user of chunk) {
          placeholders.push("(?, ?, ?, ?, 'info')");
          params.push(uuidv4(), user.id, "تحديث مدة العضوية", `تم تغيير مدة العضوية إلى ${String(value)} يوماً`);
        }
        try {
          await execute(
            `INSERT INTO notifications (id, user_id, title, message, type) VALUES ${placeholders.join(",")}`,
            params
          );
          sent += chunk.length;
        } catch (nErr) {
          console.error(`❌ Failed to notify chunk ${i / CHUNK}:`, nErr.message);
        }
      }
      console.log(`📢 Notifications done: ${sent} sent`);
    }

    res.json({ success: true, key: req.params.key, value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

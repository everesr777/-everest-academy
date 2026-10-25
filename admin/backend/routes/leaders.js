import { v4 as uuidv4 } from "uuid";
import express from "express";
import { query, queryOne, execute } from "../db.js";
import { getCurrentWeek, refreshLeadersSnapshot, LEADER_RANK_ICONS } from "../services/weeklySettlement.js";

const router = express.Router();

const RANK_ORDER = `CASE rank
  WHEN 'Everest Ambassador' THEN 10
  WHEN 'Everest Legend' THEN 9
  WHEN 'Everest Master' THEN 8
  WHEN 'Everest Elite' THEN 7
  WHEN 'Regional Leader' THEN 6
  WHEN 'Senior Leader' THEN 5
  WHEN 'Team Leader' THEN 4
  WHEN 'Executive Star' THEN 3
  WHEN 'Executive' THEN 2
  WHEN 'Star' THEN 1
  ELSE 0
END DESC`;

// refreshLeadersSnapshot() lives in services/weeklySettlement.js so the
// weekly settlement can rebuild the homepage leaders list automatically.

router.get("/", async (req, res) => {
  try {
    const lastRefresh = await queryOne("SELECT value FROM settings WHERE key = 'leaders_last_refresh'");
    let shouldRefresh = false;
    if (!lastRefresh || !lastRefresh.value) {
      shouldRefresh = true;
    } else {
      const last = new Date(lastRefresh.value);
      const now = new Date();
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      if (daysSince >= 7) shouldRefresh = true;
    }
    if (shouldRefresh) await refreshLeadersSnapshot();

    const leaders = await query(`SELECT * FROM leaders ORDER BY ${RANK_ORDER}, created_at ASC`);
    res.json(leaders);
  } catch (err) {
    console.error("Leaders error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const count = await refreshLeadersSnapshot();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const USER_FIELDS = "id, full_name, email, phone, referral_code, avatar, rank, role, e_money, direct_count";

// The admin panel used to ask for the raw user ID (a UUID-looking string), which
// nobody remembers. Accept whatever the admin types: ID, email, phone, referral
// code or full name (exact first, then a partial match).
async function resolveUserByInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { user: null };

  const exactQueries = [
    `SELECT ${USER_FIELDS} FROM users WHERE id = ?`,
    `SELECT ${USER_FIELDS} FROM users WHERE lower(trim(email)) = lower(?)`,
    `SELECT ${USER_FIELDS} FROM users WHERE trim(phone) = ?`,
    `SELECT ${USER_FIELDS} FROM users WHERE upper(trim(referral_code)) = upper(?)`,
  ];
  for (const sql of exactQueries) {
    const row = await queryOne(sql, [raw]);
    if (row) return { user: row };
  }

  const byName = await query(
    `SELECT ${USER_FIELDS} FROM users WHERE lower(trim(full_name)) = lower(?)`,
    [raw]
  );
  if (byName.length === 1) return { user: byName[0] };
  if (byName.length > 1) return { candidates: byName };

  const partial = await query(
    `SELECT ${USER_FIELDS} FROM users WHERE lower(full_name) LIKE lower(?) ORDER BY full_name LIMIT 8`,
    [`%${raw}%`]
  );
  if (partial.length === 1) return { user: partial[0] };
  if (partial.length > 1) return { candidates: partial };
  return { user: null };
}

// Live search used by the admin UI to pick a user instead of typing an ID.
router.get("/search", async (req, res) => {
  try {
    const raw = String(req.query.q || "").trim();
    if (!raw) return res.json([]);
    const like = `%${raw}%`;
    const rows = await query(
      `SELECT id, full_name, email, phone, avatar, rank
         FROM users
        WHERE role NOT IN ('admin', 'manager')
          AND (lower(full_name) LIKE lower(?) OR lower(email) LIKE lower(?)
               OR phone LIKE ? OR id LIKE ? OR upper(referral_code) LIKE upper(?))
        ORDER BY CASE WHEN trim(full_name) = ? THEN 0 WHEN rank != '' THEN 1 ELSE 2 END,
                 full_name ASC
        LIMIT 12`,
      [like, like, like, like, like, raw]
    );
    res.json(rows.map(u => ({
      id: u.id, name: (u.full_name || "").trim(), email: u.email,
      phone: u.phone, rank: u.rank, avatar: u.avatar,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/add", async (req, res) => {
  try {
    const input = req.body.userId || req.body.q || req.body.name || req.body.email || "";
    if (!String(input).trim())
      return res.status(400).json({ error: "اكتب اسم المستخدم أو الإيميل أو رقم الموبايل أو الـ ID", error_en: "userId required" });

    const { user, candidates } = await resolveUserByInput(input);
    if (candidates) {
      return res.status(400).json({
        error: "فيه أكتر من مستخدم بالاسم ده — اختار واحد من القائمة",
        error_en: "Multiple users match that name — pick one",
        candidates: candidates.map(u => ({
          id: u.id, name: (u.full_name || "").trim(), rank: u.rank, email: u.email, phone: u.phone,
        })),
      });
    }
    if (!user)
      return res.status(404).json({
        error: `مفيش مستخدم بالبيانات دي: "${String(input).trim()}"`,
        error_en: "User not found",
      });
    if (user.role === "admin" || user.role === "manager")
      return res.status(400).json({ error: "الحسابات الإدارية لا يمكن إضافتها لقائمة القادة", error_en: "Admin/manager accounts cannot be leaders" });
    if (!user.rank)
      return res.status(400).json({ error: `${(user.full_name || "").trim()} ليس لديه رتبة بعد`, error_en: "User has no rank" });

    const existing = await queryOne("SELECT id FROM leaders WHERE id = ?", [user.id]);
    if (existing)
      return res.status(400).json({ error: `${(user.full_name || "").trim()} موجود بالفعل في القائمة`, error_en: "User already in leaders" });

    const count = await queryOne("SELECT COUNT(*) as c FROM leaders");
    if (count.c >= 10)
      return res.status(400).json({ error: "الحد الأقصى 10 قادة — أزل أحدهم أولاً", error_en: "Maximum 10 leaders allowed" });

    await execute("DELETE FROM excluded_leaders WHERE user_id = ?", [user.id]);

    await execute(
      "INSERT INTO leaders (id, name, rank, avatar, icon) VALUES (?, ?, ?, ?, ?)",
      [user.id, user.full_name, user.rank, user.avatar, LEADER_RANK_ICONS[user.rank] || "🏆"]
    );
    const leader = await queryOne("SELECT * FROM leaders WHERE id = ?", [user.id]);
    res.json(leader);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  await execute("INSERT OR IGNORE INTO excluded_leaders (user_id) VALUES (?)", [req.params.id]);
  await execute("DELETE FROM leaders WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// ─── Weekly leaderboard (by weekly sales, tie-break rank then directs) ───
router.get("/weekly", async (req, res) => {
  try {
    const { weekStart } = req.query;
    const week = weekStart || (await getCurrentWeek()).weekStart;
    const rows = await query(`
      SELECT ws.user_id, ws.sales as weekly_sales,
             u.full_name, u.avatar, u.rank, u.direct_count, u.e_money, u.account_type,
             COALESCE(r.sort_order, 0) as rank_order
      FROM weekly_sales ws
      JOIN users u ON u.id = ws.user_id
      LEFT JOIN ranks r ON u.rank = r.name
      WHERE ws.week_start = ? AND u.role != 'admin' AND u.account_type IN ('student','registration_free')
      ORDER BY ws.sales DESC, rank_order DESC, u.direct_count DESC
      LIMIT 10
    `, [week]);
    rows.forEach((u, i) => u.position = i + 1);
    res.json({ weekStart: week, leaders: rows });
  } catch (err) {
    console.error("Weekly leaderboard error:", err.message);
    res.json({ weekStart: req.query.weekStart || null, leaders: [] });
  }
});

// ─── Leaderboard history (saved snapshots per settled week) ───
router.get("/history", async (req, res) => {
  try {
    const rows = await query(`
      SELECT week_start, COUNT(*) as entries, MAX(created_at) as settled_at
      FROM leaderboard_history
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 52
    `);
    res.json(rows);
  } catch (err) {
    console.error("Leaderboard history error:", err.message);
    res.json([]);
  }
});

router.get("/history/:weekStart", async (req, res) => {
  try {
    const rows = await query(
      "SELECT * FROM leaderboard_history WHERE week_start = ? ORDER BY rank_position ASC",
      [req.params.weekStart]
    );
    res.json({ weekStart: req.params.weekStart, leaders: rows });
  } catch (err) {
    console.error("Leaderboard history detail error:", err.message);
    res.json({ weekStart: req.params.weekStart, leaders: [] });
  }
});

export default router;

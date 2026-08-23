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

router.post("/add", async (req, res) => {
  try {
    const count = await queryOne("SELECT COUNT(*) as c FROM leaders");
    if (count.c >= 10) return res.status(400).json({ error: "Maximum 10 leaders allowed" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = await queryOne("SELECT id, full_name, avatar, rank, e_money, direct_count FROM users WHERE id = ? AND role NOT IN ('admin', 'manager')", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.rank) return res.status(400).json({ error: "User has no rank" });

    const existing = await queryOne("SELECT id FROM leaders WHERE id = ?", [userId]);
    if (existing) return res.status(400).json({ error: "User already in leaders" });

    await execute("DELETE FROM excluded_leaders WHERE user_id = ?", [userId]);

    await execute(
      "INSERT INTO leaders (id, name, rank, avatar, icon) VALUES (?, ?, ?, ?, ?)",
      [userId, user.full_name, user.rank, user.avatar, LEADER_RANK_ICONS[user.rank] || "🏆"]
    );
    const leader = await queryOne("SELECT * FROM leaders WHERE id = ?", [userId]);
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

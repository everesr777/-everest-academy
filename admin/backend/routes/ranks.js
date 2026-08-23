import { v4 as uuidv4 } from "uuid";
import express from "express";
import { query, queryOne, execute } from "../db.js";

const router = express.Router();

const sReq = (r) => r.sales_required !== undefined ? r.sales_required : r.min_direct;
const bVal = (r) => r.bonus !== undefined ? r.bonus : r.weekly_bonus;

router.get("/", async (req, res) => {
  const { all } = req.query;
  let sql = `
    SELECT r.*,
      (SELECT COUNT(*) FROM users u WHERE u.rank = r.name AND u.role != 'admin' AND u.account_type IN ('student','registration_free')) as user_count
    FROM ranks r
  `;
  if (all === "true") sql += " ORDER BY r.sort_order";
  else sql += " WHERE r.is_active = 1 ORDER BY r.sort_order";
  const ranks = await query(sql);
  res.json(ranks);
});

router.get("/leaderboard", async (req, res) => {
  try {
    const users = await query(`
      SELECT id, full_name, avatar, rank, direct_count, e_money, account_type
      FROM users
      WHERE role != 'admin' AND rank IS NOT NULL AND rank != '' AND account_type IN ('student','registration_free')
      ORDER BY direct_count DESC
      LIMIT 30
    `);
    const allRanks = await query("SELECT name, sort_order FROM ranks WHERE is_active = 1 ORDER BY sort_order ASC");
    const rankMap = {};
    allRanks.forEach(r => { rankMap[r.name] = r.sort_order; });
    const enriched = await Promise.all(users.map(async (u) => {
      const sortOrder = rankMap[u.rank] ?? 0;
      const teamCount = await getQualifiedTeamCount(u.id, sortOrder);
      return { ...u, total_team_sales: teamCount, position: 0 };
    }));
    enriched.sort((a, b) => b.total_team_sales - a.total_team_sales);
    enriched.forEach((u, i) => u.position = i + 1);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, sales_required, bonus, is_active, image } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    const id = uuidv4();
    const maxSort = await queryOne("SELECT COALESCE(MAX(sort_order), -1) as m FROM ranks");
    await execute("INSERT INTO ranks (id, name, sales_required, min_direct, bonus, weekly_bonus, sort_order, is_active, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, name, sales_required || 0, sales_required || 0, bonus || 0, bonus || 0, (maxSort?.m ?? -1) + 1, is_active ?? 1, image || null]);
    const rank = await queryOne("SELECT * FROM ranks WHERE id = ?", [id]);
    res.json(rank);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, sales_required, bonus, sort_order, is_active, image } = req.body;
    const existing = await queryOne("SELECT id FROM ranks WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Rank not found" });
    const sets = []; const params = [];
    if (name !== undefined) { sets.push("name = ?"); params.push(name); }
    if (sales_required !== undefined) {
      sets.push("sales_required = ?"); params.push(sales_required);
      sets.push("min_direct = ?"); params.push(sales_required);
    }
    if (bonus !== undefined) {
      sets.push("bonus = ?"); params.push(bonus);
      sets.push("weekly_bonus = ?"); params.push(bonus);
    }
    if (image !== undefined) { sets.push("image = ?"); params.push(image); }
    if (sort_order !== undefined) { sets.push("sort_order = ?"); params.push(sort_order); }
    if (is_active !== undefined) { sets.push("is_active = ?"); params.push(is_active); }
    if (sets.length) {
      params.push(req.params.id);
      await execute("UPDATE ranks SET " + sets.join(", ") + " WHERE id = ?", params);
    }
    const rank = await queryOne("SELECT * FROM ranks WHERE id = ?", [req.params.id]);
    res.json(rank);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const existing = await queryOne("SELECT id FROM ranks WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Rank not found" });
    await execute("DELETE FROM ranks WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Count qualified team members: Student + Reg Free accounts, status = active
// Excludes: pending, rejected, suspended, inactive, and members with higher rank
async function getQualifiedTeamCount(userId, currentRankSortOrder) {
  const allMembers = await query(
    "SELECT u.id, u.rank, u.status FROM user_closure c JOIN users u ON u.id = c.descendant WHERE c.ancestor = ? AND c.descendant != ? AND u.account_type IN ('student','registration_free')",
    [userId, userId]
  );
  // Filter to active only
  const activeMembers = allMembers.filter(m => m.status === 'active');
  if (!currentRankSortOrder && currentRankSortOrder !== 0) {
    return activeMembers.length;
  }
  const allRanks = await query("SELECT name, sort_order FROM ranks WHERE is_active = 1 ORDER BY sort_order ASC");
  const rankMap = {};
  allRanks.forEach(r => { rankMap[r.name] = r.sort_order; });
  let count = 0;
  for (const member of activeMembers) {
    const memberSortOrder = member.rank ? (rankMap[member.rank] ?? -1) : -1;
    if (memberSortOrder <= currentRankSortOrder) {
      count++;
    }
  }
  return count;
}

// Get full breakdown of qualified team for weekly history
async function getQualifiedTeamBreakdown(userId, currentRankSortOrder) {
  const allMembers = await query(
    "SELECT u.id, u.rank, u.status, u.account_type FROM user_closure c JOIN users u ON u.id = c.descendant WHERE c.ancestor = ? AND c.descendant != ? AND u.account_type IN ('student','registration_free')",
    [userId, userId]
  );
  const allRanks = await query("SELECT name, sort_order FROM ranks WHERE is_active = 1 ORDER BY sort_order ASC");
  const rankMap = {};
  allRanks.forEach(r => { rankMap[r.name] = r.sort_order; });

  let qualifiedCount = 0;
  let studentCount = 0;
  let registrationCount = 0;
  let higherRankExcluded = 0;
  let inactiveExcluded = 0;

  for (const member of allMembers) {
    if (member.status !== 'active') { inactiveExcluded++; continue; }
    const memberSortOrder = member.rank ? (rankMap[member.rank] ?? -1) : -1;
    if (!currentRankSortOrder && currentRankSortOrder !== 0) {
      qualifiedCount++;
      if (member.account_type === 'student') studentCount++;
      else registrationCount++;
    } else if (memberSortOrder <= currentRankSortOrder) {
      qualifiedCount++;
      if (member.account_type === 'student') studentCount++;
      else registrationCount++;
    } else {
      higherRankExcluded++;
    }
  }

  return { qualifiedCount, studentCount, registrationCount, higherRankExcluded, inactiveExcluded, qualifiedNetworkCount: allMembers.filter(m => m.status === 'active').length };
}

// Legacy wrapper
async function getTeamCount(userId) {
  const closure = await queryOne(
    "SELECT COUNT(*) - 1 as cnt FROM user_closure c JOIN users u ON u.id = c.descendant WHERE c.ancestor = ? AND u.account_type = 'student'",
    [userId]
  );
  const direct = await queryOne("SELECT direct_count FROM users WHERE id = ?", [userId]);
  return Math.max(closure?.cnt || 0, direct?.direct_count || 0);
}

async function advanceUserRank(userId) {
  const user = await queryOne("SELECT id, rank, e_money FROM users WHERE id = ?", [userId]);
  if (!user) return null;
  const allRanks = await query("SELECT * FROM ranks WHERE is_active = 1 ORDER BY sort_order ASC");
  if (allRanks.length === 0) return null;

  let currentRankIdx = allRanks.findIndex(r => r.name === user.rank);
  if (!user.rank || user.rank === '') currentRankIdx = -1;
  else if (currentRankIdx === -1) currentRankIdx = 0;

  const currentRankSortOrder = currentRankIdx >= 0 ? allRanks[currentRankIdx].sort_order : null;
  let teamCount = await getQualifiedTeamCount(userId, currentRankSortOrder);

  let changed = false;
  for (let i = currentRankIdx + 1; i < allRanks.length; i++) {
    const next = allRanks[i];
    if (teamCount >= sReq(next)) {
      const prevRank = user.rank;
      user.rank = next.name;
      changed = true;

      await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
        [uuidv4(), userId, "🎉 Rank Up!", `You reached ${next.name} rank! Your bonus is included in the weekly commission.`]);

      teamCount = await getQualifiedTeamCount(userId, next.sort_order);
    } else {
      break;
    }
  }

  if (changed) {
    const newRankIdx = allRanks.findIndex(r => r.name === user.rank);
    let progress = 100;
    if (newRankIdx < allRanks.length - 1) {
      const nextRank = allRanks[newRankIdx + 1];
      progress = Math.min(100, Math.round((teamCount / sReq(nextRank)) * 100));
    }
    await execute("UPDATE users SET rank = ?, rank_progress = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [user.rank, progress, userId]);
  } else {
    const newRankIdx = allRanks.findIndex(r => r.name === user.rank);
    if (newRankIdx < allRanks.length - 1 && newRankIdx >= 0) {
      const nextRank = allRanks[newRankIdx + 1];
      let progress = Math.min(100, Math.round((teamCount / sReq(nextRank)) * 100));
      await execute("UPDATE users SET rank_progress = ?, updated_at = datetime('now','localtime') WHERE id = ?", [progress, userId]);
    }
  }
  return { rank: user.rank };
}

router.post("/update", async (req, res) => {
  try {
    const users = await query("SELECT id FROM users WHERE role != 'admin' AND account_type IN ('student','registration_free') AND status = 'active'");
    let updatedCount = 0;
    for (const u of users) {
      const result = await advanceUserRank(u.id);
      if (result) updatedCount++;
    }
    res.json({ success: true, updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/progress/:userId", async (req, res) => {
  try {
    await advanceUserRank(req.params.userId);
    const user = await queryOne("SELECT id, rank, rank_progress, e_money, account_type FROM users WHERE id = ?", [req.params.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const allRanks = await query("SELECT * FROM ranks WHERE is_active = 1 ORDER BY sort_order ASC");
    const idx = user.rank ? allRanks.findIndex(r => r.name === user.rank) : -1;
    let nextRank = null;
    let salesRequired = 0;
    let progress = user.rank_progress || 0;

    const currentSortOrder = idx >= 0 ? allRanks[idx].sort_order : null;
    const breakdown = await getQualifiedTeamBreakdown(req.params.userId, currentSortOrder);

    if (idx === -1 && allRanks.length > 0) {
      nextRank = allRanks[0];
      salesRequired = sReq(nextRank);
    } else if (idx < allRanks.length - 1) {
      nextRank = allRanks[idx + 1];
      salesRequired = sReq(nextRank);
    }

    // Direct sales breakdown (only approved students count toward rank)
    // Direct = referred via link OR created & paid for by this user (no own referrer)
    const directs = await query(
      "SELECT u.id, u.account_type, u.status FROM users u WHERE u.referred_by = ? OR (u.created_by_user = ? AND u.referred_by IS NULL)",
      [req.params.userId, req.params.userId]
    );
    const studentDirectSales = directs.filter(d => d.account_type === 'student' && d.status === 'active').length;
    const registrationDirectSales = directs.filter(d => d.account_type === 'registration_free' && d.status === 'active').length;
    const totalDirectSales = studentDirectSales + registrationDirectSales;
    const qualifiedDirectSales = studentDirectSales;
    const meetsMinDirects = qualifiedDirectSales >= 2;

    return res.json({
      currentRank: user.rank || null,
      currentRankData: idx >= 0 ? allRanks[idx] : null,
      currentBonus: idx >= 0 ? bVal(allRanks[idx]) : 0,
      currentSalesRequired: idx >= 0 ? sReq(allRanks[idx]) : 0,
      nextRank: nextRank ? nextRank.name : null,
      nextRankData: nextRank,
      nextBonus: nextRank ? bVal(nextRank) : 0,
      salesRequired: nextRank ? salesRequired : 0,
      qualifiedTeamCount: breakdown.qualifiedCount,
      studentMembers: breakdown.studentCount,
      registrationMembers: breakdown.registrationCount,
      higherRankExcluded: breakdown.higherRankExcluded,
      inactiveExcluded: breakdown.inactiveExcluded,
      qualifiedNetworkCount: breakdown.qualifiedNetworkCount,
      totalDirectSales,
      studentDirectSales,
      registrationDirectSales,
      qualifiedDirectSales,
      meetsMinDirects,
      requiredDirectSales: 2,
      progress: progress,
      e_money: user.e_money || 0,
      account_type: user.account_type
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/pay-sale", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = await queryOne("SELECT id, e_money, commission_per_sale, account_type FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.account_type !== "student") return res.status(400).json({ error: "Only student accounts can receive commissions" });

    const comAmount = user.commission_per_sale || 1000;

    await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [comAmount, userId]);

    const comId = uuidv4();
    await execute("INSERT INTO commissions (id, from_user_id, to_user_id, level, amount) VALUES (?, ?, ?, 0, ?)",
      [comId, userId, userId, comAmount]);

    await advanceUserRank(userId);

    res.json({ success: true, commission: comAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { advanceUserRank };
export default router;

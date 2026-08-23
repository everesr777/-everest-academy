import express from "express";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { adminAuth } from "../middleware/sessionAuth.js";
import { runWeeklySettlement, getSettlementSettings, getCurrentWeek, nextSettlementTime, settlementConfigDisplay } from "../services/weeklySettlement.js";

const router = express.Router();

const sReq = (r) => r.sales_required !== undefined ? r.sales_required : r.min_direct;
const bVal = (r) => r.bonus !== undefined ? r.bonus : r.weekly_bonus;

async function logAdminAction(req, action, targetId, targetName, details) {
  try {
    const adminName = req.headers["x-user-name"] || "Admin";
    const adminId = req.headers["x-admin-id"] || "unknown";
    await execute(
      "INSERT INTO admin_logs (id, admin_id, admin_name, action, target_user_id, target_user_name, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uuidv4(), adminId, adminName, action, targetId || null, targetName || null, details || null]
    );
  } catch (e) {
    console.error("Failed to log admin action:", e.message);
  }
}

async function resolveUserId(identifier) {
  if (!identifier) return null;
  const cleaned = String(identifier).trim().toUpperCase();
  if (!cleaned) return null;
  const byId = await queryOne("SELECT id FROM users WHERE id = ?", [cleaned]);
  if (byId) return byId.id;
  const byRef = await queryOne("SELECT id FROM users WHERE referral_code = ?", [cleaned]);
  return byRef ? byRef.id : null;
}

// ─── Team tree using Closure Table ───
router.get("/tree", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId query param required" });
    const descendants = await query(`
      SELECT u.id, u.referral_code, u.full_name, u.email, u.role, u.rank, u.e_money, u.account_type,
             u.direct_count, u.qualified_direct_count, u.created_at,
             u.referred_by, u.created_by_user, c.depth
      FROM user_closure c
      JOIN users u ON u.id = c.descendant
      WHERE c.ancestor = ? AND c.descendant != ?
      ORDER BY c.depth, u.created_at DESC
    `, [userId, userId]);
    const buildTree = (parentId) => {
      const children = descendants.filter(d => d.referred_by === parentId || d.created_by_user === parentId);
      return children.map(child => ({ ...child, children: buildTree(child.id) }));
    };
    res.json(buildTree(userId));
  } catch (err) {
    console.error("mlm/tree error:", err.message);
    res.json([]);
  }
});

router.get("/directs/:userId", async (req, res) => {
  try {
    const users = await query(
      "SELECT id, referral_code, full_name, email, phone, avatar, role, rank, e_money, direct_count, qualified_direct_count, account_type, status, created_at FROM users WHERE referred_by = ? OR created_by_user = ? ORDER BY created_at DESC",
      [req.params.userId, req.params.userId]
    );
    res.json(users);
  } catch (err) {
    console.error("mlm/directs error:", err.message);
    res.json([]);
  }
});

router.get("/upline/:userId", async (req, res) => {
  try {
    let upline = await query(`
      SELECT u.id, u.referral_code, u.full_name, u.email, u.role, u.rank, u.e_money,
             u.direct_count, u.avatar, c.depth
      FROM user_closure c
      JOIN users u ON u.id = c.ancestor
      WHERE c.descendant = ? AND c.ancestor != ?
      ORDER BY c.depth ASC
    `, [req.params.userId, req.params.userId]);
    if (upline.length === 0) {
      const me = await queryOne("SELECT referred_by FROM users WHERE id = ?", [req.params.userId]);
      if (me && me.referred_by && me.referred_by !== '') {
        const sponsor = await queryOne("SELECT id, referral_code, full_name, email, role, rank, e_money, direct_count, avatar FROM users WHERE id = ?", [me.referred_by]);
        if (sponsor) upline = [{ ...sponsor, depth: 1 }];
      }
    }
    res.json(upline);
  } catch (err) {
    console.error("mlm/upline error:", err.message);
    res.json([]);
  }
});

router.get("/lookup", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "code query param required" });
    const cleaned = String(code).trim().toUpperCase();
    const u = await queryOne(
      "SELECT id, referral_code, full_name, e_money FROM users WHERE id = ? OR referral_code = ?",
      [cleaned, cleaned]
    );
    if (!u) return res.json({ found: false });
    res.json({ found: true, id: u.id, referral_code: u.referral_code, full_name: u.full_name });
  } catch (err) {
    console.error("mlm/lookup error:", err.message);
    res.json({ found: false });
  }
});

router.get("/transfer/validate", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to query params required" });
  const fromId = await resolveUserId(from);
  const toId = await resolveUserId(to);
  if (!fromId || !toId) return res.json({ allowed: false, reason: "user_not_found" });
  if (fromId === toId) return res.json({ allowed: false, reason: "same_user" });
  const relation = await queryOne(`
    SELECT id FROM users
    WHERE ((referred_by = ? OR created_by_user = ?) AND id = ?) OR ((referred_by = ? OR created_by_user = ?) AND id = ?)
  `, [toId, toId, fromId, fromId, fromId, toId]);
  if (!relation) return res.json({ allowed: false, reason: "not_directly_connected" });
  const fromUser = await queryOne("SELECT e_money, negative_allowed FROM users WHERE id = ?", [fromId]);
  if (!fromUser) return res.json({ allowed: false, reason: "sender_not_found" });
  res.json({ allowed: true, balance: fromUser.e_money, negative_allowed: !!fromUser.negative_allowed });
});

router.post("/transfer", async (req, res) => {
  try {
    const { from_user_id, to_user_id, amount } = req.body;
    if (!from_user_id || !to_user_id || !amount) return res.status(400).json({ error: "from_user_id, to_user_id, and amount required" });
    const fromUserId = await resolveUserId(from_user_id);
    const toUserId = await resolveUserId(to_user_id);
    if (!fromUserId) return res.status(404).json({ error: "Sender not found" });
    if (!toUserId) return res.status(404).json({ error: "Receiver not found" });
    if (fromUserId === toUserId) return res.status(400).json({ error: "Cannot transfer to yourself" });
    if (amount <= 0) return res.status(400).json({ error: "Amount must be positive" });
    const relation = await queryOne(`
      SELECT id FROM users
      WHERE ((referred_by = ? OR created_by_user = ?) AND id = ?) OR ((referred_by = ? OR created_by_user = ?) AND id = ?)
    `, [toUserId, toUserId, fromUserId, fromUserId, fromUserId, toUserId]);
    if (!relation) return res.status(403).json({ error: "Transfer allowed only between direct upline/downline" });
    const fromUser = await queryOne("SELECT e_money, negative_allowed, full_name FROM users WHERE id = ?", [fromUserId]);
    if (!fromUser) return res.status(404).json({ error: "Sender not found" });
    if (fromUser.e_money < amount && !fromUser.negative_allowed) return res.status(400).json({ error: `Insufficient balance. Available: ${fromUser.e_money}, required: ${amount}` });
    const toUser = await queryOne("SELECT id, full_name FROM users WHERE id = ?", [toUserId]);
    if (!toUser) return res.status(404).json({ error: "Receiver not found" });
    const tid = uuidv4();
    await execute("UPDATE users SET e_money = e_money - ? WHERE id = ?", [amount, fromUserId]);
    await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [amount, toUserId]);
    await execute("INSERT INTO transfers (id, from_user_id, to_user_id, amount, status) VALUES (?, ?, ?, ?, 'completed')", [tid, fromUserId, toUserId, amount]);
    const txFromId = uuidv4();
    await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')", [txFromId, fromUserId, amount, "debit", `تحويل إلى ${toUser.full_name}`]);
    const txToId = uuidv4();
    await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')", [txToId, toUserId, amount, "credit", `تحويل من ${fromUser.full_name}`]);
    const nid1 = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'transfer')", [nid1, fromUserId, "💰 تحويل صادر", `تم تحويل ${amount} E-Money إلى ${toUser.full_name}`]);
    const nid2 = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'transfer')", [nid2, toUserId, "💰 تحويل وارد", `استلمت ${amount} E-Money من ${fromUser.full_name}`]);
    const updatedFrom = await queryOne("SELECT e_money FROM users WHERE id = ?", [fromUserId]);
    const updatedTo = await queryOne("SELECT e_money FROM users WHERE id = ?", [toUserId]);
    res.json({ success: true, transfer_id: tid, from_balance: updatedFrom.e_money, to_balance: updatedTo.e_money });
  } catch (err) {
    console.error("Transfer error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/transfers/:userId", async (req, res) => {
  const transfers = await query(`
    SELECT t.*, u1.full_name as from_name, u2.full_name as to_name
    FROM transfers t
    JOIN users u1 ON t.from_user_id = u1.id
    JOIN users u2 ON t.to_user_id = u2.id
    WHERE t.from_user_id = ? OR t.to_user_id = ?
    ORDER BY t.created_at DESC LIMIT 50
  `, [req.params.userId, req.params.userId]);
  res.json(transfers);
});

// ─── WEEKLY COMMISSION PROCESSING ───
// Business rules:
// 1. Direct Sale = any user who registered via referral code (Student OR Reg Free, must be Active)
// 2. Minimum 2 Direct Sales required for commission eligibility
// 3. Commission is calculated from Student accounts only
// 4. Reg Free accounts count toward rank but never generate commission
// 5. Members with higher rank than current user are excluded from qualified network
// 6. Every calculation is stored in weekly_history
router.post("/weekly-commission", adminAuth, async (req, res) => {
  try {
    // Rewired to the shared settlement engine (single commission on last achieved rank).
    const result = await runWeeklySettlement({ triggeredBy: "manual" });
    if (!result.success && result.error) return res.status(400).json({ error: result.error });
    return res.json(result);
    /* Legacy implementation below is intentionally unreachable — replaced by services/weeklySettlement.js */
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToMonday - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const weekStart = lastMonday.toISOString().slice(0, 10);
    const weekEnd = lastSunday.toISOString().slice(0, 10);
    const calcDate = now.toISOString().slice(0, 19).replace("T", " ");

    const existing = await queryOne("SELECT id FROM weekly_commissions WHERE week_start = ? LIMIT 1", [weekStart]);
    if (existing) return res.status(400).json({ error: `Weekly commission already calculated for week ${weekStart} - ${weekEnd}` });

    // All active users (both student and reg free)
    const users = await query(
      "SELECT id, full_name, email, rank, direct_count, e_money, account_type FROM users WHERE role IN ('student','registration') AND status = 'active'"
    );

    const allRanks = await query("SELECT * FROM ranks ORDER BY sort_order ASC");
    const rankMap = {};
    allRanks.forEach(r => { rankMap[r.name] = r; });

    const results = [];
    let totalAwarded = 0;

    for (const user of users) {
      const userRank = rankMap[user.rank];

      // STEP 1: Count all Direct Sales (Level 1 only — both Student + Reg Free, active only)
      // Direct = referred via link OR created & paid for by this user (no own referrer)
      const directs = await query(
        "SELECT u.id, u.account_type, u.status FROM users u WHERE u.referred_by = ? OR (u.created_by_user = ? AND u.referred_by IS NULL)",
        [user.id, user.id]
      );
      const activeDirects = directs.filter(d => d.status === 'active');
      const totalDirectSales = activeDirects.length;
      const studentDirectSales = activeDirects.filter(d => d.account_type === 'student').length;
      const registrationDirectSales = activeDirects.filter(d => d.account_type === 'registration_free').length;

      // STEP 2: Determine Qualified Direct Sales (only approved STUDENT directs qualify)
      const qualifiedDirectSales = studentDirectSales;

      // STEP 3: Verify minimum weekly requirement (2 qualified direct sales)
      if (qualifiedDirectSales < 2) {
        const whId = uuidv4();
        await execute(`INSERT INTO weekly_history (id, user_id, week_start, week_end, calculation_date,
          previous_rank, current_rank, total_direct_sales, student_direct_sales, registration_direct_sales,
          qualified_direct_sales, qualified_team_count, qualified_network_count, weekly_commission,
          commission_status, promotion_status, failure_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [whId, user.id, weekStart, weekEnd, calcDate,
            user.rank, user.rank, totalDirectSales, studentDirectSales, registrationDirectSales,
            qualifiedDirectSales, 0, 0, 0,
            'not_eligible', 'no_change', `Less than 2 qualified direct sales (${qualifiedDirectSales})`]);
        results.push({ user_id: user.id, rank: user.rank, eligible: false, reason: `directs < 2 (${qualifiedDirectSales})`, totalDirectSales, studentDirectSales, registrationDirectSales });
        continue;
      }

      // STEP 4: Recalculate qualified network (exclude higher-ranked members)
      const allTeamMembers = await query(
        "SELECT u.id, u.rank, u.status, u.account_type FROM user_closure c JOIN users u ON u.id = c.descendant WHERE c.ancestor = ? AND c.descendant != ? AND u.account_type IN ('student','registration_free')",
        [user.id, user.id]
      );

      let qualifiedTeamCount = 0;
      let studentMembers = 0;
      let registrationMembers = 0;
      let higherRankExcluded = 0;
      let inactiveExcluded = 0;
      const higherRankIds = [];

      for (const member of allTeamMembers) {
        if (member.status !== 'active') { inactiveExcluded++; continue; }
        const memberRankData = rankMap[member.rank];
        if (!memberRankData) {
          // Unranked member — always counts
          qualifiedTeamCount++;
          if (member.account_type === 'student') studentMembers++;
          else registrationMembers++;
          continue;
        }
        if (userRank && memberRankData.sort_order > userRank.sort_order) {
          higherRankExcluded++;
          higherRankIds.push(member.id);
          continue;
        }
        qualifiedTeamCount++;
        if (member.account_type === 'student') studentMembers++;
        else registrationMembers++;
      }

      const qualifiedNetworkCount = allTeamMembers.filter(m => m.status === 'active').length;

      // STEP 5: Recalculate rank
      const previousRank = user.rank;
      let promotionStatus = 'no_change';
      let newRank = user.rank;

      if (userRank) {
        // User has a rank — try to advance
        const rankIdx = allRanks.findIndex(r => r.name === user.rank);
        for (let i = (rankIdx >= 0 ? rankIdx + 1 : 0); i < allRanks.length; i++) {
          const next = allRanks[i];
          if (qualifiedTeamCount >= sReq(next)) {
            newRank = next.name;
            const bonusPaid = await queryOne("SELECT id FROM rank_bonuses WHERE user_id = ? AND rank_name = ?", [user.id, next.name]);
            const bonusAmount = bVal(next);
            if (bonusAmount > 0 && !bonusPaid) {
              const bid = uuidv4();
              await execute("INSERT INTO rank_bonuses (id, user_id, rank_name, amount) VALUES (?, ?, ?, ?)", [bid, user.id, next.name, bonusAmount]);
              await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [bonusAmount, user.id]);
              const txId = uuidv4();
              await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'credit', ?, 'completed')",
                [txId, user.id, bonusAmount, `🎉 Rank up bonus - ${next.name}`]);
            }
            await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
              [uuidv4(), user.id, "🎉 Rank Up!", `You reached ${next.name} rank! Bonus: ${bonusAmount || 0} EM`]);
          } else {
            break;
          }
        }
      } else {
        // Unranked — try to advance from first rank
        for (const next of allRanks) {
          if (qualifiedTeamCount >= sReq(next)) {
            newRank = next.name;
          } else {
            break;
          }
        }
      }

      if (newRank !== previousRank) {
        promotionStatus = 'promoted';
        const progress = allRanks.findIndex(r => r.name === newRank);
        const nextAfter = allRanks[progress + 1];
        const progressPct = nextAfter ? Math.min(100, Math.round((qualifiedTeamCount / sReq(nextAfter)) * 100)) : 100;
        await execute("UPDATE users SET rank = ?, rank_progress = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newRank, progressPct, user.id]);
      }

      // STEP 6: Calculate commission (only from Student accounts)
      const finalRank = rankMap[newRank];
      let weeklyCommission = 0;
      let commissionStatus = 'not_eligible';
      let failureReason = null;

      if (!finalRank) {
        commissionStatus = 'not_eligible';
        failureReason = 'No rank assigned';
      } else {
        const bonus = bVal(finalRank) || 0;
        if (bonus > 0) {
          weeklyCommission = bonus;
          commissionStatus = 'paid';

          // Award commission
          await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [bonus, user.id]);
          const comId = uuidv4();
          await execute(
            "INSERT INTO weekly_commissions (id, user_id, rank_name, amount, week_start, week_end, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')",
            [comId, user.id, finalRank.name, bonus, weekStart, weekEnd]
          );
          const txId = uuidv4();
          await execute(
            "INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')",
            [txId, user.id, bonus, "credit", `العمولة الأسبوعية - رتبة ${finalRank.name} (${weekStart})`]
          );
          await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'commission')",
            [uuidv4(), user.id, "🏆 عمولة أسبوعية", `ربحت ${bonus} E-Money كعمولة أسبوعية عن رتبة ${finalRank.name}`]);
          totalAwarded++;
        } else {
          commissionStatus = 'no_bonus';
          failureReason = `Rank ${finalRank.name} has no weekly bonus`;
        }
      }

      // STEP 7: Save Weekly History record
      const whId = uuidv4();
      const details = JSON.stringify({
        totalDirectSales, studentDirectSales, registrationDirectSales,
        qualifiedTeamCount, studentMembers, registrationMembers,
        higherRankExcluded, inactiveExcluded, higherRankIds,
        qualifiedNetworkCount
      });

      await execute(`INSERT INTO weekly_history (id, user_id, week_start, week_end, calculation_date,
        previous_rank, current_rank, total_direct_sales, student_direct_sales, registration_direct_sales,
        qualified_direct_sales, qualified_team_count, qualified_network_count, student_members,
        registration_members, higher_rank_excluded, inactive_excluded, weekly_commission,
        commission_status, promotion_status, failure_reason, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [whId, user.id, weekStart, weekEnd, calcDate,
          previousRank, newRank, totalDirectSales, studentDirectSales, registrationDirectSales,
          qualifiedDirectSales, qualifiedTeamCount, qualifiedNetworkCount, studentMembers,
          registrationMembers, higherRankExcluded, inactiveExcluded, weeklyCommission,
          commissionStatus, promotionStatus, failureReason, details]);

      // STEP 8: Backend logging
      console.log(`[WEEKLY] User: ${user.id} | Prev: ${previousRank || 'None'} → New: ${newRank || 'None'} | Directs: ${totalDirectSales} (S:${studentDirectSales} R:${registrationDirectSales}) | Team: ${qualifiedTeamCount} | Excl(H):${higherRankExcluded} Excl(I):${inactiveExcluded} | Commission: ${weeklyCommission} (${commissionStatus}) | Promotion: ${promotionStatus}`);

      results.push({
        user_id: user.id, rank: newRank, previousRank, eligible: commissionStatus === 'paid',
        bonus: weeklyCommission, totalDirectSales, studentDirectSales, registrationDirectSales,
        qualifiedDirectSales, qualifiedTeamCount, qualifiedNetworkCount, studentMembers,
        registrationMembers, higherRankExcluded, inactiveExcluded, promotionStatus,
        commissionStatus, failureReason
      });
    }

    res.json({ weekStart, weekEnd, total_users: users.length, awarded: totalAwarded, results });
  } catch (err) {
    console.error("Weekly commission error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── WEEKLY SETTLEMENT (new engine) ───
// Manual trigger (admin). Optional weekStart; force re-runs a failed/stale week.
router.post("/settlement", adminAuth, async (req, res) => {
  try {
    const { weekStart, force } = req.body || {};
    const result = await runWeeklySettlement({ triggeredBy: "manual", weekStart: weekStart || null, force: !!force });
    if (!result.success && result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    console.error("Settlement trigger error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Settlement config + status for the admin UI
router.get("/settlement/status", adminAuth, async (req, res) => {
  try {
    const settings = await getSettlementSettings();
    const last = await queryOne("SELECT value FROM settings WHERE key = 'settlement_last_run'");
    const runs = await query("SELECT week_start, week_end, status, triggered_by, created_at, completed_at, summary FROM weekly_settlements ORDER BY week_start DESC LIMIT 12");
    res.json({
      settings,
      config: settlementConfigDisplay(settings),
      currentWeek: await getCurrentWeek(settings),
      lastRun: last?.value || null,
      nextSettlement: nextSettlementTime(settings),
      runs
    });
  } catch (err) {
    console.error("Settlement status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Paid weekly commissions for a given week (who got paid)
router.get("/settlement/week/:weekStart", adminAuth, async (req, res) => {
  try {
    const commissions = await query(`
      SELECT wc.*, u.full_name, u.email, u.avatar, u.account_type
      FROM weekly_commissions wc
      JOIN users u ON u.id = wc.user_id
      WHERE wc.week_start = ?
      ORDER BY wc.amount DESC, u.full_name ASC
    `, [req.params.weekStart]);
    res.json({ week_start: req.params.weekStart, commissions });
  } catch (err) {
    console.error("Week commissions error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reverse (deduct) a single paid weekly commission from a user
router.post("/settlement/reverse", adminAuth, async (req, res) => {
  try {
    const { user_id, week_start } = req.body;
    if (!user_id || !week_start) return res.status(400).json({ error: "user_id and week_start required" });
    const commission = await queryOne(
      "SELECT * FROM weekly_commissions WHERE user_id = ? AND week_start = ? AND status = 'paid'",
      [user_id, week_start]
    );
    if (!commission) return res.status(404).json({ error: "No paid commission found for this user/week" });

    const user = await queryOne("SELECT id, full_name, e_money FROM users WHERE id = ?", [user_id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const newBalance = Math.max(0, (user.e_money || 0) - commission.amount);
    await execute("UPDATE users SET e_money = ? WHERE id = ?", [newBalance, user_id]);
    await execute("UPDATE weekly_commissions SET status = 'cancelled' WHERE id = ?", [commission.id]);
    await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'debit', ?, 'completed')",
      [uuidv4(), user_id, commission.amount, `إلغاء العمولة الأسبوعية - رتبة ${commission.rank_name} (${week_start})`]);
    await logAdminAction(req, "reverse weekly commission", user_id, user.full_name, `${commission.amount} EM (${commission.rank_name}, week ${week_start})`);

    res.json({ success: true, user_id, week_start, amount: commission.amount, new_balance: newBalance });
  } catch (err) {
    console.error("Reverse commission error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Weekly History (GET) ───
router.get("/weekly-history/:userId", async (req, res) => {
  try {
    const history = await query(
      "SELECT * FROM weekly_history WHERE user_id = ? ORDER BY week_start DESC LIMIT 52",
      [req.params.userId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/weekly-history", async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.query;
    let sql = "SELECT wh.*, u.full_name, u.email FROM weekly_history wh JOIN users u ON wh.user_id = u.id";
    const params = [];
    const conditions = [];
    if (weekStart) { conditions.push("wh.week_start >= ?"); params.push(weekStart); }
    if (weekEnd) { conditions.push("wh.week_end <= ?"); params.push(weekEnd); }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY wh.week_start DESC, wh.user_id LIMIT 500";
    const history = await query(sql, params);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Weekly commission history (old) ───
router.get("/weekly-commission/history", async (req, res) => {
  const { weekStart } = req.query;
  let sql = `
    SELECT wc.*, u.full_name, u.email, u.rank as current_rank
    FROM weekly_commissions wc
    JOIN users u ON wc.user_id = u.id
  `;
  const params = [];
  if (weekStart) { sql += " WHERE wc.week_start = ?"; params.push(weekStart); }
  sql += " ORDER BY wc.calculated_at DESC LIMIT 100";
  const commissions = await query(sql, params);
  for (const c of commissions) {
    c.exclusions = await query(`
      SELECT ce.*, u.full_name as excluded_name, u.rank as excluded_rank
      FROM commission_exclusions ce
      JOIN users u ON ce.excluded_user_id = u.id
      WHERE ce.commission_id = ?
    `, [c.id]);
  }
  res.json(commissions);
});

// ─── Detailed rank progress (for user frontend) ───
router.get("/rank-progress/:userId", async (req, res) => {
  try {
    const user = await queryOne("SELECT id, full_name, rank, direct_count, qualified_direct_count, e_money, account_type FROM users WHERE id = ?", [req.params.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allRanks = await query("SELECT * FROM ranks ORDER BY sort_order ASC");
    const currentRankIndex = allRanks.findIndex(r => r.name === user.rank);
    const currentRank = allRanks[currentRankIndex] || null;
    const nextRank = allRanks[currentRankIndex + 1] || null;

    const userSortOrder = currentRank ? currentRank.sort_order : null;

    // Direct sales breakdown (Direct = referred OR created & paid for by this user)
    const directs = await query(
      "SELECT u.id, u.full_name, u.email, u.phone, u.avatar, u.account_type, u.rank, u.e_money, u.status, u.created_at FROM users u WHERE u.referred_by = ? OR (u.created_by_user = ? AND u.referred_by IS NULL)",
      [user.id, user.id]
    );
    const activeDirects = directs.filter(d => d.status === 'active');
    const studentDirectSales = activeDirects.filter(d => d.account_type === 'student').length;
    const registrationDirectSales = activeDirects.filter(d => d.account_type === 'registration_free').length;
    const totalDirectSales = studentDirectSales + registrationDirectSales;
    const qualifiedDirectSales = studentDirectSales;

    // Qualified team (students + reg-free count toward rank progression)
    const allTeam = await query(
      "SELECT u.rank, u.status, u.account_type FROM user_closure c JOIN users u ON u.id = c.descendant WHERE c.ancestor = ? AND c.descendant != ? AND u.account_type IN ('student','registration_free')",
      [user.id, user.id]
    );

    const rankSortMap = {};
    allRanks.forEach(r => { rankSortMap[r.name] = r.sort_order; });

    let qualifiedTeamCount = 0;
    let studentMembers = 0;
    let registrationMembers = 0;
    let higherRankExcluded = 0;
    let inactiveExcluded = 0;

    for (const tm of allTeam) {
      if (tm.status !== 'active') { inactiveExcluded++; continue; }
      const tmSort = tm.rank ? (rankSortMap[tm.rank] ?? -1) : -1;
      if (userSortOrder !== null && tmSort > userSortOrder) {
        higherRankExcluded++;
        continue;
      }
      qualifiedTeamCount++;
      if (tm.account_type === 'student') studentMembers++;
      else registrationMembers++;
    }

    res.json({
      user,
      currentRank,
      nextRank,
      allRanks,
      directs: directs.map(d => ({ id: d.id, full_name: d.full_name, email: d.email, phone: d.phone, avatar: d.avatar, account_type: d.account_type, rank: d.rank, e_money: d.e_money, status: d.status, created_at: d.created_at })),
      qualifiedDirects: qualifiedTeamCount,
      totalDirects: user.direct_count,
      totalDirectSales,
      studentDirectSales,
      registrationDirectSales,
      qualifiedDirectSales,
      meetsMinDirects: qualifiedDirectSales >= 2,
      studentMembers,
      registrationMembers,
      higherRankExcluded,
      inactiveExcluded,
      qualifiedNetworkCount: allTeam.filter(m => m.status === 'active').length,
      progressToNext: nextRank ? Math.min(100, (qualifiedTeamCount / sReq(nextRank)) * 100) : 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/commissions", async (req, res) => {
  const { userId } = req.query;
  let commissions;
  if (userId) {
    commissions = await query(`
      SELECT c.*, u1.full_name as from_name, u1.email as from_email, u2.full_name as to_name
      FROM commissions c
      JOIN users u1 ON c.from_user_id = u1.id
      JOIN users u2 ON c.to_user_id = u2.id
      WHERE c.to_user_id = ?
      ORDER BY c.created_at DESC
    `, [userId]);
  } else {
    commissions = await query(`
      SELECT c.*, u1.full_name as from_name, u1.email as from_email, u2.full_name as to_name
      FROM commissions c
      JOIN users u1 ON c.from_user_id = u1.id
      JOIN users u2 ON c.to_user_id = u2.id
      ORDER BY c.created_at DESC
    `);
  }
  res.json(commissions);
});

router.get("/leaderboard", async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.rank, u.direct_count, u.qualified_direct_count,
             u.total_team_sales, u.e_money, u.account_type, u.avatar,
             COALESCE(r.weekly_bonus, 0) as weekly_bonus, COALESCE(r.sort_order, 0) as rank_order
      FROM users u
      LEFT JOIN ranks r ON u.rank = r.name
      WHERE u.role != 'admin' AND u.account_type IN ('student','registration_free')
      ORDER BY r.sort_order DESC, u.total_team_sales DESC
      LIMIT 10
    `);
    users.forEach((u, i) => u.position = i + 1);
    res.json(users);
  } catch (err) {
    console.error("mlm/leaderboard error:", err.message);
    res.json([]);
  }
});

router.get("/leaderboard/all", async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.rank, u.direct_count, u.qualified_direct_count,
             u.total_team_sales, u.e_money, u.avatar, u.account_type,
             COALESCE(r.weekly_bonus, 0) as weekly_bonus, COALESCE(r.sort_order, 0) as rank_order
      FROM users u
      LEFT JOIN ranks r ON u.rank = r.name
      WHERE u.role != 'admin' AND u.account_type IN ('student','registration_free')
      ORDER BY r.sort_order DESC, u.total_team_sales DESC
    `);
    res.json(users);
  } catch (err) {
    console.error("mlm/leaderboard/all error:", err.message);
    res.json([]);
  }
});

router.post("/backfill-closure", async (req, res) => {
  try {
    await execute("DELETE FROM user_closure");
    const users = await query("SELECT id, referred_by, created_by_user FROM users ORDER BY created_at ASC");
    let count = 0;
    for (const u of users) {
      await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 0)", [u.id, u.id]);
      count++;
      const parentId = u.referred_by || u.created_by_user;
      if (parentId) {
        const ancestors = await query(
          "SELECT ancestor, depth FROM user_closure WHERE descendant = ? AND ancestor != descendant",
          [parentId]
        );
        for (const a of ancestors) {
          await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, ?)", [a.ancestor, u.id, a.depth + 1]);
        }
        await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 1)", [parentId, u.id]);
      }
    }
    res.json({ success: true, processed: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;

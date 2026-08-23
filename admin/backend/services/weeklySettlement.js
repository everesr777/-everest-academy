import { v4 as uuidv4 } from "uuid";
import { query, queryOne, execute } from "../db.js";

export const WEEKLY_SETTLEMENT_DEFAULTS = {
  settlement_enabled: "true",
  settlement_day: "5",
  settlement_hour: "0",
  settlement_minute: "0",
  settlement_timezone: "Africa/Cairo",
  settlement_min_direct_sales: "2",
};

const WEEK_KEYS = Object.keys(WEEKLY_SETTLEMENT_DEFAULTS);
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ─── Settings ───
export async function getSettlementSettings() {
  const rows = await query(`SELECT key, value FROM settings WHERE key IN (${WEEK_KEYS.map(() => "?").join(",")})`, WEEK_KEYS);
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  for (const [k, v] of Object.entries(WEEKLY_SETTLEMENT_DEFAULTS)) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === "") obj[k] = v;
  }
  return obj;
}

export async function ensureSettlementSettings() {
  for (const [k, v] of Object.entries(WEEKLY_SETTLEMENT_DEFAULTS)) {
    try { await execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [k, v]); } catch (e) {}
  }
  // Migrate stale seed defaults (old: Sun 23:55) → new default (Fri 00:00) without touching admin overrides.
  try {
    await execute("UPDATE settings SET value = '5' WHERE key = 'settlement_day' AND value = '0'");
    await execute("UPDATE settings SET value = '0' WHERE key = 'settlement_hour' AND value = '23'");
    await execute("UPDATE settings SET value = '0' WHERE key = 'settlement_minute' AND value = '55'");
  } catch (e) {}
  try { await execute("UPDATE weekly_settlements SET status = 'failed' WHERE status = 'running'"); } catch (e) {}
}

// ─── Timezone helpers ───
// Wall-clock parts of a Date inside an IANA timezone.
export function partsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const y = parseInt(parts.year, 10);
  const mo = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { y, mo, d, dow, hour, minute: parseInt(parts.minute, 10), second: parseInt(parts.second, 10) };
}

function fmtDate(dt) {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function dateFromUtc(y, mo, d) {
  return new Date(Date.UTC(y, mo - 1, d));
}

function weekEndFromStart(weekStart) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return fmtDate(new Date(Date.UTC(y, m - 1, d + 6)));
}

// Date (YYYY-MM-DD) of the most recent occurrence of `day` in `tz` (today counts if today is `day`).
function mostRecentDayDate(tz, day, now) {
  const p = partsInTz(now, tz);
  const daysBack = (p.dow - day + 7) % 7;
  return dateFromUtc(p.y, p.mo, p.d - daysBack);
}

// The running week (used for weekly_sales attribution + leaderboard display).
export async function getCurrentWeek(s = null) {
  const settings = s || await getSettlementSettings();
  const tz = settings.settlement_timezone || "Africa/Cairo";
  const day = parseInt(settings.settlement_day, 10) || 0;
  const ws = mostRecentDayDate(tz, day, new Date());
  const we = new Date(Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() + 6));
  return { weekStart: fmtDate(ws), weekEnd: fmtDate(we) };
}

// The week that has just ended at the settlement moment (auto mode).
export async function getSettlementWeek(s = null) {
  const settings = s || await getSettlementSettings();
  const tz = settings.settlement_timezone || "Africa/Cairo";
  const day = parseInt(settings.settlement_day, 10) || 0;
  const ws = mostRecentDayDate(tz, day, new Date());
  const wsPrev = new Date(Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate() - 7));
  const we = new Date(Date.UTC(wsPrev.getUTCFullYear(), wsPrev.getUTCMonth(), wsPrev.getUTCDate() + 6));
  return { weekStart: fmtDate(wsPrev), weekEnd: fmtDate(we) };
}

export function nextSettlementTime(settings = null) {
  const s = settings || WEEKLY_SETTLEMENT_DEFAULTS;
  const tz = s.settlement_timezone || "Africa/Cairo";
  const day = parseInt(s.settlement_day, 10) || 0;
  const hour = parseInt(s.settlement_hour, 10) || 0;
  const minute = parseInt(s.settlement_minute, 10) || 0;
  const now = new Date();
  const p = partsInTz(now, tz);
  let daysAhead = (day - p.dow + 7) % 7;
  if (daysAhead === 0 && (p.hour > hour || (p.hour === hour && p.minute >= minute))) daysAhead = 7;
  const target = new Date(Date.UTC(p.y, p.mo - 1, p.d + daysAhead, hour, minute));
  const iso = target.toISOString();
  return { iso, label: `${fmtDate(target)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (${tz})`, day: DAY_NAMES[day] || day };
}

export function settlementConfigDisplay(settings = null) {
  const s = settings || WEEKLY_SETTLEMENT_DEFAULTS;
  return {
    enabled: s.settlement_enabled === "true",
    day: DAY_NAMES[parseInt(s.settlement_day, 10) || 0] || s.settlement_day,
    hour: parseInt(s.settlement_hour, 10) || 0,
    minute: parseInt(s.settlement_minute, 10) || 0,
    timezone: s.settlement_timezone || "Africa/Cairo",
    minDirectSales: parseInt(s.settlement_min_direct_sales, 10) || 2,
  };
}

// ─── Weekly sales recording (on approved enrollment) ───
// Each approved enrollment counts as +1 sale for the enrolling student (if student)
// and for every student account in their upline chain.
export async function recordWeeklySales(enrollmentUserId, enrollmentId) {
  try {
    const en = await queryOne("SELECT sales_counted FROM enrollments WHERE id = ?", [enrollmentId]);
    if (!en || en.sales_counted === 1) return;
    const self = await queryOne("SELECT id, account_type FROM users WHERE id = ?", [enrollmentUserId]);
    if (!self) return;
    const week = await getCurrentWeek();
    const weekStart = week.weekStart;

    const bump = async (uid) => {
      await execute(
        "INSERT INTO weekly_sales (id, user_id, week_start, sales) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, week_start) DO UPDATE SET sales = sales + 1",
        [uuidv4(), uid, weekStart]
      );
    };

    if (self.account_type === "student") await bump(enrollmentUserId);

    let uplineId = (await queryOne("SELECT referred_by FROM users WHERE id = ?", [enrollmentUserId]))?.referred_by;
    const visited = new Set();
    while (uplineId && !visited.has(uplineId)) {
      visited.add(uplineId);
      const upline = await queryOne("SELECT id, account_type FROM users WHERE id = ?", [uplineId]);
      if (upline && upline.account_type === "student") await bump(upline.id);
      uplineId = (await queryOne("SELECT referred_by FROM users WHERE id = ?", [uplineId]))?.referred_by;
    }

    await execute("UPDATE enrollments SET sales_counted = 1 WHERE id = ?", [enrollmentId]);
  } catch (e) {
    console.error("recordWeeklySales error:", e.message);
  }
}

// ─── Settlement ───
const sReq = (r) => r.sales_required !== undefined ? r.sales_required : r.min_direct;
const bVal = (r) => r.bonus !== undefined ? r.bonus : r.weekly_bonus;

// ─── "Our Leaders" homepage snapshot ───
// Rebuilds the stored top-10 leaders list shown on the user homepage.
// Called automatically at the end of every successful weekly settlement,
// and by the leaders routes when a manual/periodic refresh is due.
export const LEADER_RANK_ICONS = { "Star":"⭐","Executive":"🚀","Executive Star":"💎","Team Leader":"🏆","Senior Leader":"🌍","Regional Leader":"⚡","Everest Elite":"🔱","Everest Master":"🔥","Everest Legend":"🌟","Everest Ambassador":"👑" };

const LEADER_RANK_ORDER_SQL = `CASE rank
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

export async function refreshLeadersSnapshot() {
  const excluded = await query("SELECT user_id FROM excluded_leaders");
  const excludedIds = excluded.map(e => e.user_id);
  let excludeClause = "";
  const params = [];
  if (excludedIds.length > 0) {
    excludeClause = `AND id NOT IN (${excludedIds.map(() => "?").join(",")})`;
    params.push(...excludedIds);
  }
  const topUsers = await query(`
    SELECT id, full_name as name, avatar, rank, e_money, direct_count
    FROM users
    WHERE role NOT IN ('admin', 'manager') AND rank IS NOT NULL AND rank != '' ${excludeClause}
    ORDER BY ${LEADER_RANK_ORDER_SQL}, direct_count DESC
    LIMIT 10
  `, params);
  await execute("DELETE FROM leaders");
  for (const u of topUsers) {
    await execute(
      "INSERT INTO leaders (id, name, rank, avatar, icon) VALUES (?, ?, ?, ?, ?)",
      [u.id, u.name, u.rank, u.avatar, LEADER_RANK_ICONS[u.rank] || "🏆"]
    );
  }
  await execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('leaders_last_refresh', datetime('now','localtime'))");
  console.log(`🏆 Leaders refreshed: ${topUsers.length} users`);
  return topUsers.length;
}

export async function runWeeklySettlement({ triggeredBy = "auto", weekStart: forcedWeekStart = null, force = false } = {}) {
  const settings = await getSettlementSettings();
  if (settings.settlement_enabled !== "true" && triggeredBy !== "manual") {
    return { success: false, skipped: "disabled" };
  }

  const week = forcedWeekStart
    ? { weekStart: forcedWeekStart, weekEnd: weekEndFromStart(forcedWeekStart) }
    : (triggeredBy === "manual" ? await getCurrentWeek(settings) : await getSettlementWeek(settings));
  const { weekStart, weekEnd } = week;

  // Atomic claim: UNIQUE(week_start) prevents double processing from any path.
  const claimId = uuidv4();
  await execute("INSERT OR IGNORE INTO weekly_settlements (id, week_start, week_end, status, triggered_by) VALUES (?, ?, ?, 'running', ?)",
    [claimId, weekStart, weekEnd, triggeredBy]);
  const claimed = await queryOne("SELECT id, status FROM weekly_settlements WHERE week_start = ?", [weekStart]);
  if (!claimed) return { success: false, error: `Failed to claim week ${weekStart}` };
  if (claimed.status === "completed") {
    return { success: false, error: `Week ${weekStart} already settled` };
  }
  if (claimed.status === "running" && claimed.id !== claimId && !force) {
    return { success: false, error: `Week ${weekStart} settlement already in progress` };
  }

  try {
    const minDirectSales = parseInt(settings.settlement_min_direct_sales, 10) || 2;

    // Duplicate guard (defense-in-depth on top of the claim table)
    const existingCommission = await queryOne("SELECT id FROM weekly_commissions WHERE week_start = ? LIMIT 1", [weekStart]);
    if (existingCommission) {
      await execute("UPDATE weekly_settlements SET status = 'completed', completed_at = datetime('now','localtime'), summary = ? WHERE id = ?",
        [JSON.stringify({ duplicate: true }), claimId]);
      return { success: false, error: `Week ${weekStart} already settled` };
    }

    const users = await query(
      "SELECT id, full_name, email, rank, direct_count, e_money, account_type FROM users WHERE role IN ('student','registration') AND status = 'active'"
    );
    const allRanks = await query("SELECT * FROM ranks ORDER BY sort_order ASC");
    const rankMap = {};
    allRanks.forEach(r => { rankMap[r.name] = r; });

    const results = [];
    let totalAwarded = 0;
    let totalCommissions = 0;

    for (const user of users) {
      const userRank = rankMap[user.rank];

      // STEP 1: Direct sales (Level 1, active only)
      // Only approved STUDENT accounts count toward the referrer's rank.
      // registration_free approvals are recorded for info but never count.
      // A direct sale = referred via link OR created & paid for by this user
      // (created_by_user) when the account has no referral link of its own.
      const directs = await query("SELECT u.id, u.account_type, u.status FROM users u WHERE u.referred_by = ? OR (u.created_by_user = ? AND u.referred_by IS NULL)", [user.id, user.id]);
      const activeDirects = directs.filter(d => d.status === 'active');
      const studentDirectSales = activeDirects.filter(d => d.account_type === 'student').length;
      const registrationDirectSales = activeDirects.filter(d => d.account_type === 'registration_free').length;
      const totalDirectSales = studentDirectSales + registrationDirectSales;
      const qualifiedDirectSales = studentDirectSales;

      // STEP 2: Minimum direct sales eligibility (configurable, default 2)
      if (qualifiedDirectSales < minDirectSales) {
        const whId = uuidv4();
        await execute(`INSERT INTO weekly_history (id, user_id, week_start, week_end, calculation_date,
          previous_rank, current_rank, total_direct_sales, student_direct_sales, registration_direct_sales,
          qualified_direct_sales, qualified_team_count, qualified_network_count, weekly_commission,
          commission_status, promotion_status, failure_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [whId, user.id, weekStart, weekEnd, new Date().toISOString().slice(0, 19).replace("T", " "),
            user.rank, user.rank, totalDirectSales, studentDirectSales, registrationDirectSales,
            qualifiedDirectSales, 0, 0, 0,
            'not_eligible', 'no_change', `Less than ${minDirectSales} qualified direct sales (${qualifiedDirectSales})`]);
        results.push({ user_id: user.id, rank: user.rank, eligible: false, reason: `directs < ${minDirectSales} (${qualifiedDirectSales})`, totalDirectSales, studentDirectSales, registrationDirectSales });
        continue;
      }

      // STEP 3: Qualified team (exclude higher-ranked / inactive members)
      // Team progression counts ALL active members (students + registration_free),
      // matching the Aug-7 behavior. The qualification gate (STEP 2) stays students-only.
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

      // STEP 4: Recalculate rank (identical conditions to the previous system)
      const previousRank = user.rank;
      let promotionStatus = 'no_change';
      let newRank = user.rank;
      if (userRank) {
        const rankIdx = allRanks.findIndex(r => r.name === user.rank);
        for (let i = (rankIdx >= 0 ? rankIdx + 1 : 0); i < allRanks.length; i++) {
          const next = allRanks[i];
          if (qualifiedTeamCount >= sReq(next)) {
            newRank = next.name;
            await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
              [uuidv4(), user.id, "🎉 Rank Up!", `You reached ${next.name} rank! Your bonus is included in the weekly commission.`]);
          } else { break; }
        }
      } else {
        for (const next of allRanks) {
          if (qualifiedTeamCount >= sReq(next)) { newRank = next.name; } else { break; }
        }
      }
      if (newRank !== previousRank) {
        promotionStatus = 'promoted';
        const progress = allRanks.findIndex(r => r.name === newRank);
        const nextAfter = allRanks[progress + 1];
        const progressPct = nextAfter ? Math.min(100, Math.round((qualifiedTeamCount / sReq(nextAfter)) * 100)) : 100;
        await execute("UPDATE users SET rank = ?, rank_progress = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newRank, progressPct, user.id]);
      }

      // STEP 5: Single weekly commission on the LAST qualified rank (no separate rank-up bonus)
      const finalRank = rankMap[newRank];
      let weeklyCommission = 0;
      let commissionStatus = 'not_eligible';
      let failureReason = null;
      if (!finalRank) {
        failureReason = 'No rank assigned';
      } else {
        const bonus = bVal(finalRank) || 0;
        if (bonus > 0) {
          weeklyCommission = bonus;
          commissionStatus = 'paid';
          await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [bonus, user.id]);
          await execute("INSERT INTO weekly_commissions (id, user_id, rank_name, amount, week_start, week_end, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')",
            [uuidv4(), user.id, finalRank.name, bonus, weekStart, weekEnd]);
          await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'credit', ?, 'completed')",
            [uuidv4(), user.id, bonus, `العمولة الأسبوعية - رتبة ${finalRank.name} (${weekStart})`]);
          await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'commission')",
            [uuidv4(), user.id, "🏆 عمولة أسبوعية", `ربحت ${bonus} E-Money كعمولة أسبوعية عن رتبة ${finalRank.name}`]);
          totalAwarded++;
          totalCommissions += bonus;
        } else {
          commissionStatus = 'no_bonus';
          failureReason = `Rank ${finalRank.name} has no weekly bonus`;
        }
      }

      // STEP 6: Weekly history record
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
        [whId, user.id, weekStart, weekEnd, new Date().toISOString().slice(0, 19).replace("T", " "),
          previousRank, newRank, totalDirectSales, studentDirectSales, registrationDirectSales,
          qualifiedDirectSales, qualifiedTeamCount, qualifiedNetworkCount, studentMembers,
          registrationMembers, higherRankExcluded, inactiveExcluded, weeklyCommission,
          commissionStatus, promotionStatus, failureReason, details]);

      results.push({
        user_id: user.id, rank: newRank, previousRank, eligible: commissionStatus === 'paid',
        bonus: weeklyCommission, totalDirectSales, studentDirectSales, registrationDirectSales,
        qualifiedDirectSales, qualifiedTeamCount, qualifiedNetworkCount, studentMembers,
        registrationMembers, higherRankExcluded, inactiveExcluded, promotionStatus,
        commissionStatus, failureReason
      });
    }

    // STEP 7: Snapshot Top-10 weekly leaderboard (by weekly sales, tie-break by rank then directs)
    const top = await query(`
      SELECT ws.user_id, ws.sales,
             u.full_name, u.avatar, u.rank, u.direct_count, u.account_type,
             COALESCE(r.sort_order, 0) as rank_order
      FROM weekly_sales ws
      JOIN users u ON u.id = ws.user_id
      LEFT JOIN ranks r ON u.rank = r.name
      WHERE ws.week_start = ? AND u.role != 'admin' AND u.account_type IN ('student','registration_free')
      ORDER BY ws.sales DESC, rank_order DESC, u.direct_count DESC
      LIMIT 10
    `, [weekStart]);
    await execute("DELETE FROM leaderboard_history WHERE week_start = ?", [weekStart]);
    for (let i = 0; i < top.length; i++) {
      await execute("INSERT OR REPLACE INTO leaderboard_history (id, week_start, rank_position, user_id, full_name, avatar, rank, weekly_sales) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [uuidv4(), weekStart, i + 1, top[i].user_id, top[i].full_name || "—", top[i].avatar, top[i].rank || "", top[i].sales]);
    }

    // STEP 8: Reset weekly sales counters — ONLY after the leaderboard snapshot is saved.
    // Next week's sales accumulate under a fresh week_start, so they start from zero.
    await execute("DELETE FROM weekly_sales WHERE week_start = ?", [weekStart]);

    const summary = JSON.stringify({ totalUsers: users.length, awarded: totalAwarded, totalCommissions, top10: top.length });
    await execute("UPDATE weekly_settlements SET status = 'completed', completed_at = datetime('now','localtime'), summary = ? WHERE id = ?", [summary, claimId]);
    await execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('settlement_last_run', ?)",
      [`${weekStart}|${weekEnd}|${new Date().toISOString()}|${triggeredBy}|${totalAwarded}`]);

    console.log(`🏆 [SETTLEMENT] Week ${weekStart} - ${weekEnd} (${triggeredBy}): ${totalAwarded} awarded out of ${users.length}, ${totalCommissions} EM total`);

    // STEP 9: Refresh "Our Leaders" homepage snapshot so new promotions appear immediately.
    try { await refreshLeadersSnapshot(); } catch (e) { console.error("Leaders snapshot refresh failed:", e.message); }

    return { success: true, weekStart, weekEnd, triggeredBy, total_users: users.length, awarded: totalAwarded, totalCommissions, results, top10: top.length };
  } catch (e) {
    try { await execute("UPDATE weekly_settlements SET status = 'failed', completed_at = datetime('now','localtime') WHERE id = ?", [claimId]); } catch (_) {}
    console.error("Weekly settlement error:", e);
    throw e;
  }
}

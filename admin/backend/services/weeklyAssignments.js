import { v4 as uuidv4 } from "uuid";
import { query, queryOne, execute } from "../db.js";
import { weekEndFromStart } from "./weeklySettlement.js";

/**
 * Retroactive weekly direct-sale assignments.
 *
 * Why this exists:
 *   The settlement gate counts a direct sale only when the direct member's `created_at`
 *   falls inside the settlement week window. Accounts created later (or created in another
 *   week) can never qualify for a past week — and we must NOT rewrite `created_at`.
 *
 *   This table records an explicit, auditable decision:
 *     "direct <direct_id> counts as a NEW direct sale of <upline_id> for week <week_start>".
 *
 *   `runWeeklySettlement` reads this table and adds those directs to the weekly gate,
 *   so the original `created_at` stays untouched while the business decision is honoured.
 */

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeWeekStart(input) {
  const raw = String(input || "").trim();
  if (!WEEK_RE.test(raw)) throw new Error("weekStart must be YYYY-MM-DD");
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) throw new Error("weekStart is not a valid date");
  return raw;
}

export function weekWindow(weekStart) {
  const ws = normalizeWeekStart(weekStart);
  return { weekStart: ws, weekEnd: weekEndFromStart(ws) };
}

/** Case-insensitive lookup. Returns null when the account does not exist. */
export async function resolveUserByEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return null;
  return queryOne(
    "SELECT id, full_name, email, role, account_type, status, rank, created_at, referred_by, created_by_user FROM users WHERE LOWER(email) = ? LIMIT 1",
    [clean]
  );
}

/**
 * Direct uplines of a member according to `user_closure` (the same source of truth the
 * settlement uses for depth-1 directs).
 */
export async function resolveDirectUplines(directId) {
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, u.rank, u.account_type, u.role, u.status
       FROM user_closure c
       JOIN users u ON u.id = c.ancestor
      WHERE c.descendant = ? AND c.depth = 1 AND c.ancestor != ?
      ORDER BY u.email`,
    [directId, directId]
  );
  return rows;
}

/** Ranks visible to the UI so the preview can explain eligibility. */
async function rankInfo() {
  return query("SELECT name, sales_required, min_direct, bonus, weekly_bonus, sort_order FROM ranks ORDER BY sort_order ASC");
}

function rankBonus(rank) {
  if (!rank) return 0;
  if (rank.bonus !== undefined && rank.bonus !== null && Number(rank.bonus) > 0) return Number(rank.bonus);
  if (rank.weekly_bonus !== undefined && rank.weekly_bonus !== null) return Number(rank.weekly_bonus);
  return 0;
}

function rankThreshold(rank) {
  if (!rank) return 0;
  if (rank.sales_required !== undefined && rank.sales_required !== null) return Number(rank.sales_required);
  return Number(rank.min_direct || 0);
}

/**
 * Read-only preview for one or more emails against a given week.
 * Never writes anything.
 *
 * The gate projection is BATCH-AWARE: when several emails share an upline they are
 * counted together, so the preview shows the real post-assignment gate (not the effect
 * of each email in isolation).
 */
export async function previewAssignments({ weekStart, emails }) {
  const { weekStart: ws, weekEnd } = weekWindow(weekStart);
  const settingsRow = await queryOne("SELECT value FROM settings WHERE key = 'settlement_min_direct_sales'");
  const minDirectSales = parseInt(settingsRow && settingsRow.value, 10) || 2;
  const ranks = await rankInfo();
  const rankMap = Object.fromEntries(ranks.map(r => [r.name, r]));
  const settlement = await queryOne("SELECT id, status, created_at, completed_at, summary FROM weekly_settlements WHERE week_start = ?", [ws]);

  // ── Pass 1: resolve every email (nothing is written) ──
  const items = [];
  for (const email of emails) {
    const user = await resolveUserByEmail(email);
    if (!user) {
      items.push({ email, found: false, reason: "not_found" });
      continue;
    }

    const uplines = await resolveDirectUplines(user.id);
    const assigned = await query(
      `SELECT a.id, a.upline_id, a.week_start, a.assigned_at, a.reason
         FROM weekly_direct_assignments a
        WHERE a.direct_id = ? AND a.week_start = ?`,
      [user.id, ws]
    );

    const directInWindow =
      user.created_at >= `${ws} 00:00:00` && user.created_at <= `${weekEnd} 23:59:59`;
    const blockedReason =
      user.status !== "active"
        ? "account_not_active"
        : user.account_type !== "student"
          ? "not_a_student_account"
          : uplines.length === 0
            ? "no_direct_upline"
            : null;

    items.push({
      email,
      found: true,
      userId: user.id,
      fullName: user.full_name,
      accountType: user.account_type,
      status: user.status,
      rank: user.rank || null,
      createdAt: user.created_at,
      createdInsideWeek: directInWindow,
      needsAssignment: !directInWindow,
      assignmentsForWeek: assigned,
      blockedReason,
      _uplines: uplines,          // raw rows, replaced by details below
      _assignedUplineIds: new Set(assigned.map(a => a.upline_id)),
    });
  }

  // ── Pass 2: batch projection per upline ──
  // Every assignable previewed direct is pooled per upline so the projected gate is the
  // union of (inside-window directs ∪ already-assigned directs ∪ this batch).
  const previewAdds = new Map();
  for (const item of items) {
    if (!item.found || item.blockedReason) continue;
    for (const up of item._uplines) {
      if (!previewAdds.has(up.id)) previewAdds.set(up.id, new Set());
      previewAdds.get(up.id).add(item.userId);
    }
  }

  const metrics = new Map();
  for (const [uplineId, batchIds] of previewAdds) {
    const up = items
      .flatMap(i => (i.found ? i._uplines : []))
      .find(u => u.id === uplineId);
    if (!up) continue;

    const historyRow = await queryOne(
      "SELECT qualified_direct_sales, commission_status, weekly_commission FROM weekly_history WHERE user_id = ? AND week_start = ?",
      [uplineId, ws]
    );
    const paidRow = await queryOne(
      "SELECT id, amount, rank_name FROM weekly_commissions WHERE user_id = ? AND week_start = ?",
      [uplineId, ws]
    );

    const directRows = await query(
      `SELECT u.id, u.account_type, u.status, u.created_at
         FROM user_closure c JOIN users u ON u.id = c.descendant
        WHERE c.ancestor = ? AND c.depth = 1`,
      [uplineId]
    );
    const activeStudents = directRows.filter(d => d.status === "active" && d.account_type === "student");
    const inWindow = activeStudents.filter(d =>
      d.created_at >= `${ws} 00:00:00` && d.created_at <= `${weekEnd} 23:59:59`
    );
    const assignedRows = await query(
      `SELECT a.direct_id FROM weekly_direct_assignments a
         JOIN users u ON u.id = a.direct_id
        WHERE a.upline_id = ? AND a.week_start = ? AND u.status = 'active' AND u.account_type = 'student'`,
      [uplineId, ws]
    );
    const mergedIds = new Set([
      ...inWindow.map(d => d.id),
      ...assignedRows.map(r => r.direct_id),
      ...batchIds,
    ]);
    const weeklyGateAfter = mergedIds.size;

    const currentRank = rankMap[up.rank] || null;
    const teamRows = await query(
      `SELECT u.id, u.rank, u.status, u.account_type
         FROM user_closure c JOIN users u ON u.id = c.descendant
        WHERE c.ancestor = ? AND c.descendant != ? AND u.account_type = 'student'`,
      [uplineId, uplineId]
    );
    const qualifiedTeam = teamRows.filter(m => {
      if (m.status !== "active") return false;
      const mr = rankMap[m.rank];
      if (!mr) return true;
      if (currentRank && Number(mr.sort_order) > Number(currentRank.sort_order)) return false;
      return true;
    }).length;

    let projectedRank = up.rank || "";
    let projectedBonus = 0;
    if (currentRank) {
      for (let i = Number(currentRank.sort_order) + 1; i < ranks.length; i++) {
        if (qualifiedTeam >= rankThreshold(ranks[i])) {
          projectedRank = ranks[i].name;
          projectedBonus = rankBonus(ranks[i]);
        } else break;
      }
    } else {
      for (const r of ranks) {
        if (qualifiedTeam >= rankThreshold(r)) {
          projectedRank = r.name;
          projectedBonus = rankBonus(r);
        } else break;
      }
    }
    if (projectedRank === (up.rank || "")) projectedBonus = rankBonus(currentRank);

    metrics.set(uplineId, {
      uplineId,
      uplineName: up.full_name,
      uplineEmail: up.email,
      uplineRank: up.rank || null,
      uplineStatus: up.status,
      weeklyGateBefore: inWindow.length,
      weeklyGateAfter,
      minRequired: minDirectSales,
      eligibleBefore: inWindow.length >= minDirectSales,
      eligibleAfter: weeklyGateAfter >= minDirectSales,
      qualifiedTeam,
      projectedRank,
      projectedCommission: projectedBonus,
      alreadyPaidThisWeek: paidRow ? { amount: paidRow.amount, rank: paidRow.rank_name } : null,
      lastCalculated: historyRow || null,
    });
  }

  // ── Pass 3: attach details to each item ──
  for (const item of items) {
    if (!item.found) continue;
    item.uplines = item._uplines.map(up => ({
      ...(metrics.get(up.id) || {
        uplineId: up.id,
        uplineName: up.full_name,
        uplineEmail: up.email,
        uplineRank: up.rank || null,
        uplineStatus: up.status,
        weeklyGateBefore: 0,
        weeklyGateAfter: 0,
        minRequired: minDirectSales,
        eligibleBefore: false,
        eligibleAfter: false,
        qualifiedTeam: 0,
        projectedRank: up.rank || "",
        projectedCommission: 0,
        alreadyPaidThisWeek: null,
        lastCalculated: null,
      }),
      alreadyAssigned: item._assignedUplineIds.has(up.id),
      assignmentId: (item.assignmentsForWeek.find(a => a.upline_id === up.id) || {}).id || null,
      inThisBatch: previewAdds.get(up.id)?.has(item.userId) || false,
    }));
    delete item._uplines;
    delete item._assignedUplineIds;
  }

  return { weekStart: ws, weekEnd, minDirectSales, settlement: settlement || null, items };
}

/**
 * Creates (or reuses) the direct-sale assignment rows for the given emails in a week.
 * Safe to call repeatedly: UNIQUE(upline_id, direct_id, week_start) prevents duplicates.
 */
export async function assignEmailsToWeek({ weekStart, emails, reason, assignedBy, dryRun = false }) {
  const preview = await previewAssignments({ weekStart, emails });
  const created = [];
  const skipped = [];

  for (const item of preview.items) {
    if (!item.found) { skipped.push({ email: item.email, reason: "not_found" }); continue; }
    if (item.blockedReason) { skipped.push({ email: item.email, reason: item.blockedReason, userId: item.userId }); continue; }
    if (item.uplines.length === 0) { skipped.push({ email: item.email, reason: "no_direct_upline", userId: item.userId }); continue; }

    for (const up of item.uplines) {
      if (up.alreadyAssigned) {
        skipped.push({ email: item.email, uplineId: up.uplineId, reason: "already_assigned" });
        continue;
      }
      if (dryRun) {
        created.push({ email: item.email, uplineId: up.uplineId, uplineEmail: up.uplineEmail, simulated: true });
        continue;
      }
      const id = uuidv4();
      await execute(
        `INSERT OR IGNORE INTO weekly_direct_assignments
           (id, upline_id, direct_id, week_start, assigned_by, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, up.uplineId, item.userId, preview.weekStart, assignedBy || "admin", reason || null]
      );
      const row = await queryOne(
        "SELECT id FROM weekly_direct_assignments WHERE upline_id = ? AND direct_id = ? AND week_start = ?",
        [up.uplineId, item.userId, preview.weekStart]
      );
      created.push({ id: row ? row.id : id, email: item.email, userId: item.userId, uplineId: up.uplineId, uplineEmail: up.uplineEmail });
    }
  }

  return { weekStart: preview.weekStart, weekEnd: preview.weekEnd, dryRun, preview, created, skipped };
}

export async function listAssignments(weekStart) {
  const ws = normalizeWeekStart(weekStart);
  const rows = await query(
    `SELECT a.id, a.week_start, a.assigned_by, a.assigned_at, a.reason,
            a.upline_id, a.direct_id,
            up.full_name AS upline_name, up.email AS upline_email, up.rank AS upline_rank,
            d.full_name AS direct_name, d.email AS direct_email,
            d.account_type AS direct_account_type, d.status AS direct_status,
            d.created_at AS direct_created_at
       FROM weekly_direct_assignments a
       JOIN users up ON up.id = a.upline_id
       JOIN users d  ON d.id  = a.direct_id
      WHERE a.week_start = ?
      ORDER BY a.assigned_at ASC`,
    [ws]
  );
  return { weekStart: ws, weekEnd: weekEndFromStart(ws), assignments: rows };
}

export async function removeAssignment(id) {
  const row = await queryOne("SELECT * FROM weekly_direct_assignments WHERE id = ?", [id]);
  if (!row) return { removed: false, reason: "not_found" };
  await execute("DELETE FROM weekly_direct_assignments WHERE id = ?", [id]);
  return { removed: true, assignment: row };
}

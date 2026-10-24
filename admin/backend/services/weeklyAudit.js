import { v4 as uuidv4 } from "uuid";
import { query, queryOne, execute } from "../db.js";
import { weekEndFromStart } from "./weeklySettlement.js";

/**
 * Before/after snapshots for retroactive week changes.
 *
 * The CLI writes these to a JSON file; the admin API stores them in
 * `weekly_settlement_audits` so a rollback stays possible even when the server
 * filesystem is ephemeral (e.g. Railway / containers).
 *
 * Nothing here mutates financial data — it only reads and records.
 */

export async function snapshotWeek(weekStart) {
  const weekEnd = weekEndFromStart(weekStart);
  const users = await query("SELECT id, full_name, email, rank, rank_progress, e_money FROM users");
  const commissions = await query("SELECT * FROM weekly_commissions WHERE week_start = ?", [weekStart]);
  const history = await query("SELECT * FROM weekly_history WHERE week_start = ?", [weekStart]);
  const settlement = await queryOne("SELECT * FROM weekly_settlements WHERE week_start = ?", [weekStart]);
  const leaderboard = await query("SELECT * FROM leaderboard_history WHERE week_start = ?", [weekStart]);
  const wallet = await query(
    "SELECT * FROM wallet_transactions WHERE description LIKE ? OR description LIKE ?",
    [`%${weekStart}%`, `%${weekEnd}%`]
  );
  const userIds = new Set(users.map(u => u.id));
  const notifications = (await query("SELECT * FROM notifications")).filter(
    n => userIds.has(n.user_id) && String(n.created_at || "") >= new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  );
  const assignments = await query("SELECT * FROM weekly_direct_assignments WHERE week_start = ?", [weekStart]);
  return {
    capturedAt: new Date().toISOString(),
    users, commissions, history, settlement, leaderboard, wallet, notifications, assignments,
  };
}

export function diffById(before, after) {
  const b = new Set((before || []).map(r => r.id));
  return (after || []).filter(r => !b.has(r.id));
}

/** Persist the "before" snapshot BEFORE any mutation. Returns the audit id. */
export async function startAudit({ weekStart, source = "api", before }) {
  const id = uuidv4();
  await execute(
    "INSERT INTO weekly_settlement_audits (id, week_start, source, status, payload) VALUES (?, ?, ?, 'open', ?)",
    [id, weekStart, source, JSON.stringify({ weekStart, source, before })]
  );
  return id;
}

/** Complete an open audit with the "after" snapshot and a summary. */
export async function finishAudit(id, { after, summary }) {
  const row = await queryOne("SELECT payload FROM weekly_settlement_audits WHERE id = ?", [id]);
  if (!row) return null;
  let payload = {};
  try { payload = JSON.parse(row.payload || "{}"); } catch { payload = {}; }
  const merged = {
    ...payload,
    after,
    summary: summary || null,
    completedAt: new Date().toISOString(),
  };
  await execute(
    "UPDATE weekly_settlement_audits SET payload = ?, status = 'complete', completed_at = datetime('now','localtime') WHERE id = ?",
    [JSON.stringify(merged), id]
  );
  return merged;
}

export async function getAuditById(id) {
  const row = await queryOne("SELECT * FROM weekly_settlement_audits WHERE id = ?", [id]);
  if (!row) return null;
  let payload = {};
  try { payload = JSON.parse(row.payload || "{}"); } catch { payload = {}; }
  return { ...row, payload };
}

export async function listAudits(weekStart, limit = 20) {
  const rows = weekStart
    ? await query(
        "SELECT id, week_start, source, status, created_at, completed_at FROM weekly_settlement_audits WHERE week_start = ? ORDER BY created_at DESC LIMIT ?",
        [weekStart, limit]
      )
    : await query(
        "SELECT id, week_start, source, status, created_at, completed_at FROM weekly_settlement_audits ORDER BY created_at DESC LIMIT ?",
        [limit]
      );
  return rows;
}

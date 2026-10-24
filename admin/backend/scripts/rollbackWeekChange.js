#!/usr/bin/env node
/**
 * Roll back a week change produced by assignAccountsToWeek.js.
 *
 * Reads the JSON audit file written by that script and restores:
 *   • users.rank / rank_progress / e_money for every changed user
 *   • weekly_history rows for the week (restores the exact previous rows)
 *   • weekly_commissions / wallet_transactions / notifications created by the run
 *   • weekly_settlements row (status + summary + completed_at)
 *   • daily leaderboard snapshot for the week
 *   • deletes the weekly_direct_assignments rows created by the run
 *
 * USAGE
 *   node scripts/rollbackWeekChange.js --audit=audit/week-2025-10-17-....json --dry-run
 *   node scripts/rollbackWeekChange.js --audit=... --apply
 */
import fs from "fs";
import path from "path";
import { initDb, execute } from "../db.js";
import { getAuditById } from "../services/weeklyAudit.js";

function parseArgs(argv) {
  const out = { apply: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--apply") out.apply = true;
    else if (raw === "--dry-run") out.apply = false;
    else if (raw.startsWith("--audit=")) out.audit = raw.slice(8);
    else if (raw.startsWith("--audit-id=")) out.auditId = raw.slice(11);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.audit && !args.auditId) {
    console.error("Missing --audit=path/to/audit.json (or --audit-id=<id>)");
    process.exit(1);
  }

  await initDb();

  let audit;
  if (args.auditId) {
    // Durable snapshot stored by the admin API / CLI in weekly_settlement_audits.
    const row = await getAuditById(args.auditId);
    if (!row) { console.error("Audit id not found:", args.auditId); process.exit(1); }
    const payload = row.payload || {};
    audit = {
      weekStart: row.week_start,
      before: payload.before,
      after: payload.after,
      assignments: (payload.summary && payload.summary.assignments) || { created: [] },
      changedUsers: (payload.summary && payload.summary.changedUsers) || [],
    };
  } else {
    const auditPath = path.isAbsolute(args.audit) ? args.audit : path.resolve(process.cwd(), args.audit);
    if (!fs.existsSync(auditPath)) {
      console.error("Audit file not found:", auditPath);
      process.exit(1);
    }
    audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  }

  const { weekStart, before, after } = audit;
  if (!weekStart || !before || !after) {
    console.error("Audit snapshot is missing required fields (before/after)");
    process.exit(1);
  }

  const afterCommissionIds = new Set((after.commissions || []).map(r => r.id));
  const beforeCommissionIds = new Set((before.commissions || []).map(r => r.id));
  const commissionsToDelete = [...afterCommissionIds].filter(id => !beforeCommissionIds.has(id));

  const afterWalletIds = new Set((after.wallet || []).map(r => r.id));
  const walletToDelete = [...afterWalletIds].filter(id => !new Set((before.wallet || []).map(r => r.id)).has(id));

  const beforeNotifIds = new Set((before.notifications || []).map(r => r.id));
  const notifsToDelete = (after.notifications || []).filter(n => !beforeNotifIds.has(n.id)).map(n => n.id);

  const assignmentIds = (audit.assignments && audit.assignments.created || []).map(c => c.id).filter(Boolean);

  const plan = {
    weekStart,
    commissionsToDelete: commissionsToDelete.length,
    walletToDelete: walletToDelete.length,
    notificationsToDelete: notifsToDelete.length,
    assignmentsToDelete: assignmentIds.length,
    usersToRestore: (audit.changedUsers || []).length,
    historyRowsToRestore: (before.history || []).length,
    leaderboardRowsToRestore: (before.leaderboard || []).length,
  };

  if (!args.apply) {
    console.log(JSON.stringify({ mode: "dry-run", plan }, null, 2));
    return;
  }

  // 1. Remove financial rows created by the run (never touch pre-existing ones).
  for (const id of commissionsToDelete) await execute("DELETE FROM weekly_commissions WHERE id = ?", [id]);
  for (const id of walletToDelete) await execute("DELETE FROM wallet_transactions WHERE id = ?", [id]);
  for (const id of notifsToDelete) await execute("DELETE FROM notifications WHERE id = ?", [id]);

  // 2. Remove retroactive assignments created by the run.
  for (const id of assignmentIds) await execute("DELETE FROM weekly_direct_assignments WHERE id = ?", [id]);

  // 3. Restore user balances / ranks exactly as captured before the run.
  for (const u of before.users || []) {
    const snapshot = (audit.before.users || []).find(x => x.id === u.id);
    if (!snapshot) continue;
    await execute(
      "UPDATE users SET rank = ?, rank_progress = ?, e_money = ? WHERE id = ?",
      [snapshot.rank, snapshot.rank_progress, snapshot.e_money, u.id]
    );
  }

  // 4. Restore weekly_history for the week verbatim.
  await execute("DELETE FROM weekly_history WHERE week_start = ?", [weekStart]);
  for (const row of before.history || []) {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    await execute(
      `INSERT INTO weekly_history (${cols.join(",")}) VALUES (${placeholders})`,
      cols.map(c => row[c])
    );
  }

  // 5. Restore leaderboard snapshot for the week.
  await execute("DELETE FROM leaderboard_history WHERE week_start = ?", [weekStart]);
  for (const row of before.leaderboard || []) {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => "?").join(",");
    await execute(
      `INSERT INTO leaderboard_history (${cols.join(",")}) VALUES (${placeholders})`,
      cols.map(c => row[c])
    );
  }

  // 6. Restore the settlement row.
  if (before.settlement) {
    await execute(
      "UPDATE weekly_settlements SET status = ?, triggered_by = ?, summary = ?, completed_at = ? WHERE id = ?",
      [before.settlement.status, before.settlement.triggered_by, before.settlement.summary, before.settlement.completed_at, before.settlement.id]
    );
  }

  console.log(JSON.stringify({ mode: "apply", restored: plan }, null, 2));
}

main().then(() => process.exit(0)).catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});

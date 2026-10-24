#!/usr/bin/env node
/**
 * Assign existing accounts to a past settlement week and optionally recompute it.
 *
 * SAFETY MODEL
 *   • dry-run is the default — nothing is written unless --apply is passed
 *   • created_at is NEVER modified
 *   • a JSON audit snapshot (before/after) is written for full rollback
 *   • weekly_commissions already paid for that week are never duplicated
 *
 * USAGE
 *   node scripts/assignAccountsToWeek.js --week=2026-10-16 --emails=a@x.com,b@x.com
 *   node scripts/assignAccountsToWeek.js --week=2026-10-16 --emails=... --apply
 *   node scripts/assignAccountsToWeek.js --week=2026-10-16 --emails=... --apply --resettle
 *
 * FLAGS
 *   --week=YYYY-MM-DD   settlement week start (required)
 *   --emails=a,b,c      comma separated emails (defaults to the configured batch)
 *   --reason=text       free text stored on the assignment
 *   --apply             actually write (otherwise dry-run)
 *   --resettle          recompute the week after writing assignments
 *   --json              print machine readable output only
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "../db.js";
import { previewAssignments, assignEmailsToWeek } from "../services/weeklyAssignments.js";
import { runWeeklySettlement, weekEndFromStart } from "../services/weeklySettlement.js";
import { snapshotWeek, diffById, startAudit, finishAudit } from "../services/weeklyAudit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, "..");
const AUDIT_DIR = path.join(BACKEND_DIR, "audit");

const DEFAULT_EMAILS = [
  "youussef876@gmail.com",
  "salahibrahimccdd@gmail.com",
  "lalamohamed653@gmail.com",
  "nireem624@gmail.com",
  "mahmoudhg688@gmail.com",
  "asmaa168@gmail.com",
  "monaelfekey766@gmail.com",
];

function parseArgs(argv) {
  const out = { apply: false, resettle: false, json: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--apply") out.apply = true;
    else if (raw === "--resettle") out.resettle = true;
    else if (raw === "--json") out.json = true;
    else if (raw.startsWith("--week=")) out.week = raw.slice(7).trim();
    else if (raw.startsWith("--emails=")) out.emails = raw.slice(9).split(",").map(s => s.trim()).filter(Boolean);
    else if (raw.startsWith("--reason=")) out.reason = raw.slice(9);
  }
  return out;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function backupLocalDb() {
  const dbPath = path.join(BACKEND_DIR, "everest.db");
  try {
    if (!fs.existsSync(dbPath)) return null;
    const target = path.join(BACKEND_DIR, "backups", `everest-premigration-${stamp()}.db`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(dbPath, target);
    return target;
  } catch (e) {
    return null;
  }
}

function printPreview(preview) {
  const out = [];
  out.push("");
  out.push(`WEEK ${preview.weekStart} → ${preview.weekEnd}   (min direct sales = ${preview.minDirectSales})`);
  out.push(`SETTLEMENT: ${preview.settlement ? `${preview.settlement.status} @ ${preview.settlement.created_at}` : "not settled yet"}`);
  out.push("");
  for (const item of preview.items) {
    out.push("─".repeat(78));
    out.push(`${item.email}`);
    if (!item.found) { out.push("  ✗ NOT FOUND in database"); continue; }
    out.push(`  user      : ${item.fullName} (${item.userId})`);
    out.push(`  type/stats: ${item.accountType} / ${item.status} / rank=${item.rank || "—"}`);
    out.push(`  created_at: ${item.createdAt}  → inside week? ${item.countsByWindow ? "YES" : "NO"}`);
    if ((item.assignedToOtherWeeks || []).length) out.push(`  ⚠ assigned to another week: ${item.assignedToOtherWeeks.join(", ")}`);
    if (item.blockedReason) out.push(`  ✗ BLOCKED: ${item.blockedReason}`);
    if (item.uplines.length === 0) out.push("  ✗ no direct upline found in user_closure");
    for (const up of item.uplines) {
      out.push(`  upline    : ${up.uplineEmail} (${up.uplineName}) rank=${up.uplineRank || "—"}`);
      out.push(`    gate     : ${up.weeklyGateBefore} → ${up.weeklyGateAfter} (required ${up.minRequired})` +
        `  eligible: ${up.eligibleBefore ? "yes" : "no"} → ${up.eligibleAfter ? "YES" : "no"}`);
      out.push(`    team     : ${up.qualifiedTeam} qualified students`);
      out.push(`    rank     : ${up.uplineRank || "—"} → ${up.projectedRank || "—"}`);
      out.push(`    commission: ${up.projectedCommission} EM` +
        (up.alreadyPaidThisWeek ? `  (ALREADY PAID: ${up.alreadyPaidThisWeek.amount} EM as ${up.alreadyPaidThisWeek.rank})` : ""));
      out.push(`    already assigned for this week: ${up.alreadyAssigned ? "yes" : "no"}`);
    }
  }
  out.push("─".repeat(78));
  return out.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.week) {
    console.error("Missing --week=YYYY-MM-DD");
    process.exit(1);
  }
  const emails = (args.emails && args.emails.length ? args.emails : DEFAULT_EMAILS).map(e => e.toLowerCase());
  const weekStart = args.week;

  await initDb();

  const preview = await previewAssignments({ weekStart, emails });
  if (!args.json) console.log(printPreview(preview));

  const assignable = preview.items.filter(i => i.found && !i.blockedReason && i.uplines.length > 0);

  if (!args.apply) {
    const payload = {
      mode: "dry-run",
      weekStart,
      weekEnd: weekEndFromStart(weekStart),
      minDirectSales: preview.minDirectSales,
      settlement: preview.settlement,
      summary: preview.items.map(i => ({
        email: i.email,
        found: !!i.found,
        userId: i.userId || null,
        blockedReason: i.blockedReason || null,
        createdInsideWeek: i.createdInsideWeek,
        uplines: (i.uplines || []).map(u => ({
          uplineEmail: u.uplineEmail,
          gate: [u.weeklyGateBefore, u.weeklyGateAfter],
          minRequired: u.minRequired,
          eligibleBefore: u.eligibleBefore,
          eligibleAfter: u.eligibleAfter,
          projectedRank: u.projectedRank,
          projectedCommission: u.projectedCommission,
          alreadyAssigned: u.alreadyAssigned,
          alreadyPaidThisWeek: u.alreadyPaidThisWeek,
        })),
      })),
    };
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log("");
      console.log(`DRY RUN — no data was modified. Add --apply to write (${assignable.length} account(s) ready).`);
    }
    return;
  }

  // ── APPLY ──
  const dbBackup = await backupLocalDb();
  const before = await snapshotWeek(weekStart);
  // Durable audit row written BEFORE any mutation (works even on ephemeral filesystems).
  const auditId = await startAudit({ weekStart, source: "cli", before });

  const assignmentResult = await assignEmailsToWeek({
    weekStart,
    emails,
    reason: args.reason || "retroactive inclusion in settlement week",
    assignedBy: "cli:assignAccountsToWeek",
    dryRun: false,
  });

  let settlementResult = null;
  if (args.resettle) {
    // Targeted recompute: only the uplines of the accounts in this batch are re-evaluated.
    // Unrelated members keep their rank, history and balances exactly as they are.
    const scope = [...new Set(
      (assignmentResult.preview.items || [])
        .filter(i => i.found && !i.blockedReason && (i.uplines || []).length > 0)
        .flatMap(i => i.uplines.map(u => u.uplineId))
    )];
    if (scope.length === 0) {
      throw new Error("No affected uplines found — refusing to recompute an unscoped week");
    }
    settlementResult = await runWeeklySettlement({
      triggeredBy: "manual",
      weekStart,
      force: true,
      recompute: true,
      onlyUserIds: scope,
    });
  }

  const after = await snapshotWeek(weekStart);

  const insertedCommissions = diffById(before.commissions, after.commissions);
  const changedUsers = [];
  for (const u of after.users) {
    const b = before.users.find(x => x.id === u.id);
    if (!b) continue;
    if (Number(b.e_money) !== Number(u.e_money) || b.rank !== u.rank || Number(b.rank_progress) !== Number(u.rank_progress)) {
      changedUsers.push({ id: u.id, email: u.email, before: { rank: b.rank, rank_progress: b.rank_progress, e_money: b.e_money }, after: { rank: u.rank, rank_progress: u.rank_progress, e_money: u.e_money } });
    }
  }

  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const auditPath = path.join(AUDIT_DIR, `week-${weekStart}-${stamp()}.json`);
  const auditSummary = {
    weekStart,
    weekEnd: weekEndFromStart(weekStart),
    appliedAt: new Date().toISOString(),
    emails,
    dbBackup,
    reason: args.reason || null,
    assignments: assignmentResult,
    settlement: settlementResult
      ? { success: settlementResult.success, awarded: settlementResult.awarded, totalCommissions: settlementResult.totalCommissions, error: settlementResult.error || null }
      : null,
    insertedCommissions,
    changedUsers,
  };
  fs.writeFileSync(auditPath, JSON.stringify({ ...auditSummary, auditId, before, after }, null, 2), "utf8");
  await finishAudit(auditId, {
    after,
    summary: {
      ...auditSummary,
      assignments: {
        created: assignmentResult.created.map(c => ({ id: c.id, email: c.email, uplineId: c.uplineId, uplineEmail: c.uplineEmail })),
        skipped: assignmentResult.skipped,
      },
      auditPath,
    },
  });

  const report = {
    mode: "apply",
    weekStart,
    weekEnd: weekEndFromStart(weekStart),
    dbBackup,
    auditId,
    auditPath,
    assignments: {
      created: assignmentResult.created,
      skipped: assignmentResult.skipped,
    },
    settlement: settlementResult
      ? {
          success: settlementResult.success,
          error: settlementResult.error || null,
          awarded: settlementResult.awarded || 0,
          totalCommissions: settlementResult.totalCommissions || 0,
          newlyPaidUsers: (settlementResult.results || []).filter(r => r.commissionStatus === "paid").length,
        }
      : null,
    insertedCommissions,
    changedUsers,
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("");
    console.log("APPLIED");
    console.log(`  week          : ${report.weekStart} → ${report.weekEnd}`);
    console.log(`  db backup     : ${dbBackup || "(Turso — no local file)"}`);
    console.log(`  audit id      : ${auditId}`);
    console.log(`  audit file    : ${auditPath}`);
    console.log(`  assignments   : ${report.assignments.created.length} created, ${report.assignments.skipped.length} skipped`);
    for (const c of report.assignments.created) console.log(`     + ${c.email} → ${c.uplineEmail}`);
    for (const s of report.assignments.skipped) console.log(`     · ${s.email}: ${s.reason}`);
    if (report.settlement) {
      console.log(`  settlement    : ${report.settlement.success ? "completed" : "FAILED"} ${report.settlement.error || ""}`);
      console.log(`  paid now      : ${report.settlement.awarded} users / ${report.settlement.totalCommissions} EM`);
    }
    if (report.insertedCommissions.length) {
      console.log(`  commissions   : ${report.insertedCommissions.length} new row(s)`);
      for (const c of report.insertedCommissions) console.log(`     + ${c.user_id} ${c.rank_name} ${c.amount} EM`);
    } else {
      console.log("  commissions   : no new commission rows (nothing eligible / already paid)");
    }
    if (report.changedUsers.length) {
      console.log(`  users changed : ${report.changedUsers.length}`);
      for (const u of report.changedUsers) {
        console.log(`     ~ ${u.email}: rank ${u.before.rank || "—"} → ${u.after.rank || "—"}, balance ${u.before.e_money} → ${u.after.e_money}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});

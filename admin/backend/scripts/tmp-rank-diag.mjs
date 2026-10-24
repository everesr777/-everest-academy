import { initDb, query } from "../db.js";

await initDb();

const closureStats = await query("SELECT depth, COUNT(*) c FROM user_closure GROUP BY depth ORDER BY depth");
const closureTotal = await query("SELECT COUNT(*) c FROM user_closure");

const dup = await query(`
  SELECT user_id, week_start, COUNT(*) c, GROUP_CONCAT(previous_rank || '→' || current_rank) seq
    FROM weekly_history GROUP BY user_id, week_start HAVING c > 1 ORDER BY c DESC LIMIT 20`);

const promos = await query(`
  SELECT wh.week_start, wh.user_id, u.full_name, u.email, u.account_type,
         wh.previous_rank, wh.current_rank, wh.qualified_team_count, wh.qualified_direct_sales, wh.total_direct_sales
    FROM weekly_history wh JOIN users u ON u.id = wh.user_id
   WHERE wh.current_rank <> wh.previous_rank AND COALESCE(wh.current_rank,'') <> ''
   ORDER BY wh.week_start`);

// how many directs does each promoted user actually have (closure vs referred_by)
const perUser = [];
for (const p of promos) {
  const c1 = await query("SELECT COUNT(*) c FROM user_closure WHERE ancestor=? AND depth=1", [p.user_id]);
  const ref = await query(
    "SELECT COUNT(*) c FROM users WHERE (referred_by=? OR created_by_user=?) AND account_type='student'",
    [p.user_id, p.user_id]
  );
  perUser.push({
    week: p.week_start, name: p.full_name, type: p.account_type,
    hist_directs: p.qualified_direct_sales, hist_team: p.qualified_team_count,
    closure_depth1: c1[0].c, referred_students: ref[0].c,
  });
}

const notifSample = await query(`
  SELECT n.user_id, u.full_name, n.title, n.created_at FROM notifications n JOIN users u ON u.id=n.user_id
   WHERE n.title LIKE '%Rank Up%' ORDER BY n.created_at DESC LIMIT 8`);

const notifTitles = await query(`
  SELECT title, COUNT(*) c FROM notifications WHERE title LIKE '%Rank Up%' GROUP BY title ORDER BY c DESC`);

const topClosure = await query("SELECT ancestor, COUNT(*) c FROM user_closure WHERE depth=1 GROUP BY ancestor ORDER BY c DESC LIMIT 8");

console.log(JSON.stringify({
  closureTotal: closureTotal[0].c, closureStats, topClosure,
  duplicateHistoryRows: dup,
  perUser,
  notifSample, notifTitles,
}, null, 2));
process.exit(0);

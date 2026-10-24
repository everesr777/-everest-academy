import { initDb, query } from "../db.js";

await initDb();

const stats = await query(`
  SELECT 'users_with_rank' AS k, COUNT(*) AS c FROM users WHERE COALESCE(rank,'') <> '' AND role IN ('student','registration')
  UNION ALL SELECT 'weekly_history_rows', COUNT(*) FROM weekly_history
  UNION ALL SELECT 'promotions', COUNT(*) FROM weekly_history WHERE current_rank <> previous_rank AND COALESCE(current_rank,'') <> ''
  UNION ALL SELECT 'rankup_notifications', COUNT(*) FROM notifications WHERE title LIKE '%Rank Up%'
  UNION ALL SELECT 'weekly_commissions', COUNT(*) FROM weekly_commissions
  UNION ALL SELECT 'rank_bonuses', COUNT(*) FROM rank_bonuses
  UNION ALL SELECT 'settlements', COUNT(*) FROM weekly_settlements
`);
const ranks = await query(`
  SELECT COALESCE(NULLIF(rank,''),'(بدون رتبة)') AS rank, COUNT(*) AS c
  FROM users WHERE role IN ('student','registration') GROUP BY rank ORDER BY c DESC`);
const weeks = await query(`
  SELECT week_start, week_end, status, triggered_by, completed_at FROM weekly_settlements ORDER BY week_start DESC LIMIT 15`);

console.log(JSON.stringify({ stats, ranks, weeks }, null, 2));
process.exit(0);

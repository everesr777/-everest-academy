import { initDb, query } from "../db.js";

await initDb();

const a = await query("SELECT id, full_name, email, rank, account_type FROM users WHERE email = ?", ["ahmdgndy17@gmail.com"]);
const id = a[0] && a[0].id;
const desc = await query("SELECT depth, COUNT(*) c FROM user_closure WHERE ancestor = ? GROUP BY depth", [id]);
const descAll = await query("SELECT COUNT(*) c FROM user_closure WHERE ancestor = ?", [id]);
const kids = await query(
  "SELECT id, full_name, referral_code, account_type, status, created_at FROM user_closure c JOIN users u ON u.id=c.descendant WHERE c.ancestor=? AND c.depth=1",
  [id]
);
const refKids = await query(
  "SELECT id, full_name, referral_code, account_type, status, created_at FROM users WHERE referred_by=? OR created_by_user=?",
  [id, id]
);

const rankedNoPromo = await query(`
  SELECT u.id, u.full_name, u.email, u.referral_code, u.rank, u.account_type, u.created_at
    FROM users u
   WHERE u.rank IS NOT NULL AND u.rank <> '' AND u.role IN ('student','registration')
     AND NOT EXISTS (SELECT 1 FROM weekly_history wh WHERE wh.user_id = u.id AND wh.current_rank = u.rank)
   ORDER BY u.rank`);

console.log(JSON.stringify({
  user: a[0],
  descendantsByDepth: desc,
  descendantsTotal: descAll[0].c,
  closureDepth1: kids,
  referredOrCreated: refKids,
  rankedWithoutMatchingHistory: rankedNoPromo,
}, null, 2));
process.exit(0);

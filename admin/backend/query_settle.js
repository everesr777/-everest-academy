import { db } from "./db.js";
db.all("SELECT id, week_start, week_end, status, triggered_by, total_users_processed, total_commissions_paid, created_at, completed_at FROM weekly_settlements ORDER BY created_at DESC LIMIT 10", (e,r)=>{
  console.log(JSON.stringify(r,null,2));
  process.exit(0);
});

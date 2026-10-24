const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('admin/backend/database.sqlite');
db.all("SELECT id, week_start, week_end, status, triggered_by, total_users_processed, total_commissions_paid, created_at, completed_at, error_message FROM weekly_settlements ORDER BY created_at DESC LIMIT 10", (e,r)=>{
  console.log(JSON.stringify({err: e && e.message, rows: r}, null, 2));
  db.close();
});

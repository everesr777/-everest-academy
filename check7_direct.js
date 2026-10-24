const Database = require('better-sqlite3');
const db = new Database('admin/backend/everest.db');
const emails = ['youussef876@gmail.com','salahibrahimccdd@gmail.com','lalamohamed653@gmail.com','nireem624@gmail.com','mahmoudhg688@gmail.com','asmaa168@gmail.com','monaelfekey766@gmail.com'];
const rows = db.prepare("SELECT id,email,full_name,created_at,rank,account_type,status,referred_by,created_by_user,direct_count,e_money FROM users WHERE LOWER(email) IN (" + emails.map(()=>'?').join(',') + ")").all(emails.map(e=>e.toLowerCase()));
console.log(rows.length);
for (const r of rows) {
  console.log(r.email + ' | ' + r.created_at + ' | ' + r.rank + ' | ' + r.account_type + ' | ' + r.status + ' | ref:' + (r.referred_by||'') + ' | cb:' + (r.created_by_user||''));
}
db.close();

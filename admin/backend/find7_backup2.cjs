const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'backups','everest-2026-10-24T05-02-53-534Z.db')));
  const emails = ['youussef876@gmail.com','salahibrahimccdd@gmail.com','lalamohamed653@gmail.com','nireem624@gmail.com','mahmoudhg688@gmail.com','asmaa168@gmail.com','monaelfekey766@gmail.com'];
  const stmt = db.prepare("SELECT id,email,full_name,created_at,rank,account_type,status,referred_by,created_by_user FROM users WHERE LOWER(email) IN ("+emails.map(()=>'?').join(',')+")");
  stmt.bind(emails.map(e=>e.toLowerCase()));
  const rows=[];
  while(stmt.step()){ rows.push(stmt.getAsObject()); }
  stmt.free();
  console.log(rows.length);
  for (const r of rows) { 
    console.log(r.email+'|'+r.created_at+'|'+r.rank+'|'+r.account_type+'|'+r.status+'|ref:'+r.referred_by+'|cb:'+r.created_by_user);
  }
  db.close();
})();

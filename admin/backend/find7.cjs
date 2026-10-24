const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'everest.db')));
  const targets = ['youussef','salahibrahim','lalamohamed','nireem','mahmoudhg','asmaa168','monaelfekey'];
  const stmt = db.prepare("SELECT id,email,full_name,created_at,rank,account_type,status FROM users");
  const rows=[];
  while(stmt.step()){ rows.push(stmt.getAsObject()); }
  stmt.free();
  for (const r of rows) {
    const e = (r.email||'').toLowerCase();
    if (targets.some(t=>e.includes(t))) {
      console.log(r.email+'|'+r.created_at+'|'+r.rank+'|'+r.account_type+'|'+r.status);
    }
  }
  db.close();
})();

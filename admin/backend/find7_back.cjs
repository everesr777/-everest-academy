const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const files = fs.readdirSync(path.join(__dirname,'backups'));
  for (const f of files) {
    try {
      const SQL = await initSqlJs();
      const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'backups',f)));
      const stmt = db.prepare('SELECT email, created_at FROM users');
      const rows=[];
      while(stmt.step()){ rows.push(stmt.getAsObject()); }
      stmt.free();
      for (const r of rows) {
        const e = (r.email||'').toLowerCase();
        if (e === 'youussef876@gmail.com' || e === 'salahibrahimccdd@gmail.com' || e === 'lalamohamed653@gmail.com' || e === 'nireem624@gmail.com' || e === 'mahmoudhg688@gmail.com' || e === 'asmaa168@gmail.com' || e === 'monaelfekey766@gmail.com') {
          console.log(f+':'+r.email+':'+r.created_at);
        }
      }
      db.close();
    } catch(e) {}
  }
})();

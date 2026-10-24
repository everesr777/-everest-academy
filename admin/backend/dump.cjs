const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'everest.db')));
  const stmt = db.prepare('SELECT id,email,full_name,created_at,rank,account_type,status FROM users ORDER BY created_at ASC');
  const rows=[];
  while(stmt.step()){ rows.push(stmt.getAsObject()); }
  stmt.free();
  console.log('===COUNT:'+rows.length+'===');
  for (const r of rows) { console.log(r.email+'|'+r.full_name+'|'+r.created_at); }
  db.close();
})();

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'everest.db')));
  const emails = ['youussef876@gmail.com','salahibrahimccdd@gmail.com','lalamohamed653@gmail.com','nireem624@gmail.com','mahmoudhg688@gmail.com','asmaa168@gmail.com','monaelfekey766@gmail.com'];
  const stmt = db.prepare("SELECT * FROM users WHERE LOWER(email) IN ("+emails.map(()=>'?').join(',')+")");
  stmt.bind(emails.map(e=>e.toLowerCase()));
  const rows=[];
  while(stmt.step()){ rows.push(stmt.getAsObject()); }
  stmt.free();
  console.log('COUNT:'+rows.length);
  for (const r of rows) { 
    console.log('EMAIL:'+r.email+'|ID:'+r.id+'|NAME:'+r.full_name+'|CREATED:'+r.created_at+'|RANK:'+r.rank+'|TYPE:'+r.account_type+'|ROLE:'+r.role+'|STATUS:'+r.status+'|REF:'+r.referred_by+'|CB:'+r.created_by_user);
  }
  db.close();
})();

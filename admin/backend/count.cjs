const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async()=>{
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'everest.db')));
  const stmt = db.prepare("SELECT COUNT(*) as c FROM users");
  stmt.step();
  console.log(stmt.getAsObject());
  stmt.free();
  db.close();
})();

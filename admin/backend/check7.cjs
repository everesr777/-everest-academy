const {query, initDb} = require('./db.js');
(async()=>{
  await initDb();
  const emails = ['youussef876@gmail.com','salahibrahimccdd@gmail.com','lalamohamed653@gmail.com','nireem624@gmail.com','mahmoudhg688@gmail.com','asmaa168@gmail.com','monaelfekey766@gmail.com'];
  const ph = emails.map(()=>'?').join(',');
  const users = await query(`SELECT id, full_name, email, referral_code, referred_by, created_by_user, rank, account_type, role, status, created_at, e_money FROM users WHERE LOWER(email) IN (${ph})`, emails.map(e=>e.toLowerCase()));
  console.log(JSON.stringify(users,null,2));
  process.exit(0);
})();

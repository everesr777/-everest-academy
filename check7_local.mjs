import {initDb, query} from './admin/backend/db.js';
await initDb();
const emails = ['youussef876@gmail.com','salahibrahimccdd@gmail.com','lalamohamed653@gmail.com','nireem624@gmail.com','mahmoudhg688@gmail.com','asmaa168@gmail.com','monaelfekey766@gmail.com'];
const ph = emails.map(()=>'?').join(',');
const users = await query(`SELECT id,email,full_name,created_at,rank,account_type,status,referred_by,created_by_user FROM users WHERE LOWER(email) IN (${ph})`, emails.map(e=>e.toLowerCase()));
console.log(JSON.stringify(users));
process.exit(0);

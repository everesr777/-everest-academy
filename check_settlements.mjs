import {initDb, query} from './admin/backend/db.js';
await initDb();
const res = await query('SELECT * FROM weekly_settlements ORDER BY created_at DESC LIMIT 5');
console.log(JSON.stringify(res));
process.exit(0);

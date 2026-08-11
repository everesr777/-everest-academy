import { createClient } from "@libsql/client";
import initSqlJs from "sql.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import {
  getSeedUsers, getSeedCourses, getSeedTopics, getSeedLessons,
  getSeedQuizzes, getSeedEnrollments, getSeedQuizAttempts,
  getSeedCommissions, getSeedFeedbacks, getSeedNotifications,
  getSeedWeeklyHistory, getSeedLeaders, getSeedCourseReviews, getSeedSettings
} from "./seedMockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, "everest.db");

let db = null;
let turso = null;
let isTurso = !!(process.env.TURSO_URL && process.env.TURSO_TOKEN);

export async function initDb() {
  if (isTurso) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        turso = createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_TOKEN });
        await createSchema(turso, true);
        console.log("✅ Connected to Turso database");
        return turso;
      } catch (e) {
        console.error(`❌ Turso connection attempt ${attempt}/${maxAttempts} failed:`, e.message);
        if (attempt < maxAttempts) {
          const delayMs = attempt * 3000;
          console.log(`   Retrying in ${delayMs / 1000}s...`);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    console.error("❌ TURSO IS CONFIGURED BUT UNAVAILABLE. Aborting startup instead of serving an empty local DB. Your accounts are NOT deleted - they are safe in Turso. Fix TURSO_URL/TURSO_TOKEN or check Turso status, then redeploy.");
    throw new Error("Turso database unavailable after retries");
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  createSchema(db, false);
  saveDb();
  startAutoSave();
  return db;
}

function createSchema(driver, isTursoDb) {
  const exec = isTursoDb
    ? async (sql) => { const r = await driver.execute(sql); return r.rows; }
    : (sql) => driver.exec(sql);

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      phone TEXT, address TEXT, password TEXT NOT NULL, role TEXT DEFAULT 'registration',
      avatar TEXT, bio TEXT, referral_code TEXT UNIQUE, referred_by TEXT,
      rank TEXT DEFAULT '', e_money REAL DEFAULT 0, academic_points REAL DEFAULT 0,
      total_team_sales REAL DEFAULT 0, direct_count INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
      membership_expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      title_ar TEXT, description_ar TEXT, category_ar TEXT,
      difficulty TEXT DEFAULT 'beginner', is_public INTEGER DEFAULT 1,
      price REAL DEFAULT 0, is_free INTEGER DEFAULT 1, category TEXT,
      tags TEXT, featured_image TEXT, intro_video TEXT, status TEXT DEFAULT 'draft',
      author_id TEXT, created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, title TEXT NOT NULL,
      summary TEXT, title_ar TEXT, summary_ar TEXT, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT, title_ar TEXT, content_ar TEXT, video_url TEXT,
      duration INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, is_free INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY, topic_id TEXT, lesson_id TEXT, course_id TEXT,
      type TEXT DEFAULT 'topic', quiz_type TEXT DEFAULT 'mixed',
      title TEXT NOT NULL,
      questions TEXT, total_marks INTEGER DEFAULT 0, pass_mark INTEGER DEFAULT 50,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, user_id TEXT NOT NULL,
      total_marks INTEGER DEFAULT 0, earned_marks REAL DEFAULT 0,
      correct_answers INTEGER DEFAULT 0, incorrect_answers INTEGER DEFAULT 0,
      result TEXT DEFAULT 'fail',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quiz_leaderboard (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      avatar TEXT,
      course_id TEXT,
      course_title TEXT,
      total_attempts INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      best_score REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
      progress REAL DEFAULT 0, status TEXT DEFAULT 'approved',
      payment_method TEXT DEFAULT 'emoney', payment_proof TEXT, expires_at TEXT,
      enrolled_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
      type TEXT NOT NULL, description TEXT, payment_method TEXT,
      payment_proof TEXT, status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL,
      level INTEGER NOT NULL, amount REAL DEFAULT 1000,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS ranks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, sales_required INTEGER DEFAULT 0,
      bonus REAL DEFAULT 0, sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS rank_bonuses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, rank_name TEXT NOT NULL,
      amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, message TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS top_up_requests (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
      payment_method TEXT, payment_proof TEXT, phone_number TEXT,
      admin_id TEXT, reviewed_at TEXT, status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS upgrade_requests (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, status TEXT DEFAULT 'pending',
      admin_id TEXT, reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS leaders (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, rank TEXT NOT NULL,
      avatar TEXT, icon TEXT DEFAULT '🏆', sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS excluded_leaders (
      user_id TEXT PRIMARY KEY,
      excluded_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      message TEXT, type TEXT DEFAULT 'info', is_read INTEGER DEFAULT 0,
      related_id TEXT, created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS payment_gateways (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, value TEXT NOT NULL,
      label TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS proofs (
      id TEXT PRIMARY KEY, image TEXT NOT NULL, caption TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, admin_name TEXT NOT NULL,
      action TEXT NOT NULL, target_user_id TEXT, target_user_name TEXT,
      details TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    // --- MLM Tables ---
    `CREATE TABLE IF NOT EXISTS user_closure (
      ancestor TEXT NOT NULL,
      descendant TEXT NOT NULL,
      depth INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ancestor, descendant),
      FOREIGN KEY (ancestor) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (descendant) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending','completed','failed','cancelled')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_commissions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, rank_name TEXT NOT NULL,
      amount REAL NOT NULL, week_start TEXT NOT NULL, week_end TEXT NOT NULL,
      calculated_at TEXT DEFAULT (datetime('now','localtime')),
      status TEXT DEFAULT 'paid' CHECK(status IN ('paid','pending','cancelled')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS commission_exclusions (
      id TEXT PRIMARY KEY, commission_id TEXT NOT NULL, excluded_user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (commission_id) REFERENCES weekly_commissions(id) ON DELETE CASCADE,
      FOREIGN KEY (excluded_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS course_reviews (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, user_id TEXT NOT NULL,
      rating INTEGER DEFAULT 5, comment TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(course_id, user_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_token TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK(device_type IN ('desktop','mobile')),
      device_info TEXT DEFAULT '',
      last_heartbeat TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, otp TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      calculation_date TEXT DEFAULT (datetime('now','localtime')),
      previous_rank TEXT,
      current_rank TEXT,
      total_direct_sales INTEGER DEFAULT 0,
      student_direct_sales INTEGER DEFAULT 0,
      registration_direct_sales INTEGER DEFAULT 0,
      qualified_direct_sales INTEGER DEFAULT 0,
      qualified_team_count INTEGER DEFAULT 0,
      qualified_network_count INTEGER DEFAULT 0,
      student_members INTEGER DEFAULT 0,
      registration_members INTEGER DEFAULT 0,
      higher_rank_excluded INTEGER DEFAULT 0,
      inactive_excluded INTEGER DEFAULT 0,
      weekly_commission REAL DEFAULT 0,
      commission_status TEXT DEFAULT 'not_eligible',
      promotion_status TEXT DEFAULT 'no_change',
      failure_reason TEXT,
      details TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_settlements (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL UNIQUE,
      week_end TEXT NOT NULL,
      status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
      triggered_by TEXT DEFAULT 'auto',
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      completed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_sales (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      sales INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id, week_start),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS leaderboard_history (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      rank_position INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar TEXT,
      rank TEXT,
      weekly_sales INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(week_start, rank_position)
    )`
  ];

  if (isTursoDb) {
    return (async () => {
      await Promise.all(tables.map(sql => driver.execute(sql)));
      // Add new columns to existing users table (safe to run even if exists)
      try { await driver.execute("ALTER TABLE users ADD COLUMN negative_allowed INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN qualified_direct_count INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN membership_days INTEGER DEFAULT 365"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN membership_progress REAL DEFAULT 65"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN session_token TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN total_sales INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN rank_progress INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN commission_per_sale REAL DEFAULT 1000"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN membership_expires_at TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE ranks ADD COLUMN sales_required INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE ranks ADD COLUMN bonus REAL DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE quizzes ADD COLUMN lesson_id TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE quizzes ADD COLUMN course_id TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE quizzes ADD COLUMN type TEXT DEFAULT 'topic'"); } catch(e) {}
      try { await driver.execute("ALTER TABLE quizzes ADD COLUMN pass_mark INTEGER DEFAULT 50"); } catch(e) {}
      try { await driver.execute("ALTER TABLE quizzes ADD COLUMN quiz_type TEXT DEFAULT 'mixed'"); } catch(e) {}
      try { await driver.execute("ALTER TABLE courses ADD COLUMN price_egp REAL DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE ranks ADD COLUMN image TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE ranks ADD COLUMN weekly_bonus REAL DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE ranks ADD COLUMN min_direct INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'student'"); } catch(e) {}
  try { await driver.execute("ALTER TABLE courses ADD COLUMN is_show_free INTEGER DEFAULT 0"); } catch(e) {}
  try { await driver.execute("ALTER TABLE courses ADD COLUMN is_show_homepage INTEGER DEFAULT 1"); } catch(e) {}
  try { await driver.execute("ALTER TABLE courses ADD COLUMN is_show_courses INTEGER DEFAULT 1"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN id_card_front TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN id_card_back TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN governorate TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN country TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN created_by_user TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN email_otp TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN email_otp_expires TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE users ADD COLUMN verification_expires TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE user_sessions ADD COLUMN last_heartbeat TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE commissions ADD COLUMN description TEXT"); } catch(e) {}
      try { await driver.execute("ALTER TABLE enrollments ADD COLUMN sales_counted INTEGER DEFAULT 0"); } catch(e) {}
      try {
        await driver.execute("UPDATE users SET account_type = 'registration', role = 'registration' WHERE account_type = 'registration_sponsor'");
        await driver.execute("UPDATE users SET account_type = 'registration' WHERE role = 'registration' AND account_type = 'student'");
        await driver.execute("UPDATE users SET account_type = 'student' WHERE role NOT IN ('registration', 'admin', 'ghost') AND account_type = 'student'");
        await driver.execute("UPDATE users SET account_type = 'registration_free' WHERE account_type = 'registration'");
      } catch(e) {}
      try { await driver.execute("UPDATE ranks SET sales_required = 2 WHERE name = 'Star' AND sales_required = 0"); } catch(e) {}
      try { await driver.execute("UPDATE courses SET featured_image = 'https://steadfast-energy-production-a9d1.up.railway.app' || featured_image WHERE featured_image LIKE '/uploads/%'"); } catch(e) {}
      await seedDataTurso(driver, exec);
    })();
  }
  tables.forEach(sql => driver.run(sql));
  // Add new columns to existing users table (safe to run even if exists)
  try { driver.run("ALTER TABLE users ADD COLUMN negative_allowed INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN qualified_direct_count INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN membership_days INTEGER DEFAULT 365"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN membership_progress REAL DEFAULT 65"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN session_token TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN total_sales INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN rank_progress INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN commission_per_sale REAL DEFAULT 1000"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN membership_expires_at TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE quizzes ADD COLUMN lesson_id TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE quizzes ADD COLUMN course_id TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE quizzes ADD COLUMN type TEXT DEFAULT 'topic'"); } catch(e) {}
  try { driver.run("ALTER TABLE quizzes ADD COLUMN pass_mark INTEGER DEFAULT 50"); } catch(e) {}
  try { driver.run("ALTER TABLE quizzes ADD COLUMN quiz_type TEXT DEFAULT 'mixed'"); } catch(e) {}
  try { driver.run("ALTER TABLE courses ADD COLUMN price_egp REAL DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE ranks ADD COLUMN image TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE ranks ADD COLUMN weekly_bonus REAL DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE ranks ADD COLUMN min_direct INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE user_sessions ADD COLUMN device_type TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE user_sessions ADD COLUMN device_info TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE user_sessions ADD COLUMN last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
  try { driver.run("ALTER TABLE commissions ADD COLUMN description TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE enrollments ADD COLUMN sales_counted INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'student'"); } catch(e) {}
  try { driver.run("ALTER TABLE courses ADD COLUMN is_show_free INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE courses ADD COLUMN is_show_homepage INTEGER DEFAULT 1"); } catch(e) {}
  try { driver.run("ALTER TABLE courses ADD COLUMN is_show_courses INTEGER DEFAULT 1"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN id_card_front TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN id_card_back TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN governorate TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN country TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN created_by_user TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN email_otp TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN email_otp_expires TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch(e) {}
  try { driver.run("ALTER TABLE users ADD COLUMN verification_expires TEXT"); } catch(e) {}
  try {
    driver.run("UPDATE users SET account_type = 'registration', role = 'registration' WHERE account_type = 'registration_sponsor'");
    driver.run("UPDATE users SET account_type = 'registration' WHERE role = 'registration' AND account_type = 'student'");
    driver.run("UPDATE users SET account_type = 'student' WHERE role NOT IN ('registration', 'admin', 'ghost') AND account_type = 'student'");
    driver.run("UPDATE users SET account_type = 'registration_free' WHERE account_type = 'registration'");
  } catch(e) {}
  try { driver.run("UPDATE ranks SET sales_required = 2 WHERE name = 'Star' AND sales_required = 0"); } catch(e) {}
  try { driver.run("UPDATE courses SET featured_image = 'https://steadfast-energy-production-a9d1.up.railway.app' || featured_image WHERE featured_image LIKE '/uploads/%'"); } catch(e) {}
  seedDataLocal(driver);
}

async function seedDataTurso(driver, exec) {
  const now = new Date().toISOString().replace("T"," ").split(".")[0];
  const rankRes = await exec("SELECT COUNT(*) as c FROM ranks");
  if (!rankRes.length || rankRes[0].c === 0) {
    const ranks = [
      ["r1","Star",2,0,0],["r2","Executive",5,1500,1],["r3","Executive Star",10,3000,2],
      ["r4","Team Leader",20,5000,3],["r5","Senior Leader",40,8000,4],
      ["r6","Regional Leader",70,12000,5],["r7","Everest Elite",120,18000,6],
      ["r8","Everest Master",200,28000,7],["r9","Everest Legend",350,45000,8],
      ["r10","Everest Ambassador",600,75000,9],
    ];
    for (const r of ranks) {
      await driver.execute({ sql: "INSERT INTO ranks (id,name,sales_required,bonus,sort_order) VALUES (?,?,?,?,?)", args: r });
    }
  }
  const adminRes = await exec("SELECT id FROM users WHERE email = 'admin@everest.com'");
  if (!adminRes.length) {
    await driver.execute({ sql: "INSERT INTO users (id,full_name,email,password,role,referral_code,rank,status) VALUES (?,?,?,?,?,?,?,'active')",
      args: ["admin-001","Admin Everest","admin@everest.com","admin123","admin","EVEREST-ADMIN","Star"] });
  }

  // Check if mock data was already seeded (permanent flag - survives deletion)
  try {
    const flagCheck = await exec("SELECT value FROM settings WHERE key = 'mock_data_seeded'");
    if (flagCheck.length && flagCheck[0].value === 'true') return;
  } catch(e) { return; }

  const pw = await bcrypt.hash("password123", 10);
  const users = getSeedUsers();
  for (const u of users) {
    const rc = "EVR-" + u.id;
    await driver.execute({ sql: "INSERT INTO users (id,full_name,email,password,role,account_type,referral_code,referred_by,rank,e_money,status,blocked,direct_count,total_sales,avatar,negative_allowed,membership_days,membership_progress,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [u.id,u.name,u.email,pw,u.role,u.type,rc,u.ref||null,u.rank||"",u.em,u.status,u.blocked||0,u.ds||0,u.ts||0,u.avatar||null,1,365,65,now,now] }).catch(()=>{});
  }

  // Closure table
  for (const u of users) {
    await driver.execute({ sql: "INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,0)", args: [u.id,u.id] }).catch(()=>{});
    if (u.ref) await driver.execute({ sql: "INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,1)", args: [u.ref,u.id] }).catch(()=>{});
  }
  for (const u of users) {
    if (!u.ref) continue;
    const gp = await exec("SELECT referred_by FROM users WHERE id = ?", [u.ref]);
    if (gp.length && gp[0].referred_by) {
      await driver.execute({ sql: "INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,2)", args: [gp[0].referred_by,u.id] }).catch(()=>{});
    }
  }

  // Courses
  for (const c of getSeedCourses()) {
    await driver.execute({ sql: "INSERT INTO courses (id,title,title_ar,description,description_ar,category,category_ar,difficulty,price,price_egp,is_free,status,author_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [c.id,c.title,c.title_ar,c.description,c.description_ar,c.category,c.category_ar,c.difficulty,c.price,c.price_egp,c.is_free,c.status,"admin-001",now,now] }).catch(()=>{});
  }

  // Topics
  for (const t of getSeedTopics()) {
    await driver.execute({ sql: "INSERT INTO topics (id,course_id,title,title_ar,summary,summary_ar,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [t.id,t.cid,t.title,t.title_ar,t.summary,t.summary_ar,t.sort_order,now] }).catch(()=>{});
  }

  // Lessons
  for (const l of getSeedLessons()) {
    await driver.execute({ sql: "INSERT INTO lessons (id,topic_id,title,title_ar,content,content_ar,duration,sort_order,is_free,video_url,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [l.id,l.tid,l.title,l.title_ar,l.content,l.content_ar,l.duration,0,l.is_free,l.video_url,now] }).catch(()=>{});
  }

  // Quizzes
  for (const q of getSeedQuizzes()) {
    await driver.execute({ sql: "INSERT INTO quizzes (id,topic_id,course_id,type,title,questions,total_marks,pass_mark,quiz_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [q.id,q.topic_id,q.course_id,q.type,q.title,q.questions,q.total_marks,q.pass_mark,"mixed",now] }).catch(()=>{});
  }

  // Enrollments
  for (const [uid,cid,st,pm,pr] of getSeedEnrollments()) {
    await driver.execute({ sql: "INSERT INTO enrollments (id,user_id,course_id,status,payment_method,progress,enrolled_at) VALUES (?,?,?,?,?,?,?)",
      args: [uuidv4(),uid,cid,st,pm,pr,now] }).catch(()=>{});
  }

  // Quiz attempts
  for (const [qid,uid,tot,earn,cor,inc,res] of getSeedQuizAttempts()) {
    await driver.execute({ sql: "INSERT INTO quiz_attempts (id,quiz_id,user_id,total_marks,earned_marks,correct_answers,incorrect_answers,result,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [uuidv4(),qid,uid,tot,earn,cor,inc,res,now] }).catch(()=>{});
  }

  // Commissions
  for (const [from,to,lvl,amt] of getSeedCommissions()) {
    await driver.execute({ sql: "INSERT INTO commissions (id,from_user_id,to_user_id,level,amount,created_at) VALUES (?,?,?,?,?,?)",
      args: [uuidv4(),from,to,lvl,amt,now] }).catch(()=>{});
  }

  // Feedbacks
  for (const [uid,msg,rat] of getSeedFeedbacks()) {
    await driver.execute({ sql: "INSERT INTO feedbacks (id,user_id,message,rating,created_at) VALUES (?,?,?,?,?)",
      args: [uuidv4(),uid,msg,rat,now] }).catch(()=>{});
  }

  // Notifications
  for (const [uid,title,msg,type] of getSeedNotifications()) {
    await driver.execute({ sql: "INSERT INTO notifications (id,user_id,title,message,type,created_at) VALUES (?,?,?,?,?,?)",
      args: [uuidv4(),uid,title,msg,type,now] }).catch(()=>{});
  }

  // Weekly history
  for (const r of getSeedWeeklyHistory()) {
    const [uid,ws,we,pr,cr,tds,sds,rds,qds,qtc,qnc,sm,rm,he,ie,comm,cs,ps,fr] = r;
    const det = JSON.stringify({qualifiedTeamCount:qtc,qualifiedNetworkCount:qnc,studentMembers:sm,registrationMembers:rm,weeklyCommission:comm,commissionStatus:cs,promotionStatus:ps,failureReason:fr});
    await driver.execute({ sql: "INSERT INTO weekly_history (id,user_id,week_start,week_end,calculation_date,previous_rank,current_rank,total_direct_sales,student_direct_sales,registration_direct_sales,qualified_direct_sales,qualified_team_count,qualified_network_count,student_members,registration_members,higher_rank_excluded,inactive_excluded,weekly_commission,commission_status,promotion_status,failure_reason,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [uuidv4(),uid,ws,we,now,pr||null,cr,tds,sds,rds,qds,qtc,qnc,sm,rm,he,ie,comm,cs,ps,fr||null,det] }).catch(()=>{});
  }

  // Leaders
  for (const [name,rank,icon,so,avatar] of getSeedLeaders()) {
    await driver.execute({ sql: "INSERT INTO leaders (id,name,rank,avatar,icon,sort_order,created_at) VALUES (?,?,?,?,?,?,?)",
      args: [uuidv4(),name,rank,avatar||null,icon,so,now] }).catch(()=>{});
  }

  // Course reviews
  for (const [cid,uid,rat,cmt] of getSeedCourseReviews()) {
    await driver.execute({ sql: "INSERT INTO course_reviews (id,course_id,user_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)",
      args: [uuidv4(),cid,uid,rat,cmt,now] }).catch(()=>{});
  }

  // Settings
  for (const [k,v] of getSeedSettings()) {
    await driver.execute({ sql: "INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)", args: [k,v] }).catch(()=>{});
  }

  console.log("  Turso mock data seeded: 18 users, 3 courses, 5 topics, 11 lessons, 8 quizzes");
  await driver.execute({ sql: "INSERT OR REPLACE INTO settings (key,value) VALUES ('mock_data_seeded','true')" }).catch(()=>{});
}

function seedDataLocal(driver) {
  const now = new Date().toISOString().replace("T"," ").split(".")[0];
  function safe(fn) { try { fn(); } catch(e) {} }
  function exists(table, where, params) {
    const r = driver.exec(`SELECT 1 FROM ${table} WHERE ${where}`, params);
    return r.length > 0 && r[0].values.length > 0;
  }

  // Ranks
  const rankExists = driver.exec("SELECT COUNT(*) as c FROM ranks");
  if (!rankExists.length || !rankExists[0].values.length || rankExists[0].values[0][0] === 0) {
    const ranks = [
      ["r1","Star",2,0,0],["r2","Executive",5,1500,1],["r3","Executive Star",10,3000,2],
      ["r4","Team Leader",20,5000,3],["r5","Senior Leader",40,8000,4],
      ["r6","Regional Leader",70,12000,5],["r7","Everest Elite",120,18000,6],
      ["r8","Everest Master",200,28000,7],["r9","Everest Legend",350,45000,8],
      ["r10","Everest Ambassador",600,75000,9],
    ];
    const stmt = driver.prepare("INSERT INTO ranks (id,name,sales_required,bonus,sort_order) VALUES (?,?,?,?,?)");
    for (const r of ranks) stmt.run(r);
    stmt.free();
  }

  // Admin
  const adminExists = driver.exec("SELECT id FROM users WHERE email = 'admin@everest.com'");
  if (!adminExists.length || !adminExists[0].values.length) {
    driver.run("INSERT INTO users (id,full_name,email,password,role,referral_code,rank,status) VALUES (?,?,?,?,?,?,?,'active')",
      ["admin-001","Admin Everest","admin@everest.com","admin123","admin","EVEREST-ADMIN","Star"]);
  }

  // Check if mock data was already seeded (permanent flag)
  try {
    const flagCheck = driver.exec("SELECT value FROM settings WHERE key = 'mock_data_seeded'");
    if (flagCheck.length && flagCheck[0].values.length && flagCheck[0].values[0][0] === 'true') return;
  } catch(e) { return; }

  const users = getSeedUsers();
  const pw = bcrypt.hashSync("password123", 10);
  const stmt = driver.prepare("INSERT INTO users (id,full_name,email,password,role,account_type,referral_code,referred_by,rank,e_money,status,blocked,direct_count,total_sales,avatar,negative_allowed,membership_days,membership_progress,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (const u of users) {
    const rc = "EVR-" + u.id;
    safe(() => stmt.run([u.id,u.name,u.email,pw,u.role,u.type,rc,u.ref||null,u.rank||"",u.em,u.status,u.blocked||0,u.ds||0,u.ts||0,u.avatar||null,1,365,65,now,now]));
  }
  stmt.free();

  // Closure table
  for (const u of users) {
    safe(() => driver.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,0)", [u.id,u.id]));
    if (u.ref) safe(() => driver.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,1)", [u.ref,u.id]));
  }
  for (const u of users) {
    if (!u.ref) continue;
    const gp = driver.exec("SELECT referred_by FROM users WHERE id = ?", [u.ref]);
    if (gp.length && gp[0].values.length && gp[0].values[0][0]) {
      safe(() => driver.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,2)", [gp[0].values[0][0],u.id]));
    }
  }

  // Courses
  for (const c of getSeedCourses()) {
    if (!exists("courses","id = ?",[c.id])) {
      driver.run("INSERT INTO courses (id,title,title_ar,description,description_ar,category,category_ar,difficulty,price,price_egp,is_free,status,author_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [c.id,c.title,c.title_ar,c.description,c.description_ar,c.category,c.category_ar,c.difficulty,c.price,c.price_egp,c.is_free,c.status,"admin-001",now,now]);
    }
  }

  // Topics
  for (const t of getSeedTopics()) {
    if (!exists("topics","id = ?",[t.id])) {
      driver.run("INSERT INTO topics (id,course_id,title,title_ar,summary,summary_ar,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [t.id,t.cid,t.title,t.title_ar,t.summary,t.summary_ar,t.sort_order,now]);
    }
  }

  // Lessons
  for (const l of getSeedLessons()) {
    if (!exists("lessons","id = ?",[l.id])) {
      driver.run("INSERT INTO lessons (id,topic_id,title,title_ar,content,content_ar,duration,sort_order,is_free,video_url,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [l.id,l.tid,l.title,l.title_ar,l.content,l.content_ar,l.duration,0,l.is_free,l.video_url,now]);
    }
  }

  // Quizzes
  for (const q of getSeedQuizzes()) {
    if (!exists("quizzes","id = ?",[q.id])) {
      driver.run("INSERT INTO quizzes (id,topic_id,course_id,type,title,questions,total_marks,pass_mark,quiz_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [q.id,q.topic_id,q.course_id,q.type,q.title,q.questions,q.total_marks,q.pass_mark,"mixed",now]);
    }
  }

  // Enrollments
  for (const [uid,cid,st,pm,pr] of getSeedEnrollments()) {
    if (!exists("enrollments","user_id = ? AND course_id = ?",[uid,cid])) {
      driver.run("INSERT INTO enrollments (id,user_id,course_id,status,payment_method,progress,enrolled_at) VALUES (?,?,?,?,?,?,?)",
        [uuidv4(),uid,cid,st,pm,pr,now]);
    }
  }

  // Quiz attempts
  for (const [qid,uid,tot,earn,cor,inc,res] of getSeedQuizAttempts()) {
    if (!exists("quiz_attempts","quiz_id = ? AND user_id = ?",[qid,uid])) {
      driver.run("INSERT INTO quiz_attempts (id,quiz_id,user_id,total_marks,earned_marks,correct_answers,incorrect_answers,result,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [uuidv4(),qid,uid,tot,earn,cor,inc,res,now]);
    }
  }

  // Commissions
  for (const [from,to,lvl,amt] of getSeedCommissions()) {
    if (!exists("commissions","from_user_id = ? AND to_user_id = ?",[from,to])) {
      driver.run("INSERT INTO commissions (id,from_user_id,to_user_id,level,amount,created_at) VALUES (?,?,?,?,?,?)",
        [uuidv4(),from,to,lvl,amt,now]);
    }
  }

  // Feedbacks
  for (const [uid,msg,rat] of getSeedFeedbacks()) {
    if (!exists("feedbacks","user_id = ?",[uid])) {
      driver.run("INSERT INTO feedbacks (id,user_id,message,rating,created_at) VALUES (?,?,?,?,?)",
        [uuidv4(),uid,msg,rat,now]);
    }
  }

  // Notifications
  for (const [uid,title,msg,type] of getSeedNotifications()) {
    driver.run("INSERT INTO notifications (id,user_id,title,message,type,created_at) VALUES (?,?,?,?,?,?)",
      [uuidv4(),uid,title,msg,type,now]);
  }

  // Weekly history
  for (const r of getSeedWeeklyHistory()) {
    const [uid,ws,we,pr,cr,tds,sds,rds,qds,qtc,qnc,sm,rm,he,ie,comm,cs,ps,fr] = r;
    const det = JSON.stringify({qualifiedTeamCount:qtc,qualifiedNetworkCount:qnc,studentMembers:sm,registrationMembers:rm,weeklyCommission:comm,commissionStatus:cs,promotionStatus:ps,failureReason:fr});
    if (!exists("weekly_history","user_id = ? AND week_start = ?",[uid,ws])) {
      driver.run("INSERT INTO weekly_history (id,user_id,week_start,week_end,calculation_date,previous_rank,current_rank,total_direct_sales,student_direct_sales,registration_direct_sales,qualified_direct_sales,qualified_team_count,qualified_network_count,student_members,registration_members,higher_rank_excluded,inactive_excluded,weekly_commission,commission_status,promotion_status,failure_reason,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [uuidv4(),uid,ws,we,now,pr||null,cr,tds,sds,rds,qds,qtc,qnc,sm,rm,he,ie,comm,cs,ps,fr||null,det]);
    }
  }

  // Leaders
  for (const [name,rank,icon,so,avatar] of getSeedLeaders()) {
    if (!exists("leaders","name = ?",[name])) {
      driver.run("INSERT INTO leaders (id,name,rank,avatar,icon,sort_order,created_at) VALUES (?,?,?,?,?,?,?)",
        [uuidv4(),name,rank,avatar||null,icon,so,now]);
    }
  }

  // Course reviews
  for (const [cid,uid,rat,cmt] of getSeedCourseReviews()) {
    safe(() => driver.run("INSERT OR IGNORE INTO course_reviews (id,course_id,user_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)",
      [uuidv4(),cid,uid,rat,cmt,now]));
  }

  // Settings
  for (const [k,v] of getSeedSettings()) {
    if (!exists("settings","key = ?",[k])) {
      driver.run("INSERT INTO settings (key,value) VALUES (?,?)", [k,v]);
    }
  }

  console.log("  Mock data seeded: 18 users, 3 courses, 5 topics, 11 lessons, 8 quizzes");
  safe(() => driver.run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", ["mock_data_seeded", "true"]));
}

export function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    // Save backup copy
    try {
      const backupDir = join(__dirname, "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.writeFileSync(join(backupDir, `everest-${timestamp}.db`), Buffer.from(data));
      // Keep only latest 5 backups
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".db")).sort().reverse();
      for (let i = 5; i < files.length; i++) fs.unlinkSync(join(backupDir, files[i]));
    } catch (e) {}
  }
}

// Auto-save every 10 minutes (started after init)
let autoSaveTimer = null;
export function startAutoSave() {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => { if (db) saveDb(); }, 600000);
}

// One-time reset: everyone with a rank (non-admin) goes back to the beginning (rank zero).
// Guarded by a settings flag so it never re-runs after the first time.
export async function resetAllRanksOnce() {
  try {
    const flag = await queryOne("SELECT value FROM settings WHERE key = 'rank_reset_done'");
    if (flag && flag.value) return { success: true, skipped: true };
    await execute("UPDATE users SET rank = '', rank_progress = 0 WHERE rank != '' AND role NOT IN ('admin','ghost')");
    await execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('rank_reset_done', '1')");
    console.log("🔄 [RANK RESET] All ranks cleared - everyone starts from the beginning");
    return { success: true };
  } catch (e) {
    console.error("resetAllRanksOnce error:", e);
    return { success: false, error: e.message };
  }
}

// One-time migration: accounts created before bcrypt was introduced have their
// password stored as plaintext, which makes bcrypt.compare() fail at login.
// Re-hash whatever is stored (the original plaintext) so the existing password
// keeps working and the database no longer contains plaintext passwords.
export async function migrateLegacyPasswords() {
  try {
    const rows = await query("SELECT id, email, password FROM users");
    const isBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    let fixed = 0;
    for (const u of rows) {
      const pw = u.password || "";
      if (!pw || isBcrypt.test(pw)) continue;
      const hashed = await bcrypt.hash(pw, 10);
      await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, u.id]);
      fixed++;
      console.log(`🔑 Re-hashed legacy plaintext password for ${u.email}`);
    }
    if (fixed > 0) console.log(`✅ Migrated ${fixed} legacy plaintext password(s) to bcrypt`);
    return { fixed };
  } catch (e) {
    console.error("migrateLegacyPasswords error:", e.message);
    return { fixed: 0, error: e.message };
  }
}

export async function query(sql, params = []) {
  if (isTurso) {
    const safeParams = params.map(p => p === undefined ? null : p);
    const result = await turso.execute({ sql, args: safeParams, rowMode: 'object' });
    return result.rows;
  }
  const stmt = db.prepare(sql);
  const safeParams = params.map(p => p === undefined ? null : p);
  if (safeParams.length) stmt.bind(safeParams);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

export async function execute(sql, params = []) {
  const safeParams = params.map(p => p === undefined ? null : p);
  if (isTurso) {
    await turso.execute({ sql, args: safeParams });
    return;
  }
  db.run(sql, safeParams);
  saveDb();
}

export default null;
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";

const SQL = await initSqlJs();

function createDb() {
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = OFF");
  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    phone TEXT, address TEXT, password TEXT NOT NULL, role TEXT DEFAULT 'registration',
    avatar TEXT, bio TEXT, referral_code TEXT UNIQUE, referred_by TEXT,
    created_by_user TEXT,
    rank TEXT DEFAULT '', e_money REAL DEFAULT 0, academic_points REAL DEFAULT 0,
    total_team_sales REAL DEFAULT 0, direct_count INTEGER DEFAULT 0,
    blocked INTEGER DEFAULT 0, status TEXT DEFAULT 'active',
    account_type TEXT DEFAULT 'student', rank_progress INTEGER DEFAULT 0,
    membership_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE ranks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, sales_required INTEGER DEFAULT 0,
    bonus REAL DEFAULT 0, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
    weekly_bonus REAL, min_direct INTEGER
  )`);
  db.run(`CREATE TABLE user_closure (
    ancestor TEXT NOT NULL, descendant TEXT NOT NULL, depth INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ancestor, descendant)
  )`);
  db.run(`CREATE TABLE weekly_sales (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, week_start TEXT NOT NULL,
    sales INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, week_start)
  )`);
  db.run(`CREATE TABLE weekly_history (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, week_start TEXT NOT NULL, week_end TEXT NOT NULL,
    calculation_date TEXT DEFAULT (datetime('now','localtime')),
    previous_rank TEXT, current_rank TEXT,
    total_direct_sales INTEGER DEFAULT 0, student_direct_sales INTEGER DEFAULT 0,
    registration_direct_sales INTEGER DEFAULT 0, qualified_direct_sales INTEGER DEFAULT 0,
    qualified_team_count INTEGER DEFAULT 0, qualified_network_count INTEGER DEFAULT 0,
    student_members INTEGER DEFAULT 0, registration_members INTEGER DEFAULT 0,
    higher_rank_excluded INTEGER DEFAULT 0, inactive_excluded INTEGER DEFAULT 0,
    weekly_commission REAL DEFAULT 0, commission_status TEXT DEFAULT 'not_eligible',
    promotion_status TEXT DEFAULT 'no_change', failure_reason TEXT, details TEXT
  )`);
  db.run(`CREATE TABLE weekly_commissions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, rank_name TEXT NOT NULL,
    amount REAL NOT NULL, week_start TEXT NOT NULL, week_end TEXT NOT NULL,
    calculated_at TEXT DEFAULT (datetime('now','localtime')), status TEXT DEFAULT 'paid'
  )`);
  db.run(`CREATE TABLE weekly_settlements (
    id TEXT PRIMARY KEY, week_start TEXT NOT NULL UNIQUE, week_end TEXT NOT NULL,
    status TEXT DEFAULT 'running', triggered_by TEXT DEFAULT 'auto', summary TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')), completed_at TEXT
  )`);
  db.run(`CREATE TABLE leaderboard_history (
    id TEXT PRIMARY KEY, week_start TEXT NOT NULL, rank_position INTEGER NOT NULL,
    user_id TEXT NOT NULL, full_name TEXT NOT NULL, avatar TEXT, rank TEXT,
    weekly_sales INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(week_start, rank_position)
  )`);
  db.run(`CREATE TABLE leaders (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, rank TEXT NOT NULL,
    avatar TEXT, icon TEXT DEFAULT '🏆', sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE excluded_leaders (
    user_id TEXT PRIMARY KEY, excluded_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
    type TEXT DEFAULT 'info', is_read INTEGER DEFAULT 0, related_id TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE wallet_transactions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL,
    description TEXT, payment_method TEXT, payment_proof TEXT, status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE rank_bonuses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, rank_name TEXT NOT NULL, amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run(`CREATE TABLE enrollments (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
    progress REAL DEFAULT 0, status TEXT DEFAULT 'approved', payment_method TEXT DEFAULT 'emoney',
    payment_proof TEXT, expires_at TEXT, enrolled_at TEXT DEFAULT (datetime('now','localtime')),
    sales_counted INTEGER DEFAULT 0
  )`);
  return db;
}

function apiFor(db) {
  const q = (sql, params = []) => {
    const stmt = db.prepare(sql);
    const safe = params.map(p => (p === undefined ? null : p));
    if (safe.length) stmt.bind(safe);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  return {
    query: async (sql, params = []) => q(sql, params),
    queryOne: async (sql, params = []) => q(sql, params)[0] || null,
    execute: async (sql, params = []) => {
      const safe = params.map(p => (p === undefined ? null : p));
      if (safe.length) db.run(sql, safe);
      else db.run(sql);
    },
    q,
  };
}

let ctx = null;
mock.module("../db.js", {
  namedExports: {
    query: (...a) => ctx.query(...a),
    queryOne: (...a) => ctx.queryOne(...a),
    execute: (...a) => ctx.execute(...a),
  },
});

const { runWeeklySettlement, getCurrentWeek, getSettlementWeek, getSettlementSettings, settlementConfigDisplay, nextSettlementTime, partsInTz, refreshLeadersSnapshot } =
  await import("./weeklySettlement.js");

function seedRanks(db) {
  const stmt = db.prepare("INSERT INTO ranks (id,name,sales_required,bonus,sort_order,min_direct,weekly_bonus) VALUES (?,?,?,?,?,?,?)");
  const ranks = [
    ["r1", "Star", 2, 0, 0, null, null],
    ["r2", "Executive", 5, 1500, 1, null, null],
    ["r3", "Executive Star", 10, 3000, 2, null, null],
    ["r4", "Team Leader", 20, 5000, 3, null, null],
    ["r5", "Senior Leader", 40, 8000, 4, null, null],
  ];
  for (const r of ranks) stmt.run(r);
  stmt.free();
}

// NOTE: created_at defaults to the current real time (NOT within a fake test week).
// Tests that need "NEW directs this week" must pass created_at inside [WEEK, WEEK_END].
function insertUser(db, { id, name, email, role = "student", account_type = "student", rank = "", referred_by = null, created_by_user = null, direct_count = 0, e_money = 0, status = "active", created_at = null }) {
  const ca = created_at || null;
  db.run(
    "INSERT INTO users (id,full_name,email,password,role,account_type,referral_code,referred_by,created_by_user,rank,e_money,status,blocked,direct_count,rank_progress,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, name, email, "pw", role, account_type, "REF-" + id, referred_by, created_by_user, rank, e_money, status, 0, direct_count, 0, ca]
  );
}

// Insert closure descendants at depth 2 (below the user), mimicking an entire downline team.
function insertClosure(db, ancestor, descendants) {
  for (const d of descendants) {
    db.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,2)", [ancestor, d]);
  }
}
// Insert a DIRECT (depth 1) closure link for a direct child.
function insertDirectClosure(db, ancestor, descendant) {
  db.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,1)", [ancestor, descendant]);
}

function insertWeeklySales(db, userId, weekStart, sales) {
  db.run("INSERT INTO weekly_sales (id,user_id,week_start,sales) VALUES (?,?,?,?)", ["ws-" + userId + "-" + weekStart, userId, weekStart, sales]);
}

function seedSettings(db, overrides = {}) {
  const defaults = {
    settlement_enabled: "true",
    settlement_day: "5",
    settlement_hour: "0",
    settlement_minute: "0",
    settlement_timezone: "Africa/Cairo",
    settlement_min_direct_sales: "2",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    db.run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", [k, v]);
  }
}

const WEEK = "2026-08-02";
const WEEK_END = "2026-08-08";
const W_IN = `${WEEK} 12:00:00`;        // inside the week window
const W_PREV = "2026-07-25 12:00:00";   // before the week (old directs)

// ─── Tests ───

test("defaults: Friday 00:00 Africa/Cairo, enabled, min 2 directs", async () => {
  const db = createDb();
  seedSettings(db);
  ctx = apiFor(db);
  const settings = await getSettlementSettings();
  assert.equal(settings.settlement_day, "5");
  assert.equal(settings.settlement_hour, "0");
  assert.equal(settings.settlement_minute, "0");
  assert.equal(settings.settlement_timezone, "Africa/Cairo");
  assert.equal(settings.settlement_enabled, "true");
  assert.equal(settings.settlement_min_direct_sales, "2");
  const display = settlementConfigDisplay(settings);
  assert.equal(display.day, "Friday");
  assert.equal(display.hour, 0);
  assert.equal(display.minute, 0);
  assert.equal(display.timezone, "Africa/Cairo");
  const next = nextSettlementTime(settings);
  assert.equal(next.day, "Friday");
  assert.match(next.label, /00:00/);
});

test("weekly cycle matches settlement schedule (Friday start)", async () => {
  const db = createDb();
  seedSettings(db);
  ctx = apiFor(db);
  const { weekStart, weekEnd } = await getCurrentWeek();
  const [y, m, d] = weekStart.split("-").map(Number);
  assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), 5, "running week must start on Friday");
  const start = Date.UTC(y, m - 1, d);
  const [ey, em, ed] = weekEnd.split("-").map(Number);
  assert.equal((Date.UTC(ey, em - 1, ed) - start) / 86400000, 6);
});

// Test 1, 2: 0 or 1 NEW weekly direct → NOT eligible for commission.
// Test 3: 2 NEW weekly directs → eligible.
test("T1/T2/T3: eligible only with >= `minDirectSales` NEW directs THIS week", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  // u0: 0 new directs → not eligible
  insertUser(db, { id: "u0", name: "Zero", email: "u0@t.com", rank: "Executive", referred_by: null });
  // u1: 1 new direct (Student, this week) → not eligible
  insertUser(db, { id: "u1", name: "One", email: "u1@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "u1d", name: "U1D", email: "u1d@t.com", rank: "Star", referred_by: "u1", created_at: W_IN });
  insertDirectClosure(db, "u1", "u1d");
  // u2: 2 new directs (Student, this week) → eligible
  insertUser(db, { id: "u2", name: "Two", email: "u2@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "u2d1", name: "U2D1", email: "u2d1@t.com", rank: "Star", referred_by: "u2", created_at: W_IN });
  insertUser(db, { id: "u2d2", name: "U2D2", email: "u2d2@t.com", rank: "Star", referred_by: "u2", created_at: W_IN });
  insertDirectClosure(db, "u2", "u2d1");
  insertDirectClosure(db, "u2", "u2d2");

  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u0'")[0].commission_status, "not_eligible");
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u1'")[0].commission_status, "not_eligible");
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u2'")[0].commission_status, "paid");
});

// Test 4: direct via referral code → counts.
// Test 5: direct via "Create Account for Another User" (created_by_user) → counts.
test("T4/T5: referral-code directs AND create-account directs both count", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  // u-ref: 2 new directs, both via referred_by
  insertUser(db, { id: "u-ref", name: "Referrer", email: "ref@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "rd1", name: "RD1", email: "rd1@t.com", rank: "Star", referred_by: "u-ref", created_at: W_IN });
  insertUser(db, { id: "rd2", name: "RD2", email: "rd2@t.com", rank: "Star", referred_by: "u-ref", created_at: W_IN });
  insertDirectClosure(db, "u-ref", "rd1");
  insertDirectClosure(db, "u-ref", "rd2");
  // u-created: 2 new directs, both via created_by_user (Create Account for Another User)
  insertUser(db, { id: "u-cr", name: "Creator", email: "cr@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "cd1", name: "CD1", email: "cd1@t.com", rank: "Star", referred_by: null, created_by_user: "u-cr", created_at: W_IN });
  insertUser(db, { id: "cd2", name: "CD2", email: "cd2@t.com", rank: "Star", referred_by: null, created_by_user: "u-cr", created_at: W_IN });
  insertDirectClosure(db, "u-cr", "cd1");
  insertDirectClosure(db, "u-cr", "cd2");

  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-ref'")[0].commission_status, "paid");
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-cr'")[0].commission_status, "paid");
});

// Test 6: registration_free direct → does NOT generate commission (must be STUDENT).
test("T6: registration_free directs never qualify for commission", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-f", name: "FreeRef", email: "uf@t.com", rank: "Executive", referred_by: null });
  // two NEW registration_free directs this week (should NOT count as commission-eligible)
  insertUser(db, { id: "fd1", name: "FD1", email: "fd1@t.com", account_type: "registration_free", rank: "", referred_by: "u-f", created_at: W_IN });
  insertUser(db, { id: "fd2", name: "FD2", email: "fd2@t.com", account_type: "registration_free", rank: "", referred_by: "u-f", created_at: W_IN });
  insertDirectClosure(db, "u-f", "fd1");
  insertDirectClosure(db, "u-f", "fd2");
  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-f'")[0].commission_status, "not_eligible");
});

// Test 7: registration_free upgraded to student → starts counting toward rank/team.
test("T7: reg-free upgraded to student counts toward rank/team", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-h", name: "Host", email: "uh@t.com", rank: "Star", referred_by: null });
  // 4 team members, all STUDENT (converted from reg-free) → team 4+
  for (let i = 1; i <= 4; i++) {
    insertUser(db, { id: `s${i}`, name: `S${i}`, email: `s${i}@t.com`, account_type: "student", rank: "Star" });
  }
  insertClosure(db, "u-h", ["s1", "s2", "s3", "s4"]);
  // 2 NEW student directs this week (via create account), to satisfy the gate
  insertUser(db, { id: "hd1", name: "HD1", email: "hd1@t.com", rank: "Star", referred_by: "u-h", created_at: W_IN });
  insertUser(db, { id: "hd2", name: "HD2", email: "hd2@t.com", rank: "Star", referred_by: "u-h", created_at: W_IN });
  insertDirectClosure(db, "u-h", "hd1");
  insertDirectClosure(db, "u-h", "hd2");
  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  // team = 4 (team members) → but Star requires 2; rank is based on TEAM size, so Star has qualifiedTeamCount 4
  const h = ctx.q("SELECT * FROM weekly_history WHERE user_id = 'u-h'")[0];
  // 4 student team members (depth 2) + 2 new student directs (depth 1) count toward rank → 6
  assert.equal(h.qualified_team_count, 6);
});

// Test 8, 9: higher-ranked team member excluded; equal/lower ranked counted.
test("T8/T9: higher-ranked member excluded, equal/lower ranked counted (dynamic per root rank)", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  // root = Executive (sort_order 1)
  insertUser(db, { id: "root", name: "Root", email: "root@t.com", rank: "Executive", referred_by: null });
  // two NEW student directs this week → gate passes
  insertUser(db, { id: "r1", name: "R1", email: "r1@t.com", rank: "Star", referred_by: "root", created_at: W_IN });
  insertUser(db, { id: "r2", name: "R2", email: "r2@t.com", rank: "Star", referred_by: "root", created_at: W_IN });
  insertDirectClosure(db, "root", "r1");
  insertDirectClosure(db, "root", "r2");
  // Team members below root:
  //   m-eq = Executive (equal to root) → counted
  //   m-low = Star (lower) → counted
  //   m-high = Executive Star (higher than root) → EXCLUDED
  insertUser(db, { id: "m-eq", name: "MEq", email: "meq@t.com", rank: "Executive" });
  insertUser(db, { id: "m-low", name: "MLow", email: "mlow@t.com", rank: "Star" });
  insertUser(db, { id: "m-high", name: "MHigh", email: "mhigh@t.com", rank: "Executive Star" });
  insertClosure(db, "root", ["m-eq", "m-low", "m-high"]);

  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  const hist = ctx.q("SELECT * FROM weekly_history WHERE user_id = 'root'")[0];
  // counted: r1, r2 (directs) + m-eq + m-low = 4 ; m-high excluded
  assert.equal(hist.qualified_team_count, 4);
  assert.equal(hist.higher_rank_excluded, 1);
});

// Test 10: Star -> Executive -> Executive Star in one week = ONE commission at final rank (3000).
test("T10: single commission on the LAST/highest qualified rank", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-chain", name: "Chain", email: "chain@t.com", rank: "Star", referred_by: null });
  // 2 new student directs this week (gate)
  insertUser(db, { id: "c0", name: "C0", email: "c0@t.com", rank: "Star", referred_by: "u-chain", created_at: W_IN });
  insertUser(db, { id: "c1", name: "C1", email: "c1@t.com", rank: "Star", referred_by: "u-chain", created_at: W_IN });
  insertDirectClosure(db, "u-chain", "c0");
  insertDirectClosure(db, "u-chain", "c1");
  // enough team to reach Executive Star (10+) below u-chain
  for (let i = 0; i < 12; i++) insertUser(db, { id: `ct${i}`, name: `CT${i}`, email: `ct${i}@t.com`, rank: "Star" });
  insertClosure(db, "u-chain", Array.from({ length: 12 }, (_, i) => `ct${i}`));

  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  const u = ctx.q("SELECT * FROM users WHERE id = 'u-chain'")[0];
  assert.equal(u.rank, "Executive Star");
  assert.equal(u.e_money, 3000);
  const comms = ctx.q("SELECT * FROM weekly_commissions WHERE user_id = 'u-chain'");
  assert.equal(comms.length, 1);
  assert.equal(comms[0].rank_name, "Executive Star");
  assert.equal(comms[0].amount, 3000);
});

// Test 11: did not complete higher rank by Friday → not granted, keeps own achievable rank.
test("T11: incomplete higher-rank qualification is NOT granted at settlement", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  // u-exec: rank Executive, has only 2 new directs this week and team below threshold for next rank
  insertUser(db, { id: "u-exec", name: "Exec", email: "ue@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "e0", name: "E0", email: "e0@t.com", rank: "Star", referred_by: "u-exec", created_at: W_IN });
  insertUser(db, { id: "e1", name: "E1", email: "e1@t.com", rank: "Star", referred_by: "u-exec", created_at: W_IN });
  insertDirectClosure(db, "u-exec", "e0");
  insertDirectClosure(db, "u-exec", "e1");
  // team of 4 in total (below Executive Star threshold of 10 → stays Executive)
  insertUser(db, { id: "x1", name: "X1", email: "x1@t.com", rank: "Star" });
  insertUser(db, { id: "x2", name: "X2", email: "x2@t.com", rank: "Star" });
  insertClosure(db, "u-exec", ["x1", "x2"]);
  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  const u = ctx.q("SELECT * FROM users WHERE id = 'u-exec'")[0];
  assert.equal(u.rank, "Executive", "should NOT jump to Executive Star");
  const hist = ctx.q("SELECT * FROM weekly_history WHERE user_id = 'u-exec'")[0];
  assert.equal(hist.commission_status, "paid");
  assert.equal(hist.weekly_commission, 1500);
});

// Test 12/17: double-commission protection — running settlement twice pays once.
test("T12/T17: settlement paid once; re-run adds no extra commission", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-d", name: "Double", email: "ud@t.com", rank: "Executive Star", referred_by: null });
  insertUser(db, { id: "d0", name: "D0", email: "d0@t.com", rank: "Star", referred_by: "u-d", created_at: W_IN });
  insertUser(db, { id: "d1", name: "D1", email: "d1@t.com", rank: "Star", referred_by: "u-d", created_at: W_IN });
  insertDirectClosure(db, "u-d", "d0");
  insertDirectClosure(db, "u-d", "d1");
  ctx = apiFor(db);
  const first = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(first.success, true);
  const second = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(second.success, false);
  const comms = ctx.q("SELECT * FROM weekly_commissions WHERE user_id = 'u-d' AND week_start = ?", [WEEK]);
  assert.equal(comms.length, 1);
  assert.equal(ctx.q("SELECT e_money FROM users WHERE id = 'u-d'")[0].e_money, 3000);
});

// Test 13/14: after settlement weekly_sales reset to 0, but current_rank and rank_history preserved.
test("T13/T14: weekly sales reset; rank and history preserved (no downgrade)", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-r", name: "Reset", email: "ur@t.com", rank: "Executive Star", referred_by: null });
  insertUser(db, { id: "r0", name: "R0", email: "r0@t.com", rank: "Star", referred_by: "u-r", created_at: W_IN });
  insertUser(db, { id: "r1", name: "R1", email: "r1@t.com", rank: "Star", referred_by: "u-r", created_at: W_IN });
  insertDirectClosure(db, "u-r", "r0");
  insertDirectClosure(db, "u-r", "r1");
  insertWeeklySales(db, "u-r", WEEK, 20);
  ctx = apiFor(db);
  await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  // weekly sales reset
  assert.equal(ctx.q("SELECT COUNT(*) AS c FROM weekly_sales WHERE week_start = ?", [WEEK])[0].c, 0);
  // current rank unchanged
  assert.equal(ctx.q("SELECT rank FROM users WHERE id = 'u-r'")[0].rank, "Executive Star");
  // rank history preserved
  const hist = ctx.q("SELECT * FROM weekly_history WHERE user_id = 'u-r'");
  assert.equal(hist.length, 1);
  assert.equal(hist[0].current_rank, "Executive Star");
});

// Test 16: Star does NOT appear in Top Leaders.
test("T16: Star excluded from Top Leaders", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  // Two Executive users (with enough team to stay Executive) and two Stars.
  for (const [id, name, rank] of [["L1","Leader1","Executive"],["L2","Leader2","Executive"],["S1","Star1","Star"],["S2","Star2","Star"]]) {
    insertUser(db, { id, name, email: id + "@t.com", rank, referred_by: null });
  }
  // give each Leader 2 new student directs this week for the gate
  for (const lid of ["L1","L2"]) {
    insertUser(db, { id: lid + "d1", name: lid + "d1", email: lid + "d1@t.com", rank: "Star", referred_by: lid, created_at: W_IN });
    insertUser(db, { id: lid + "d2", name: lid + "d2", email: lid + "d2@t.com", rank: "Star", referred_by: lid, created_at: W_IN });
    insertDirectClosure(db, lid, lid + "d1");
    insertDirectClosure(db, lid, lid + "d2");
  }
  insertWeeklySales(db, "L1", WEEK, 30);
  insertWeeklySales(db, "L2", WEEK, 10);
  insertWeeklySales(db, "S1", WEEK, 50);
  ctx = apiFor(db);
  const count = await refreshLeadersSnapshot();
  const leaders = ctx.q("SELECT * FROM leaders");
  assert.ok(!leaders.some(l => l.rank === "Star"), "Star must not appear in Top Leaders");
  assert.ok(leaders.some(l => l.rank === "Executive"));
  assert.ok(count <= 10);
});

// Test 15: Top-10 snapshot saved BEFORE reset (and Star excluded from leaderboard_history too).
test("T15: leaderboard snapshot saved before reset; Star excluded", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "P1", name: "P1", email: "p1@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "SD", name: "SD", email: "sd@t.com", rank: "Star", referred_by: "P1", created_at: W_IN });
  insertUser(db, { id: "SD2", name: "SD2", email: "sd2@t.com", rank: "Star", referred_by: "P1", created_at: W_IN });
  insertDirectClosure(db, "P1", "SD");
  insertDirectClosure(db, "P1", "SD2");
  insertWeeklySales(db, "P1", WEEK, 15);
  insertWeeklySales(db, "SD", WEEK, 8);
  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(res.success, true);
  // snapshot rows exist for the week
  const lb = ctx.q("SELECT * FROM leaderboard_history WHERE week_start = ?", [WEEK]);
  assert.ok(lb.length > 0);
  // weekly sales reset after snapshot
  assert.equal(ctx.q("SELECT COUNT(*) AS c FROM weekly_sales WHERE week_start = ?", [WEEK])[0].c, 0);
});

test("auto mode skips when settlement disabled; manual still runs", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db, { settlement_enabled: "false" });
  insertUser(db, { id: "u-a", name: "A", email: "a@t.com", rank: "Executive", referred_by: null });
  insertUser(db, { id: "a1", name: "A1", email: "a1@t.com", rank: "Star", referred_by: "u-a", created_at: W_IN });
  insertUser(db, { id: "a2", name: "A2", email: "a2@t.com", rank: "Star", referred_by: "u-a", created_at: W_IN });
  insertDirectClosure(db, "u-a", "a1");
  insertDirectClosure(db, "u-a", "a2");
  ctx = apiFor(db);
  const auto = await runWeeklySettlement({ triggeredBy: "auto" });
  assert.equal(auto.skipped, "disabled");
  const manual = await runWeeklySettlement({ triggeredBy: "manual" });
  assert.equal(manual.success, true);
});

test("minimum direct sales threshold is configurable", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db, { settlement_min_direct_sales: "3" });
  insertUser(db, { id: "u-2", name: "Two", email: "u2@t.com", rank: "Executive", referred_by: null });
  // only 2 new directs → below threshold 3
  insertUser(db, { id: "w1", name: "W1", email: "w1@t.com", rank: "Star", referred_by: "u-2", created_at: W_IN });
  insertUser(db, { id: "w2", name: "W2", email: "w2@t.com", rank: "Star", referred_by: "u-2", created_at: W_IN });
  insertDirectClosure(db, "u-2", "w1");
  insertDirectClosure(db, "u-2", "w2");
  ctx = apiFor(db);
  await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-2'")[0].commission_status, "not_eligible");
});

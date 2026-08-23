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

const { runWeeklySettlement, getCurrentWeek, getSettlementWeek, getSettlementSettings, settlementConfigDisplay, nextSettlementTime, partsInTz } =
  await import("./weeklySettlement.js");

function seedRanks(db) {
  const stmt = db.prepare("INSERT INTO ranks (id,name,sales_required,bonus,sort_order,min_direct,weekly_bonus) VALUES (?,?,?,?,?,?,?)");
  const ranks = [
    ["r1", "Star", 2, 0, 0, null, null],
    ["r2", "Executive", 5, 1500, 1, null, null],
    ["r3", "Executive Star", 10, 3000, 2, null, null],
    ["r4", "Team Leader", 20, 5000, 3, null, null],
  ];
  for (const r of ranks) stmt.run(r);
  stmt.free();
}

function insertUser(db, { id, name, email, role = "student", account_type = "student", rank = "", referred_by = null, direct_count = 0, e_money = 0, status = "active" }) {
  db.run(
    "INSERT INTO users (id,full_name,email,password,role,account_type,referral_code,referred_by,rank,e_money,status,blocked,direct_count,rank_progress) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, name, email, "pw", role, account_type, "REF-" + id, referred_by, rank, e_money, status, 0, direct_count, 0]
  );
}

function insertClosure(db, ancestor, descendants) {
  for (const d of descendants) {
    db.run("INSERT OR IGNORE INTO user_closure (ancestor,descendant,depth) VALUES (?,?,2)", [ancestor, d]);
  }
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
  assert.equal(display.enabled, true);
  assert.equal(display.day, "Friday");
  assert.equal(display.hour, 0);
  assert.equal(display.minute, 0);
  assert.equal(display.timezone, "Africa/Cairo");
  assert.equal(display.minDirectSales, 2);
  const next = nextSettlementTime(settings);
  assert.equal(next.day, "Friday");
  assert.match(next.label, /00:00/);
});

test("empty settings table falls back to defaults", async () => {
  const db = createDb();
  ctx = apiFor(db);
  const settings = await getSettlementSettings();
  assert.equal(settings.settlement_day, "5");
  assert.equal(settings.settlement_timezone, "Africa/Cairo");
});

test("partsInTz: Cairo timezone day-of-week correctness", () => {
  assert.equal(partsInTz(new Date("2026-08-07T12:00:00Z"), "Africa/Cairo").dow, 5); // Friday
  assert.equal(partsInTz(new Date("2026-08-09T12:00:00Z"), "Africa/Cairo").dow, 0); // Sunday
});

test("weekly cycle matches settlement schedule (Friday start)", async () => {
  const db = createDb();
  seedSettings(db);
  ctx = apiFor(db);
  const { weekStart, weekEnd } = await getCurrentWeek();
  const [y, m, d] = weekStart.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  assert.equal(dow, 5, "running week must start on settlement day (Friday)");
  const start = Date.UTC(y, m - 1, d);
  const [ey, em, ed] = weekEnd.split("-").map(Number);
  const end = Date.UTC(ey, em - 1, ed);
  assert.equal((end - start) / 86400000, 6);
  const settled = await getSettlementWeek();
  const [sy, sm, sd] = settled.weekEnd.split("-").map(Number);
  const settledEnd = Date.UTC(sy, sm - 1, sd);
  assert.equal((start - settledEnd) / 86400000, 1, "settled week must end the day before the running week starts");
});

test("full settlement run: promote, single commission, reset, snapshot, no downgrade, idempotent", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  const WEEK = "2026-08-02";
  const WEEK_END = "2026-08-08";

  // u-star: Executive, 3 directs, 12 qualified team members (t13 higher rank + t14 inactive excluded)
  insertUser(db, { id: "u-star", name: "Star User", email: "star@t.com", rank: "Executive", referred_by: null, direct_count: 3 });
  for (let i = 1; i <= 3; i++) insertUser(db, { id: `d${i}`, name: `Direct ${i}`, email: `d${i}@t.com`, rank: "Star", referred_by: "u-star" });
  for (let i = 1; i <= 12; i++) insertUser(db, { id: `t${i}`, name: `Team ${i}`, email: `t${i}@t.com`, rank: "Star" });
  insertUser(db, { id: "t13", name: "Higher Rank", email: "t13@t.com", rank: "Team Leader" });
  insertUser(db, { id: "t14", name: "Inactive", email: "t14@t.com", rank: "Star", status: "inactive" });
  insertClosure(db, "u-star", ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t14"]);

  // u-chain: Star with same 12-team network -> jumps to Executive Star in one pass (chain 5 -> 10)
  insertUser(db, { id: "u-chain", name: "Chain User", email: "chain@t.com", rank: "Star", referred_by: null, direct_count: 3 });
  for (let i = 1; i <= 3; i++) insertUser(db, { id: `cd${i}`, name: `Chain D${i}`, email: `cd${i}@t.com`, rank: "Star", referred_by: "u-chain" });
  insertClosure(db, "u-chain", ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t14"]);

  // u-nochange: Executive Star but ZERO directs -> must NOT be downgraded
  insertUser(db, { id: "u-nochange", name: "No Change", email: "nc@t.com", rank: "Executive Star", referred_by: null, direct_count: 0 });

  // u-exec-noteam: Executive, 2 directs, no team -> rank unchanged, gets own-rank commission
  insertUser(db, { id: "u-exec-noteam", name: "Exec No Team", email: "ent@t.com", rank: "Executive", referred_by: null, direct_count: 2 });
  insertUser(db, { id: "ed1", name: "ED1", email: "ed1@t.com", rank: "Star", referred_by: "u-exec-noteam" });
  insertUser(db, { id: "ed2", name: "ED2", email: "ed2@t.com", rank: "Star", referred_by: "u-exec-noteam" });

  // u-tl: Executive Star with 20 active Star team members -> qualifies Team Leader
  insertUser(db, { id: "u-tl", name: "Team Lead", email: "tl@t.com", rank: "Executive Star", referred_by: null, direct_count: 2 });
  insertUser(db, { id: "td1", name: "TD1", email: "td1@t.com", rank: "Star", referred_by: "u-tl" });
  insertUser(db, { id: "td2", name: "TD2", email: "td2@t.com", rank: "Star", referred_by: "u-tl" });
  for (let i = 1; i <= 20; i++) insertUser(db, { id: `tt${i}`, name: `TL Team ${i}`, email: `tt${i}@t.com`, rank: "Star" });
  insertClosure(db, "u-tl", Array.from({ length: 20 }, (_, i) => `tt${i + 1}`));

  insertWeeklySales(db, "u-star", WEEK, 15);
  insertWeeklySales(db, "t1", WEEK, 8);
  insertWeeklySales(db, "d1", WEEK, 5);

  ctx = apiFor(db);
  const result = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });

  assert.equal(result.success, true);
  assert.equal(result.awarded, 4);
  assert.equal(result.totalCommissions, 3000 + 3000 + 1500 + 5000);

  const user = (id) => ctx.q("SELECT * FROM users WHERE id = ?", [id])[0];
  const commissionsFor = (id) => ctx.q("SELECT * FROM weekly_commissions WHERE user_id = ?", [id]);
  const historyFor = (id) => ctx.q("SELECT * FROM weekly_history WHERE user_id = ?", [id])[0];
  const txFor = (id) => ctx.q("SELECT * FROM wallet_transactions WHERE user_id = ?", [id]);

  // Req 13: Executive -> Executive Star, promoted once, single commission
  assert.equal(user("u-star").rank, "Executive Star");
  assert.equal(user("u-star").e_money, 3000);
  const starComms = commissionsFor("u-star");
  assert.equal(starComms.length, 1, "exactly ONE commission per settled week");
  assert.equal(starComms[0].rank_name, "Executive Star");
  assert.equal(starComms[0].amount, 3000);
  assert.equal(starComms[0].week_start, WEEK);
  assert.equal(starComms[0].week_end, WEEK_END);
  assert.equal(txFor("u-star").length, 1);
  assert.equal(txFor("u-star")[0].amount, 3000);
  assert.equal(txFor("u-star")[0].type, "credit");
  const starHist = historyFor("u-star");
  assert.equal(starHist.previous_rank, "Executive");
  assert.equal(starHist.current_rank, "Executive Star");
  assert.equal(starHist.commission_status, "paid");
  assert.equal(starHist.qualified_team_count, 12);
  assert.equal(starHist.qualified_direct_sales, 3);
  assert.equal(starHist.higher_rank_excluded, 1);
  assert.equal(starHist.inactive_excluded, 1);
  const starDetails = JSON.parse(starHist.details);
  assert.equal(starDetails.qualifiedNetworkCount, 13);

  // Req 7: Star -> Executive -> Executive Star in one pass = ONE commission at final rank (3000, not 1500+3000)
  assert.equal(user("u-chain").rank, "Executive Star");
  assert.equal(user("u-chain").e_money, 3000);
  const chainComms = commissionsFor("u-chain");
  assert.equal(chainComms.length, 1);
  assert.equal(chainComms[0].rank_name, "Executive Star");
  assert.equal(chainComms[0].amount, 3000);
  const chainHist = historyFor("u-chain");
  assert.equal(chainHist.previous_rank, "Star");
  assert.equal(chainHist.current_rank, "Executive Star");
  assert.equal(chainHist.promotion_status, "promoted");

  // Req 5: never downgraded
  assert.equal(user("u-nochange").rank, "Executive Star");
  assert.equal(user("u-nochange").e_money, 0);
  assert.equal(commissionsFor("u-nochange").length, 0);
  assert.equal(historyFor("u-nochange").commission_status, "not_eligible");

  // Req 11: incomplete progress -> rank unchanged, weekly sales reset, still gets own-rank commission
  assert.equal(user("u-exec-noteam").rank, "Executive");
  assert.equal(user("u-exec-noteam").e_money, 1500);
  assert.equal(commissionsFor("u-exec-noteam")[0].rank_name, "Executive");

  // Req 12: Team Leader qualification still applies
  assert.equal(user("u-tl").rank, "Team Leader");
  assert.equal(user("u-tl").e_money, 5000);
  assert.equal(commissionsFor("u-tl").length, 1);

  // Req 8: NO separate rank-up bonuses anywhere
  assert.equal(ctx.q("SELECT COUNT(*) AS c FROM rank_bonuses")[0].c, 0);

  // Req 6: rank history never deleted - every processed user has exactly one record
  assert.equal(ctx.q("SELECT COUNT(*) AS c FROM weekly_history")[0].c, result.total_users);
  assert.equal(historyFor("u-star").current_rank, "Executive Star");

  // Req 10: Top-10 snapshot saved BEFORE reset
  const lb = ctx.q("SELECT * FROM leaderboard_history WHERE week_start = ? ORDER BY rank_position ASC", [WEEK]);
  assert.equal(lb.length, 3);
  assert.equal(lb[0].user_id, "u-star");
  assert.equal(lb[0].weekly_sales, 15);
  assert.equal(lb[1].user_id, "t1");
  assert.equal(lb[1].weekly_sales, 8);

  // Req 4: weekly sales reset AFTER snapshot (only for the settled week)
  assert.equal(ctx.q("SELECT COUNT(*) AS c FROM weekly_sales WHERE week_start = ?", [WEEK])[0].c, 0);

  // Settlement claim marked completed
  const claim = ctx.q("SELECT * FROM weekly_settlements WHERE week_start = ?", [WEEK])[0];
  assert.equal(claim.status, "completed");

  // Idempotent: second run refuses
  const second = await runWeeklySettlement({ triggeredBy: "auto", weekStart: WEEK });
  assert.equal(second.success, false);
  assert.match(second.error, /already settled/);
  // No double commission after the refused re-run
  assert.equal(commissionsFor("u-star").length, 1);
});

test("auto mode skips when settlement disabled; manual still runs", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db, { settlement_enabled: "false" });
  insertUser(db, { id: "u-a", name: "A", email: "a@t.com", rank: "Executive", referred_by: null, direct_count: 2 });
  insertUser(db, { id: "a1", name: "A1", email: "a1@t.com", rank: "Star", referred_by: "u-a" });
  insertUser(db, { id: "a2", name: "A2", email: "a2@t.com", rank: "Star", referred_by: "u-a" });
  ctx = apiFor(db);
  const auto = await runWeeklySettlement({ triggeredBy: "auto" });
  assert.equal(auto.success, false);
  assert.equal(auto.skipped, "disabled");
  const manual = await runWeeklySettlement({ triggeredBy: "manual" });
  assert.equal(manual.success, true);
});

test("minimum direct sales is configurable (default 2)", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-1", name: "One", email: "o@t.com", rank: "Executive", referred_by: null, direct_count: 1 });
  insertUser(db, { id: "u-2", name: "Two", email: "w@t.com", rank: "Executive", referred_by: null, direct_count: 2 });
  insertUser(db, { id: "o1", name: "O1", email: "o1@t.com", rank: "Star", referred_by: "u-1" });
  insertUser(db, { id: "w1", name: "W1", email: "w1@t.com", rank: "Star", referred_by: "u-2" });
  insertUser(db, { id: "w2", name: "W2", email: "w2@t.com", rank: "Star", referred_by: "u-2" });
  ctx = apiFor(db);
  let res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: "2026-08-02" });
  assert.equal(res.success, true);
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-1'")[0].commission_status, "not_eligible");
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-2'")[0].commission_status, "paid");

  // Raise threshold to 3 -> u-2 (2 directs) becomes ineligible
  const db2 = createDb();
  seedRanks(db2);
  seedSettings(db2, { settlement_min_direct_sales: "3" });
  insertUser(db2, { id: "u-2", name: "Two", email: "w@t.com", rank: "Executive", referred_by: null, direct_count: 2 });
  insertUser(db2, { id: "w1", name: "W1", email: "w1@t.com", rank: "Star", referred_by: "u-2" });
  insertUser(db2, { id: "w2", name: "W2", email: "w2@t.com", rank: "Star", referred_by: "u-2" });
  ctx = apiFor(db2);
  res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: "2026-08-02" });
  assert.equal(ctx.q("SELECT commission_status FROM weekly_history WHERE user_id = 'u-2'")[0].commission_status, "not_eligible");
});

test("registration_free users participate in ranks/commissions normally, but only student downline counts", async () => {
  const db = createDb();
  seedRanks(db);
  seedSettings(db);
  insertUser(db, { id: "u-f", name: "Free", email: "f@t.com", account_type: "registration_free", rank: "Star", referred_by: null, direct_count: 2 });
  // registration_free downline members never count toward the rank/team
  insertUser(db, { id: "d1", name: "D1", email: "d1@t.com", account_type: "registration_free", rank: "", referred_by: "u-f" });
  insertUser(db, { id: "d2", name: "D2", email: "d2@t.com", account_type: "registration_free", rank: "", referred_by: "u-f" });
  // student downline members DO count
  insertUser(db, { id: "t1", name: "T1", email: "t1@t.com", account_type: "student", rank: "", referred_by: "u-f" });
  insertUser(db, { id: "t2", name: "T2", email: "t2@t.com", account_type: "student", rank: "", referred_by: "u-f" });
  insertUser(db, { id: "t3", name: "T3", email: "t3@t.com", account_type: "student", rank: "", referred_by: "u-f" });
  insertUser(db, { id: "t4", name: "T4", email: "t4@t.com", account_type: "student", rank: "", referred_by: "u-f" });
  insertUser(db, { id: "t5", name: "T5", email: "t5@t.com", account_type: "student", rank: "", referred_by: "u-f" });
  insertClosure(db, "u-f", ["d1", "d2", "t1", "t2", "t3", "t4", "t5"]);

  ctx = apiFor(db);
  const res = await runWeeklySettlement({ triggeredBy: "auto", weekStart: "2026-08-02" });
  assert.equal(res.success, true);
  // u-f (registration_free) is still processed like a normal account and can rank up
  const user = ctx.q("SELECT * FROM users WHERE id = 'u-f'")[0];
  assert.equal(user.rank, "Executive");
  assert.equal(user.e_money, 1500);
  const comms = ctx.q("SELECT * FROM weekly_commissions WHERE user_id = 'u-f'");
  assert.equal(comms.length, 1);
  assert.equal(comms[0].rank_name, "Executive");
  assert.equal(comms[0].amount, 1500);
  const hist = ctx.q("SELECT * FROM weekly_history WHERE user_id = 'u-f'")[0];
  assert.equal(hist.commission_status, "paid");
  // only the 5 student directs count toward the rank (regfree recorded as info only)
  assert.equal(hist.qualified_team_count, 5);
  assert.equal(hist.qualified_direct_sales, 5);
  assert.equal(hist.student_direct_sales, 5);
  assert.equal(hist.registration_direct_sales, 2);
});

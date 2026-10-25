import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";

// ─── In-memory stand-ins for the users / leaders tables ───
const users = [
  { id: "4698894723", full_name: "يوسف العزب ", email: "youssef@example.com", phone: "01000000001", referral_code: "EVR-111", avatar: null, rank: "Executive Star", role: "student", e_money: 100, direct_count: 2 },
  { id: "5151402190", full_name: "Saeid Nawar", email: "saeid@example.com", phone: "01000000002", referral_code: "EVR-222", avatar: null, rank: "Executive Star", role: "student", e_money: 100, direct_count: 2 },
  { id: "6502217958", full_name: "Adam ashraf", email: "adam@example.com", phone: "01000000003", referral_code: "EVR-333", avatar: null, rank: "Star", role: "registration", e_money: 0, direct_count: 0 },
  { id: "9999000001", full_name: "Ahmed Ali", email: "ahmed1@example.com", phone: "01000000004", referral_code: "EVR-444", avatar: null, rank: "Star", role: "student", e_money: 0, direct_count: 0 },
  { id: "9999000002", full_name: "Ahmed Ali", email: "ahmed2@example.com", phone: "01000000005", referral_code: "EVR-555", avatar: null, rank: "Executive", role: "student", e_money: 0, direct_count: 0 },
  { id: "ADM-001", full_name: "Admin One", email: "admin1@example.com", phone: null, referral_code: null, avatar: null, rank: "Star", role: "admin", e_money: 0, direct_count: 0 },
  { id: "7777000001", full_name: "No Rank User", email: "norank@example.com", phone: "01000000006", referral_code: "EVR-666", avatar: null, rank: "", role: "student", e_money: 0, direct_count: 0 },
];

let leaders = [];
const excluded = new Set();

const likeToText = (pattern) => String(pattern).replace(/%/g, "").toLowerCase();

const query = async (sql, params = []) => {
  const p = params.map((v) => (v === undefined ? null : v));
  const s = sql.replace(/\s+/g, " ");

  if (s.includes("FROM users")) {
    if (s.includes("lower(trim(full_name)) = lower(?)")) {
      return users.filter((u) => u.full_name.trim().toLowerCase() === String(p[0]).trim().toLowerCase());
    }
    if (s.includes("lower(full_name) LIKE lower(?)")) {
      const needle = likeToText(p[0]);
      return users.filter((u) => u.full_name.toLowerCase().includes(needle));
    }
    if (s.includes("LIKE lower(?)") && s.includes("email")) {
      const needle = likeToText(p[0]);
      return users.filter((u) =>
        u.full_name.toLowerCase().includes(needle) ||
        String(u.email || "").toLowerCase().includes(needle) ||
        String(u.phone || "").includes(needle) ||
        u.id.includes(needle)
      );
    }
    return [];
  }
  return [];
};

const queryOne = async (sql, params = []) => {
  const p = params.map((v) => (v === undefined ? null : v));
  const s = sql.replace(/\s+/g, " ");

  if (s.includes("SELECT COUNT(*) as c FROM leaders")) return { c: leaders.length };
  if (s.includes("FROM leaders WHERE id = ?")) return leaders.find((l) => l.id === p[0]) || null;

  if (s.includes("FROM users")) {
    if (s.includes("WHERE id = ?")) return users.find((u) => u.id === p[0]) || null;
    if (s.includes("lower(trim(email)) = lower(?)"))
      return users.find((u) => String(u.email || "").toLowerCase() === String(p[0]).trim().toLowerCase()) || null;
    if (s.includes("trim(phone) = ?")) return users.find((u) => String(u.phone || "").trim() === String(p[0]).trim()) || null;
    if (s.includes("upper(trim(referral_code)) = upper(?)"))
      return users.find((u) => String(u.referral_code || "").toUpperCase() === String(p[0]).trim().toUpperCase()) || null;
  }
  return null;
};

const execute = async (sql, params = []) => {
  const p = params.map((v) => (v === undefined ? null : v));
  const s = sql.replace(/\s+/g, " ");
  if (s.startsWith("INSERT INTO leaders")) {
    leaders.push({ id: p[0], name: p[1], rank: p[2], avatar: p[3], icon: p[4] });
  } else if (s.startsWith("DELETE FROM leaders")) {
    leaders = leaders.filter((l) => l.id !== p[0]);
  } else if (s.startsWith("DELETE FROM excluded_leaders")) {
    excluded.delete(p[0]);
  } else if (s.includes("INSERT OR IGNORE INTO excluded_leaders")) {
    excluded.add(p[0]);
  }
};

mock.module("../db.js", {
  namedExports: { query, queryOne, execute },
  defaultExport: null,
});

mock.module("../middleware/sessionAuth.js", {
  namedExports: { adminAuth: async (req, res, next) => next() },
  defaultExport: null,
});

mock.module("../services/weeklySettlement.js", {
  namedExports: {
    getCurrentWeek: async () => ({ weekStart: "2026-10-16", weekEnd: "2026-10-22" }),
    refreshLeadersSnapshot: async () => leaders.length,
    LEADER_RANK_ICONS: { "Executive Star": "💎", Executive: "🚀", Star: "⭐" },
  },
  defaultExport: null,
});

const { default: router } = await import("./leaders.js");

let server;
let base;

before(async () => {
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/leaders", router);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const addLeader = (body) =>
  fetch(`${base}/api/leaders/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("add leader by full name (with the trailing space users have)", async () => {
  leaders = [];
  const r = await addLeader({ userId: "يوسف العزب" });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.id, "4698894723");
  assert.equal(body.rank, "Executive Star");
  assert.equal(body.icon, "💎");
});

test("add leader by email and by phone", async () => {
  leaders = [];
  let r = await addLeader({ userId: "saeid@example.com" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).id, "5151402190");

  leaders = [];
  r = await addLeader({ userId: "01000000003" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).id, "6502217958");
});

test("add leader by partial name when only one user matches", async () => {
  leaders = [];
  const r = await addLeader({ userId: "ashraf" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).id, "6502217958");
});

test("unknown input still returns 404 with a readable message", async () => {
  leaders = [];
  const r = await addLeader({ userId: "no such person at all" });
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.match(body.error, /مفيش مستخدم/);
  assert.equal(body.error_en, "User not found");
});

test("admin accounts are rejected with a clear message (not 'User not found')", async () => {
  leaders = [];
  const r = await addLeader({ userId: "ADM-001" });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.match(body.error, /إدارية/);
});

test("a name shared by two users asks to pick one and returns candidates", async () => {
  leaders = [];
  const r = await addLeader({ userId: "Ahmed Ali" });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.equal(body.candidates.length, 2);
  assert.deepEqual(body.candidates.map((c) => c.id).sort(), ["9999000001", "9999000002"]);
});

test("user without a rank is rejected", async () => {
  leaders = [];
  const r = await addLeader({ userId: "7777000001" });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /ليس لديه رتبة/);
});

test("adding a leader clears the excluded flag", async () => {
  leaders = [];
  excluded.add("6502217958");
  const r = await addLeader({ userId: "6502217958" });
  assert.equal(r.status, 200);
  assert.equal(excluded.has("6502217958"), false);
});

test("search returns users by name and skips admins", async () => {
  const r = await fetch(`${base}/api/leaders/search?q=ali`);
  assert.equal(r.status, 200);
  const rows = await r.json();
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((u) => u.id !== "ADM-001"));
  assert.ok(rows.every((u) => u.name === u.name.trim()));
});

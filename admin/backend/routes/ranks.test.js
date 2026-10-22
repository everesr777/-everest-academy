import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";

const dbRows = [
  { id: "r1", name: "Star", sales_required: 2, min_direct: 2, bonus: 0, weekly_bonus: 0, sort_order: 0, is_active: 1, image: null },
  { id: "r2", name: "Executive", sales_required: 6, min_direct: 6, bonus: 2500, weekly_bonus: 2500, sort_order: 1, is_active: 1, image: null },
  { id: "r3", name: "Hidden", sales_required: 10, min_direct: 10, bonus: 1, weekly_bonus: 1, sort_order: 2, is_active: 0, image: null },
];

mock.module("../db.js", {
  namedExports: {
    query: async (sql) => {
      if (sql.includes("FROM ranks")) {
        if (sql.includes("is_active = 1")) return dbRows.filter((r) => r.is_active === 1);
        return dbRows;
      }
      return [];
    },
    queryOne: async (sql, params = []) => {
      if (sql.includes("COALESCE(MAX(sort_order)")) return { m: 2 };
      if (sql.includes("FROM ranks WHERE id")) return dbRows.find((r) => r.id === params[0]) || null;
      return null;
    },
    execute: async () => {},
  },
  defaultExport: null,
});

// adminAuth mock: behaves like the real one (401 without admin headers, 403 for non-admin)
mock.module("../middleware/sessionAuth.js", {
  namedExports: {
    adminAuth: async (req, res, next) => {
      if (!req.headers["x-admin"]) return res.status(401).json({ error: "Unauthorized" });
      if (req.headers["x-admin"] !== "admin") return res.status(403).json({ error: "Admin access required" });
      return next();
    },
  },
  defaultExport: null,
});

const { default: router } = await import("./ranks.js");

let server;
let base;
before(async () => {
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/ranks", router);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function req(method, path, { body, admin } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (admin) headers["x-admin"] = admin;
  const r = await fetch(base + "/api/ranks" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

test("public list of active ranks stays public", async () => {
  const { status, data } = await req("GET", "/");
  assert.equal(status, 200);
  assert.equal(data.length, 2);
  assert.equal(data[0].name, "Star");
  assert.equal(data[1].name, "Executive");
});

test("?all=true requires admin", async () => {
  const anon = await req("GET", "/?all=true");
  assert.equal(anon.status, 401);

  const admin = await req("GET", "/?all=true", { admin: "admin" });
  assert.equal(admin.status, 200);
  assert.equal(admin.data.length, 3);
});

test("creating a rank requires admin", async () => {
  const anon = await req("POST", "/", { body: { name: "X", sales_required: 1, bonus: 1 } });
  assert.equal(anon.status, 401);

  const admin = await req("POST", "/", { body: { name: "X", sales_required: 1, bonus: 1 }, admin: "admin" });
  assert.equal(admin.status, 200);
});

test("editing a rank requires admin", async () => {
  const anon = await req("PUT", "/r2", { body: { sales_required: 99 } });
  assert.equal(anon.status, 401);

  const admin = await req("PUT", "/r2", { body: { sales_required: 99 }, admin: "admin" });
  assert.equal(admin.status, 200);
});

test("deleting a rank requires admin", async () => {
  const anon = await req("DELETE", "/r2");
  assert.equal(anon.status, 401);

  const admin = await req("DELETE", "/r2", { admin: "admin" });
  assert.equal(admin.status, 200);
});

test("bulk rank update requires admin", async () => {
  const anon = await req("POST", "/update");
  assert.equal(anon.status, 401);

  const admin = await req("POST", "/update", { admin: "admin" });
  assert.equal(admin.status, 200);
});

test("pay-sale requires admin", async () => {
  const anon = await req("POST", "/pay-sale", { body: { userId: "u1" } });
  assert.equal(anon.status, 401);

  const admin = await req("POST", "/pay-sale", { body: { userId: "u1" }, admin: "admin" });
  assert.equal(admin.status, 404); // reached the handler (mock db has no such user)
});

test("non-admin session is rejected on write routes", async () => {
  const { status } = await req("PUT", "/r2", { body: { bonus: 1 }, admin: "manager" });
  assert.equal(status, 403);
});

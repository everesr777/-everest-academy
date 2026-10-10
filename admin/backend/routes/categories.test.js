import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";

const dbRows = [];
const addRow = (row) => dbRows.push(row);

mock.module("../db.js", {
  namedExports: {
    query: async (sql, params = []) => {
      if (sql.includes("WHERE LOWER(name_ar)")) {
        return dbRows.filter((r) => r.name_ar.toLowerCase() === String(params[0]).toLowerCase());
      }
      if (sql.includes("FROM courses WHERE category_ar")) {
        return [{ cnt: 0 }];
      }
      return dbRows;
    },
    queryOne: async (sql, params = []) => {
      if (sql.includes("FROM courses WHERE category_ar")) {
        return { cnt: 0 };
      }
      if (sql.includes("SELECT * FROM categories WHERE id")) {
        return dbRows.find((r) => r.id === params[0]) || null;
      }
      return dbRows[0] || null;
    },
    execute: async (sql, params = []) => {
      if (sql.startsWith("INSERT INTO categories")) {
        addRow({ id: params[0], name_ar: params[1], name_en: params[2] });
      } else if (sql.startsWith("DELETE FROM categories")) {
        const idx = dbRows.findIndex((r) => r.id === params[0]);
        if (idx !== -1) dbRows.splice(idx, 1);
      }
    },
  },
  defaultExport: null,
});

const { default: router } = await import("./categories.js");

let server;
let base;
before(async () => {
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/categories", router);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function json(method, path, body) {
  const r = await fetch(base + "/api/categories" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

test("list categories returns seeded rows", async () => {
  addRow({ id: "c1", name_ar: "التداول", name_en: "Trading" });
  const { status, data } = await json("GET", "/");
  assert.equal(status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].name_ar, "التداول");
  assert.equal(data[0].course_count, 0);
});

test("create category adds a new row", async () => {
  const before = dbRows.length;
  const { status, data } = await json("POST", "/", { name_ar: "الفوركس", name_en: "Forex" });
  assert.equal(status, 200);
  assert.ok(data.id);
  assert.equal(data.name_ar, "الفوركس");
  assert.equal(data.name_en, "Forex");
  assert.equal(dbRows.length, before + 1);
});

test("create category rejects missing name_ar", async () => {
  const { status } = await json("POST", "/", { name_en: "X" });
  assert.equal(status, 400);
});

test("create category rejects duplicates", async () => {
  addRow({ id: "c2", name_ar: "التداول", name_en: "Trading" });
  const { status } = await json("POST", "/", { name_ar: "التداول" });
  assert.equal(status, 409);
});

test("delete category removes the row", async () => {
  addRow({ id: "c-del", name_ar: "للحذف", name_en: "DeleteMe" });
  const { status } = await json("DELETE", "/c-del");
  assert.equal(status, 200);
  assert.equal(dbRows.some((r) => r.id === "c-del"), false);
});
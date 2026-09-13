import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, normalizePassword, hexCodes } from "./loginSanitize.js";

test("email: trims spaces and lowercases", () => {
  assert.equal(normalizeEmail("   Admin@Everest.COM  "), "admin@everest.com");
});

test("email: strips internal spaces like mobile keyboards add (Gmail. Com)", () => {
  assert.equal(normalizeEmail("melad@Gmail. Com"), "melad@gmail.com");
});

test("email: strips invisible Unicode chars (ZWSP, bidi marks, NBSP, BOM)", () => {
  assert.equal(normalizeEmail("adm\u200bin@everest.com"), "admin@everest.com");
  assert.equal(normalizeEmail("adm\u200ein@everest.com"), "admin@everest.com");
  assert.equal(normalizeEmail("adm\u2060in@everest.com"), "admin@everest.com");
  assert.equal(normalizeEmail("admin@everest\u00a0.com"), "admin@everest.com");
  assert.equal(normalizeEmail("\ufeffadmin@everest.com"), "admin@everest.com");
  assert.equal(normalizeEmail("admin@everest.\u202bcom"), "admin@everest.com");
});

test("password: trims edges and strips invisible chars", () => {
  assert.equal(normalizePassword(" secret123 "), "secret123");
  assert.equal(normalizePassword("secret\u200b123"), "secret123");
  assert.equal(normalizePassword("secret\u00ad123"), "secret123");
  assert.equal(normalizePassword("\ufeffsecret123"), "secret123");
});

test("password: keeps internal real spaces intact", () => {
  assert.equal(normalizePassword("my pass word"), "my pass word");
});

test("hexCodes reveals invisible chars for logging", () => {
  assert.deepEqual(hexCodes("a\u200bb"), ["61", "200b", "62"]);
});
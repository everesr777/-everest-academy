import express from "express";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { adminAuth } from "../middleware/sessionAuth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM categories ORDER BY name_ar");
    const categories = [];
    for (const c of rows) {
      const usage = await queryOne("SELECT COUNT(*) as cnt FROM courses WHERE category_ar = ? OR category = ?", [c.name_ar, c.name_en || c.name_ar]);
      categories.push({ ...c, course_count: usage?.cnt || 0 });
    }
    res.json(categories);
  } catch (err) {
    console.error("Error listing categories:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", adminAuth, async (req, res) => {
  try {
    const { name_ar, name_en } = req.body || {};
    const ar = (name_ar || "").trim();
    const en = (name_en || "").trim() || ar;
    if (!ar) return res.status(400).json({ error: "name_ar is required" });
    const exists = await query("SELECT * FROM categories WHERE LOWER(name_ar) = LOWER(?)", [ar]);
    if (exists.length) return res.status(409).json({ error: "Category already exists", category: exists[0] });
    const id = uuidv4();
    await execute("INSERT INTO categories (id,name_ar,name_en) VALUES (?,?,?)", [id, ar, en]);
    const created = await queryOne("SELECT * FROM categories WHERE id = ?", [id]);
    res.json(created);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const cat = await queryOne("SELECT * FROM categories WHERE id = ?", [req.params.id]);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const usage = await queryOne("SELECT COUNT(*) as cnt FROM courses WHERE category_ar = ? OR category = ?", [cat.name_ar, cat.name_en || cat.name_ar]);
    if (usage?.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete: ${usage.cnt} course(s) use this category` });
    }
    await execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
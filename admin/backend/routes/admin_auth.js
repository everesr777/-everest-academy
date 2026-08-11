import express from "express";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

const router = express.Router();

const ADMIN_SEEDS = [
  { id: "admin-001", full_name: "Admin", email: "admin@everest.com", password: "admin123" },
  { id: "ADM-001", full_name: "Admin One", email: "admin1@everest.com", password: "admin123" },
  { id: "ADM-002", full_name: "Admin Two", email: "admin2@everest.com", password: "admin123" },
  { id: "ADM-003", full_name: "Admin Three", email: "admin3@everest.com", password: "admin123" },
  { id: "ADM-004", full_name: "Admin Four", email: "admin4@everest.com", password: "admin123" },
  { id: "ADM-005", full_name: "Admin Five", email: "admin5@everest.com", password: "admin123" },
  { id: "MGR-001", full_name: "Manager", email: "manager@everest.com", password: "manager123", role: "manager" },
];

export async function seedAdmins() {
  for (let i = 0; i < ADMIN_SEEDS.length; i++) {
    const a = ADMIN_SEEDS[i];
    const exists = await queryOne("SELECT id, password FROM users WHERE id = ?", [a.id]);
    const code = "EVR-ADM-" + String(i + 1).padStart(4, "0");
    const hashedPassword = await bcrypt.hash(a.password, 10);
    if (!exists) {
      await execute(
        "INSERT INTO users (id, full_name, email, password, role, referral_code, rank, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
        [a.id, a.full_name, a.email, hashedPassword, a.role || "admin", code, "Star"]
      );
    } else if (exists.password && !exists.password.startsWith("$2a$") && !exists.password.startsWith("$2b$")) {
      await execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, a.id]);
      console.log(`  🔑 Re-hashed password for admin ${a.id}`);
    }
  }
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await queryOne("SELECT * FROM users WHERE email = ? AND (role = 'admin' OR role = 'manager')", [email]);
  if (!user) return res.status(401).json({ error: "Invalid admin credentials" });
  let valid = await bcrypt.compare(password, user.password || "");
  // Legacy fallback: pre-bcrypt accounts stored the password as plaintext.
  if (!valid && user.password && !user.password.startsWith("$2") && user.password === password) {
    const hashed = await bcrypt.hash(user.password, 10);
    await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
    valid = true;
    console.log(`🔑 Re-hashed legacy plaintext admin password on login for ${user.email}`);
  }
  if (!valid) return res.status(401).json({ error: "Invalid admin credentials" });

  const session_token = uuidv4() + "-" + Date.now();
  // Append to existing tokens CSV (admin also supports multi-device)
  const existing = await queryOne("SELECT session_token FROM users WHERE id = ?", [user.id]);
  const tokens = (existing?.session_token || '').split(',').filter(Boolean);
  tokens.push(session_token);
  if (tokens.length > 2) tokens.shift(); // max 2
  await execute("UPDATE users SET session_token = ? WHERE id = ?", [tokens.join(','), user.id]);
  res.json({ user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, avatar: user.avatar }, session_token });
});

router.get("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const userRow = await queryOne("SELECT id, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (userRow?.session_token || '').split(',').filter(Boolean);
  if (!tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  const user = await queryOne("SELECT id, full_name, email, role, phone, address, bio, avatar, created_at FROM users WHERE id = ?", [userId]);
  if (!user) return res.status(401).json({ error: "Session expired" });
  if (user.role !== "admin" && user.role !== "manager") return res.status(403).json({ error: "Not an admin" });
  res.json(user);
});

router.put("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const user = await queryOne("SELECT id, role, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (user?.session_token || '').split(',').filter(Boolean);
  if (!user || !tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  if (user.role !== "admin" && user.role !== "manager") return res.status(403).json({ error: "Not an admin" });

  const { full_name, email, phone, address, bio, password } = req.body;
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await execute("UPDATE users SET full_name=?, email=?, phone=?, address=?, bio=?, password=?, updated_at=datetime('now','localtime') WHERE id=?",
      [full_name, email, phone || null, address || null, bio || null, hashedPassword, userId]);
  } else {
    await execute("UPDATE users SET full_name=?, email=?, phone=?, address=?, bio=?, updated_at=datetime('now','localtime') WHERE id=?",
      [full_name, email, phone || null, address || null, bio || null, userId]);
  }
  const updated = await queryOne("SELECT id, full_name, email, role, phone, address, bio, avatar, created_at FROM users WHERE id = ?", [userId]);
  res.json(updated);
});

router.get("/list", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const caller = await queryOne("SELECT role, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (caller?.session_token || '').split(',').filter(Boolean);
  if (!caller || !tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  if (caller.role !== "manager") return res.status(403).json({ error: "Only manager can manage admins" });

  const admins = await query("SELECT id, full_name, email, role, phone, address, bio, avatar, created_at FROM users WHERE role IN ('admin','manager') ORDER BY created_at DESC");
  res.json(admins);
});

router.post("/list", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const caller = await queryOne("SELECT role, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (caller?.session_token || '').split(',').filter(Boolean);
  if (!caller || !tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  if (caller.role !== "manager") return res.status(403).json({ error: "Only manager can manage admins" });

  const { id, full_name, email, password, role } = req.body;
  if (!id || !full_name || !email || !password) return res.status(400).json({ error: "All fields required" });

  const exists = await queryOne("SELECT id FROM users WHERE id = ? OR email = ?", [id, email]);
  if (exists) return res.status(400).json({ error: "ID or email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  await execute("INSERT INTO users (id, full_name, email, password, role, referral_code, rank, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
    [id, full_name, email, hashedPassword, role || "admin", "ADM-" + id.slice(-4), "Star"]);
  res.json({ success: true, id });
});

router.put("/list/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const caller = await queryOne("SELECT role, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (caller?.session_token || '').split(',').filter(Boolean);
  if (!caller || !tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  if (caller.role !== "manager") return res.status(403).json({ error: "Only manager can manage admins" });

  const { full_name, email, password, role } = req.body;
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await execute("UPDATE users SET full_name=?, email=?, password=?, role=?, updated_at=datetime('now','localtime') WHERE id=?",
      [full_name, email, hashedPassword, role, req.params.id]);
  } else {
    await execute("UPDATE users SET full_name=?, email=?, role=?, updated_at=datetime('now','localtime') WHERE id=?",
      [full_name, email, role, req.params.id]);
  }
  res.json({ success: true });
});

router.delete("/list/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const token = req.headers["x-session-token"];
  if (!userId || !token) return res.status(401).json({ error: "Not authenticated" });

  const caller = await queryOne("SELECT role, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (caller?.session_token || '').split(',').filter(Boolean);
  if (!caller || !tokens.includes(token)) return res.status(401).json({ error: "Session expired" });
  if (caller.role !== "manager") return res.status(403).json({ error: "Only manager can manage admins" });
  if (req.params.id === userId) return res.status(400).json({ error: "Cannot delete yourself" });

  await execute("DELETE FROM users WHERE id = ? AND role IN ('admin','manager')", [req.params.id]);
  res.json({ success: true });
});

export default router;

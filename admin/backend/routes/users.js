import express from "express";
import bcrypt from "bcryptjs";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { sendOTPEmail, sendRejectionEmail } from "../services/emailService.js";
import { adminAuth } from "../middleware/sessionAuth.js";
import { LEADER_RANK_ICONS } from "../services/weeklySettlement.js";

const router = express.Router();

async function generateUserId() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const id = "EVR-" + code;
    const existing = await queryOne("SELECT id FROM users WHERE id = ? OR referral_code = ?", [id, id]);
    if (!existing) return id;
  }
  throw new Error("Could not generate unique user ID");
}

const stripPassword = (u) => { if (u) delete u.password; return u; };

const logAdminAction = async (req, action, targetId, targetName, details) => {
  try {
    const adminName = req.headers["x-user-name"] || "Admin";
    const adminId = req.headers["x-admin-id"] || "unknown";
    const id = uuidv4();
    await execute(
      "INSERT INTO admin_logs (id, admin_id, admin_name, action, target_user_id, target_user_name, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, adminId, adminName, action, targetId || null, targetName || null, details || null]
    );
  } catch (e) {
    console.error("Failed to log admin action:", e.message);
  }
};

router.get("/", async (req, res) => {
  // `usd_balance` is the field name the user app renders (it has no `e_money`),
  // so every user payload exposes the same balance under both names.
  // Base64 avatars are stripped from the list: 147 of them added ~4.5 MB to this
  // response and made the user-management page take many seconds to open. The
  // full avatar is still returned by GET /api/users/:id.
  const users = await query(`SELECT id, full_name, email, phone, address, role, account_type, referral_code, rank,
    e_money, e_money AS usd_balance, academic_points, total_team_sales, direct_count, qualified_direct_count,
    negative_allowed, commission_exempt, blocked, status,
    CASE WHEN avatar LIKE 'data:%' THEN NULL ELSE avatar END AS avatar,
    created_at FROM users ORDER BY created_at DESC`);
  res.json(users);
});

// Pending registration approvals (must be before /:id)
router.get("/pending-registrations", async (req, res) => {
  try {
    const { source } = req.query;
    let sourceFilter = "";
    if (source === "external") sourceFilter = "AND u.created_by_user IS NULL";
    else if (source === "created") sourceFilter = "AND u.created_by_user IS NOT NULL";
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.referral_code, u.referred_by, u.created_by_user, u.created_at,
             u.governorate, u.country,
             c.full_name as creator_name, c.email as creator_email,
             r.full_name as referrer_name, r.email as referrer_email
      FROM users u
      LEFT JOIN users c ON u.created_by_user = c.id
      LEFT JOIN users r ON u.referred_by = r.id
      WHERE u.status = 'pending' ${sourceFilter}
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (e) {
    console.error("pending-registrations error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Approved accounts from external sign-up (no creator) — must be before /:id
router.get("/external-accounts", async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.governorate, u.country, u.role, u.account_type, u.referral_code,
             u.rank, u.e_money, u.status, u.blocked, u.created_at,
             r.full_name as referrer_name, r.email as referrer_email
      FROM users u
      LEFT JOIN users r ON u.referred_by = r.id
      WHERE u.role NOT IN ('admin','manager') AND u.created_by_user IS NULL AND u.status = 'active'
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (e) {
    console.error("external-accounts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Approved accounts created via "Create Account for Another User" — must be before /:id
router.get("/created-accounts", async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.governorate, u.country, u.role, u.account_type, u.referral_code,
             u.rank, u.e_money, u.status, u.blocked, u.created_at, u.created_by_user,
             c.full_name as creator_name, c.email as creator_email
      FROM users u
      LEFT JOIN users c ON u.created_by_user = c.id
      WHERE u.role NOT IN ('admin','manager') AND u.created_by_user IS NOT NULL AND u.status = 'active'
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (e) {
    console.error("created-accounts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get("/:id/id-cards", async (req, res) => {
  try {
    const user = await queryOne("SELECT id_card_front, id_card_back FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id/id-cards", async (req, res) => {
  try {
    const { id_card_front, id_card_back } = req.body;
    if (id_card_front !== undefined) {
      await execute("UPDATE users SET id_card_front = ? WHERE id = ?", [id_card_front, req.params.id]);
    }
    if (id_card_back !== undefined) {
      await execute("UPDATE users SET id_card_back = ? WHERE id = ?", [id_card_back, req.params.id]);
    }
    const updated = await queryOne("SELECT id_card_front, id_card_back FROM users WHERE id = ?", [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  const user = await queryOne("SELECT id, full_name, email, phone, address, role, account_type, referral_code, referred_by, created_by_user, rank, e_money, e_money AS usd_balance, academic_points, total_team_sales, direct_count, qualified_direct_count, negative_allowed, commission_exempt, blocked, status, bio, avatar, governorate, country, created_at, membership_expires_at FROM users WHERE id = ?", [req.params.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  const realDirects = await queryOne("SELECT COUNT(*) as cnt FROM users WHERE referred_by = ? OR (created_by_user = ? AND referred_by IS NULL)", [req.params.id, req.params.id]);
  user.direct_count = realDirects?.cnt || 0;
  // Sponsor: the person who registered this user — by referral code, or an admin/manager who created the account internally
  let sponsor = null;
  if (user.referred_by) {
    const s = await queryOne("SELECT id, full_name, email, phone, avatar, rank, account_type, referral_code, status, governorate, country FROM users WHERE id = ?", [user.referred_by]);
    if (s) { sponsor = { ...s, source: "code" }; }
  }
  if (!sponsor && user.created_by_user) {
    const s = await queryOne("SELECT id, full_name, email, phone, avatar, rank, account_type, referral_code, status, governorate, country FROM users WHERE id = ?", [user.created_by_user]);
    if (s) { sponsor = { ...s, source: "created" }; }
  }
  user.sponsor = sponsor;
  const teamLevels = await query(`
    SELECT u.id, u.referral_code, u.full_name, u.email, u.role, u.rank, u.e_money, u.created_at, uc.depth
    FROM user_closure uc
    JOIN users u ON u.id = uc.descendant
    WHERE uc.ancestor = ?
    ORDER BY uc.depth ASC, u.created_at DESC
  `, [req.params.id]);
  const rankBonuses = await query("SELECT * FROM rank_bonuses WHERE user_id = ? ORDER BY created_at DESC", [req.params.id]);
  res.json({ ...user, teamLevels, rankBonuses });
});

router.put("/:id", async (req, res) => {
  const fields = [];
  const vals = [];
  for (const key of ["full_name","email","phone","address","role","bio","avatar"]) {
    if (req.body[key] !== undefined) { fields.push(`${key}=?`); vals.push(req.body[key]); }
  }
  if (req.body.password) {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    fields.push("password=?");
    vals.push(hashedPassword);
  }
  if (fields.length === 0) return res.json(stripPassword(await queryOne("SELECT * FROM users WHERE id=?", [req.params.id])));
  fields.push("updated_at=datetime('now','localtime')");
  vals.push(req.params.id);
  await execute(`UPDATE users SET ${fields.join(",")} WHERE id=?`, vals);
  const user = await queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
  res.json(stripPassword(user));
});

router.put("/:id/role", async (req, res) => {
  const { role } = req.body;
  await execute("UPDATE users SET role=?, updated_at=datetime('now','localtime') WHERE id=?", [role, req.params.id]);
  res.json({ success: true });
});

// Manual balance adjustment (deposit / withdraw).
// The `id` comes from req.params.id, or req.params[0] when hit through the
// legacy regex alias below.
const adjustEMoney = async (req, res) => {
  const userId = req.params.id || req.params[0];
  const { amount, allow_negative } = req.body;
  const user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return res.status(404).json({ error: "User not found" });

  const newBalance = (user.e_money || 0) + amount;
  if (newBalance < 0 && !user.negative_allowed && !allow_negative)
    return res.status(400).json({ error: `Cannot go negative. Current balance: ${user.e_money}. Enable negative balance first.` });

  await execute("UPDATE users SET e_money = e_money + ?, updated_at=datetime('now','localtime') WHERE id=?", [amount, userId]);
  const tid = uuidv4();
  const type = amount >= 0 ? "credit" : "debit";
  await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')",
    [tid, userId, Math.abs(amount), type, "Manual adjustment by admin"]);
  await logAdminAction(req, `e-money ${type}`, userId, user.full_name, `${Math.abs(amount)} E-Money`);

  const nid = uuidv4();
  if (amount >= 0) {
    await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'wallet')",
      [nid, userId, "💰 إضافة رصيد", `تم إضافة ${Math.abs(amount)} E-Money إلى حسابك من الإدارة`]);
  } else {
    await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'wallet')",
      [nid, userId, "💸 خصم رصيد", `تم خصم ${Math.abs(amount)} E-Money من حسابك من الإدارة`]);
  }
  const updated = await queryOne("SELECT id, full_name, email, e_money, negative_allowed FROM users WHERE id = ?", [userId]);
  res.json(updated);
};

router.put("/:id/e-money", adjustEMoney);
// Legacy alias: the older admin bundle still hosted on the main domain calls
// `PUT /api/users/:id/$` (a `$` that used to interpolate the amount). Without
// this alias the deposit/withdraw action fails with 404.
router.put(/^\/([^/]+)\/\$$/, adjustEMoney);

// ─── Manual rank change ───
// Body: { rank: "Executive Star", apply_bonus: "pay" | "deduct" | "none" }
//  • promotion   → "pay"    adds the new rank's bonus to the wallet
//  • demotion    → "deduct" takes back the rank bonus (never below 0)
// The admin panel always asks the admin first, so this endpoint only executes
// the decision it receives.
router.put("/:id/rank", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { rank } = req.body || {};
    const applyBonus = ["pay", "deduct", "none"].includes(req.body?.apply_bonus) ? req.body.apply_bonus : "none";

    if (!rank) return res.status(400).json({ error: "الرتبة مطلوبة", error_en: "rank is required" });

    const target = await queryOne("SELECT * FROM ranks WHERE name = ? AND is_active = 1", [rank]);
    if (!target) return res.status(400).json({ error: "الرتبة غير موجودة", error_en: "Unknown rank" });

    const user = await queryOne("SELECT id, full_name, rank, e_money FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود", error_en: "User not found" });

    const oldRank = user.rank || "";
    if (oldRank === rank) {
      return res.json({ success: true, unchanged: true, rank, old_rank: oldRank, bonus_applied: 0 });
    }

    const current = oldRank ? await queryOne("SELECT * FROM ranks WHERE name = ?", [oldRank]) : null;
    const oldOrder = current ? Number(current.sort_order) : -1;
    const newOrder = Number(target.sort_order);
    const direction = newOrder >= oldOrder ? "up" : "down";
    const newBonus = Number(target.weekly_bonus ?? target.bonus ?? 0) || 0;
    const oldBonus = current ? (Number(current.weekly_bonus ?? current.bonus ?? 0) || 0) : 0;

    let balanceChange = 0;
    let moneyNote = "";

    if (direction === "up" && applyBonus === "pay" && newBonus > 0) {
      balanceChange = newBonus;
      moneyNote = `تم صرف كوميشن رتبة ${rank} (${newBonus})`;
    } else if (direction === "down" && applyBonus === "deduct" && oldBonus > 0) {
      const balance = Number(user.e_money) || 0;
      const deduct = Math.min(Math.max(balance, 0), oldBonus);
      if (deduct > 0) {
        balanceChange = -deduct;
        moneyNote = `تم خصم مبلغ رتبة ${oldRank} (${deduct})`;
      }
    }

    await execute("UPDATE users SET rank = ?, updated_at = datetime('now','localtime') WHERE id = ?", [rank, userId]);

    if (balanceChange !== 0) {
      await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [balanceChange, userId]);
      await execute(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')",
        [uuidv4(), userId, Math.abs(balanceChange), balanceChange > 0 ? "credit" : "debit", `تغيير الرتبة يدويًا: ${oldRank || "—"} → ${rank}`]
      );
      if (balanceChange > 0) {
        await execute("INSERT INTO rank_bonuses (id, user_id, rank_name, amount) VALUES (?, ?, ?, ?)",
          [uuidv4(), userId, rank, balanceChange]);
      }
      await execute(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')",
        [uuidv4(), userId,
          balanceChange > 0 ? "🎉 ترقية ورتبة جديدة" : "🔄 تحديث الرتبة",
          balanceChange > 0
            ? `تمت ترقيتك إلى ${rank} وتمت إضافة ${balanceChange} $ إلى رصيدك`
            : `تم تغيير رتبتك إلى ${rank} وتم خصم ${Math.abs(balanceChange)} $ من رصيدك`]
      );
    } else {
      await execute(
        "INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'info')",
        [uuidv4(), userId, "🔄 تحديث الرتبة", `تم تغيير رتبتك من ${oldRank || "—"} إلى ${rank}`]
      );
    }

    // Keep the homepage leaders snapshot in sync: Star members are not eligible.
    const leaderRow = await queryOne("SELECT id FROM leaders WHERE id = ?", [userId]);
    if (leaderRow) {
      if (rank === "Star") await execute("DELETE FROM leaders WHERE id = ?", [userId]);
      else await execute("UPDATE leaders SET rank = ?, icon = ? WHERE id = ?", [rank, LEADER_RANK_ICONS[rank] || "🏆", userId]);
    }

    await logAdminAction(req, "rank change", userId, user.full_name,
      `${oldRank || "—"} -> ${rank} | ${moneyNote || "بدون حركة مالية"}`);

    const updated = await queryOne(
      "SELECT id, full_name, email, rank, e_money, e_money AS usd_balance FROM users WHERE id = ?", [userId]);
    res.json({ success: true, ...updated, direction, old_rank: oldRank, bonus_applied: balanceChange });
  } catch (err) {
    console.error("Rank change error:", err);
    res.status(500).json({ error: err.message, error_en: err.message });
  }
});

// Toggle negative balance permission
router.put("/:id/negative-toggle", async (req, res) => {
  const user = await queryOne("SELECT id, negative_allowed FROM users WHERE id = ?", [req.params.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  const newVal = user.negative_allowed ? 0 : 1;
  await execute("UPDATE users SET negative_allowed = ?, updated_at=datetime('now','localtime') WHERE id=?", [newVal, req.params.id]);
  res.json({ success: true, negative_allowed: !!newVal });
});

// Toggle weekly-commission exemption (staff/executive accounts keep ranking up but are not paid)
router.put("/:id/commission-exempt-toggle", async (req, res) => {
  const user = await queryOne("SELECT id, full_name, commission_exempt FROM users WHERE id = ?", [req.params.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  const newVal = Number(user.commission_exempt) === 1 ? 0 : 1;
  await execute("UPDATE users SET commission_exempt = ?, updated_at=datetime('now','localtime') WHERE id=?", [newVal, req.params.id]);
  await logAdminAction(req, newVal ? "disable weekly commission" : "enable weekly commission", req.params.id, user.full_name, null);
  res.json({ success: true, commission_exempt: !!newVal });
});

router.get("/filter/:role", async (req, res) => {
  const role = req.params.role === "all" ? "%" : req.params.role;
  const users = await query("SELECT id, full_name, email, role, rank, e_money, blocked, created_at FROM users WHERE role LIKE ? ORDER BY created_at DESC", [role]);
  res.json(users);
});

router.put("/:id/block", async (req, res) => {
  const user = await queryOne("SELECT id, full_name FROM users WHERE id = ?", [req.params.id]);
  await execute("UPDATE users SET blocked = 1, updated_at = datetime('now','localtime') WHERE id = ?", [req.params.id]);
  await logAdminAction(req, "block", req.params.id, user?.full_name, null);
  res.json({ success: true, blocked: true });
});

router.put("/:id/unblock", async (req, res) => {
  const user = await queryOne("SELECT id, full_name FROM users WHERE id = ?", [req.params.id]);
  await execute("UPDATE users SET blocked = 0, updated_at = datetime('now','localtime') WHERE id = ?", [req.params.id]);
  await logAdminAction(req, "unblock", req.params.id, user?.full_name, null);
  res.json({ success: true, blocked: false });
});

router.delete("/:id", async (req, res) => {
  try {
    const user = await queryOne("SELECT id FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    // Delete related records first to avoid FK issues
    await execute("DELETE FROM enrollments WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM commissions WHERE from_user_id = ? OR to_user_id = ?", [req.params.id, req.params.id]);
    await execute("DELETE FROM wallet_transactions WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM notifications WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM quiz_attempts WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM upgrade_requests WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM top_up_requests WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM feedbacks WHERE user_id = ?", [req.params.id]);
    await execute("UPDATE users SET referred_by = NULL WHERE referred_by = ?", [req.params.id]);
    await execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Pay the one-time student-approval commissions (referrer + creator).
// Used on initial approval AND on any later registration_free → student
// upgrade, so an account approved as free by mistake still rewards its
// sponsor once it becomes a student. Dedup checks prevent double payment.
async function awardStudentCommissions(user) {
  if (!user || user.account_type !== "student" || user.status !== "active") return;
  const commRow = await queryOne("SELECT value FROM settings WHERE key = 'referral_commission'");
  const COMMISSION = parseInt(commRow?.value) || 1000;

  // Commission to the direct referrer ONLY (Level 1)
  if (user.referred_by) {
    const directReferrer = await queryOne("SELECT id, account_type, commission_exempt FROM users WHERE id = ?", [user.referred_by]);
    if (directReferrer && directReferrer.account_type === "student" && Number(directReferrer.commission_exempt) !== 1) {
      const existingCommission = await queryOne("SELECT id FROM commissions WHERE from_user_id = ? AND level = 1 AND description IS NULL", [user.id]);
      if (!existingCommission) {
        const comId = uuidv4();
        await execute("INSERT INTO commissions (id, from_user_id, to_user_id, level, amount) VALUES (?, ?, ?, 1, ?)",
          [comId, user.id, directReferrer.id, COMMISSION]);
        await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [COMMISSION, directReferrer.id]);
        await execute("UPDATE users SET direct_count = direct_count + 1 WHERE id = ?", [directReferrer.id]);
        const nid2 = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'commission')", [nid2, directReferrer.id, "💰 عمولة جديدة", `ربحت ${COMMISSION} E-Money كمكافأة عن تسجيل عضو جديد`]);
      }
    }
  }

  // Commission to the creator (created-for-others flow)
  if (user.created_by_user) {
    const creatorUser = await queryOne("SELECT id, account_type, commission_exempt FROM users WHERE id = ?", [user.created_by_user]);
    if (creatorUser && Number(creatorUser.commission_exempt) !== 1) {
      const existingCreatorComm = await queryOne("SELECT id FROM commissions WHERE from_user_id = ? AND description LIKE 'create-account%'", [user.id]);
      if (!existingCreatorComm) {
        const comId = uuidv4();
        await execute("INSERT INTO commissions (id, from_user_id, to_user_id, level, amount, description) VALUES (?, ?, ?, 1, ?, 'create-account')", [comId, user.id, creatorUser.id, COMMISSION]);
        await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [COMMISSION, creatorUser.id]);
        await execute("UPDATE users SET direct_count = direct_count + 1 WHERE id = ?", [creatorUser.id]);
        const nid3 = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'commission')", [nid3, creatorUser.id, "💰 عمولة إنشاء حساب", `ربحت ${COMMISSION} E-Money كمكافأة عن تفعيل حساب أنشأته لـ ${user.full_name}`]);
      }
    }
  }
}

router.put("/:id/approve-registration", async (req, res) => {
  try {
    const user = await queryOne("SELECT id, full_name, email, status, referred_by, created_by_user FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.status !== 'pending') return res.status(400).json({ error: "User is not pending" });
    const accountType = req.body.account_type || "student";
    console.log("[approve-registration] userId:", req.params.id, "body:", JSON.stringify(req.body), "accountType:", accountType);
    if (!["student","registration_free"].includes(accountType)) return res.status(400).json({ error: "Invalid account_type" });

    // Determine role from account_type
    const role = accountType === "student" ? "student" : "registration";

    // Activate membership based on admin setting
    const durationRow = await queryOne("SELECT value FROM settings WHERE key = 'membership_duration'");
    const days = parseInt(durationRow?.value) || 183;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresStr = expires.toISOString().slice(0, 19).replace("T", " ");

    await execute("UPDATE users SET status = 'active', role = ?, account_type = ?, membership_expires_at = ?, updated_at = datetime('now','localtime') WHERE id = ?", [role, accountType, expiresStr, req.params.id]);
    console.log("[approve-registration] Updated:", req.params.id, "role:", role, "account_type:", accountType);

    // Pay one-time approval commissions to referrer/creator (students only)
    if (accountType === "student") {
      const approved = await queryOne("SELECT id, full_name, status, account_type, referred_by, created_by_user FROM users WHERE id = ?", [req.params.id]);
      await awardStudentCommissions(approved);
    }

    await logAdminAction(req, `approve as ${accountType} (membership ${days}d)`, req.params.id, user.full_name, null);
    res.json({ success: true, account_type: accountType, role, membership_expires_at: expiresStr, days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id/reject-registration", async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await queryOne("SELECT id, full_name, email, created_by_user FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Refund E-Money to the creator if this was a created account
    if (user.created_by_user) {
      const costRow = await queryOne("SELECT value FROM settings WHERE key = 'create_account_cost'");
      const COST = parseInt(costRow?.value) || 5500;
      await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [COST, user.created_by_user]);
      const tid = uuidv4();
      await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')",
        [tid, user.created_by_user, COST, "refund", `استرداد مصاريف إنشاء حساب ${user.full_name} (تم الرفض)`]);
      const nid = uuidv4();
      await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'wallet')",
        [nid, user.created_by_user, "💰 استرداد", `تم استرداد ${COST} E-Money بسبب رفض حساب ${user.full_name}`]);
    }

    // Send rejection email before deleting
    if (reason) {
      try {
        await sendRejectionEmail(user.email, user.full_name, reason);
      } catch (emailErr) {
        console.error("Rejection email failed:", emailErr.message);
      }
    }

    await execute("DELETE FROM user_closure WHERE descendant = ? OR ancestor = ?", [req.params.id, req.params.id]);
    await execute("DELETE FROM notifications WHERE user_id = ?", [req.params.id]);
    await execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true, email_sent: !!reason });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upgrade requests
router.post("/upgrade-request", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object") return res.status(400).json({ error: "Invalid request body" });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.account_type === "student") return res.status(400).json({ error: "Already a student account" });
    const existing = await queryOne("SELECT id FROM upgrade_requests WHERE user_id = ? AND status = 'pending'", [userId]);
    if (existing) return res.status(400).json({ error: "لديك طلب ترقية معلق بالفعل" });
    const id = uuidv4();
    await execute("INSERT INTO upgrade_requests (id, user_id, status) VALUES (?, ?, 'pending')", [id, userId]);
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/upgrade-requests/list", async (req, res) => {
  const requests = await query(`
    SELECT r.*, u.full_name, u.email, u.phone, u.created_at as user_since
    FROM upgrade_requests r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.created_at DESC
  `);
  res.json(requests);
});

router.put("/upgrade-requests/:id/approve", async (req, res) => {
  try {
    const req2 = await queryOne("SELECT * FROM upgrade_requests WHERE id = ?", [req.params.id]);
    if (!req2) return res.status(404).json({ error: "Request not found" });
    await execute("UPDATE upgrade_requests SET status = 'approved', reviewed_at = datetime('now','localtime') WHERE id = ?", [req.params.id]);
    await execute("UPDATE users SET role = 'student', account_type = 'student', status = 'active', updated_at = datetime('now','localtime') WHERE id = ?", [req2.user_id]);
    // Upgraded registration_free → student now counts for rank AND pays the
    // one-time commissions (same as a normal student approval).
    const upgraded = await queryOne("SELECT id, full_name, status, account_type, referred_by, created_by_user FROM users WHERE id = ?", [req2.user_id]);
    await awardStudentCommissions(upgraded);
    const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')", [nid, req2.user_id, "🎓 تم ترقية الحساب", "تم ترقية حسابك إلى Student Account! يمكنك الآن شراء الكورسات"]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/upgrade-requests/:id/reject", async (req, res) => {
  try {
    const req2 = await queryOne("SELECT * FROM upgrade_requests WHERE id = ?", [req.params.id]);
    if (!req2) return res.status(404).json({ error: "Request not found" });
    await execute("UPDATE upgrade_requests SET status = 'rejected', reviewed_at = datetime('now','localtime') WHERE id = ?", [req.params.id]);
    const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'error')", [nid, req2.user_id, "❌ تم رفض طلب الترقية", "نأسف، تم رفض طلب ترقية حسابك"]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Direct upgrade: registration → student (free, no admin approval needed)
router.post("/:id/upgrade-account", async (req, res) => {
  try {
    const user = await queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
  if (user.account_type === "student") return res.status(400).json({ error: "Already a student account" });
  await execute("UPDATE users SET role = 'student', account_type = 'student', status = 'active', updated_at = datetime('now','localtime') WHERE id = ?", [req.params.id]);
  // Self-upgrade registration_free → student: counts for rank AND pays the
  // one-time commissions (same as a normal student approval).
  const upgraded = await queryOne("SELECT id, full_name, status, account_type, referred_by, created_by_user FROM users WHERE id = ?", [req.params.id]);
  await awardStudentCommissions(upgraded);
  const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')", [nid, req.params.id, "🎓 تم ترقية الحساب", "تم ترقية حسابك إلى Student Account! يمكنك الآن شراء الكورسات والمشاركة في نظام الرتب والعمولات والتسويق."]);
    await logAdminAction(req, `self-upgrade to student`, req.params.id, user.full_name, null);
    res.json({ success: true, account_type: "student" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: change account type
router.put("/:id/account-type", async (req, res) => {
  try {
    console.log("[account-type] userId:", req.params.id, "body:", JSON.stringify(req.body), "account_type:", req.body?.account_type);
    const user = await queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { account_type } = req.body;
    if (!["student","registration_free"].includes(account_type)) return res.status(400).json({ error: "Invalid account_type" });
    const role = account_type === "student" ? "student" : "registration";
    await execute("UPDATE users SET role = ?, account_type = ?, updated_at = datetime('now','localtime') WHERE id = ?", [role, account_type, req.params.id]);
    const typeLabel = account_type === "student" ? "Student" : "Registration Free";
    // No notification sent when admin changes account type
    await logAdminAction(req, `change account_type to ${account_type}`, req.params.id, user.full_name, JSON.stringify({ from: user.account_type, to: account_type }));

    // Admin fixing a wrong registration_free approval by switching to student:
    // pay the one-time commissions and let it count for rank like any student.
    if (account_type === "student" && user.account_type !== "student") {
      const changed = await queryOne("SELECT id, full_name, status, account_type, referred_by, created_by_user FROM users WHERE id = ?", [req.params.id]);
      await awardStudentCommissions(changed);
    }

    res.json({ success: true, account_type, role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Renew membership (sets membership_expires_at based on admin setting)
router.post("/:id/renew-membership", async (req, res) => {
  try {
    const user = await queryOne("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    const durationRow = await queryOne("SELECT value FROM settings WHERE key = 'membership_duration'");
    const days = parseInt(durationRow?.value) || 183;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    const expiresStr = expires.toISOString().slice(0, 19).replace("T", " ");
    await execute("UPDATE users SET membership_expires_at = ?, blocked = 0, updated_at = datetime('now','localtime') WHERE id = ?", [expiresStr, req.params.id]);
    res.json({ success: true, membership_expires_at: expiresStr, days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create account for another user (costs 5500 E-Money)
router.post("/create-for-others", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const sessionToken = req.headers["x-session-token"];
    if (!userId || !sessionToken) return res.status(401).json({ error: "Unauthorized" });
    const creator = await queryOne("SELECT id, session_token, e_money, full_name FROM users WHERE id = ?", [userId]);
    const tokens = (creator?.session_token || '').split(',').filter(Boolean);
    if (!creator || !tokens.includes(sessionToken)) return res.status(401).json({ error: "Session invalid" });

    const costRow = await queryOne("SELECT value FROM settings WHERE key = 'create_account_cost'");
    const COST = parseInt(costRow?.value) || 5500;
    if ((creator.e_money || 0) < COST) {
      return res.status(400).json({ error: `Insufficient E-Money. Required: ${COST}, Available: ${creator.e_money || 0}`, error_ar: `رصيد E-Money غير كافٍ. المطلوب: ${COST}، المتاح: ${creator.e_money || 0}` });
    }

    const { full_name, email, phone, password, governorate, country, address, id_card, id_card_front, id_card_back } = req.body;
    const cleanEmail = String(email || "").trim().replace(/\s+/g, "");
    const singleIdCard = id_card || id_card_front || null;
    if (!full_name || !cleanEmail || !phone || !password) {
      return res.status(400).json({ error: "Full name, email, phone and password are required" });
    }

    const existing = await queryOne("SELECT id FROM users WHERE email = ? AND status != 'rejected'", [cleanEmail]);
    if (existing) return res.status(400).json({ error: "Email already exists" });
    const existingPhone = await queryOne("SELECT id FROM users WHERE phone = ? AND status != 'rejected'", [phone]);
    if (existingPhone) return res.status(400).json({ error: "Phone number is already registered", error_ar: "رقم الهاتف مسجل بالفعل" });

    const id = await generateUserId();
    const code = id;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user as pending — creator is tracked via created_by_user, NOT referred_by (prevents double commission)
    await execute(
      "INSERT INTO users (id, full_name, email, phone, address, password, referral_code, referred_by, status, role, account_type, rank, governorate, country, id_card_front, id_card_back, created_by_user, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'registration', 'registration_free', '', ?, ?, ?, ?, ?, 0)",
      [id, full_name, cleanEmail, phone, address || null, hashedPassword, code, null, governorate || null, country || null, singleIdCard, singleIdCard, userId]
    );

    // Populate closure table
    await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 0)", [id, id]);
    const ancestors = await query("SELECT ancestor, depth FROM user_closure WHERE descendant = ? AND ancestor != descendant", [userId]);
    for (const a of ancestors) {
      await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, ?)", [a.ancestor, id, a.depth + 1]);
    }
    await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 1)", [userId, id]);

    // Deduct 5500 E-Money
    await execute("UPDATE users SET e_money = e_money - ? WHERE id = ?", [COST, userId]);
    const tid = uuidv4();
    await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, ?, ?, 'completed')",
      [tid, userId, COST, "debit", `إنشاء حساب لـ ${full_name}`]);

    // Send verification OTP to the new user
    try {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await execute("UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?", [otp, expires, id]);
      await sendOTPEmail(email, otp, full_name, "email_verification");
    } catch (emailErr) {
      console.error("Create-for-others verification email failed:", emailErr.message);
    }

    const newProfile = await queryOne("SELECT id, full_name, email, phone, governorate, status, created_at FROM users WHERE id = ?", [id]);
    const updatedCreator = await queryOne("SELECT id, e_money FROM users WHERE id = ?", [userId]);
    res.json({ success: true, user: newProfile, creator_balance: updatedCreator.e_money });
  } catch (err) {
    console.error("Create-for-others error:", err);
    res.status(500).json({ error: err.message });
  }
});

// List users created by a specific user
router.get("/created-by-me/:userId", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const sessionToken = req.headers["x-session-token"];
    if (!userId || !sessionToken) return res.status(401).json({ error: "Unauthorized" });
    const requester = await queryOne("SELECT id, session_token FROM users WHERE id = ?", [userId]);
    const tokens = (requester?.session_token || '').split(',').filter(Boolean);
    if (!requester || !tokens.includes(sessionToken)) return res.status(401).json({ error: "Session invalid" });

    const users = await query(
      "SELECT id, full_name, email, phone, governorate, country, status, account_type, created_at FROM users WHERE created_by_user = ? ORDER BY created_at DESC",
      [req.params.userId]
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin impersonation: generate a valid session for a user (login as this user)
router.post("/:id/impersonate", adminAuth, async (req, res) => {
  try {
    const target = await queryOne("SELECT id, full_name, email, status, blocked, role FROM users WHERE id = ?", [req.params.id]);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "admin") return res.status(403).json({ error: "Cannot impersonate an admin account" });

    const session_token = uuidv4() + "-" + Date.now();
    const now = new Date().toISOString();

    // Clean stale sessions (same logic as login)
    await execute("DELETE FROM user_sessions WHERE user_id = ? AND (last_heartbeat IS NULL OR datetime(last_heartbeat) < datetime('now', '-15 seconds'))", [target.id]);
    await execute(
      "INSERT INTO user_sessions (id, user_id, session_token, device_type, device_info, last_heartbeat) VALUES (?, ?, ?, ?, ?, ?)",
      [uuidv4(), target.id, session_token, "desktop", "Admin impersonation", now]
    );
    const allSessions = await query("SELECT session_token FROM user_sessions WHERE user_id = ?", [target.id]);
    const tokensCsv = allSessions.map(s => s.session_token).join(',');
    await execute("UPDATE users SET session_token = ? WHERE id = ?", [tokensCsv, target.id]);

    await logAdminAction(req, "login-as-user", target.id, target.full_name, `Impersonated login for ${target.email}`);

    res.json({ success: true, user_id: target.id, session_token });
  } catch (e) {
    console.error("Impersonate error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;

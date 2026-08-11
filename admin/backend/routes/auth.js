import express from "express";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { sendOTPEmail, sendActivationFollowUpEmail } from "../services/emailService.js";

const router = express.Router();

// Rate-limited resend endpoint (stored in memory)
const resendTimers = {};
function checkResendLimit(email) {
  const now = Date.now();
  const last = resendTimers[email] || 0;
  if (now - last < 120000) return false; // 2 minutes
  resendTimers[email] = now;
  return true;
}

function detectDeviceType(ua) {
  if (!ua) return "desktop";
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua);
  return mobile ? "mobile" : "desktop";
}

async function generateUserId() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const id = "EVR-" + code;
    const existing = await queryOne("SELECT id FROM users WHERE id = ? OR referral_code = ?", [id, id]);
    if (!existing) return id;
  }
  throw new Error("Could not generate unique user ID");
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await queryOne("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  let valid = await bcrypt.compare(password, user.password || "");
  // Legacy fallback: pre-bcrypt accounts stored the password as plaintext.
  // If it matches exactly, re-hash it so bcrypt works from now on.
  if (!valid && user.password && !user.password.startsWith("$2") && user.password === password) {
    const hashed = await bcrypt.hash(user.password, 10);
    await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
    valid = true;
    console.log(`🔑 Re-hashed legacy plaintext password on login for ${user.email}`);
  }
  if (!valid) {
    console.log(`🔑 LOGIN_FAIL email=${email} storedPrefix=${(user.password || "").slice(0, 7)} storedLen=${(user.password || "").length} isBcrypt=${(user.password || "").startsWith("$2")}`);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.blocked) return res.status(403).json({ error: "تم حظر حسابك. يرجى التواصل مع الإدارة." });
  if (user.status === 'pending') return res.status(403).json({ error: "حسابك قيد المراجعة. يرجى الانتظار حتى يتم تفعيله من الإدارة." });
  const deviceType = detectDeviceType(req.headers["user-agent"]);
  const session_token = uuidv4() + "-" + Date.now();

  // Multi-device: check how many active sessions exist (heartbeat < 15s = browser open)
  const existingSessions = await query("SELECT id, device_type, device_info, last_heartbeat FROM user_sessions WHERE user_id = ?", [user.id]);

  const now = Date.now();
  const HEARTBEAT_TIMEOUT = 15 * 1000;
  const activeSessions = existingSessions.filter(s => {
    if (!s.last_heartbeat) return false;
    const lastHb = new Date(s.last_heartbeat).getTime();
    return (now - lastHb) < HEARTBEAT_TIMEOUT;
  });

  // Allow up to 2 active devices
  if (activeSessions.length >= 2) {
    return res.status(403).json({
      success: false,
      code: "DEVICE_ALREADY_ACTIVE",
      message: "This account is already logged in on 2 devices. Please log out from one device first.",
      message_ar: "هذا الحساب مسجل الدخول على جهازين بالفعل. يرجى تسجيل الخروج من أحد الأجهزة أولاً."
    });
  }

  // Clean stale sessions only (heartbeat expired — browser closed)
  await execute("DELETE FROM user_sessions WHERE user_id = ? AND (last_heartbeat IS NULL OR datetime(last_heartbeat) < datetime('now', '-15 seconds'))", [user.id]);

  // Create new session
  const nowHb = new Date().toISOString();
  await execute(
    "INSERT INTO user_sessions (id, user_id, session_token, device_type, device_info, last_heartbeat) VALUES (?, ?, ?, ?, ?, ?)",
    [uuidv4(), user.id, session_token, deviceType, req.headers["user-agent"] || "", nowHb]
  );

  // Store all active session tokens as CSV in users.session_token
  const allSessions = await query("SELECT session_token FROM user_sessions WHERE user_id = ?", [user.id]);
  const tokensCsv = allSessions.map(s => s.session_token).join(',');
  await execute("UPDATE users SET session_token = ? WHERE id = ?", [tokensCsv, user.id]);

  user.session_token = session_token;
  delete user.password;
  res.json({ user, session_token });
});

router.post("/logout", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const sessionToken = req.headers["x-session-token"];
    if (!userId || !sessionToken) return res.status(401).json({ error: "Unauthorized" });
    // Delete only the specific session
    await execute("DELETE FROM user_sessions WHERE user_id = ? AND session_token = ?", [userId, sessionToken]);
    // Rebuild tokens CSV from remaining sessions
    const remaining = await query("SELECT session_token FROM user_sessions WHERE user_id = ?", [userId]);
    const tokensCsv = remaining.map(s => s.session_token).join(',');
    await execute("UPDATE users SET session_token = ? WHERE id = ?", [tokensCsv || null, userId]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });
  }
});

// Cleanup expired/orphan sessions (optional, run on startup)
router.post("/cleanup-sessions", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const sessionToken = req.headers["x-session-token"];
    if (!userId || !sessionToken) return res.status(401).json({ error: "Unauthorized" });
    const user = await queryOne("SELECT id, session_token, role FROM users WHERE id = ?", [userId]);
    const tokens = (user?.session_token || '').split(',').filter(Boolean);
    if (!tokens.includes(sessionToken)) return res.status(401).json({ error: "Session invalid" });
    if (user.role !== "admin" && user.role !== "manager") return res.status(403).json({ error: "Admin access required" });
    await execute("DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users)");
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });
  }
});

// Heartbeat: keeps session alive while browser tab is open
router.post("/heartbeat", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.json({ success: false });
    const now = new Date().toISOString();

    // Check if this session token is still valid (multi-device CSV)
    const user = await queryOne("SELECT id, session_token FROM users WHERE id = ?", [user_id]);
    const sessionToken = req.headers["x-session-token"];
    const tokens = (user?.session_token || '').split(',').filter(Boolean);
    if (sessionToken && !tokens.includes(sessionToken)) {
      return res.json({ success: false, logout: true });
    }

    await execute("UPDATE user_sessions SET last_heartbeat = ? WHERE user_id = ? AND session_token = ?", [now, user_id, sessionToken]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: true });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone, address, password, referral_code, governorate, country, id_card, id_card_front, id_card_back } = req.body;
    const singleIdCard = id_card || id_card_front || null;
    const existing = await queryOne("SELECT id FROM users WHERE email = ? AND status != 'rejected'", [email]);
    if (existing) return res.status(400).json({ error: "Email already exists" });
    if (phone) {
      const existingPhone = await queryOne("SELECT id FROM users WHERE phone = ? AND status != 'rejected'", [phone]);
      if (existingPhone) return res.status(400).json({ error: "Phone number is already registered to another account", error_ar: "رقم الهاتف مسجل بالفعل في حساب آخر" });
    }

    // Clean up any rejected user with same email/phone to allow re-registration
    const rejected = await queryOne("SELECT id FROM users WHERE email = ? AND status = 'rejected'", [email]);
    if (rejected) {
      await execute("DELETE FROM user_closure WHERE descendant = ? OR ancestor = ?", [rejected.id, rejected.id]);
      await execute("DELETE FROM notifications WHERE user_id = ?", [rejected.id]);
      await execute("DELETE FROM users WHERE id = ?", [rejected.id]);
    }
    if (phone) {
      const rejectedPhone = await queryOne("SELECT id FROM users WHERE phone = ? AND status = 'rejected'", [phone]);
      if (rejectedPhone) {
        await execute("DELETE FROM user_closure WHERE descendant = ? OR ancestor = ?", [rejectedPhone.id, rejectedPhone.id]);
        await execute("DELETE FROM notifications WHERE user_id = ?", [rejectedPhone.id]);
        await execute("DELETE FROM users WHERE id = ?", [rejectedPhone.id]);
      }
    }

    const id = await generateUserId();
    const code = id;

    let referredBy = null;
    if (referral_code) {
      const refUser = await queryOne("SELECT id FROM users WHERE referral_code = ?", [referral_code]);
      if (refUser) referredBy = refUser.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await execute(
      "INSERT INTO users (id, full_name, email, phone, address, password, referral_code, referred_by, status, role, account_type, rank, governorate, country, id_card_front, id_card_back, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'registration', 'registration_free', '', ?, ?, ?, ?, 0)",
      [id, full_name, email, phone || null, address || null, hashedPassword, code, referredBy, governorate || null, country || null, singleIdCard, singleIdCard]
    );

    // Populate closure table (for tree visibility — commissions handled on admin approval)
    await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 0)", [id, id]);
    if (referredBy) {
      const ancestors = await query(
        "SELECT ancestor, depth FROM user_closure WHERE descendant = ? AND ancestor != descendant",
        [referredBy]
      );
      for (const a of ancestors) {
        await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, ?)",
          [a.ancestor, id, a.depth + 1]);
      }
      await execute("INSERT INTO user_closure (ancestor, descendant, depth) VALUES (?, ?, 1)",
        [referredBy, id]);
    }

    // Send OTP verification email
    let verificationSent = false;
    try {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await execute("UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?", [otp, expires, id]);
      await sendOTPEmail(email, otp, full_name, "email_verification");
      verificationSent = true;
    } catch (emailErr) {
      console.error("Registration verification email failed:", emailErr.message);
    }

    const user = await queryOne("SELECT id, full_name, email, phone, address, referral_code, referred_by, status, rank, e_money, account_type, created_at, email_verified FROM users WHERE id = ?", [id]);
    res.json({ user, verification_sent: verificationSent });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Verify email via OTP (POST)
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

    const user = await queryOne("SELECT id, email_otp, email_otp_expires FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "No account found with this email" });
    if (user.email_verified) return res.status(400).json({ error: "Email is already verified" });
    if (!user.email_otp) return res.status(400).json({ error: "No OTP has been sent. Please request a new one." });

    if (user.email_otp !== otp) return res.status(400).json({ error: "Invalid OTP code" });

    if (new Date(user.email_otp_expires) < new Date()) {
      return res.status(400).json({ error: "OTP code has expired. Please request a new one." });
    }

    await execute("UPDATE users SET email_verified = 1, email_otp = NULL, email_otp_expires = NULL WHERE id = ?", [user.id]);
    res.json({ success: true, message: "Email verified successfully" });

    // Send follow-up email: contact customer service to pay fees and activate account/courses
    try {
      const csRows = await query("SELECT * FROM settings WHERE key = 'customer_service_whatsapp'");
      const csNumber = csRows && csRows[0] ? csRows[0].value : "";
      const verifiedUser = await queryOne("SELECT full_name, email FROM users WHERE id = ?", [user.id]);
      await sendActivationFollowUpEmail(verifiedUser?.email || email, verifiedUser?.full_name || "", csNumber);
    } catch (emailErr) {
      console.error("Activation follow-up email failed:", emailErr.message);
    }
  } catch (e) {
    console.error("verify-email-otp error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Resend verification OTP
router.post("/resend-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    if (!checkResendLimit(email)) {
      return res.status(429).json({
        error: "Please wait 2 minutes before requesting another OTP.",
        error_ar: "يرجى الانتظار دقيقتين قبل طلب إعادة إرسال رمز التحقق."
      });
    }

    const user = await queryOne("SELECT id, full_name, email FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "No account found with this email" });
    if (user.email_verified) return res.status(400).json({ error: "Email is already verified" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await execute("UPDATE users SET email_otp = ?, email_otp_expires = ? WHERE id = ?", [otp, expires, user.id]);
    await sendOTPEmail(email, otp, user.full_name, "email_verification");

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (e) {
    console.error("resend-email-otp error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Forgot Password: send OTP to email
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const user = await queryOne("SELECT id, full_name, email FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "No account found with this email" });
    if (user.blocked) return res.status(403).json({ error: "Account is blocked" });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await execute("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
    await execute("INSERT INTO password_resets (id, user_id, otp, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now','localtime'))",
      [uuidv4(), user.id, otp, expires]);
    try {
      await sendOTPEmail(email, otp);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr.message);
      return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
    res.json({ success: true, message: "OTP sent to your email" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verify OTP (step 2 of forgot password)
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });
    const user = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "No account found with this email" });
    const reset = await queryOne("SELECT * FROM password_resets WHERE user_id = ? AND otp = ? ORDER BY created_at DESC LIMIT 1", [user.id, otp]);
    if (!reset) return res.status(400).json({ error: "Invalid OTP code" });
    if (new Date(reset.expires_at) < new Date()) {
      await execute("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
      return res.status(400).json({ error: "OTP code has expired. Please request a new one." });
    }
    res.json({ success: true, message: "OTP verified" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset Password: set new password (after OTP verified)
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) return res.status(400).json({ error: "All fields are required" });
    if (new_password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const user = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "No account found with this email" });
    const reset = await queryOne("SELECT * FROM password_resets WHERE user_id = ? AND otp = ? ORDER BY created_at DESC LIMIT 1", [user.id, otp]);
    if (!reset) return res.status(400).json({ error: "Invalid OTP code" });
    if (new Date(reset.expires_at) < new Date()) {
      await execute("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
      return res.status(400).json({ error: "OTP code has expired. Please request a new one." });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await execute("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
    await execute("DELETE FROM password_resets WHERE user_id = ?", [user.id]);
    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import { queryOne } from "../db.js";

// Truly public paths — no auth needed
const publicPaths = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/verify-otp", "/auth/reset-password", "/auth/heartbeat", "/auth/resend-email-otp", "/auth/verify-email-otp", "/admin-auth", "/public-upload", "/customer-service", "/pricing"];

export default async function sessionAuth(req, res, next) {
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  // Chat POST is public (no auth for chatbot)
  if (req.path.startsWith("/chat") && req.method === "POST") return next();

  // Public GET endpoints: course catalog, ranks, leaders, public feedbacks, proofs, dashboard stats, customer service
  if (req.method === "GET" && (
    req.path === "/courses" ||
    req.path.startsWith("/courses/") && !req.path.includes("/my") && !req.path.includes("/quiz-progress") ||
    req.path === "/free-courses" ||
    req.path === "/ranks" ||
    req.path === "/leaders" ||
    req.path.startsWith("/leaders/") ||
    req.path === "/feedbacks" ||
    req.path === "/proofs" ||
    req.path === "/dashboard" ||
    req.path === "/dashboard/public-stats" ||
    req.path.startsWith("/payment-gateways/active") ||
    req.path.startsWith("/chat/") ||
    req.path === "/customer-service"
  )) {
    return next();
  }

  const userId = req.headers["x-user-id"];
  const sessionToken = req.headers["x-session-token"];

  if (!userId || !sessionToken) {
    return res.status(401).json({ error: "Unauthorized. يرجى تسجيل الدخول.", session_expired: true });
  }

  // Validate session against users table (supports multi-device CSV)
  const user = await queryOne("SELECT id, session_token FROM users WHERE id = ?", [userId]);
  const tokens = (user?.session_token || '').split(',').filter(Boolean);
  if (tokens.includes(sessionToken)) return next();

  res.status(401).json({ error: "Session expired. تم تسجيل الخروج من جهاز آخر. يرجى تسجيل الدخول مرة أخرى.", session_expired: true });
}

// Admin-only middleware — checks role is admin or manager
export async function adminAuth(req, res, next) {
  const userId = req.headers["x-user-id"];
  const sessionToken = req.headers["x-session-token"];

  if (!userId || !sessionToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await queryOne("SELECT id, session_token, role FROM users WHERE id = ?", [userId]);
  const tokens = (user?.session_token || '').split(',').filter(Boolean);
  if (!user || !tokens.includes(sessionToken)) {
    return res.status(401).json({ error: "Session expired" });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return res.status(403).json({ error: "Admin access required" });
  }
  req.adminUser = user;
  next();
}

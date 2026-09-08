import express from "express";
import { query, queryOne } from "../db.js";
import { adminAuth } from "../middleware/sessionAuth.js";

const router = express.Router();

router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalUsers = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin','manager')"
    );
    const totalStudents = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = 'student'"
    );
    const totalRegistration = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = 'registration'"
    );
    const totalBlocked = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin','manager') AND blocked = 1"
    );
    const pendingApprovals = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin','manager') AND status = 'pending'"
    );
    const totalCourses = await queryOne("SELECT COUNT(*) as count FROM courses");
    const publishedCourses = await queryOne(
      "SELECT COUNT(*) as count FROM courses WHERE status = 'published'"
    );
    const totalEnrollments = await queryOne(
      "SELECT COUNT(*) as count FROM enrollments"
    );
    const approvedEnrollments = await queryOne(
      "SELECT COUNT(*) as count FROM enrollments WHERE status = 'approved'"
    );
    const pendingEnrollments = await queryOne(
      "SELECT COUNT(*) as count FROM enrollments WHERE status = 'pending'"
    );
    const totalCommissions = await queryOne(
      "SELECT COALESCE(SUM(amount), 0) as total FROM commissions"
    );
    const totalEMoney = await queryOne(
      "SELECT COALESCE(SUM(e_money), 0) as total FROM users WHERE role NOT IN ('admin','manager')"
    );
    const topUpPending = await queryOne(
      "SELECT COUNT(*) as count FROM top_up_requests WHERE status = 'pending'"
    );
    const purchaseRequests = await queryOne(
      "SELECT COUNT(*) as count FROM enrollments WHERE status = 'pending' AND payment_method IS NOT NULL"
    );
    const upgradeRequests = await queryOne(
      "SELECT COUNT(*) as count FROM upgrade_requests WHERE status = 'pending'"
    );
    const revenueFromSales = await queryOne(`
      SELECT COALESCE(SUM(c.price_egp), 0) as total
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.status = 'approved' AND e.payment_method = 'emoney' AND c.price_egp > 0
    `);
    const totalFeedbacks = await queryOne(
      "SELECT COUNT(*) as count FROM feedbacks"
    );
    const avgFeedback = await queryOne(
      "SELECT COALESCE(AVG(rating), 0) as avg FROM feedbacks"
    );
    const totalQuizAttempts = await queryOne(
      "SELECT COUNT(*) as count FROM quiz_attempts"
    );
    const passedQuizzes = await queryOne(
      "SELECT COUNT(*) as count FROM quiz_attempts WHERE result = 'pass'"
    );

    const activeStudents = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'active' AND blocked = 0"
    );

    res.json({
      totalUsers: totalUsers?.count || 0,
      totalStudents: totalStudents?.count || 0,
      totalRegistration: totalRegistration?.count || 0,
      totalBlocked: totalBlocked?.count || 0,
      pendingApprovals: pendingApprovals?.count || 0,
      totalCourses: totalCourses?.count || 0,
      publishedCourses: publishedCourses?.count || 0,
      totalEnrollments: totalEnrollments?.count || 0,
      approvedEnrollments: approvedEnrollments?.count || 0,
      pendingEnrollments: pendingEnrollments?.count || 0,
      totalCommissions: totalCommissions?.total || 0,
      totalEMoney: totalEMoney?.total || 0,
      topUpPending: topUpPending?.count || 0,
      purchaseRequests: purchaseRequests?.count || 0,
      upgradeRequests: upgradeRequests?.count || 0,
      revenueFromSales: revenueFromSales?.total || 0,
      totalFeedbacks: totalFeedbacks?.count || 0,
      avgFeedback: Math.round((avgFeedback?.avg || 0) * 10) / 10,
      totalQuizAttempts: totalQuizAttempts?.count || 0,
      passedQuizzes: passedQuizzes?.count || 0,
      activeStudents: activeStudents?.count || 0,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/public-stats", async (req, res) => {
  try {
    const totalMembers = await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin','manager')"
    );
    const totalCourses = await queryOne(
      "SELECT COUNT(*) as count FROM courses WHERE status = 'published'"
    );
    const totalRanks = await queryOne(
      "SELECT COUNT(*) as count FROM ranks WHERE is_active = 1"
    );
    const ratingResult = await queryOne(
      "SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as total FROM feedbacks"
    );
    const avgRating = ratingResult
      ? Math.round((ratingResult.avg_rating / 5) * 100)
      : 95;
    res.json({
      totalMembers: totalMembers?.count || 0,
      totalCourses: totalCourses?.count || 0,
      totalRanks: totalRanks?.count || 0,
      satisfactionRate: avgRating > 0 ? avgRating : 95,
      totalFeedbacks: ratingResult?.total || 0,
    });
  } catch (err) {
    res.json({
      totalMembers: 0,
      totalCourses: 0,
      totalRanks: 10,
      satisfactionRate: 95,
      totalFeedbacks: 0,
    });
  }
});

export default router;

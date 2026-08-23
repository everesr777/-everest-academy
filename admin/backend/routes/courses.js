import express from "express";
import { query, queryOne, execute } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import { recordWeeklySales } from "../services/weeklySettlement.js";

const BACKEND = "https://everest-academy-production.up.railway.app";
function fixImg(url) {
  if (!url) return url;
  if (url.startsWith("data:")) return null;
  if (url.startsWith("/uploads/")) return BACKEND + url;
  return url;
}
function fixCourseImages(course) {
  if (course && course.featured_image) course.featured_image = fixImg(course.featured_image);
  return course;
}

const router = express.Router();

router.get("/", async (req, res) => {
  const { authorId, status } = req.query;
  let sql = `
    SELECT c.*, u.full_name as author_name,
      (SELECT COUNT(*) FROM topics WHERE course_id = c.id) as topic_count,
      (SELECT COUNT(*) FROM lessons l JOIN topics t ON l.topic_id = t.id WHERE t.course_id = c.id) as lesson_count,
      (SELECT COUNT(*) FROM quizzes q JOIN topics t ON q.topic_id = t.id WHERE t.course_id = c.id) as quiz_count,
      (SELECT COUNT(*) FROM quizzes q WHERE q.course_id = c.id AND q.type = 'final') as final_quiz_count,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count,
      COALESCE((SELECT ROUND(AVG(rating),1) FROM course_reviews WHERE course_id = c.id), 0) as avg_rating,
      (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as review_count
    FROM courses c LEFT JOIN users u ON c.author_id = u.id
  `;
  const conditions = [];
  const params = [];
  if (authorId) { conditions.push("c.author_id = ?"); params.push(authorId); }
  if (status) { conditions.push("c.status = ?"); params.push(status); }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY c.created_at DESC";
  const courses = (await query(sql, params)).map(fixCourseImages);
  res.json(courses);
});

router.get("/my", async (req, res) => {
  const { userId, status, courseId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId query param required" });
  let sql = `
    SELECT e.*, c.title, c.title_ar, c.description, c.description_ar, c.featured_image, c.difficulty
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.user_id = ?
  `;
  const params = [userId];
  if (status) { sql += " AND e.status = ?"; params.push(status); }
  if (courseId) { sql += " AND e.course_id = ?"; params.push(courseId); }
  sql += " ORDER BY e.enrolled_at DESC";
  const enrollments = await query(sql, params);
  res.json(enrollments);
});

router.get("/attempts", async (req, res) => {
  const attempts = await query(`
    SELECT qa.*, q.title as quiz_title, q.type as quiz_type,
      COALESCE(c.title, '—') as course_name,
      u.full_name as student_name, u.email as student_email, u.id as student_id,
      u.referral_code as student_referral_code
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    LEFT JOIN topics t ON q.topic_id = t.id
    LEFT JOIN courses c ON t.course_id = c.id OR q.course_id = c.id
    LEFT JOIN users u ON qa.user_id = u.id
    ORDER BY qa.created_at DESC
  `);
  res.json(attempts);
});

router.delete("/attempts", async (req, res) => {
  await execute("DELETE FROM quiz_attempts");
  res.json({ success: true });
});

router.get("/top-quiz-performers", async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        qa.user_id,
        u.full_name,
        u.email,
        u.avatar,
        u.rank,
        c.id as course_id,
        c.title as course_title,
        c.title_ar as course_title_ar,
        c.description as course_description,
        c.description_ar as course_description_ar,
        c.image as course_image,
        c.price as course_price,
        COUNT(qa.id) as total_attempts,
        ROUND(AVG(qa.earned_marks), 1) as avg_score,
        SUM(CASE WHEN qa.result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN qa.result = 'fail' THEN 1 ELSE 0 END) as failed,
        MAX(qa.earned_marks) as best_score
      FROM quiz_attempts qa
      JOIN users u ON qa.user_id = u.id
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN courses c ON q.course_id = c.id
      WHERE q.type = 'final' AND (u.account_type = 'student' OR u.account_type = 'registration_free')
      GROUP BY qa.user_id, c.id
      HAVING avg_score >= 70
      ORDER BY avg_score DESC
      LIMIT 10
    `);
    const fixed = rows.map(r => {
      if (r.avatar && !r.avatar.startsWith("http")) {
        if (r.avatar.startsWith("/uploads/")) r.avatar = BACKEND + r.avatar;
        else if (r.avatar.startsWith("data:")) r.avatar = null;
      }
      return r;
    });
    res.json(fixed);
  } catch (e) {
    console.error("top-quiz-performers error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/sync-leaderboard", async (req, res) => {
  try {
    const existing = await query("SELECT user_id FROM quiz_leaderboard");
    const existingIds = new Set(existing.map(e => e.user_id));

    const aggregated = await query(`
      SELECT
        qa.user_id,
        u.full_name,
        u.email,
        u.avatar,
        COALESCE(c.id, c2.id) as course_id,
        COALESCE(c.title, c2.title, '—') as course_title,
        COUNT(qa.id) as total_attempts,
        ROUND(AVG(qa.earned_marks), 1) as avg_score,
        SUM(CASE WHEN qa.result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN qa.result = 'fail' THEN 1 ELSE 0 END) as failed,
        MAX(qa.earned_marks) as best_score
      FROM quiz_attempts qa
      JOIN users u ON qa.user_id = u.id
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      LEFT JOIN topics t ON q.topic_id = t.id
      LEFT JOIN courses c2 ON t.course_id = c2.id
      WHERE qa.user_id NOT IN (SELECT user_id FROM quiz_leaderboard) AND (u.account_type = 'student' OR u.account_type = 'registration_free')
      GROUP BY qa.user_id, COALESCE(c.id, c2.id)
      ORDER BY avg_score DESC
      LIMIT 10
    `);

    for (const row of aggregated) {
      if (!existingIds.has(row.user_id)) {
        const lbId = uuidv4();
        await execute(
          `INSERT INTO quiz_leaderboard (id, user_id, full_name, email, avatar, course_id, course_title, total_attempts, avg_score, passed, failed, best_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [lbId, row.user_id, row.full_name, row.email, row.avatar, row.course_id, row.course_title, row.total_attempts, row.avg_score, row.passed, row.failed, row.best_score]
        );
      }
    }
    res.json({ success: true, synced: aggregated.length });
  } catch (e) {
    console.error("sync-leaderboard error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/enrollments/list", async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT e.*, u.full_name as student_name, u.email as student_email, c.title as course_name, c.title_ar as course_name_ar, c.price as course_price
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    JOIN courses c ON e.course_id = c.id
  `;
  const params = [];
  if (status) { sql += " WHERE e.status = ?"; params.push(status); }
  sql += " ORDER BY e.enrolled_at DESC";
  const enrollments = await query(sql, params);
  res.json(enrollments);
});

// Get enrollments for a specific course (with full student details)
router.get("/enrollments/list/:courseId", async (req, res) => {
  const enrollments = await query(`
    SELECT e.*,
      u.full_name as student_name, u.email as student_email, u.phone as student_phone,
      u.rank as student_rank, u.address as student_address, u.bio as student_bio,
      u.e_money as student_emoney, u.total_team_sales as student_team_sales,
      u.direct_count as student_direct_count, u.referral_code as student_referral_code,
      u.membership_expires_at as student_membership_expires, u.status as student_status,
      u.created_at as student_joined
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    WHERE e.course_id = ?
    ORDER BY e.enrolled_at DESC
  `, [req.params.courseId]);
  res.json(enrollments);
});

// Delete an enrollment (remove student from course)
router.delete("/enrollments/:id", async (req, res) => {
  const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [req.params.id]);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  await execute("DELETE FROM enrollments WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// Update enrollment (modify status, expires_at, etc.)
router.put("/enrollments/:id", async (req, res) => {
  const { status, expires_at } = req.body;
  const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [req.params.id]);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const updates = [];
  const params = [];
  if (status !== undefined) { updates.push("status = ?"); params.push(status); }
  if (expires_at !== undefined) { updates.push("expires_at = ?"); params.push(expires_at); }
  if (updates.length) {
    params.push(req.params.id);
    await execute(`UPDATE enrollments SET ${updates.join(", ")} WHERE id = ?`, params);
  }
  const updated = await queryOne("SELECT * FROM enrollments WHERE id = ?", [req.params.id]);
  res.json(updated);
});

// --- Get quiz by ID ---
router.get("/quizzes/:quizId", async (req, res) => {
  const quiz = await queryOne("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId]);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  res.json(quiz);
});

router.get("/free-lessons", async (req, res) => {
  const lessons = await query(`
    SELECT l.id, l.title, l.title_ar, l.content, l.content_ar, l.video_url, l.duration, l.sort_order,
           t.id as topic_id, t.title as topic_title, t.title_ar as topic_title_ar,
           c.id as course_id, c.title as course_title, c.title_ar as course_title_ar,
           c.description as course_description, c.description_ar as course_description_ar,
           c.featured_image as course_image, c.difficulty, c.price
    FROM lessons l
    JOIN topics t ON l.topic_id = t.id
    JOIN courses c ON t.course_id = c.id
    WHERE l.is_free = 1 AND c.status = 'published' AND c.is_show_free = 1
    ORDER BY c.created_at DESC, l.sort_order ASC
  `);
  res.json(lessons);
});

router.get("/:courseId/reviews", async (req, res) => {
  const reviews = await query(`
    SELECT cr.*, u.full_name, u.avatar
    FROM course_reviews cr
    JOIN users u ON cr.user_id = u.id
    WHERE cr.course_id = ?
    ORDER BY cr.created_at DESC
  `, [req.params.courseId]);
  const stats = await queryOne(`
    SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg_rating
    FROM course_reviews WHERE course_id = ?
  `, [req.params.courseId]);
  res.json({ reviews, avg_rating: Math.round((stats?.avg_rating || 0) * 10) / 10, count: stats?.count || 0 });
});

router.post("/:courseId/reviews", async (req, res) => {
  const { userId, rating, comment } = req.body;
  if (!userId || !rating) return res.status(400).json({ error: "userId and rating required" });
  const existing = await queryOne("SELECT id FROM course_reviews WHERE course_id = ? AND user_id = ?", [req.params.courseId, userId]);
  if (existing) {
    await execute("UPDATE course_reviews SET rating=?, comment=?, created_at=datetime('now','localtime') WHERE id=?", [rating, comment || "", existing.id]);
  } else {
    const id = uuidv4();
    await execute("INSERT INTO course_reviews (id, course_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [id, req.params.courseId, userId, rating, comment || ""]);
  }
  const stats = await queryOne("SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg_rating FROM course_reviews WHERE course_id = ?", [req.params.courseId]);
  res.json({ success: true, avg_rating: Math.round((stats?.avg_rating || 0) * 10) / 10, count: stats?.count || 0 });
});

router.put("/:courseId/show-free", async (req, res) => {
  try {
    const { is_show_free } = req.body;
    await execute("UPDATE courses SET is_show_free = ? WHERE id = ?", [is_show_free ? 1 : 0, req.params.courseId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:courseId/show-homepage", async (req, res) => {
  try {
    const { is_show_homepage } = req.body;
    await execute("UPDATE courses SET is_show_homepage = ? WHERE id = ?", [is_show_homepage ? 1 : 0, req.params.courseId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:courseId/show-courses", async (req, res) => {
  try {
    const { is_show_courses } = req.body;
    await execute("UPDATE courses SET is_show_courses = ? WHERE id = ?", [is_show_courses ? 1 : 0, req.params.courseId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  const course = fixCourseImages(await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]));
  if (!course) return res.status(404).json({ error: "Course not found" });
  const topics = await query("SELECT * FROM topics WHERE course_id = ? ORDER BY sort_order", [req.params.id]);
  for (const topic of topics) {
    topic.lessons = await query("SELECT * FROM lessons WHERE topic_id = ? ORDER BY sort_order", [topic.id]);
    topic.quizzes = await query("SELECT * FROM quizzes WHERE topic_id = ? AND (type = 'topic' OR type IS NULL) ORDER BY created_at", [topic.id]);
    for (const lesson of topic.lessons) {
      lesson.quiz = await queryOne("SELECT * FROM quizzes WHERE lesson_id = ? AND type = 'lesson'", [lesson.id]);
    }
  }
  course.final_quiz = await queryOne("SELECT * FROM quizzes WHERE course_id = ? AND type = 'final'", [req.params.id]);
  const reviewStats = await queryOne("SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg_rating FROM course_reviews WHERE course_id = ?", [req.params.id]);
  course.avg_rating = Math.round((reviewStats?.avg_rating || 0) * 10) / 10;
  course.review_count = reviewStats?.count || 0;
  res.json({ ...course, topics });
});

router.post("/", async (req, res) => {
  try {
    const { title, description, title_ar, description_ar, category_ar, difficulty, is_public, price, price_egp, is_free, category, tags, featured_image, intro_video, author_id, status } = req.body;
    const id = uuidv4();
    await execute(
      "INSERT INTO courses (id, title, description, title_ar, description_ar, category_ar, difficulty, is_public, price, price_egp, is_free, category, tags, featured_image, intro_video, author_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, title, description, title_ar, description_ar, category_ar, difficulty || "beginner", is_public ?? 1, price || 0, price_egp || 0, is_free ?? 1, category, tags, featured_image, intro_video, author_id, status || "published"]
    );
    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [id]);
    res.json(course);
  } catch (err) {
    console.error("Error creating course:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Course not found" });
  const b = req.body;
  const safe = (val, old) => (val !== undefined && val !== null && val !== "") ? val : old;
  await execute(
    "UPDATE courses SET title=?, description=?, title_ar=?, description_ar=?, category_ar=?, difficulty=?, is_public=?, price=?, price_egp=?, is_free=?, category=?, tags=?, featured_image=?, intro_video=?, status=?, updated_at=datetime('now','localtime') WHERE id=?",
    [
      safe(b.title, existing.title),
      safe(b.description, existing.description),
      safe(b.title_ar, existing.title_ar),
      safe(b.description_ar, existing.description_ar),
      safe(b.category_ar, existing.category_ar),
      safe(b.difficulty, existing.difficulty),
      safe(b.is_public, existing.is_public),
      safe(b.price, existing.price),
      safe(b.price_egp, existing.price_egp) || 0,
      safe(b.is_free, existing.is_free),
      safe(b.category, existing.category),
      safe(b.tags, existing.tags),
      safe(b.featured_image, existing.featured_image),
      safe(b.intro_video, existing.intro_video),
      safe(b.status, existing.status),
      req.params.id
    ]
  );
  const course = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
  res.json(course);
});

router.delete("/:id", async (req, res) => {
  await execute("DELETE FROM courses WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

router.post("/:id/purchase", async (req, res) => {
  try {
    const { userId, payment_method, payment_proof } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const course = await queryOne("SELECT * FROM courses WHERE id = ? AND status = 'published'", [req.params.id]);
    if (!course) return res.status(404).json({ error: "Course not found or not available" });

    const user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role !== "student" && user.role !== "registration") return res.status(403).json({ error: "Only student and registration accounts can purchase courses" });

    const existing = await queryOne("SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ?", [userId, req.params.id]);
    if (existing && existing.status !== "rejected") return res.status(400).json({ error: "Already enrolled in this course" });

    const price = course.price || 0;
    const method = payment_method || "emoney";

    // Handle payment — deduct E-Money only for approved (free/admin), NOT for pending
    if (method === "emoney") {
      if (price > 0 && (user.e_money || 0) < price) return res.status(400).json({ error: "Insufficient E-Money balance" });
    }

    const isFree = price === 0 || method === "vodafone" || method === "instapay" || method === "admin";
    const enrollmentId = uuidv4();
    const status = (method === "admin" || price === 0) ? "approved" : "pending";

    // Deduct E-Money only if approved immediately (free or admin)
    if (method === "emoney" && price > 0 && status === "approved") {
      await execute("UPDATE users SET e_money = e_money - ? WHERE id = ?", [price, userId]);
    }

    if (existing && existing.status === "rejected") {
      // Reuse the old enrollment row — update it to pending
      await execute("UPDATE enrollments SET status=?, payment_method=?, payment_proof=?, progress=0, enrolled_at=datetime('now','localtime') WHERE id=?",
        [status, method, payment_proof || null, existing.id]);
    } else {
      await execute("INSERT INTO enrollments (id, user_id, course_id, progress, status, payment_method, payment_proof) VALUES (?, ?, ?, 0, ?, ?, ?)",
        [enrollmentId, userId, req.params.id, status, method, payment_proof || null]);
    }

    if (status === "approved") {
      const savedEnrollmentId = (existing && existing.status === "rejected") ? existing.id : enrollmentId;
      await recordWeeklySales(userId, savedEnrollmentId);
    }

    // Create wallet transaction for emoney
    if (method === "emoney" && price > 0) {
      const tid = uuidv4();
      await execute("INSERT INTO wallet_transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'debit', ?, 'pending')",
        [tid, userId, price, `Purchase: ${course.title_ar || course.title}`]);
    }

    const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [enrollmentId]);
    res.json(enrollment);
  } catch (err) {
    console.error("Purchase error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/enrollments/admin-add", async (req, res) => {
  try {
    const { adminId, userEmail, courseId } = req.body;
    if (!adminId || !userEmail || !courseId) return res.status(400).json({ error: "adminId, userEmail, and courseId required" });

    const admin = await queryOne("SELECT role FROM users WHERE id = ?", [adminId]);
    if (!admin || admin.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const user = await queryOne("SELECT id, full_name FROM users WHERE email = ?", [userEmail]);
    if (!user) return res.status(404).json({ error: "User not found with this email" });

    const course = await queryOne("SELECT id, title, title_ar FROM courses WHERE id = ?", [courseId]);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const existing = await queryOne("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?", [user.id, courseId]);
    if (existing) return res.status(400).json({ error: "User already enrolled in this course" });

    const enrollmentId = uuidv4();
    await execute("INSERT INTO enrollments (id, user_id, course_id, progress, status, payment_method) VALUES (?, ?, ?, 0, 'approved', 'admin')",
      [enrollmentId, user.id, courseId]);

    await incrementTeamSales(user.id, enrollmentId);
    await recordWeeklySales(user.id, enrollmentId);

    const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [enrollmentId]);
    res.json(enrollment);
  } catch (err) {
    console.error("Admin add error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function updateUserRankAndReward(userId) {
  const user = await queryOne("SELECT total_team_sales, rank FROM users WHERE id = ?", [userId]);
  if (!user) return;
  const allRanks = await query("SELECT * FROM ranks WHERE is_active = 1 ORDER BY min_direct DESC");
  let newRank = "Star";
  for (const r of allRanks) {
    if (user.total_team_sales >= r.min_direct) { newRank = r.name; break; }
  }
  if (newRank !== user.rank) {
    await execute("UPDATE users SET rank = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newRank, userId]);
    const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'success')", [nid, userId, "🎉 Rank Up!", `You reached ${newRank} rank! Your bonus is included in the weekly commission.`]);
  }
}

async function incrementTeamSales(userId, excludeEnrollmentId) {
  const user = await queryOne("SELECT account_type FROM users WHERE id = ?", [userId]);
  if (!user || user.account_type !== "student") return; // Only students count for team sales
  const count = await queryOne("SELECT COUNT(*) as c FROM enrollments WHERE user_id = ? AND status = 'approved' AND id != ?", [userId, excludeEnrollmentId]);
  if (count.c > 0) return; // Already counted
  const userRef = await queryOne("SELECT referred_by FROM users WHERE id = ?", [userId]);
  if (!userRef || !userRef.referred_by) return;
  let uplineId = userRef.referred_by;
  const visited = new Set();
  while (uplineId && !visited.has(uplineId)) {
    visited.add(uplineId);
    const upline = await queryOne("SELECT account_type FROM users WHERE id = ?", [uplineId]);
    if (upline && upline.account_type === "student") {
      await execute("UPDATE users SET total_team_sales = total_team_sales + 1 WHERE id = ?", [uplineId]);
      // Rank changes happen ONLY during the Friday weekly settlement.
    }
    const next = await queryOne("SELECT referred_by FROM users WHERE id = ?", [uplineId]);
    uplineId = next?.referred_by;
  }
}

router.put("/enrollments/:id/approve", async (req, res) => {
  const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [req.params.id]);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const course = await queryOne("SELECT title_ar, title, price FROM courses WHERE id = ?", [enrollment.course_id]);
  await execute("UPDATE enrollments SET status = 'approved' WHERE id = ?", [req.params.id]);

  // Deduct E-Money on approval (if emoney payment and price > 0)
  if (enrollment.payment_method === "emoney" && course?.price > 0) {
    await execute("UPDATE users SET e_money = e_money - ? WHERE id = ?", [course.price, enrollment.user_id]);
  }

  const pendingTx = await queryOne("SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'debit' AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [enrollment.user_id]);
  if (pendingTx) await execute("UPDATE wallet_transactions SET status = 'completed' WHERE id = ?", [pendingTx.id]);
  const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, 'success', ?)", [nid, enrollment.user_id, "✅ تم الموافقة على الاشتراك", `تم تأكيد اشتراكك في ${course?.title_ar || course?.title || "الكورس"}`, enrollment.course_id]);
  await incrementTeamSales(enrollment.user_id, enrollment.id);
  await recordWeeklySales(enrollment.user_id, enrollment.id);
  // Rank changes happen ONLY during the Friday weekly settlement.
  res.json({ success: true, message: "Enrollment approved" });
});

router.put("/enrollments/:id/reject", async (req, res) => {
  const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [req.params.id]);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const course = await queryOne("SELECT price, title_ar, title FROM courses WHERE id = ?", [enrollment.course_id]);
  if (course && course.price > 0) {
    await execute("UPDATE users SET e_money = e_money + ? WHERE id = ?", [course.price, enrollment.user_id]);
  }
  await execute("UPDATE enrollments SET status = 'rejected' WHERE id = ?", [req.params.id]);
  const pendingTx = await queryOne("SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'debit' AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [enrollment.user_id]);
  if (pendingTx) await execute("UPDATE wallet_transactions SET status = 'refunded' WHERE id = ?", [pendingTx.id]);
  const nid = uuidv4(); await execute("INSERT INTO notifications (id, user_id, title, message, type, related_id) VALUES (?, ?, ?, ?, 'error', ?)", [nid, enrollment.user_id, "❌ تم رفض الاشتراك", `تم رفض اشتراكك في ${course?.title_ar || course?.title || "الكورس"} وتم استرداد المبلغ`, enrollment.course_id]);
  res.json({ success: true, message: "Enrollment rejected, E-Money refunded" });
});

// --- Course-level final quiz ---
router.post("/:courseId/final-quiz", async (req, res) => {
  try {
    const { title, questions, total_marks, pass_mark, quiz_type } = req.body;
    await execute("DELETE FROM quizzes WHERE course_id = ? AND type = 'final'", [req.params.courseId]);
    const id = uuidv4();
    await execute("INSERT INTO quizzes (id, topic_id, course_id, type, title, questions, total_marks, pass_mark, quiz_type) VALUES (?, NULL, ?, 'final', ?, ?, ?, ?, ?)",
      [id, req.params.courseId, title, JSON.stringify(questions || []), total_marks || 0, pass_mark || 50, quiz_type || "mixed"]);
    res.json({ id, success: true });
  } catch (err) {
    console.error("Final quiz error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/topics", async (req, res) => {
  const { title, summary, title_ar, summary_ar } = req.body;
  const id = uuidv4();
  const maxSort = await queryOne("SELECT COALESCE(MAX(sort_order), -1) as m FROM topics WHERE course_id = ?", [req.params.id]);
  await execute("INSERT INTO topics (id, course_id, title, summary, title_ar, summary_ar, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.id, title, summary, title_ar, summary_ar, (maxSort?.m ?? -1) + 1]);
  const topic = await queryOne("SELECT * FROM topics WHERE id = ?", [id]);
  res.json(topic);
});

router.put("/topics/:topicId", async (req, res) => {
  const { title, summary, title_ar, summary_ar } = req.body;
  await execute("UPDATE topics SET title=?, summary=?, title_ar=?, summary_ar=? WHERE id=?", [title, summary, title_ar, summary_ar, req.params.topicId]);
  res.json({ success: true });
});

router.delete("/topics/:topicId", async (req, res) => {
  await execute("DELETE FROM topics WHERE id=?", [req.params.topicId]);
  res.json({ success: true });
});

router.put("/topics/:topicId/lessons/:lessonId", async (req, res) => {
  const { title, content, title_ar, content_ar, video_url, duration, is_free } = req.body;
  await execute("UPDATE lessons SET title=?, content=?, title_ar=?, content_ar=?, video_url=?, duration=?, is_free=? WHERE id=?",
    [title, content, title_ar, content_ar, video_url, duration, is_free ?? 0, req.params.lessonId]);
  res.json({ success: true });
});

router.delete("/topics/:topicId/lessons/:lessonId", async (req, res) => {
  await execute("DELETE FROM lessons WHERE id=?", [req.params.lessonId]);
  res.json({ success: true });
});

router.put("/topics/:topicId/quizzes/:quizId", async (req, res) => {
  const { title, questions, total_marks, pass_mark, quiz_type } = req.body;
  await execute("UPDATE quizzes SET title=?, questions=?, total_marks=?, pass_mark=?, quiz_type=? WHERE id=?",
    [title, JSON.stringify(questions || []), total_marks || 0, pass_mark || 50, quiz_type || "mixed", req.params.quizId]);
  res.json({ success: true });
});

router.delete("/topics/:topicId/quizzes/:quizId", async (req, res) => {
  await execute("DELETE FROM quizzes WHERE id=?", [req.params.quizId]);
  res.json({ success: true });
});

router.post("/topics/:topicId/lessons", async (req, res) => {
  const { title, content, title_ar, content_ar, video_url, duration, is_free } = req.body;
  const id = uuidv4();
  const maxSort = await queryOne("SELECT COALESCE(MAX(sort_order), -1) as m FROM lessons WHERE topic_id = ?", [req.params.topicId]);
  await execute("INSERT INTO lessons (id, topic_id, title, content, title_ar, content_ar, video_url, duration, is_free, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.topicId, title, content, title_ar, content_ar, video_url, duration, is_free ?? 0, (maxSort?.m ?? -1) + 1]);
  res.json({ id, success: true });
});

router.post("/topics/:topicId/quizzes", async (req, res) => {
  const { title, questions, total_marks, lesson_id, type, pass_mark, quiz_type } = req.body;
  const id = uuidv4();
  await execute("INSERT INTO quizzes (id, topic_id, lesson_id, title, questions, total_marks, type, pass_mark, quiz_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, req.params.topicId, lesson_id || null, title, JSON.stringify(questions || []), total_marks || 0, type || "topic", pass_mark || 50, quiz_type || "mixed"]);
  res.json({ id, success: true });
});

// --- Quiz submission ---
router.post("/quizzes/:quizId/submit", async (req, res) => {
  try {
    const { userId, answers } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const quiz = await queryOne("SELECT * FROM quizzes WHERE id = ?", [req.params.quizId]);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const questions = JSON.parse(quiz.questions || "[]");
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === undefined || answers[i] === null) return;
      if (q.type === "tf") {
        // T/F: answer is boolean (true/false)
        const expected = q.answer === true || q.answer === "true" || q.answer === 1;
        const given = answers[i] === true || answers[i] === "true" || answers[i] === 1;
        if (expected === given) correct++;
      } else {
        // MCQ: answer is index (0-3)
        if (answers[i] === q.answer) correct++;
      }
    });
    const incorrect = questions.length - correct;
    const total = questions.length;
    const marks = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passMark = quiz.pass_mark || 50;
    const result = marks >= passMark ? "pass" : "fail";

    const id = uuidv4();
    await execute(
      "INSERT INTO quiz_attempts (id, quiz_id, user_id, total_marks, earned_marks, correct_answers, incorrect_answers, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, quiz.id, userId, total, marks, correct, incorrect, result]
    );

    // Update persistent leaderboard (survives quiz_attempts deletion)
    try {
      const user = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
      if (user && (user.account_type === "student" || user.account_type === "registration_free")) {
        const courseTitle = await queryOne(`
        SELECT COALESCE(c.title, c2.title, '—') as title
        FROM quizzes q
        LEFT JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN courses c2 ON t.course_id = c2.id
        WHERE q.id = ?
      `, [quiz.id]);
      const courseId = await queryOne(`
        SELECT COALESCE(c.id, c2.id) as id
        FROM quizzes q
        LEFT JOIN courses c ON q.course_id = c.id
        LEFT JOIN topics t ON q.topic_id = t.id
        LEFT JOIN courses c2 ON t.course_id = c2.id
        WHERE q.id = ?
      `, [quiz.id]);

      const existing = await queryOne("SELECT * FROM quiz_leaderboard WHERE user_id = ?", [userId]);
      if (existing) {
        const newAvg = existing.total_attempts > 0
          ? ((existing.avg_score * existing.total_attempts) + marks) / (existing.total_attempts + 1)
          : marks;
        const newPassed = existing.passed + (result === "pass" ? 1 : 0);
        const newFailed = existing.failed + (result === "fail" ? 1 : 0);
        const newBest = Math.max(existing.best_score, marks);
        await execute(
          `UPDATE quiz_leaderboard SET full_name=?, email=?, avatar=?, course_id=?, course_title=?,
           total_attempts=total_attempts+1, avg_score=?, passed=?, failed=?, best_score=?, updated_at=datetime('now','localtime')
           WHERE user_id=?`,
          [user?.full_name || existing.full_name, user?.email || existing.email, user?.avatar || existing.avatar,
           courseId?.id || existing.course_id, courseTitle?.title || existing.course_title,
           Math.round(newAvg * 10) / 10, newPassed, newFailed, newBest, userId]
        );
      } else {
        const lbId = uuidv4();
        await execute(
          `INSERT INTO quiz_leaderboard (id, user_id, full_name, email, avatar, course_id, course_title, total_attempts, avg_score, passed, failed, best_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [lbId, userId, user?.full_name || "—", user?.email || "", user?.avatar || "",
           courseId?.id || null, courseTitle?.title || "—", marks,
           result === "pass" ? 1 : 0, result === "fail" ? 1 : 0, marks]
        );
      }
      }
    } catch (lbErr) {
      console.error("Leaderboard update error:", lbErr);
    }

    res.json({ id, correct, incorrect, total, marks, result, passMark });
  } catch (err) {
    console.error("Quiz submit error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Quiz progress for a course (checks which quizzes the user passed) ---
router.get("/:courseId/quiz-progress", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const quizzes = await query(`
    SELECT q.id, q.type, q.lesson_id, q.topic_id, q.title
    FROM quizzes q
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.topic_id IN (SELECT id FROM topics WHERE course_id = ?)
       OR q.lesson_id IN (SELECT l.id FROM lessons l JOIN topics t2 ON l.topic_id = t2.id WHERE t2.course_id = ?)
       OR q.course_id = ?
  `, [req.params.courseId, req.params.courseId, req.params.courseId]);

  const quizIds = quizzes.map(q => q.id);
  let passed = [];
  if (quizIds.length) {
    passed = await query(
      `SELECT DISTINCT qa.quiz_id FROM quiz_attempts qa WHERE qa.user_id = ? AND qa.result = 'pass' AND qa.quiz_id IN (${quizIds.map(() => "?").join(",")})`,
      [userId, ...quizIds]
    );
  }
  const passedSet = new Set(passed.map(p => p.quiz_id));
  const progress = quizzes.map(q => ({ ...q, passed: passedSet.has(q.id) }));
  res.json(progress);
});

export default router;

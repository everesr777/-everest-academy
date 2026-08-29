import express from "express";
import { query } from "../db.js";

const router = express.Router();

const EMPTY_USER = { id: "", name: "—", email: "" };

function fmt(rows, userMap) {
  return rows.map(r => ({
    id: r.id,
    type: r.type,
    from: userMap[r.from_user_id] || (r.from_name ? { id: r.from_user_id, name: r.from_name, email: r.from_email } : EMPTY_USER),
    to: userMap[r.to_user_id] || (r.to_name ? { id: r.to_user_id, name: r.to_name, email: r.to_email } : EMPTY_USER),
    amount: r.amount,
    status: r.status,
    time: r.time,
    title: r.title,
    details: r.details,
    meta: r.meta ? JSON.parse(r.meta) : null,
  }));
}

router.get("/", async (req, res) => {
  try {
    const { type, userId, fromDate, toDate, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // One user map to resolve names for every event source.
    const userMap = {};
    const userRows = await query("SELECT id, full_name, email, role, account_type, rank FROM users");
    for (const u of userRows) {
      userMap[u.id] = { id: u.id, name: u.full_name, email: u.email, role: u.role, account_type: u.account_type, rank: u.rank };
    }

    // 1) Referral commissions
    const commissions = (await query(`
      SELECT c.id, 'commission' AS type,
        c.from_user_id, c.to_user_id, c.amount, 'completed' AS status, c.created_at AS time,
        'عمولة إحالة - مستوى ' || c.level || ' (' || c.amount || ' EM)' AS title, c.description AS details,
        json_object('level', c.level) AS meta
      FROM commissions c
    `)).map(r => ({ ...r, details: r.details || r.title }));

    // 2) Weekly commissions (Friday settlement payments)
    const weeklyComms = (await query(`
      SELECT wc.id, 'weekly_commission' AS type,
        '' AS from_user_id, wc.user_id AS to_user_id, wc.amount, wc.status, wc.calculated_at AS time,
        'العمولة الأسبوعية - رتبة ' || wc.rank_name || ' (' || wc.week_start || ')' AS title, NULL AS details,
        json_object('rank_name', wc.rank_name, 'week_start', wc.week_start, 'week_end', wc.week_end) AS meta
      FROM weekly_commissions wc
    `)).map(r => ({ ...r, title: r.title }));

    // 3) Rank changes recorded at Friday settlement (weekly_history).
    // Only real changes (up/down/change) are shown — routine "no change" rows are noise.
    const rankChanges = (await query(`
      SELECT wh.id, CASE
          WHEN COALESCE(wh.previous_rank,'') = '' AND COALESCE(wh.current_rank,'') != '' THEN 'rank_up'
          WHEN COALESCE(wh.previous_rank,'') != '' AND COALESCE(wh.current_rank,'') = '' THEN 'rank_down'
          ELSE 'rank_change' END AS type,
        '' AS from_user_id, wh.user_id AS to_user_id, wh.weekly_commission AS amount,
        wh.commission_status AS status, wh.calculation_date AS time,
        '' AS title, NULL AS details,
        json_object('previous_rank', COALESCE(wh.previous_rank,''), 'current_rank', COALESCE(wh.current_rank,''),
          'team_count', wh.qualified_team_count, 'direct_sales', wh.qualified_direct_sales,
          'commission_status', wh.commission_status, 'promotion_status', wh.promotion_status,
          'failure_reason', wh.failure_reason, 'week_start', wh.week_start) AS meta
      FROM weekly_history wh
      WHERE COALESCE(wh.previous_rank,'') != COALESCE(wh.current_rank,'')
    `)).map(r => {
      let t = "";
      if (r.type === "rank_up") t = "ترقية رتبة عند التسوية الأسبوعية";
      else if (r.type === "rank_change") t = "تغيير رتبة عند التسوية الأسبوعية";
      else t = "هبوط رتبة عند التسوية الأسبوعية";
      const p = r.meta; let pr = p ? p.previous_rank : ""; let cr = p ? p.current_rank : "";
      if (!pr) pr = "—"; if (!cr) cr = "—";
      t += " (" + pr + " ← " + cr + ")";
      return { ...r, title: t, amount: null };
    });

    // 4) Rank bonuses
    const rankBonuses = (await query(`
      SELECT rb.id, 'rank_bonus' AS type,
        '' AS from_user_id, rb.user_id AS to_user_id, rb.amount, 'completed' AS status, rb.created_at AS time,
        'مكافأة ترقية - رتبة ' || rb.rank_name AS title, NULL AS details,
        json_object('rank_name', rb.rank_name) AS meta
      FROM rank_bonuses rb
    `)).map(r => ({ ...r, title: r.title }));

    // 5) Wallet transactions (credits / debits)
    const walletTx = (await query(`
      SELECT wt.id, (CASE WHEN wt.type = 'credit' THEN 'wallet_credit' ELSE 'wallet_debit' END) AS type,
        '' AS from_user_id, wt.user_id AS to_user_id, wt.amount, wt.status, wt.created_at AS time,
        '' AS title, wt.description AS details, '{}' AS meta
      FROM wallet_transactions wt
    `)).map(r => ({ ...r, title: (r.type === "wallet_credit" ? "إيداع محفظة" : "خصم محفظة") + (r.amount != null ? " (" + r.amount + " EM)" : "") }));

    // 6) Top-up requests
    const topups = (await query(`
      SELECT tur.id, 'topup' AS type,
        '' AS from_user_id, tur.user_id AS to_user_id, tur.amount, tur.status, tur.created_at AS time,
        'شحن رصيد' AS title, NULL AS details,
        json_object('payment_method', COALESCE(tur.payment_method,'')) AS meta
      FROM top_up_requests tur
    `)).map(r => ({ ...r, title: "شحن رصيد (" + (r.amount != null ? r.amount : "") + " EGP)" }));

    // 7) User-to-user transfers
    const transfers = (await query(`
      SELECT t.id, 'transfer' AS type,
        t.from_user_id, t.to_user_id, t.amount, t.status, t.created_at AS time,
        'تحويل بين المستخدمين' AS title, NULL AS details, '{}' AS meta
      FROM transfers t
    `)).map(r => ({ ...r, title: "تحويل بين المستخدمين (" + (r.amount != null ? r.amount : "") + " EM)" }));

    // 8) Admin financial / rank actions (E-Money moves & rank changes only)
    const adminFinancial = (await query(`
      SELECT al.id, 'admin_action' AS type,
        '' AS from_user_id, COALESCE(al.target_user_id,'') AS to_user_id, NULL AS amount,
        'completed' AS status, al.created_at AS time,
        '' AS title, al.details AS details, '{}' AS meta,
        al.admin_name, al.action
      FROM admin_logs al
      WHERE al.action LIKE '%e-money%' OR al.action LIKE '%emoney%'
         OR al.action LIKE '%e_money%' OR al.action LIKE '%wallet%'
         OR al.action LIKE '%transfer%' OR al.action LIKE '%commission%'
         OR al.action LIKE '%topup%' OR al.action LIKE '%rank%'
         OR al.action LIKE '%bonus%' OR al.action LIKE '%adjust%'
    `)).map(r => ({
      ...r,
      title: (r.action || "إجراء مشرف") + (r.details ? " - " + r.details : ""),
      meta: JSON.stringify({ action: r.action, admin_name: r.admin_name }),
    }));

    let all = [...commissions, ...weeklyComms, ...rankChanges, ...rankBonuses, ...walletTx, ...topups, ...transfers, ...adminFinancial].map(r => {
      // For admin actions, title is already composed. For others, keep composed above.
      return {
        id: r.id,
        type: r.type,
        from_user_id: r.from_user_id,
        to_user_id: r.to_user_id,
        amount: r.amount,
        status: r.status,
        time: r.time,
        title: r.title,
        details: r.details,
        meta: r.meta ? (typeof r.meta === "string" ? r.meta : JSON.stringify(r.meta)) : null,
        admin_name: r.admin_name,
        action: r.action,
      };
    });

    // Filters
    if (type && type !== "all") all = all.filter(e => e.type === type);
    if (userId) all = all.filter(e => e.from_user_id === userId || e.to_user_id === userId);
    if (fromDate) all = all.filter(e => (e.time || "") >= fromDate);
    if (toDate) all = all.filter(e => (e.time || "") <= toDate + " 23:59:59");

    // Sort newest first
    all.sort((a, b) => (b.time || "").localeCompare(a.time || ""));

    const total = all.length;
    const pageData = all.slice(offset, offset + parseInt(limit));

    // Compose user-filled objects
    const events = fmt(pageData, userMap);

    // Summary aggregates (over the whole filtered set)
    const summary = {
      totalEvents: total,
      totalCommission: all.filter(e => e.type === "commission" || e.type === "weekly_commission" || e.type === "rank_bonus")
        .reduce((s, e) => s + (e.amount || 0), 0),
      totalIn: all.filter(e => e.type === "wallet_credit").reduce((s, e) => s + (e.amount || 0), 0),
      totalOut: all.filter(e => e.type === "wallet_debit").reduce((s, e) => s + (e.amount || 0), 0),
      rankChanges: all.filter(e => e.type === "rank_up" || e.type === "rank_change" || e.type === "rank_down").length,
      typeCounts: all.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
    };

    res.json({ events, summary, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error("Activity feed error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

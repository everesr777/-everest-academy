import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, query } from "../db.js";
import { weekEndFromStart } from "../services/weeklySettlement.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, "../../../reports");

await initDb();

// ─────────────────────────── raw data ───────────────────────────
const users = await query(
  `SELECT id, full_name, email, phone, referral_code, referred_by, created_by_user,
          rank, account_type, status, role, created_at, e_money
     FROM users`
);
const byId = new Map(users.map(u => [u.id, u]));

const ranks = await query(
  "SELECT name, COALESCE(sales_required, min_direct, 0) AS required, COALESCE(bonus, weekly_bonus, 0) AS bonus, sort_order FROM ranks WHERE is_active = 1 ORDER BY sort_order"
);
const rankByName = new Map(ranks.map(r => [r.name, r]));
const rankOrder = (name) => {
  const r = rankByName.get(name);
  return r ? Number(r.sort_order) : -1;
};

const historyAll = await query(
  `SELECT * FROM weekly_history WHERE COALESCE(current_rank,'') <> '' ORDER BY week_start ASC, calculation_date ASC`
);
const settlements = new Map(
  (await query("SELECT week_start, week_end, status, triggered_by, completed_at FROM weekly_settlements"))
    .map(s => [s.week_start, s])
);
const closure = await query("SELECT ancestor, descendant, depth FROM user_closure ORDER BY depth ASC");
const closureByAncestor = new Map();
for (const c of closure) {
  if (!closureByAncestor.has(c.ancestor)) closureByAncestor.set(c.ancestor, []);
  closureByAncestor.get(c.ancestor).push(c);
}
const assignments = await query(
  "SELECT upline_id, direct_id, week_start, assigned_at, assigned_by, reason FROM weekly_direct_assignments"
);
const assignKey = new Set(assignments.map(a => `${a.upline_id}|${a.direct_id}|${a.week_start}`));
const assignedWeeks = new Map();
for (const a of assignments) {
  const k = `${a.upline_id}|${a.direct_id}`;
  if (!assignedWeeks.has(k)) assignedWeeks.set(k, new Set());
  assignedWeeks.get(k).add(a.week_start);
}

// ─────────────────────────── helpers ───────────────────────────
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
const nm = (u) => (u ? esc(u.full_name) : "—");
const code = (u) => (u ? (u.referral_code || u.id) : "—");
const dt = (s) => (s ? String(s).slice(0, 19) : "—");
const money = (n) => Number(n || 0).toLocaleString("en-US");
const isStudent = (u) => u && u.account_type === "student";

function descendantsOf(uid) {
  return (closureByAncestor.get(uid) || []).filter(c => c.depth >= 1);
}
function directStudents(uid) {
  const fromClosure = descendantsOf(uid).filter(c => c.depth === 1).map(c => byId.get(c.descendant)).filter(Boolean);
  const extra = users.filter(u => isStudent(u) && (u.referred_by === uid || u.created_by_user === uid));
  const map = new Map();
  for (const u of [...fromClosure, ...extra]) if (isStudent(u)) map.set(u.id, u);
  return [...map.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}
function teamStudents(uid, beforeDate = null) {
  return descendantsOf(uid)
    .map(c => ({ user: byId.get(c.descendant), depth: c.depth }))
    .filter(x => x.user && isStudent(x.user) && x.user.status === "active")
    .filter(x => !beforeDate || x.user.created_at <= `${beforeDate} 23:59:59`)
    .sort((a, b) => a.depth - b.depth || String(a.user.created_at).localeCompare(String(b.user.created_at)));
}
function weekJoins(uid, weekStart) {
  const weekEnd = weekEndFromStart(weekStart);
  const from = `${weekStart} 00:00:00`;
  const to = `${weekEnd} 23:59:59`;
  const out = [];
  for (const u of directStudents(uid)) {
    const isAssigned = assignKey.has(`${uid}|${u.id}|${weekStart}`);
    const other = assignedWeeks.get(`${uid}|${u.id}`);
    const inWindow = u.created_at >= from && u.created_at <= to;
    const counts = isAssigned || (inWindow && !(other && [...other].some(w => w !== weekStart)));
    if (counts) out.push({ user: u, assigned: isAssigned });
  }
  return out.sort((a, b) => String(a.user.created_at).localeCompare(String(b.user.created_at)));
}
function referrerOf(u) {
  if (!u) return null;
  return byId.get(u.referred_by) || byId.get(u.created_by_user) || null;
}
function chainOf(u, depth = 3) {
  const out = [];
  let cur = referrerOf(u);
  const seen = new Set([u && u.id]);
  while (cur && out.length < depth && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = referrerOf(cur);
  }
  return out;
}

// ─────────────────────────── dedupe promotions ───────────────────────────
// Some legacy weeks were settled twice (manual + auto), leaving two rows per member.
// Keep the most informative final row: paid > not_eligible, non-empty previous_rank, latest.
const grouped = new Map();
for (const h of historyAll) {
  if (h.current_rank === h.previous_rank) continue;
  const k = `${h.user_id}|${h.week_start}`;
  if (!grouped.has(k)) grouped.set(k, []);
  grouped.get(k).push(h);
}
const promotions = [];
for (const [, rows] of grouped) {
  const score = (r) =>
    (r.commission_status === "paid" ? 100 : 0) +
    (r.previous_rank ? 10 : 0) +
    (Number(r.qualified_team_count) > 0 ? 5 : 0);
  const best = [...rows].sort((a, b) => score(b) - score(a) || String(b.calculation_date).localeCompare(String(a.calculation_date)))[0];
  promotions.push({ row: best, duplicates: rows.length > 1 ? rows.length : 1 });
}
promotions.sort((a, b) => String(a.row.week_start).localeCompare(String(b.row.week_start)) || String(a.row.calculation_date).localeCompare(String(b.row.calculation_date)));

const notifsByUser = new Map();
for (const n of await query(
  "SELECT user_id, title, message, created_at FROM notifications WHERE title LIKE '%Rank Up%' ORDER BY created_at ASC"
)) {
  if (!notifsByUser.has(n.user_id)) notifsByUser.set(n.user_id, []);
  notifsByUser.get(n.user_id).push(n);
}

const totalNotifs = [...notifsByUser.values()].reduce((a, x) => a + x.length, 0);
const promotedIds = new Set(promotions.map(p => p.row.user_id));
const rankedNoPromotion = users
  .filter(u => u.rank && ["student", "registration"].includes(u.role) && !promotedIds.has(u.id))
  .sort((a, b) => rankOrder(b.rank) - rankOrder(a.rank));

// legacy detection: stored weekly directs / team that cannot come from current students
for (const p of promotions) {
  const r = p.row;
  const joins = weekJoins(r.user_id, r.week_start);
  const teamNow = teamStudents(r.user_id, r.week_end);
  p.joins = joins;
  p.teamAtWeek = teamNow;
  p.legacyDirects = Number(r.qualified_direct_sales) > joins.length;
  p.legacyTeam = Number(r.qualified_team_count) > teamNow.length;
  // severity of the gap (used to word the caveat correctly)
  const ratioTeam = Number(r.qualified_team_count) > 0 ? teamNow.length / Number(r.qualified_team_count) : 1;
  const ratioDirects = Number(r.qualified_direct_sales) > 0 ? joins.length / Number(r.qualified_direct_sales) : 1;
  p.legacySeverity = (ratioTeam < 0.35 || ratioDirects < 0.35) ? "old-rules" : (p.legacyTeam || p.legacyDirects ? "changed" : null);
}

// Some legacy rows were written without `previous_rank`; infer it for display from the
// user's own timeline (never written back to the database).
const byUserSorted = new Map();
for (const p of promotions) {
  if (!byUserSorted.has(p.row.user_id)) byUserSorted.set(p.row.user_id, []);
  byUserSorted.get(p.row.user_id).push(p);
}
for (const [, list] of byUserSorted) {
  list.sort((a, b) => String(a.row.week_start).localeCompare(String(b.row.week_start)) || String(a.row.calculation_date).localeCompare(String(b.row.calculation_date)));
  let last = null;
  for (const p of list) {
    if (!p.row.previous_rank && last) {
      p.prevDisplay = last;
      p.prevInferred = true;
    } else {
      p.prevDisplay = p.row.previous_rank || null;
      p.prevInferred = false;
    }
    last = p.row.current_rank;
  }
}

// ─────────────────────────── report ───────────────────────────
const L = [];
const now = new Date();
const stamp = now.toISOString().slice(0, 19).replace("T", " ");
const totalPromotions = promotions.length;

L.push(`# 📊 تقرير الرتب والترقيات — Everest Academy`);
L.push("");
L.push(`> **تاريخ التقرير:** ${stamp} (UTC)  `);
L.push(`> **مصدر البيانات:** قاعدة الإنتاج (Turso) — \`users\`, \`weekly_history\`, \`weekly_settlements\`, \`user_closure\`, \`notifications\`, \`weekly_direct_assignments\`  `);
L.push(`> **نطاق التقرير:** كل حساب حصل على رتبة، مع توقيت الترقية، وطريقة احتسابها، ومَن ساهم فيها.`);
L.push("");

L.push(`## 1) كيف تُمنح الرتبة (القواعد الحالية)`);
L.push("");
L.push(`| البند | القاعدة |`);
L.push(`|---|---|`);
L.push(`| موعد الاحتساب | كل **جمعة 23:00** بتوقيت القاهرة (تسوية أسبوعية آلية) |`);
L.push(`| مصدر الرتبة | عدد **الفريق المؤهل** = الطلبة النشطون أسفل الحساب في كل المستويات، **باستثناء** من رتبته أعلى من رتبة الشخص وقت التسوية |`);
L.push(`| بوابة العمولة | **مباشران جديدان على الأقل (2)** خلال الأسبوع (طلبة، أو تخصيص رجعي معتمد) |`);
L.push(`| الحسابات المجانية | \`registration_free\` لا تُحتسب كبيعة مباشرة ولا داخل الفريق (منذ تعديل القواعد) |`);
L.push(`| عدم النزول | لا يتم تخفيض رتبة أي حساب بعد الحصول عليها |`);
L.push("");

L.push(`### حدود الرتب والعمولات`);
L.push("");
L.push(`| الرتبة | الحد الأدنى للفريق | العمولة الأسبوعية | حسابات بهذه الرتبة الآن |`);
L.push(`|---|---:|---:|---:|`);
for (const r of [...ranks].reverse()) {
  const c = users.filter(u => u.rank === r.name && ["student", "registration"].includes(u.role)).length;
  L.push(`| ${esc(r.name)} | ${r.required} | ${money(r.bonus)} EM | ${c} |`);
}
L.push("");

L.push(`## 2) الملخص`);
L.push("");
L.push(`| البند | القيمة |`);
L.push(`|---|---:|`);
L.push(`| حسابات لها رتبة حالياً | ${users.filter(u => u.rank && ["student", "registration"].includes(u.role)).length} |`);
L.push(`| حسابات حصلت على ترقية مسجّلة | ${promotedIds.size} |`);
L.push(`| أحداث الترقية (بعد إزالة التكرار) | ${totalPromotions} |`);
L.push(`| أسابيع تسوية مكتملة | ${[...settlements.values()].filter(s => s.status === "completed").length} |`);
L.push(`| إجمالي عمولات الرتب المدفوعة | ${money((await query("SELECT COALESCE(SUM(amount),0) t FROM weekly_commissions"))[0].t)} EM |`);
L.push("");

L.push(`## 3) الخط الزمني لكل الترقيات (${totalPromotions})`);
L.push("");
L.push(`| # | التاريخ والساعة | الأسبوع | الحساب | من | إلى | فريق (مخزّن) | مباشرون (مخزّن) | العمولة | الحالة |`);
L.push(`|---:|---|---|---|---|---|---:|---:|---|---|`);
promotions.forEach((p, i) => {
  const r = p.row;
  const u = byId.get(r.user_id);
  L.push(`| ${i + 1} | ${dt(r.calculation_date)} | ${r.week_start} → ${r.week_end} | **${nm(u)}** (\`${code(u)}\`) | ${p.prevDisplay || "بدون"}${p.prevInferred ? " \\*" : ""} | **${r.current_rank}** | ${r.qualified_team_count} | ${r.qualified_direct_sales} | ${money(r.weekly_commission)} EM | ${r.commission_status} |`);
});
L.push("");
L.push(`> \\* = الرتبة السابقة لم تُسجَّل في صف التسوية القديم، وتم استنتاجها من ترقية سابقة لنفس الحساب.`);
L.push("");
L.push(`> ⚠️ الأسابيع القديمة (أغسطس/بداية سبتمبر) سُجّلت بقواعد أقدم كانت تحتسب حسابات \`registration_free\` داخل الفريق والمباشرين، لذلك قد تكون الأرقام المخزّنة أكبر من المكوّن الحالي للشجرة. الأرقام المخزّنة هي المرجع الرسمي لتلك الفترة.`);
L.push("");

L.push(`## 4) التفصيل الكامل لكل شخص`);
L.push("");

const people = [...promotedIds].map(id => byId.get(id)).filter(Boolean);
people.sort((a, b) => rankOrder(b.rank) - rankOrder(a.rank) || String(a.full_name).localeCompare(String(b.full_name)));

people.forEach((u, idx) => {
  const mine = promotions.filter(p => p.row.user_id === u.id);
  const ref = referrerOf(u);
  const chain = chainOf(u, 3);
  const directs = directStudents(u.id);
  const teamNow = teamStudents(u.id);
  const firstPromo = mine[0];

  L.push(`### ${idx + 1}. ${nm(u)} — \`${code(u)}\` — **${u.rank || "بدون رتبة"}**`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| البريد | ${esc(u.email)} |`);
  if (u.phone) L.push(`| الهاتف | ${esc(u.phone)} |`);
  L.push(`| نوع الحساب / الحالة | ${u.account_type} / ${u.status} |`);
  L.push(`| تاريخ إنشاء الحساب | ${dt(u.created_at)} |`);
  L.push(`| الرتبة الحالية | **${u.rank || "—"}** |`);
  L.push(`| أول ترقية | ${firstPromo ? `${firstPromo.row.previous_rank || "بدون"} → ${firstPromo.row.current_rank} في ${dt(firstPromo.row.calculation_date)}` : "—"} |`);
  L.push(`| عدد الترقيات | ${mine.length} |`);
  L.push(`| رصيد E-Money | ${money(u.e_money)} |`);
  L.push(`| انضم عن طريق | ${ref ? `${nm(ref)} (\`${code(ref)}\`)` : "— (حساب جذري بدون راعي)"} |`);
  if (chain.length > 1) L.push(`| سلسلة الإحالة | ${chain.map(c => `${nm(c)} (\`${code(c)}\`)`).join(" ← ")} |`);
  L.push(`| مباشرون (طلبة) الآن | ${directs.length} |`);
  L.push(`| فريق طلبة نشطون الآن | ${teamNow.length} |`);
  L.push("");

  mine.forEach((p, j) => {
    const r = p.row;
    const req = rankByName.get(r.current_rank);
    const st = settlements.get(r.week_start);

    L.push(`#### ${j + 1}) ${p.prevDisplay || "بدون رتبة"}${p.prevInferred ? " \\*" : ""} → **${r.current_rank}**`);
    L.push("");
    L.push(`| البند | التفصيل |`);
    L.push(`|---|---|`);
    L.push(`| تاريخ وساعة الاحتساب | **${dt(r.calculation_date)}** |`);
    L.push(`| أسبوع التسوية | ${r.week_start} → ${r.week_end}${st ? ` — أُغلقت ${dt(st.completed_at)} (${st.triggered_by === "manual" ? "تشغيل يدوي" : "تشغيل تلقائي"})` : ""} |`);
    if (req) L.push(`| شرط الرتبة | فريق مؤهل ≥ **${req.required}** — عمولة ${money(req.bonus)} EM |`);
    L.push(`| الفريق المؤهل (المخزّن وقت التسوية) | **${r.qualified_team_count}** |`);
    L.push(`| المباشرون الجدد في الأسبوع (المخزّن) | **${r.qualified_direct_sales}** |`);
    L.push(`| إجمالي المباشرين وقتها | ${r.total_direct_sales} |`);
    L.push(`| العمولة | ${money(r.weekly_commission)} EM — \`${r.commission_status}\`${r.failure_reason ? ` (${esc(r.failure_reason)})` : ""} |`);
    if (p.duplicates > 1) L.push(`| ملاحظة | الأسبوع أُعيدت تسويته ${p.duplicates} مرات — هذا هو الصف النهائي المعتمد |`);
    L.push("");

    L.push(`**👥 مَن صنع الترقية — انضموا في هذا الأسبوع (${p.joins.length}):**`);
    L.push("");
    if (p.joins.length === 0) {
      L.push(`> لا يوجد مباشرون (طلبة) مسجّلون لهذا الأسبوع حالياً${p.legacyDirects ? ` — لكن السجل يقول **${r.qualified_direct_sales}** مباشر (قواعد قديمة كانت تحتسب \`registration_free\`)` : ""}.`);
    } else {
      L.push(`| الحساب | الكود | تاريخ الانضمام | الرتبة الحالية | طريقة الاحتساب |`);
      L.push(`|---|---|---|---|---|`);
      for (const d of p.joins) {
        L.push(`| ${nm(d.user)} | \`${code(d.user)}\` | ${dt(d.user.created_at)} | ${d.user.rank || "—"} | ${d.assigned ? "تخصيص رجعي" : "داخل الأسبوع"} |`);
      }
    }
    L.push("");

    if (p.teamAtWeek.length) {
      const show = p.teamAtWeek.slice(0, 25);
      L.push(`**🧑‍🤝‍🧑 أعضاء الفريق (طلبة نشطون حتى نهاية الأسبوع) — ${p.teamAtWeek.length}${p.legacyTeam ? ` / المخزّن ${r.qualified_team_count}` : ""}:**`);
      L.push("");
      L.push(`| الحساب | الكود | المستوى | الرتبة الحالية | انضم في |`);
      L.push(`|---|---|---:|---|---|`);
      for (const t of show) {
        L.push(`| ${nm(t.user)} | \`${code(t.user)}\` | ${t.depth} | ${t.user.rank || "—"} | ${dt(t.user.created_at)} |`);
      }
      if (p.teamAtWeek.length > show.length) L.push(`| … | | | | *و${p.teamAtWeek.length - show.length} عضواً آخر* |`);
      L.push("");
    }
    if (p.legacyTeam) {
      const msg = p.legacySeverity === "old-rules"
        ? `السجل يقول إن الفريق المؤهل كان **${r.qualified_team_count}** عضو، بينما الموجود حالياً من الطلبة النشطين حتى نهاية ذلك الأسبوع **${p.teamAtWeek.length}** فقط — الفرق الكبير سببه أن القواعد القديمة كانت تحتسب \`registration_free\`.`
        : `السجل يقول **${r.qualified_team_count}** عضو، والمطابق حالياً **${p.teamAtWeek.length}** — الفرق البسيط بسبب تغيّر حالة/نوع بعض الأعضاء (إيقاف أو ترقية) بعد التسوية.`;
      L.push(`> ⚠️ ${msg}`);
      L.push("");
    }
  });

  if (directs.length) {
    L.push(`**🌱 مباشرونه الحاليون (${directs.length}):**`);
    L.push("");
    L.push(`| الحساب | الكود | انضم في | الرتبة | الحالة |`);
    L.push(`|---|---|---|---|---|`);
    for (const d of directs.slice(0, 40)) {
      L.push(`| ${nm(d)} | \`${code(d)}\` | ${dt(d.created_at)} | ${d.rank || "—"} | ${d.status} |`);
    }
    if (directs.length > 40) L.push(`| … | | | | *و${directs.length - 40} آخرين* |`);
    L.push("");
  }

  const notifs = notifsByUser.get(u.id) || [];
  if (notifs.length) {
    L.push(`**🔔 إشعارات الرتب المرسلة (${notifs.length}):** ${notifs.map(n => dt(n.created_at)).join(" • ")}`);
    L.push("");
  }

  L.push("---");
  L.push("");
});

L.push(`## 5) حسابات لها رتبة بدون حدث ترقية مسجّل`);
L.push("");
if (rankedNoPromotion.length === 0) L.push(`_لا يوجد._`);
else {
  L.push(`> الرتبة موجودة على الحساب لكن لا يوجد صف ترقية (\`current_rank ≠ previous_rank\`) في \`weekly_history\` — غالباً مُنحت يدوياً أو الحساب أُنشئ برتبة.`);
  L.push("");
  L.push(`| الحساب | الكود | الرتبة | تاريخ الإنشاء | الراعي |`);
  L.push(`|---|---|---|---|---|`);
  for (const u of rankedNoPromotion) {
    const ref = referrerOf(u);
    L.push(`| ${nm(u)} | \`${code(u)}\` | ${u.rank} | ${dt(u.created_at)} | ${ref ? `${nm(ref)} (\`${code(ref)}\`)` : "—"} |`);
  }
}
L.push("");

L.push(`## 6) ملاحظات ودقة البيانات`);
L.push("");
L.push(`1. **الأرقام المخزّنة وقت التسوية** (الفريق المؤهل، المباشرون، العمولة) هي المرجع الرسمي لأي أسبوع.`);
L.push(`2. **قوائم الأسماء** مُعاد بناؤها من الشجرة الحالية (\`user_closure\` + \`users\`)، لأنه لا يوجد أرشيف لحظي لأعضاء الفريق وقت كل تسوية.`);
L.push(`3. **تغيّر القواعد:** الأسابيع القديمة احتسبت \`registration_free\` داخل الفريق/المباشرين؛ القواعد الحالية تستبعدها. لذلك بعض الحسابات القديمة (مثل \`ahmed elgenady\` و\`مريم عصام\`) لديها أرقام تاريخية كبيرة لا يمكن مطابقتها بالشجرة الحالية.`);
L.push(`4. **تكرار التسوية:** أسبوع \`2026-09-04\` سُوّي مرتين؛ تم الاحتفاظ بالصف النهائي فقط وإزالة التكرار في هذا التقرير.`);
L.push(`5. **إشعارات «Rank Up»** تحتوي تكرارات من تشغيلات قديمة (${totalNotifs} إشعاراً مقابل ${totalPromotions} ترقية) — لا تُستخدم كمصدر للحقيقة، فقط كسجل إبلاغ.`);
L.push(`6. **التخصيص الرجعي:** بعض المباشرين أُسندوا لأسبوع معيّن بقرار إداري مسجّل في \`weekly_direct_assignments\` (مع أثر تدقيقي كامل)، بدلاً من تعديل تاريخ إنشاء الحساب. يظهر ذلك في عمود «طريقة الاحتساب» بـ «تخصيص رجعي».`);
L.push(`7. \`users.created_at\` لم يُعدّل لأي حساب، ولا تم تغيير أي رتبة يدوياً في هذا التقرير.`);
L.push("");
L.push(`_تم إنشاء هذا التقرير آلياً من بيانات الإنتاج._`);

fs.mkdirSync(REPORTS_DIR, { recursive: true });
const mdPath = path.join(REPORTS_DIR, `rank-report-${now.toISOString().slice(0, 10)}.md`);
fs.writeFileSync(mdPath, L.join("\n"), "utf8");

// ─────────────────────────── CSV ───────────────────────────
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = [[
  "week_start", "week_end", "settlement_closed_at", "calculated_at",
  "name", "code", "email", "phone", "account_type",
  "previous_rank", "current_rank", "rank_requirement", "qualified_team_stored",
  "active_students_in_team_now", "qualified_directs_stored", "directs_found_names",
  "weekly_commission", "commission_status",
  "referrer_name", "referrer_code", "legacy_week",
].join(",")];
for (const p of promotions) {
  const r = p.row;
  const u = byId.get(r.user_id);
  const st = settlements.get(r.week_start);
  const ref = referrerOf(u);
  const req = rankByName.get(r.current_rank);
  csv.push([
    r.week_start, r.week_end,
    st ? st.completed_at : "", r.calculation_date,
    u.full_name, code(u), u.email, u.phone || "", u.account_type,
    r.previous_rank || "", r.current_rank,
    req ? req.required : "", r.qualified_team_count,
    p.teamAtWeek.length, r.qualified_direct_sales,
    p.joins.map(d => `${nm(d.user)} (${code(d.user)})`).join(" | "),
    r.weekly_commission, r.commission_status,
    ref ? nm(ref) : "", ref ? code(ref) : "",
    (p.legacyDirects || p.legacyTeam) ? "YES" : "NO",
  ].map(q).join(","));
}
const csvPath = path.join(REPORTS_DIR, `rank-promotions-${now.toISOString().slice(0, 10)}.csv`);
fs.writeFileSync(csvPath, "\uFEFF" + csv.join("\r\n"), "utf8");

console.log(JSON.stringify({
  markdown: mdPath,
  csv: csvPath,
  promotions: totalPromotions,
  people: people.length,
  rankedWithoutPromotion: rankedNoPromotion.length,
  legacyWeeks: promotions.filter(p => p.legacyDirects || p.legacyTeam).map(p => p.row.week_start),
}, null, 2));
process.exit(0);

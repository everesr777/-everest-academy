import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TIMEZONES = ["Africa/Cairo","Africa/Casablanca","Africa/Johannesburg","Asia/Riyadh","Asia/Dubai","Asia/Amman","Asia/Beirut","Europe/London","Europe/Paris","UTC","America/New_York","America/Los_Angeles"];

export default function WeeklySettlementPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);

  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ settlement_enabled: "true", settlement_day: "5", settlement_hour: "23", settlement_minute: "0", settlement_timezone: "Africa/Cairo", settlement_min_direct_sales: "2" });
  const [weekly, setWeekly] = useState([]);
  const [weeklyWeek, setWeeklyWeek] = useState("");
  const [history, setHistory] = useState([]);
  const [openWeek, setOpenWeek] = useState(null);
  const [openWeekData, setOpenWeekData] = useState([]);
  const [openCommWeek, setOpenCommWeek] = useState(null);
  const [weekComms, setWeekComms] = useState([]);
  const [reversing, setReversing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const getAdminId = () => { try { return JSON.parse(localStorage.getItem("admin_session") || "{}").userId; } catch { return null; } };

  const loadAll = () => {
    api("/api/mlm/settlement/status").then((d) => {
      setStatus(d);
      if (d.settings) setForm({
        settlement_enabled: d.settings.settlement_enabled || "true",
        settlement_day: d.settings.settlement_day || "5",
        settlement_hour: d.settings.settlement_hour || "23",
        settlement_minute: d.settings.settlement_minute || "0",
        settlement_timezone: d.settings.settlement_timezone || "Africa/Cairo",
        settlement_min_direct_sales: d.settings.settlement_min_direct_sales || "2",
      });
    }).catch(() => {});
    api("/api/leaders/weekly").then((d) => { setWeekly(d.leaders || []); setWeeklyWeek(d.weekStart || ""); }).catch(() => {});
    api("/api/leaders/history").then(setHistory).catch(() => {});
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    const adminId = getAdminId();
    if (!adminId) { setErr(t("معرف المدير غير موجود. أعد تسجيل الدخول.", "Admin ID not found. Please login again.")); return; }
    setSaving(true); setMsg(""); setErr("");
    try {
      for (const [key, value] of Object.entries(form)) {
        await api(`/api/settings/${key}`, { method: "PUT", body: JSON.stringify({ value: String(value), admin_id: adminId }) });
      }
      setMsg(t("تم حفظ إعدادات التسوية الأسبوعية ✅", "Weekly settlement settings saved ✅"));
      loadAll();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const runSettlement = async () => {
    if (!confirm(t("تشغيل التسوية الأسبوعية الآن؟", "Run weekly settlement now?"))) return;
    const adminId = getAdminId();
    if (!adminId) { setErr(t("معرف المدير غير موجود. أعد تسجيل الدخول.", "Admin ID not found. Please login again.")); return; }
    setRunning(true); setMsg(""); setErr("");
    try {
      const r = await api("/api/mlm/settlement", { method: "POST", body: JSON.stringify({ admin_id: adminId }) });
      setMsg(t(`✅ التسوية تمت للأسبوع ${r.weekStart} — تم صرف ${r.awarded} عمولة (${r.totalCommissions} EM)`, `✅ Settlement done for week ${r.weekStart} — ${r.awarded} commissions paid (${r.totalCommissions} EM)`));
      loadAll();
    } catch (e) { setErr(e.message); } finally { setRunning(false); }
  };

  const toggleWeek = async (ws) => {
    if (openWeek === ws) { setOpenWeek(null); setOpenWeekData([]); return; }
    setOpenWeek(ws);
    api(`/api/leaders/history/${ws}`).then((d) => setOpenWeekData(d.leaders || [])).catch(() => setOpenWeekData([]));
  };

  const toggleComms = async (ws) => {
    if (openCommWeek === ws) { setOpenCommWeek(null); setWeekComms([]); return; }
    setOpenCommWeek(ws);
    setWeekComms([]);
    api(`/api/mlm/settlement/week/${ws}`).then((d) => setWeekComms(d.commissions || [])).catch(() => setWeekComms([]));
  };

  const reverseCommission = async (c) => {
    if (!confirm(t(`خصم ${c.amount} E-Money من ${c.full_name} (عمولة ${c.rank_name})؟`, `Deduct ${c.amount} E-Money from ${c.full_name} (${c.rank_name} commission)?`))) return;
    setReversing(c.id);
    try {
      await api("/api/mlm/settlement/reverse", { method: "POST", body: JSON.stringify({ user_id: c.user_id, week_start: c.week_start }) });
      const d = await api(`/api/mlm/settlement/week/${c.week_start}`);
      setWeekComms(d.commissions || []);
      setMsg(t(`✅ تم خصم ${c.amount} E-Money من ${c.full_name}`, `✅ Deducted ${c.amount} E-Money from ${c.full_name}`));
      setErr("");
    } catch (e) { setErr(e.message); } finally { setReversing(null); }
  };

  const cfg = status?.config || {};
  const next = status?.nextSettlement || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t("⏳ التسوية الأسبوعية للعمولات", "⏳ Weekly Commission Settlement")}</h2>
          <p className="text-gray-500 text-sm mt-1">{t("ضبط موعد التسوية، عمولة واحدة على آخر رتبة مؤهلة، تصفير المبيعات الأسبوعية، وقائمة Top 10 مع السجل الأسبوعي", "Configure settlement timing, single commission on last qualified rank, weekly sales reset, and Top-10 with weekly history")}</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("التسوية التلقائية", "Auto Settlement"), value: cfg.enabled ? t("مفعلة ✅", "Enabled ✅") : t("معطلة 🚫", "Disabled 🚫"), icon: "⏰", color: cfg.enabled ? "#10b981" : "#ef4444" },
          { label: t("الموعد القادم", "Next Settlement"), value: next ? next.label : "—", icon: "📅", color: "#6366f1" },
          { label: t("الأسبوع الجاري", "Current Week"), value: status?.currentWeek?.weekStart || "—", icon: "🗓️", color: "#8b5cf6" },
          { label: t("آخر تسوية", "Last Settlement"), value: status?.lastRun ? status.lastRun.split("|").slice(0, 2).join(" — ") : t("لم تبدأ بعد", "Not run yet"), icon: "🏁", color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: s.color + "15" }}>{s.icon}</div>
              <div className="min-w-0">
                <p className="text-gray-400 text-xs">{s.label}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Settings form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold mb-1">{t("🕐 إعدادات موعد التسوية", "🕐 Settlement Timing Settings")}</h3>
          <p className="text-sm text-gray-400 mb-5">{t("الأسبوع يبدأ من اليوم المحدد 00:00 وينتهي قبل نفس اليوم بالأسبوع التالي، ويتم تسوية العمولات بعد انتهائه مباشرة.", "The week starts on the configured day 00:00 and ends before the same day next week; commissions settle right after it ends.")}</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("تفعيل التسوية التلقائية", "Enable Auto Settlement")}</label>
              <div className="flex gap-3">
                {[{ v: "true", l: t("🟢 مفعلة", "🟢 Enabled") }, { v: "false", l: t("🔴 معطلة", "🔴 Disabled") }].map((o) => (
                  <button key={o.v} onClick={() => setForm({ ...form, settlement_enabled: o.v })}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition ${form.settlement_enabled === o.v ? "border-everest-500 bg-everest-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className="text-sm font-medium">{o.l}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("يوم التسوية (بداية/نهاية الأسبوع)", "Settlement Day (week start/end)")}</label>
              <select value={form.settlement_day} onChange={(e) => setForm({ ...form, settlement_day: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("الساعة", "Hour")}</label>
                <input type="number" min="0" max="23" value={form.settlement_hour} onChange={(e) => setForm({ ...form, settlement_hour: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("الدقيقة", "Minute")}</label>
                <input type="number" min="0" max="59" value={form.settlement_minute} onChange={(e) => setForm({ ...form, settlement_minute: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("المنطقة الزمنية (Timezone)", "Timezone")}</label>
              <input list="tz-list" value={form.settlement_timezone} onChange={(e) => setForm({ ...form, settlement_timezone: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none" />
              <datalist id="tz-list">{TIMEZONES.map((z) => <option key={z} value={z} />)}</datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("الحد الأدنى للمبيعات المباشرة للتأهل للعمولة", "Minimum Direct Sales for Commission Eligibility")}</label>
              <input type="number" min="0" value={form.settlement_min_direct_sales} onChange={(e) => setForm({ ...form, settlement_min_direct_sales: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button onClick={saveSettings} disabled={saving}
              className="flex-1 px-4 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition disabled:opacity-50">
              {saving ? t("جاري الحفظ...", "Saving...") : t("💾 حفظ الإعدادات", "💾 Save Settings")}
            </button>
            <button onClick={runSettlement} disabled={running}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 transition disabled:opacity-50">
              {running ? t("جاري التسوية...", "Settling...") : t("▶️ تشغيل التسوية الآن", "▶️ Run Settlement Now")}
            </button>
          </div>
          {msg && <p className="text-sm text-green-600 mt-3 bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}
          {err && <p className="text-sm text-red-600 mt-3 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        </div>

        {/* Current week leaderboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold">{t("🏆 قادة هذا الأسبوع (Top 10)", "🏆 This Week's Leaders (Top 10)")}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{weeklyWeek}</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">{t("مرتبون حسب المبيعات الأسبوعية ثم الرتبة.", "Sorted by weekly sales, then rank.")}</p>
          {weekly.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">🏆</p>
              <p className="text-sm">{t("لا توجد مبيعات مسجلة هذا الأسبوع بعد", "No weekly sales recorded yet")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {weekly.map((l, i) => (
                <div key={l.user_id} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: i < 3 ? ["#fbbf24","#cbd5e1","#f59e0b"][i] + "33" : "#eef2ff", color: i < 3 ? ["#b45309","#475569","#92400e"][i] : "#6366f1" }}>
                    {i + 1}
                  </div>
                  {l.avatar ? <img src={l.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-everest-600 text-white flex items-center justify-center text-sm font-bold">{(l.full_name || "U")[0]}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{l.full_name}</p>
                    <p className="text-xs text-gray-400">{l.rank || t("بدون رتبة", "No rank")}</p>
                  </div>
                  <span className="text-sm font-bold text-everest-600">{l.weekly_sales} {t("مبيعة", "sales")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settlement runs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">{t("📜 سجل التسويات", "📜 Settlement Log")}</h3>
        {(!status?.runs || status.runs.length === 0) ? (
          <p className="text-gray-400 text-sm text-center py-6">{t("لم يتم تشغيل أي تسوية بعد", "No settlements have run yet")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                <th className="text-right py-2 px-3 text-gray-400 font-medium">{t("الأسبوع", "Week")}</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">{t("الحالة", "Status")}</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">{t("المصدر", "Trigger")}</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">{t("التاريخ", "Date")}</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">{t("العمولات", "Commissions")}</th>
              </tr></thead>
              <tbody>
                {status.runs.map((r) => (
                  <tr key={r.week_start} className="border-b border-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{r.week_start} → {r.week_end}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "completed" ? "bg-green-100 text-green-700" : r.status === "running" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{r.triggered_by === "manual" ? t("يدوي", "Manual") : t("تلقائي", "Auto")}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{r.completed_at || r.created_at}</td>
                    <td className="py-2 px-3">
                      {r.status === "completed" && (
                        <button onClick={() => toggleComms(r.week_start)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${openCommWeek === r.week_start ? "bg-everest-600 text-white" : "bg-everest-50 text-everest-700 hover:bg-everest-100"}`}>
                          {openCommWeek === r.week_start ? "▲ " : "💰 "}{t("العمولات", "Commissions")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {openCommWeek && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-800">{t(`عمولات أسبوع ${openCommWeek}`, `Commissions for week ${openCommWeek}`)}</h4>
              <span className="text-xs text-gray-400">{weekComms.length} {t("عمولة", "commissions")}</span>
            </div>
            {weekComms.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t("لا توجد عمولات مسجلة لهذا الأسبوع", "No commissions recorded for this week")}</p>
            ) : (
              <div className="space-y-1.5">
                {weekComms.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    {c.avatar ? <img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-everest-600 text-white flex items-center justify-center text-xs font-bold">{(c.full_name || "U")[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.full_name}</p>
                      <p className="text-xs text-gray-400">
                        {c.rank_name}{c.account_type === "registration_free" ? ` • ${t("حساب مجاني", "Free account")}` : ""}
                        {c.status === "cancelled" && <span className="text-amber-600 font-medium"> • {t("ملغاة", "Cancelled")}</span>}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${c.status === "cancelled" ? "text-gray-400 line-through" : "text-everest-600"}`}>{c.amount} EM</span>
                    {c.status === "paid" && (
                      <button onClick={() => reverseCommission(c)} disabled={reversing === c.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50">
                        {reversing === c.id ? t("جاري...", "Working...") : t("خصم العمولة", "Deduct")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold mb-4">{t("🕓 سجل قادة الأسابيع (Leaderboard History)", "🕓 Weekly Leaderboard History")}</h3>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">{t("لا يوجد سجل بعد", "No history yet")}</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.week_start} className="border border-gray-100 rounded-xl overflow-hidden">
                <button onClick={() => toggleWeek(h.week_start)} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">{h.week_start}</span>
                    <span className="text-xs text-gray-400">{h.entries} {t("قائد", "leaders")}</span>
                  </div>
                  <span className={`text-xs font-medium ${openWeek === h.week_start ? "text-everest-600" : "text-gray-400"}`}>{openWeek === h.week_start ? "▲" : "▼"}</span>
                </button>
                {openWeek === h.week_start && (
                  <div className="p-3 pt-0">
                    <div className="space-y-1.5">
                      {openWeekData.map((l) => (
                        <div key={l.rank_position} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="w-6 text-center text-sm font-bold text-everest-600">{l.rank_position}</span>
                          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{l.full_name}</span>
                          <span className="text-xs text-gray-400">{l.rank || "—"}</span>
                          <span className="text-sm font-bold text-gray-700">{l.weekly_sales} {t("مبيعة", "sales")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

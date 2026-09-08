import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../api";

const EVENT_TYPES = [
  { key: "all", ar: "الكل", en: "All" },
  { key: "commission", ar: "عمولة إحالة", en: "Referral Commission", color: "#10b981", bg: "#d1fae5", icon: "🤝" },
  { key: "weekly_commission", ar: "عمولة أسبوعية", en: "Weekly Commission", color: "#14b8a6", bg: "#ccfbf1", icon: "📅" },
  { key: "rank_up", ar: "ترقية رتبة", en: "Rank Up", color: "#8b5cf6", bg: "#ede9fe", icon: "⬆️" },
  { key: "rank_change", ar: "تغيير رتبة", en: "Rank Change", color: "#8b5cf6", bg: "#ede9fe", icon: "🔁" },
  { key: "rank_down", ar: "هبوط رتبة", en: "Rank Down", color: "#ef4444", bg: "#fee2e2", icon: "⬇️" },
  { key: "rank_bonus", ar: "مكافأة ترقية", en: "Rank Bonus", color: "#f472b6", bg: "#fce7f3", icon: "🎁" },
  { key: "wallet_credit", ar: "إيداع محفظة", en: "Wallet Credit", color: "#06b6d4", bg: "#cffafe", icon: "➕" },
  { key: "wallet_debit", ar: "خصم محفظة", en: "Wallet Debit", color: "#f59e0b", bg: "#fef3c7", icon: "➖" },
  { key: "topup", ar: "شحن رصيد", en: "Top-up", color: "#3b82f6", bg: "#dbeafe", icon: "💳" },
  { key: "transfer", ar: "تحويل بين المستخدمين", en: "User Transfer", color: "#6d28d9", bg: "#e9d5ff", icon: "🔄" },
  { key: "admin_action", ar: "إجراء مشرف", en: "Admin Action", color: "#6b7280", bg: "#f3f4f6", icon: "🛡️" },
];

const RANK_ORDER = ["","Star","Executive","Executive Star","Team Leader","Senior Leader","Regional Leader","Everest Elite","Everest Master","Everest Legend","Everest Ambassador"];

export default function ActivityFeedPage() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchUser, setSearchUser] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterType !== "all") params.set("type", filterType);
      if (searchUser) params.set("userId", searchUser);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const res = await api(`/api/activity-feed?${params}`);
      setEvents(res.events || []);
      setSummary(res.summary || {});
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, filterType]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); load(); };
  const resetFilters = () => { setFilterType("all"); setSearchUser(""); setFromDate(""); setToDate(""); setPage(1); };

  const evMeta = (key) => EVENT_TYPES.find(ev => ev.key === key);
  const evLabel = (key) => { const f = evMeta(key); return f ? t(f.ar, f.en) : key; };
  const evColor = (key) => { const f = evMeta(key); return f ? f.color : "#6b7280"; };
  const evBg = (key) => { const f = evMeta(key); return f ? f.bg : "#f3f4f6"; };
  const evIcon = (key) => { const f = evMeta(key); return f ? f.icon : "🔔"; };

  const statusLabel = (s) => {
    if (!s) return "—";
    const map = { completed: t("مكتمل","Completed"), paid: t("مدفوع","Paid"), approved: t("موافق","Approved"), active: t("نشط","Active"), pending: t("معلق","Pending"), running: t("قيد التنفيذ","Running"), cancelled: t("ملغي","Cancelled"), rejected: t("مرفوض","Rejected"), failed: t("فشل","Failed") };
    return map[s] || s;
  };

  const rankLabel = (r) => {
    if (!r || r === "") return t("بدون رتبة","No rank");
    return r;
  };

  const summaryCards = [
    { label: t("إجمالي الأحداث", "Total Events"), value: summary.totalEvents, icon: "🗂️", color: "#6366f1", bg: "#eef2ff" },
    { label: t("إجمالي العمولات (EM)", "Total Commissions (EM)"), value: summary.totalCommission, icon: "💎", color: "#10b981", bg: "#d1fae5" },
    { label: t("إيداعات المحفظة (EM)", "Wallet Credits (EM)"), value: summary.totalIn, icon: "➕", color: "#06b6d4", bg: "#cffafe" },
    { label: t("عمليات الخصم (EM)", "Wallet Debits (EM)"), value: summary.totalOut, icon: "➖", color: "#f59e0b", bg: "#fef3c7" },
    { label: t("تغييرات الرتب", "Rank Changes"), value: summary.rankChanges, icon: "🏅", color: "#8b5cf6", bg: "#ede9fe" },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">{t("💼 نشاط الفلوس والرتب", "💼 Money & Ranks Activity")}</h1>
          <p className="text-sm text-theme-text-secondary mt-1">{total} {t("حدث", "events")}</p>
        </div>
        <button onClick={() => { setPage(1); load(); }} className="btn text-sm px-5 py-2 rounded-xl font-bold text-white"
          style={{ background: "linear-gradient(135deg,#6A35F0,#B78CFF)" }}>
          {t("🔄 تحديث", "🔄 Refresh")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {summaryCards.map((c, i) => (
          <div key={i} className="bg-theme-surface rounded-2xl shadow-card border border-theme-border p-4"
            style={{ animation: `slideUp 0.35s ease ${i * 0.06}s both` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: c.bg }}>{c.icon}</span>
              <p className="text-theme-text-secondary text-[10px] font-medium">{c.label}</p>
            </div>
            <p className="text-xl font-extrabold text-theme-text-primary">{(c.value || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-theme-text-secondary mb-1">{t("النوع", "Type")}</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="input text-sm px-3 py-2 rounded-xl border border-theme-border bg-theme-secondary text-theme-text-primary focus:ring-2 focus:ring-everest-400 outline-none">
              {EVENT_TYPES.map(ev => <option key={ev.key} value={ev.key}>{t(ev.ar, ev.en)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-secondary mb-1">{t("معرف المستخدم", "User ID")}</label>
            <input type="text" value={searchUser} onChange={e => setSearchUser(e.target.value)}
              placeholder={t("اختياري", "Optional")}
              className="input text-sm px-3 py-2 rounded-xl border border-theme-border bg-theme-secondary text-theme-text-primary focus:ring-2 focus:ring-everest-400 outline-none w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-secondary mb-1">{t("من تاريخ", "From Date")}</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="input text-sm px-3 py-2 rounded-xl border border-theme-border bg-theme-secondary text-theme-text-primary focus:ring-2 focus:ring-everest-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-secondary mb-1">{t("إلى تاريخ", "To Date")}</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="input text-sm px-3 py-2 rounded-xl border border-theme-border bg-theme-secondary text-theme-text-primary focus:ring-2 focus:ring-everest-400 outline-none" />
          </div>
          <button type="submit" className="btn text-sm px-5 py-2 rounded-xl font-bold text-white"
            style={{ background: "linear-gradient(135deg,#6A35F0,#B78CFF)" }}>
            {t("بحث", "Search")}
          </button>
          <button type="button" onClick={resetFilters} className="text-sm px-4 py-2 rounded-xl font-medium border border-theme-border text-theme-text-secondary hover:bg-theme-secondary">
            {t("إعادة تعيين", "Reset")}
          </button>
        </form>
      </div>

      {/* Timeline / Table */}
      <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-theme-text-secondary">{t("جاري التحميل...", "Loading...")}</p>
        ) : events.length === 0 ? (
          <p className="text-center py-12 text-theme-text-secondary">{t("لا توجد أحداث", "No events found")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme-border bg-theme-secondary">
                  <th className="table-header">{t("النوع", "Type")}</th>
                  <th className="table-header">{t("الوصف", "Description")}</th>
                  <th className="table-header">{t("من", "From")}</th>
                  <th className="table-header">{t("إلى", "To")}</th>
                  <th className="table-header">{t("المبلغ", "Amount")}</th>
                  <th className="table-header">{t("الحالة", "Status")}</th>
                  <th className="table-header">{t("التاريخ", "Date")}</th>
                  <th className="table-header">{t("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={ev.id || i} className="table-row">
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: evBg(ev.type), color: evColor(ev.type) }}>
                        <span>{evIcon(ev.type)}</span>{evLabel(ev.type)}
                      </span>
                    </td>
                    <td className="table-cell text-theme-text-primary font-medium text-xs max-w-[260px]">
                      <div className="truncate" title={ev.title || ""}>{ev.title || "—"}</div>
                      {ev.details && <div className="text-theme-text-secondary text-[10px] truncate" title={ev.details}>{ev.details}</div>}
                    </td>
                    <td className="table-cell text-theme-text-primary text-xs">{ev.from?.name || "—"}</td>
                    <td className="table-cell text-theme-text-primary text-xs">
                      {ev.to?.name || "—"}
                      {ev.to?.rank ? <span className="block text-theme-text-secondary text-[10px]">{t("رتبة", "Rank")}: {ev.to.rank}</span> : null}
                    </td>
                    <td className="table-cell font-bold text-xs" style={{ color: ev.amount != null && ev.amount > 0 ? (ev.type === "wallet_debit" || ev.type === "transfer" ? "#f59e0b" : "#10b981") : "#6b7280" }}>
                      {ev.amount != null ? `${parseFloat(ev.amount).toLocaleString()} EM` : "—"}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${
                        ev.status === "completed" || ev.status === "paid" || ev.status === "approved" || ev.status === "active" ? "badge-green" :
                        ev.status === "pending" || ev.status === "running" ? "badge-yellow" :
                        ev.status === "cancelled" || ev.status === "rejected" || ev.status === "failed" ? "badge-red" : "badge-gray"
                      }`}>
                        {statusLabel(ev.status)}
                      </span>
                    </td>
                    <td className="table-cell text-theme-text-secondary text-[10px] whitespace-nowrap">
                      {ev.time ? ev.time.slice(0, 19).replace(" ", " · ") : "—"}
                    </td>
                    <td className="table-cell">
                      <button onClick={() => setSelectedEvent(ev)}
                        className="px-3 py-1 text-[11px] font-bold rounded-lg text-white transition hover:opacity-80"
                        style={{ background: evColor(ev.type) }}>
                        {t("عرض", "View")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-theme-border">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-theme-border text-theme-text-secondary disabled:opacity-40 hover:bg-theme-secondary">
              {t("السابق", "Prev")}
            </button>
            <span className="text-sm text-theme-text-secondary">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-theme-border text-theme-text-secondary disabled:opacity-40 hover:bg-theme-secondary">
              {t("التالي", "Next")}
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedEvent(null)} />
          <div className="relative bg-theme-surface rounded-2xl shadow-2xl border border-theme-border w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ animation: "slideUp 0.25s ease both" }}>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-theme-border bg-theme-surface rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: evBg(selectedEvent.type) }}>
                  {evIcon(selectedEvent.type)}
                </span>
                <div>
                  <h3 className="font-bold text-theme-text-primary text-sm">{t("تفاصيل الحدث", "Event Details")}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5" style={{ background: evBg(selectedEvent.type), color: evColor(selectedEvent.type) }}>
                    {evLabel(selectedEvent.type)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-theme-text-secondary hover:bg-theme-secondary transition text-lg">✕</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Title / Description */}
              <div>
                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("الوصف", "Description")}</label>
                <p className="text-sm font-medium text-theme-text-primary mt-1">{selectedEvent.title || "—"}</p>
                {selectedEvent.details && <p className="text-xs text-theme-text-secondary mt-1">{selectedEvent.details}</p>}
              </div>

              {/* From / To */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-theme-secondary rounded-xl p-3">
                  <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("من", "From")}</label>
                  <p className="text-sm font-bold text-theme-text-primary mt-1">{selectedEvent.from?.name || "—"}</p>
                  {selectedEvent.from?.id && <p className="text-[10px] text-theme-text-secondary">{selectedEvent.from.id}</p>}
                  {selectedEvent.from?.rank && <p className="text-[10px] text-theme-text-secondary">{t("رتبة", "Rank")}: {selectedEvent.from.rank}</p>}
                </div>
                <div className="bg-theme-secondary rounded-xl p-3">
                  <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("إلى", "To")}</label>
                  <p className="text-sm font-bold text-theme-text-primary mt-1">{selectedEvent.to?.name || "—"}</p>
                  {selectedEvent.to?.id && <p className="text-[10px] text-theme-text-secondary">{selectedEvent.to.id}</p>}
                  {selectedEvent.to?.rank && <p className="text-[10px] text-theme-text-secondary">{t("رتبة", "Rank")}: {selectedEvent.to.rank}</p>}
                </div>
              </div>

              {/* Amount + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-theme-secondary rounded-xl p-3">
                  <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("المبلغ", "Amount")}</label>
                  <p className="text-lg font-extrabold mt-1" style={{ color: selectedEvent.amount != null && selectedEvent.amount > 0 ? (selectedEvent.type === "wallet_debit" ? "#f59e0b" : "#10b981") : "#6b7280" }}>
                    {selectedEvent.amount != null ? `${parseFloat(selectedEvent.amount).toLocaleString()} EM` : "—"}
                  </p>
                </div>
                <div className="bg-theme-secondary rounded-xl p-3">
                  <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("الحالة", "Status")}</label>
                  <p className="mt-1">
                    <span className={`badge text-xs ${
                      selectedEvent.status === "completed" || selectedEvent.status === "paid" || selectedEvent.status === "approved" || selectedEvent.status === "active" ? "badge-green" :
                      selectedEvent.status === "pending" || selectedEvent.status === "running" ? "badge-yellow" :
                      selectedEvent.status === "cancelled" || selectedEvent.status === "rejected" || selectedEvent.status === "failed" ? "badge-red" : "badge-gray"
                    }`}>
                      {statusLabel(selectedEvent.status)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Date */}
              <div className="bg-theme-secondary rounded-xl p-3">
                <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("التاريخ والوقت", "Date & Time")}</label>
                <p className="text-sm font-medium text-theme-text-primary mt-1">
                  {selectedEvent.time ? selectedEvent.time.slice(0, 19).replace(" ", "  ·  ") : "—"}
                </p>
              </div>

              {/* Meta (rank changes, commission details, etc.) */}
              {selectedEvent.meta && typeof selectedEvent.meta === "object" && Object.keys(selectedEvent.meta).length > 0 && (
                <div className="bg-theme-secondary rounded-xl p-3">
                  <label className="text-[10px] font-bold text-theme-text-secondary uppercase tracking-wider">{t("بيانات إضافية", "Additional Info")}</label>
                  <div className="mt-2 space-y-1.5">
                    {selectedEvent.meta.previous_rank !== undefined && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-theme-text-secondary">{t("الرتبة السابقة", "Previous Rank")}:</span>
                        <span className="font-bold text-theme-text-primary">{rankLabel(selectedEvent.meta.previous_rank)}</span>
                        <span className="text-theme-text-secondary">→</span>
                        <span className="font-bold" style={{ color: evColor(selectedEvent.type) }}>{rankLabel(selectedEvent.meta.current_rank)}</span>
                      </div>
                    )}
                    {selectedEvent.meta.level !== undefined && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("المستوى", "Level")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.level}</span></div>
                    )}
                    {selectedEvent.meta.rank_name && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("الرتبة", "Rank")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.rank_name}</span></div>
                    )}
                    {selectedEvent.meta.week_start && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("بداية الأسبوع", "Week Start")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.week_start}</span></div>
                    )}
                    {selectedEvent.meta.week_end && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("نهاية الأسبوع", "Week End")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.week_end}</span></div>
                    )}
                    {selectedEvent.meta.team_count !== undefined && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("حجم الفريق المؤهل", "Qualified Team")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.team_count}</span></div>
                    )}
                    {selectedEvent.meta.direct_sales !== undefined && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("المبيعات المباشرة المؤهلة", "Qualified Directs")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.direct_sales}</span></div>
                    )}
                    {selectedEvent.meta.promotion_status && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("حالة الترقية", "Promotion")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.promotion_status}</span></div>
                    )}
                    {selectedEvent.meta.commission_status && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("حالة العمولة", "Commission")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.commission_status}</span></div>
                    )}
                    {selectedEvent.meta.failure_reason && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("سبب الفشل", "Reason")}:</span> <span className="font-bold text-red-500">{selectedEvent.meta.failure_reason}</span></div>
                    )}
                    {selectedEvent.meta.payment_method && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("طريقة الدفع", "Payment Method")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.payment_method}</span></div>
                    )}
                    {selectedEvent.meta.action && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("الإجراء", "Action")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.action}</span></div>
                    )}
                    {selectedEvent.meta.admin_name && (
                      <div className="text-xs"><span className="text-theme-text-secondary">{t("الأدمن", "Admin")}:</span> <span className="font-bold text-theme-text-primary">{selectedEvent.meta.admin_name}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Event ID */}
              <div className="text-[10px] text-theme-text-secondary text-center pt-2 border-t border-theme-border">
                ID: {selectedEvent.id || "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

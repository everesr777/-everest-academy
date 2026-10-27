import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import PageLoading from "../components/PageLoading";
import { api } from "../api.js";

export default function AdminLogsPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const load = () => {
    setLoading(true);
    api("/api/admin-logs")
      .then(setLogs)
      .catch(e => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const deleteAll = async () => {
    if (!confirm(t("هل أنت متأكد من حذف جميع سجلات الإجراءات؟", "Are you sure you want to delete all logs?"))) return;
    await api("/api/admin-logs", { method: "DELETE" });
    setLogs([]);
  };

  const actionLabels = {
    "$ credit": t("💰 إضافة رصيد", "💰 Credit"),
    "$ debit": t("💸 خصم رصيد", "💸 Debit"),
    "block": t("🔒 حظر", "🔒 Block"),
    "unblock": t("🔓 فك حظر", "🔓 Unblock"),
    "approve as student": t("✅ تفعيل كـ Student", "✅ Approved as Student"),
    "approve as registration_free": t("✅ تفعيل كـ Reg Free", "✅ Approved as Reg Free"),
    "self-upgrade to student": t("⬆️ ترقية ذاتية إلى Student", "⬆️ Self-upgrade to Student"),
    "change account_type": t("🔄 تغيير نوع الحساب", "🔄 Changed Account Type"),
  };

  const filtered = logs.filter(l => {
    if (filter !== "all" && !l.action.includes(filter === "emoney" ? "$" : filter)) return false;
    if (dateFilter && l.created_at?.slice(0, 10) !== dateFilter) return false;
    return true;
  });

  const groupedByDate = {};
  filtered.forEach(l => {
    const day = l.created_at?.slice(0, 10) || "unknown";
    if (!groupedByDate[day]) groupedByDate[day] = [];
    groupedByDate[day].push(l);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{t("📋 سجل إجراءات الأدمن", "📋 Admin Activity Log")}</h1>
          <p className="text-gray-500 text-sm mt-1">{t("جميع الإجراءات التي قام بها الأدمن", "All admin actions")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 text-sm bg-white border rounded-xl shadow-sm hover:shadow-md transition">{t("🔄 تحديث", "🔄 Refresh")}</button>
          {logs.length > 0 && (
            <button data-no-confirm onClick={deleteAll} className="px-4 py-2 text-sm bg-gray-800 text-white rounded-xl shadow-sm hover:bg-gray-900 transition">{t("🗑️ حذف الكل", "🗑️ Delete All")}</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="all">{t("كل الإجراءات", "All actions")}</option>
          <option value="emoney">{t("💰 إيداع / سحب", "💰 Deposit / Withdraw")}</option>
          <option value="block">{t("🔒 حظر", "🔒 Block")}</option>
          <option value="unblock">{t("🔓 فك حظر", "🔓 Unblock")}</option>
          <option value="approve">{t("✅ تفعيل", "✅ Approve")}</option>
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm" />
        {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-gray-400">{t("إلغاء التصفية", "Clear filter")}</button>}
      </div>

      {loading ? (
        <PageLoading>
          <p className="text-gray-400 text-center py-10">{t("جاري التحميل...", "Loading...")}</p>
        </PageLoading>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-10">{t("لا توجد إجراءات مسجلة", "No logs recorded")}</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([day, dayLogs]) => (
            <div key={day}>
              <h3 className="font-bold text-gray-700 mb-3 text-sm bg-gray-100 rounded-lg px-4 py-2 inline-block">{day}</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                {dayLogs.map((l, i) => (
                  <div key={l.id || i} className="p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-everest-50 flex items-center justify-center text-sm">
                      {l.admin_name?.[0] || "A"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-everest-600">{l.admin_name}</span>
                        {" "}{actionLabels[l.action] || l.action}{" "}
                        {l.target_user_name && <span className="text-gray-500">← {l.target_user_name}</span>}
                      </p>
                      {l.details && <p className="text-xs text-gray-400 mt-0.5">{l.details}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{l.created_at?.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

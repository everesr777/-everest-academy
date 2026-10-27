import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function UpgradeRequestsPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = (s) => { const st = s || filter; api("/api/users/upgrade-requests/list").then(setRequests).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api(`/api/users/upgrade-requests/${id}/approve`, { method: "PUT" }); load(); }
    catch (e) { alert(e.message); }
  };

  const reject = async (id) => {
    if (!confirm(t("متأكد من رفض طلب الترقية؟", "Are you sure you want to reject this upgrade request?"))) return;
    try { await api(`/api/users/upgrade-requests/${id}/reject`, { method: "PUT" }); load(); }
    catch (e) { alert(e.message); }
  };

  const filtered = requests.filter((r) => {
    if (filter && r.status !== filter) return false;
    if (search && !r.full_name?.includes(search) && !r.email?.includes(search)) return false;
    return true;
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("⬆️ طلبات الترقية", "⬆️ Upgrade Requests")}</h2>

      <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("بحث عن طالب...", "Search student...")} className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm bg-white">
            <option value="pending">{t("قيد الانتظار", "Pending")}</option>
            <option value="approved">{t("تم الموافقة", "Approved")}</option>
            <option value="rejected">{t("مرفوض", "Rejected")}</option>
          </select>
        </div>

        <table className="w-full mobile-card-table">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="p-3 text-right">{t("الطالب", "Student")}</th>
              <th className="p-3 text-right">{t("الايميل", "Email")}</th>
              <th className="p-3 text-right">{t("الهاتف", "Phone")}</th>
              <th className="p-3 text-right">{t("تاريخ الطلب", "Request Date")}</th>
              <th className="p-3 text-right">{t("الحالة", "Status")}</th>
              <th className="p-3 text-right">{t("إجراء", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td data-label={t("الطالب", "Student")} className="p-3 font-medium">{r.full_name}</td>
                <td data-label={t("الايميل", "Email")} className="p-3 text-xs text-gray-500">{r.email}</td>
                <td data-label={t("الهاتف", "Phone")} className="p-3 text-xs">{r.phone || "—"}</td>
                <td data-label={t("تاريخ الطلب", "Request Date")} className="p-3 text-xs text-gray-500">{r.created_at?.slice(0, 10)}</td>
                <td data-label={t("الحالة", "Status")} className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.status === "approved" ? "bg-green-100 text-green-700"
                    : r.status === "pending" ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {r.status === "pending" ? t("قيد الانتظار", "Pending") : r.status === "approved" ? t("تم الموافقة", "Approved") : t("مرفوض", "Rejected")}
                  </span>
                </td>
                <td data-label={t("إجراء", "Action")} className="p-3">
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => approve(r.id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                        {t("قبول", "Accept")}
                      </button>
                      <button data-no-confirm onClick={() => reject(r.id)} className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600">
                        {t("رفض", "Reject")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" className="text-center text-gray-400 py-8">{t("لا توجد طلبات", "No requests")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

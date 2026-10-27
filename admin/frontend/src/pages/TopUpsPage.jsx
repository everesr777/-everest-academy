import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function TopUpsPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const load = (s) => { const st = s || filter; api(`/api/wallets/topups${st ? `?status=${st}` : ""}`).then(setRequests).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api(`/api/wallets/topups/${id}/approve`, { method: "PUT" }); load(); }
    catch (e) { alert(e.message); }
  };

  const reject = async (id) => {
    if (!confirm(t("متأكد من رفض طلب الشحن؟", "Are you sure you want to reject this top-up request?"))) return;
    try { await api(`/api/wallets/topups/${id}/reject`, { method: "PUT" }); load(); }
    catch (e) { alert(e.message); }
  };

  const filtered = requests.filter(
    (r) => !search || r.full_name?.includes(search) || r.email?.includes(search)
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("💰 طلبات شحن الرصيد", "💰 Top-Up Requests")}</h2>

      <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("بحث عن طالب...", "Search student...")} className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]" />
          <select value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value); }}
            className="px-4 py-2 border rounded-lg text-sm bg-white">
            <option value="">{t("كل الحالات", "All statuses")}</option>
            <option value="pending">{t("معلق", "Pending")}</option>
            <option value="approved">{t("تم الشحن", "Approved")}</option>
            <option value="rejected">{t("مرفوض", "Rejected")}</option>
          </select>
          <button onClick={() => load()} className="px-4 py-2 bg-everest-600 text-white rounded-lg text-sm">{t("بحث", "Search")}</button>
        </div>

        <table className="w-full mobile-card-table">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="p-3 text-right">{t("الطلب", "Request")}</th>
              <th className="p-3 text-right">{t("الطالب", "Student")}</th>
              <th className="p-3 text-right">{t("المبلغ", "Amount")}</th>
              <th className="p-3 text-right">{t("رقم المحول عليه", "Transfer Number")}</th>
              <th className="p-3 text-right">{t("طريقة الدفع", "Payment Method")}</th>
              <th className="p-3 text-right">{t("إثبات الدفع", "Payment Proof")}</th>
              <th className="p-3 text-right">{t("الحالة", "Status")}</th>
              <th className="p-3 text-right">{t("إجراء", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td data-label={t("الطلب", "Request")} className="p-3 font-medium">#{r.id?.slice(0,8)}</td>
                <td data-label={t("الطالب", "Student")} className="p-3">
                  <p className="font-medium">{r.full_name}</p>
                  <p className="text-xs text-gray-400">{r.email}</p>
                </td>
                <td data-label={t("المبلغ", "Amount")} className="p-3 font-bold text-everest-700">{r.amount} EGP</td>
                <td data-label={t("رقم المحول عليه", "Transfer Number")} className="p-3 text-xs">{r.phone_number || "—"}</td>
                <td data-label={t("طريقة الدفع", "Payment Method")} className="p-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {r.payment_method || t("فودافون كاش", "Vodafone Cash")}
                  </span>
                </td>
                <td data-label={t("إثبات الدفع", "Payment Proof")} className="p-3">
                  {r.payment_proof ? (
                    <a href={r.payment_proof} target="_blank" rel="noreferrer">
                      <img src={r.payment_proof} alt="proof" className="w-12 h-12 object-cover rounded border cursor-pointer" />
                    </a>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td data-label={t("الحالة", "Status")} className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.status === "approved" ? "bg-green-100 text-green-700"
                    : r.status === "pending" ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {r.status === "pending" ? t("قيد الانتظار", "Pending") : r.status === "approved" ? t("تم الشحن", "Approved") : t("مرفوض", "Rejected")}
                  </span>
                </td>
                <td data-label={t("إجراء", "Action")} className="p-3">
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => approve(r.id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                        {t("موافقة", "Approve")}
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
              <tr><td colSpan="8" className="text-center text-gray-400 py-8">{t("لا توجد طلبات", "No requests")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

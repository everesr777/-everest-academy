import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../api";

const TX_TYPES = [
  { key: "all", ar: "الكل", en: "All" },
  { key: "commission", ar: "عمولة إحالة", en: "Referral Commission", color: "#10b981", bg: "#d1fae5" },
  { key: "transfer", ar: "تحويل بين المستخدمين", en: "User Transfer", color: "#8b5cf6", bg: "#ede9fe" },
  { key: "wallet_credit", ar: "إيداع محفظة", en: "Wallet Credit", color: "#06b6d4", bg: "#cffafe" },
  { key: "wallet_debit", ar: "خصم محفظة", en: "Wallet Debit", color: "#f59e0b", bg: "#fef3c7" },
  { key: "topup", ar: "شحن رصيد", en: "Top-up", color: "#3b82f6", bg: "#dbeafe" },
  { key: "rank_bonus", ar: "مكافأة ترقية", en: "Rank Bonus", color: "#f472b6", bg: "#fce7f3" },
  { key: "weekly_commission", ar: "عمولة أسبوعية", en: "Weekly Commission", color: "#14b8a6", bg: "#ccfbf1" },
  { key: "admin_action", ar: "إجراء مشرف", en: "Admin Action", color: "#6b7280", bg: "#f3f4f6" },
];

export default function TransactionsPage() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchUser, setSearchUser] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterType !== "all") params.set("type", filterType);
      if (searchUser) params.set("userId", searchUser);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const res = await api(`/api/transactions/all?${params}`);
      setTransactions(res.transactions || []);
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

  const txLabel = (key) => {
    const found = TX_TYPES.find(tx => tx.key === key);
    return found ? t(found.ar, found.en) : key;
  };
  const txColor = (key) => { const f = TX_TYPES.find(tx => tx.key === key); return f ? f.color : "#6b7280"; };
  const txBg = (key) => { const f = TX_TYPES.find(tx => tx.key === key); return f ? f.bg : "#f3f4f6"; };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">{t("سجل المعاملات المالية", "Financial Transactions")}</h1>
          <p className="text-sm text-theme-text-secondary mt-1">{total} {t("معاملة", "transactions")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-theme-text-secondary mb-1">{t("النوع", "Type")}</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="input text-sm px-3 py-2 rounded-xl border border-theme-border bg-theme-secondary text-theme-text-primary focus:ring-2 focus:ring-everest-400 outline-none">
              {TX_TYPES.map(tx => <option key={tx.key} value={tx.key}>{t(tx.ar, tx.en)}</option>)}
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
            style={{background:"linear-gradient(135deg,#6A35F0,#B78CFF)"}}>
            {t("بحث", "Search")}
          </button>
          <button type="button" onClick={resetFilters} className="text-sm px-4 py-2 rounded-xl font-medium border border-theme-border text-theme-text-secondary hover:bg-theme-secondary">
            {t("إعادة تعيين", "Reset")}
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-theme-text-secondary">{t("جاري التحميل...", "Loading...")}</p>
        ) : transactions.length === 0 ? (
          <p className="text-center py-12 text-theme-text-secondary">{t("لا توجد معاملات", "No transactions found")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme-border bg-theme-secondary">
                  <th className="table-header">{t("النوع", "Type")}</th>
                  <th className="table-header">{t("المبلغ", "Amount")}</th>
                  <th className="table-header">{t("من", "From")}</th>
                  <th className="table-header">{t("إلى", "To")}</th>
                  <th className="table-header">{t("الوصف", "Description")}</th>
                  <th className="table-header">{t("الحالة", "Status")}</th>
                  <th className="table-header">{t("التاريخ", "Date")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={tx.id || i} className="table-row">
                    <td className="table-cell">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold" style={{background: txBg(tx.tx_type), color: txColor(tx.tx_type)}}>
                        {txLabel(tx.tx_type)}
                      </span>
                    </td>
                    <td className="table-cell font-bold" style={{color: tx.amount > 0 ? "#10b981" : "#6b7280"}}>
                      {tx.amount != null ? `${parseFloat(tx.amount).toLocaleString()} $` : "—"}
                    </td>
                    <td className="table-cell">
                      <div className="text-theme-text-primary font-medium text-xs">{tx.from_name || "—"}</div>
                      {tx.from_email && <div className="text-theme-text-secondary text-[10px]">{tx.from_email}</div>}
                    </td>
                    <td className="table-cell">
                      <div className="text-theme-text-primary font-medium text-xs">{tx.to_name || "—"}</div>
                      {tx.to_email && <div className="text-theme-text-secondary text-[10px]">{tx.to_email}</div>}
                    </td>
                    <td className="table-cell text-theme-text-secondary text-xs max-w-[200px] truncate" title={tx.description}>
                      {tx.description || "—"}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${
                        tx.status === 'completed' || tx.status === 'paid' || tx.status === 'approved' ? 'badge-green' :
                        tx.status === 'pending' ? 'badge-yellow' :
                        tx.status === 'rejected' || tx.status === 'failed' || tx.status === 'cancelled' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="table-cell text-theme-text-secondary text-[10px] whitespace-nowrap">
                      {tx.created_at ? tx.created_at.slice(0, 19) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-theme-border">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-theme-border text-theme-text-secondary disabled:opacity-40 hover:bg-theme-secondary">
              {t("السابق", "Prev")}
            </button>
            <span className="text-sm text-theme-text-secondary">
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-theme-border text-theme-text-secondary disabled:opacity-40 hover:bg-theme-secondary">
              {t("التالي", "Next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

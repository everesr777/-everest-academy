import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";
import LoadingIndicator from "../components/LoadingIndicator";

export default function AccountsBySourcePage({ source }) {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const isCreated = source === "created";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewProfile, setViewProfile] = useState(null);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const endpoint = isCreated ? "/api/users/created-accounts" : "/api/users/external-accounts";

  const load = () => {
    setLoading(true);
    api(endpoint)
      .then(setUsers)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [endpoint]);

  const openViewProfile = async (user) => {
    setViewProfile({ id: user.id, full_name: user.full_name, email: user.email });
    setViewProfileData(null);
    setProfileError(null);
    setLoadingProfile(true);
    try {
      const data = await api(`/api/users/${user.id}`);
      setViewProfileData(data);
    } catch (e) {
      console.error(e);
      setProfileError(e.message);
      setViewProfileData(user);
    }
    setLoadingProfile(false);
  };

  const filtered = users.filter((u) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [u.full_name, u.email, u.phone, u.referral_code, String(u.id), u.governorate]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(s));
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h2 className="text-2xl font-bold">
          {isCreated ? t("👤 حسابات إنشاء حساب لآخر", "👤 Created Accounts") : t("📝 حسابات التسجيل الخارجي", "📝 External Sign-up Accounts")}
        </h2>
        <span className="text-sm text-gray-400 bg-white px-3 py-1.5 rounded-lg border">
          {filtered.length} {filtered.length === 1 ? t("حساب", "account") : t("حساب", "accounts")}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border mb-4 p-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("بحث بالاسم أو البريد أو الهاتف أو ID...", "Search by name, email, phone or ID...")}
          className="px-4 py-2 border rounded-lg text-sm w-full max-w-md" />
      </div>

      {loading ? (
        <LoadingIndicator full />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 text-lg">{t("لا توجد حسابات", "No accounts found")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
          <table className="w-full table-data mobile-card-table">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                <th>ID</th>
                <th>{t("الاسم", "Name")}</th>
                <th>{t("البريد", "Email")}</th>
                <th>{t("الهاتف", "Phone")}</th>
                <th>{t("المحافظة", "Governorate")}</th>
                <th>{t("نوع الحساب", "Account Type")}</th>
                <th>{t("الرتبة", "Rank")}</th>
                <th>{t("الرصيد", "E-Money")}</th>
                {isCreated && <th>{t("أنشأه", "Created By")}</th>}
                <th>{t("تاريخ التسجيل", "Date")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td data-label="ID" className="font-bold text-everest-700 text-xs">{u.referral_code || u.id}</td>
                  <td data-label={t("الاسم", "Name")}>
                    <button onClick={() => openViewProfile(u)}
                      className="font-medium text-sm text-left hover:text-everest-700 transition cursor-pointer">
                      {u.full_name}
                    </button>
                  </td>
                  <td data-label={t("البريد", "Email")} className="text-gray-500 text-xs">{u.email}</td>
                  <td data-label={t("الهاتف", "Phone")} className="text-gray-500 text-xs">{u.phone || "—"}</td>
                  <td data-label={t("المحافظة", "Governorate")} className="text-gray-500 text-xs">{u.governorate || "—"}</td>
                  <td data-label={t("نوع الحساب", "Account Type")} className="text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      u.account_type === "student" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                    }`}>{u.account_type}</span>
                  </td>
                  <td data-label={t("الرتبة", "Rank")} className="text-xs text-gray-500">{u.rank || "—"}</td>
                  <td data-label={t("الرصيد", "E-Money")} className="text-xs font-medium text-everest-700">{u.e_money ?? 0}</td>
                  {isCreated && (
                    <td data-label={t("أنشأه", "Created By")} className="text-xs">
                      <button onClick={() => openViewProfile({ id: u.created_by_user, full_name: u.creator_name, email: u.creator_email })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 cursor-pointer transition" title={u.creator_email}>
                        👤 {u.creator_name || u.creator_email || u.created_by_user}
                      </button>
                    </td>
                  )}
                  <td data-label={t("تاريخ التسجيل", "Date")} className="text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile Modal */}
      {viewProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setViewProfile(null); setViewProfileData(null); setProfileError(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t("بيانات المستخدم", "User Details")}</h3>
              <button onClick={() => { setViewProfile(null); setViewProfileData(null); setProfileError(null); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#666" }}>✕</button>
            </div>

            {loadingProfile ? (
              <p style={{ color: "#999", textAlign: "center", padding: 20 }}>{t("جارٍ التحميل...", "Loading...")}</p>
            ) : (
              <>
                {profileError && (
                  <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 16 }}>
                    ⚠️ {t("تعذر تحميل التفاصيل الكاملة", "Couldn't load full details")}: {profileError}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18,
                    background: (viewProfileData?.account_type || "student") === "student" ? "#22c55e" : "#a855f7" }}>
                    {(viewProfileData?.full_name || viewProfile.full_name || "?")[0]}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0 }}>{viewProfileData?.full_name || viewProfile.full_name}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{viewProfileData?.email || viewProfile.email}</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 14 }}>
                  {[
                    { label: "ID", value: viewProfileData?.referral_code || viewProfileData?.id || viewProfile.id },
                    { label: t("الاسم", "Name"), value: viewProfileData?.full_name || viewProfile.full_name },
                    { label: t("البريد", "Email"), value: viewProfileData?.email || viewProfile.email },
                    { label: t("الهاتف", "Phone"), value: viewProfileData?.phone || "—" },
                    { label: t("المحافظة", "Governorate"), value: viewProfileData?.governorate || "—" },
                    { label: t("الدولة", "Country"), value: viewProfileData?.country || "—" },
                    { label: t("العنوان", "Address"), value: viewProfileData?.address || "—" },
                    { label: t("الدور", "Role"), value: viewProfileData?.role || "—" },
                    { label: t("نوع الحساب", "Account Type"), value: viewProfileData?.account_type || "—" },
                    { label: t("الرتبة", "Rank"), value: viewProfileData?.rank || "—" },
                    { label: t("الرصيد", "E-Money"), value: viewProfileData?.e_money ?? "—" },
                    { label: t("الحالة", "Status"), value: viewProfileData?.status || "—" },
                    { label: t("المحظور", "Blocked"), value: viewProfileData?.blocked ? t("نعم", "Yes") : t("لا", "No") },
                    { label: t("احالة من", "Referred By"), value: viewProfileData?.referred_by || "—" },
                    { label: t("مبيعات الفريق", "Team Sales"), value: viewProfileData?.total_team_sales ?? 0 },
                    { label: t("الأعضاء المباشرين", "Direct Count"), value: viewProfileData?.direct_count ?? 0 },
                    { label: t("تاريخ التسجيل", "Joined"), value: viewProfileData?.created_at ? new Date(viewProfileData.created_at).toLocaleDateString("ar-EG") : "—" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "#f9f9fb", borderRadius: 10, padding: "10px 12px" }}>
                      <p style={{ fontSize: 10, color: "#999", margin: "0 0 3px" }}>{item.label}</p>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, wordBreak: "break-all" }}>{String(item.value ?? "—")}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

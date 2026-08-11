import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api, BACKEND_URL } from "../api.js";
import LoadingIndicator from "../components/LoadingIndicator";

export default function RegistrationApprovalsPage({ source }) {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const isCreated = source === "created";
  const endpoint = `/api/users/pending-registrations${source ? `?source=${source}` : ""}`;
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewUser, setViewUser] = useState(null);
  const [viewCards, setViewCards] = useState(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [rejectUser, setRejectUser] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const load = () => {
    setLoading(true);
    api(endpoint)
      .then(setPending)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [endpoint]);

  const handleApprove = async (userId, account_type) => {
    try {
      await api(`/api/users/${userId}/approve-registration`, { method: "PUT", body: JSON.stringify({ account_type }) });
      load();
      setViewUser(null);
    } catch (e) { alert(e.message); }
  };

  const handleReject = async (userId) => {
    setRejectUser(userId);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectUser) return;
    setRejecting(true);
    try {
      await api(`/api/users/${rejectUser}/reject-registration`, { method: "PUT", body: JSON.stringify({ reason: rejectReason.trim() }) });
      load();
      setRejectUser(null);
      setRejectReason("");
    } catch (e) { alert(e.message); }
    setRejecting(false);
  };

  const openViewUser = async (u) => {
    setViewUser(u);
    setViewCards(null);
    setLoadingCards(true);
    try {
      const cards = await api(`/api/users/${u.id}/id-cards`);
      setViewCards(cards);
    } catch (e) { console.error(e); }
    setLoadingCards(false);
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {isCreated
            ? t("🔐 تفعيل الحسابات انشاء حساب للاخر", "🔐 Created Account Approvals")
            : t("🔐 تفعيل الحسابات التسجيل الخارجى", "🔐 External Sign-up Approvals")}
        </h2>
        <span className="text-sm text-gray-400 bg-white px-3 py-1.5 rounded-lg border">
          {pending.length} {pending.length === 1 ? t("مستخدم", "user") : t("مستخدمين", "users")} {t("بانتظار التفعيل", "pending approval")}
        </span>
      </div>

      {loading ? (
        <LoadingIndicator full />
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 text-lg">{t("لا يوجد مستخدمين بانتظار التفعيل", "No users pending approval")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
          <table className="w-full table-data mobile-card-table">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                <th>{t("الاسم", "Name")}</th>
                <th>{t("البريد", "Email")}</th>
                <th>{t("رقم الهاتف", "Phone")}</th>
                <th>{t("المحافظة", "Governorate")}</th>
                <th>{t("أنشأه", "Created By")}</th>
                <th>{t("البطاقة", "ID Card")}</th>
                <th>{t("تاريخ التسجيل", "Date")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td data-label={t("الاسم", "Name")} className="font-medium text-sm">{u.full_name}</td>
                  <td data-label={t("البريد", "Email")} className="text-gray-500 text-xs">{u.email}</td>
                  <td data-label={t("رقم الهاتف", "Phone")} className="text-gray-500 text-xs">{u.phone || "—"}</td>
                  <td data-label={t("المحافظة", "Governorate")} className="text-gray-500 text-xs">{u.governorate || "—"}</td>
                  <td data-label={t("أنشأه", "Created By")} className="text-xs">
                    {u.created_by_user ? (
                      <button onClick={() => openViewProfile({ id: u.created_by_user, full_name: u.creator_name, email: u.creator_email })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 cursor-pointer transition" title={u.creator_email}>
                        👤 {u.creator_name || u.creator_email || u.created_by_user}
                      </button>
                    ) : u.referred_by ? (
                      <button onClick={() => openViewProfile({ id: u.referred_by, full_name: u.referrer_name, email: u.referrer_email })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 cursor-pointer transition" title={u.referrer_email}>
                        👥 {u.referrer_name || u.referrer_email || u.referred_by}
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td data-label={t("البطاقة", "ID Card")} className="text-xs">
                    <button onClick={() => openViewUser(u)} className="text-blue-600 hover:text-blue-800 font-medium underline">
                      {t("عرض", "View")}
                    </button>
                  </td>
                  <td data-label={t("تاريخ التسجيل", "Date")} className="text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString("ar-EG")}</td>
                  <td data-label={t("إجراء", "Action")} className="text-left">
                    <div className="flex gap-2 justify-end items-start">
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => handleApprove(u.id, "student")}
                          className="px-4 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition whitespace-nowrap">
                          🎓 Student
                        </button>
                        <button onClick={() => handleApprove(u.id, "registration_free")}
                          className="px-4 py-1.5 text-xs font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition whitespace-nowrap">
                          🆓 Reg Free
                        </button>
                      </div>
                      <button onClick={() => handleReject(u.id)}
                        className="px-4 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                        {t("❌ رفض", "❌ Reject")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ID Card Modal */}
      {viewUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setViewUser(null); setViewCards(null); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{viewUser.full_name} — {t("البطاقة الشخصية", "ID Card")}</h3>
              <button onClick={() => { setViewUser(null); setViewCards(null); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#666" }}>✕</button>
            </div>

            {viewUser.governorate && (
              <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>📍 {t("المحافظة", "Governorate")}: <strong>{viewUser.governorate}</strong></p>
            )}
            {viewUser.country && (
              <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>🌍 {t("الدولة", "Country")}: <strong>{viewUser.country}</strong></p>
            )}

            {loadingCards ? (
              <p style={{ color: "#999", textAlign: "center", padding: 20 }}>{t("جارٍ تحميل الصور...", "Loading images...")}</p>
            ) : (
              <div>
                {viewCards?.id_card_front ? (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>📷 {t("البطاقة أو الباسبور", "ID Card or Passport")}</p>
                    <img src={viewCards.id_card_front.startsWith("data:") || viewCards.id_card_front.startsWith("http") ? viewCards.id_card_front : `${BACKEND_URL}${viewCards.id_card_front}`} alt="ID" style={{ width: "100%", maxWidth: 400, borderRadius: 12, border: "1px solid #ddd" }} />
                  </div>
                ) : (
                  <p style={{ color: "#999", textAlign: "center", padding: 20 }}>{t("لا توجد صور بطاقة", "No ID card images")}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => { setRejectUser(null); setRejectReason(""); }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {t("❌ رفض الحساب", "❌ Reject Account")}
            </h3>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
              {t("اكتب سبب الرفض ليتم إرساله إلى المستخدم عبر البريد الإلكتروني.", "Write the rejection reason to be sent to the user via email.")}
            </p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              rows={4} placeholder={t("سبب الرفض...", "Rejection reason...")}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ddd", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none" }}
              onFocus={e => e.target.style.borderColor = "#ef4444"}
              onBlur={e => e.target.style.borderColor = "#ddd"} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setRejectUser(null); setRejectReason(""); }}
                style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 14, color: "#666" }}>
                {t("إلغاء", "Cancel")}
              </button>
              <button onClick={confirmReject} disabled={rejecting || !rejectReason.trim()}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  cursor: rejecting || !rejectReason.trim() ? "default" : "pointer",
                  background: rejecting || !rejectReason.trim() ? "#ccc" : "#ef4444",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {rejecting ? (
                  <span>{t("جارٍ...", "Rejecting...")}</span>
                ) : (
                  <>{t("❌ تأكيد الرفض وإرسال", "❌ Confirm & Send")}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator / Referrer Profile Modal */}
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

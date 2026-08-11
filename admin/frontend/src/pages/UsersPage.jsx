import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api, BACKEND_URL, uploadApi } from "../api.js";
import LoadingIndicator from "../components/LoadingIndicator";

export default function UsersPage() {
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [teamTab, setTeamTab] = useState(1);
  const [profileTab, setProfileTab] = useState("details");
  const [amount, setAmount] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sendAmtModal, setSendAmtModal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [dbRanks, setDbRanks] = useState([]);
  const [rankProgress, setRankProgress] = useState(null);
  const [directMembers, setDirectMembers] = useState([]);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [showDirectDetail, setShowDirectDetail] = useState(false);
  const [userCards, setUserCards] = useState(null);

  const loadUsers = () => {
    setLoading(true);
    api("/api/users").then(setUsers).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { loadUsers(); api("/api/ranks").then(d => setDbRanks(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const openProfile = (user) => {
    api(`/api/users/${user.id}`).then(applyProfile);
  };

  const openProfileById = (id) => {
    if (!id) return;
    api(`/api/users/${id}`).then(applyProfile);
  };

  const applyProfile = (data) => {
    setSelectedUser(data);
    setEditForm({
      full_name: data.full_name || "",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      role: data.role || "",
      account_type: data.account_type || "student",
      bio: data.bio || "",
    });
    setEditing(false);
    setTeamTab(1);
    setProfileTab("details");
    setAmount("");
    setRankProgress(null);
    setDirectMembers([]);
    setWeeklyHistory([]);
    setHistoryDetail(null);
    setShowDirectDetail(false);
    setUserCards(null);
    api(`/api/mlm/rank-progress/${data.id}`).then(setRankProgress).catch(() => {});
    api(`/api/mlm/directs/${data.id}`).then(d => setDirectMembers(Array.isArray(d) ? d : [])).catch(() => {});
    api(`/api/mlm/weekly-history/${data.id}`).then(d => setWeeklyHistory(Array.isArray(d) ? d : [])).catch(() => {});
    api("/api/mlm/leaderboard").then(d => setLeaderboard(Array.isArray(d) ? d : [])).catch(() => {});
    api(`/api/users/${data.id}/id-cards`).then(setUserCards).catch(() => {});
  };

  const saveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      // Also update account_type via dedicated endpoint if changed
      if (editForm.account_type && editForm.account_type !== (selectedUser.account_type || "student")) {
        await api(`/api/users/${selectedUser.id}/account-type`, {
          method: "PUT", body: JSON.stringify({ account_type: editForm.account_type }),
        });
      }
      const updated = await api(`/api/users/${selectedUser.id}`);
      setSelectedUser(updated);
      setEditing(false);
      loadUsers();
    } catch (e) { alert(t("خطأ:", "Error:") + " " + e.message); }
    setSaving(false);
  };

  const processEMoneyOnProfile = async () => {
    if (!amount || !selectedUser) return;
    try {
      await api(`/api/users/${selectedUser.id}/e-money`, {
        method: "PUT", body: JSON.stringify({ amount: parseFloat(amount), allow_negative: true }),
      });
      const updated = await api(`/api/users/${selectedUser.id}`);
      setSelectedUser(updated);
      setAmount("");
      loadUsers();
    } catch (e) { alert(t("خطأ:", "Error:") + " " + e.message); }
  };

  const handleSendEMoney = async (userId, name) => {
    if (!sendAmtModal || !sendAmtModal.amount) return;
    const amt = parseFloat(sendAmtModal.amount);
    try {
      await api(`/api/users/${userId}/e-money`, {
        method: "PUT", body: JSON.stringify({ amount: amt, allow_negative: false }),
      });
      loadUsers();
      alert(`${t("تم إضافة", "Added")} ${amt} E-Money ${t("إلى:", "To:")} ${name}`);
      setSendAmtModal(null);
    } catch (e) { alert(t("خطأ:", "Error:") + " " + e.message); }
  };

  const uploadIdCard = async (side) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("file", file);
      try {
        const d = await uploadApi(fd);
        if (d.url) {
          const key = side === "front" ? "id_card_front" : "id_card_back";
          await api(`/api/users/${selectedUser.id}/id-cards`, { method: "PUT", body: JSON.stringify({ [key]: d.url }) });
          const updated = await api(`/api/users/${selectedUser.id}/id-cards`);
          setUserCards(updated);
        }
      } catch (err) { alert(t("خطأ في رفع الصورة:", "Upload error:") + " " + err.message); }
    };
    input.click();
  };

  const toggleBlock = async (user) => {
    if (user.blocked) {
      await api(`/api/users/${user.id}/unblock`, { method: "PUT" });
    } else {
      await api(`/api/users/${user.id}/block`, { method: "PUT" });
    }
    loadUsers();
    if (selectedUser?.id === user.id) {
      const updated = await api(`/api/users/${user.id}`);
      setSelectedUser(updated);
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api(`/api/users/${userId}`, { method: "DELETE" });
      setConfirmDelete(null);
      if (selectedUser?.id === userId) setSelectedUser(null);
      loadUsers();
    } catch (e) {
      alert(t("خطأ في حذف المستخدم:", "Error deleting user:") + " " + (e.message || t("حدث خطأ", "An error occurred")));
    }
  };

  const filtered = users.filter((u) => u.role !== "admin" && u.role !== "manager").filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.id?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(u => u.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const bulkDelete = async () => {
    if (!confirm(t("هل أنت متأكد من حذف " + selectedIds.length + " مستخدم؟ لا يمكن التراجع.", "Are you sure you want to delete " + selectedIds.length + " users? This cannot be undone."))) return;
    for (const id of selectedIds) {
      try { await api(`/api/users/${id}`, { method: "DELETE" }); } catch {}
    }
    setSelectedIds([]);
    loadUsers();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t("👤 إدارة المستخدمين", "👤 User Management")}</h2>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button onClick={bulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
              🗑️ {t("حذف المحدد", "Delete Selected")} ({selectedIds.length})
            </button>
          )}
          <span className="text-sm text-gray-400 bg-white px-3 py-1.5 rounded-lg border">{filtered.length} {t("مستخدم", "users")}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper mb-6">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-4">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("بحث عن اسم أو إيميل أو ID...", "Search by name, email or ID...")}
            className="w-full max-w-md px-4 py-2 border rounded-lg text-sm"
          />
        </div>
        {loading ? <LoadingIndicator /> : (
        <table className="w-full table-data mobile-card-table">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="w-10">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded cursor-pointer" />
              </th>
              <th>{t("الاسم", "Name")}</th>
              <th>{t("البريد", "Email")}</th>
              <th>{t("الدور", "Role")}</th>
              <th>{t("نوع الحساب", "Account Type")}</th>
              <th>{t("الرتبة", "Rank")}</th>
              <th>{t("الرصيد", "Balance")}</th>
              <th>{t("الحالة", "Status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td data-label="" className="w-10">
                  <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleSelect(u.id)} className="rounded cursor-pointer" />
                </td>
                <td data-label={t("الاسم", "Name")} className="font-medium">{u.full_name}</td>
                <td data-label={t("البريد", "Email")} className="text-gray-500 text-xs">{u.email}</td>
                <td data-label={t("الدور", "Role")}>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === "admin" ? "bg-purple-100 text-purple-700" :
                    u.role === "student" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{u.role}</span>
                </td>
                <td data-label={t("نوع الحساب", "Account Type")}>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.account_type === "student" ? "bg-green-100 text-green-700" :
                    u.account_type === "registration_free" ? "bg-purple-100 text-purple-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{u.account_type || "student"}</span>
                </td>
                <td data-label={t("الرتبة", "Rank")}>{u.rank}</td>
                <td data-label={t("الرصيد", "Balance")} className="text-everest-600 font-bold">{u.e_money}</td>
                <td data-label={t("الحالة", "Status")}>
                  {u.blocked ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{t("محظور", "Blocked")}</span>
                  ) : u.status === "rejected" ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{t("مرفوض", "Rejected")}</span>
                  ) : u.status === "pending" ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{t("قيد المراجعة", "Pending")}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{t("نشط", "Active")}</span>
                  )}
                </td>
                <td data-label={t("إجراء", "Action")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openProfile(u)} className="text-blue-600 hover:underline text-sm">{t("عرض", "View")}</button>
                    {u.role !== "admin" && (
                      <button onClick={() => setSendAmtModal({user: u, amount: ''})} className="text-emerald-600 hover:underline text-sm">{t("💰 إرسال E-Money", "💰 Send E-Money")}</button>
                    )}
                    <button onClick={() => toggleBlock(u)} className={`text-sm hover:underline ${u.blocked ? "text-green-600" : "text-orange-600"}`}>
                      {u.blocked ? t("فك الحظر", "Unblock") : t("حظر", "Block")}
                    </button>
                    {u.role !== "admin" && (
                      <button onClick={() => setConfirmDelete(u)} className="text-red-600 hover:underline text-sm">{t("حذف", "Delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Send E-Money modal */}
      {sendAmtModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSendAmtModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">{t("💰 إرسال E-Money", "💰 Send E-Money")}</h3>
            <p className="text-sm text-gray-500 mb-4">{t("إلى:", "To:")} <strong>{sendAmtModal.user.full_name}</strong></p>
            <input type="number" value={sendAmtModal.amount} onChange={e => setSendAmtModal({...sendAmtModal, amount: e.target.value})} placeholder={t("المبلغ (مثال: 100)", "Amount (e.g. 100)")} autoFocus
              className="w-full px-4 py-2 border rounded-lg text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setSendAmtModal(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">{t("إلغاء", "Cancel")}</button>
              <button onClick={() => handleSendEMoney(sendAmtModal.user.id, sendAmtModal.user.full_name)} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">{t("إرسال", "Send")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-4xl mb-4">⚠️</p>
            <h3 className="text-lg font-bold mb-2">{t("حذف المستخدم", "Delete User")}</h3>
            <p className="text-gray-500 text-sm mb-6">{t("هل أنت متأكد من حذف", "Are you sure you want to delete")} <strong>{confirmDelete.full_name}</strong>{t("؟ لا يمكن التراجع عن هذا الإجراء.", " This action cannot be undone.")}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDelete(null)} className="px-6 py-2 bg-gray-100 rounded-lg font-medium text-sm">{t("إلغاء", "Cancel")}</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700">{t("حذف نهائياً", "Delete permanently")}</button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{t("ملف المستخدم", "User Profile")}</h3>
                <div className="flex items-center gap-3">
                  {selectedUser.blocked && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">{t("محظور", "Blocked")}</span>}
                  {!editing && (
                    <button onClick={() => setEditing(true)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">✏️ {t("تعديل", "Edit")}</button>
                  )}
                  <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
              </div>

              {!editing && (
                <div className="flex gap-2 mb-5 flex-wrap border-b pb-3">
                  {[
                    { key: "details", icon: "👤", label: t("البيانات", "Details") },
                    { key: "activity", icon: "📈", label: t("النشاط الأسبوعي", "Weekly Activity") },
                    { key: "network", icon: "🌐", label: t("الشبكة المؤهلة", "Qualified Network") },
                    { key: "history", icon: "📜", label: t("السجل الأسبوعي", "Weekly History") },
                    { key: "leaderboard", icon: "🏆", label: t("لوحة المتصدرين", "Leaderboard") },
                  ].map(tb => (
                    <button key={tb.key} onClick={() => setProfileTab(tb.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${profileTab === tb.key ? "bg-everest-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {tb.icon} {tb.label}
                    </button>
                  ))}
                </div>
              )}

              {editing ? (
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("الاسم", "Name")}</label>
                      <input value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("البريد", "Email")}</label>
                      <input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("الهاتف", "Phone")}</label>
                      <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("العنوان", "Address")}</label>
                      <input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("الدور", "Role")}</label>
                      <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="registration">registration (Reg Free)</option>
                        <option value="student">student</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("نوع الحساب", "Account Type")}</label>
                      <select value={editForm.account_type} onChange={e => setEditForm({...editForm, account_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="student">🎓 Student</option>
                        <option value="registration_free">🆓 Registration Free</option>
                      </select>
                    </div>
                  </div>
                  <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("البايو", "Bio")}</label>
                    <textarea value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">{t("إلغاء", "Cancel")}</button>
                    <button onClick={saveProfile} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">{saving ? t("جاري الحفظ...", "Saving...") : t("💾 حفظ التعديلات", "💾 Save Changes")}</button>
                  </div>
                </div>
              ) : (
                <>
                  {profileTab === "details" && (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                          { label: t("المعرف", "User ID"), value: selectedUser.referral_code || selectedUser.id },
                          { label: t("البريد الإلكتروني", "Email"), value: selectedUser.email },
                          { label: t("رقم الهاتف", "Phone"), value: selectedUser.phone || "—" },
                          { label: t("العنوان", "Address"), value: selectedUser.address || selectedUser.governorate || "—" },
                          { label: t("الدولة", "Country"), value: selectedUser.country || "—" },
                        ].map((item, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400">{item.label}</p>
                            <p className="text-sm font-medium mt-1">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="border rounded-lg p-3">
                          <p className="text-xs text-gray-400">{t("كود الإحالة", "Referral Code")}</p>
                          <p className="text-sm font-bold text-purple-600 mt-1">{selectedUser.referral_code}</p>
                        </div>
                        <div className="border rounded-lg p-3">
                          <p className="text-xs text-gray-400">{t("الرتبة الحالية", "Current Rank")}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {(() => {
                              const rankData = dbRanks.find(r => r.name === selectedUser.rank);
                              if (rankData?.image) return <img src={rankData.image} alt={selectedUser.rank} className="w-5 h-5 rounded object-cover" />;
                              const icons = {"Star":"⭐","Executive":"🚀","Executive Star":"💎","Team Leader":"🏆","Senior Leader":"🌍","Regional Leader":"⚡","Everest Elite":"🔱","Everest Master":"🔥","Everest Legend":"🌟","Everest Ambassador":"👑"};
                              return <span>{icons[selectedUser.rank] || "🏅"}</span>;
                            })()}
                            <p className="text-sm font-bold">{selectedUser.rank || "—"}</p>
                          </div>
                        </div>
                        <div className="border rounded-lg p-3">
                          <p className="text-xs text-gray-400">{t("مبيعات الفريق", "Team Sales")}</p>
                          <p className="text-sm font-bold mt-1">{selectedUser.total_team_sales || 0}</p>
                        </div>
                        <div className="border rounded-lg p-3">
                          <p className="text-xs text-gray-400">{t("رصيد E-Money", "E-Money Balance")}</p>
                          <p className="text-sm font-bold text-green-600 mt-1">{selectedUser.e_money}</p>
                        </div>
                      </div>

                      {/* Sponsor (registered by code or created internally) */}
                      {selectedUser.sponsor && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
                          <h4 className="font-bold mb-3 text-sm">{t("👤 تم التسجيل من خلال", "👤 Registered Through")}</h4>
                          <button
                            onClick={() => openProfileById(selectedUser.sponsor.id)}
                            className="flex items-center gap-3 w-full text-right bg-white rounded-lg p-3 border border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50/60 transition cursor-pointer"
                            title={t("اضغط لعرض الملف", "Click to view profile")}
                          >
                            <div className="w-11 h-11 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
                              {(selectedUser.sponsor.full_name || "?")[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{selectedUser.sponsor.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{selectedUser.sponsor.email}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[11px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{selectedUser.sponsor.referral_code}</span>
                                <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">🏅 {selectedUser.sponsor.rank || "—"}</span>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selectedUser.sponsor.account_type === "student" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                                  {selectedUser.sponsor.account_type === "student" ? "🎓 Student" : "🆓 Reg Free"}
                                </span>
                              </div>
                            </div>
                            <div className="text-center shrink-0">
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${selectedUser.sponsor.source === "code" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                {selectedUser.sponsor.source === "code"
                                  ? t("🔗 بكود الإحالة", "🔗 By Referral Code")
                                  : t("🏗️ تم إنشاؤه من الداخل", "🏗️ Created Internally")}
                              </span>
                              <p className="text-[10px] text-gray-400 mt-1">{t("اضغط لعرض الملف", "Click to view profile")}</p>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* ID Card Images */}
                      {userCards?.id_card_front && (
                        <div className="mb-4">
                          <h4 className="font-bold mb-3 text-sm">{t("📷 البطاقة أو الباسبور", "📷 ID Card or Passport")}</h4>
                          <div className="max-w-sm">
                            <div className="relative group">
                              <img src={userCards.id_card_front.startsWith("data:") || userCards.id_card_front.startsWith("http") ? userCards.id_card_front : `${BACKEND_URL}${userCards.id_card_front}`} alt="ID" className="w-full rounded-lg border object-contain max-h-48" />
                              <button onClick={() => uploadIdCard("front")} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm font-medium rounded-lg cursor-pointer">{t("تغيير", "Change")}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Account Type Quick Change */}
                      {selectedUser.role !== "admin" && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                          <h4 className="font-bold mb-3">{t("🔄 نوع الحساب", "🔄 Account Type")}</h4>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              selectedUser.account_type === "student" ? "bg-green-100 text-green-700" :
                              "bg-purple-100 text-purple-700"
                            }`}>{selectedUser.account_type === "student" ? "🎓 Student" : "🆓 Reg Free"}</span>
                            {["student", "registration_free"].filter(t => t !== (selectedUser.account_type || "student")).map(newType => (
                              <button key={newType} onClick={async () => {
                                try {
                                  await api(`/api/users/${selectedUser.id}/account-type`, { method: "PUT", body: JSON.stringify({ account_type: newType }) });
                                  const updated = await api(`/api/users/${selectedUser.id}`);
                                  setSelectedUser(updated);
                                  loadUsers();
                                } catch (e) { alert(e.message); }
                              }} className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                                → {newType === "student" ? "🎓 Student" : "🆓 Reg Free"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <h4 className="font-bold mb-3">{t("💰 إضافة / خصم رصيد", "💰 Add / Deduct Balance")}</h4>
                        <div className="flex gap-3">
                          <input
                            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                            placeholder={t("مثال: 50 أو -50", "e.g. 50 or -50")}
                            className="flex-1 px-4 py-2 border rounded-lg text-sm"
                          />
                          <button onClick={processEMoneyOnProfile} className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700">{t("تنفيذ", "Apply")}</button>
                        </div>
                      </div>

                      {selectedUser.role !== "admin" && (
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                          <h4 className="font-bold mb-3">{t("🔑 تغيير كلمة المرور", "🔑 Change Password")}</h4>
                          <div className="flex gap-3">
                            <input
                              type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={t("كلمة المرور الجديدة", "New password")}
                              className="flex-1 px-4 py-2 border rounded-lg text-sm"
                            />
                            <button onClick={async () => {
                              if (!newPassword || newPassword.length < 4) { alert(t("كلمة المرور يجب أن تكون 4 أحرف على الأقل", "Password must be at least 4 characters")); return; }
                              try {
                                await api(`/api/users/${selectedUser.id}`, { method: "PUT", body: JSON.stringify({ password: newPassword }) });
                                setNewPassword("");
                                alert(t("تم تغيير كلمة المرور بنجاح", "Password changed successfully"));
                              } catch (e) { alert(t("خطأ:", "Error:") + " " + e.message); }
                            }} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
                              {t("حفظ", "Save")}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-6">
                        <button onClick={() => toggleBlock(selectedUser)} className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedUser.blocked ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {selectedUser.blocked ? t("🔓 فك الحظر", "🔓 Unblock User") : t("🔒 حظر المستخدم", "🔒 Block User")}
                        </button>
                        <button onClick={async () => {
                          await api(`/api/users/${selectedUser.id}/negative-toggle`, { method: "PUT" });
                          const updated = await api(`/api/users/${selectedUser.id}`);
                          setSelectedUser(updated);
                        }} className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedUser.negative_allowed ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600"}`}>
                          {selectedUser.negative_allowed ? "✅ " + t("السماح بالسالب مفعل", "Negative Allowed") : "⛔ " + t("السماح بالسالب", "Allow Negative")}
                        </button>
                        {selectedUser.role !== "admin" && (
                          <button onClick={() => { setConfirmDelete(selectedUser); }} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                            🗑️ {t("حذف المستخدم", "Delete User")}
                          </button>
                        )}
                      </div>

                      {selectedUser.rankBonuses && selectedUser.rankBonuses.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-bold mb-3">{t("🏆 الرتب المحققة", "🏆 Achieved Ranks")}</h4>
                          <div className="flex flex-wrap gap-2">
                            {[...new Set(selectedUser.rankBonuses.map(rb => rb.rank_name))].map((rankName, i) => {
                              const bonus = selectedUser.rankBonuses.find(rb => rb.rank_name === rankName);
                              return (
                                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl">
                                  <span className="text-lg">⭐</span>
                                  <div>
                                    <p className="text-sm font-bold text-yellow-700">{rankName}</p>
                                    {bonus?.amount > 0 && <p className="text-xs text-yellow-600">+{bonus.amount} bonus</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-bold mb-3">{t("👥 فريق التسويق", "👥 Marketing Team")}</h4>
                        {(() => {
                          const levels = selectedUser.teamLevels || [];
                          const maxLevel = levels.length > 0 ? Math.max(...levels.map(m => m.depth)) : 0;
                          const tabs = Array.from({ length: maxLevel }, (_, i) => i + 1);
                          const filtered = levels.filter(m => m.depth === teamTab);
                          const totalByLevel = {};
                          levels.forEach(m => { totalByLevel[m.depth] = (totalByLevel[m.depth] || 0) + 1; });
                          return (
                            <>
                              {tabs.length > 0 && (
                                <div className="flex gap-2 mb-3 flex-wrap">
                                  {tabs.map(lvl => (
                                    <button key={lvl} onClick={() => setTeamTab(lvl)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${teamTab === lvl ? "bg-everest-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                                      {t("مستوى", "Level")} {lvl} <span className="text-xs opacity-70">({totalByLevel[lvl] || 0})</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {tabs.length === 0 ? (
                                <p className="text-center text-gray-400 py-4">{t("لا يوجد فريق تسويق", "No marketing team")}</p>
                              ) : (
                                <table className="w-full table-data border rounded-lg">
                                  <thead>
                                    <tr className="bg-gray-50"><th>{t("الاسم", "Name")}</th><th>{t("البريد", "Email")}</th><th>ID</th><th>{t("الرتبة", "Rank")}</th><th>{t("الدور", "Role")}</th></tr>
                                  </thead>
                                  <tbody>
                                    {filtered.length > 0 ? filtered.map(m => (
                                      <tr key={m.id} className="border-t">
                                        <td className="font-medium">{m.full_name}</td>
                                        <td className="text-xs text-gray-500">{m.email}</td>
                                        <td className="text-xs font-mono"><span className="text-gray-400">ID:</span> <span className="font-semibold text-gray-600">{m.referral_code || m.id}</span></td>
                                        <td className="text-xs">⭐ {m.rank || "—"}</td>
                                        <td><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{m.role}</span></td>
                                      </tr>
                                    )) : (
                                      <tr><td colSpan="5" className="text-center text-gray-400 py-4">{t("لا يوجد أعضاء في هذا المستوى", "No members at this level")}</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}

                  {profileTab === "activity" && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-lg mb-4">📈 {t("النشاط الأسبوعي", "Weekly Activity")}</h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h5 className="font-bold mb-3">
                          📊 {t("المبيعات المباشرة", "📊 Direct Sales")}
                        </h5>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            { label: t("إجمالي المبيعات", "Total Direct Sales"), value: rankProgress?.totalDirectSales ?? 0, color: "text-blue-700" },
                            { label: t("🎓 مبيعات طلاب", "🎓 Student Sales"), value: rankProgress?.studentDirectSales ?? 0, color: "text-green-600" },
                            { label: t("🆓 مبيعات تسجيل مجاني", "🆓 Reg Free Sales"), value: rankProgress?.registrationDirectSales ?? 0, color: "text-yellow-600" },
                            { label: t("المبيعات المؤهلة", "Qualified Sales"), value: rankProgress?.qualifiedDirectSales ?? 0, color: rankProgress?.meetsMinDirects ? "text-green-600" : "text-red-500" },
                          ].map((s, i) => (
                            <div key={i} className="bg-white rounded-lg p-3 border">
                              <p className="text-xs text-gray-400">{s.label}</p>
                              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {directMembers.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <h5 className="font-bold mb-3">{t("👥 الأعضاء المباشرين", "👥 Direct Members")} ({directMembers.length})</h5>
                          <div className="space-y-2">
                            {directMembers.map((d) => (
                              <div key={d.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${
                                d.status === 'active' ? 'bg-white' : 'bg-red-50 border-red-200'
                              }`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    {d.avatar ? <img src={d.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold text-gray-500">{(d.full_name || "U")[0]}</span>}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">
                                      {d.full_name}
                                      <span className={`text-xs mx-1 px-1.5 py-0.5 rounded ${d.account_type === 'student' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {d.account_type === 'student' ? 'Student' : 'REG'}
                                      </span>
                                    </p>
                                    <p className="text-xs text-gray-400">{d.email}</p>
                                  </div>
                                </div>
                                <div className="text-right text-xs">
                                  <p className="font-bold text-gray-600">{d.e_money ?? 0} EM</p>
                                  <p className={`font-bold ${d.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>{d.status}</p>
                                  <p className="text-gray-400">{new Date(d.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {directMembers.length === 0 && (
                        <div className="bg-gray-50 rounded-xl p-4 text-center">
                          <p className="text-gray-400">{t("لا يوجد أعضاء مباشرين", "No direct members")}</p>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h5 className="font-bold mb-3">{t("🎯 ملخص الأهلية", "🎯 Eligibility Summary")}</h5>
                        <div className="grid gap-2">
                          {[
                            { label: t("الرتبة", "Rank"), value: selectedUser.rank || t("لا يوجد", "None"), icon: "🏅" },
                            { label: t("الأعضاء المؤهلين", "Qualified Members"), value: rankProgress?.qualifiedDirects ?? 0, icon: "👥" },
                            { label: t("التقدم للرتبة التالية", "Progress to Next"), value: `${Math.round(rankProgress?.progressToNext ?? 0)}%`, icon: "📈" },
                            { label: t("الحد الأدنى المبيعات", "Min Direct Sales"), value: rankProgress?.meetsMinDirects ? "✅ 2+" : "❌ < 2", icon: "📏" },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                              <span className="text-sm text-gray-500">{item.icon} {item.label}</span>
                              <span className="text-sm font-bold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {profileTab === "network" && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-lg mb-4">🌐 {t("الشبكة المؤهلة", "Qualified Network")}</h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: t("أعضاء الفريق المؤهلين", "Qualified Team"), value: rankProgress?.qualifiedDirects ?? 0, color: "text-blue-700" },
                            { label: t("🎓 أعضاء طلاب", "🎓 Student Members"), value: rankProgress?.studentMembers ?? 0, color: "text-green-600" },
                            { label: t("🆓 أعضاء تسجيل مجاني", "🆓 Reg Free Members"), value: rankProgress?.registrationMembers ?? 0, color: "text-yellow-600" },
                          ].map((s, i) => (
                            <div key={i} className="bg-white rounded-lg p-3 border text-center">
                              <p className="text-xs text-gray-400">{s.label}</p>
                              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {directMembers.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <h5 className="font-bold mb-3">{t("👥 أعضاء الفريق المباشرين", "👥 Direct Team Members")}</h5>
                          <div className="space-y-2">
                            {directMembers.map((d) => {
                              const isActive = d.status === 'active';
                              const allRanks = rankProgress.allRanks || [];
                              const userRankIdx = allRanks.findIndex(r => r.name === rankProgress.currentRank?.name);
                              const memberRankIdx = allRanks.findIndex(r => r.name === d.rank);
                              const excludedHigher = isActive && memberRankIdx > userRankIdx && userRankIdx >= 0;
                              return (
                                <div key={d.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${
                                  !isActive ? 'bg-red-50 border-red-200' : excludedHigher ? 'bg-orange-50 border-orange-200' : 'bg-white'
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                      {d.avatar ? <img src={d.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold text-gray-500">{(d.full_name || "U")[0]}</span>}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold">{d.full_name}
                                        <span className={`text-xs mx-1 px-1.5 py-0.5 rounded ${d.account_type === 'student' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {d.account_type === 'student' ? 'Student' : 'REG'}
                                        </span>
                                      </p>
                                      <p className="text-xs text-gray-400">{d.email}</p>
                                    </div>
                                  </div>
                                  <div className="text-right text-xs">
                                    <p className="font-bold text-gray-600">{d.e_money ?? 0} EM</p>
                                    {!isActive && <p className="text-red-500 font-bold">❌ {t("غير نشط", "Inactive")}</p>}
                                    {excludedHigher && <p className="text-orange-500 font-bold">⚠️ {t("رتبة أعلى", "Higher rank")}</p>}
                                    {isActive && !excludedHigher && <p className="text-green-500 font-bold">✅ {t("مؤهل", "Qualified")}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h5 className="font-bold mb-3">{t("🚫 الأعضاء المستبعدون", "🚫 Excluded Members")}</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs text-gray-400">{t("رتبة أعلى", "Excluded Higher Rank")}</p>
                            <p className={`text-xl font-bold mt-1 ${(rankProgress?.higherRankExcluded ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>{rankProgress?.higherRankExcluded ?? 0}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs text-gray-400">{t("غير نشط", "Excluded Inactive")}</p>
                            <p className={`text-xl font-bold mt-1 ${(rankProgress?.inactiveExcluded ?? 0) > 0 ? "text-red-500" : "text-green-500"}`}>{rankProgress?.inactiveExcluded ?? 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <h5 className="font-bold text-sm text-yellow-700 mb-2">📝 {t("قواعد الشبكة المؤهلة", "Qualified Network Rules")}</h5>
                        <ul className="text-xs text-gray-500 space-y-1 ml-4 list-disc">
                          <li>{t("الأعضاء النشطون فقط (status = active)", "Only active members (status = active)")}</li>
                          <li>{t("رتبة العضو ≤ رتبة المستخدم", "Member's rank ≤ user's rank")}</li>
                          <li>{t("كلتا الحسابين (طالب + تسجيل مجاني) تُحسب", "Both Student and Reg Free count")}</li>
                          <li>{t("الأعضاء بترتبة أعلى مستبعدون", "Members with higher rank are excluded")}</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {profileTab === "history" && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-lg mb-4">📜 {t("السجل الأسبوعي", "Weekly History")}</h4>
                      {weeklyHistory.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center">
                          <p className="text-gray-400">{t("لا يوجد سجل بعد. سيتم التسجيل عند الحساب الأسبوعي.", "No history yet. Records will be created during weekly processing.")}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {weeklyHistory.map((wh) => (
                            <div key={wh.id} className="border rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                                onClick={() => setHistoryDetail(historyDetail === wh.id ? null : wh.id)}>
                                <div>
                                  <p className="text-sm font-bold">{wh.week_start} → {wh.week_end}</p>
                                  <p className="text-xs text-gray-400">{wh.previous_rank || "None"} → {wh.current_rank || "None"}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-sm">S:{wh.student_direct_sales} R:{wh.registration_direct_sales}</p>
                                  <p className="text-xs text-gray-400">{t("مؤهل:", "Qualified:")} {wh.qualified_direct_sales}</p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${wh.weekly_commission > 0 ? "text-green-600" : "text-gray-400"}`}>
                                    {wh.weekly_commission > 0 ? `${wh.weekly_commission.toLocaleString()} EM` : "—"}
                                  </p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    wh.commission_status === 'paid' ? 'bg-green-100 text-green-700' :
                                    wh.commission_status === 'not_eligible' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>
                                    {wh.commission_status === 'paid' ? '✅ Paid' :
                                     wh.commission_status === 'not_eligible' ? '❌ Not Eligible' :
                                     wh.commission_status}
                                  </span>
                                </div>
                              </div>
                              {historyDetail === wh.id && (
                                <div className="p-3 bg-gray-50 border-t">
                                  {wh.failure_reason && (
                                    <div className="p-2 bg-red-50 text-red-600 text-xs rounded mb-2">❌ {wh.failure_reason}</div>
                                  )}
                                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {[
                                      [t("مبيعات مباشرة", "Direct Sales"), wh.total_direct_sales],
                                      [t("طلاب", "Students"), wh.student_direct_sales],
                                      [t("تسجيل مجاني", "Reg Free"), wh.registration_direct_sales],
                                      [t("مؤهلة", "Qualified"), wh.qualified_direct_sales],
                                      [t("فريق مؤهل", "Qualified Team"), wh.qualified_team_count],
                                      [t("شبكة مؤهلة", "Qualified Network"), wh.qualified_network_count],
                                      [t("أعضاء طلاب", "Student Members"), wh.student_members],
                                      [t("أعضاء تسجيل مجاني", "Reg Free Members"), wh.registration_members],
                                      [t("مستبعدون (رتبة أعلى)", "Excluded (Higher Rank)"), wh.higher_rank_excluded],
                                      [t("مستبعدون (غير نشط)", "Excluded (Inactive)"), wh.inactive_excluded],
                                    ].map(([label, val], i) => (
                                      <div key={i} className="flex justify-between px-2 py-1 bg-white rounded text-xs">
                                        <span className="text-gray-400">{label}</span>
                                        <span className="font-bold">{val}</span>
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
                  )}

                  {profileTab === "leaderboard" && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-lg mb-4">🏆 {t("لوحة المتصدرين", "Leaderboard")}</h4>
                      {leaderboard.length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center">
                          <p className="text-gray-400">{t("لا يوجد أعضاء بعد", "No members yet")}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {leaderboard.map((u, i) => {
                            const rk = dbRanks.find(r => r.name === u.rank);
                            const isCurrentUser = u.id === selectedUser?.id;
                            return (
                              <div key={u.id} className={`flex items-center justify-between rounded-xl p-3 border transition ${
                                isCurrentUser ? "bg-blue-50 border-blue-300" : i < 3 ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"
                              }`}>
                                <div className="flex items-center gap-3">
                                  <span className={`text-lg font-black w-8 text-center ${i < 3 ? "text-yellow-600" : "text-gray-400"}`}>#{u.position}</span>
                                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    {u.avatar?.trim() ? <img src={u.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold text-gray-500">{(u.full_name || "U")[0]}</span>}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold">
                                      {u.full_name}
                                      {isCurrentUser && <span className="text-xs text-blue-500 ml-1">({t("هذا المستخدم", "This User")})</span>}
                                      {u.account_type === 'registration_free' && <span className="text-xs text-yellow-600 ml-1 px-1.5 py-0.5 bg-yellow-100 rounded">REG</span>}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {rk?.image && <img src={rk.image} alt="" className="w-4 h-4 rounded inline mr-1 object-cover" />}
                                      {u.rank} · {u.total_team_sales || 0} {t("مبيعات", "sales")}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-green-600">{u.e_money} EM</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

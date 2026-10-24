import { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

const T = {
  ar: {
    title: "إعدادات العضوية",
    desc: "تحكم في مدة العضوية للمستخدمين الجدد",
    days: "مدة العضوية (أيام)",
    save: "حفظ",
    saving: "جاري الحفظ...",
    changed: "تم التغيير. تم إرسال إشعار للمستخدمين.",
    found: "النتائج:",
    name: "الاسم:",
    email: "البريد:",
    phone: "الهاتف:",
    expires: "تاريخ انتهاء العضوية:",
    notSet: "غير محدد",
    daysRemaining: "الأيام المتبقية:",
    unknown: "غير معروف",
    status: "الحالة:",
    blocked: "محظور",
    active: "نشط",
    search: "بحث",
    loading: "جاري...",
    searchLabel: "البحث عن صلاحية عضوية المستخدم",
    searchPlaceholder: "أدخل الاسم أو البريد الإلكتروني أو المعرف أو الهاتف...",
    note: "سيتم إرسال إشعار إلى جميع المستخدمين عند تغيير المدة.",
    errNoAdmin: "معرف المدير غير موجود. أعد تسجيل الدخول.",
    errInvalidNumber: "الرجاء إدخال عدد أيام صحيح.",
    edit: "تعديل",
    cancel: "إلغاء",
    saveChanges: "حفظ التعديلات",
    saved: "تم حفظ التعديلات",
    noResults: "لا توجد نتائج",
    newDate: "تاريخ الانتهاء الجديد",
    selectUser: "اختر مستخدم من النتائج",
    userId: "المعرف",
    unblock: "فك الحظر",
    unblocked: "تم فك الحظر",
  },
  en: {
    title: "Membership Settings",
    desc: "Control the duration of new memberships",
    days: "Membership Duration (Days)",
    save: "Save",
    saving: "Saving...",
    changed: "Membership duration updated. All users have been notified.",
    found: "Results:",
    name: "Name:",
    email: "Email:",
    phone: "Phone:",
    expires: "Membership Expires At:",
    notSet: "Not set",
    daysRemaining: "Days remaining:",
    unknown: "Unknown",
    status: "Status:",
    blocked: "Blocked",
    active: "Active",
    search: "Search",
    loading: "Loading...",
    searchLabel: "Search User Membership",
    searchPlaceholder: "Enter name, email, ID, or phone...",
    note: "A notification will be sent to all users when the duration is changed.",
    errNoAdmin: "Admin ID not found. Please login again.",
    errInvalidNumber: "Please enter a valid number of days.",
    edit: "Edit",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    saved: "Changes saved",
    noResults: "No results found",
    newDate: "New expiry date",
    selectUser: "Select a user from results",
    userId: "ID",
    unblock: "Unblock",
    unblocked: "Unblocked",
  },
};

export default function MembershipSettingsPage() {
  const { lang } = useLang();
  const t = T[lang] || T.en;
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newExpiry, setNewExpiry] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    api("/api/settings/membership_duration")
      .then((row) => setDuration(row.value || "183"))
      .catch(() => setDuration("183"));
  }, []);

  const getAdminId = () => { try { return JSON.parse(localStorage.getItem("admin_session") || "{}").userId; } catch { return null; } };

  const handleSave = async () => {
    const adminId = getAdminId();
    if (!adminId) { setError(t.errNoAdmin); return; }
    const days = parseInt(duration);
    if (!days || days < 1) { setError(t.errInvalidNumber); return; }
    setLoading(true); setError(""); setMessage("");
    try {
      await api("/api/settings/membership_duration", {
        method: "PUT",
        body: JSON.stringify({ value: String(days), admin_id: adminId }),
      });
      setMessage(t.changed);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setSearchResults([]); setEditingUser(null); setError(""); setEditMsg("");
    try {
      const url = `/api/settings/membership-search/${encodeURIComponent(searchQuery.trim())}`;
      const data = await api(url);
      if (data && data.error) {
        setError(data.error);
      } else if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setError("Unexpected response: " + JSON.stringify(data).slice(0, 200));
      }
    } catch (e) { setError("Fetch error: " + e.message); } finally { setSearchLoading(false); }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setNewExpiry(user.membership_expires_at ? user.membership_expires_at.split("T")[0] : "");
    setEditMsg("");
  };

  const handleSaveExpiry = async () => {
    if (!editingUser) return;
    const adminId = getAdminId();
    if (!adminId) { setError(t.errNoAdmin); return; }
    setEditLoading(true); setEditMsg(""); setError("");
    try {
      const res = await api(`/api/settings/membership-expiry/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ membership_expires_at: newExpiry || null, admin_id: adminId }),
      });
      setEditMsg(res?.unblocked ? `${t.saved} + ${t.unblocked}` : t.saved);
      setSearchResults((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, membership_expires_at: newExpiry || null } : u)));
      setEditingUser(null);
    } catch (e) { setError(e.message); } finally { setEditLoading(false); }
  };

  const handleUnblock = async (user) => {
    const adminId = getAdminId();
    if (!adminId) { setError(t.errNoAdmin); return; }
    setUnblockingId(user.id);
    try {
      await api(`/api/settings/membership-unblock/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ admin_id: adminId }),
      });
      setSearchResults((prev) => prev.map((u) => (u.id === user.id ? { ...u, blocked: 0 } : u)));
      setEditMsg(t.unblocked);
    } catch (e) { setError(e.message); } finally { setUnblockingId(null); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{t.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{t.desc}</p>
      </div>

      {/* Membership duration card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">{t.days}</h2>
        <div className="flex items-center gap-4">
          <input
            type="number"
            className="w-40 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-everest-500 focus:border-transparent outline-none transition"
            value={duration}
            min="1"
            onChange={(e) => setDuration(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={loading}
            className={"px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-everest-600 hover:bg-everest-700 transition " + (loading ? "opacity-50 cursor-not-allowed" : "")}
          >
            {loading ? t.saving : t.save}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-600">{message}</p>}
        <p className="mt-4 text-xs text-gray-400">{t.note}</p>
      </div>

      {/* Search & edit membership card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">{t.searchLabel}</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-everest-500 focus:border-transparent outline-none transition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t.searchPlaceholder}
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className={"px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-everest-500 hover:bg-everest-600 transition " + (searchLoading ? "opacity-50 cursor-not-allowed" : "")}
          >
            {searchLoading ? t.loading : t.search}
          </button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="text-xs font-bold text-gray-400 mb-2">{t.found} ({searchResults.length})</div>
            {searchResults.map((u) => {
              const remaining = u.days_remaining !== null ? u.days_remaining : null;
              return (
                <div key={u.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm">{u.full_name || "—"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">📧 {u.email || "—"}</div>
                      {u.phone && <div className="text-xs text-gray-500 mt-0.5">📱 {u.phone}</div>}
                      <div className="text-xs mt-0.5 font-mono"><span className="text-gray-400">{t.userId}:</span> <span className="font-semibold text-gray-700">{u.referral_code || u.id}</span></div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-400">{t.expires}</div>
                      <div className="text-sm font-semibold text-gray-800">{u.membership_expires_at ? u.membership_expires_at.split("T")[0] : t.notSet}</div>
                      {remaining !== null && (
                        <div className={"text-xs font-bold mt-0.5 " + (remaining <= 5 ? "text-red-600" : "text-green-600")}>
                          {remaining} {lang === "ar" ? "يوم متبقي" : "days left"}
                        </div>
                      )}
                      <span className={"inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full " + (u.blocked ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                        {u.blocked ? t.blocked : t.active}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-left flex gap-2">
                    {u.blocked ? (
                      <button
                        onClick={() => handleUnblock(u)}
                        disabled={unblockingId === u.id}
                        className={"px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition " + (unblockingId === u.id ? "opacity-50 cursor-not-allowed" : "")}
                      >
                        🔓 {unblockingId === u.id ? t.loading : t.unblock}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(u)}
                        className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white text-everest-600 text-xs font-semibold hover:bg-everest-50 transition"
                      >
                        ✏️ {t.edit}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {searchResults.length === 0 && !searchLoading && searchQuery && (
          <p className="mt-4 text-sm text-gray-400 text-center">{t.noResults}</p>
        )}

        {editMsg && <p className="mt-3 text-sm text-green-600">{editMsg}</p>}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">{t.edit}</h3>
            <p className="text-sm text-gray-500 mb-5">{editingUser.full_name} — {editingUser.email}</p>

            <label className="block text-xs font-bold text-gray-500 mb-1.5">{t.newDate}</label>
            <input
              type="date"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-everest-500 outline-none transition mb-5"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditingUser(null)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSaveExpiry}
                disabled={editLoading}
                className={"px-5 py-2 rounded-xl text-sm font-semibold text-white bg-everest-600 hover:bg-everest-700 transition " + (editLoading ? "opacity-50 cursor-not-allowed" : "")}
              >
                {editLoading ? t.saving : t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

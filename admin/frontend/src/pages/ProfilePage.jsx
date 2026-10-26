import React, { useState, useEffect } from "react";
import PageLoading from "../components/PageLoading";
import { useLang } from "../LangContext";
import { api, getAdminHeaders } from "../api.js";

export default function ProfilePage() {
  const { t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api("/api/admin-auth/me")
      .then(d => { setProfile(d); })
      .catch(e => console.error("Failed to load profile:", e))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const body = {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        address: profile.address || "",
        bio: profile.bio || "",
      };
      if (pw) body.password = pw;
      const d = await api("/api/admin-auth/me", { method: "PUT", body: JSON.stringify(body) });
      setProfile(d);
      setPw("");
      setMsg(t("✅ تم حفظ التغييرات بنجاح", "✅ Changes saved successfully"));
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  if (loading) return (
    <PageLoading>
      <p className="text-center py-20 text-gray-400">{t("جاري التحميل...", "Loading...")}</p>
    </PageLoading>
  );
  if (!profile) return <p className="text-center py-20 text-red-400">{t("فشل تحميل البيانات", "Failed to load data")}</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("⚙️ الإعدادات الشخصية", "⚙️ Profile Settings")}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold mb-4">{t("👤 الملف الشخصي", "👤 Profile")}</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("المعرف (ID)", "ID")}</label>
              <input value={profile.id} disabled className="w-full px-4 py-2 border rounded-lg mt-1 bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("الاسم", "Full Name")}</label>
              <input value={profile.full_name || ""} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} className="w-full px-4 py-2 border rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("البريد الإلكتروني", "Email")}</label>
              <input type="email" value={profile.email || ""} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 border rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("الهاتف", "Phone")}</label>
              <input value={profile.phone || ""} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2 border rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("العنوان", "Address")}</label>
              <input value={profile.address || ""} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} className="w-full px-4 py-2 border rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("السيرة الذاتية", "Bio")}</label>
              <textarea value={profile.bio || ""} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} className="w-full px-4 py-2 border rounded-lg mt-1" rows={3} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-bold mb-4">{t("🔐 تغيير كلمة المرور", "🔐 Change Password")}</h3>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={t("اتركها فارغة لعدم التغيير", "Leave blank to keep current")} className="w-full px-4 py-2 border rounded-lg" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-bold mb-4">{t("ℹ️ معلومات الحساب", "ℹ️ Account Info")}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">{t("الدور", "Role")}</span><span className="font-semibold bg-everest-100 text-everest-700 px-2 py-0.5 rounded-full text-xs">{profile.role}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">{t("تاريخ الإنشاء", "Created")}</span><span className="font-semibold">{profile.created_at ? profile.created_at.slice(0, 10) : "–"}</span></div>
            </div>
          </div>

          {msg && <div className="bg-white rounded-xl shadow-sm border p-4 text-center text-sm font-medium">{msg}</div>}

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-everest-600 text-white rounded-xl font-bold hover:bg-everest-700 transition disabled:opacity-50">
            {saving ? t("جاري الحفظ...", "Saving...") : t("💾 حفظ التغييرات", "💾 Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

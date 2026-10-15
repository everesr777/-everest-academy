import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api, uploadApi } from "../api.js";

const DEFAULT_HERO_IMAGE = "/images/Screenshot_2026-06-28_145125-removebg-preview.png";

export default function LeadersPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [leaders, setLeaders] = useState([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroMsg, setHeroMsg] = useState("");

  const getAdminId = () => { try { return JSON.parse(localStorage.getItem("admin_session") || "{}").userId; } catch { return null; } };

  useEffect(() => { fetchLeaders(); fetchHeroImage(); }, []);

  const fetchLeaders = () => api("/api/leaders").then(setLeaders).catch(() => {});

  const fetchHeroImage = () => {
    api("/api/home-hero").then((d) => setHeroImage((d && d.url) || DEFAULT_HERO_IMAGE)).catch(() => {});
  };

  const saveHeroImage = async (url) => {
    const adminId = getAdminId();
    if (!adminId) { setHeroMsg(t("معرف المدير غير موجود. أعد تسجيل الدخول.", "Admin ID not found. Please login again.")); return; }
    setHeroMsg("");
    try {
      await api("/api/settings/home_hero_image", { method: "PUT", body: JSON.stringify({ value: url, admin_id: adminId }) });
      setHeroImage(url || DEFAULT_HERO_IMAGE);
      setHeroMsg(t("تم حفظ الصورة الترحيبية ✅", "Welcome image saved ✅"));
    } catch (e) { setHeroMsg(e.message); }
  };

  const changeHeroImage = async (file) => {
    if (!file) return;
    setHeroUploading(true);
    setHeroMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await uploadApi(fd);
      if (d && d.url) await saveHeroImage(d.url);
      else setHeroMsg(t("فشل رفع الصورة", "Image upload failed"));
    } catch (e) { setHeroMsg(e.message); }
    setHeroUploading(false);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await api("/api/leaders/refresh", { method: "POST" });
      await fetchLeaders();
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const addLeader = async () => {
    if (!userId.trim()) return;
    try {
      const res = await api("/api/leaders/add", { method: "POST", body: JSON.stringify({ userId: userId.trim() }) });
      if (res.error) return alert(res.error);
      setUserId("");
      fetchLeaders();
    } catch (e) { alert(e.message); }
  };

  const removeLeader = async (id) => {
    if (!confirm(t("إزالة هذا القائد؟", "Remove this leader?"))) return;
    try {
      await api(`/api/leaders/${id}`, { method: "DELETE" });
      fetchLeaders();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("🏆 إدارة القادة", "🏆 Leaders Management")} (Our Leaders)</h2>
      <p className="text-gray-500 text-sm mb-4">{t("أعلى 10 أعضاء — يتم تحديثهم تلقائياً كل أسبوع. يمكنك الإضافة أو الحذف يدوياً (الحد الأقصى 10).", "Top 10 members — auto-updated weekly. You can add or remove manually (max 10).")}</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">🖼️ {t("تغير الصوره الترحيبيه", "Change Welcome Image")}</h3>
          {heroMsg && <span className="text-xs text-gray-500">{heroMsg}</span>}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-40 h-28 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
            {heroImage ? (
              <img src={heroImage} alt={t("الصورة الترحيبية", "Welcome image")} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = "none" }} />
            ) : (
              <span className="text-gray-300 text-3xl">🖼️</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className={`px-5 py-2.5 rounded-xl font-medium text-sm text-white transition ${heroUploading ? "bg-everest-400 cursor-wait" : "bg-everest-600 hover:bg-everest-700 cursor-pointer"}`}>
              {heroUploading ? t("جاري الرفع...", "Uploading...") : "⬆️ " + t("تغير الصورة الترحيبيه", "Change Welcome Image")}
              <input type="file" accept="image/*" className="hidden" disabled={heroUploading} onChange={(e) => { changeHeroImage(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button onClick={() => saveHeroImage("")}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition">
              ↩️ {t("استعادة الافتراضية", "Reset to default")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-2 flex-1 min-w-[280px]">
          <input placeholder={t("معرف المستخدم (UUID)", "User ID (UUID)")} value={userId} onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLeader()}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-everest-500 flex-1" />
          <button onClick={addLeader} disabled={leaders.length >= 10}
            className="px-5 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            ➕ {t("اضافة", "Add")}
          </button>
        </div>
        <button onClick={refresh} disabled={loading}
          className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition disabled:opacity-50">
          {loading ? t("جاري...", "...Loading") : "🔄 " + t("تحديث تلقائي", "Auto Refresh")}
        </button>
      </div>

      {leaders.length >= 10 && (
        <p className="text-xs text-orange-500 mb-4">⚠️ {t("الحد الأقصى 10 أعضاء — أزل عضو أولاً قبل الإضافة", "Max 10 members — remove one before adding")}</p>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold">🏆 {t("أعلى الرتب", "Top Ranks")} ({leaders.length}/10)</h3>
        </div>
        {leaders.length === 0 ? (
          <p className="p-8 text-gray-400 text-center">{t("لا يوجد أعضاء برتب بعد", "No ranked members yet")}</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaders.map((l, i) => (
              <div key={l.id || i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-gray-300 w-6">#{i + 1}</span>
                  <span className="text-2xl">{l.icon || "🏆"}</span>
                  {l.avatar ? (
                    <img src={l.avatar} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100" onError={(e) => { e.target.style.display = "none" }} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-everest-400 to-everest-600 flex items-center justify-center text-white font-bold text-lg">
                      {(l.name || "?")[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{l.name}</p>
                    <p className="text-sm text-gray-500">{l.icon || "🏆"} {l.rank}</p>
                  </div>
                </div>
                <button onClick={() => removeLeader(l.id)}
                  className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                  🗑️ {t("ازالة", "Remove")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

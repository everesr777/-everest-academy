import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";

export default function CustomerServicePage() {
  const { t, lang } = useLang();
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [telegram, setTelegram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  useEffect(() => {
    api("/api/settings")
      .then((data) => {
        setWhatsapp(data.customer_service_whatsapp || "");
        setEmail(data.customer_service_email || "");
        setInstagram(data.social_instagram || "");
        setTelegram(data.social_telegram || "");
        setTiktok(data.social_tiktok || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const s = JSON.parse(localStorage.getItem("admin_session") || "{}");
      await api("/api/settings/customer_service_whatsapp", {
        method: "PUT",
        body: JSON.stringify({ value: whatsapp, admin_id: s.userId }),
      });
      await api("/api/settings/customer_service_email", {
        method: "PUT",
        body: JSON.stringify({ value: email, admin_id: s.userId }),
      });
      await api("/api/settings/social_instagram", {
        method: "PUT",
        body: JSON.stringify({ value: instagram, admin_id: s.userId }),
      });
      await api("/api/settings/social_telegram", {
        method: "PUT",
        body: JSON.stringify({ value: telegram, admin_id: s.userId }),
      });
      await api("/api/settings/social_tiktok", {
        method: "PUT",
        body: JSON.stringify({ value: tiktok, admin_id: s.userId }),
      });
      setMsgType("success");
      setMsg(lang === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");
    } catch (e) {
      setMsgType("error");
      setMsg(e.message);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-gray-400 animate-pulse">{t("جاري التحميل...", "Loading...")}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        📞 {t("خدمة العملاء", "Customer Service")}
      </h2>
      <p className="text-sm text-gray-500">{t("أضف رقم الواتساب والبريد الإلكتروني وروابط التواصل الاجتماعي لخدمة العملاء. سيظهر هذه المعلومات للمستخدمين في ملفهم الشخصي وفي الفوتر.", "Add customer service WhatsApp number, email, and social media links. This info will be shown to users in their profile and footer.")}</p>

      <div className="bg-white rounded-2xl shadow-sm border p-6 max-w-lg space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">📱 {t("رقم الواتساب", "WhatsApp Number")}</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+20 1XX XXX XXXX"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">📧 {t("البريد الإلكتروني", "Email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="support@everest.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">📸 {t("رابط انستجرام", "Instagram Link")}</label>
          <input
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/everestacademy"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">✈️ {t("رابط تيليجرام", "Telegram Link")}</label>
          <input
            type="url"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="https://t.me/everestacademy"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">🎵 {t("رابط تيك توك", "TikTok Link")}</label>
          <input
            type="url"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="https://tiktok.com/@everestacademy"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition"
          />
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msgType === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {msgType === "success" ? "✅ " : "❌ "}{msg}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #d4af37, #b38728)" }}
        >
          {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "💾 حفظ" : "💾 Save")}
        </button>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-2xl border p-6 max-w-lg">
        <h3 className="text-sm font-bold text-gray-400 mb-3">{t("معاينة", "Preview")}</h3>
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">{t("تواصل مع خدمة العملاء", "Contact Customer Service")}</p>
          {whatsapp && (
            <a
              href={`https://wa.me/${(() => { let d = whatsapp.replace(/[^0-9]/g, ""); if (d.startsWith("0")) d = "20" + d; return d; })()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 hover:bg-green-100 transition"
            >
              📱 WhatsApp: {whatsapp}
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
            >
              📧 {email}
            </a>
          )}
          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 border border-pink-200 rounded-lg text-sm font-medium text-pink-700 hover:bg-pink-100 transition"
            >
              📸 Instagram
            </a>
          )}
          {telegram && (
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-lg text-sm font-medium text-sky-700 hover:bg-sky-100 transition"
            >
              ✈️ Telegram
            </a>
          )}
          {tiktok && (
            <a
              href={tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              🎵 TikTok
            </a>
          )}
          {!whatsapp && !email && !instagram && !telegram && !tiktok && <p className="text-xs text-gray-400">{t("لم يتم إضافة بيانات بعد", "No data added yet")}</p>}
        </div>
      </div>
    </div>
  );
}

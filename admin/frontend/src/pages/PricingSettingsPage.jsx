import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import { useLang } from "../LangContext.jsx";

export default function PricingSettingsPage() {
  const { t } = useLang();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api("/api/settings")
      .then((d) => setSettings(d || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const adminId = JSON.parse(localStorage.getItem("admin_session") || "{}").userId;

      const contentPrice = settings.content_price || "0";
      await api("/api/settings/content_price", {
        method: "PUT",
        body: JSON.stringify({ value: String(contentPrice), admin_id: adminId }),
      });

      const costVal = settings.create_account_cost || "5500";
      await api("/api/settings/create_account_cost", {
        method: "PUT",
        body: JSON.stringify({ value: String(costVal), admin_id: adminId }),
      });

      const commVal = settings.referral_commission || "1000";
      await api("/api/settings/referral_commission", {
        method: "PUT",
        body: JSON.stringify({ value: String(commVal), admin_id: adminId }),
      });

      setSaved(true);
    } catch (e) {
      alert(t("خطأ في الحفظ: ", "Error saving: ") + e.message);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-gray-400 animate-pulse">{t("جاري التحميل...", "Loading...")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">💰 {t("إعدادات الأسعار", "Pricing Settings")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("تحكم في سعر المحتوى وتكلفة إنشاء الحسابات", "Control content price and account creation cost")}</p>
      </div>

      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-lg border-b pb-3 mb-4">{t("سعر المحتوى (كل الكورسات)", "Content Price (All Courses)")}</h3>
        <p className="text-xs text-gray-400 mb-4">{t("السعر الذي يدفعه الطالب لشراء كل المحتوى التعليمي في المنصة", "The price a student pays to purchase all educational content on the platform")}</p>
        <div className="max-w-md">
          <label className="text-sm font-bold text-gray-700 mb-2 block">{t("السعر (بالجنيه / $)", "Price (in $)")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.content_price || "0"}
              onChange={(e) => handleChange("content_price", e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
            <span className="text-sm font-bold text-gray-400">$</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-lg border-b pb-3 mb-4">{t("تكلفة إنشاء حساب لشخص آخر", "Create Account for Others Cost")}</h3>
        <div className="max-w-md">
          <label className="text-sm font-bold text-gray-700 mb-2 block">{t("التكلفة (بالجنيه / $)", "Cost (in $)")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.create_account_cost || "5500"}
              onChange={(e) => handleChange("create_account_cost", e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
            <span className="text-sm font-bold text-gray-400">$</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t("القيمة الافتراضية: 5500 $", "Default: 5500 $")}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-bold text-lg border-b pb-3 mb-4">{t("عمولة الإحالة", "Referral Commission")}</h3>
        <p className="text-xs text-gray-400 mb-4">{t("المكافأة التي يحصل عليها المسوق عند تفعيل حساب عضو جديد", "Reward a marketer gets when a new member's account is activated")}</p>
        <div className="max-w-md">
          <label className="text-sm font-bold text-gray-700 mb-2 block">{t("العمولة ($)", "Commission ($)")}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.referral_commission || "1000"}
              onChange={(e) => handleChange("referral_commission", e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
            />
            <span className="text-sm font-bold text-gray-400">$</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t("القيمة الافتراضية: 1000 $", "Default: 1000 $")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={saving}
          className="px-8 py-2.5 bg-everest-600 text-white rounded-lg font-bold text-sm hover:bg-everest-700 disabled:opacity-50 transition"
        >
          {saving ? t("جاري الحفظ...", "Saving...") : t("حفظ جميع الإعدادات", "Save All Settings")}
        </button>
        {saved && <span className="text-green-600 text-sm font-bold">✅ {t("تم الحفظ بنجاح!", "Saved successfully!")}</span>}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function PaymentGatewayPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [gateways, setGateways] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editIt$, setEditIt$] = useState(null);
  const [form, setForm] = useState({ type: "vodafone", value: "", label: "" });

  const load = () => api("/api/payment-gateways").then(setGateways);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditIt$(null); setForm({ type: "vodafone", value: "", label: "" }); setShowForm(true); };
  const openEdit = (g) => { setEditIt$(g); setForm({ type: g.type, value: g.value, label: g.label || "" }); setShowForm(true); };

  const save = async () => {
    if (!form.value) return;
    if (editIt$) {
      await api(`/api/payment-gateways/${editIt$.id}`, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await api("/api/payment-gateways", { method: "POST", body: JSON.stringify(form) });
    }
    setShowForm(false); setEditIt$(null); load();
  };

  const toggleActive = async (g) => {
    await api(`/api/payment-gateways/${g.id}`, { method: "PUT", body: JSON.stringify({ is_active: g.is_active ? 0 : 1 }) });
    load();
  };

  const remove = async (id) => {
    if (!confirm(t("هل أنت متأكد من حذف وسيلة الدفع هذه؟", "Are you sure you want to delete this payment method?"))) return;
    await api(`/api/payment-gateways/${id}`, { method: "DELETE" });
    load();
  };

  const typeIcons = { vodafone: "📱", instapay: "🏦", cash: "💵" };
  const typeLabels = { vodafone: t("فودافون كاش", "Vodafone Cash"), instapay: t("انستاباي", "Instapay"), cash: t("كاش", "Cash") };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t("💳 بوابات الدفع", "💳 Payment Gateways")}</h2>
          <p className="text-gray-500 text-sm mt-1">{t("إدارة وسائل الدفع المتاحة (فودافون كاش، انستاباي)", "Manage available payment methods (Vodafone Cash, Instapay)")}</p>
        </div>
        <button onClick={openAdd} className="px-5 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition flex items-center gap-2 shadow-sm">
          <span>+</span> {t("إضافة وسيلة دفع", "Add Payment Method")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t("إجمالي وسائل الدفع", "Total Payment Methods"), value: gateways.length, icon: "💳", color: "#6366f1" },
          { label: t("فودافون كاش", "Vodafone Cash"), value: gateways.filter(g => g.type === "vodafone").length, icon: "📱", color: "#10b981" },
          { label: t("انستاباي", "Instapay"), value: gateways.filter(g => g.type === "instapay").length, icon: "🏦", color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: s.color + "15" }}>{s.icon}</div>
            <div>
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gateway Cards */}
      {gateways.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-5xl mb-4">💳</p>
          <p className="text-gray-400 font-medium">{t("لا توجد وسائل دفع مضافة بعد", "No payment methods added yet")}</p>
          <p className="text-gray-300 text-sm mt-1">{t("أضف وسيلة الدفع الأولى الآن", "Add the first payment method now")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gateways.map((g) => (
            <div key={g.id} className={`bg-white rounded-xl shadow-sm border transition hover:shadow-md ${g.is_active ? "border-gray-100" : "border-red-200 bg-red-50/30"}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: (g.type === "vodafone" ? "#10b981" : "#f59e0b") + "15" }}>
                      {typeIcons[g.type] || "💳"}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{typeLabels[g.type] || g.type} {g.label && `- ${g.label}`}</h3>
                      <p className={`text-lg font-mono font-bold mt-1 ${g.is_active ? "text-everest-600" : "text-gray-400"}`} dir="ltr">{g.value}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${g.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {g.is_active ? t("نشط", "Active") : t("معطل", "Inactive")}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${g.is_active ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                      {g.is_active ? t("🔴 تعطيل", "🔴 Deactivate") : t("🟢 تفعيل", "🟢 Activate")}
                    </button>
                    <button onClick={() => openEdit(g)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">{t("✏️ تعديل", "✏️ Edit")}</button>
                    <button onClick={() => remove(g.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">{t("🗑️ حذف", "🗑️ Delete")}</button>
                  </div>
                  <span className="text-xs text-gray-300">{new Date(g.created_at).toLocaleDateString("ar-EG")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editIt$ ? t("تعديل وسيلة الدفع", "Edit Payment Method") : t("إضافة وسيلة دفع جديدة", "Add New Payment Method")}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("نوع وسيلة الدفع", "Payment Method Type")}</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: "vodafone", icon: "📱", label: t("فودافون كاش", "Vodafone Cash") },
                    { type: "instapay", icon: "🏦", label: t("انستاباي", "Instapay") },
                  ].map((opt) => (
                    <button key={opt.type} onClick={() => setForm({ ...form, type: opt.type })}
                      className={`p-3 rounded-xl border-2 text-center transition ${
                        form.type === opt.type ? "border-everest-500 bg-everest-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl block mb-1">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {form.type === "vodafone" ? t("رقم فودافون كاش", "Vodafone Cash Number") : t("رقم / حساب انستاباي", "Instapay Number / Account")}
                </label>
                <input type="text" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === "vodafone" ? t("مثال: 0100 000 0000", "e.g. 0100 000 0000") : t("مثال: example@instapay", "e.g. example@instapay")}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("تسمية توضيحية (اختياري)", "Label (optional)")}</label>
                <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={t("مثال: الرقم الأساسي", "e.g. Primary number")}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl font-medium text-sm">{t("إلغاء", "Cancel")}</button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition">
                {editIt$ ? t("حفظ التعديلات", "Save Changes") : t("إضافة", "Add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

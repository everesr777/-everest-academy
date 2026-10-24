import React, { useState, useEffect, useRef } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function RanksManagementPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [ranks, setRanks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editIt$, setEditIt$] = useState(null);
  const [form, setForm] = useState({ name: "", sales_required: 0, bonus: 0, is_active: 1, image: "" });
  const [imagePreview, setImagePreview] = useState("");
  const fileRef = useRef(null);

  const load = () => api("/api/ranks?all=true").then(setRanks);
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditIt$(null);
    setForm({ name: "", sales_required: 0, bonus: 0, is_active: 1, image: "" });
    setImagePreview("");
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditIt$(r);
    setForm({ name: r.name, sales_required: r.sales_required, bonus: r.bonus, is_active: r.is_active, image: r.image || "" });
    setImagePreview(r.image || "");
    setShowForm(true);
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setForm({ ...form, image: base64 });
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setForm({ ...form, image: "" });
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editIt$) {
      await api(`/api/ranks/${editIt$.id}`, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await api("/api/ranks", { method: "POST", body: JSON.stringify(form) });
    }
    setShowForm(false); setEditIt$(null); load();
  };

  const toggleActive = async (r) => {
    await api(`/api/ranks/${r.id}`, { method: "PUT", body: JSON.stringify({ is_active: r.is_active ? 0 : 1 }) });
    load();
  };

  const remove = async (id, name) => {
    if (!confirm(t(`هل أنت متأكد من حذف رتبة "${name}"؟`, `Are you sure you want to delete rank "${name}"?`))) return;
    await api(`/api/ranks/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t("🏅 إدارة الرتب", "🏅 Ranks Management")}</h2>
          <p className="text-gray-500 text-sm mt-1">{t("إضافة، تعديل، إخفاء، أو حذف الرتب — الرتب النشطة فقط تظهر للمستخدمين", "Add, edit, hide, or delete ranks — only active ranks are shown to users")}</p>
        </div>
        <button onClick={openAdd} className="px-5 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition flex items-center gap-2 shadow-sm">
          <span>+</span> {t("إضافة رتبة", "Add Rank")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: t("إجمالي الرتب", "Total Ranks"), value: ranks.length, icon: "🏅", color: "#6366f1" },
          { label: t("رتب نشطة", "Active Ranks"), value: ranks.filter(r => r.is_active).length, icon: "✅", color: "#10b981" },
          { label: t("رتب معطلة", "Inactive Ranks"), value: ranks.filter(r => !r.is_active).length, icon: "🚫", color: "#ef4444" },
          { label: t("أعلى مكافأة", "Highest Bonus"), value: Math.max(...ranks.map(r => r.bonus), 0), icon: "🎁", color: "#f59e0b", suffix: " $" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: s.color + "15" }}>{s.icon}</div>
            <div>
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}{s.suffix || ""}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rank Cards */}
      {ranks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-5xl mb-4">🏅</p>
          <p className="text-gray-400 font-medium">{t("لا توجد رتب مضافة بعد", "No ranks added yet")}</p>
          <p className="text-gray-300 text-sm mt-1">{t("أضف الرتبة الأولى الآن", "Add the first rank now")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranks.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-xl shadow-sm border transition hover:shadow-md ${r.is_active ? "border-gray-100" : "border-red-200 bg-red-50/30"}`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {r.image ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ background: r.is_active ? "#fef3c7" : "#f3f4f6", color: r.is_active ? "#d97706" : "#9ca3af" }}>
                        #{i + 1}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className={`text-lg font-bold ${r.is_active ? "text-gray-900" : "text-gray-400"}`}>{r.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {r.is_active ? t("نشط", "Active") : t("معطل", "Inactive")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        <span className="text-gray-500">🎯 <strong>{r.sales_required}</strong> {r.sales_required === 0 ? t("(بدون شرط)", "(No requirement)") : t("مبيعات", "sales")}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">🎁 <strong>{r.bonus.toLocaleString()}</strong> {r.bonus > 0 ? "$" : t("(بدون)", "(None)")}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">📊 {t("الترتيب:", "Order:")} <strong>{r.sort_order}</strong></span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">👥 {t("المستخدمون:", "Users:")} <strong>{r.user_count || 0}</strong></span>
                        {!r.image && <><span className="text-gray-300">|</span><span className="text-orange-400 text-xs">⚠️ {t("بدون صورة", "No image")}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${r.is_active ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                      {r.is_active ? t("🔴 تعطيل", "🔴 Deactivate") : t("🟢 تفعيل", "🟢 Activate")}
                    </button>
                    <button onClick={() => openEdit(r)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">{t("✏️ تعديل", "✏️ Edit")}</button>
                    <button onClick={() => remove(r.id, r.name)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">{t("🗑️ حذف", "🗑️ Delete")}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{editIt$ ? t("تعديل الرتبة", "Edit Rank") : t("إضافة رتبة جديدة", "Add New Rank")}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("صورة الرتبة", "Rank Image")}</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border" />
                    <button onClick={removeImage} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 transition flex items-center justify-center">✕</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-everest-400 hover:bg-everest-50/30 transition">
                    <span className="text-3xl mb-1">🖼️</span>
                    <span className="text-sm text-gray-400">{t("اضغط لاختيار صورة", "Click to choose image")}</span>
                    <span className="text-xs text-gray-300 mt-0.5">{t("JPEG, PNG — بحد أقصى 2MB", "JPEG, PNG — max 2MB")}</span>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("اسم الرتبة", "Rank Name")}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("مثال: Everest Elite", "e.g. Everest Elite")}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("المبيعات المطلوبة", "Required Sales")}</label>
                  <input type="number" min="0" value={form.sales_required} onChange={(e) => setForm({ ...form, sales_required: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("المكافأة ($)", "Bonus ($)")}</label>
                  <input type="number" min="0" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-everest-500 focus:border-everest-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("الحالة", "Status")}</label>
                <div className="flex gap-3">
                  {[
                    { val: 1, label: t("🟢 نشط", "🟢 Active"), desc: t("تظهر للمستخدمين", "Visible to users") },
                    { val: 0, label: t("🔴 معطل", "🔴 Inactive"), desc: t("مخفية عن المستخدمين", "Hidden from users") },
                  ].map((opt) => (
                    <button key={opt.val} onClick={() => setForm({ ...form, is_active: opt.val })}
                      className={`flex-1 p-3 rounded-xl border-2 text-center transition ${form.is_active === opt.val ? "border-everest-500 bg-everest-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <span className="text-sm font-medium block">{opt.label}</span>
                      <span className="text-xs text-gray-400">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl font-medium text-sm">{t("إلغاء", "Cancel")}</button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-everest-600 text-white rounded-xl font-medium text-sm hover:bg-everest-700 transition">
                {editIt$ ? t("حفظ التعديلات", "Save Changes") : t("إضافة رتبة", "Add Rank")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

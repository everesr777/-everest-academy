import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import PageLoading from "../components/PageLoading";
import { api, getAdminSession } from "../api.js";

export default function AdminsListPage() {
  const { t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editIt$, setEditIt$] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ id: "", full_name: "", email: "", password: "", role: "admin" });
  const [msg, setMsg] = useState("");
  const adminSession = getAdminSession();
  const isManager = adminSession?.user?.role === "manager";

  const load = () => {
    setLoading(true);
    api("/api/admin-auth/list")
      .then(d => { if (Array.isArray(d)) setAdmins(d); else setAdmins([]); })
      .catch(() => setAdmins([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!form.id || !form.full_name || !form.email || !form.password) { alert(t("جميع الحقول مطلوبة", "All fields required")); return; }
    try {
      const d = await api("/api/admin-auth/list", { method: "POST", body: JSON.stringify(form) });
      setMsg(t("✅ تم إضافة الأدمن بنجاح", "✅ Admin added successfully"));
      setShowAdd(false); setForm({ id: "", full_name: "", email: "", password: "", role: "admin" }); load();
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert("❌ " + e.message); }
  };

  const handleEdit = async () => {
    const body = { full_name: form.full_name, email: form.email, role: form.role };
    if (form.password) body.password = form.password;
    try {
      await api(`/api/admin-auth/list/${form.id}`, { method: "PUT", body: JSON.stringify(body) });
      setMsg(t("✅ تم تحديث البيانات بنجاح", "✅ Admin updated successfully"));
      setEditIt$(null); load();
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert("❌ " + e.message); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(t(`هل أنت متأكد من حذف "${name}"؟`, `Are you sure you want to delete "${name}"?`))) return;
    try {
      await api(`/api/admin-auth/list/${id}`, { method: "DELETE" });
      setMsg(t("✅ تم الحذف بنجاح", "✅ Admin deleted successfully"));
      load();
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { alert("❌ " + e.message); }
  };

  const openEdit = (a) => { setForm({ id: a.id, full_name: a.full_name, email: a.email, password: "", role: a.role }); setEditIt$(a); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t("👥 إدارة الأدمنز", "👥 Admin Management")}</h2>
        {isManager && <button onClick={() => { setForm({ id: "", full_name: "", email: "", password: "", role: "admin" }); setShowAdd(true); }} className="px-4 py-2 bg-everest-600 text-white rounded-lg font-medium hover:bg-everest-700 transition">
          ➕ {t("إضافة أدمن", "Add Admin")}
        </button>}
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-center text-sm font-medium">{msg}</div>}

      {loading ? (
        <PageLoading>
          <p className="text-center py-20 text-gray-400">{t("جاري التحميل...", "Loading...")}</p>
        </PageLoading>
      ) : admins.length === 0 ? (
        <p className="text-center py-20 text-gray-400">{t("لا يوجد أدمنز", "No admins found")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-everest-100 flex items-center justify-center font-bold text-everest-700 text-lg">
                  {(a.full_name || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{a.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{a.email}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-500 mb-4">
                <p><span className="text-gray-400">{t("المعرف", "ID")}:</span> <span className="font-mono font-semibold text-gray-700">{a.id}</span></p>
                <p><span className="text-gray-400">{t("الدور", "Role")}:</span> <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${a.role === 'manager' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{a.role === 'manager' ? '👑 Manager' : '🔧 Admin'}</span></p>
                <p><span className="text-gray-400">{t("تاريخ الإنشاء", "Created")}:</span> {a.created_at ? a.created_at.slice(0, 10) : "–"}</p>
              </div>
              <div className="flex gap-2">
                {isManager && <button onClick={() => openEdit(a)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition">
                  ✏️ {t("تعديل", "Edit")}
                </button>}
                {isManager && <button data-no-confirm onClick={() => handleDelete(a.id, a.full_name)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition">
                  🗑️ {t("حذف", "Delete")}
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{t("➕ إضافة أدمن جديد", "➕ Add New Admin")}</h3>
            <div className="space-y-3">
              <input placeholder={t("المعرف (مثل ADM-006)", "ID (e.g. ADM-006)")} value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <input placeholder={t("الاسم الكامل", "Full Name")} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <input placeholder={t("البريد الإلكتروني", "Email")} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <input type="password" placeholder={t("كلمة المرور", "Password")} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-2 border rounded-lg">
                <option value="admin">🔧 Admin</option>
                <option value="manager">👑 Manager</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAdd} className="flex-1 py-2.5 bg-everest-600 text-white rounded-lg font-bold hover:bg-everest-700">{t("إضافة", "Add")}</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">{t("إلغاء", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editIt$ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditIt$(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{t("✏️ تعديل بيانات الأدمن", "✏️ Edit Admin")}</h3>
            <div className="space-y-3">
              <input disabled value={form.id} className="w-full px-4 py-2 border rounded-lg bg-gray-50" />
              <input placeholder={t("الاسم الكامل", "Full Name")} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <input placeholder={t("البريد الإلكتروني", "Email")} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <input type="password" placeholder={t("كلمة المرور الجديدة (اتركها فارغة)", "New Password (leave blank to keep)")} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-4 py-2 border rounded-lg">
                <option value="admin">🔧 Admin</option>
                <option value="manager">👑 Manager</option>
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleEdit} className="flex-1 py-2.5 bg-everest-600 text-white rounded-lg font-bold hover:bg-everest-700">{t("حفظ", "Save")}</button>
              <button onClick={() => setEditIt$(null)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">{t("إلغاء", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function RoleManagementPage() {
  const { lang, t: tFn } = useLang();
  const t = (ar, en) => tFn(ar, en);
  const [pending, setPending] = useState([]);
  const [registrationFree, setRegistrationFree] = useState([]);
  const [students, setStudents] = useState([]);
  const [changing, setChanging] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [viewUserData, setViewUserData] = useState(null);
  const [searchStudent, setSearchStudent] = useState("");
  const [searchRegFree, setSearchRegFree] = useState("");
  const [searchPending, setSearchPending] = useState("");

  const loadData = async () => {
    const all = await api("/api/users");
    const getType = (u) => u.account_type || (u.role === "registration" ? "registration_free" : "student");
    setPending(all.filter((u) => u.status === "pending" && u.role !== "admin"));
    setRegistrationFree(all.filter((u) => getType(u) === "registration_free" && u.status === "active" && u.role !== "admin"));
    setStudents(all.filter((u) => getType(u) === "student" && u.role !== "admin" && u.status === "active"));
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const handler = () => { if (!document.hidden) loadData(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const changeAccountType = async (userId, newType) => {
    setChanging(userId);
    try {
      const res = await api(`/api/users/${userId}/account-type`, {
        method: "PUT", body: JSON.stringify({ account_type: newType }),
      });
      if (res.error) { alert("Error: " + res.error); }
      await loadData();
    } catch (e) { alert(e.message); }
    setChanging(null);
  };

  const openProfile = async (user) => {
    setViewUser(user);
    try {
      const data = await api(`/api/users/${user.id}`);
      setViewUserData(data);
    } catch (e) { setViewUserData(user); }
  };

  const matchSearch = (u, q) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(s) ||
           (u.email || "").toLowerCase().includes(s) ||
           (u.id || "").toLowerCase().includes(s) ||
           (u.phone || "").toLowerCase().includes(s);
  };

  const Column = ({ title, emoji, bgColor, count, search, setSearch, children }) => (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{emoji}</span>
        <h3 className="font-bold text-sm">{title}</h3>
        <span className={`mr-auto px-2 py-0.5 rounded-full text-xs font-bold ${bgColor}`}>{count}</span>
      </div>
      <input
        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t("بحث...", "Search...")}
        className="w-full px-3 py-1.5 border rounded-lg text-xs mb-3"
      />
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">{children}</div>
    </div>
  );

  const UserCard = ({ user, currentType }) => {
    const types = [
      { key: "student", label: "🎓 Student" },
      { key: "registration_free", label: "🆓 Reg Free" },
    ];
    const others = types.filter(tp => tp.key !== currentType);

    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-gray-50/50">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{background: currentType === "student" ? "#22c55e" : "#a855f7"}}>
          {user.full_name?.[0] || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{user.full_name}</p>
          <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => openProfile(user)} className="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs" title={t("عرض", "View")}>👁️</button>
          {others.map((tp) => (
            <button key={tp.key} disabled={changing === user.id}
              onClick={() => changeAccountType(user.id, tp.key)}
              className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition whitespace-nowrap">
              → {tp.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("🔐 إدارة صلاحيات المستخدمين", "🔐 User Role Management")}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column title={t("طالب (Student)", "Student")} emoji="🎓" bgColor="bg-green-100 text-green-700"
          count={students.length} search={searchStudent} setSearch={setSearchStudent}>
          {students.filter(u => matchSearch(u, searchStudent)).map((u) => (
            <UserCard key={u.id} user={u} currentType="student" />
          ))}
          {students.filter(u => matchSearch(u, searchStudent)).length === 0 && <p className="text-center text-gray-400 py-4 text-sm">{t("لا يوجد طلاب", "No students")}</p>}
        </Column>

        <Column title={t("تسجيل مجاني (Reg Free)", "Reg Free")} emoji="🆓" bgColor="bg-purple-100 text-purple-700"
          count={registrationFree.length} search={searchRegFree} setSearch={setSearchRegFree}>
          {registrationFree.filter(u => matchSearch(u, searchRegFree)).map((u) => (
            <UserCard key={u.id} user={u} currentType="registration_free" />
          ))}
          {registrationFree.filter(u => matchSearch(u, searchRegFree)).length === 0 && <p className="text-center text-gray-400 py-4 text-sm">{t("لا توجد حسابات تسجيل مجاني", "No reg free accounts")}</p>}
        </Column>
      </div>

      {pending.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold">{t("⏳ في انتظار الموافقة", "⏳ Pending Approval")}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">{pending.length}</span>
          </div>
          <input type="text" value={searchPending} onChange={(e) => setSearchPending(e.target.value)}
            placeholder={t("بحث...", "Search...")} className="w-full max-w-md px-3 py-1.5 border rounded-lg text-xs mb-3" />
          <div className="space-y-2">
            {pending.filter(u => matchSearch(u, searchPending)).map((u) => (
              <UserCard key={u.id} user={u} currentType={u.account_type || "student"} />
            ))}
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setViewUser(null); setViewUserData(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{t("بيانات المستخدم", "User Details")}</h3>
                <button onClick={() => { setViewUser(null); setViewUserData(null); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{background: (viewUserData?.account_type || "student") === "student" ? "#22c55e" : "#3b82f6"}}>
                  {viewUserData?.full_name?.[0] || viewUser.full_name?.[0] || "?"}
                </div>
                <div>
                  <p className="font-bold">{viewUserData?.full_name || viewUser.full_name}</p>
                  <p className="text-xs text-gray-500">{viewUserData?.email || viewUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "ID", value: viewUserData?.referral_code || viewUserData?.id || viewUser.id },
                  { label: t("الاسم", "Name"), value: viewUserData?.full_name || viewUser.full_name },
                  { label: t("البريد", "Email"), value: viewUserData?.email || viewUser.email },
                  { label: t("الهاتف", "Phone"), value: viewUserData?.phone || "—" },
                  { label: t("العنوان", "Address"), value: viewUserData?.address || "—" },
                  { label: t("الدور", "Role"), value: viewUserData?.role || viewUser.role },
                  { label: t("نوع الحساب", "Account Type"), value: viewUserData?.account_type || viewUser.account_type || "student" },
                  { label: t("الرتبة", "Rank"), value: viewUserData?.rank || "—" },
                  { label: t("الرصيد", "$"), value: viewUserData?.e_money ?? "—" },
                  { label: t("الحالة", "Status"), value: viewUserData?.status || viewUser.status },
                  { label: t("المحظور", "Blocked"), value: (viewUserData?.blocked || viewUser.blocked) ? t("نعم", "Yes") : t("لا", "No") },
                  { label: t("احالة من", "Referred By"), value: viewUserData?.referred_by || "—" },
                  { label: t("مبيعات الفريق", "Team Sales"), value: viewUserData?.total_team_sales ?? 0 },
                  { label: t("الأعضاء المباشرين", "Direct Count"), value: viewUserData?.direct_count ?? 0 },
                  { label: t("تاريخ التسجيل", "Joined"), value: viewUserData?.created_at ? new Date(viewUserData.created_at).toLocaleDateString() : "—" },
                ].map((it$, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-400">{it$.label}</p>
                    <p className="text-xs font-medium mt-0.5 break-all">{it$.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

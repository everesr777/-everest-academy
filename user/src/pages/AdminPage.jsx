import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../App";
import { useLang } from "../LangContext";
import LanguageToggle from "../components/LanguageToggle";
import { useTheme } from "../ThemeContext";

export default function AdminPage() {
  const { t, dir } = useLang();
  const nav = useNavigate();
  const [tab, setTab] = useState("stats");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { colors: c } = useTheme();

  const menuItems = [
    { id: "stats", label: t("الإحصائيات","Statistics"), icon: "📊" },
    { id: "profile", label: t("الملف الشخصي والمحفظة","Profile & Wallet"), icon: "👤" },
    { id: "permissions", label: t("إدارة الصلاحيات","Permissions"), icon: "🔐" },
    { id: "topups", label: t("طلبات الشحن","Top-up Requests"), icon: "💰" },
    { id: "build", label: t("بناء الكورس","Build Course"), icon: "📝" },
    { id: "courses", label: t("قائمة الكورسات","Courses List"), icon: "📚" },
    { id: "results", label: t("نتائج الاختبارات","Test Results"), icon: "📋" },
    { id: "students", label: t("قائمة الطلاب","Students List"), icon: "🎓" },
    { id: "settings", label: t("الإعدادات الشخصية","Settings"), icon: "⚙️" },
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:c.bg,color:c.text,direction:dir}}>
      {/* Sidebar */}
      <aside style={{width:sidebarOpen?260:70,background:"rgba(20,16,36,.9)",borderLeft:dir==="rtl"?`1px solid ${c.border}`:"none",borderRight:dir==="ltr"?`1px solid ${c.border}`:"none",transition:"0.3s",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px",borderBottom:`1px solid ${c.border}`,display:"flex",alignItems:"center",gap:10,justifyContent:sidebarOpen?"space-between":"center"}}>
          {sidebarOpen && <h1 style={{fontSize:18,fontWeight:800,background:"linear-gradient(135deg,#B88BFF,#6E3BF2)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t("Everest Admin","Everest Admin")}</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{background:"none",border:"none",color:"#9a95b0",fontSize:20,cursor:"pointer"}}>{dir==="rtl"?(sidebarOpen?"◀":"▶"):(sidebarOpen?"▶":"◀")}</button>
        </div>
        <nav style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 16px",border:"none",background:tab===item.id?"rgba(184,139,255,.12)":"transparent",color:tab===item.id?"#B88BFF":"#9a95b0",fontSize:14,fontWeight:tab===item.id?700:500,cursor:"pointer",textAlign:dir==="rtl"?"right":"left",transition:"0.2s",whiteSpace:"nowrap",borderRight:dir==="rtl"?(tab===item.id?"3px solid #B88BFF":"3px solid transparent"):"none",borderLeft:dir==="ltr"?(tab===item.id?"3px solid #B88BFF":"3px solid transparent"):"none"}}>
              <span style={{fontSize:18}}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"16px",borderTop:`1px solid ${c.border}`}}>
          <button onClick={() => nav("/dashboard")} style={{width:"100%",padding:"10px",background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:10,color:"#9a95b0",fontSize:13,cursor:"pointer"}}>{dir==="rtl"?"← ":"→ "}{t("الرجوع للوحة التحكم","Back to Dashboard")}</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{flex:1,padding:"30px",overflowY:"auto",maxWidth:1200}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
          <LanguageToggle minimal />
        </div>
        {tab === "stats" && <StatsTab />}
        {tab === "profile" && <ProfileTab />}
        {tab === "permissions" && <PermissionsTab />}
        {tab === "topups" && <TopupsTab />}
        {tab === "build" && <BuildCourseTab />}
        {tab === "courses" && <CoursesListTab />}
        {tab === "results" && <ResultsTab />}
        {tab === "students" && <StudentsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

/* ========== Stats Tab ========== */
function StatsTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [stats, setStats] = useState(null);
  useEffect(() => { api("/api/dashboard/stats").then(setStats).catch(() => {}); }, []);
  if (!stats) return <p style={{color:"#9a95b0"}}>{t("جاري التحميل...","Loading...")}</p>;
  const cards = [
    { label: t("إجمالي المستخدمين","Total Users"), value: stats.totalUsers, icon: "📊", color: "#2563ff" },
    { label: t("إجمالي الطلاب","Total Students"), value: stats.totalStudents, icon: "🎓", color: "#22c55e" },
    { label: t("حسابات تسجيل مجاني","Reg Free Accounts"), value: stats.totalRegistration, icon: "🆓", color: "#a855f7" },
    { label: t("الكورسات","Courses"), value: stats.totalCourses, icon: "📚", color: "#f59e0b" },
    { label: t("في انتظار الموافقة","Pending Approvals"), value: stats.pendingApprovals, icon: "⏳", color: "#B88BFF" },
    { label: t("شحن قيد الانتظار","Pending Top-ups"), value: stats.topUpPending, icon: "💰", color: "#06b6d4" },
  ];
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:24,fontSize:22}}>📊 {t("الإحصائيات","Statistics")}</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
      {cards.map((card,i) => (
        <div key={i} style={{background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:16,padding:24}}>
          <div style={{fontSize:32,marginBottom:8}}>{card.icon}</div>
          <div style={{fontSize:28,fontWeight:800,color:c.text}}>{card.value ?? 0}</div>
          <div style={{fontSize:13,color:"#9a95b0",marginTop:4}}>{card.label}</div>
        </div>
      ))}
    </div>
  </div>);
}

/* ========== Profile Tab ========== */
function ProfileTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => { api("/api/users").then(setUsers).catch(() => {}); }, []);
  const filtered = users.filter(u => !search || u.full_name?.includes(search) || u.email?.includes(search));
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>👤 {t("الملف الشخصي والمحفظة","Profile & Wallet")}</h2>
    <input type="text" placeholder={t("بحث باسم او ايميل...","Search by name or email...")} value={search} onChange={(e) => setSearch(e.target.value)}
      style={{width:"100%",maxWidth:400,padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:13,marginBottom:20}} />
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الاسم","Name")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الايميل","Email")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الدور","Role")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>$</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الرتبة","Rank")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} style={{borderBottom:`1px solid ${c.border}`}}>
              <td style={{padding:"10px",color:c.text,fontWeight:600}}>{u.full_name}</td>
              <td style={{padding:"10px",color:"#9a95b0"}}>{u.email}</td>
              <td style={{padding:"10px"}}><span style={{padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:600,background:u.role==="admin"?"rgba(184,139,255,.15)":u.role==="student"?"rgba(37,99,255,.15)":"rgba(168,85,247,.15)",color:u.role==="admin"?"#B88BFF":u.role==="student"?"#2563ff":"#a855f7"}}>{u.role}</span></td>
              <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{u.usd_balance}</td>
              <td style={{padding:"10px",color:c.text}}>{u.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Permissions Tab ========== */
function PermissionsTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [users, setUsers] = useState([]);
  const [actionId, setActionId] = useState("");
  const [actionRole, setActionRole] = useState("student");
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/users").then(setUsers).catch(() => {}); }, []);

  const changeRole = async () => {
    if (!actionId) return;
    try { await api(`/api/users/${actionId}/role`, { method: "PUT", body: JSON.stringify({ role: actionRole }) }); setMsg("✅ " + t("تم تغيير الصلاحية","Role changed successfully")); setActionId(""); api("/api/users").then(setUsers); }
    catch (e) { setMsg("❌ " + e.message); }
  };

  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>🔐 {t("إدارة الصلاحيات","Permissions")}</h2>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:20}}>
      <select value={actionId} onChange={(e) => setActionId(e.target.value)} style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:13,minWidth:200}}>
        <option value="" style={{background:"#1a1530"}}>{t("اختر مستخدم...","Select user...")}</option>
        {users.map((u) => <option key={u.id} value={u.id} style={{background:"#1a1530"}}>{u.full_name} ({u.email})</option>)}
      </select>
      <select value={actionRole} onChange={(e) => setActionRole(e.target.value)} style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:13}}>
        <option value="student" style={{background:"#1a1530"}}>{t("طالب","Student")}</option>
        <option value="admin" style={{background:"#1a1530"}}>{t("مدير","Admin")}</option>
      </select>
      <button onClick={changeRole} style={{padding:"10px 22px",background:"#B88BFF",border:"none",borderRadius:10,color:"#FFFFFF",fontWeight:700,cursor:"pointer",fontSize:13}}>{t("تغيير الصلاحية","Change Role")}</button>
    </div>
    {msg && <p style={{marginBottom:12,fontSize:13,color:msg.includes("✅")?"#22c55e":"#ef4444"}}>{msg}</p>}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الاسم","Name")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الايميل","Email")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الصلاحية الحالية","Current Role")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{borderBottom:`1px solid ${c.border}`}}>
              <td style={{padding:"10px",color:c.text,fontWeight:600}}>{u.full_name}</td>
              <td style={{padding:"10px",color:"#9a95b0"}}>{u.email}</td>
              <td style={{padding:"10px"}}><span style={{padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:600,background:u.role==="admin"?"rgba(184,139,255,.15)":u.role==="student"?"rgba(37,99,255,.15)":"rgba(168,85,247,.15)",color:u.role==="admin"?"#B88BFF":u.role==="student"?"#2563ff":"#a855f7"}}>{u.role}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Topups Tab ========== */
function TopupsTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [topups, setTopups] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");

  const load = (s) => { const st = s || filter; api(`/api/wallets/topups?status=${st}`).then(setTopups).catch(() => {}); };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { try { await api(`/api/wallets/topups/${id}/approve`, { method: "PUT" }); load(); } catch (e) { alert(e.message); } };
  const reject = async (id) => { if (!confirm(t("متأكد؟","Are you sure?"))) return; try { await api(`/api/wallets/topups/${id}/reject`, { method: "PUT" }); load(); } catch (e) { alert(e.message); } };

  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>💰 {t("طلبات الشحن","Top-up Requests")}</h2>
    <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <input type="text" placeholder={t("بحث عن طالب...","Search for student...")} value={search} onChange={(e) => setSearch(e.target.value)}
        style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:13,flex:1,minWidth:200}} />
      <select value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value); }}
        style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:13}}>
        <option value="pending" style={{background:"#1a1530"}}>{t("قيد الانتظار","Pending")}</option>
        <option value="approved" style={{background:"#1a1530"}}>{t("تم الموافقة","Approved")}</option>
        <option value="rejected" style={{background:"#1a1530"}}>{t("مرفوض","Rejected")}</option>
      </select>
      <button onClick={() => load()} style={{padding:"10px 22px",background:"#B88BFF",border:"none",borderRadius:10,color:"#FFFFFF",fontWeight:700,cursor:"pointer",fontSize:13}}>{t("بحث","Search")}</button>
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الطلب","Order")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الطالب","Student")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("المبلغ","Amount")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("رقم المحول عليه","Transfer Number")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("طريقة الدفع","Payment Method")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("إثبات الدفع","Payment Proof")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الحالة","Status")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("إجراء","Action")}</th>
          </tr>
        </thead>
        <tbody>
          {topups.filter(r => !search || r.full_name?.includes(search) || r.email?.includes(search)).map((r) => (
            <tr key={r.id} style={{borderBottom:`1px solid ${c.border}`}}>
              <td style={{padding:"10px",color:c.text}}>#{r.id?.slice(0,8)}</td>
              <td style={{padding:"10px"}}><div style={{color:c.text,fontWeight:600}}>{r.full_name}</div><div style={{color:"#9a95b0",fontSize:11}}>{r.email}</div></td>
              <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{r.amount} EGP</td>
              <td style={{padding:"10px",color:c.text}}>{r.phone_number || "—"}</td>
              <td style={{padding:"10px",color:c.text}}>📱 {t("فودافون كاش","Vodafone Cash")}</td>
              <td style={{padding:"10px"}}>{r.payment_proof ? <a href={r.payment_proof} target="_blank" rel="noreferrer"><img src={r.payment_proof} alt="proof" style={{width:50,height:50,borderRadius:8,objectFit:"cover",border:`1px solid ${c.border}`,cursor:"pointer"}} /></a> : "—"}</td>
              <td style={{padding:"10px"}}>
                <span style={{padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:600,
                  background:r.status==="pending"?"rgba(254,212,0,.1)":r.status==="approved"?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                  color:r.status==="pending"?"#fed400":r.status==="approved"?"#22c55e":"#ef4444"}}>
                  {r.status === "pending" ? t("قيد الانتظار","Pending") : r.status === "approved" ? t("تم الموافقة","Approved") : t("مرفوض","Rejected")}
                </span>
              </td>
              <td style={{padding:"10px"}}>
                {r.status === "pending" && <div style={{display:"flex",gap:4}}>
                  <button onClick={() => approve(r.id)} style={{padding:"6px 12px",background:"#22c55e",border:"none",borderRadius:8,color:"#fff",fontWeight:600,fontSize:11,cursor:"pointer"}}>✅</button>
                  <button onClick={() => reject(r.id)} style={{padding:"6px 12px",background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontWeight:600,fontSize:11,cursor:"pointer"}}>❌</button>
                </div>}
              </td>
            </tr>
          ))}
          {topups.length === 0 && <tr><td colSpan={8} style={{padding:30,textAlign:"center",color:"#9a95b0"}}>{t("لا توجد طلبات","No requests")}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Build Course Tab ========== */
function BuildCourseTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [form, setForm] = useState({ title_ar:"", title:"", description_ar:"", description:"", category_ar:"", category:"", price:0, difficulty:"beginner" });
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/courses", { method:"POST", body:JSON.stringify({ ...form, status:"published" }) });
      setMsg("✅ " + t("تم إنشاء الكورس بنجاح","Course created successfully"));
      setForm({ title_ar:"", title:"", description_ar:"", description:"", category_ar:"", category:"", price:0, difficulty:"beginner" });
    } catch (e) { setMsg("❌ " + e.message); }
  };
  const inputStyle = {width:"100%",padding:"12px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:14};
  const labelStyle = {color:"#9a95b0",fontSize:13,display:"block",marginBottom:6};
  const fieldWrap = {marginBottom:16};
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>📝 {t("بناء الكورس","Build Course")}</h2>
    {msg && <p style={{marginBottom:12,fontSize:13,color:msg.includes("✅")?"#22c55e":"#ef4444"}}>{msg}</p>}
    <form onSubmit={submit} style={{background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:16,padding:24,maxWidth:800}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div><label style={labelStyle}>{t("عنوان الكورس (عربي)","Course Title (Arabic)")}</label>
          <input required value={form.title_ar} onChange={(e) => setForm({...form,title_ar:e.target.value})} style={inputStyle} /></div>
        <div><label style={labelStyle}>{t("عنوان الكورس (إنجليزي)","Course Title (English)")}</label>
          <input value={form.title} onChange={(e) => setForm({...form,title:e.target.value})} style={inputStyle} /></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div><label style={labelStyle}>{t("الوصف (عربي)","Description (Arabic)")}</label>
          <textarea rows={3} value={form.description_ar} onChange={(e) => setForm({...form,description_ar:e.target.value})} style={{...inputStyle,resize:"vertical"}} /></div>
        <div><label style={labelStyle}>{t("الوصف (إنجليزي)","Description (English)")}</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} style={{...inputStyle,resize:"vertical"}} /></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div><label style={labelStyle}>{t("التصنيف (عربي)","Category (Arabic)")}</label>
          <input value={form.category_ar} onChange={(e) => setForm({...form,category_ar:e.target.value})} placeholder={t("مثال: تسويق, برمجة","e.g. Marketing, Coding")} style={inputStyle} /></div>
        <div><label style={labelStyle}>{t("التصنيف (إنجليزي)","Category (English)")}</label>
          <input value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} placeholder={t("e.g. Marketing, Coding","مثال: تسويق, برمجة")} style={inputStyle} /></div>
      </div>
      <div style={{marginBottom:16}}><label style={labelStyle}>{t("السعر ($)","Price ($)")}</label>
        <input type="number" min="0" value={form.price} onChange={(e) => setForm({...form,price:Number(e.target.value)})} style={inputStyle} /></div>
      <div style={{marginBottom:20}}><label style={labelStyle}>{t("المستوى","Level")}</label>
        <select value={form.difficulty} onChange={(e) => setForm({...form,difficulty:e.target.value})} style={{...inputStyle,background:"rgba(20,16,36,.8)"}}>
          <option value="beginner" style={{background:"#1a1530"}}>{t("مبتدئ","Beginner")}</option>
          <option value="intermediate" style={{background:"#1a1530"}}>{t("متوسط","Intermediate")}</option>
          <option value="advanced" style={{background:"#1a1530"}}>{t("متقدم","Advanced")}</option>
        </select></div>
      <button type="submit" style={{width:"100%",padding:"12px",background:"#B88BFF",border:"none",borderRadius:12,color:"#FFFFFF",fontWeight:700,cursor:"pointer"}}>{t("إنشاء الكورس","Create Course")}</button>
    </form>
  </div>);
}

/* ========== Courses List Tab ========== */
function CoursesListTab() {
  const { t } = useLang();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ status: "", expires_at: "" });
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  useEffect(() => { api("/api/courses").then(setCourses).catch(() => {}); }, []);

  const categories = [...new Set(courses.map(c => c.category_ar || c.category).filter(Boolean))];

  const filtered = courses.filter(c => {
    const matchSearch = !search || (c.title_ar || c.title || "").includes(search) || (c.category_ar || c.category || "").includes(search);
    const matchCat = !categoryFilter || (c.category_ar || c.category) === categoryFilter;
    return matchSearch && matchCat;
  });

  const toggleExpand = async (courseId) => {
    if (expanded === courseId) { setExpanded(null); setEnrollments([]); return; }
    setExpanded(courseId);
    setLoadingEnrollments(true);
    try {
      const data = await api(`/api/courses/enrollments/list/${courseId}`);
      setEnrollments(data);
    } catch (e) { alert(e.message); }
    setLoadingEnrollments(false);
  };

  const deleteCourse = async (id, title) => {
    if (!confirm(t('حذف الكورس "{{title}}"؟','Delete course "{{title}}"?').replace("{{title}}", title))) return;
    try { await api(`/api/courses/${id}`, { method: "DELETE" }); setCourses(prev => prev.filter(c => c.id !== id)); }
    catch (e) { alert(e.message); }
  };

  const deleteEnrollment = async (id, studentName) => {
    if (!confirm(t('حذف الطالب {{name}} من هذا الكورس؟','Remove student {{name}} from this course?').replace("{{name}}", studentName))) return;
    try { await api(`/api/courses/enrollments/${id}`, { method: "DELETE" }); toggleExpand(expanded); }
    catch (e) { alert(e.message); }
  };

  const startEdit = (enr) => {
    setEditing(enr.id);
    setEditForm({ status: enr.status || "", expires_at: enr.expires_at || "" });
  };

  const saveEdit = async (id) => {
    try {
      await api(`/api/courses/enrollments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: editForm.status || undefined, expires_at: editForm.expires_at || undefined })
      });
      setEditing(null);
      toggleExpand(expanded);
    } catch (e) { alert(e.message); }
  };

  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>📚 {t("قائمة الكورسات","Courses List")}</h2>

    {/* Filters */}
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <input type="text" placeholder={t("بحث...","Search...")} value={search} onChange={(e) => setSearch(e.target.value)}
        style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:13,flex:1,minWidth:200}} />
      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
        style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:13}}>
        <option value="" style={{background:"#1a1530"}}>{t("كل التصنيفات","All Categories")}</option>
        {categories.map((cat) => <option key={cat} value={cat} style={{background:"#1a1530"}}>{cat}</option>)}
      </select>
    </div>

    <p style={{color:"#9a95b0",fontSize:13,marginBottom:12}}>{filtered.length} {t("كورس","courses")}</p>

    {/* Courses Table */}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("صورة","Image")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("العنوان","Title")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("التصنيف","Category")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("السعر","Price")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("المؤلف","Author")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الحالة","Status")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("إجراءات","Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <React.Fragment key={c.id}>
              <tr style={{borderBottom:`1px solid ${c.border}`,cursor:"pointer"}} onClick={() => toggleExpand(c.id)}>
                <td style={{padding:"8px"}}>
                  {c.featured_image
                    ? <img src={c.featured_image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover"}} />
                    : <div style={{width:44,height:44,borderRadius:8,background:c.bgCard,display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:10}}>{t("لا توجد صورة","No img")}</div>}
                </td>
                <td style={{padding:"8px 10px",color:c.text,fontWeight:600}}>
                  <div>{c.title_ar || c.title}</div>
                  <div style={{fontSize:11,color:"#9a95b0",marginTop:2}}>{c.topic_count || 0} {t("مواضيع","topics")} · {c.lesson_count || 0} {t("دروس","lessons")} · {c.quiz_count || 0} {t("اختبارات","quizzes")}</div>
                </td>
                <td style={{padding:"10px",color:"#9a95b0"}}>{c.category_ar || c.category || "—"}</td>
                <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{c.price === 0 ? t("مجاني","Free") : c.price + " $"}</td>
                <td style={{padding:"10px",color:"#9a95b0"}}>{c.author_name || "—"}</td>
                <td style={{padding:"10px"}}>
                  <span style={{padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:600,
                    background:c.status==="published"?"rgba(34,197,94,.15)":"rgba(254,212,0,.1)",
                    color:c.status==="published"?"#22c55e":"#fed400"}}>{c.status === "published" ? t("منشور","Published") : c.status}</span>
                </td>
                <td style={{padding:"8px"}} onClick={(e) => e.stopPropagation()}>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={() => toggleExpand(c.id)} title={t("عرض الطلاب","View Students")} style={{padding:"6px 10px",background:"rgba(37,99,255,.15)",border:"1px solid rgba(37,99,255,.3)",borderRadius:8,color:"#2563ff",fontSize:11,cursor:"pointer"}}>{t("عرض","View")}</button>
                    <button title={t("تعديل","Edit")} style={{padding:"6px 10px",background:"rgba(184,139,255,.15)",border:"1px solid rgba(184,139,255,.3)",borderRadius:8,color:"#B88BFF",fontSize:11,cursor:"pointer"}}>{t("تعديل","Edit")}</button>
                    <button onClick={() => deleteCourse(c.id, c.title_ar || c.title)} title={t("حذف","Delete")} style={{padding:"6px 10px",background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,color:"#ef4444",fontSize:11,cursor:"pointer"}}>{t("حذف","Delete")}</button>
                  </div>
                </td>
              </tr>
              {/* Expanded Students Section */}
              {expanded === c.id && (
                <tr><td colSpan={7} style={{padding:"0 16px 16px"}}>
                  {loadingEnrollments ? <p style={{color:"#9a95b0",padding:12}}>{t("جاري التحميل...","Loading...")}</p> : enrollments.length === 0 ? <p style={{color:"#9a95b0",padding:12}}>{t("لا يوجد طلاب مسجلين في هذا الكورس","No students enrolled in this course")}</p> : (
                    <div style={{overflowX:"auto"}}>
                      <p style={{color:"#B88BFF",fontSize:13,fontWeight:700,marginBottom:8,marginTop:8}}>🎓 {t("الطلاب المسجلين","Enrolled Students")} ({enrollments.length})</p>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,background:c.bgCard,borderRadius:12}}>
                        <thead>
                          <tr style={{borderBottom:`1px solid ${c.border}`}}>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("الطالب","Student")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("الايميل","Email")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("رقم الهاتف","Phone")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("الرتبة","Rank")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("الحالة","Status")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("طريقة الدفع","Payment")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("تاريخ التسجيل","Enrolled")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("تاريخ الانتهاء","Expires")}</th>
                            <th style={{padding:"8px",textAlign:"right",color:"#9a95b0"}}>{t("تحكم","Control")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments.map((enr) => (
                            <tr key={enr.id} style={{borderBottom:`1px solid ${c.border}`}}>
                              {editing === enr.id ? (
                                <>
                                  <td style={{padding:"8px",color:c.text,fontWeight:600}}>{enr.student_name}</td>
                                  <td style={{padding:"8px",color:"#9a95b0"}}>{enr.student_email}</td>
                                  <td style={{padding:"8px",color:c.text}}>{enr.student_phone || "—"}</td>
                                  <td style={{padding:"8px",color:c.text}}>{enr.student_rank || "—"}</td>
                                  <td style={{padding:"8px"}}>
                                    <select value={editForm.status} onChange={(e) => setEditForm({...editForm,status:e.target.value})} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:11}}>
                                      <option value="" style={{background:"#1a1530"}}>—</option>
                                      <option value="approved" style={{background:"#1a1530"}}>{t("موافق","Approved")}</option>
                                      <option value="pending" style={{background:"#1a1530"}}>{t("قيد الانتظار","Pending")}</option>
                                      <option value="rejected" style={{background:"#1a1530"}}>{t("مرفوض","Rejected")}</option>
                                    </select>
                                  </td>
                                  <td style={{padding:"8px",color:"#9a95b0"}}>{enr.payment_method}</td>
                                  <td style={{padding:"8px",color:"#9a95b0",fontSize:11}}>{enr.enrolled_at?.slice(0,10)}</td>
                                  <td style={{padding:"8px"}}>
                                    <input type="date" value={editForm.expires_at} onChange={(e) => setEditForm({...editForm,expires_at:e.target.value})} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:11}} />
                                  </td>
                                  <td style={{padding:"8px"}}>
                                    <div style={{display:"flex",gap:4}}>
                                      <button onClick={() => saveEdit(enr.id)} style={{padding:"4px 8px",background:"#22c55e",border:"none",borderRadius:6,color:"#fff",fontSize:11,cursor:"pointer"}}>{t("حفظ","Save")}</button>
                                      <button onClick={() => setEditing(null)} style={{padding:"4px 8px",background:"#6b7280",border:"none",borderRadius:6,color:"#fff",fontSize:11,cursor:"pointer"}}>{t("إلغاء","Cancel")}</button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{padding:"8px",color:c.text,fontWeight:600}}>{enr.student_name}</td>
                                  <td style={{padding:"8px",color:"#9a95b0",fontSize:11}}>{enr.student_email}</td>
                                  <td style={{padding:"8px",color:c.text,fontSize:11}}>{enr.student_phone || "—"}</td>
                                  <td style={{padding:"8px"}}><span style={{padding:"2px 8px",borderRadius:999,fontSize:10,fontWeight:600,background:"rgba(168,85,247,.1)",color:"#a855f7"}}>{enr.student_rank || "—"}</span></td>
                                  <td style={{padding:"8px"}}>
                                    <span style={{padding:"2px 8px",borderRadius:999,fontSize:10,fontWeight:600,
                                      background:enr.status==="approved"?"rgba(34,197,94,.15)":enr.status==="pending"?"rgba(254,212,0,.1)":"rgba(239,68,68,.15)",
                                      color:enr.status==="approved"?"#22c55e":enr.status==="pending"?"#fed400":"#ef4444"}}>{enr.status}</span>
                                  </td>
                                  <td style={{padding:"8px",color:"#9a95b0",fontSize:11}}>{enr.payment_method}</td>
                                  <td style={{padding:"8px",color:"#9a95b0",fontSize:11}}>{enr.enrolled_at?.slice(0,10)}</td>
                                  <td style={{padding:"8px",color:enr.expires_at ? "#ef4444" : "#9a95b0",fontSize:11}}>{enr.expires_at?.slice(0,10) || t("غير محدد","Not set")}</td>
                                  <td style={{padding:"8px"}}>
                                    <div style={{display:"flex",gap:4}}>
                                      <button onClick={() => startEdit(enr)} title={t("تعديل","Edit")} style={{padding:"4px 8px",background:"#2563ff",border:"none",borderRadius:6,color:"#fff",fontSize:11,cursor:"pointer"}}>✏️</button>
                                      <button onClick={() => deleteEnrollment(enr.id, enr.student_name)} title={t("حذف","Delete")} style={{padding:"4px 8px",background:"#ef4444",border:"none",borderRadius:6,color:"#fff",fontSize:11,cursor:"pointer"}}>🗑️</button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Results Tab ========== */
function ResultsTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [attempts, setAttempts] = useState([]);
  useEffect(() => { api("/api/courses/attempts").then(setAttempts).catch(() => {}); }, []);
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>📋 {t("نتائج الاختبارات","Test Results")}</h2>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("المستخدم","User")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الدرجة","Score")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الناتج","Result")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("التاريخ","Date")}</th>
          </tr>
        </thead>
        <tbody>
          {attempts.length === 0 ? <tr><td colSpan={4} style={{padding:30,textAlign:"center",color:"#9a95b0"}}>{t("لا توجد نتائج","No results")}</td></tr> : attempts.map((a,i) => (
            <tr key={a.id || i} style={{borderBottom:`1px solid ${c.border}`}}>
              <td style={{padding:"10px",color:c.text}}>{a.user_id?.slice(0,12)}...</td>
              <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{a.earned_marks ?? "—"} / {a.total_marks ?? "—"}</td>
              <td style={{padding:"10px"}}><span style={{padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:600,background:a.result==="pass"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)",color:a.result==="pass"?"#22c55e":"#ef4444"}}>{a.result === "pass" ? t("ناجح","Pass") : t("راسب","Fail")}</span></td>
              <td style={{padding:"10px",color:"#9a95b0"}}>{a.created_at?.slice(0,10) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Students Tab ========== */
function StudentsTab() {
  const { t } = useLang();
  const { colors: c } = useTheme();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => { api("/api/users/filter/student").then(setUsers).catch(() => {}); }, []);
  const filtered = users.filter(u => !search || u.full_name?.includes(search) || u.email?.includes(search));
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>🎓 {t("قائمة الطلاب","Students List")}</h2>
    <input type="text" placeholder={t("بحث...","Search...")} value={search} onChange={(e) => setSearch(e.target.value)}
      style={{width:"100%",maxWidth:400,padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:13,marginBottom:20}} />
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${c.border}`}}>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الاسم","Name")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الايميل","Email")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("الرتبة","Rank")}</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>$</th>
            <th style={{padding:"12px 10px",textAlign:"right",color:"#9a95b0"}}>{t("تاريخ التسجيل","Enrolled")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} style={{borderBottom:`1px solid ${c.border}`}}>
              <td style={{padding:"10px",color:c.text,fontWeight:600}}>{u.full_name}</td>
              <td style={{padding:"10px",color:"#9a95b0"}}>{u.email}</td>
              <td style={{padding:"10px",color:c.text}}>{u.rank}</td>
              <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{u.usd_balance}</td>
              <td style={{padding:"10px",color:"#9a95b0"}}>{u.created_at?.slice(0,10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>);
}

/* ========== Settings Tab ========== */
function SettingsTab() {
  const { t } = useLang();
  return (<div>
    <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:22}}>⚙️ {t("الإعدادات الشخصية","Settings")}</h2>
    <p style={{color:"#9a95b0"}}>{t("قريباً...","Coming soon...")}</p>
  </div>);
}

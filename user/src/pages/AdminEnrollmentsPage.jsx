import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../App";
import { useLang } from "../LangContext";
import LanguageToggle from "../components/LanguageToggle";
import { useTheme } from "../ThemeContext";

export default function AdminEnrollmentsPage() {
  const { t, dir } = useLang();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [addEmail, setAddEmail] = useState("");
  const [addCourse, setAddCourse] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [tab, setTab] = useState("pending");
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [topups, setTopups] = useState([]);
  const [topupSearch, setTopupSearch] = useState("");
  const [topupFilter, setTopupFilter] = useState("pending");
  const { colors: c } = useTheme();

  const loadUpgradeRequests = () => {
    api("/api/users/upgrade-requests/list").then(setUpgradeRequests).catch(() => {});
  };
  const loadTopups = (status) => {
    const s = status || topupFilter;
    api(`/api/wallets/topups?status=${s}`).then(setTopups).catch(() => {});
  };

  useEffect(() => {
    api("/api/courses?status=published").then(setCourses).catch(() => {});
    loadEnrollments();
    loadUpgradeRequests();
    loadTopups();
  }, []);

  const loadEnrollments = () => {
    setLoading(true);
    api("/api/courses/enrollments/list?status=pending").then(setEnrollments).catch(() => {}).finally(() => setLoading(false));
  };

  const handleApprove = async (id) => {
    try { await api(`/api/courses/enrollments/${id}/approve`, { method: "PUT" }); loadEnrollments(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const handleReject = async (id) => {
    if (!confirm(t("متأكد؟ سيتم استرداد المبلغ للمستخدم.","Are you sure? The user will be refunded."))) return;
    try { await api(`/api/courses/enrollments/${id}/reject`, { method: "PUT" }); loadEnrollments(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const handleUpgradeApprove = async (id) => {
    try { await api(`/api/users/upgrade-requests/${id}/approve`, { method: "PUT" }); loadUpgradeRequests(); }
    catch (e) { alert("Error: " + e.message); }
  };
  const handleTopupApprove = async (id) => {
    try { await api(`/api/wallets/topups/${id}/approve`, { method: "PUT" }); loadTopups(); }
    catch (e) { alert("Error: " + e.message); }
  };
  const handleTopupReject = async (id) => {
    if (!confirm(t("متأكد؟","Are you sure?"))) return;
    try { await api(`/api/wallets/topups/${id}/reject`, { method: "PUT" }); loadTopups(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const handleUpgradeReject = async (id) => {
    if (!confirm(t("متأكد؟","Are you sure?"))) return;
    try { await api(`/api/users/upgrade-requests/${id}/reject`, { method: "PUT" }); loadUpgradeRequests(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const handleAdminAdd = async (e) => {
    e.preventDefault(); setAddMsg("");
    if (!addEmail || !addCourse) { setAddMsg(t("املأ جميع الحقول","Fill in all fields")); return; }
    try {
      const result = await api("/api/courses/enrollments/admin-add", {
        method: "POST",
        body: JSON.stringify({ adminId: user.id, userEmail: addEmail, courseId: addCourse })
      });
      setAddMsg("✅ " + t("تم تفعيل الكورس للمستخدم بنجاح","Course activated for user successfully"));
      setAddEmail(""); setAddCourse("");
    } catch (e) { setAddMsg("❌ " + (e.message || t("فشل","Failed"))); }
  };

  return (
    <div className="courses-body" style={{direction:dir, background:c.bg}}>
      <header className="courses-header">
        <div className="courses-nav">
          <Link to="/dashboard" className="courses-brand"><h1>{t("EVEREST — لوحة تحكم المدير","EVEREST — ADMIN PANEL")}</h1></Link>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <LanguageToggle minimal />
            <button onClick={() => nav("/dashboard")} style={{background:c.bgCard,border:`1px solid ${c.border}`,color:c.text,padding:"8px 16px",borderRadius:8,cursor:"pointer"}}>{t("لوحة التحكم","Dashboard")}</button>
            <button onClick={() => { logout(); nav("/login"); }} style={{background:c.bgCard,border:`1px solid ${c.border}`,color:c.text,padding:"8px 16px",borderRadius:8,cursor:"pointer"}}>{t("تسجيل خروج","Logout")}</button>
          </div>
        </div>
      </header>

      <main className="courses-main" style={{padding:"30px 0"}}>
        <div style={{display:"flex",gap:10,marginBottom:25,flexWrap:"wrap"}}>
          <button onClick={() => setTab("pending")} style={{padding:"10px 22px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:tab==="pending"?"#B88BFF":c.bgCard,color:tab==="pending"?"#FFFFFF":c.text}}>🛒 {t("طلبات الشراء","Purchase Requests")}</button>
          <button onClick={() => setTab("topups")} style={{padding:"10px 22px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:tab==="topups"?"#B88BFF":c.bgCard,color:tab==="topups"?"#FFFFFF":c.text}}>💰 {t("طلبات شحن الرصيد","Top-up Requests")}</button>
          <button onClick={() => setTab("upgrades")} style={{padding:"10px 22px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:tab==="upgrades"?"#B88BFF":c.bgCard,color:tab==="upgrades"?"#FFFFFF":c.text}}>⬆️ {t("طلبات الترقية","Upgrade Requests")}</button>
          <button onClick={() => setTab("add")} style={{padding:"10px 22px",borderRadius:14,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:tab==="add"?"#B88BFF":c.bgCard,color:tab==="add"?"#FFFFFF":c.text}}>➕ {t("إضافة كورس يدوي","Manual Add Course")}</button>
        </div>

        {tab === "pending" && (
          <>
            <h2 style={{color:"#B88BFF",marginBottom:20,fontSize:20}}>🛒 {t("طلبات شراء الكورسات (Pending)","Course Purchase Requests (Pending)")}</h2>
            {loading ? <p style={{color:"#9a95b0"}}>{t("جاري التحميل...","Loading...")}</p> : enrollments.length === 0 ? (
              <p style={{color:"#9a95b0"}}>{t("لا توجد طلبات شراء معلقة","No pending purchase requests")}</p>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {enrollments.map((e) => (
                  <div key={e.id} style={{background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:16,padding:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                      <div>
                        <p style={{color:c.text,fontWeight:700,fontSize:15,marginBottom:4}}>{e.student_name}</p>
                        <p style={{color:"#9a95b0",fontSize:13}}>{e.student_email}</p>
                        <p style={{color:"#B88BFF",fontSize:14,marginTop:4}}>📚 {e.course_name_ar || e.course_name}</p>
                        <p style={{color:"#666",fontSize:12,marginTop:2}}>{t("طريقة الدفع:","Payment:")} {e.payment_method === "vodafone" ? "📱 " + t("فودافون كاش","Vodafone Cash") : e.payment_method === "cash" ? "💵 " + t("كاش","Cash") : "💳 $"}</p>
                        <p style={{color:"#666",fontSize:12}}>{t("التاريخ:","Date:")} {e.enrolled_at?.slice(0,16) || "—"}</p>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={() => handleApprove(e.id)} style={{padding:"10px 24px",background:"#22c55e",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer"}}>✅ {t("موافقة","Approve")}</button>
                        <button onClick={() => handleReject(e.id)} style={{padding:"10px 24px",background:"#ef4444",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer"}}>❌ {t("رفض","Reject")}</button>
                      </div>
                    </div>
                    {e.payment_method === "vodafone" && e.payment_proof && (
                      <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${c.border}`}}>
                        <p style={{color:"#9a95b0",fontSize:12,marginBottom:6}}>📎 {t("صورة التحويل (فودافون كاش):","Transfer image (Vodafone Cash):")}</p>
                        <a href={e.payment_proof} target="_blank" rel="noreferrer">
                          <img src={e.payment_proof} alt="Payment proof" style={{maxWidth:300,maxHeight:200,borderRadius:10,border:`1px solid ${c.border}`,cursor:"pointer"}} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "topups" && (
          <>
            <h2 style={{color:"#B88BFF",marginBottom:16,fontSize:20}}>💰 {t("طلبات شحن الرصيد","Top-up Requests")}</h2>
            <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              <input type="text" placeholder={t("بحث عن طالب...","Search for student...")} value={topupSearch} onChange={(e) => setTopupSearch(e.target.value)}
                style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:13,flex:1,minWidth:200}} />
              <select value={topupFilter} onChange={(e) => { setTopupFilter(e.target.value); loadTopups(e.target.value); }}
                style={{padding:"10px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:"rgba(20,16,36,.8)",color:c.text,fontSize:13}}>
                <option value="pending" style={{background:"#1a1530"}}>{t("قيد الانتظار","Pending")}</option>
                <option value="approved" style={{background:"#1a1530"}}>{t("تم الموافقة","Approved")}</option>
                <option value="rejected" style={{background:"#1a1530"}}>{t("مرفوض","Rejected")}</option>
              </select>
              <button onClick={() => loadTopups()} style={{padding:"10px 22px",background:"#B88BFF",border:"none",borderRadius:10,color:"#FFFFFF",fontWeight:700,cursor:"pointer",fontSize:13}}>{t("بحث","Search")}</button>
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
                  {topups.filter(r => !topupSearch || r.full_name?.includes(topupSearch) || r.email?.includes(topupSearch)).map((r) => (
                    <tr key={r.id} style={{borderBottom:`1px solid ${c.border}`}}>
                      <td style={{padding:"10px",color:c.text}}>#{r.id?.slice(0,8)}</td>
                      <td style={{padding:"10px"}}><div style={{color:c.text,fontWeight:600}}>{r.full_name}</div><div style={{color:"#9a95b0",fontSize:11}}>{r.email}</div></td>
                      <td style={{padding:"10px",color:"#B88BFF",fontWeight:700}}>{r.amount} EGP</td>
                      <td style={{padding:"10px",color:c.text}}>{r.phone_number || "—"}</td>
                      <td style={{padding:"10px",color:c.text}}>📱 {t("فودافون كاش","Vodafone Cash")}</td>
                      <td style={{padding:"10px"}}>
                        {r.payment_proof ? (
                          <a href={r.payment_proof} target="_blank" rel="noreferrer">
                            <img src={r.payment_proof} alt="proof" style={{width:50,height:50,borderRadius:8,objectFit:"cover",border:`1px solid ${c.border}`,cursor:"pointer"}} />
                          </a>
                        ) : "—"}
                      </td>
                      <td style={{padding:"10px"}}>
                        <span style={{padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:600,
                          background:r.status==="pending"?"rgba(254,212,0,.1)":r.status==="approved"?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
                          color:r.status==="pending"?"#fed400":r.status==="approved"?"#22c55e":"#ef4444"}}>
                          {r.status === "pending" ? t("قيد الانتظار","Pending") : r.status === "approved" ? t("تم الموافقة","Approved") : t("مرفوض","Rejected")}
                        </span>
                      </td>
                      <td style={{padding:"10px"}}>
                        {r.status === "pending" && (
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={() => handleTopupApprove(r.id)} style={{padding:"6px 12px",background:"#22c55e",border:"none",borderRadius:8,color:"#fff",fontWeight:600,fontSize:11,cursor:"pointer"}}>✅</button>
                            <button onClick={() => handleTopupReject(r.id)} style={{padding:"6px 12px",background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontWeight:600,fontSize:11,cursor:"pointer"}}>❌</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {topups.length === 0 && (
                    <tr><td colSpan={8} style={{padding:30,textAlign:"center",color:"#9a95b0"}}>{t("لا توجد طلبات شحن","No top-up requests")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "upgrades" && (
          <>
            <h2 style={{color:"#B88BFF",marginBottom:20,fontSize:20}}>⬆️ {t("طلبات الترقية إلى Student","Upgrade Requests to Student")}</h2>
            {upgradeRequests.length === 0 ? (
              <p style={{color:"#9a95b0"}}>{t("لا توجد طلبات ترقية","No upgrade requests")}</p>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {upgradeRequests.filter(r => r.status === "pending").map((r) => (
                  <div key={r.id} style={{background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:16,padding:20}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                      <div>
                        <p style={{color:c.text,fontWeight:700,fontSize:15,marginBottom:4}}>{r.full_name}</p>
                        <p style={{color:"#9a95b0",fontSize:13}}>{r.email}</p>
                        <p style={{color:"#666",fontSize:12,marginTop:2}}>📱 {r.phone || "—"}</p>
                        <p style={{color:"#666",fontSize:12}}>{t("مسجل منذ:","Registered since:")} {r.user_since?.slice(0,10) || "—"}</p>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={() => handleUpgradeApprove(r.id)} style={{padding:"10px 24px",background:"#22c55e",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer"}}>✅ {t("موافقة","Approve")}</button>
                        <button onClick={() => handleUpgradeReject(r.id)} style={{padding:"10px 24px",background:"#ef4444",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer"}}>❌ {t("رفض","Reject")}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "add" && (
          <>
            <h2 style={{color:"#B88BFF",marginBottom:20,fontSize:20}}>➕ {t("إضافة كورس لمستخدم (يدوي)","Add Course to User (Manual)")}</h2>
            <div style={{background:c.bgCard,border:`1px solid ${c.border}`,borderRadius:16,padding:24,maxWidth:500}}>
              <form onSubmit={handleAdminAdd}>
                <div style={{marginBottom:16}}>
                  <label style={{color:"#9a95b0",fontSize:13,display:"block",marginBottom:6}}>{t("البريد الإلكتروني للمستخدم:","User Email:")}</label>
                  <input type="email" required placeholder="user@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:14}} />
                </div>
                <div style={{marginBottom:20}}>
                  <label style={{color:"#9a95b0",fontSize:13,display:"block",marginBottom:6}}>{t("الكورس:","Course:")}</label>
                  <select required value={addCourse} onChange={(e) => setAddCourse(e.target.value)}
                    style={{width:"100%",padding:"12px 16px",borderRadius:10,border:`1px solid ${c.border}`,background:c.bgCard,color:c.text,fontSize:14}}>
                    <option value="" style={{background:"#1a1530"}}>{t("اختر كورس...","Select a course...")}</option>
                    {courses.map((c) => <option key={c.id} value={c.id} style={{background:"#1a1530"}}>{c.title_ar || c.title}</option>)}
                  </select>
                </div>
                {addMsg && <p style={{marginBottom:12,fontSize:13,color:addMsg.includes("✅")?"#22c55e":"#ff5b5b"}}>{addMsg}</p>}
                <button type="submit" style={{width:"100%",padding:"12px",background:"#B88BFF",border:"none",borderRadius:12,color:"#FFFFFF",fontWeight:700,cursor:"pointer"}}>{t("تفعيل الكورس للمستخدم","Activate Course for User")}</button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

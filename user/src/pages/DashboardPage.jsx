import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../App";
import { formatWhatsAppLink } from "../whatsapp";
import AppNavbar from "../components/AppNavbar";

export default function DashboardPage() {
  const { t, dir } = useLang();
  const { user, logout } = useAuth();
  const { colors: c } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [csWhatsapp, setCsWhatsapp] = useState("");
  const [csEmail, setCsEmail] = useState("");
  const [dbRanks, setDbRanks] = useState([]);

  useEffect(() => {
    api("/api/dashboard/stats").then(setStats).catch(() => {});
    if (user) api(`/api/courses/my?userId=${user.id}&status=approved`).then(setCourses).catch(() => {});
    api("/api/ranks").then((d) => Array.isArray(d) ? setDbRanks(d) : null).catch(() => {});
  }, [user]);

  useEffect(() => {
    api("/api/customer-service").then(d => {
      setCsWhatsapp(d.customer_service_whatsapp || "");
      setCsEmail(d.customer_service_email || "");
    }).catch(() => {});
  }, []);

  const memDays = user?.membership_days || 365;
  const memProgress = user?.membership_progress || 65;
  const isExpired = user?.blocked || (user?.membership_expires_at && new Date(user.membership_expires_at) < new Date());

  return (
    <div>
      <AppNavbar />

      {/* Membership Card */}
      <section className="membership-card">
        <div className="membership-content">
          <div>
            <span className="membership-label">{isExpired ? t("العضوية منتهية","Membership Expired") : t("العضوية نشطة","Membership Active")}</span>
            <h2 id="countdown">{isExpired ? t("منتهية","Expired") : `${memDays} ${t("يوم متبقي","Days Remaining")}`}</h2>
            {isExpired && (
              <p style={{fontSize:13,color:"#ef4444",marginTop:6}}>🚫 {t("تواصل مع خدمة العملاء لتجديد العضوية.","Contact customer service to renew.")}</p>
            )}
          </div>
          {isExpired && csWhatsapp ? (
            <a href={formatWhatsAppLink(csWhatsapp)} target="_blank" rel="noopener noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",borderRadius:14,background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontWeight:700,fontSize:14,textDecoration:"none"}}>
              💬 {t("تواصل مع خدمة العملاء","Contact Support")} <span style={{opacity:.85,fontSize:12}}>({csWhatsapp})</span>
            </a>
          ) : isExpired && csEmail ? (
            <a href={`mailto:${csEmail}`}
              style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",borderRadius:14,background:"linear-gradient(135deg,#6E3BF2,#6E3BF2)",color:"#fff",fontWeight:700,fontSize:14,textDecoration:"none"}}>
              📧 {t("تواصل مع خدمة العملاء","Contact Support")}
            </a>
          ) : null}
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{width: `${memProgress}%`}}></div>
        </div>
      </section>

      {/* Overview */}
      <section className="dash-overview">
        <div className="welcome-card">
          <span className="welcome-tag">{t("مرحباً بعودتك 👋","Welcome Back 👋")}</span>
          <h2>{user?.full_name}</h2>
          <p>{t("واصل بناء شبكتك، أكمل كورساتك وافتح الرتبة التالية.","Continue building your network, complete your courses and unlock the next rank.")}</p>
          <div className="overview-stats">
            <div className="mini-stat">
              <h3>{stats?.courses_count || user?.courses_count || 0}</h3>
              <span>{t("الكورسات","Courses")}</span>
            </div>
            <div className="mini-stat">
              <h3>{user?.usd_balance || 0}</h3>
              <span>{t("الرصيد","$")}</span>
            </div>
          </div>
        </div>
        <div className="rank-card">
          <div className="rl">{t("الرتبة الحالية","Current Rank")}</div>
          <h3>{(() => { const rk = dbRanks.find(r => r.name === (user?.rank || "Star")); return rk?.image ? <img src={rk.image} alt="" style={{width:28,height:28,borderRadius:8,verticalAlign:"middle",marginRight:6,objectFit:"cover"}} /> : <span>⭐</span>; })()} {user?.rank || "Star"}</h3>
          <p>{t("طوّر مبيعات فريقك لفتح الرتبة التالية.","Grow your team sales to unlock the next rank.")}</p>
          <div className="next-rank">
            <span>{t("مبيعات الفريق","Team Sales")}</span>
            <strong>{user?.total_team_sales || 0}</strong>
          </div>
        </div>
      </section>

      {/* My Courses */}
      <section className="dash-section">
        <div className="section-header">
          <h2>{t("كورساتي","My Courses")}</h2>
          <Link to="/courses" className="view-all">{t("عرض الكل","View All")}</Link>
        </div>
        <div className="courses-slider">
          {courses.length === 0 ? (
            <p style={{color:c.textMuted,padding:20}}>{t("لا توجد كورسات بعد.","No courses yet.")} <Link to="/courses" style={{color:c.gold}}>{t("تصفح الكورسات","Browse courses")}</Link></p>
          ) : courses.map((c) => (
            <div key={c.id} className="slide-card">
              <div className="slide-img" style={{background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,color:"#ccc"}}>📚</div>
              <div className="slide-body">
                <h3>{c.title_ar || c.title}</h3>
                <div className="slide-progress"><span>{t("التقدم","Progress")}</span><span>{c.progress || 0}%</span></div>
                <div className="slide-bar"><div className="slide-bar-fill" style={{width:`${c.progress || 0}%`}}></div></div>
                <Link to={`/courses/${c.id}`} className="slide-continue" style={{display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}}>{t("متابعة","Continue")}</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Network */}
      <section className="dash-section">
        <div className="section-header"><h2>{t("شبكة الإحالة","Referral Network")}</h2></div>
        <div className="network-grid">
          <div className="network-card"><div><span>{t("المستوى 1","Level 1")}</span><h3>{user?.direct_count || 0}</h3></div><button className="network-btn" onClick={() => nav("/affiliate")}>{t("عرض","View")}</button></div>
          <div className="network-card"><div><span>{t("المستوى 2","Level 2")}</span><h3>{Math.round((user?.direct_count || 0) * 0.4)}</h3></div><button className="network-btn" onClick={() => nav("/affiliate")}>{t("عرض","View")}</button></div>
          <div className="network-card"><div><span>{t("المستوى 3","Level 3")}</span><h3>{Math.round((user?.direct_count || 0) * 0.1)}</h3></div><button className="network-btn" onClick={() => nav("/affiliate")}>{t("عرض","View")}</button></div>
        </div>
      </section>

      {/* Rank Progress */}
      <section className="dash-section">
        <div className="rank-progress-card">
          <div className="rank-top">
    <div style={{background:c.bg,minHeight:"100vh"}}>
              <span className="rl">{t("الرتبة الحالية","Current Rank")}</span>
              <h2>{(() => { const rk = dbRanks.find(r => r.name === (user?.rank || "Star")); return rk?.image ? <img src={rk.image} alt="" style={{width:36,height:36,borderRadius:10,verticalAlign:"middle",marginRight:8,objectFit:"cover"}} /> : <span>⭐</span>; })()} {user?.rank || "Star"}</h2>
            </div>
            <div className="next-rank-box">
              <span>{t("مبيعات الفريق","Team Sales")}</span>
              <strong>{user?.total_team_sales || 0}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="dash-footer">
        <p>© 2026 {t("أكاديمية إيفرست. جميع الحقوق محفوظة.","Everest Academy. All Rights Reserved.")}</p>
        <div className="footer-links">
          <a href="#">{t("الدعم","Support")}</a>
          <a href="#">{t("الخصوصية","Privacy")}</a>
          <a href="#">{t("الشروط","Terms")}</a>
        </div>
      </footer>
    </div>
  );
}

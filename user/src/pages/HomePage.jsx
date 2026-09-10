import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../App";
import AppNavbar from "../components/AppNavbar";
import CustomerServiceFooter from "../components/CustomerServiceFooter";
import FooterSection from "../components/FooterSection";
import LeadersSection from "../components/LeadersSection";

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};


const makeStyles = (c, m) => ({
  hero: { width:"95%",maxWidth:1500,margin:"0 auto",background:c.heroBg,borderRadius:0,padding:m?"24px 16px":"55px 60px",display:"flex",flexDirection:m?"column":"row",alignItems:"center",justifyContent:"space-between",gap:m?20:40,overflow:"hidden",position:"relative" },
  heroContent: { flex:1,maxWidth:m?"100%":700,textAlign:m?"center":"start" },
  heroBadge: { display:"inline-flex",alignItems:"center",gap:10,padding:"10px 18px",border:`1px solid ${c.borderLight}`,borderRadius:999,background:c.goldLight,color:c.blue,fontSize:m?11:13,fontWeight:600,marginBottom:m?12:22 },
  heroH1: { fontSize:m?24:38,lineHeight:1.15,letterSpacing:"-0.5px",marginBottom:m?12:20,color:c.blue },
  heroH1Span: { color:c.blue },
  heroP: { fontSize:m?14:17,lineHeight:1.8,maxWidth:m?"100%":520,marginBottom:m?20:32,color:c.heroText },
  heroButtons: { display:"flex",gap:10,flexWrap:"wrap",justifyContent:m?"center":"flex-start" },
  btnPrimary: { height:m?44:52,padding:m?"0 18px":"0 24px",borderRadius:14,background:c.blue,color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:10,fontSize:m?13:15,fontWeight:600,transition:"0.35s",border:"none",cursor:"pointer" },
  heroImage: { flex:1,display:m?"none":"flex",justifyContent:"flex-end" },
  heroImg: { width:"100%",maxWidth:700,display:"block",borderRadius:30,objectFit:"contain",filter:"drop-shadow(0 30px 60px rgba(0,0,0,0.45))" },
  leadersSection: { padding:m?"50px 16px":"90px 5%",background:c.sectionBg,color:c.text },
  sectionTitle: { textAlign:"center",marginBottom:m?24:50 },
  sectionTitleSpan: { color:c.textMuted,fontSize:"0.75rem",letterSpacing:3 },
  sectionTitleH2: { fontSize:m?"1.6rem":"clamp(2rem,4vw,3.5rem)",margin:"10px 0" },
  sectionTitleP: { color:c.textMuted,maxWidth:500,margin:"auto",fontSize:m?13:"inherit" },
  leadersSlider: { display:"flex",gap:m?10:18,overflowX:"auto",scrollbarWidth:"none",padding:"20px 0" },
  leaderCard: { flex:m?"0 0 160px":"0 0 240px",scrollSnapAlign:"start",background:c.sectionAltBg,border:`1px solid ${c.border}`,borderRadius:m?18:28,padding:m?14:20,textAlign:"center",position:"relative",transition:"0.3s ease" },
  leaderImg: { width:m?80:120,height:m?80:120,objectFit:"cover",borderRadius:"30%",marginTop:m?8:15,marginBottom:m?8:15,background:"#333" },
  leaderName: { fontSize:m?"0.8rem":"0.95rem",fontWeight:600,marginBottom:m?6:12 },
  rank: { display:"inline-flex",alignItems:"center",justifyContent:"center",padding:m?"6px 10px":"8px 14px",borderRadius:999,fontSize:m?"0.62rem":"0.72rem",fontWeight:600 },
  courses: { padding:m?"50px 16px":"100px 5%",background:c.bg,overflow:"hidden" },
  coursesHeader: { maxWidth:m?"100%":650,margin:m?"0 auto 24px":"0 auto 50px",textAlign:"center" },
  coursesHeaderSpan: { fontSize:"0.75rem",letterSpacing:3,color:c.textMuted,display:"block",marginBottom:m?6:12 },
  coursesHeaderH2: { fontSize:m?"1.6rem":"clamp(2.2rem,5vw,4rem)",color:c.text,lineHeight:1.1,marginBottom:m?8:15 },
  coursesHeaderH2Span: { position:"relative",color:c.gold,display:"inline" },
  coursesHeaderP: { color:c.textSoft,lineHeight:1.8,maxWidth:550,fontSize:m?13:"inherit" },
  coursesGrid: { display:"flex",gap:m?10:20,overflowX:"auto",padding:"10px 0",scrollbarWidth:"none",scrollSnapType:"x mandatory" },
  courseCard: { minWidth:m?220:280,maxWidth:m?220:280,flexShrink:0,scrollSnapAlign:"start",background:c.bgCard,borderRadius:m?18:26,padding:m?12:16,boxShadow:c.shadow,transition:"0.35s ease",overflow:"hidden" },
  courseImage: { width:"100%",height:m?120:160,objectFit:"cover",borderRadius:m?12:18,background:"#eee",display:"block" },
  courseCardH3: { marginTop:m?8:15,fontSize:m?"0.9rem":"1.1rem",color:c.text },
  courseCardP: { marginTop:m?6:10,color:c.textSoft,fontSize:m?"0.78rem":"0.88rem",lineHeight:1.7 },
  courseFooter: { marginTop:m?12:18,paddingTop:m?12:18,borderTop:`1px solid ${c.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" },
  priceH4: { fontSize:m?"1rem":"1.3rem",color:c.text,marginTop:3 },
  courseBtn: { textDecoration:"none",background:c.text,color:c.bgCard,padding:m?"8px 10px":"10px 14px",borderRadius:12,fontSize:m?"0.75rem":"0.85rem",transition:"0.3s",display:"inline-flex",alignItems:"center",gap:6 },
});

const ranks = [
  { icon: "⭐", name: "Star", req: "2 ينضمو من خلال الكود بتاعك", reqEn: "2 joins through your referral code", reward: "دخول المجتمع والتقدير", rewardEn: "Community access & recognition." },
  { icon: "🚀", name: "Executive", req: "5 مبيعات الفريق", reqEn: "5 Team Sales.", reward: "مكافأة 1,500 EM", rewardEn: "1,500 EM Bonus." },
  { icon: "💎", name: "Executive Star", req: "10 مبيعات الفريق", reqEn: "10 Team Sales.", reward: "مكافأة 3,000 EM", rewardEn: "3,000 EM Bonus." },
  { icon: "👑", name: "Team Leader", req: "20 مبيعات الفريق", reqEn: "20 Team Sales.", reward: "مكافأة 5,000 EM", rewardEn: "5,000 EM Bonus." },
  { icon: "🏆", name: "Senior Leader", req: "40 مبيعات الفريق", reqEn: "40 Team Sales.", reward: "مكافأة 8,000 EM", rewardEn: "8,000 EM Bonus." },
  { icon: "🌍", name: "Regional Leader", req: "70 مبيعات الفريق", reqEn: "70 Team Sales.", reward: "مكافأة 12,000 EM", rewardEn: "12,000 EM Bonus." },
  { icon: "⚡", name: "Everest Elite", req: "120 مبيعات الفريق", reqEn: "120 Team Sales.", reward: "مكافأة 18,000 EM", rewardEn: "18,000 EM Bonus." },
  { icon: "🔱", name: "Everest Master", req: "200 مبيعات الفريق", reqEn: "200 Team Sales.", reward: "مكافأة 28,000 EM", rewardEn: "28,000 EM Bonus." },
  { icon: "🔥", name: "Everest Legend", req: "350 مبيعات الفريق", reqEn: "350 Team Sales.", reward: "مكافأة 45,000 EM", rewardEn: "45,000 EM Bonus." },
  { icon: "🌟", name: "Everest Ambassador", req: "600 مبيعات الفريق", reqEn: "600 Team Sales.", reward: "مكافأة 75,000 EM", rewardEn: "75,000 EM Bonus." },
];

const rankClassMap = {
  "Everest Ambassador":"ambassador","Everest Legend":"legend","Everest Master":"master",
  "Everest Elite":"elite","Regional Leader":"regional","Senior Leader":"senior",
  "Executive Star":"elite","Executive":"senior","Team Leader":"senior"
};

const rankColors = {
  ambassador: { color:"#ffd700", bg:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.18)" },
  legend: { color:"#ff5b5b", bg:"rgba(255,91,91,0.08)", border:"1px solid rgba(255,91,91,0.18)" },
  master: { color:"#20d4c2", bg:"rgba(32,212,194,0.08)", border:"1px solid rgba(32,212,194,0.18)" },
  elite: { color:"#a855f7", bg:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.18)" },
  regional: { color:"#22c55e", bg:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.18)" },
  senior: { color:"#fb923c", bg:"rgba(251,146,60,0.08)", border:"1px solid rgba(251,146,60,0.18)" },
};

export default function HomePage() {
  const { user, logout } = useAuth();
  const { t, lang, dir } = useLang();
  const { colors: c, theme } = useTheme();
  const m = useIsMobile();
  const s = makeStyles(c, m);
  const nav = useNavigate();
  const loc = useLocation();
  const [dbRanks, setDbRanks] = useState([]);
  const [openRank, setOpenRank] = useState(0);
  const [courses, setCourses] = useState([]);
  const [modal, setModal] = useState(null);
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    api("/api/courses?status=published").then((d) => setCourses((d || []).filter((c) => c.is_show_homepage !== 0))).catch(() => {});
    api("/api/leaders").then(setLeaders).catch(() => {});
    api("/api/ranks").then((d) => Array.isArray(d) ? setDbRanks(d) : null).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); nav("/login"); };

  return (
      <div style={{background:c.bg,minHeight:"100vh",direction:dir}}>
      <AppNavbar />

      {/* Hero */}
      <section style={{...s.hero,marginBottom:25}}>
        <div style={s.heroContent}>
          <span style={s.heroBadge}>{t("👋 مرحباً بعودتك","👋 Welcome Back")}{user ? `, ${user.full_name?.split(" ")[0]}` : ""}</span>
          <h1 style={s.heroH1}>{t("اكمل","Continue Your")} <br />{t("رحلتك إلى","Journey To The")} <br /><span style={s.heroH1Span}>{t("الرتبة التالية","Next Rank")}</span></h1>
          <p style={s.heroP}>{t("أكمل المهام، افتح رتباً جديدة، تعلم من كورسات احترافية وكن واحداً من قادة أكاديمية إيفرست.","Complete missions, unlock new ranks, learn from premium courses and become one of Everest Academy leaders.")}</p>
          <div style={s.heroButtons}>
            <Link to="/courses" style={s.btnPrimary}>{t("مواصلة التعلم","Continue Learning")} <i className="fa-solid fa-arrow-right"></i></Link>
          </div>
        </div>
        <div style={s.heroImage}>
            <img src="/images/Screenshot_2026-06-28_145125-removebg-preview.png" alt="Hero" style={s.heroImg} />
        </div>
      </section>

      {/* Leaders — Redesigned */}
      <LeadersSection leaders={leaders} theme={theme} m={m} dir={dir} t={t} />



      {/* Courses */}
      <section style={s.courses}>
        <div style={s.coursesHeader}>
          <span style={s.coursesHeaderSpan}>{t("كورسات مميزة","PREMIUM COURSES")}</span>
          <h2 style={s.coursesHeaderH2}>{t("ابن مستقبلك بـ","Build Your Future With")} <span style={s.coursesHeaderH2Span}>{t("المهارات الرقمية","Digital Skills")}</span></h2>
          <p style={s.coursesHeaderP}>{t("تعلم المهارات الأكثر ربحية عبر الإنترنت ببرامج تدريبية عملية عالية الجودة.","Learn the most profitable online skills with practical, premium-quality training programs.")}</p>
        </div>
        <div style={s.coursesGrid}>
          {courses.length === 0 ? (
            <p style={{color:c.textMuted,padding:20,fontSize:15}}>{t("لا توجد كورسات متاحة بعد.","No courses available yet.")}</p>
          ) : courses.map((course) => (
            <div key={course.id} style={s.courseCard}>
              <img src={course.featured_image || "/images/trading.png"} alt="" style={s.courseImage} onError={(e) => { e.target.src = "/images/trading.png"; }} />
              <h3 style={s.courseCardH3}>{course.title_ar || course.title}</h3>
              <p style={s.courseCardP}>{(course.description_ar || course.description || "").slice(0,80)}...</p>
              <div style={s.courseFooter}>
                <div>
                  <div style={{color:"#ffb800",fontSize:"0.85rem"}}>{course.avg_rating > 0 ? `⭐ ${course.avg_rating} (${course.review_count})` : "⭐⭐⭐⭐⭐"}</div>
                  {user?.account_type !== "student" && user?.account_type !== "registration_free" && <div style={{fontSize:"0.9rem",color:c.text,marginTop:3,fontWeight:700}}>{course.price} E-Money</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                {user?.account_type === "student" || user?.account_type === "registration_free" ? (
                  <Link to={`/courses/${course.id}`} style={{...s.courseBtn,flex:1,justifyContent:"center"}}>{t("مشاهدة","Watch")}</Link>
                ) : (
                  <>
                    <button onClick={() => setModal(course)} style={{flex:1,textAlign:"center",padding:m?"8px 6px":"10px 8px",borderRadius:12,fontSize:m?"0.72rem":"0.82rem",background:"transparent",color:c.text,border:`1px solid ${c.borderLight}`,cursor:"pointer",fontWeight:600,transition:"0.3s"}}>{t("معاينة","Preview")}</button>
                    <Link to={`/courses/${course.id}`} style={{...s.courseBtn,flex:1,justifyContent:"center"}}>{t("اشترك ←","Enroll →")}</Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rank Guide */}
      <section style={{ padding:"80px 5%",background:c.bg }}>
        <div style={{ maxWidth:1200,margin:"auto" }}>
          <div style={{ textAlign:"center",marginBottom:50 }}>
            <span style={{ display:"block",fontSize:"0.75rem",letterSpacing:3,color:c.textMuted,marginBottom:10 }}>{t("دليل الرتب","RANK GUIDE")}</span>
            <h2 style={{ fontSize:"clamp(1.8rem,4vw,3rem)",lineHeight:1.1,color:c.text,marginBottom:12 }}>{t("كيف تصل إلى","How To Reach")} <span style={{ position:"relative",color:c.text }}>{t("رتبتك التالية","Your Next Rank")}</span></h2>
            <p style={{ color:c.textSoft,lineHeight:1.7,maxWidth:600,margin:"auto" }}>{t("تعرف على متطلبات ومكافآت كل رتبة في إيفرست.","Learn the requirements and rewards for every Everest rank.")}</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:m?"1fr":"repeat(auto-fill,minmax(320px,1fr))",gap:20, ...(m ? {display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",paddingBottom:8} : {}) }}>
            {ranks.map((r, i) => {
              const dbRank = dbRanks.find(dr => dr.name === r.name);
              const imgSrc = dbRank?.image || `/RanksImages/${r.name}.jpeg`;
              const key = rankClassMap[r.name] || "senior";
              const colors = rankColors[key] || { color:"#fb923c", bg:"rgba(251,146,60,0.08)", border:"1px solid rgba(251,146,60,0.18)" };
              return (
                <div key={i} style={{ background:c.bgCard,borderRadius:20,overflow:"hidden",boxShadow:c.shadow,transition:"0.35s",cursor:"default",border:`1px solid ${c.borderLight}`,flex:"0 0 280px",scrollSnapAlign:"start",...(m ? {} : {}) }}
                  onMouseEnter={e => e.currentTarget.style.transform="translateY(-6px)"}
                  onMouseLeave={e => e.currentTarget.style.transform="none"}>
                  <div style={{ width:"100%",background:`linear-gradient(135deg,${colors.bg},${c.bgCard})`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <img src={imgSrc} alt={r.name} style={{ width:"100%",display:"block" }}
                      onError={e => { e.target.style.display = "none" }} />
                  </div>
                  <div style={{ padding:"16px 20px 18px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                      <span style={{ fontSize:22 }}>{r.icon}</span>
                      <h3 style={{ fontSize:15,fontWeight:800,color:c.text,margin:0 }}>{r.name}</h3>
                    </div>
                    <p style={{ fontSize:13,color:c.textMuted,lineHeight:1.7,margin:0 }}>
                      <strong style={{ color:colors.color }}>{t("المتطلبات:","Requirement:")}</strong> {lang === "ar" ? r.req : r.reqEn}
                    </p>
                    <p style={{ fontSize:13,color:c.textMuted,lineHeight:1.7,margin:"4px 0 0" }}>
                      <strong style={{ color:colors.color }}>{t("المكافأة:","Reward:")}</strong> {lang === "ar" ? r.reward : r.rewardEn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <FooterSection />

      {modal && (
        <div onClick={() => setModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e => e.stopPropagation()} style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:24,maxWidth:560,width:"100%",maxHeight:"85vh",overflow:"auto",position:"relative"}}>
            <button onClick={() => setModal(null)} style={{position:"absolute",top:16,left:16,background:c.bgInput,border:`1px solid ${c.borderLight}`,borderRadius:"50%",width:36,height:36,cursor:"pointer",fontSize:16,zIndex:2,color:c.text}}>✕</button>
            {modal.featured_image ? <img src={modal.featured_image} alt="" style={{width:"100%",height:220,objectFit:"cover",borderRadius:"24px 24px 0 0"}} /> : <div style={{width:"100%",height:220,background:"linear-gradient(135deg,#1a1a2e,#16213e)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"24px 24px 0 0",fontSize:64}}>🎓</div>}
            <div style={{padding:"24px"}}>
              <h2 style={{fontSize:"1.4rem",fontWeight:800,color:c.text,marginBottom:10}}>{modal.title_ar || modal.title}</h2>
              <p style={{fontSize:14,color:c.textMuted,lineHeight:1.8,marginBottom:16}}>{modal.description_ar || modal.description}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
                <span style={{padding:"5px 14px",background:c.bgInput,borderRadius:999,fontSize:12,fontWeight:600,color:c.textMuted}}>
                  {modal.difficulty === "beginner" ? t("مبتدئ","Beginner") : modal.difficulty === "intermediate" ? t("متوسط","Intermediate") : t("متقدم","Advanced")}
                </span>
                {modal.review_count > 0 && <span style={{padding:"5px 14px",background:"rgba(245,158,11,.08)",borderRadius:999,fontSize:12,fontWeight:600,color:"#f59e0b"}}>⭐ {modal.avg_rating} ({modal.review_count})</span>}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
                {modal.price > 0 && <span style={{fontWeight:800,fontSize:16,color:"#6E3BF2"}}>{modal.price} E-Money</span>}
                
              </div>
              <Link to={`/courses/${modal.id}`} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"14px 32px",background:"linear-gradient(135deg,#6E3BF2,#6E3BF2)",color:"#FFFFFF",fontWeight:800,fontSize:15,borderRadius:14,textDecoration:"none",transition:"0.3s"}}>
                {t("اشترك الآن","Enroll Now")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

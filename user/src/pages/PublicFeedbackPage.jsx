import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import PublicNavbar from "../components/PublicNavbar";
import FooterSection from "../components/FooterSection";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const api = (path, opts = {}) => {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  return fetch(url, { headers: { "Content-Type": "application/json" }, ...opts }).then((r) => r.json());
};

function getStyles(c) {
  return {
    hero: {
      position: "relative", minHeight: "100vh", overflow: "hidden"
    },
    heroVideo: {
      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"
    },
    heroOverlay: {
      position: "absolute", inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.75) 100%)",
      zIndex: 1
    },
    heroContent: {
      position: "relative", zIndex: 2, minHeight: "100vh",
      display: "flex", flexDirection: "column", justifyContent: "center",
      maxWidth: 700, padding: "0 8%"
    },
    heroSpan: {
      color: "#fff", letterSpacing: 4, fontSize: "0.8rem", fontWeight: 600, marginBottom: 20
    },
    heroH1: {
      color: "#fff", fontSize: "clamp(1.8rem, 4vw, 3.5rem)", lineHeight: 1.05,
      marginBottom: 25, fontWeight: 700
    },
    heroP: {
      color: "rgba(255,255,255,0.85)", fontSize: "1.05rem", lineHeight: 1.9, maxWidth: 550, marginBottom: 35
    },
    section: {
      padding: "80px 5%", background: c.bgSoft
    },
    header: {
      textAlign: "center", marginBottom: 60
    },
    headerSpan: {
      fontSize: "0.8rem", letterSpacing: "3px", color: c.textMuted
    },
    headerH2: {
      marginTop: 15, fontSize: "clamp(2rem, 4vw, 4rem)", color: c.text
    },
    grid: {
      maxWidth: 1200, margin: "auto", display: "grid",
      gridTemplateColumns: "1.2fr 0.8fr", gap: 30
    },
    reviewsSide: {
      display: "flex", flexDirection: "column", gap: 20
    },
    reviewCard: {
      flex: "0 0 340px",
      background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 24,
      padding: 24, transition: "0.3s", cursor: "default"
    },
    reviewUser: {
      display: "flex", alignItems: "center", gap: 14, marginBottom: 15
    },
    avatar: {
      width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0
    },
    avatarFallback: {
      width: 52, height: 52, borderRadius: "50%",
      background: "linear-gradient(135deg,#6E3BF2,#B88BFF)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, color: "#FFFFFF", fontSize: 18, flexShrink: 0
    },
    userName: { margin: 0, color: c.text, fontSize: "1rem", fontWeight: 600 },
    userRole: { color: c.textMuted, fontSize: "0.85rem" },
    stars: { color: "#f4b400", marginBottom: 14, fontSize: "0.95rem" },
    reviewText: { color: c.textSoft, lineHeight: 1.8, margin: 0, fontSize: "0.95rem" },
    date: { color: c.textMuted, fontSize: "0.75rem", marginTop: 8 },
    pagination: { display: "flex", justifyContent: "center", gap: 8, marginTop: 24 },
    pageBtn: (active) => ({
      padding: "8px 16px", borderRadius: 12,
      border: active ? "none" : `1px solid ${c.borderLight}`,
      cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
      background: active ? c.text : c.bgCard,
      color: active ? c.bg : c.text, transition: "0.2s"
    }),
    emptyMsg: { color: c.textMuted, textAlign: "center", padding: 40, fontSize: "0.95rem" },
    proofsSection: { padding: "80px 5%", background: c.bgCard },
    proofsSlider: {
      display: "flex", gap: 20, overflowX: "auto",
      padding: "0 0 20px", scrollBehavior: "smooth"
    },
    proofImg: {
      flex: "0 0 320px", height: 450, objectFit: "cover",
      borderRadius: 24, cursor: "pointer", transition: "0.4s"
    },
    statsSection: { padding: "80px 5%", background: c.bgSoft, textAlign: "center" },
    statsGrid: { maxWidth: 1200, margin: "auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 },
    statH3: {
      fontSize: "clamp(3rem, 6vw, 5rem)", fontWeight: 700, color: "#c79a3b",
      lineHeight: 1, marginBottom: 12
    },
    statP: { color: c.textMuted, fontSize: "1rem" },
    footerTop: {
      background: "#000", color: "#fff", textAlign: "center", padding: "14px 10px", fontSize: 14
    },
    footerMid: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "18px 40px", borderBottom: `1px solid ${c.borderLight}`, background: c.bgCard
    },
    footerBottom: {
      textAlign: "center", padding: "18px 20px", fontSize: 13, color: c.textMuted, background: c.bgCard
    },
    disclaimerSection: {
      background: "#000", padding: "50px 5%"
    },
    disclaimerGrid: {
      maxWidth: 1400, margin: "auto", display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)", gap: 60
    },
    disclaimerP: {
      color: "#a9a9a9", fontSize: 15, lineHeight: 1.8
    }
  };
}

function Counter({ target, suffix }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let c = 0; const speed = Math.max(1, target / 80);
    const anim = () => {
      c += speed;
      if (c < target) { setCount(Math.floor(c)); requestAnimationFrame(anim); }
      else setCount(target);
    };
    anim();
  }, [target]);
  return <>{count.toLocaleString()}{suffix}</>;
}

export default function PublicFeedbackPage() {
  const { t, dir } = useLang();
  const { colors: c } = useTheme();
  const styles = getStyles(c);
  const [feedbacks, setFeedbacks] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [proofs, setProofs] = useState([]);
  const [modalImg, setModalImg] = useState(null);
  const [stats, setStats] = useState({ totalMembers: 500000, totalCourses: 4, totalRanks: 10, satisfactionRate: 95 });

  useEffect(() => {
    api(`/api/feedbacks?page=${page}&limit=50`).then(data => {
      if (data && data.feedbacks) { setFeedbacks(data.feedbacks); setPages(data.pages || 1); }
    }).catch(() => {});
    api("/api/proofs").then(d => { if (Array.isArray(d)) setProofs(d); }).catch(() => {});
    api("/api/dashboard/public-stats").then(data => {
      if (data && data.totalMembers) setStats(data);
    }).catch(() => {});
  }, [page]);

  return (
    <div style={{direction: dir, background: c.bg }}>
      <PublicNavbar active="feedback" />

      {/* Hero */}
      <section style={styles.hero}>
        <video autoPlay muted loop playsInline style={styles.heroVideo}>
          <source src="/video/IMG_1492.mp4" type="video/mp4" />
        </video>
        <div style={styles.heroOverlay} />
        <div className="feedback-hero-content" style={styles.heroContent}>
          <span style={styles.heroSpan}>{t("قصص نجاح", "SUCCESS STORIES")}</span>
          <h1 style={styles.heroH1}>{t("قصص حقيقية.", "Real Stories.")}<br />{t("نتائج حقيقية.", "Real Results.")}</h1>
          <p style={styles.heroP}>{t("اكتشف كيف ساعدت أكاديمية إيفرست الأعضاء على تعلم مهارات جديدة وبناء شبكات أقوى وفتح فرص جديدة للنمو.", "Discover how Everest Academy has helped members learn new skills, build stronger networks and unlock new opportunities for growth.")}</p>
        </div>
      </section>

      {/* Feedback Section (view only) */}
      <section style={styles.section}>
        <div style={styles.header}>
          <span style={styles.headerSpan}>{t("ملاحظات المجتمع", "COMMUNITY FEEDBACK")}</span>
          <h2 style={styles.headerH2}>{t("موثوق من آلاف الأعضاء", "Trusted By Thousands Of Members")}</h2>
        </div>
        <div className="feedback-page-grid" style={{maxWidth: 1200, margin: "auto"}}>
          <div style={{...styles.reviewsSide, flexDirection: "row", overflowX: "auto", paddingBottom: 16, scrollbarWidth: "thin", scrollbarColor: "#ddd transparent"}}>
            {feedbacks.length === 0 && (
              <p style={styles.emptyMsg}>{t("لا توجد تقييمات بعد", "No feedbacks yet.")}</p>
            )}
            {feedbacks.map((fb) => (
              <div key={fb.id} style={styles.reviewCard}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={styles.reviewUser}>
                  {fb.avatar ? (
                    <img src={fb.avatar} alt="" style={styles.avatar} />
                  ) : (
                    <div style={styles.avatarFallback}>{(fb.full_name || "?")[0]}</div>
                  )}
                  <div>
                    <h4 style={styles.userName}>{fb.full_name || t("مستخدم", "User")}</h4>
                    <span style={styles.userRole}>{t("طالب", "Student")}</span>
                  </div>
                </div>
                <div style={styles.stars}>{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</div>
                <p style={styles.reviewText}>{fb.message}</p>
                <p style={styles.date}>{fb.created_at?.slice(0,10)}</p>
              </div>
            ))}
            {pages > 1 && (
              <div style={styles.pagination}>
                {Array.from({length:pages},(_,i)=>i+1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={styles.pageBtn(p === page)}>{p}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Success Proofs */}
      {proofs.length > 0 && (
        <section style={styles.proofsSection}>
          <div style={styles.header}>
            <span style={styles.headerSpan}>{t("إثباتات النجاح", "SUCCESS PROOFS")}</span>
            <h2 style={styles.headerH2}>{t("إنجازات المجتمع", "Community Achievements")}</h2>
            <p style={{color:c.textSoft,maxWidth:650,margin:"15px auto 0",lineHeight:1.8,fontSize:"0.95rem"}}>
              {t("صور حقيقية يشاركها أعضاؤنا لعرض إنجازاتهم ونموهم.", "Real screenshots shared by our members showcasing their achievements and growth.")}
            </p>
          </div>
          <div style={{...styles.proofsSlider, scrollbarWidth:"thin", scrollbarColor:"#ddd transparent"}}>
            {proofs.map(p => (
              <img key={p.id} src={p.image} alt={p.caption || ""}
                className="feedback-proof-img" style={styles.proofImg}
                onClick={() => setModalImg(p.image)}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }} />
            ))}
          </div>
        </section>
      )}

      {/* Image Modal */}
      {modalImg && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",justifyContent:"center",alignItems:"center",zIndex:99999,padding:20}}
          onClick={() => setModalImg(null)}>
          <img src={modalImg} style={{maxWidth:"90%",maxHeight:"90vh",borderRadius:20}} />
        </div>
      )}

      {/* Stats */}
      <section style={styles.statsSection}>
        <div className="feedback-stats-header" style={{marginBottom:70}}>
          <span style={{...styles.headerSpan, color:"#b88a2f",fontWeight:600}}>{t("مجتمعنا", "OUR COMMUNITY")}</span>
          <h2 style={{...styles.headerH2, fontSize:50,fontWeight:600,marginTop:15}}>{t("ننمو معاً ونحقق المزيد", "Growing Together, Achieving More")}</h2>
        </div>
        <div className="feedback-stats-grid" style={styles.statsGrid}>
          {[
            { target: stats.totalMembers || 0, label: t("عضو نشط", "Active Members") },
            { target: stats.totalCourses || 0, label: t("كورس احترافي", "Premium Courses") },
            { target: stats.totalRanks || 0, label: t("مستوى رتبة", "Rank Levels") },
            { target: stats.satisfactionRate || 95, label: t("نسبة رضا", "Satisfaction Rate"), suffix: "%" }
          ].map((s, i) => (
            <div key={i} style={{position:"relative"}}>
              {i < 3 && <div style={{position:"absolute",right:"-10px",top:"50%",transform:"translateY(-50%)",width:1,height:70,background:"rgba(184,138,47,0.25)"}} />}
              <h3 style={styles.statH3}><Counter target={s.target} suffix={s.suffix || ""} /></h3>
              <p style={styles.statP}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

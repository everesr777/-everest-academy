import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../App";
import AppNavbar from "../components/AppNavbar";
import { formatWhatsAppLink } from "../whatsapp";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

export default function PurchaseAllPage() {
  const { t, dir, lang } = useLang();
  const { theme } = useTheme();
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => { const h = () => setM(window.innerWidth <= 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [courses, setCourses] = useState([]);
  const [pricing, setPricing] = useState({});
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const [csData, setCsData] = useState(null);

  useEffect(() => {
    api("/api/courses?status=published").then(d => setCourses(d || [])).catch(() => {});
    fetch(`${BACKEND_URL}/api/pricing`).then(r => r.json()).then(d => setPricing(d || {})).catch(() => {});
    api("/api/customer-service").then(setCsData).catch(() => {});
  }, []);

  const visibleCourses = courses.filter(c => c.is_show_courses !== 0);
  const totalLessons = visibleCourses.reduce((sum, c) => sum + (c.lesson_count || 0), 0);
  const contentPrice = Number(pricing.content_price || 0);
  const balance = user?.e_money || 0;
  const canBuy = balance >= contentPrice;

  const buyAllContent = async () => {
    if (!user) { nav("/login"); return; }
    if (!canBuy) {
      setError(t("رصيد E-Money غير كافٍ. تواصل مع خدمة العملاء لشحن رصيدك.", "Insufficient E-Money balance. Contact customer service to top up."));
      return;
    }
    setBuying(true);
    setError("");
    try {
      for (const course of visibleCourses) {
        const enrolled = await api(`/api/courses/my?userId=${user.id}&courseId=${course.id}`).catch(() => []);
        const active = (enrolled || []).find(e => e.status === "approved" || e.status === "pending");
        if (!active) {
          await api(`/api/courses/${course.id}/purchase`, {
            method: "POST", body: JSON.stringify({ userId: user.id, payment_method: "emoney" })
          }).catch(() => {});
        }
      }
      const freshUser = await api(`/api/users/${user.id}`);
      login({ ...freshUser, session_token: user.session_token });
      nav("/my-courses");
    } catch (e) {
      setError(t("حدث خطأ أثناء الشراء. حاول مرة أخرى.", "Error during purchase. Try again."));
    }
    setBuying(false);
  };

  const bg = theme === "dark" ? "#0f0f1a" : "#fafafa";
  const cardBg = theme === "dark" ? "#1a1a2e" : "#ffffff";
  const text = theme === "dark" ? "#f0f0f0" : "#111";
  const muted = theme === "dark" ? "#888" : "#777";
  const border = theme === "dark" ? "#2a2a3e" : "#f0f0f0";

  return (
    <div style={{ background: bg, minHeight: "100vh", fontFamily: "'Cairo', sans-serif", direction: dir }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        .pay-hero{min-height:50vh;display:flex;align-items:center;justify-content:center;padding:120px 20px 60px;background:linear-gradient(135deg,#0a0a1a 0%,#1a1030 50%,#0a0a1a 100%);position:relative;overflow:hidden;text-align:center}
        .pay-hero::before{content:'';position:absolute;width:600px;height:600px;background:radial-gradient(circle,rgba(110,59,242,.15),transparent 70%);top:-200px;right:-100px;border-radius:50%}
        .pay-hero::after{content:'';position:absolute;width:400px;height:400px;background:radial-gradient(circle,rgba(110,59,242,.08),transparent 70%);bottom:-150px;left:-100px;border-radius:50%}
        .pay-hero h1{font-size:clamp(2rem,5vw,3.5rem);color:#fff;font-weight:900;margin:0 0 12px;position:relative;z-index:1}
        .pay-hero h1 span{background:linear-gradient(135deg,#6E3BF2,#B88BFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .pay-hero p{color:rgba(255,255,255,.6);font-size:1.1rem;max-width:600px;margin:0 auto;position:relative;z-index:1;line-height:1.8}
        .pay-body{max-width:900px;margin:0 auto;padding:0 20px 60px}
        .pay-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:-40px;position:relative;z-index:2;margin-bottom:32px}
        .pay-stat{background:${cardBg};border-radius:20px;padding:24px 16px;text-align:center;border:1px solid ${border};box-shadow:0 8px 30px rgba(0,0,0,.08)}
        .pay-stat-num{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#6E3BF2,#B88BFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .pay-stat-label{font-size:.8rem;color:${muted};margin-top:4px;font-weight:600}
        .pay-courses-list{background:${cardBg};border-radius:24px;border:1px solid ${border};overflow:hidden;margin-bottom:24px}
        .pay-courses-header{padding:20px 24px;border-bottom:1px solid ${border};display:flex;align-items:center;gap:10px}
        .pay-courses-header h3{margin:0;font-size:1rem;font-weight:700;color:${text}}
        .pay-course-row{display:flex;align-items:center;gap:14px;padding:14px 24px;border-bottom:1px solid ${border};transition:.2s}
        .pay-course-row:last-child{border-bottom:none}
        .pay-course-row:hover{background:${theme === "dark" ? "rgba(110,59,242,.05)" : "rgba(110,59,242,.03)"};}
        .pay-course-thumb{width:56px;height:56px;border-radius:14px;object-fit:cover;flex-shrink:0;background:#f0f0f0}
        .pay-course-info{flex:1;min-width:0}
        .pay-course-info h4{margin:0;font-size:.9rem;font-weight:700;color:${text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pay-course-info p{margin:2px 0 0;font-size:.75rem;color:${muted}}
        .pay-course-badge{padding:4px 10px;border-radius:8px;font-size:.7rem;font-weight:700;background:rgba(110,59,242,.1);color:#6E3BF2;white-space:nowrap}
        .pay-price-card{background:linear-gradient(135deg,#1a1030,#0f0f1a);border:1px solid rgba(110,59,242,.2);border-radius:28px;padding:36px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden}
        .pay-price-card::before{content:'';position:absolute;width:300px;height:300px;background:radial-gradient(circle,rgba(110,59,242,.1),transparent 70%);top:-150px;right:-100px;border-radius:50%}
        .pay-price-label{color:rgba(255,255,255,.5);font-size:.85rem;font-weight:600;margin-bottom:8px;position:relative;z-index:1}
        .pay-price-amount{font-size:3rem;font-weight:900;background:linear-gradient(135deg,#6E3BF2,#B88BFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;position:relative;z-index:1;line-height:1}
        .pay-price-sub{color:rgba(255,255,255,.4);font-size:.8rem;margin-top:6px;position:relative;z-index:1}
        .pay-balance-bar{display:flex;align-items:center;justify-content:space-between;background:${cardBg};border:1px solid ${border};border-radius:16px;padding:16px 20px;margin-bottom:20px}
        .pay-balance-bar span{font-size:.9rem;font-weight:600;color:${text}}
        .pay-balance-bar strong{color:#6E3BF2;font-weight:800}
        .pay-buy-btn{width:100%;height:60px;border:none;border-radius:18px;font-size:1.1rem;font-weight:900;cursor:pointer;transition:.3s;font-family:'Cairo',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px}
        .pay-buy-btn.enabled{background:linear-gradient(135deg,#6E3BF2,#B88BFF);color:#111}
        .pay-buy-btn.enabled:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(110,59,242,.4)}
        .pay-buy-btn.disabled{background:#333;color:#666;cursor:not-allowed}
        .pay-login-btn{width:100%;height:60px;border:none;border-radius:18px;background:linear-gradient(135deg,#6E3BF2,#B88BFF);color:#111;font-size:1.1rem;font-weight:900;cursor:pointer;transition:.3s;font-family:'Cairo',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;text-decoration:none}
        .pay-login-btn:hover{transform:translateY(-3px);box-shadow:0 12px 35px rgba(110,59,242,.4)}
        .pay-error{background:rgba(255,59,48,.1);border:1px solid rgba(255,59,48,.2);border-radius:14px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;font-size:.85rem;color:#ff3b30}
        .pay-perks{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
        .pay-perk{background:${cardBg};border:1px solid ${border};border-radius:14px;padding:16px;display:flex;align-items:center;gap:10px;font-size:.85rem;color:${text}}
        .pay-perk i{color:#6E3BF2;font-size:1.1rem;width:20px;text-align:center}
        @media(max-width:768px){
          .pay-hero{padding:100px 20px 40px;min-height:auto}
          .pay-hero h1{font-size:1.8rem}
          .pay-stats{grid-template-columns:repeat(3,1fr);gap:10px;margin-top:-30px}
          .pay-stat{padding:16px 8px}
          .pay-stat-num{font-size:1.4rem}
          .pay-stat-label{font-size:.65rem}
          .pay-perks{grid-template-columns:1fr}
          .pay-price-amount{font-size:2.2rem}
          .pay-courses-header,.pay-course-row{padding-left:16px;padding-right:16px}
        }
      `}</style>

      <AppNavbar />

      {/* ===== HERO ===== */}
      <section className="pay-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1>{t("اشترِ", "Buy")} <span>{t("كل المحتوى", "All Content")}</span></h1>
          <p>{t("وصول كامل لجميع الكورسات والدروس التعليمية في منصة إيفرست", "Full access to all courses and educational sessions on Everest platform")}</p>
        </div>
      </section>

      <div className="pay-body">
        {/* ===== STATS ===== */}
        <div className="pay-stats">
          <div className="pay-stat">
            <div className="pay-stat-num">{visibleCourses.length}</div>
            <div className="pay-stat-label">{t("كورس", "Courses")}</div>
          </div>
          <div className="pay-stat">
            <div className="pay-stat-num">{totalLessons}</div>
            <div className="pay-stat-label">{t("درس", "Lessons")}</div>
          </div>
          <div className="pay-stat">
            <div className="pay-stat-num">∞</div>
            <div className="pay-stat-label">{t("وصول دائم", "Lifetime Access")}</div>
          </div>
        </div>

        {/* ===== COURSES LIST ===== */}
        <div className="pay-courses-list">
          <div className="pay-courses-header">
            <span style={{ fontSize: "1.2rem" }}>📚</span>
            <h3>{t("الكورسات المتاحة", "Available Courses")} ({visibleCourses.length})</h3>
          </div>
          {visibleCourses.map((c) => (
            <div key={c.id} className="pay-course-row">
              {c.featured_image ? (
                <img src={c.featured_image} alt="" className="pay-course-thumb" />
              ) : (
                <div className="pay-course-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📚</div>
              )}
              <div className="pay-course-info">
                <h4>{c.title_ar || c.title}</h4>
                <p>{c.lesson_count || 0} {t("درس", "lessons")} · {c.difficulty === "beginner" ? t("مبتدئ", "Beginner") : c.difficulty === "intermediate" ? t("متوسط", "Intermediate") : t("متقدم", "Advanced")}</p>
              </div>
              <div className="pay-course-badge">{c.category_ar || t("عام", "General")}</div>
            </div>
          ))}
        </div>

        {/* ===== PRICE CARD ===== */}
        <div className="pay-price-card">
          <div className="pay-price-label">{t("السعر الإجمالي لكل المحتوى", "Total Price for All Content")}</div>
          <div className="pay-price-amount">{contentPrice.toLocaleString()} E-Money</div>
          <div className="pay-price-sub">{t("وصول دائم لجميع الكورسات", "Lifetime access to all courses")}</div>
        </div>

        {/* ===== BALANCE ===== */}
        {user && (
          <div className="pay-balance-bar">
            <span>{t("رصيدك الحالي:", "Your balance:")}</span>
            <strong>{balance.toLocaleString()} E-Money</strong>
          </div>
        )}

        {/* ===== ERROR ===== */}
        {error && (
          <div className="pay-error">
            <span>⚠️</span>
            <span>{error}</span>
            {csData?.customer_service_whatsapp && (
              <a href={formatWhatsAppLink(csData.customer_service_whatsapp)} target="_blank" rel="noopener noreferrer"
                style={{ marginRight: "auto", padding: "6px 14px", background: "#25d366", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
                WhatsApp
              </a>
            )}
          </div>
        )}

        {/* ===== BUY BUTTON ===== */}
        {!user ? (
          <Link to="/login" className="pay-login-btn">
            🔑 {t("سجّل دخولك لشراء المحتوى", "Sign in to purchase content")}
          </Link>
        ) : (
          <button className={`pay-buy-btn ${buying ? "disabled" : canBuy ? "enabled" : "disabled"}`} onClick={buyAllContent} disabled={buying || !canBuy}>
            {buying ? t("جاري الشراء...", "Purchasing...") : `💳 ${t("شراء كل المحتوى بـ", "Buy All Content for")} ${contentPrice.toLocaleString()} E-Money`}
          </button>
        )}

        {user && !canBuy && !buying && (
          <p style={{ textAlign: "center", color: muted, fontSize: ".8rem", marginTop: 12 }}>
            {t("اشحن رصيدك من صفحة الشحن أو تواصل مع خدمة العملاء", "Top up your balance from the top-up page or contact customer service")}
          </p>
        )}

        {/* ===== PERKS ===== */}
        <div className="pay-perks" style={{ marginTop: 24 }}>
          <div className="pay-perk">
            <i className="fa-solid fa-graduation-cap"></i>
            {t("وصول كامل لجميع الكورسات", "Full access to all courses")}
          </div>
          <div className="pay-perk">
            <i className="fa-solid fa-infinity"></i>
            {t("وصول مدى الحياة", "Lifetime access")}
          </div>
          <div className="pay-perk">
            <i className="fa-solid fa-certificate"></i>
            {t("شهادات معتمدة", "Certified certificates")}
          </div>
          <div className="pay-perk">
            <i className="fa-solid fa-headset"></i>
            {t("دعم مستمر", "Continuous support")}
          </div>
        </div>
      </div>
    </div>
  );
}

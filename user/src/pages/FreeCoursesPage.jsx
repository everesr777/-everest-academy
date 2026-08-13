import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import PublicNavbar from "../components/PublicNavbar";
import FooterSection from "../components/FooterSection";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const apiFetch = (path, opts = {}) => {
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  return fetch(url, { headers: { "Content-Type": "application/json" }, ...opts }).then((r) => r.json());
};

const CATEGORY_ORDER = [
  { id: "trading", emoji: "📈", labelAr: "التداول", labelEn: "Trading", priceKey: "pkg_price_trading" },
  { id: "media_buying", emoji: "📦", labelAr: "الميديا باينج والدروب شيبينج", labelEn: "Media Buying & Dropshipping", priceKey: "pkg_price_media_buying" },
  { id: "marketing", emoji: "📢", labelAr: "الماركتينج والتسويق الرقمي", labelEn: "Marketing & Digital Marketing", priceKey: "pkg_price_marketing" },
  { id: "social_media", emoji: "📱", labelAr: "السوشيال ميديا براند", labelEn: "Social Media Brand", priceKey: "pkg_price_social_media" },
  { id: "other", emoji: "📂", labelAr: "أخرى", labelEn: "Other", priceKey: "pkg_price_other" },
];

const CATEGORY_MAP = {};
CATEGORY_ORDER.forEach(c => { CATEGORY_MAP[c.labelAr] = c; });

function getCatInfo(catAr) {
  return CATEGORY_MAP[catAr] || CATEGORY_ORDER.find(c => c.id === "other");
}

export default function FreeCoursesPage() {
  const { t, dir } = useLang();
  const { theme } = useTheme();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [pricing, setPricing] = useState({});
  const [popupCourse, setPopupCourse] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalPrice, setLoginModalPrice] = useState(null);
  const [loginModalCategory, setLoginModalCategory] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [coursesData, pricingData] = await Promise.all([
          apiFetch("/api/courses?status=published"),
          apiFetch("/api/pricing"),
        ]);
        setCourses(coursesData || []);
        setPricing(pricingData || {});
      } catch {}
    };
    load();
  }, []);

  const visibleCourses = courses.filter(c => c.is_show_courses !== 0);
  const q = search.toLowerCase();
  const searched = q
    ? visibleCourses.filter(c =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.title_ar || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.description_ar || "").toLowerCase().includes(q) ||
        (c.category_ar || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q)
      )
    : visibleCourses;

  const grouped = {};
  searched.forEach(c => {
    const catAr = c.category_ar || "";
    const info = getCatInfo(catAr);
    if (!grouped[info.id]) grouped[info.id] = { info, courses: [] };
    grouped[info.id].courses.push(c);
  });

  const orderedGroups = CATEGORY_ORDER.filter(g => grouped[g.id]?.courses.length > 0);

  return (
    <div style={{ background: theme === "dark" ? "#1a1a2e" : "#fafafa", minHeight: "100vh", fontFamily: "'Cairo', sans-serif", direction: dir }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        .fcp-hero{min-height:40vh;display:flex;align-items:center;justify-content:center;padding:140px 20px 80px;background:radial-gradient(circle at top right,rgba(110,59,242,.18),transparent 35%),radial-gradient(circle at bottom left,rgba(110,59,242,.1),transparent 35%),#fafafa}
        .fcp-hero-inner{width:min(100%,900px);text-align:center}
        .fcp-hero h1{font-size:clamp(2.5rem,7vw,5.5rem);line-height:1;color:#111;margin:0 0 24px;font-weight:800}
        .fcp-hero p{max-width:650px;margin:auto;color:#666;line-height:1.8;font-size:1.05rem}
        .fcp-search-box{margin-top:40px;background:#fff;border-radius:999px;padding:10px;display:flex;gap:10px;box-shadow:0 15px 40px rgba(0,0,0,.06);max-width:700px;margin-inline:auto}
        .fcp-search-box input{flex:1;border:none;outline:none;padding:16px 20px;font-size:1rem;background:transparent;font-family:'Cairo',sans-serif}
        .fcp-search-box button{border:none;background:#111;color:#fff;padding:0 28px;border-radius:999px;cursor:pointer;font-weight:700;font-family:'Cairo',sans-serif;transition:.3s}
        .fcp-search-box button:hover{transform:translateY(-2px)}
        .fcp-cat-section{padding:40px 20px 20px;max-width:1300px;margin:auto}
        .fcp-cat-section-header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .fcp-cat-section-header h2{margin:0;font-size:clamp(1.4rem,3vw,2rem);color:#111;font-weight:800}
        .fcp-cat-section-header .fcp-cat-count{background:#f0f0f0;color:#777;padding:4px 12px;border-radius:999px;font-size:.8rem;font-weight:600}
        .fcp-pkg-price{display:flex;align-items:center;gap:8px;margin:12px 0 20px;font-size:1.05rem;color:#B88BFF;font-weight:800}
        .fcp-pkg-price span{background:linear-gradient(135deg,#6E3BF2,#B88BFF);color:#fff;padding:6px 16px;border-radius:12px;font-size:1rem}
        .fcp-cat-divider{border:none;border-top:2px solid #f0f0f0;margin:0 20px}
        .fcp-cards-row{display:flex;gap:22px;overflow-x:auto;scroll-behavior:smooth;padding-bottom:10px;scrollbar-width:none}
        .fcp-cards-row::-webkit-scrollbar{display:none}
        .fcp-trend-card{min-width:250px;max-width:250px;background:#fff;border-radius:26px;overflow:hidden;position:relative;flex-shrink:0;box-shadow:0 12px 30px rgba(0,0,0,.05);transition:.35s}
        .fcp-trend-card:hover{transform:translateY(-8px)}
        .fcp-trend-card img{width:100%;height:180px;object-fit:cover}
        .fcp-free-tag{position:absolute;top:14px;right:14px;background:#059669;color:#fff;padding:6px 12px;border-radius:999px;font-size:.75rem;font-weight:700}
        .fcp-card-img-wrap{position:relative;overflow:hidden}
        .fcp-card-img-wrap img{transition:transform .5s}
        .fcp-trend-card:hover .fcp-card-img-wrap img{transform:scale(1.05)}
        .fcp-trend-info{padding:18px}
        .fcp-trend-info h3{color:#111;margin:0 0 10px;font-size:1rem;font-weight:700}
        .fcp-trend-info p{color:#777;font-size:.9rem;line-height:1.6;height:45px;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .fcp-course-meta{display:flex;justify-content:space-between;margin-top:15px;font-size:.85rem;color:#555}
        .fcp-card-actions{margin-top:18px}
        .fcp-view-btn{width:100%;height:46px;border:none;border-radius:14px;background:linear-gradient(135deg,#6E3BF2,#B88BFF);color:#fff;cursor:pointer;font-weight:800;font-family:'Cairo',sans-serif;transition:.3s;text-decoration:none;display:flex;align-items:center;justify-content:center;font-size:.95rem;letter-spacing:.3px}
        .fcp-view-btn:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(110,59,242,.35)}
        .fcp-premium-section{max-width:1300px;margin:70px auto;padding:70px;border-radius:40px;background:linear-gradient(135deg,#0f0f0f,#1c1c1c);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:60px;overflow:hidden;position:relative}
        .fcp-premium-section::before{content:'';position:absolute;width:500px;height:500px;background:#6E3BF2;opacity:.07;border-radius:50%;top:-250px;right:-150px}
        .fcp-premium-label{color:#6E3BF2;font-weight:700;letter-spacing:2px;font-size:.85rem}
        .fcp-premium-content h2{margin:18px 0;font-size:clamp(2rem,5vw,3.5rem);line-height:1.2}
        .fcp-premium-content p{max-width:600px;color:#d0d0d0;line-height:1.8}
        .fcp-premium-features{margin-top:35px;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        .fcp-feature{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);padding:14px 18px;border-radius:16px;font-size:.9rem}
        .fcp-premium-card{min-width:320px;background:rgba(255,255,255,.05);backdrop-filter:blur(18px);border:1px solid rgba(110,59,242,.2);border-radius:30px;padding:40px;text-align:center}
        .fcp-premium-card span{color:#6E3BF2;font-weight:700;font-size:.85rem}
        .fcp-premium-card h3{margin:15px 0;font-size:3rem;color:#fff}
        .fcp-premium-card>p{color:#cfcfcf;margin-bottom:30px}
        .fcp-start-btn{width:100%;height:58px;display:flex;align-items:center;justify-content:center;border-radius:18px;background:#6E3BF2;color:#fff;text-decoration:none;font-weight:800;transition:.3s;border:none;cursor:pointer;font-family:'Cairo',sans-serif;font-size:1rem}
        .fcp-start-btn:hover{transform:translateY(-3px)}
        .fcp-emp{text-align:center;padding:40px 20px;color:#999}
        .fcp-emp h3{color:#666;margin:0 0 8px}
        .fcp-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(10px);z-index:3000;display:flex;justify-content:center;align-items:center;opacity:0;pointer-events:none;transition:.3s;padding:15px}
        .fcp-modal-overlay.open{opacity:1;pointer-events:auto}
        .fcp-modal-box{width:min(900px,92%);max-height:85vh;overflow:auto;background:#fff;border-radius:32px;transform:translateY(20px);transition:.3s}
        .fcp-modal-overlay.open .fcp-modal-box{transform:translateY(0)}
        .fcp-modal-header{display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid #f0f0f0}
        .fcp-modal-header h3{font-size:1.5rem;color:#111;margin:0}
        .fcp-modal-close{width:44px;height:44px;border:none;border-radius:50%;background:#f4f4f4;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center}
        .fcp-modal-body{padding:28px}
        .fcp-modal-img{width:100%;height:220px;object-fit:cover;border-radius:20px}
        .fcp-modal-title{font-size:1.5rem;color:#111;margin:20px 0 10px}
        .fcp-modal-desc{color:#777;line-height:1.8;margin-bottom:20px}
        .fcp-modal-perks{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
        .fcp-modal-perk{display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:16px;background:#fafafa;font-size:.9rem;color:#444}
        .fcp-modal-perk i{color:#6E3BF2}
        .fcp-modal-start{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:18px;background:#6E3BF2;color:#fff;text-decoration:none;font-weight:800;transition:.3s;border:none;cursor:pointer;font-family:'Cairo',sans-serif}
        .fcp-modal-start:hover{transform:translateY(-2px)}
        @media(max-width:768px){
          .fcp-hero{padding:120px 20px 60px;min-height:auto}
          .fcp-hero h1{font-size:2.4rem}
          .fcp-search-box{flex-direction:column;border-radius:28px}
          .fcp-search-box button{height:52px}
          .fcp-cards-row{gap:16px;padding:0 0 10px}
          .fcp-trend-card{min-width:240px;max-width:240px}
          .fcp-premium-section{flex-direction:column;padding:40px 24px;text-align:center;margin:40px 16px}
          .fcp-premium-features{grid-template-columns:1fr}
          .fcp-premium-card{width:100%;min-width:auto}
          .fcp-modal-overlay{align-items:flex-end;padding:0}
          .fcp-modal-box{width:100%;max-height:90vh;border-radius:20px 20px 0 0}
        }
        @media(min-width:769px) and (max-width:1024px){.fcp-premium-features{grid-template-columns:1fr}}
        [data-theme="dark"] .fcp-hero{background:radial-gradient(circle at top right,rgba(110,59,242,.12),transparent 35%),radial-gradient(circle at bottom left,rgba(110,59,242,.08),transparent 35%),#1a1a2e}
        [data-theme="dark"] .fcp-hero h1{color:#f0f0f0}
        [data-theme="dark"] .fcp-hero p{color:#aaa}
        [data-theme="dark"] .fcp-search-box{background:#2a2a3e;box-shadow:0 15px 40px rgba(0,0,0,.3)}
        [data-theme="dark"] .fcp-search-box input{color:#f0f0f0}
        [data-theme="dark"] .fcp-search-box button{background:#6E3BF2;color:#fff}
        [data-theme="dark"] .fcp-cat-section-header h2{color:#f0f0f0}
        [data-theme="dark"] .fcp-cat-section-header .fcp-cat-count{background:#2a2a3e;color:#aaa}
        [data-theme="dark"] .fcp-cat-divider{border-top-color:#333}
        [data-theme="dark"] .fcp-trend-card{background:#1e1e2f;box-shadow:0 12px 30px rgba(0,0,0,.3)}
        [data-theme="dark"] .fcp-trend-info h3{color:#f0f0f0}
        [data-theme="dark"] .fcp-trend-info p{color:#aaa}
        [data-theme="dark"] .fcp-course-meta{color:#aaa}
        [data-theme="dark"] .fcp-emp h3{color:#aaa}
        [data-theme="dark"] .fcp-premium-section{background:linear-gradient(135deg,#0a0a1a,#151528)}
        [data-theme="dark"] .fcp-modal-overlay{background:rgba(0,0,0,.7)}
        [data-theme="dark"] .fcp-modal-box{background:#1e1e2f}
        [data-theme="dark"] .fcp-modal-header{border-bottom-color:#333}
        [data-theme="dark"] .fcp-modal-header h3{color:#f0f0f0}
        [data-theme="dark"] .fcp-modal-close{background:#2a2a3e;color:#f0f0f0}
        [data-theme="dark"] .fcp-modal-title{color:#f0f0f0}
        [data-theme="dark"] .fcp-modal-desc{color:#aaa}
        [data-theme="dark"] .fcp-modal-perk{background:#2a2a3e;color:#ccc}
        .fcp-login-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(12px);z-index:4000;display:flex;justify-content:center;align-items:center;opacity:0;pointer-events:none;transition:.35s;padding:15px}
        .fcp-login-modal-overlay.open{opacity:1;pointer-events:auto}
        .fcp-login-modal{width:min(460px,92%);background:#fff;border-radius:32px;overflow:hidden;transform:scale(.9) translateY(30px);transition:.35s;position:relative}
        .fcp-login-modal-overlay.open .fcp-login-modal{transform:scale(1) translateY(0)}
        .fcp-login-modal-top{background:linear-gradient(135deg,#111,#222);padding:40px 32px 30px;text-align:center;position:relative;overflow:hidden}
        .fcp-login-modal-top::before{content:'';position:absolute;width:200px;height:200px;background:radial-gradient(circle,#6E3BF2 0%,transparent 70%);opacity:.12;top:-80px;right:-60px;border-radius:50%}
        .fcp-login-modal-top::after{content:'';position:absolute;width:150px;height:150px;background:radial-gradient(circle,#6E3BF2 0%,transparent 70%);opacity:.08;bottom:-50px;left:-30px;border-radius:50%}
        .fcp-login-modal-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#6E3BF2,#B88BFF);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 30px rgba(110,59,242,.4);position:relative;z-index:1}
        .fcp-login-modal-icon i{font-size:32px;color:#fff}
        .fcp-login-modal-top h2{color:#fff;font-size:1.5rem;font-weight:800;margin:0 0 8px;position:relative;z-index:1}
        .fcp-login-modal-top p{color:rgba(255,255,255,.7);font-size:.95rem;margin:0;position:relative;z-index:1;line-height:1.6}
        .fcp-login-modal-body{padding:32px;text-align:center}
        .fcp-login-modal-price{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#f9f5e6,#fef9e7);border:1px solid rgba(110,59,242,.25);padding:14px 24px;border-radius:18px;margin-bottom:24px}
        .fcp-login-modal-price span{color:#6E3BF2;font-size:1.3rem;font-weight:900}
        .fcp-login-modal-price small{color:#999;font-size:.85rem}
        .fcp-login-modal-btns{display:flex;gap:12px;justify-content:center}
        .fcp-login-modal-btns a,.fcp-login-modal-btns button{flex:1;height:52px;border-radius:16px;font-weight:800;font-family:'Cairo',sans-serif;font-size:1rem;cursor:pointer;transition:.3s;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;border:none}
        .fcp-login-go{background:linear-gradient(135deg,#6E3BF2,#B88BFF);color:#fff}
        .fcp-login-go:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(110,59,242,.4)}
        .fcp-login-cancel{background:#f4f4f4;color:#666;border:1px solid #eee!important}
        .fcp-login-cancel:hover{background:#eee}
        @media(max-width:768px){.fcp-login-modal-overlay{align-items:flex-end;padding:0}.fcp-login-modal{width:100%;border-radius:24px 24px 0 0;transform:translateY(100%);max-height:85vh}.fcp-login-modal-overlay.open .fcp-login-modal{transform:translateY(0)}.fcp-login-modal-top{padding:28px 20px 24px}}
        [data-theme="dark"] .fcp-login-modal{background:#1e1e2f}
        [data-theme="dark"] .fcp-login-modal-body{background:#1e1e2f}
        [data-theme="dark"] .fcp-login-modal-price{background:rgba(110,59,242,.08);border-color:rgba(110,59,242,.2)}
        [data-theme="dark"] .fcp-login-cancel{background:#2a2a3e;color:#aaa;border-color:#444!important}
      `}</style>

      <PublicNavbar active="courses" />

      {/* ===== HERO ===== */}
      <section className="fcp-hero">
        <div className="fcp-hero-inner">
          <h1>{t("جرّب مجاناً قبل ما تشتري", "Try Before You Buy")}</h1>
          <p>{t("استكشف دروساً مجانية من كورسات مدفوعة — تعرّف على المحتوى والأسلوب قبل الاشتراك.", "Explore free lessons from paid courses — experience the content and style before subscribing.")}</p>
          <div className="fcp-search-box">
            <input
              type="text"
              placeholder={t("ابحث عن أي موضوع...", "Search for any topic...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button>{t("بحث", "Search")}</button>
          </div>
        </div>
      </section>

      {/* ===== COURSE SECTIONS BY CATEGORY ===== */}
      {orderedGroups.length > 0 ? (
        orderedGroups.map((groupKey, idx) => {
          const g = grouped[groupKey.id];
          return (
            <React.Fragment key={groupKey.id}>
              <section className="fcp-cat-section">
                <div className="fcp-cat-section-header">
                  <span style={{ fontSize: "2rem" }}>{groupKey.emoji}</span>
                  <h2>{t(groupKey.labelAr, groupKey.labelEn)}</h2>
                  <span className="fcp-cat-count">{g.courses.length} {t("كورس", "courses")}</span>
                </div>
                <div className="fcp-cards-row">
                  {g.courses.map(c => (
                    <div key={c.id} className="fcp-trend-card" onClick={() => setPopupCourse(c)} style={{ cursor: "pointer" }}>
                      <div className="fcp-card-img-wrap">
                        {c.featured_image ? (
                          <img src={c.featured_image} alt={c.title_ar || c.title} />
                        ) : (
                          <div style={{ width: "100%", height: 180, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#ddd" }}>📚</div>
                        )}
                      </div>
                      <div className="fcp-trend-info">
                        <h3>{c.title_ar || c.title}</h3>
                        <p>{c.description_ar || c.description || ""}</p>
                        <div className="fcp-course-meta">
                          <span>{c.lesson_count || 0} {t("درس", "Sessions")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {idx < orderedGroups.length - 1 && <hr className="fcp-cat-divider" />}
            </React.Fragment>
          );
        })
      ) : (
        <div className="fcp-emp">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h3>{t("لا توجد نتائج", "No Results Found")}</h3>
          <p>{t("جرب كلمات بحث مختلفة", "Try different search terms")}</p>
        </div>
      )}

      {/* ===== BUY ALL CONTENT BUTTON ===== */}
      {orderedGroups.length > 0 && (
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "20px 20px 0" }}>
          <button className="fcp-view-btn" style={{ maxWidth: 600, margin: "0 auto", display: "flex", fontSize: "1.05rem", height: 54 }} onClick={() => {
            window.location.href = "/purchase-all";
          }}>
            {t(" سعر الباكدج ", "Buy All Content")} — {Number(pricing.content_price || 0).toLocaleString()} E-Money
          </button>
        </div>
      )}

      {/* ===== WHY EVEREST ===== */}
      <section className="fcp-premium-section">
        <div className="fcp-premium-content">
          <span className="fcp-premium-label">{t("لماذا إيفرست؟", "WHY EVEREST?")}</span>
          <h2>{t("أكثر من مجرد تعلم", "More Than Just Learning")}</h2>
          <p>{t("نقدم تجربة تعليمية متكاملة مصممة لمساعدة الطلاب على النمو والحفاظ على حماسهم وتحقيق نتائج حقيقية من خلال محتوى عملي ودعم مستمر.", "We provide a complete learning experience designed to help students grow, stay motivated and achieve real results through practical content and continuous support.")}</p>
          <div className="fcp-premium-features">
            <div className="fcp-feature">{t("🎯 مسار تعليمي شخصي", "Personalized Learning Journey")}</div>
            <div className="fcp-feature">{t("🚀 حماس مستمر", "Continuous Motivation")}</div>
            <div className="fcp-feature">{t("📚 محتوى محدث", "Updated Content")}</div>
            <div className="fcp-feature">{t("💎 نظام E-Money مرن", "Flexible E-Money System")}</div>
            <div className="fcp-feature">{t("🤝 دعم الطلاب", "Student Support")}</div>
            <div className="fcp-feature">{t("🌟 استرداد الأموال خلال 48 ساعة", "Money refund in 48 hours")}</div>
          </div>
        </div>
        <div className="fcp-premium-card">
          <span>{t("مجتمعنا", "OUR COMMUNITY")}</span>
          <h3>{courses.length * 30}+</h3>
          <p>{t("جلسة تعليمية فاخرة", "Premium Learning Sessions")}</p>
          <button className="fcp-start-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{t("ابدأ التعلم", "Start Learning")}</button>
        </div>
      </section>

      {/* ===== PREVIEW MODAL ===== */}
      <div className={`fcp-modal-overlay ${popupCourse ? "open" : ""}`} onClick={(e) => { if (e.target.classList.contains("fcp-modal-overlay")) setPopupCourse(null); }}>
        {popupCourse && (
          <div className="fcp-modal-box">
            <div className="fcp-modal-header">
              <h3>{popupCourse.title_ar || popupCourse.title}</h3>
              <button className="fcp-modal-close" onClick={() => setPopupCourse(null)}>✕</button>
            </div>
            <div className="fcp-modal-body">
              {popupCourse.featured_image ? (
                <img src={popupCourse.featured_image} alt="" className="fcp-modal-img" />
              ) : (
                <div style={{ width: "100%", height: 220, background: "#f0f0f0", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50 }}>📚</div>
              )}
              <h3 className="fcp-modal-title">{popupCourse.title_ar || popupCourse.title}</h3>
              <p className="fcp-modal-desc">{popupCourse.description_ar || popupCourse.description || ""}</p>
              <div className="fcp-modal-perks">
                <div className="fcp-modal-perk">
                  <i className="fa-solid fa-shield-halved"></i>
                  {t("الجلستين الأولى مجانية تماماً بالمنصة", "First 2 sessions completely free on the platform")}
                </div>
                <div className="fcp-modal-perk">
                  <i className="fa-solid fa-trophy"></i>
                  {t("شهادة مهنية معتمدة فور إتمام المسار", "Professional certificate upon path completion")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="fcp-modal-start" onClick={() => { setLoginModalPrice(Number(pricing.content_price || 0).toLocaleString()); setLoginModalCategory(null); setPopupCourse(null); setShowLoginModal(true); }}>
                  {t(" سعر الباكدج ", "Buy All Content")}
                </button>
                <button style={{ width: "auto", padding: "0 24px", height: 48, border: "none", borderRadius: 18, background: "#f0f0f0", color: "#111", cursor: "pointer", fontWeight: 700, fontFamily: "'Cairo',sans-serif", transition: ".3s", fontSize: ".9rem" }} onClick={() => setPopupCourse(null)}>
                  {t("إغلاق", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== LOGIN PROMPT MODAL ===== */}
      <div className={`fcp-login-modal-overlay ${showLoginModal ? "open" : ""}`} onClick={(e) => { if (e.target.classList.contains("fcp-login-modal-overlay")) setShowLoginModal(false); }}>
        <div className="fcp-login-modal">
          <div className="fcp-login-modal-top">
            <div className="fcp-login-modal-icon">
              <i className="fa-solid fa-right-to-bracket"></i>
            </div>
            <h2>{t("سجّل دخولك أولاً", "Sign In First")}</h2>
          </div>
          <div className="fcp-login-modal-body">
            <div className="fcp-login-modal-price">
              <small>{t("سعر الباكدج", "Package Price")}:</small>
              <span>{loginModalPrice} E-Money</span>
            </div>
            <div className="fcp-login-modal-btns">
              <Link to="/login" className="fcp-login-go">
                <i className="fa-solid fa-right-to-bracket"></i>
                {t("تسجيل الدخول", "Sign In")}
              </Link>
              <button className="fcp-login-cancel" onClick={() => setShowLoginModal(false)}>
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <FooterSection />
    </div>
  );
}

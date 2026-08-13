import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import PublicNavbar from "../components/PublicNavbar";
import FooterSection from "../components/FooterSection";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const pscStyles = `
@keyframes pscFadeUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
@keyframes pscIconPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
.psc-track::-webkit-scrollbar { display:none; }
.psc-track { -ms-overflow-style:none; scrollbar-width:none; scroll-snap-type:x mandatory; cursor:grab; }
.psc-track:active { cursor:grabbing; }
.psc-card { scroll-snap-align:start; }
.psc-card:hover .psc-icon-box { transform:translateY(-4px) scale(1.06); box-shadow:0 12px 32px rgba(110,59,242,0.3); }
.psc-card:hover { transform:translateY(-6px); box-shadow:0 20px 50px rgba(0,0,0,0.1); }
.psc-dot { transition:all 0.3s ease; }
.psc-dot.active { width:28px; background:#6E3BF2; }
`;

function AnimatedNumber({ target, suffix, isVisible }) {
  const [val, setVal] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!isVisible || done.current) return;
    done.current = true;
    const raw = String(target).replace(/[^0-9]/g, "");
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    const hasDecimal = String(target).includes(".");
    let start = 0;
    const dur = 1200;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const current = Math.round(ease * num);
      setVal(hasDecimal ? (current / 10).toFixed(1) : current);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isVisible, target]);
  return <span>{typeof val === "string" ? val : val.toLocaleString()}{suffix}</span>;
}

function PremiumStatsCarousel({ stats, t, c, theme }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasScrolled = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const items = [
    {
      icon: "fa-solid fa-star",
      num: "3",
      suffix: ".6 ★",
      title: t("تقييم الاكاديميه", "Academy Rating"),
      desc: t("متوسط تقييم الطلاب لأكاديمية إيفرست.", "Average student rating for Everest Academy."),
      accent: "#6366f1",
    },
    {
      icon: "fa-solid fa-clock",
      num: "6",
      suffix: "K+",
      title: t("ساعه تعليميه", "Educational Hours"),
      desc: t("محتوى تعليمي غني بأكثر من 6 آلاف ساعة.", "Rich educational content with over 6,000 hours."),
      accent: "#6E3BF2",
    },
    {
      icon: "fa-solid fa-graduation-cap",
      num: "114",
      suffix: "+",
      title: t("دوره تعليميه", "Educational Courses"),
      desc: t("مجموعة متنوعة من الدورات لتنمية المهارات.", "A diverse range of courses to develop your skills."),
      accent: "#f59e0b",
    },
    {
      icon: "fa-solid fa-users",
      num: "19",
      suffix: "K+",
      title: t("متدرب", "Trainees"),
      desc: t("طلاب و متدربين يثقون بأكاديمية إيفرست.", "Students and trainees who trust Everest Academy."),
      accent: "#10b981",
    },
  ];

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[0];
    if (!card) return;
    const cardW = card.offsetWidth;
    const style = getComputedStyle(el);
    const gap = parseInt(style.gap || "20", 10);
    const idx = Math.round(el.scrollLeft / (cardW + gap));
    const newIdx = Math.min(Math.max(idx, 0), items.length - 1);
    setActiveIdx(newIdx);
    if (!hasScrolled.current && el.scrollLeft > 10) hasScrolled.current = true;
  }, [items.length]);

  const scrollTo = (i) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[0];
    if (!card) return;
    const cardW = card.offsetWidth;
    const style = getComputedStyle(el);
    const gap = parseInt(style.gap || "20", 10);
    el.scrollTo({ left: i * (cardW + gap), behavior: "smooth" });
  };

  const onMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeftRef.current - (x - startX.current) * 1.2;
  };

  return (
    <section ref={sectionRef} style={{ padding: "50px 0", background: theme === "dark" ? "linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)" : "linear-gradient(180deg,#fafbff 0%,#f0eeff 100%)", direction: "ltr", overflow: "hidden" }}>
      <style>{pscStyles}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 5%" }}>
        {/* Header */}
        <div style={{
          textAlign: "center", marginBottom: 48,
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(30px)",
          transition: "all 0.7s cubic-bezier(.4,0,.2,1)",
        }}>
          <span style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: 3,
            color: "#6E3BF2", textTransform: "uppercase", marginBottom: 14,
            background: "rgba(110,59,242,0.1)", padding: "6px 18px", borderRadius: 99,
          }}>
            {t("لماذا إيفرست", "WHY EVEREST")}
          </span>
          <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: theme === "dark" ? "#f0f0f0" : "#111", margin: "14px 0 0", lineHeight: 1.2 }}>
            {t("أرقام تتحدث عن جودتنا", "Numbers That Speak For Us")}
          </h2>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="psc-track"
          style={{
            display: "flex", gap: 20, overflowX: "auto", padding: "10px 4px 30px",
          }}
          onScroll={onScroll}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="psc-card"
              style={{
                flex: "0 0 280px",
                background: theme === "dark" ? "#1e1e2f" : "#fff",
                borderRadius: 24,
                padding: "30px 24px 24px",
                border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
                boxShadow: theme === "dark" ? "0 4px 24px rgba(0,0,0,0.2)" : "0 4px 24px rgba(0,0,0,0.04)",
                display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                transition: "all 0.35s cubic-bezier(.4,0,.2,1)",
                animation: visible ? `pscFadeUp 0.6s ease ${i * 0.12}s both` : "none",
              }}
            >
              {/* Icon */}
              <div className="psc-icon-box" style={{
                width: 64, height: 64, borderRadius: 20,
                background: `linear-gradient(135deg, ${item.accent}18, ${item.accent}30)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 24, transition: "all 0.35s ease",
              }}>
                <i className={item.icon} style={{ fontSize: 26, color: item.accent }}></i>
              </div>

              {/* Number */}
              <h2 style={{
                fontSize: 36, fontWeight: 800, color: theme === "dark" ? "#f0f0f0" : "#111", margin: 0, lineHeight: 1,
                fontFamily: "'Poppins','Cairo',sans-serif",
              }}>
                <AnimatedNumber target={item.num} suffix={item.suffix} isVisible={visible} />
              </h2>

              {/* Title */}
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: theme === "dark" ? "#e0e0e0" : "#333", margin: "12px 0 10px",
                letterSpacing: 0.3,
              }}>
                {item.title}
              </h3>

              {/* Divider */}
              <div style={{ width: 40, height: 3, borderRadius: 3, background: `${item.accent}30`, marginBottom: 14 }} />

              {/* Description */}
              <p style={{
                fontSize: 13, lineHeight: 1.7, color: theme === "dark" ? "#aaa" : "#888", margin: 0,
                maxWidth: 240,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { t, lang } = useLang();
  const { theme, toggle, colors: c } = useTheme();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [stats, setStats] = useState({ totalMembers: 0, satisfactionRate: 95, totalFeedbacks: 0 });

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/dashboard/public-stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll(".landing-page .reveal");
    const revealElements = () => {
      reveals.forEach((item) => {
        const top = item.getBoundingClientRect().top;
        const trigger = window.innerHeight - 100;
        if (top < trigger) item.classList.add("active");
      });
    };
    window.addEventListener("scroll", revealElements);
    revealElements();

    return () => {
      window.removeEventListener("scroll", revealElements);
    };
  }, []);

  return (
    <div className="landing-page">
      <PublicNavbar />

      {/* Hero */}
      <section className="hero-section">
        <video className="video-bg" autoPlay muted loop playsInline>
          <source src="video/IMG_1327.mp4" type="video/mp4" />
        </video>
        <div className="overlay"></div>
        <div className="video-content-layer">

          <div className="center-content">
            <h1>
              {t(".اتقن المهارات", ".Master Skills")}
              <br /> {t(".ابنِ مستقبلك", ".Build Your Future")} <br />
            </h1>
            <Link to="/register" className="btn-trading">{t("ابدأ الآن", "Get Started")}</Link>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="tracks-section">
        <div className="tracks-card">
          <div className="tracks-header">
            <span className="tag">{t("برامجنا", "OUR PROGRAMS")}</span>
            <h2>{t("اختر مستقبلك المهني", "Choose Your Future Career")}</h2>
            <p>{t("سواء كنت تبدأ من الصفر أو تبحث عن تطوير مهارات جديدة، فإن برامجنا مصممة لمساعدتك على التعلم والنمو والتقدم بثقة.", "Whether you're starting from scratch or looking to develop new skills, our programs are designed to help you learn, grow, and move forward with confidence.")}</p>
          </div>
          <div className="tracks-grid">
            <div className="track-box">
              <div className="track-icon"><i className="fa-solid fa-bullhorn"></i></div>
              <h3>{t("Media Buying", "Media Buying")}</h3>
              <p>{t("تعلم كيفية إنشاء وإدارة وتحسين الحملات الإعلانية عالية الأداء.", "Learn how to create, manage, and optimize high-performing advertising campaigns.")}</p>
            </div>
            <div className="track-box">
              <div className="track-icon"><i className="fa-solid fa-hashtag"></i></div>
              <h3>{t("Social Media", "Social Media")}</h3>
              <p>{t("أنشئ محتوى جذاب وابنِ حضوراً رقمياً قوياً.", "Create engaging content and build a strong digital presence.")}</p>
            </div>
            <div className="track-box">
              <div className="track-icon"><i className="fa-solid fa-chart-line"></i></div>
              <h3>{t("Trading", "Trading")}</h3>
              <p>{t("تعلم تحليل السوق وإدارة المخاطر واستراتيجيات التداول.", "Learn market analysis, risk management, and trading strategies.")}</p>
            </div>
            <div className="track-box">
              <div className="track-icon"><i className="fa-solid fa-cart-shopping"></i></div>
              <h3>{t("Dropshipping", "Dropshipping")}</h3>
              <p>{t("أطلق وأدر متجرك الإلكتروني الخاص.", "Launch and manage your own online business.")}</p>
            </div>
          </div>
        </div>
      </section>



      {/* CTA */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>{t("رحلتك إلى النجاح تبدأ هنا.", "Your journey to success starts here.")}</h2>
          <Link to="/register" className="cta-btn">{t("ابدأ الآن", "Start Now")}</Link>
        </div>
      </section>

      {/* Platforms Intro */}
      <section className="platforms-intro">
        <div className="platforms-title">
          <h2>
            {t("استكشف محتوانا التعليمي", "Explore Our Learning Content")}
            <span></span>
          </h2>
        </div>
        <div className="platforms-text">
          <div className="line"></div>
          <p>{t("اكتشف مجموعة واسعة من الجلسات التعليمية العملية المصممة لمساعدتك على تطوير مهارات جديدة وتحقيق أهدافك والنمو بثقة.", "Discover a wide range of practical learning sessions designed to help you develop new skills, achieve your goals, and grow with confidence.")}</p>
        </div>
      </section>

      {/* Platform Showcase */}
      <section className="platform-showcase">
        <div className="showcase-image reveal">
          <img src="image/home-image.png" alt="" />
        </div>
        <div className="features-slider"></div>
      </section>

      {/* Stats Carousel */}
      <PremiumStatsCarousel stats={stats} t={t} c={c} theme={theme} />

      {/* Footer */}
      <FooterSection showCTA />
    </div>
  );
}

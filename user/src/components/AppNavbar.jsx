import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import NotificationBell from "./NotificationBell";
import WhatsAppNavIcon from "./WhatsAppNavIcon";

const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};

function ThemeToggle({ c }) {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} title={theme === "dark" ? "Light Mode" : "Dark Mode"} style={{
      width: 40, height: 40, borderRadius: 12, border: `1px solid ${c.border}`,
      background: c.bg, cursor: "pointer", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 18, transition: "0.3s"
    }}>
      {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
    </button>
  );
}

const navItems = [
  { to: "/home", label_ar: "الرئيسية", label_en: "Home", icon: "fa-solid fa-house" },
  { to: "/my-courses", label_ar: "كورساتي", label_en: "My Courses", icon: "fa-solid fa-book-open", hideForStudent: true },
  { to: "/courses", label_ar: "الكورسات", label_en: "Courses", icon: "fa-solid fa-graduation-cap" },
  { to: "/rankings", label_ar: "الرتب", label_en: "Ranks", icon: "fa-solid fa-trophy" },
  { to: "/affiliate?tab=team", label_ar: "التسويق", label_en: "Affiliate", icon: "fa-solid fa-handshake" },
  { to: "/top-saller", label_ar: "الأفضل", label_en: "Top", icon: "fa-solid fa-star" },
  { to: "/feedback/new", label_ar: "التقييم", label_en: "Feedback", icon: "fa-solid fa-comment-dots" },
  { to: "/profile", label_ar: "الملف الشخصي", label_en: "Profile", icon: "fa-solid fa-user" },
];

const mobileTabItems = [
  { to: "/home", label_ar: "الرئيسية", label_en: "Home", icon: "fa-solid fa-house" },
  { to: "/my-courses", label_ar: "كورساتي", label_en: "My Courses", icon: "fa-solid fa-book-open", hideForStudent: true },
  { to: "/courses", label_ar: "الكورسات", label_en: "Courses", icon: "fa-solid fa-graduation-cap" },
  { to: "/rankings", label_ar: "الرتب", label_en: "Ranks", icon: "fa-solid fa-trophy" },
  { to: "/affiliate?tab=team", label_ar: "التسويق", label_en: "Affiliate", icon: "fa-solid fa-handshake" },
  { to: "/top-saller", label_ar: "الأفضل", label_en: "Top", icon: "fa-solid fa-star" },
  { to: "/feedback/new", label_ar: "التقييم", label_en: "Feedback", icon: "fa-solid fa-comment-dots" },
  { to: "/profile", label_ar: "حسابي", label_en: "Profile", icon: "fa-solid fa-user" },
];

const isStudentAccount = (user) => !user || user.account_type === "student" || user.account_type === "registration_free";

export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { t, lang, dir } = useLang();
  const { theme, toggle, colors: c } = useTheme();
  const loc = useLocation();
  const nav = useNavigate();
  const m = useIsMobile();

  if (!user) return null;

  const isActive = (path) => {
    const p = path.split("?")[0];
    return loc.pathname === p;
  };

  const getNavLabel = (item) => {
    if (item.to === "/courses" && (user?.account_type === "student" || user?.account_type === "registration_free")) {
      return t("ماي كورسيس", "My Courses");
    }
    return t(item.label_ar, item.label_en);
  };

  return (
    <>
      {/* Mobile Header (phone only) */}
      {m && (
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: c.bgSoft, borderBottom: `1px solid ${c.border}`,
          padding: "0 16px", height: 56, display: "flex",
          alignItems: "center", justifyContent: "space-between",
          boxShadow: c.shadow, direction: dir,
        }}>
          <Link to="/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <img src="/image/logo-navbar.png" alt="Logo" style={{ height: 52, objectFit:"contain" }} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user && <WhatsAppNavIcon />}
            {user && <NotificationBell userId={user.id} />}
            {user && (
              <div style={{ cursor: "pointer" }} onClick={() => nav("/profile")}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #6E3BF2", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {user?.avatar && user.avatar.trim() ? (
                    <img src={user.avatar} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6E3BF2,#B88BFF)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                      {(user?.full_name || "U")[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Desktop/Tablet Navbar */}
      {!m && (
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: c.bgSoft, borderBottom: `1px solid ${c.border}`,
        padding: "0 30px", height: 72, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        boxShadow: c.shadow, direction: dir
      }}>
        <Link to="/home" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/image/logo-navbar.png" alt="Logo" style={{ height: 80, objectFit:"contain" }} />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {navItems.filter(item => !item.studentOnly || isStudentAccount(user)).filter(item => !(item.hideForStudent && (user?.account_type === "student" || user?.account_type === "registration_free"))).map((item) => {
            const active = isActive(item.to);
            return (
              <Link key={item.to + item.label_en} to={item.to}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  textDecoration: "none", color: active ? c.text : c.textSoft,
                  background: "transparent", whiteSpace: "nowrap",
                  borderBottom: active ? `2px solid ${c.primary}` : "2px solid transparent",
                  marginBottom: -2, letterSpacing: "0.2px"
              }}>
                {getNavLabel(item)}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user && <NotificationBell userId={user.id} />}
          <ThemeToggle c={c} />
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => nav("/profile")}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #6E3BF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {user?.avatar && user.avatar.trim() ? (
                  <img src={user.avatar} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}} />
                ) : (
                  <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16}}>
                    {(user?.full_name||"U")[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link to="/login" style={{
              background: "linear-gradient(135deg,#6E3BF2,#B88BFF)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "8px 18px", fontSize: 13, fontWeight: 700,
              textDecoration: "none"
            }}>
              {t("تسجيل الدخول", "Login")}
            </Link>
          )}
        </div>
      </header>
      )}

      {/* Mobile Bottom Tab Bar */}
      <div className="mobile-tab-bar" style={{
        background: theme === "dark" ? "rgba(20,20,30,0.95)" : "rgba(255,255,255,0.95)",
      }}>
        <div className="mobile-tab-bar-inner" style={{
          background: theme === "dark" ? "rgba(20,20,30,0.95)" : "rgba(255,255,255,0.95)",
          borderTopColor: c.border,
        }}>
          {mobileTabItems.filter(item => !item.studentOnly || isStudentAccount(user)).filter(item => !(item.hideForStudent && (user?.account_type === "student" || user?.account_type === "registration_free"))).map((item) => {
            const active = isActive(item.to);
            return (
              <Link key={item.to} to={item.to} className={active ? "active" : ""} style={{
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                gap:2,textDecoration:"none",flex:1,height:"100%",
                color: active ? "#6E3BF2" : c.textMuted,
                position:"relative",
              }}>
                <span className="tab-icon"><i className={item.icon} style={{fontSize:18}}></i></span>
                <span className="tab-label" style={{color: active ? "#6E3BF2" : c.textMuted}}>
                  {getNavLabel(item)}
                </span>
                {active && (
                  <div style={{
                    position:"absolute",top:4,width:20,height:3,borderRadius:3,
                    background:"#6E3BF2",
                  }} />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

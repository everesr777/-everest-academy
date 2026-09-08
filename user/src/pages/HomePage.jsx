import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api } from "../App";
import AppNavbar from "../components/AppNavbar";
import CustomerServiceFooter from "../components/CustomerServiceFooter";
import FooterSection from "../components/FooterSection";

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};

/* ── Leaders Section: Everest (adapts to light + dark) ── */
function LeadersSection({ leaders, m, dir, t, theme }) {
  const scrollRef = React.useRef(null);
  const [scrollIdx, setScrollIdx] = React.useState(0);

  // Everest palette — swaps between light and dark variants
  const dark = theme === "dark";
  const purple = "#6E3BF2";
  const purpleMid = "#8B5CF6";
  const purpleLight = "#B88BFF";
  const lavender = "#F1ECFF";
  const txt = dark ? "#F4EEFF" : "#1A1230";
  const txtMuted = dark ? "#BDA8E8" : "#6E5A8E";
  const cardBg = dark ? "#221A43" : "#FFFFFF";
  const silver = "#A8A8A8";
  const bronze = "#B87333";
  const gold = "#FFD700";
  const rtl = dir === "rtl";

  const bgGradient = dark
    ? "linear-gradient(180deg,#0D0918 0%,#140E26 25%,#1B1236 55%,#221846 80%,#170F2A 100%)"
    : "linear-gradient(180deg,#FDFCFF 0%,#F8F4FF 20%,#F1ECFF 48%,#E9E0FF 72%,#F4EEFF 100%)";
  const heroBg = dark
    ? "linear-gradient(120deg,#150E26 0%,#1D1438 45%,#2A1F4D 100%)"
    : "linear-gradient(120deg,#FFFFFF 0%,#F7F2FF 45%,#EDE3FF 100%)";
  const cardGlass = dark ? "rgba(28,19,56,.82)" : "rgba(255,255,255,.78)";
  const innerAvatar = dark ? "#241A44" : "#FFFFFF";
  const lavenderBg = dark ? "#2A1F4D" : lavender;
  const keepGoingBg = dark
    ? "linear-gradient(120deg,rgba(32,22,60,.92) 0%,rgba(38,27,72,.78) 100%)"
    : "linear-gradient(120deg,rgba(255,255,255,.92) 0%,rgba(246,240,255,.75) 100%)";
  const insetHi = dark ? "inset 0 1px 0 rgba(255,255,255,.06)" : "inset 0 1px 0 rgba(255,255,255,.95)";
  const pedestal1 = dark ? "linear-gradient(180deg,#241A44,#2C2154)" : "linear-gradient(180deg,#FFFFFF,#E9DFFF)";
  const pedestal2 = dark ? "linear-gradient(180deg,#2E2356,#3A2D6A)" : "linear-gradient(180deg,#F5EFFF,#DDCBFF)";
  const haloWhite = dark ? "rgba(18,12,32,.7)" : "rgba(255,255,255,.6)";

  const heroLeader = leaders[0] || null;
  const restLeaders = leaders.slice(0, 10);

  const cardW = m ? 110 : 136;
  const gap = m ? 8 : 14;
  const step = cardW + gap;

  const clampIdx = (i) => Math.max(0, Math.min(restLeaders.length - 1, i));

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollIdx(clampIdx(Math.round(el.scrollLeft / step)));
  };

  React.useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => checkScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaders, m]);

  const nudge = (d) => {
    const el = scrollRef.current;
    if (!el) return;
    const visible = Math.max(1, Math.floor(el.clientWidth / step));
    const next = clampIdx((Math.round(el.scrollLeft / step)) + d * Math.max(1, visible - 1));
    el.scrollTo({ left: next * step, behavior: "smooth" });
    setTimeout(checkScroll, 400);
  };

  const jumpTo = (i) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: clampIdx(i) * step, behavior: "smooth" });
    setTimeout(checkScroll, 400);
  };

  const canLeft = scrollIdx > 0;
  const canRight = scrollIdx < restLeaders.length - 1;

  const Arrow = ({ d, on, enabled, label }) => (
    <button onClick={on} aria-label={label} disabled={!enabled} style={{
      width: m ? 30 : 38, height: m ? 30 : 38, borderRadius: "50%", flexShrink: 0,
      border: `1px solid ${enabled ? "rgba(110,59,242,.25)" : "rgba(110,59,242,.1)"}`,
      background: enabled ? cardBg : "rgba(110,59,242,.03)",
      color: purple, opacity: enabled ? 1 : 0.35, cursor: enabled ? "pointer" : "not-allowed",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: enabled ? "0 4px 14px rgba(110,59,242,.12)" : "none", transition: "0.2s"
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: d === 1 ? (rtl ? "rotate(180deg)" : "none") : (rtl ? "none" : "rotate(180deg)") }}>
        <path d="M9 6l6 6-6 6" stroke={purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <section style={{ position: "relative", overflow: "hidden", padding: m ? "36px 16px 96px" : "58px 5% 64px", background: bgGradient, color: txt }}>

      {/* ── LAYERED MOUNTAINS (far .04 / mid .07 / front .11) ── */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 260 : 400, opacity: 0.04, pointerEvents: "none" }} viewBox="0 0 1440 400" preserveAspectRatio="none">
        <polygon points="0,400 200,120 420,400" fill={purple} />
        <polygon points="300,400 560,60 830,400" fill={purpleMid} />
        <polygon points="700,400 950,110 1220,400" fill={purple} />
        <polygon points="1100,400 1320,150 1440,400" fill={purpleMid} />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 180 : 260, opacity: 0.07, pointerEvents: "none" }} viewBox="0 0 1440 260" preserveAspectRatio="none">
        <polygon points="0,260 140,70 300,260" fill={purple} />
        <polygon points="220,260 420,30 620,260" fill="#8B5CF6" />
        <polygon points="560,260 760,80 980,260" fill={purpleLight} />
        <polygon points="900,260 1100,40 1300,260" fill={purple} />
        <polygon points="1180,260 1360,90 1440,260" fill="#9B6CFF" />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 110 : 150, opacity: 0.11, pointerEvents: "none" }} viewBox="0 0 1440 150" preserveAspectRatio="none">
        <polygon points="0,150 120,60 240,150" fill={purple} />
        <polygon points="200,150 360,20 520,150" fill={purpleMid} />
        <polygon points="480,150 640,50 800,150" fill={purpleLight} />
        <polygon points="880,150 1020,30 1160,150" fill={purpleMid} />
        <polygon points="1120,150 1260,60 1440,150" fill={purple} />
      </svg>

      {/* ── ABSTRACT TRIANGLES + DIAGONAL SHAPES (very subtle) ── */}
      <svg style={{ position: "absolute", top: m ? 120 : 170, right: "6%", width: 120, height: 120, opacity: 0.05, pointerEvents: "none" }} viewBox="0 0 100 100">
        <polygon points="10,90 50,5 90,90" fill={purple} />
        <circle cx="50" cy="50" r="26" fill="none" stroke={purple} strokeWidth="1.5" />
      </svg>
      <svg style={{ position: "absolute", top: m ? 400 : 500, left: "4%", width: 90, height: 90, opacity: 0.05, pointerEvents: "none" }} viewBox="0 0 100 100">
        <polygon points="50,5 90,90 10,90" fill="#8B5CF6" />
      </svg>
      <div style={{ position: "absolute", top: m ? 46 : 64, left: "9%", width: 8, height: 8, background: "#B88BFF", borderRadius: "50%", opacity: 0.35, animation: "sparkPulse 4s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: m ? 300 : 330, right: "13%", width: 6, height: 6, background: "#8B5CF6", borderRadius: "50%", opacity: 0.3, animation: "sparkPulse 5s ease-in-out 1s infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: m ? 170 : 240, left: "15%", width: 5, height: 5, background: "#6E3BF2", borderRadius: "50%", opacity: 0.25, animation: "sparkPulse 6s ease-in-out 2s infinite", pointerEvents: "none" }} />

      {/* ── "Reach Higher" annotation (top-right) ── */}
      <div style={{ position: "absolute", top: m ? 14 : 30, right: m ? 12 : 60, transform: "rotate(3deg)", textAlign: "right", pointerEvents: "none", zIndex: 1, opacity: 0.85 }}>
        <div style={{ fontSize: m ? 15 : 20, fontWeight: 800, fontStyle: "italic", color: purple, lineHeight: 1.2, letterSpacing: 1 }}>Reach<br />Higher</div>
        <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginTop: 2, opacity: 0.55 }}>
          <path d="M12 2L8 8h8l-4-6z" fill={purple} />
          <line x1="12" y1="8" x2="12" y2="22" stroke={purple} strokeWidth="2" />
          <polygon points="12,8 18,11 12,14" fill={purpleLight} />
        </svg>
      </div>

      {/* ── BG glows (soft blurred gradients) ── */}
      <div style={{ position: "absolute", top: -120, right: -70, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(110,59,242,.16) 0%,transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "42%", left: -110, width: 390, height: 390, borderRadius: "50%", background: "radial-gradient(circle,rgba(155,108,255,.14) 0%,transparent 70%)", filter: "blur(55px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -90, right: -50, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(194,160,255,.18) 0%,transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1120, margin: "auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 2, marginBottom: m ? 16 : 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 999, background: "rgba(110,59,242,.07)", border: "1px solid rgba(165,129,255,.4)", marginBottom: m ? 12 : 18, boxShadow: "0 6px 18px rgba(110,59,242,.08)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14l-5-4.87 6.91-1.01L12 2z" fill={gold}/></svg>
            <span style={{ fontSize: m ? 11 : 13, letterSpacing: 3, color: dark ? "#C9B0FF" : "#5527CD", fontWeight: 800 }}>Everest Leaders</span>
          </div>
          <h2 style={{ fontSize: m ? "1.7rem" : "clamp(2.1rem,5vw,3.4rem)", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
            <span style={{ color: txt }}>Everest </span>
            <span style={{ background: `linear-gradient(135deg,${purple},${purpleMid},${purpleLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("القادة","Leaders")}</span>
          </h2>
          {/* decorative underline */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "9px auto 10px", width: "fit-content" }}>
            <span style={{ width: 46, height: 2, borderRadius: 99, background: "linear-gradient(90deg,transparent,#6E3BF2)" }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L8 8h8l-4-6z" fill={purple} opacity="0.5" /></svg>
            <span style={{ width: 46, height: 2, borderRadius: 99, background: "linear-gradient(90deg,#6E3BF2,transparent)" }} />
          </div>
          <p style={{ color: txtMuted, fontSize: m ? 13 : 15, maxWidth: 460, margin: "auto", lineHeight: 1.6 }}>{t("عقول مختلفة.. هدف واحد.","Different minds. Same goal.")} <strong style={{ color: purple, fontWeight: 700 }}>{t("كن التالي.","Be the next one.")}</strong></p>
        </div>

        {leaders.length === 0 ? (
          <p style={{ color: txtMuted, textAlign: "center", padding: 50, fontSize: 15 }}>{t("لا يوجد قادة بعد","No leaders yet")}</p>
        ) : (
          <>
            {/* ===== #1 CHAMPION HERO (dominant, landscape) ===== */}
            {heroLeader && (
              <div style={{
                position: "relative", borderRadius: m ? 22 : 36, padding: m ? "20px 22px 26px" : "46px 56px",
                background: heroBg,
                border: `1.5px solid ${purple}2E`,
                boxShadow: `0 20px 60px rgba(110,59,242,.18), ${insetHi}`,
                display: "flex", flexDirection: "row", alignItems: "center",
                gap: m ? 14 : 56, overflow: "hidden", marginBottom: m ? 18 : 40,
                animation: "leaderFadeUp 0.6s ease-out both"
              }}>
                {/* mountains behind hero (right side) */}
                <svg style={{ position: "absolute", bottom: -4, right: m ? -30 : 30, height: m ? 88 : 210, width: "auto", opacity: 0.1, pointerEvents: "none" }} viewBox="0 0 320 160" preserveAspectRatio="none">
                  <polygon points="0,160 60,30 120,160" fill={purple} />
                  <polygon points="80,160 150,10 220,160" fill={purpleMid} />
                  <polygon points="170,160 240,35 310,160" fill={purpleLight} />
                  <polygon points="240,160 285,60 330,160" fill={purple} />
                </svg>
                <div style={{ position: "absolute", bottom: 0, right: rtl ? -20 : "56%", width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle,rgba(204,178,255,.4) 0%,transparent 70%)", filter: "blur(35px)", pointerEvents: "none" }} />

                {/* Info — LEFT (both directions) */}
                <div style={{ flex: 1, minWidth: 0, textAlign: rtl ? "right" : "left", position: "relative", zIndex: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: m ? 6 : 12, justifyContent: rtl ? "flex-end" : "flex-start" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14l-5-4.87 6.91-1.01L12 2z" fill={gold}/></svg>
                    <span style={{ fontSize: m ? 11 : 14, fontWeight: 900, letterSpacing: 3, color: gold }}>{t("البطل","CHAMPION")}</span>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: purple }} />
                    <span style={{ fontSize: m ? 11 : 13, fontWeight: 700, color: purple }}>#1 {heroLeader.icon || "🏆"}</span>
                  </div>
                  <h3 style={{ fontSize: m ? 21 : 42, fontWeight: 900, margin: "0 0 5px", color: txt, lineHeight: 1.08, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{heroLeader.name}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: m ? 12 : 16, color: txtMuted, fontWeight: 600 }}>{heroLeader.rank}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: rtl ? "flex-end" : "flex-start" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: m ? "6px 12px" : "9px 16px", borderRadius: 999, background: "rgba(110,59,242,.1)", border: "1px solid rgba(110,59,242,.22)" }}>
                      <span style={{ fontSize: m ? 12 : 15, fontWeight: 900, color: purple }}>#1</span>
                      <span style={{ fontSize: m ? 11 : 14, fontWeight: 800, color: purple }}>{t("الرتبة","Rank")}</span>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: m ? "6px 12px" : "9px 16px", borderRadius: 999, background: "rgba(255,215,0,.13)", border: "1px solid rgba(255,215,0,.4)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14l-5-4.87 6.91-1.01L12 2z" fill={gold}/></svg>
                      <span style={{ fontSize: m ? 11 : 14, fontWeight: 800, color: "#B8860B" }}>{heroLeader.icon || "⭐"} {t("نقاط","Points")}</span>
                    </div>
                  </div>
                  {/* big #1 watermark */}
                  <div style={{ position: "absolute", bottom: m ? -30 : -44, right: m ? 10 : 24, fontSize: m ? 100 : 180, fontWeight: 900, color: purple, opacity: 0.07, lineHeight: 1, pointerEvents: "none" }}>1</div>
                </div>

                {/* Avatar — LARGE, dominant, RIGHT side (both directions) */}
                <div style={{ position: "relative", flexShrink: 0, zIndex: 2, order: rtl ? -1 : 0 }}>
                  {/* halo glow behind profile */}
                  <div style={{ position: "absolute", top: "52%", left: "50%", transform: "translate(-50%,-52%)", width: m ? 190 : 340, height: m ? 190 : 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(155,108,255,.4) 0%,rgba(184,139,255,.14) 45%,transparent 72%)", filter: "blur(16px)", pointerEvents: "none", animation: "heroHalo 4s ease-in-out infinite" }} />
                  {/* decorative arcs */}
                  <svg style={{ position: "absolute", top: m ? -4 : -8, left: "50%", transform: "translateX(-50%)", width: m ? 150 : 280, height: m ? 70 : 130, opacity: 0.4, pointerEvents: "none" }} viewBox="0 0 200 90" fill="none">
                    <path d="M20 55 Q100 5 180 55" stroke={purple} strokeWidth="1.5" strokeDasharray="3 6" strokeLinecap="round" />
                    <path d="M35 55 Q100 18 165 55" stroke={purpleLight} strokeWidth="1" strokeDasharray="2 5" strokeLinecap="round" opacity="0.7" />
                  </svg>
                  {/* outer decorative ring (pulsing) */}
                  <div style={{ position: "absolute", top: m ? 0 : 4, left: "50%", transform: "translateX(-50%)", width: m ? 150 : 268, height: m ? 150 : 268, borderRadius: "50%", border: "1.5px dashed rgba(110,59,242,.3)", pointerEvents: "none", animation: "ringGlow 4s ease-in-out infinite" }} />
                  {/* integrated SVG crown */}
                  <div style={{ position: "absolute", top: m ? -18 : -30, left: "50%", transform: "translateX(-50%)", zIndex: 4, animation: "crownFloat 3s ease-in-out infinite", filter: "drop-shadow(0 6px 14px rgba(255,180,0,.5))" }}>
                    <svg width={m ? 42 : 70} height={m ? 30 : 50} viewBox="0 0 72 46" fill="none">
                      <defs><linearGradient id="everCrown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE98A" /><stop offset="1" stopColor="#FFB300" /></linearGradient></defs>
                      <path d="M6 34 L2 12 L20 22 L36 4 L52 22 L70 12 L66 34 Z" fill="url(#everCrown)" stroke="#FFF6DC" strokeWidth="1.5" strokeLinejoin="round" />
                      <path d="M6 34 L66 34 L66 40 L6 40 Z" fill="#F5C34A" stroke="#FFF6DC" strokeWidth="1" />
                      <circle cx="2" cy="11" r="2.4" fill="#FFD84D" /><circle cx="70" cy="11" r="2.4" fill="#FFD84D" /><circle cx="36" cy="3" r="2.6" fill="#FFD84D" />
                    </svg>
                  </div>
                  {/* main profile rings */}
                  <div style={{ position: "relative", width: m ? 118 : 216, height: m ? 118 : 216, borderRadius: "50%", padding: m ? 5 : 7, background: `linear-gradient(135deg,${purple},${purpleLight},${purpleMid},${purple})`, animation: "leaderGlow 3s ease-in-out infinite" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: innerAvatar, padding: m ? 3 : 5, boxShadow: "inset 0 0 0 1px rgba(110,59,242,.14)" }}>
                      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: lavenderBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {heroLeader.avatar?.trim() ? (
                          <img src={heroLeader.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: m ? 48 : 92, fontWeight: 900, color: purple }}>{(heroLeader.name || "U")[0]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* sparkles */}
                  <span style={{ position: "absolute", top: m ? -6 : 0, right: m ? -6 : -16, fontSize: m ? 14 : 22, color: gold, opacity: 0.85, animation: "sparkPulse 3s ease-in-out 0s infinite", pointerEvents: "none" }}>✦</span>
                  <span style={{ position: "absolute", top: m ? 44 : 78, left: m ? -8 : -22, fontSize: m ? 10 : 16, color: purpleLight, opacity: 0.75, animation: "sparkPulse 3.6s ease-in-out .6s infinite", pointerEvents: "none" }}>✧</span>
                  <span style={{ position: "absolute", bottom: m ? 36 : 64, right: m ? 2 : -4, fontSize: m ? 9 : 13, color: purple, opacity: 0.55, animation: "sparkPulse 4s ease-in-out 1.2s infinite", pointerEvents: "none" }}>⋆</span>
                  {/* layered pedestal + glow */}
                  <div style={{ position: "relative", width: m ? 96 : 200, margin: "12px auto 0" }}>
                    <div style={{ height: m ? 6 : 12, borderRadius: "0 0 26px 26px", background: pedestal1, border: "1px solid rgba(110,59,242,.18)", borderTop: "none", boxShadow: "0 18px 34px rgba(110,59,242,.22)" }} />
                    <div style={{ height: m ? 4 : 9, width: "88%", margin: "0 auto", borderRadius: "0 0 26px 26px", background: pedestal2, border: "1px solid rgba(110,59,242,.12)", borderTop: "none", opacity: 0.9 }} />
                    <div style={{ height: m ? 12 : 20, width: "112%", margin: "-6px -6% 0", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(110,59,242,.3) 0%,transparent 70%)", filter: "blur(8px)", pointerEvents: "none" }} />
                  </div>
                  {/* mountains right behind / below profile */}
                  <svg style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: m ? 130 : 300, height: m ? 56 : 110, opacity: 0.12, pointerEvents: "none" }} viewBox="0 0 120 60" preserveAspectRatio="none">
                    <polygon points="0,60 30,5 60,60" fill={purple} />
                    <polygon points="30,60 65,15 100,60" fill={purpleMid} />
                    <polygon points="70,60 96,25 120,60" fill={purpleLight} />
                  </svg>
                </div>
              </div>
            )}

            {/* ===== TOP 10 HORIZONTAL CAROUSEL (#2 → #10) ===== */}
            {restLeaders.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: m ? 12 : 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={purple} strokeWidth="2" fill="none"/><circle cx="9" cy="7" r="4" stroke={purple} strokeWidth="2" fill="none"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke={purple} strokeWidth="2" fill="none"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={purple} strokeWidth="2" fill="none"/></svg>
                    <span style={{ fontSize: m ? 15 : 18, fontWeight: 800, color: txt }}>Everest Leaders</span>
                  </div>
                  <span style={{ fontSize: m ? 10 : 12, color: txtMuted, fontWeight: 600, opacity: 0.8 }}>{t("اسحب للمزيد ←","Scroll for more →")}</span>
                </div>

                {/* Horizontal scroll track — ALWAYS ONE ROW, never stacked */}
                <div ref={scrollRef} onScroll={checkScroll} style={{
                  display: "flex", flexWrap: "nowrap",
                  gap, overflowX: "auto", overflowY: "hidden",
                  scrollbarWidth: "none", scrollSnapType: "x mandatory",
                  padding: m ? "6px 0 16px" : "10px 0 22px",
                  WebkitOverflowScrolling: "touch"
                }}>
                  <style>{`.leaders-track::-webkit-scrollbar{display:none}`}</style>
                  {restLeaders.map((l, idx) => {
                    const pos = idx + 1;
                    const accent = pos === 1 ? gold : pos === 2 ? silver : pos === 3 ? bronze : purple;
                    const gradAccent = pos === 1 ? `linear-gradient(90deg,${purple},${purpleLight},${gold})` : pos === 2 ? `linear-gradient(90deg,#E8E8E8,${silver},${purpleLight})` : pos === 3 ? `linear-gradient(90deg,#F0C68C,${bronze},${purpleLight})` : `linear-gradient(90deg,${purpleLight},${purple})`;
                    const softBg = pos === 1 ? "rgba(110,59,242,.12)" : pos === 2 ? "rgba(168,168,168,.10)" : pos === 3 ? "rgba(184,115,51,.10)" : "rgba(110,59,242,.07)";
                    const medal = pos === 1 ? "👑" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : "⭐";
                    const regShadow = pos === 1 ? "0 14px 36px rgba(110,59,242,.3), 0 0 26px rgba(110,59,242,.14)" : pos === 2 ? "0 10px 26px rgba(168,168,168,.28)" : pos === 3 ? "0 10px 26px rgba(184,115,51,.24)" : "0 8px 22px rgba(110,59,242,.1)";
                    const rot = [-1, 0.7, 1.1, -0.6, 0.6, -0.9, 0.4, -0.5, 0.7, -0.4][(pos - 1) % 10];
                    return (
                      <div key={l.id || idx} style={{
                        flex: `0 0 ${cardW}px`, scrollSnapAlign: "start",
                        padding: "0 2px 12px", cursor: "pointer",
                        animation: `leaderCardDrop 0.5s ease-out ${idx * 0.05}s`,
                        transition: "transform .25s ease, opacity .25s ease",
                        willChange: "transform"
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-7px) scale(1.03)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                        onMouseDown={e => { e.currentTarget.style.transform = "translateY(-2px) scale(.98)"; }}
                        onMouseUp={e => { e.currentTarget.style.transform = "translateY(-7px) scale(1.03)"; }}
                      >
                        <div style={{
                          position: "relative", overflow: "hidden", textAlign: "center",
                          padding: m ? "12px 8px 14px" : "16px 10px 18px",
                          borderRadius: m ? 16 : 22, transform: `rotate(${rot}deg)`,
                          background: cardGlass, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: `1.5px solid ${pos === 2 ? "rgba(160,160,160,.45)" : pos === 3 ? "rgba(190,120,60,.4)" : pos === 1 ? "rgba(110,59,242,.4)" : "rgba(110,59,242,.16)"}`,
                          boxShadow: `${regShadow}, ${insetHi}`,
                          transition: "box-shadow .25s ease"
                        }}>
                          {/* top accent strip */}
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: gradAccent, opacity: 0.9, borderRadius: `${m ? 16 : 22}px ${m ? 16 : 22}px 0 0` }} />
                          {/* medal + rank pill */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: softBg, marginTop: 6, boxShadow: `0 0 0 2px ${haloWhite}` }}>
                            <span style={{ fontSize: m ? 11 : 13 }}>{medal}</span>
                            <span style={{ fontSize: m ? 10 : 12, fontWeight: 900, color: accent }}>#{pos}</span>
                          </div>
                          {/* avatar rings */}
                          <div style={{ position: "relative", width: m ? 48 : 62, height: m ? 48 : 62, margin: "9px auto 9px" }}>
                            <div style={{ width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: `linear-gradient(135deg,${accent},${dark ? cardBg : "#FFFFFF"})`, boxShadow: `0 0 0 4px ${softBg}, 0 6px 14px rgba(110,59,242,.18)` }}>
                              <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: innerAvatar, padding: 2 }}>
                                <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: lavenderBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {l.avatar?.trim() ? (
                                    <img src={l.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    <span style={{ fontSize: m ? 18 : 24, fontWeight: 800, color: accent }}>{(l.name || "U")[0]}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <h4 style={{ fontSize: m ? 10 : 12, fontWeight: 700, color: txt, margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</h4>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: softBg, fontSize: m ? 8 : 9, fontWeight: 700, color: accent, maxWidth: "100%" }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14l-5-4.87 6.91-1.01L12 2z" fill={accent}/></svg>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.rank}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Arrows + position progress bar (below the cards) */}
                {restLeaders.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: m ? 10 : 14, marginTop: m ? 10 : 16 }}>
                    <Arrow d={-1} on={() => nudge(-1)} enabled={canLeft} label="Scroll left" />
                    <div style={{ flex: 1, height: m ? 6 : 7, borderRadius: 99, background: "rgba(110,59,242,.12)", overflow: "hidden", position: "relative" }}>
                      <div style={{
                        position: "absolute", top: 0, left: 0, bottom: 0,
                        width: `${(((scrollIdx) / Math.max(1, restLeaders.length - 1)) * 100).toFixed(1)}%`,
                        minWidth: 16, borderRadius: 99,
                        background: `linear-gradient(90deg,${purple},${purpleLight})`,
                        boxShadow: "0 0 12px rgba(110,59,242,.4)",
                        transition: "width .25s ease"
                      }} />
                    </div>
                    <Arrow d={1} on={() => nudge(1)} enabled={canRight} label="Scroll right" />
                  </div>
                )}
              </div>
            )}

            {/* ===== KEEP GOING BANNER ===== */}
            <div style={{
              position: "relative", overflow: "hidden",
              marginTop: m ? 18 : 34, padding: m ? "16px 18px" : "22px 32px",
              borderRadius: m ? 18 : 24,
              background: keepGoingBg,
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(110,59,242,.18)", borderLeft: "5px solid #6E3BF2",
              boxShadow: "0 14px 38px rgba(110,59,242,.14), inset 0 1px 0 rgba(255,255,255,.95)",
              display: "flex", alignItems: "center", gap: m ? 12 : 20,
              animation: "leaderFadeUp 0.5s ease-out .15s both"
            }}>
              <svg style={{ position: "absolute", bottom: 0, right: 0, height: m ? 46 : 70, width: "auto", opacity: 0.1, pointerEvents: "none" }} viewBox="0 0 160 80" preserveAspectRatio="none">
                <polygon points="0,80 40,10 80,80" fill={purple} />
                <polygon points="40,80 90,20 140,80" fill={purpleMid} />
                <polygon points="110,80 140,40 160,80" fill={purpleLight} />
              </svg>
              <svg width={m ? 40 : 54} height={m ? 40 : 54} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
                <polygon points="8,44 28,8 48,44" fill="rgba(110,59,242,.12)" stroke={purple} strokeWidth="1.5" />
                <polygon points="20,44 34,18 48,44" fill="rgba(110,59,242,.06)" />
                <line x1="28" y1="8" x2="28" y2="4" stroke={purple} strokeWidth="1.5" />
                <polygon points="28,4 34,7 28,10" fill={purpleLight} opacity="0.7" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: m ? 15 : 18, fontWeight: 800, color: purple }}>{t("استمر في التسلق!","Keep Going!")}</h4>
                <p style={{ margin: "4px 0 0", fontSize: m ? 12 : 14, color: txtMuted, lineHeight: 1.5 }}>{t("الطريق طويل.. لكن القمة أقرب مما تتصور.","The road is long.. but the summit is closer than you think.")}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Animations ── */}
      <style>{`
        @keyframes leaderFadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes leaderGlow { 0%,100%{box-shadow:0 16px 44px rgba(110,59,242,.22)} 50%{box-shadow:0 16px 44px rgba(110,59,242,.4),0 0 70px rgba(110,59,242,.16)} }
        @keyframes crownFloat { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-4px)} }
        @keyframes leaderCardDrop { from { opacity:0; transform:translateY(14px) rotate(-1.5deg); } to { opacity:1; transform:translateY(0) rotate(0); } }
        @keyframes sparkPulse { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.85;transform:scale(1.3)} }
        @keyframes ringGlow { 0%,100%{opacity:.18} 50%{opacity:.5} }
        @keyframes heroHalo { 0%,100%{opacity:.7} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
        }
      `}</style>
    </section>
  );
}

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

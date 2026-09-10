import React, { useState, useEffect, useRef, useLayoutEffect } from "react";

/**
 * EVEREST LEADERS — futuristic mountain leaderboard carousel.
 * UI-only component. Consumes the existing /api/leaders data:
 * each leader = { id, name, rank, avatar, icon }.
 * Independent infinite carousel (autoplay + arrows + dots + swipe).
 */

const AUTOPLAY_MS = 3600;
const RESUME_MS = 5600;
const SWIPE_PX = 44;

/* deterministic star field so SSR/idempotent renders are stable */
const STARS = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 137.5) % 100,
  top: (i * 61.83) % 100,
  r: 1 + (i % 3),
  d: (i % 5) * 0.9 + (i % 3) * 0.4,
  o: 0.25 + (i % 4) * 0.14,
}));

const PALETTE = {
  navy: "#070B20",
  navySoft: "#0C1230",
  violet: "#7C3AED",
  violetBright: "#A78BFA",
  blue: "#4C6EF5",
  gold: "#FFD24D",
  txt: "#F2EFFF",
  txtMuted: "#A99BD6",
  glass: "rgba(22,16,58,0.60)",
  glassHi: "rgba(30,22,78,0.72)",
  border: "rgba(139,118,255,0.34)",
  borderHi: "rgba(167,139,250,0.75)",
};

const ArrowIcon = ({ dir: d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: d === 1 ? "none" : "rotate(180deg)" }}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LeadersSection({ leaders, m, dir, t }) {
  const rtl = dir === "rtl";
  const N = Math.min(leaders.length, 10);

  const innerRef = useRef(null);
  const resumeT = useRef(null);
  const dragX = useRef(null);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [W, setW] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (innerRef.current) setW(innerRef.current.clientWidth || 0);
    };
    measure();
    window.addEventListener("resize", measure);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      if (innerRef.current) ro.observe(innerRef.current);
    }
    return () => { window.removeEventListener("resize", measure); if (ro) ro.disconnect(); };
  }, [m, N]);

  useEffect(() => { setIdx(0); }, [N]);

  /* autoplay — pauses on interaction, resumes after idle */
  useEffect(() => {
    if (!N || N < 2 || paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % N), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [N, paused]);

  const pause = () => {
    setPaused(true);
    clearTimeout(resumeT.current);
    resumeT.current = setTimeout(() => setPaused(false), RESUME_MS);
  };
  useEffect(() => () => clearTimeout(resumeT.current), []);

  if (!N) {
    return (
      <section style={{ position: "relative", overflow: "hidden", padding: m ? "48px 16px 70px" : "80px 5% 84px", background: `linear-gradient(180deg,${PALETTE.navy} 0%,${PALETTE.navySoft} 60%,${PALETTE.navy} 100%)`, color: PALETTE.txt }}>
        <BgLayer m={m} />
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", paddingTop: 30 }}>
          <Badge m={m} />
          <Title m={m} />
          <p style={{ color: PALETTE.txtMuted, textAlign: "center", padding: 40, fontSize: 15 }}>{t("لا يوجد قادة بعد", "No leaders yet")}</p>
        </div>
      </section>
    );
  }

  /* 3 identical copies → seamless infinite wrap (never snaps) */
  const items = [...leaders.slice(0, 10), ...leaders.slice(0, 10), ...leaders.slice(0, 10)];
  const base = N;
  const pos = base + idx;

  const cw = m ? Math.max(150, Math.min(210, Math.round(W * 0.40))) : 176;
  const gap = m ? 14 : 18;
  const step = cw + gap;
  const Wsafe = W || 1000;

  /* center the active card; mirror the offset for RTL */
  const tx = rtl
    ? Math.round(Wsafe / 2 - (cw / 2 + pos * step))
    : Math.round(pos * step + cw / 2 - Wsafe / 2);

  const go = (dirN) => {
    pause();
    setIdx((i) => (i + dirN + N) % N);
  };
  const jump = (i) => { pause(); setIdx(i); };

  const onDown = (e) => { dragX.current = e.clientX; pause(); };
  const onUp = (e) => {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    go(rtl ? (dx > 0 ? 1 : -1) : (dx < 0 ? 1 : -1));
  };

  const rankLabel = (slot) => {
    const p = slot + 1;
    return { p, accent: p === 1 ? PALETTE.gold : p === 2 ? "#D7D7E8" : p === 3 ? "#E8A87C" : PALETTE.violetBright };
  };

  return (
    <section style={{ position: "relative", overflow: "hidden", padding: m ? "48px 12px 60px" : "78px 5% 72px", background: `linear-gradient(180deg,${PALETTE.navy} 0%,${PALETTE.navySoft} 55%,${PALETTE.navy} 100%)`, color: PALETTE.txt }}>
      <BgLayer m={m} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1120, margin: "auto" }}>
        {/* ══ HEADER ══ */}
        <div style={{ textAlign: "center", marginBottom: m ? 26 : 40 }}>
          <Badge m={m} />
          <Title m={m} />
          <p style={{ color: PALETTE.txtMuted, fontSize: m ? 13 : 15, maxWidth: 480, margin: "10px auto 0", lineHeight: 1.6 }}>
            {t("عقول مختلفة.. هدف واحد. كن التالي.", "Different minds. Same goal. Be the next one.")}
          </p>
        </div>

        {/* ══ CAROUSEL ══ */}
        <div style={{ position: "relative", padding: m ? "0 34px" : "0 58px" }}>
          {/* side nav */}
          <button aria-label="Previous leader" onClick={() => go(-1)} style={prevBtnStyle(m, rtl)}>
            <ArrowIcon dir={-1} />
          </button>

          <div ref={innerRef} style={{ overflow: "hidden", padding: m ? "18px 6px 26px" : "26px 6px 34px", touchAction: "pan-y", cursor: "grab", userSelect: "none" }}
            onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (dragX.current = null)}>
            <div style={{
              display: "flex", flexWrap: "nowrap", gap,
              transform: `translateX(${tx}px)`,
              transition: W ? "transform 0.65s cubic-bezier(.22,.61,.36,1)" : "none",
              willChange: "transform", width: "max-content",
            }}>
              {items.map((ld, k) => {
                const slot = k % N;
                const isActive = slot === idx;
                const d = Math.abs(k - pos);
                const vis = d <= 1 ? 1 : d === 2 ? 0.62 : d >= 3 ? 0 : 0.85;
                const scale = isActive ? 1 : d === 1 ? 0.9 : d === 2 ? 0.82 : 0.7;
                const { p, accent } = rankLabel(slot);
                return (
                  <LeaderCard
                    key={`${ld.id}-${k}`}
                    leader={ld} pos={p} accent={accent} m={m} cw={cw}
                    active={isActive} scale={scale} opacity={vis}
                    gold={p === 1}
                  />
                );
              })}
            </div>
          </div>

          <button aria-label="Next leader" onClick={() => go(1)} style={nextBtnStyle(m, rtl)}>
            <ArrowIcon dir={1} />
          </button>
        </div>

        {/* ══ DOTS ══ */}
        <div style={{ display: "flex", justifyContent: "center", gap: m ? 7 : 9, marginTop: m ? 6 : 12 }}>
          {leaders.slice(0, 10).map((_, i) => (
            <button key={i} aria-label={`Go to leader ${i + 1}`} onClick={() => jump(i)} style={{
              width: i === idx ? (m ? 26 : 30) : m ? 8 : 9,
              height: m ? 8 : 9, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
              background: i === idx ? "linear-gradient(90deg,#7C3AED,#A78BFA)" : "rgba(167,139,250,0.30)",
              boxShadow: i === idx ? "0 0 14px rgba(167,139,250,0.75)" : "none",
              transition: "all .3s ease",
            }} />
          ))}
        </div>

        {/* ══ KEEP GOING BANNER (unchanged behavior, restyled) ══ */}
        <div style={{
          position: "relative", overflow: "hidden",
          marginTop: m ? 26 : 40, padding: m ? "16px 18px" : "22px 32px",
          borderRadius: m ? 18 : 24,
          background: "linear-gradient(120deg,rgba(27,20,58,.94) 0%,rgba(22,16,48,.85) 100%)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(167,139,250,.28)", borderLeft: "5px solid #7C3AED",
          boxShadow: "0 14px 38px rgba(14,10,40,.5), inset 0 1px 0 rgba(255,255,255,.08)",
          display: "flex", alignItems: "center", gap: m ? 12 : 20,
        }}>
          <svg style={{ position: "absolute", bottom: 0, right: 0, height: m ? 46 : 70, width: "auto", opacity: 0.16, pointerEvents: "none" }} viewBox="0 0 160 80" preserveAspectRatio="none">
            <polygon points="0,80 40,10 80,80" fill={PALETTE.violet} />
            <polygon points="40,80 90,20 140,80" fill="#8B5CF6" />
            <polygon points="110,80 140,40 160,80" fill={PALETTE.violetBright} />
          </svg>
          <svg width={m ? 40 : 54} height={m ? 40 : 54} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
            <polygon points="8,44 28,8 48,44" fill="rgba(124,58,237,.14)" stroke={PALETTE.violetBright} strokeWidth="1.5" />
            <polygon points="20,44 34,18 48,44" fill="rgba(124,58,237,.07)" />
            <line x1="28" y1="8" x2="28" y2="4" stroke={PALETTE.violetBright} strokeWidth="1.5" />
            <polygon points="28,4 34,7 28,10" fill={PALETTE.violetBright} opacity="0.7" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: m ? 15 : 18, fontWeight: 800, color: PALETTE.violetBright }}>{t("استمر في التسلق!", "Keep Going!")}</h4>
            <p style={{ margin: "4px 0 0", fontSize: m ? 12 : 14, color: PALETTE.txtMuted, lineHeight: 1.5 }}>{t("الطريق طويل.. لكن القمة أقرب مما تتصور.", "The road is long.. but the summit is closer than you think.")}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lgTwinkle { 0%,100%{opacity:.12;transform:scale(.8)} 50%{opacity:var(--o);transform:scale(1.15)} }
        @keyframes lgFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes lgAurora { 0%,100%{opacity:.55;transform:translate(0,0) scale(1)} 50%{opacity:.9;transform:translate(20px,-16px) scale(1.06)} }
        @keyframes lgBadgePulse { 0%,100%{box-shadow:0 0 12px rgba(167,139,250,.25)} 50%{box-shadow:0 0 26px rgba(124,58,237,.6)} }
        @keyframes lgActiveGlow { 0%,100%{box-shadow:0 0 0 1px ${PALETTE.borderHi} inset,0 18px 46px rgba(124,58,237,.42),0 0 34px rgba(124,58,237,.28)} 50%{box-shadow:0 0 0 1px ${PALETTE.borderHi} inset,0 18px 52px rgba(124,58,237,.6),0 0 54px rgba(124,58,237,.42)} }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
        }
      `}</style>
    </section>
  );
}

/* ── sub-components ───────────────────────────────────────────── */

function Badge({ m }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: m ? "7px 18px" : "9px 24px",
      borderRadius: 999, background: "rgba(167,139,250,.10)",
      border: "1px solid rgba(139,118,255,.55)",
      boxShadow: "0 0 18px rgba(124,58,237,.35), inset 0 1px 0 rgba(255,255,255,.10)",
      animation: "lgBadgePulse 4s ease-in-out infinite",
      fontSize: m ? 11 : 13, fontWeight: 800, letterSpacing: 3, color: "#D9CFFF",
    }}>
      <span style={{ fontSize: m ? 13 : 15 }}>👑</span> TOP 10
    </div>
  );
}

function Title({ m }) {
  return (
    <h2 style={{
      fontSize: m ? "2.1rem" : "clamp(2.6rem,6vw,4.2rem)",
      fontWeight: 900, margin: m ? "14px 0 0" : "18px 0 0", lineHeight: 1.05, letterSpacing: 2,
      color: "#F7F4FF",
      textShadow: "0 0 24px rgba(124,58,237,.55), 0 0 60px rgba(76,110,245,.35)",
    }}>
      EVEREST <span style={{ background: "linear-gradient(90deg,#B98CFF,#7C3AED 55%,#4C6EF5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>LEADERS</span>
    </h2>
  );
}

function BgLayer({ m }) {
  return (
    <>
      {/* base radial ambient glows */}
      <div style={{ position: "absolute", top: m ? -90 : -140, left: "50%", transform: "translateX(-50%)", width: m ? 520 : 780, height: m ? 380 : 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(76,110,245,.22) 0%,rgba(124,58,237,.12) 40%,transparent 70%)", filter: "blur(60px)", pointerEvents: "none", animation: "lgAurora 9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: m ? 220 : 300, left: m ? -80 : -140, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,.16) 0%,transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: m ? 300 : 380, right: m ? -60 : -120, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(76,110,245,.14) 0%,transparent 70%)", filter: "blur(55px)", pointerEvents: "none" }} />

      {/* stars */}
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.left}%`, top: `${s.top}%`, width: s.r * 2, height: s.r * 2,
          borderRadius: "50%", background: i % 3 === 0 ? "#B98CFF" : i % 3 === 1 ? "#9DB4FF" : "#EEE8FF",
          pointerEvents: "none", animation: `lgTwinkle 4.5s ease-in-out ${s.d}s infinite`,
        }} />
      ))}

      {/* floating light particles */}
      <div style={{ position: "absolute", left: "12%", top: m ? 130 : 180, width: 7, height: 7, borderRadius: "50%", background: "#B98CFF", filter: "blur(1px)", opacity: 0.7, animation: "lgFloat 7s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: "16%", top: m ? 300 : 360, width: 6, height: 6, borderRadius: "50%", background: "#4C6EF5", filter: "blur(1px)", opacity: 0.6, animation: "lgFloat 8s ease-in-out 1.2s infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "24%", top: m ? 520 : 620, width: 5, height: 5, borderRadius: "50%", background: "#A78BFA", filter: "blur(1px)", opacity: 0.55, animation: "lgFloat 9s ease-in-out 2.1s infinite", pointerEvents: "none" }} />

      {/* layered snowy mountains */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 220 : 380, opacity: 0.30, pointerEvents: "none" }} viewBox="0 0 1440 400" preserveAspectRatio="none">
        <polygon points="-20,400 240,120 500,400" fill="#141B4A" />
        <polygon points="360,400 640,60 920,400" fill="#121741" />
        <polygon points="760,400 1050,100 1340,400" fill="#141B4A" />
        <polygon points="1180,400 1400,140 1460,400" fill="#121741" />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 170 : 300, opacity: 0.42, pointerEvents: "none" }} viewBox="0 0 1440 300" preserveAspectRatio="none">
        <polygon points="-20,300 260,60 540,300" fill="#1B2358" />
        <polygon points="420,300 720,30 1000,300" fill="#191F52" />
        <polygon points="820,300 1110,70 1400,300" fill="#1B2358" />
        <polygon points="1180,300 1390,110 1460,300" fill="#191F52" />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 120 : 210, opacity: 0.55, pointerEvents: "none" }} viewBox="0 0 1440 210" preserveAspectRatio="none">
        <polygon points="-20,210 200,70 420,210" fill="#232C6B" />
        <polygon points="330,210 560,20 790,210" fill="#222A66" />
        <polygon points="700,210 930,60 1160,210" fill="#232C6B" />
        <polygon points="1060,210 1280,40 1460,210" fill="#222A66" />
      </svg>
      {/* snow caps (light peaks on near layer) */}
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 120 : 210, opacity: 0.9, pointerEvents: "none" }} viewBox="0 0 1440 210" preserveAspectRatio="none">
        <polygon points="530,26 553,26 546,62 545,36 542,58 538,30" fill="#E7E4FF" />
        <polygon points="904,62 888,62 872,62 910,34 906,44 899,56 891,60 878,64 882,58 902,48" fill="#E7E4FF" opacity="0.85" />
        <polygon points="1147,118 1138,118 1124,120 1160,58 1168,50 1172,84 1164,44 1152,94 1140,104 1130,112 1120,114" fill="#E7E4FF" opacity="0.7" />
        <polygon points="150,130 138,132 130,136 166,80 172,90 168,84 158,100 148,120 144,128 136,132" fill="#E7E4FF" opacity="0.7" />
      </svg>
    </>
  );
}

function LeaderCard({ leader, pos, accent, m, cw, gap, active, scale, opacity, gold }) {
  const c = PALETTE;
  return (
    <div style={{
      flex: `0 0 ${cw}px`, transform: `scale(${scale})`, opacity,
      transition: "transform .55s cubic-bezier(.22,.61,.36,1), opacity .45s ease",
      filter: active ? "brightness(1.06)" : "none",
    }}>
      <div style={{
        position: "relative", height: m ? 226 : 264, borderRadius: m ? 20 : 26,
        overflow: "hidden", textAlign: "center",
        background: active ? c.glassHi : c.glass,
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: active ? `1.5px solid ${c.borderHi}` : `1px solid ${c.border}`,
        animation: active ? "lgActiveGlow 3.2s ease-in-out infinite" : "none",
        boxShadow: active ? "none" : "0 14px 34px rgba(10,8,30,.45), inset 0 1px 0 rgba(255,255,255,.08)",
      }}>
        {/* top tint bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: active ? `linear-gradient(90deg,transparent,${c.violetBright},transparent)` : "linear-gradient(90deg,transparent,rgba(167,139,250,.35),transparent)" }} />

        {/* rank number */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14,
          padding: "3px 12px", borderRadius: 999,
          background: gold ? "rgba(255,210,77,.14)" : "rgba(124,58,237,.16)",
          border: gold ? "1px solid rgba(255,210,77,.45)" : "1px solid rgba(139,118,255,.4)",
          fontSize: m ? 12 : 13, fontWeight: 900, color: accent, letterSpacing: 1,
        }}>
          {gold ? "👑" : pos} <span style={{ opacity: 0.75, fontWeight: 800 }}>#{pos}</span>
        </span>

        {/* avatar */}
        <div style={{ position: "relative", width: m ? 72 : 84, height: m ? 72 : 84, margin: "12px auto 10px" }}>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: `radial-gradient(circle,${accent}55 0%,transparent 70%)`, filter: "blur(4px)" }} />
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: active ? `linear-gradient(135deg,${c.violetBright},${c.blue})` : "linear-gradient(135deg,rgba(167,139,250,.55),rgba(76,110,245,.35))" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#12163A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {leader.avatar?.trim() ? (
                <img src={leader.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: m ? 30 : 36, fontWeight: 900, color: accent }}>{(leader.name || "U")[0]}</span>
              )}
            </div>
          </div>
          {/* mini summit marker */}
          <svg viewBox="0 0 24 24" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -6, width: 18, height: 18, opacity: active ? 1 : 0.55 }}>
            <polygon points="2,22 9,4 16,22" fill={accent} opacity="0.25" />
            <polygon points="9,4 10,4 13,22 9,22" fill={accent} opacity="0.5" />
            <polygon points="12,2 14,22 10,22" fill={accent} />
          </svg>
        </div>

        {/* name */}
        <h4 style={{
          margin: "6px 12px 8px", fontSize: m ? 13 : 15, fontWeight: 800, color: "#F5F2FF",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{leader.name}</h4>

        {/* rank/points badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "82%", padding: "3px 10px", borderRadius: 999, background: "rgba(124,58,237,.14)", border: "1px solid rgba(139,118,255,.3)", fontSize: m ? 9 : 10, fontWeight: 700, color: active ? c.violetBright : c.txtMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span>{leader.icon || "🏆"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leader.rank || "—"}</span>
        </div>

        {/* ground glow under active card */}
        {active && (
          <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", width: "80%", height: 22, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(124,58,237,.45) 0%,transparent 70%)", filter: "blur(6px)" }} />
        )}
      </div>
    </div>
  );
}

const baseBtn = (m, left) => ({
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  width: m ? 32 : 42, height: m ? 32 : 42, borderRadius: "50%", border: "1px solid rgba(167,139,250,.5)",
  background: "rgba(26,20,64,.7)", color: "#D9CFFF", cursor: "pointer", zIndex: 5,
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 6px 20px rgba(10,8,30,.5), 0 0 16px rgba(124,58,237,.35)",
  transition: "transform .2s ease, box-shadow .2s ease, background .2s ease",
  [left ? "left" : "right"]: 0,
});

/* hover behavior applied via style string (static rule below) */
const prevBtnStyle = (m, rtl) => baseBtn(m, true);
const nextBtnStyle = (m, rtl) => baseBtn(m, false);
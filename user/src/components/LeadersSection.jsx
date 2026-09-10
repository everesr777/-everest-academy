import React, { useState, useEffect, useRef, useLayoutEffect } from "react";

/**
 * EVEREST LEADERS — futuristic mountain top-10 carousel.
 * UI-only component. Consumes the existing /api/leaders data:
 * each leader = { id, name, rank, avatar, icon }.
 * Adapts to light/dark theme. TRUE INFINITE LOOP via 3 cloned copies +
 * silent re-center; centering measured from the DOM (offsetLeft).
 */

const AUTOPLAY_MS = 3500;
const RESUME_MS = 6000;
const SWIPE_PX = 48;
const TRANS_MS = 620;
const TRANSITION = `transform ${TRANS_MS}ms cubic-bezier(.22,.61,.36,1)`;

const STARS = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 137.5) % 100,
  top: (i * 61.83) % 100,
  r: 1 + (i % 3),
  d: (i % 5) * 0.9 + (i % 3) * 0.4,
}));

const DARK = {
  bg: "linear-gradient(180deg,#070B20 0%,#0C1230 55%,#070B20 100%)",
  title: "#F7F4FF",
  titleGlow: "0 0 24px rgba(124,58,237,.55), 0 0 60px rgba(76,110,245,.35)",
  txt: "#F2EFFF",
  txtMuted: "#A99BD6",
  violet: "#7C3AED",
  violetBright: "#A78BFA",
  blue: "#4C6EF5",
  gold: "#FFD24D",
  glass: "rgba(22,16,58,0.60)",
  glassHi: "rgba(30,22,78,0.72)",
  border: "rgba(139,118,255,0.34)",
  borderHi: "rgba(167,139,250,0.75)",
  cardShadow: "0 12px 30px rgba(10,8,30,.45), inset 0 1px 0 rgba(255,255,255,.08)",
  name: "#F5F2FF",
  nameInactive: "#E9E4FF",
  badge: "#E9E4FF",
  dot: "rgba(167,139,250,0.30)",
  badgeBg: "rgba(124,58,237,.10)",
  badgeBorder: "rgba(139,118,255,.55)",
  badgeTxt: "#D9CFFF",
  bannerBg: "linear-gradient(120deg,rgba(27,20,58,.94) 0%,rgba(22,16,48,.85) 100%)",
  bannerBorder: "rgba(167,139,250,.28)",
  btnBg: "rgba(26,20,64,.72)",
  btnColor: "#C9C0F5",
  btnBorder: "rgba(167,139,250,.45)",
  glowShadow: "0 0 0 1px rgba(167,139,250,.75) inset,0 16px 40px rgba(124,58,237,.4),0 0 28px rgba(124,58,237,.26)",
  glowShadowHi: "0 0 0 1px rgba(167,139,250,.75) inset,0 16px 46px rgba(124,58,237,.55),0 0 44px rgba(124,58,237,.38)",
  star: ["#B98CFF", "#9DB4FF", "#EEE8FF"],
  mtn: ["#141B4A", "#121741", "#1B2358", "#191F52", "#232C6B", "#222A66"],
};

const LIGHT = {
  bg: "linear-gradient(180deg,#F4F0FD 0%,#EAE4F9 55%,#F4F0FD 100%)",
  title: "#241B4A",
  titleGlow: "0 0 20px rgba(124,58,237,.28)",
  txt: "#241B4A",
  txtMuted: "#6E6399",
  violet: "#7C3AED",
  violetBright: "#8B5CF6",
  blue: "#4C6EF5",
  gold: "#F59E0B",
  glass: "rgba(255,255,255,0.70)",
  glassHi: "rgba(255,255,255,0.94)",
  border: "rgba(124,58,237,0.22)",
  borderHi: "rgba(124,58,237,0.55)",
  cardShadow: "0 10px 26px rgba(78,60,148,.16), inset 0 1px 0 rgba(255,255,255,.9)",
  name: "#22183F",
  nameInactive: "#4A3F78",
  badge: "#6D28D9",
  dot: "rgba(124,58,237,0.35)",
  badgeBg: "rgba(124,58,237,.08)",
  badgeBorder: "rgba(124,58,237,.45)",
  badgeTxt: "#6D28D9",
  bannerBg: "linear-gradient(120deg,rgba(255,255,255,.94) 0%,rgba(246,242,255,.9) 100%)",
  bannerBorder: "rgba(124,58,237,.28)",
  btnBg: "rgba(255,255,255,.85)",
  btnColor: "#6D28D9",
  btnBorder: "rgba(124,58,237,.45)",
  glowShadow: "0 0 0 1px rgba(124,58,237,.45) inset,0 12px 28px rgba(124,58,237,.18),0 0 18px rgba(124,58,237,.13)",
  glowShadowHi: "0 0 0 1px rgba(124,58,237,.6) inset,0 14px 32px rgba(124,58,237,.26),0 0 26px rgba(124,58,237,.2)",
  star: ["#8B5CF6", "#6D28D9", "#A78BFA"],
  mtn: ["#D9D2F0", "#CFC6EA", "#C2B8E2", "#B9AEDA", "#AB9ED2", "#A295CA"],
};

const ArrowIcon = ({ dir: d }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: d === 1 ? "none" : "rotate(180deg)" }}>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const readTx = (el) => {
  try {
    const s = getComputedStyle(el).transform;
    if (!s || s === "none") return 0;
    return new DOMMatrixReadOnly(s).m41 || 0;
  } catch {
    return 0;
  }
};

export default function LeadersSection({ leaders, m, theme, t }) {
  const dark = theme !== "light";
  const p = dark ? DARK : LIGHT;
  const N = Math.min(leaders.length, 10);
  const base = Math.max(N, 1);

  const innerRef = useRef(null);
  const trackRef = useRef(null);
  const resumeT = useRef(null);
  const suppress = useRef(true);
  const drag = useRef(null);
  const raf = useRef(null);

  const [pos, setPos] = useState(base);
  const [W, setW] = useState(0);
  const [paused, setPaused] = useState(false);
  const [rev, setRev] = useState(0);

  /* measure the viewport (retry until laid out) */
  useLayoutEffect(() => {
    const measure = () => {
      if (!innerRef.current) { raf.current = requestAnimationFrame(measure); return; }
      const w = innerRef.current.clientWidth || 0;
      if (w) setW(w);
      else raf.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", measure);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      if (innerRef.current) ro.observe(innerRef.current);
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [m, N]);

  useEffect(() => { setPos(base); }, [base]);

  /* center the active card — DOM-measured → exact in LTR/RTL/mobile/desktop */
  useLayoutEffect(() => {
    const track = trackRef.current;
    const inner = innerRef.current;
    if (!track || !inner) return;
    const w = inner.clientWidth;
    if (!w) return;
    const safePos = Math.max(0, Math.min(track.children.length - 1, pos));
    const el = track.children[safePos];
    if (!el) return;
    const tx = Math.round(w / 2 - (el.offsetLeft + el.offsetWidth / 2));
    track.style.transition = suppress.current ? "none" : TRANSITION;
    suppress.current = false;
    track.style.transform = `translateX(${tx}px)`;
  }, [pos, W, rev, N]);

  /* silent re-center onto an identical copy after the wrap animation lands */
  useEffect(() => {
    if (!N || N < 2) return;
    if (pos >= base * 2) {
      const id = setTimeout(() => {
        suppress.current = true;
        setPos((pp) => (pp >= base * 2 ? pp - base : pp + base));
      }, TRANS_MS + 20);
      return () => clearTimeout(id);
    }
    if (pos < base) {
      const id = setTimeout(() => {
        suppress.current = true;
        setPos((pp) => (pp < base ? pp + base : pp - base));
      }, TRANS_MS + 20);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [pos, base, N]);

  useEffect(() => {
    if (!N || N < 2 || paused) return;
    const id = setInterval(() => setPos((pp) => pp + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [N, paused]);

  const pause = () => {
    setPaused(true);
    clearTimeout(resumeT.current);
    resumeT.current = setTimeout(() => setPaused(false), RESUME_MS);
  };
  useEffect(() => () => clearTimeout(resumeT.current), []);

  const go = (dirN) => { pause(); setPos((pp) => pp + dirN); };

  const onDown = (e) => {
    const track = trackRef.current;
    if (!track) return;
    try { track.setPointerCapture(e.pointerId); } catch { /* noop */ }
    drag.current = { startX: e.clientX, startTx: readTx(track), moved: false };
    pause();
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) < 4) return;
    drag.current.moved = true;
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = "none";
    track.style.transform = `translateX(${drag.current.startTx + dx}px)`;
  };
  const onUp = () => {
    if (!drag.current) return;
    const moved = drag.current.moved;
    if (moved) {
      const travelled = readTx(trackRef.current) - drag.current.startTx;
      drag.current = null;
      if (Math.abs(travelled) >= SWIPE_PX) setPos((pp) => pp + (travelled > 0 ? -1 : 1));
      else setRev((r) => r + 1);
    } else {
      drag.current = null;
    }
  };
  const onCancel = () => { drag.current = null; setRev((r) => r + 1); };

  if (!N) {
    return (
      <section style={{ position: "relative", overflow: "hidden", padding: m ? "46px 16px 64px" : "80px 5% 84px", background: p.bg, color: p.txt }}>
        <BgLayer m={m} p={p} />
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", paddingTop: 30 }}>
          <Badge m={m} p={p} />
          <Title m={m} p={p} />
          <p style={{ color: p.txtMuted, textAlign: "center", padding: 40, fontSize: 15 }}>{t("لا يوجد قادة بعد", "No leaders yet")}</p>
        </div>
      </section>
    );
  }

  const items = [...leaders.slice(0, 10), ...leaders.slice(0, 10), ...leaders.slice(0, 10)];
  const activeSlot = ((pos % N) + N) % N;

  const gap = m ? 12 : 18;
  const cw = m
    ? Math.round(Math.max(118, Math.min(176, W * 0.46)))
    : Math.round(Math.max(168, Math.min(212, W / 5.8)));

  const rankAccent = (slot) => {
    const p = slot + 1;
    return p === 1 ? DARK.gold : p === 2 ? (dark ? "#D7D7E8" : "#8E8EA8") : p === 3 ? (dark ? "#E8A87C" : "#C7793B") : p.violetBright;
  };

  return (
    <section style={{
      position: "relative", overflow: "hidden",
      padding: m ? "40px 10px 46px" : "72px 5% 66px",
      background: p.bg, color: p.txt,
      "--lgShadow": p.glowShadow, "--lgShadowHi": p.glowShadowHi,
    }}>
      <BgLayer m={m} p={p} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1120, margin: "auto" }}>
        {/* ══ HEADER ══ */}
        <div style={{ textAlign: "center", marginBottom: m ? 18 : 34 }}>
          <Badge m={m} p={p} />
          <Title m={m} p={p} />
          <p style={{ color: p.txtMuted, fontSize: m ? 12.5 : 15, maxWidth: 480, margin: "8px auto 0", lineHeight: 1.6 }}>
            {t("عقول مختلفة.. هدف واحد. كن التالي.", "Different minds. Same goal. Be the next one.")}
          </p>
        </div>

        {/* ══ CAROUSEL ══ */}
        <div style={{ position: "relative", padding: m ? "0 30px" : "0 54px" }}>
          {N > 1 && (
            <>
              <button aria-label="Previous leader" onClick={() => go(-1)} style={btnStyle(m, p, true)}><ArrowIcon dir={-1} /></button>
              <button aria-label="Next leader" onClick={() => go(1)} style={btnStyle(m, p, false)}><ArrowIcon dir={1} /></button>
            </>
          )}

          <div
            ref={innerRef}
            style={{
              position: "relative", overflow: "hidden",
              padding: m ? "20px 0 24px" : "26px 0 30px",
              touchAction: "pan-y", cursor: "grab", userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
          >
            <div
              ref={trackRef}
              style={{
                display: "flex", flexWrap: "nowrap", gap,
                width: "max-content", willChange: "transform",
                transform: "translateX(0)",
              }}
            >
              {items.map((ld, k) => {
                const slot = k % N;
                const isActive = slot === activeSlot;
                const dist = Math.abs(k - pos);
                const vis = dist <= 1 ? 1 : dist === 2 ? 0.72 : dist >= 3 ? 0 : 0.85;
                const scale = isActive ? 1.05 : dist === 1 ? 0.88 : 0.78;
                const accent = rankAccent(slot);
                return (
                  <LeaderCard
                    key={`${ld.id}-${k}`}
                    leader={ld} accent={accent} m={m} dark={dark}
                    cw={cw} active={isActive} scale={scale} opacity={vis}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ COMPACT DOTS ══ */}
        {N > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: m ? 4 : 6, marginTop: m ? 0 : 10, height: m ? 8 : 14, fontSize: 0, lineHeight: 0, WebkitTapHighlightColor: "transparent" }}>
            {leaders.slice(0, 10).map((_, i) => (
              <button
                key={i}
                className="lg-dot"
                aria-label={`Go to leader ${i + 1}`}
                onClick={() => { pause(); setPos(base + i); }}
                style={{
                  height: m || W <= 420 ? 4 : 6,
                  width: i === activeSlot ? (m || W <= 420 ? 12 : 18) : m || W <= 420 ? 4 : 6,
                  borderRadius: 99, border: "none", cursor: "pointer", padding: 0, outline: "none",
                  background: i === activeSlot ? "linear-gradient(90deg,#7C3AED,#8B5CF6)" : p.dot,
                  boxShadow: i === activeSlot ? "0 0 6px rgba(124,58,237,0.55)" : "none",
                  transition: "all .3s ease",
                }}
              />
            ))}
          </div>
        )}

        {/* ══ KEEP GOING BANNER ══ */}
        <div style={{
          position: "relative", overflow: "hidden",
          marginTop: m ? 20 : 34, padding: m ? "14px 16px" : "20px 30px",
          borderRadius: m ? 16 : 22,
          background: p.bannerBg,
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${p.bannerBorder}`, borderLeft: `5px solid ${p.violet}`,
          boxShadow: "0 14px 38px rgba(70,50,130,.16), inset 0 1px 0 rgba(255,255,255,.08)",
          display: "flex", alignItems: "center", gap: m ? 12 : 20,
        }}>
          <svg style={{ position: "absolute", bottom: 0, right: 0, height: m ? 44 : 70, width: "auto", opacity: 0.16, pointerEvents: "none" }} viewBox="0 0 160 80" preserveAspectRatio="none">
            <polygon points="0,80 40,10 80,80" fill={p.violet} />
            <polygon points="40,80 90,20 140,80" fill="#8B5CF6" />
            <polygon points="110,80 140,40 160,80" fill={p.violetBright} />
          </svg>
          <svg width={m ? 38 : 52} height={m ? 38 : 52} viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
            <polygon points="8,44 28,8 48,44" fill="rgba(124,58,237,.14)" stroke={p.violetBright} strokeWidth="1.5" />
            <polygon points="20,44 34,18 48,44" fill="rgba(124,58,237,.07)" />
            <line x1="28" y1="8" x2="28" y2="4" stroke={p.violetBright} strokeWidth="1.5" />
            <polygon points="28,4 34,7 28,10" fill={p.violetBright} opacity="0.7" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: m ? 14.5 : 18, fontWeight: 800, color: p.violetBright }}>{t("استمر في التسلق!", "Keep Going!")}</h4>
            <p style={{ margin: "3px 0 0", fontSize: m ? 11.5 : 14, color: p.txtMuted, lineHeight: 1.5 }}>{t("الطريق طويل.. لكن القمة أقرب مما تتصور.", "The road is long.. but the summit is closer than you think.")}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lgTwinkle { 0%,100%{opacity:.1;transform:scale(.8)} 50%{opacity:.5;transform:scale(1.15)} }
        @keyframes lgFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes lgAurora { 0%,100%{opacity:.4;transform:translate(0,0) scale(1)} 50%{opacity:.75;transform:translate(20px,-16px) scale(1.06)} }
        @keyframes lgBadgePulse { 0%,100%{box-shadow:0 0 10px ${dark ? "rgba(167,139,250,.22)" : "rgba(124,58,237,.15)"}} 50%{box-shadow:0 0 20px ${dark ? "rgba(124,58,237,.5)" : "rgba(124,58,237,.3)"}} }
        @keyframes lgGlowA { 0%,100%{box-shadow:var(--lgShadow)} 50%{box-shadow:var(--lgShadowHi)} }
        .lg-dot{appearance:none;-webkit-appearance:none;border:none !important;box-sizing:border-box;margin:0 !important;min-width:0;min-height:0;line-height:0;overflow:hidden}
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
        }
      `}</style>
    </section>
  );
}

/* ── sub-components ───────────────────────────────────────────── */

function Badge({ m, p }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: m ? "6px 16px" : "8px 22px",
      borderRadius: 999, background: p.badgeBg,
      border: `1px solid ${p.badgeBorder}`,
      boxShadow: "0 0 16px rgba(124,58,237,.18), inset 0 1px 0 rgba(255,255,255,.10)",
      animation: "lgBadgePulse 4s ease-in-out infinite",
      fontSize: m ? 10.5 : 13, fontWeight: 800, letterSpacing: 3, color: p.badgeTxt,
    }}>
      <span style={{ fontSize: m ? 12 : 15 }}>👑</span> TOP 10
    </div>
  );
}

function Title({ m, p }) {
  return (
    <h2 style={{
      fontSize: m ? "1.9rem" : "clamp(2.6rem,6vw,4.2rem)",
      fontWeight: 900, margin: m ? "12px 0 0" : "18px 0 0", lineHeight: 1.05, letterSpacing: 2,
      color: p.title, textShadow: p.titleGlow,
    }}>
      EVEREST <span style={{ background: "linear-gradient(90deg,#8B5CF6,#6D28D9 55%,#4C6EF5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>LEADERS</span>
    </h2>
  );
}

function BgLayer({ m, p }) {
  const dark = p === DARK;
  const mtn = p.mtn;
  const starsCol = p.star;
  return (
    <>
      <div style={{ position: "absolute", top: m ? -90 : -140, left: "50%", transform: "translateX(-50%)", width: m ? 520 : 780, height: m ? 380 : 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(76,110,245,.18) 0%,rgba(124,58,237,.12) 40%,transparent 70%)", filter: "blur(60px)", pointerEvents: "none", animation: "lgAurora 9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: m ? 200 : 300, left: m ? -80 : -140, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,.14) 0%,transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: m ? 280 : 380, right: m ? -60 : -120, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(76,110,245,.12) 0%,transparent 70%)", filter: "blur(55px)", pointerEvents: "none" }} />

      {STARS.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.left}%`, top: `${s.top}%`, width: s.r * 2, height: s.r * 2,
          borderRadius: "50%", background: starsCol[i % 3],
          opacity: dark ? undefined : 0.55,
          pointerEvents: "none", animation: `lgTwinkle 4.5s ease-in-out ${s.d}s infinite`,
        }} />
      ))}

      <div style={{ position: "absolute", left: "12%", top: m ? 130 : 180, width: 7, height: 7, borderRadius: "50%", background: starsCol[0], filter: "blur(1px)", opacity: dark ? 0.7 : 0.5, animation: "lgFloat 7s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: "16%", top: m ? 280 : 360, width: 6, height: 6, borderRadius: "50%", background: p.blue, filter: "blur(1px)", opacity: dark ? 0.6 : 0.45, animation: "lgFloat 8s ease-in-out 1.2s infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "24%", top: m ? 480 : 620, width: 5, height: 5, borderRadius: "50%", background: p.violetBright, filter: "blur(1px)", opacity: dark ? 0.55 : 0.4, animation: "lgFloat 9s ease-in-out 2.1s infinite", pointerEvents: "none" }} />

      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 190 : 330, opacity: dark ? 0.30 : 0.55, pointerEvents: "none" }} viewBox="0 0 1440 400" preserveAspectRatio="none">
        <polygon points="-20,400 240,120 500,400" fill={mtn[0]} />
        <polygon points="360,400 640,60 920,400" fill={mtn[1]} />
        <polygon points="760,400 1050,100 1340,400" fill={mtn[0]} />
        <polygon points="1180,400 1400,140 1460,400" fill={mtn[1]} />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 145 : 250, opacity: dark ? 0.42 : 0.6, pointerEvents: "none" }} viewBox="0 0 1440 300" preserveAspectRatio="none">
        <polygon points="-20,300 260,60 540,300" fill={mtn[2]} />
        <polygon points="420,300 720,30 1000,300" fill={mtn[3]} />
        <polygon points="820,300 1110,70 1400,300" fill={mtn[2]} />
        <polygon points="1180,300 1390,110 1460,300" fill={mtn[3]} />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 100 : 190, opacity: dark ? 0.55 : 0.7, pointerEvents: "none" }} viewBox="0 0 1440 210" preserveAspectRatio="none">
        <polygon points="-20,210 200,70 420,210" fill={mtn[4]} />
        <polygon points="330,210 560,20 790,210" fill={mtn[5]} />
        <polygon points="700,210 930,60 1160,210" fill={mtn[4]} />
        <polygon points="1060,210 1280,40 1460,210" fill={mtn[5]} />
      </svg>
      <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: m ? 100 : 190, opacity: dark ? 0.9 : 0.95, pointerEvents: "none" }} viewBox="0 0 1440 210" preserveAspectRatio="none">
        <polygon points="530,26 553,26 546,62 545,36 542,58 538,30" fill={dark ? "#E7E4FF" : "#FFFFFF"} />
        <polygon points="872,62 910,34 906,44 899,56 891,60 878,64" fill={dark ? "#E7E4FF" : "#FFFFFF"} opacity="0.85" />
        <polygon points="1140,104 1160,58 1168,50 1172,84 1164,44 1152,94" fill={dark ? "#E7E4FF" : "#FFFFFF"} opacity="0.7" />
        <polygon points="140,120 166,80 172,90 168,84 158,100" fill={dark ? "#E7E4FF" : "#FFFFFF"} opacity="0.7" />
      </svg>
    </>
  );
}

function LeaderCard({ leader, accent, m, cw, active, scale, opacity, dark }) {
  const p = dark ? DARK : LIGHT;
  return (
    <div style={{
      flex: `0 0 ${cw}px`,
      transform: `translateY(${active ? -8 : 0}px) scale(${scale})`,
      opacity,
      transition: "transform .55s cubic-bezier(.22,.61,.36,1), opacity .45s ease",
      filter: active ? "brightness(1.04)" : "none",
      pointerEvents: active ? "auto" : "none",
    }}>
      <div style={{
        position: "relative", height: m ? 200 : 246, borderRadius: m ? 18 : 24,
        overflow: "hidden", textAlign: "center",
        background: active ? p.glassHi : p.glass,
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: active ? `1.5px solid ${p.borderHi}` : `1px solid ${p.border}`,
        animation: active ? "lgGlowA 3.2s ease-in-out infinite" : "none",
        boxShadow: active ? "none" : p.cardShadow,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: active ? `linear-gradient(90deg,transparent,${p.violetBright},transparent)` : `linear-gradient(90deg,transparent,${dark ? "rgba(167,139,250,.35)" : "rgba(124,58,237,.28)"},transparent)` }} />

        {/* avatar */}
        <div style={{ position: "relative", width: m ? 66 : 80, height: m ? 66 : 80, margin: m ? "22px auto 10px" : "26px auto 10px" }}>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: `radial-gradient(circle,${accent}55 0%,transparent 70%)`, filter: "blur(4px)" }} />
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", padding: 3, background: active ? `linear-gradient(135deg,${p.violetBright},${p.blue})` : `linear-gradient(135deg,${dark ? "rgba(167,139,250,.55)" : "rgba(139,92,246,.55)"},${dark ? "rgba(76,110,245,.35)" : "rgba(76,110,245,.4)"})` }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: dark ? "#12163A" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {leader.avatar?.trim() ? (
                <img src={leader.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: m ? 26 : 32, fontWeight: 900, color: accent }}>{(leader.name || "U")[0]}</span>
              )}
            </div>
          </div>
          <svg viewBox="0 0 24 24" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -6, width: 16, height: 16, opacity: active ? 1 : 0.55 }}>
            <polygon points="2,22 9,4 16,22" fill={accent} opacity="0.25" />
            <polygon points="9,4 10,4 13,22 9,22" fill={accent} opacity="0.5" />
            <polygon points="12,2 14,22 10,22" fill={accent} />
          </svg>
        </div>

        {/* name */}
        <h4 style={{
          margin: "2px 10px 6px", fontSize: m ? 12.5 : 14.5, fontWeight: 800, color: active ? p.name : p.nameInactive,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{leader.name}</h4>

        {/* rank/points badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "82%", padding: "2px 9px", borderRadius: 999, background: dark ? "rgba(124,58,237,.14)" : "rgba(124,58,237,.1)", border: `1px solid ${dark ? "rgba(139,118,255,.3)" : "rgba(124,58,237,.28)"}`, fontSize: m ? 9 : 10, fontWeight: 700, color: active ? p.violetBright : p.badge, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span>{leader.icon || "🏆"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{leader.rank || "—"}</span>
        </div>

        {active && (
          <div style={{ position: "absolute", bottom: -12, left: "50%", transform: "translateX(-50%)", width: "80%", height: 22, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(124,58,237,.35) 0%,transparent 70%)", filter: "blur(6px)" }} />
        )}
      </div>
    </div>
  );
}

const btnStyle = (m, p, left) => ({
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  width: m ? 28 : 38, height: m ? 28 : 38, borderRadius: "50%",
  border: `1px solid ${p.btnBorder}`,
  background: p.btnBg, color: p.btnColor, cursor: "pointer", zIndex: 5,
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 4px 14px rgba(60,40,120,.18), 0 0 10px rgba(124,58,237,.22)",
  transition: "transform .2s ease, background .2s ease",
  [left ? "left" : "right"]: 0,
  opacity: 0.9,
});
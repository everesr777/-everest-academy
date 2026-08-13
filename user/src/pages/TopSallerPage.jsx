import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import AppNavbar from "../components/AppNavbar";
import { useTheme } from "../ThemeContext";
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

const GOLD = "#6E3BF2";
const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
const podiumOrder = [2, 1, 3];
const podiumHeights = { 1: 240, 2: 190, 3: 160 };

function scoreColor(s) { return s >= 90 ? "#10b981" : s >= 75 ? "#3b82f6" : s >= 60 ? "#f97316" : "#ef4444"; }
function gradeBadge(s) { return s >= 90 ? { ar: "ممتاز", en: "Excellent", bg: "#10b98118", fg: "#10b981" } : s >= 75 ? { ar: "جيد جداً", en: "Very Good", bg: "#3b82f618", fg: "#3b82f6" } : s >= 60 ? { ar: "جيد", en: "Good", bg: "#f9731618", fg: "#f97316" } : { ar: "مقبول", en: "Pass", bg: "#ef444418", fg: "#ef4444" }; }

function PodiumCard({ s, position, t, c, m, onClick }) {
  const isTop = position === 1;
  const init = (s.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sc = scoreColor(s.avg_score);
  const g = gradeBadge(s.avg_score);
  return (
    <div onClick={() => onClick?.(s)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", order: position === 2 ? 0 : position === 1 ? -1 : 1, flex: position === 1 ? "1.2 1 0" : "1 1 0", animation: `podiumRise 0.8s ease ${position * 0.15}s both`, maxWidth: m ? 110 : "none", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
      <div style={{ position: "relative", marginBottom: m ? 6 : 12 }}>
        <div style={{ width: isTop ? (m ? 64 : 90) : (m ? 50 : 70), height: isTop ? (m ? 64 : 90) : (m ? 50 : 70), borderRadius: "50%", background: `linear-gradient(135deg, ${sc}25, ${sc}10)`, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${isTop ? sc : sc + "40"}`, boxShadow: isTop ? `0 8px 30px ${sc}30` : "none" }}>
          {s.avatar ? <img src={s.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} /> : null}
          <span style={{ position: "absolute", fontSize: isTop ? 26 : 18, fontWeight: 800, color: sc, display: s.avatar ? "none" : "flex" }}>{init}</span>
        </div>
        <span style={{ position: "absolute", top: -8, right: -8, fontSize: isTop ? 26 : 20 }}>{medals[position]}</span>
        {isTop && <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", fontSize: 20 }}>👑</span>}
      </div>
      <h3 style={{ fontSize: isTop ? 16 : 13, fontWeight: 700, color: c.text, textAlign: "center", marginBottom: 4, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name}</h3>
      <span style={{ fontSize: m ? 18 : 24, fontWeight: 900, color: sc }}>{Math.round(s.avg_score)}%</span>
      <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: g.bg, color: g.fg, fontWeight: 700, marginBottom: 6 }}>{t(g.ar, g.en)}</span>
      <span style={{ fontSize: 10, color: c.textMuted, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", marginBottom: 8 }}>{s.course_title}</span>
      <div style={{ display: "flex", gap: 8, fontSize: 10, color: c.textSoft, marginBottom: 8 }}>
        <span style={{ color: "#10b981" }}>✓ {s.passed}</span>
        <span style={{ color: "#ef4444" }}>✗ {s.failed}</span>
      </div>
      <div style={{ width: "100%", borderRadius: "16px 16px 0 0", marginTop: "auto", height: m ? podiumHeights[position] * 0.6 : podiumHeights[position], background: `linear-gradient(180deg, ${sc}12 0%, ${sc}04 100%)`, borderTop: `2px solid ${sc}50`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "14px 10px" }}>
        <div style={{ width: "80%", height: 6, borderRadius: 3, background: c.border, overflow: "hidden" }}>
          <div style={{ width: s.avg_score + "%", height: "100%", borderRadius: 3, background: sc, transition: "width 0.8s ease" }} />
        </div>
        <p style={{ fontSize: 9, color: c.textMuted, marginTop: 4 }}>{t("معدل الدرجات", "Avg Score")}</p>
      </div>
    </div>
  );
}

function RankRow({ s, i, t, c, m, onClick }) {
  const init = (s.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sc = scoreColor(s.avg_score);
  const g = gradeBadge(s.avg_score);
  const posColor = i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : c.textMuted;
  return (
    <div onClick={() => onClick?.(s)} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: m ? "40px 1fr auto" : "50px 1fr 140px 140px 90px 80px", alignItems: "center", padding: m ? "10px 12px" : "12px 16px", borderBottom: `1px solid ${c.border}`, background: i < 3 ? "rgba(110,59,242,0.03)" : "transparent", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(110,59,242,0.08)"} onMouseLeave={e => e.currentTarget.style.background = i < 3 ? "rgba(110,59,242,0.03)" : "transparent"}>
      <span style={{ fontWeight: 800, fontSize: i < 3 ? (m ? 14 : 16) : (m ? 11 : 12), color: posColor, textAlign: "center" }}>{i < 3 ? medals[i + 1] : `#${i + 1}`}</span>
      <div style={{ display: "flex", alignItems: "center", gap: m ? 8 : 10, minWidth: 0 }}>
        <div style={{ width: m ? 30 : 36, height: m ? 30 : 36, borderRadius: "50%", flexShrink: 0, background: sc + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: m ? 10 : 12, fontWeight: 700, color: sc }}>
          {s.avatar ? <img src={s.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : init}
        </div>
        <span style={{ fontWeight: 600, fontSize: m ? 12 : 13, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name}</span>
      </div>
      {!m && <span style={{ fontSize: 11, color: c.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.course_title}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: c.border, overflow: "hidden", minWidth: 60 }}>
          <div style={{ width: s.avg_score + "%", height: "100%", borderRadius: 3, background: sc }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: sc, minWidth: 32 }}>{Math.round(s.avg_score)}%</span>
      </div>
      {!m && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10, background: g.bg, color: g.fg, textAlign: "center" }}>{t(g.ar, g.en)}</span>}
      <div style={{ display: "flex", gap: 6, fontSize: 11, justifyContent: "center" }}>
        <span style={{ color: "#10b981" }}>✓{s.passed}</span>
        <span style={{ color: "#ef4444" }}>✗{s.failed}</span>
      </div>
    </div>
  );
}

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

export default function TopSallerPage() {
  const { t, dir } = useLang();
  const { colors: c } = useTheme();
  const m = useIsMobile();
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("podium");
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [modalCourse, setModalCourse] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/courses/top-quiz-performers`)
      .then(r => r.json())
      .then(d => setPerformers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...performers].filter(s => s.avg_score >= 70).sort((a, b) => b.avg_score - a.avg_score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3, 10);
  const filtered = search ? sorted.filter(s => (s.full_name || "").toLowerCase().includes(search.toLowerCase())) : sorted;

  return (
    <div style={{ minHeight: "100vh", background: c.bg, direction: dir, position: "relative", overflow: "hidden", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <AppNavbar />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, borderRadius: "50%", background: "linear-gradient(180deg, rgba(110,59,242,0.04), transparent)", filter: "blur(60px)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 10, maxWidth: 1100, margin: "0 auto", padding: m ? "80px 14px 40px" : "110px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: m ? 20 : 40, animation: "fadeInUp 0.6s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: m ? "4px 14px" : "6px 18px", borderRadius: 30, background: "rgba(110,59,242,0.08)", border: "1px solid rgba(110,59,242,0.15)", color: GOLD, fontSize: m ? 10 : 12, fontWeight: 800, marginBottom: m ? 10 : 16 }}>
            ⭐ {t("أفضل الدرجات", "TOP SCORERS")}
          </div>
          <h1 style={{ fontSize: m ? 24 : 42, fontWeight: 900, marginBottom: m ? 6 : 10, lineHeight: 1.2 }}>
            <span style={{ background: "linear-gradient(to left, #6E3BF2, #B88BFF, #6E3BF2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {t("لوحة الشرف", "HALL OF FAME")}
            </span>
          </h1>
          <p style={{ color: c.textMuted, fontSize: m ? 12 : 14, maxWidth: 450, margin: "0 auto" }}>
            {t("أفضل الأداء في الاختبارات — طلاب يحققون درجات استثنائية", "Top exam performers — students achieving exceptional scores")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: m ? 16 : 28, flexWrap: "wrap", gap: m ? 8 : 12, animation: "fadeInUp 0.6s ease 0.2s both" }}>
          <div style={{ display: "flex", gap: m ? 6 : 8 }}>
            {[["podium", t("المنصة", "Podium"), "🏆"], ["all", t("القائمة الكاملة", "Full List"), "📋"]].map(([id, label, icon]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ padding: m ? "6px 14px" : "8px 20px", borderRadius: 12, fontSize: m ? 11 : 13, fontWeight: 700, cursor: "pointer", transition: "0.2s", background: activeTab === id ? "rgba(110,59,242,0.12)" : c.bgCard, border: `1px solid ${activeTab === id ? "rgba(110,59,242,0.3)" : c.border}`, color: activeTab === id ? GOLD : c.textMuted }}>
                {icon} {label}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", width: 260 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: c.textMuted }}>🔍</span>
            <input type="text" placeholder={t("ابحث عن طالب...", "Search student...")} value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, background: c.bgInput, border: `1px solid ${c.border}`, borderRadius: 12, color: c.text, fontSize: 13, outline: "none" }} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ display: "inline-block", width: 36, height: 36, border: `3px solid ${GOLD}33`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <p style={{ color: c.textMuted, fontSize: 13, marginTop: 12 }}>{t("جاري التحميل...", "Loading...")}</p>
          </div>
        ) : (
          <>
            {activeTab === "podium" && top3.length > 0 && !search && (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 16, marginBottom: 60, padding: "0 20px", animation: "fadeInUp 0.6s ease 0.3s both" }}>
                {top3.length === 1 && <PodiumCard s={top3[0]} position={1} t={t} c={c} m={m} onClick={setSelectedPerformer} />}
                {top3.length === 2 && <>
                  <PodiumCard s={top3[0]} position={1} t={t} c={c} m={m} onClick={setSelectedPerformer} />
                  <PodiumCard s={top3[1]} position={2} t={t} c={c} m={m} onClick={setSelectedPerformer} />
                </>}
                {top3.length >= 3 && podiumOrder.map(pos => <PodiumCard key={pos} s={top3[pos - 1]} position={pos} t={t} c={c} m={m} onClick={setSelectedPerformer} />)}
              </div>
            )}
            {activeTab === "podium" && rest.length > 0 && !search && (
              <div style={{ marginBottom: 40, animation: "fadeInUp 0.6s ease 0.4s both" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, marginBottom: 14, paddingLeft: 8 }}>🏅 {t("المتصدرين الآخرين", "Other Top Performers")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
                  {rest.map((s, i) => {
                    const sc = scoreColor(s.avg_score);
                    const init = (s.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <div key={s.user_id + s.course_id} onClick={() => setSelectedPerformer(s)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: "12px 16px", transition: "border-color 0.2s, transform 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.transform = "scale(1.02)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = "scale(1)"; }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, width: 30, textAlign: "center" }}>#{i + 4}</span>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: sc + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: sc, border: `1px solid ${sc}25` }}>
                          {s.avatar ? <img src={s.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : init}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name}</p>
                          <span style={{ fontSize: 10, color: c.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{s.course_title}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: sc }}>{Math.round(s.avg_score)}%</p>
                          <div style={{ display: "flex", gap: 4, fontSize: 9, justifyContent: "flex-end" }}>
                            <span style={{ color: "#10b981" }}>✓{s.passed}</span>
                            <span style={{ color: "#ef4444" }}>✗{s.failed}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(activeTab === "all" || search) && (
              <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 18, overflow: "hidden", animation: "fadeInUp 0.6s ease 0.3s both" }}>
                {!m && <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 140px 140px 90px 80px", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${c.border}`, fontSize: 10, color: c.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  <span>#</span><span>{t("الطالب", "Student")}</span><span>{t("المادة", "Course")}</span><span>{t("الدرجة", "Score")}</span><span>{t("التقدير", "Grade")}</span><span style={{ textAlign: "center" }}>{t("النتائج", "Results")}</span>
                </div>}
                {filtered.length === 0 ? (
                  <div style={{ padding: "50px 0", textAlign: "center", color: c.textMuted, fontSize: 13 }}>{t("لا يوجد نتائج", "No results")}</div>
                ) : filtered.map((s, i) => <RankRow key={s.user_id + s.course_id} s={s} i={i} t={t} c={c} m={m} onClick={setSelectedPerformer} />)}
              </div>
            )}
          </>
        )}
      </div>
      {/* Performer Detail Modal */}
      {selectedPerformer && (() => {
        const s = selectedPerformer;
        const sc = scoreColor(s.avg_score);
        const g = gradeBadge(s.avg_score);
        const init = (s.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        const courseName = s.course_title_ar || s.course_title || "—";
        const courseDesc = s.course_description_ar || s.course_description || "";
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }} onClick={() => setSelectedPerformer(null)}>
            <div style={{ background: c.bgCard, borderRadius: 24, border: `1px solid ${c.border}`, width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "modalIn 0.3s ease" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ position: "relative", padding: "28px 24px 20px", textAlign: "center", background: `linear-gradient(135deg, ${sc}12, ${sc}05)`, borderBottom: `1px solid ${c.border}` }}>
                <button onClick={() => setSelectedPerformer(null)} style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, cursor: "pointer", color: c.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px", background: `linear-gradient(135deg, ${sc}30, ${sc}10)`, border: `3px solid ${sc}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${sc}25` }}>
                  {s.avatar ? <img src={s.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: 26, fontWeight: 900, color: sc }}>{init}</span>}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: c.text, margin: "0 0 4px" }}>{s.full_name}</h3>
                <p style={{ fontSize: 12, color: c.textMuted, margin: 0 }}>{s.email || "—"}</p>
                {s.rank && <span style={{ display: "inline-block", marginTop: 8, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>{s.rank}</span>}
              </div>
              {/* Score */}
              <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
                <div style={{ padding: "12px 8px", borderRadius: 14, background: `${sc}10`, border: `1px solid ${sc}25` }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: sc, margin: 0 }}>{Math.round(s.avg_score)}%</p>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("معدل الدرجات", "Avg Score")}</p>
                </div>
                <div style={{ padding: "12px 8px", borderRadius: 14, background: `${sc}10`, border: `1px solid ${sc}25` }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: "#10b981", margin: 0 }}>{s.best_score != null ? Math.round(s.best_score) : "—"}%</p>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("أفضل درجة", "Best Score")}</p>
                </div>
                <div style={{ padding: "12px 8px", borderRadius: 14, background: `${sc}10`, border: `1px solid ${sc}25` }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: c.text, margin: 0 }}>{s.total_attempts}</p>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("عدد المحاولات", "Attempts")}</p>
                </div>
              </div>
              {/* Results */}
              <div style={{ padding: "0 24px 20px", display: "flex", gap: 12 }}>
                <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, background: "#10b98110", border: "1px solid #10b98125" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>✓ {s.passed}</span>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("ناجح", "Passed")}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, background: "#ef444410", border: "1px solid #ef444425" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#ef4444" }}>✗ {s.failed}</span>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("راسب", "Failed")}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, background: `${g.bg}`, border: `1px solid ${g.fg}25` }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: g.fg }}>{t(g.ar, g.en)}</span>
                  <p style={{ fontSize: 10, color: c.textMuted, margin: "4px 0 0" }}>{t("التقدير", "Grade")}</p>
                </div>
              </div>
              {/* Course */}
              <div style={{ padding: "0 24px 24px" }}>
                <div style={{ borderRadius: 16, border: `1px solid ${c.border}`, overflow: "hidden" }}>
                  {s.course_image && <img src={s.course_image} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />}
                  <div style={{ padding: "16px 18px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>{t("الكورس", "Course")}</p>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: c.text, margin: "0 0 8px" }}>{courseName}</h4>
                    {courseDesc && <p style={{ fontSize: 12, color: c.textMuted, margin: 0, lineHeight: 1.6 }}>{courseDesc.length > 160 ? courseDesc.slice(0, 160) + "..." : courseDesc}</p>}
                    {s.course_price != null && <p style={{ fontSize: 13, fontWeight: 700, color: sc, marginTop: 10 }}>{s.course_price} E-Money</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <FooterSection />
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes podiumRise { from { opacity:0; transform:translateY(40px) scale(.9); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}
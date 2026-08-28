import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { api } from "../App";
import AppNavbar from "../components/AppNavbar";
import { useTheme } from "../ThemeContext";
import FooterSection from "../components/FooterSection";

const GOLD = "#6E3BF2";

const rankIcons = {
  Star: "⭐",
  Rising: "🌟",
  Pro: "💎",
  Elite: "👑",
  Legend: "🏆",
  Master: "🔥",
  Director: "🎖️",
};

function countAll(nodes) { let n = 0; for (const x of nodes) { n++; if (x.children) n += countAll(x.children); } return n; }
function flattenTree(nodes, depth = 0) {
  let list = [];
  for (const n of nodes) { list.push({ ...n, _depth: depth }); if (n.children) list = list.concat(flattenTree(n.children, depth + 1)); }
  return list;
}

const levelColors = ["#6E3BF2", "#3b82f6", "#10b981", "#a78bfa", "#f97316", "#ef4444", "#06b6d4", "#ec4899"];
function getLevelColor(d) { return levelColors[d % levelColors.length]; }

function TeamMemberNode({ member, depth, t, c, total, dbRanks }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = member.children && member.children.length > 0;
  const childCount = hasChildren ? countAll(member.children) : 0;
  const lc = getLevelColor(depth);

  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 12, marginBottom: 2,
        background: depth === 0 ? c.bgCard : "transparent",
        borderLeft: depth > 0 ? `3px solid ${lc}` : "none",
        marginLeft: depth > 0 ? 8 : 0,
        transition: "background 0.15s",
      }}>
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} style={{
            width: 20, height: 20, borderRadius: 6, border: "none", cursor: "pointer",
            background: `${lc}15`, color: lc, fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}>▶</button>
        )}
        {!hasChildren && <div style={{ width: 20, flexShrink: 0 }} />}

        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${lc}20, ${lc}40)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 14, color: lc,
        }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
            : (member.full_name || "?")[0]}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.full_name}</p>
          <p style={{ fontSize: 10, margin: 0, direction: "ltr" }}><span style={{ color: c.textMuted }}>ID:</span> <span style={{ color: c.primary, fontWeight: 700, fontFamily: "monospace" }}>{member.referral_code || member.id}</span></p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6, background: member.rank ? `${lc}12` : `${lc}08`, color: member.rank ? lc : `${lc}88`, display:"inline-flex", alignItems:"center", gap:4 }}>
              {(() => { if (!member.rank) return null; const rk = (dbRanks || []).find(r => r.name === member.rank); return rk?.image ? <img src={rk.image} alt="" style={{width:14,height:14,borderRadius:3,objectFit:"cover"}} /> : (rankIcons[member.rank] || "⭐"); })()} {member.rank || `—`}
            </span>

          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
            background: `${lc}15`, color: lc,
          }}>
            {t("المستوى", "Level")}{depth + 1}
          </span>
          {hasChildren && (
            <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
              +{childCount}
            </span>
          )}
        </div>
      </div>

      {expanded && hasChildren && member.children.map((child) => (
        <TeamMemberNode key={child.id} member={child} depth={depth + 1} t={t} c={c} dbRanks={dbRanks} />
      ))}
    </div>
  );
}

export default function AffiliatePage() {
  const { t, dir } = useLang();
  const { user, logout, login } = useAuth();
  const { colors: c } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();

  const [tree, setTree] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab] = useState(() => new URLSearchParams(loc.search).get("tab") || "team");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMsg, setTransferMsg] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [directs, setDirects] = useState([]);
  const [upline, setUpline] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dbRanks, setDbRanks] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);

  const loadData = () => {
    if (!user) return;
    api(`/api/mlm/tree?userId=${user.id}`).then(setTree).catch(() => {});
    api(`/api/mlm/commissions?userId=${user.id}`).then(setCommissions).catch(() => {});
    api(`/api/mlm/directs/${user.id}`).then(setDirects).catch(() => {});
    api(`/api/mlm/upline/${user.id}`).then((u) => setUpline(u[0] || null)).catch(() => {});
    api("/api/ranks").then((d) => Array.isArray(d) ? setDbRanks(d) : null).catch(() => {});
    api(`/api/mlm/transfers/${user.id}`).then(setTransferHistory).catch(() => {});
    api(`/api/users/${user.id}`).then((u) => {
      if (u) setProfileData(u);
    }).catch(() => {});
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    const code = String(transferTo || "").trim();
    setTransferTarget(null);
    if (code.length < 4 || !user) return;
    const t = setTimeout(() => {
      api(`/api/mlm/lookup?code=${encodeURIComponent(code)}`)
        .then((r) => setTransferTarget(r && r.found ? r : null))
        .catch(() => setTransferTarget(null));
    }, 400);
    return () => clearTimeout(t);
  }, [transferTo]);

  const copyCode = () => {
    if (user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (navigator.share && user?.referral_code) {
      navigator.share({ title: "Everest Academy", text: t("انضم عبر كودي", "Join via my code"), url: `https://everestacademy.com/ref/${user.referral_code}` });
    }
  };

  const eMoney = profileData?.e_money ?? user?.e_money ?? 0;
  const uniqueLevels = [...new Set(commissions.map((c) => c.level))].sort((a, b) => a - b);

  const countTeam = (nodes) => {
    let count = 0;
    for (const n of nodes) {
      count += 1;
      if (n.children) count += countTeam(n.children);
    }
    return count;
  };
  const teamCount = countTeam(tree);

  const tabs = [
    { key: "team", label: t("فريقي", "My Team"), icon: "👥" },
    { key: "commissions", label: t("العمولات", "Commissions"), icon: "💰" },
    { key: "transfer", label: t("تحويل", "Transfer"), icon: "🔄" },
  ];

  return (
    <div style={{ direction: dir, background: c.bg, minHeight: "100vh" }}>
      <AppNavbar />

      <div className="dash-container" style={{ marginTop: 30, paddingBottom: 40 }}>
        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: c.text }}>
            {t("نظام الإحالة", "Affiliate System")}
          </h2>
          <p style={{ fontSize: 13, color: c.textMuted, margin: "6px 0 0" }}>
            {t("أدر فريقك وتابع أرباحك", "Manage your team and track your earnings")}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => {
                setTab(tb.key);
                nav(`/affiliate?tab=${tb.key}`, { replace: true });
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 12,
                border: tab === tb.key ? "none" : `1px solid ${c.border || "#e5e5e5"}`,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: tab === tb.key ? `linear-gradient(135deg, ${GOLD}, #6E3BF2)` : c.bgCard,
                color: tab === tb.key ? "#fff" : c.textSoft,
                boxShadow: tab === tb.key ? `0 4px 14px ${GOLD}44` : "none",
                transition: "all 0.2s",
              }}
            >
              <span>{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </div>

        {/* ============ TEAM TAB ============ */}
        {tab === "team" && (
          <div>
            {/* Hero Card - Referral Code */}
            <div
              style={{
                background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
                borderRadius: 20,
                padding: "28px 24px",
                marginBottom: 20,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative circles */}
              <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `${GOLD}12` }} />
              <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: `${GOLD}08` }} />

              <p style={{ fontSize: 12, color: "#ffffffaa", margin: 0, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                {t("كود الإحالة الخاص بك", "Your Referral Code")}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: "14px 18px",
                  marginTop: 14,
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${GOLD}33`,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, color: GOLD, letterSpacing: 3, fontFamily: "monospace" }}>
                  {user?.referral_code || "—"}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: copied ? "#22c55e" : GOLD,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "background 0.3s",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {copied ? "✓ " + t("تم", "Copied!") : "📋 " + t("نسخ", "Copy")}
                  </button>
                  <button
                    onClick={shareLink}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      border: `1px solid ${GOLD}55`,
                      background: "rgba(255,255,255,0.05)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    📤 {t("مشاركة", "Share")}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#ffffff77", marginTop: 12, margin: "14px 0 0" }}>
                {t("شارك هذا الكود مع أصدقائك لبناء فريقك وزيادة أرباحك", "Share this code with friends to build your team and increase earnings")}
              </p>
            </div>

            {/* Quick Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
              className="stats-grid"
            >
              {[
                {
                  label: t("أعضاء الفريق", "Team Members"),
                  value: teamCount,
                  icon: "👥",
                  bg: `linear-gradient(135deg, ${GOLD}12, ${GOLD}06)`,
                  border: `${GOLD}22`,
                },
                {
                  label: t("المستويات النشطة", "Active Levels"),
                  value: uniqueLevels.length || 1,
                  icon: "📊",
                  bg: "linear-gradient(135deg, #3b82f612, #3b82f606)",
                  border: "#3b82f622",
                },
                {
                  label: t("رصيدك الحالي", "Your Balance"),
                  value: eMoney + " E",
                  icon: "💰",
                  bg: "linear-gradient(135deg, #22c55e12, #22c55e06)",
                  border: "#22c55e22",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    background: stat.bg,
                    border: `1px solid ${stat.border}`,
                    borderRadius: 16,
                    padding: "16px 14px",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{stat.icon}</span>
                  <p style={{ fontSize: 22, fontWeight: 800, margin: "6px 0 2px", color: c.text }}>{stat.value}</p>
                  <p style={{ fontSize: 11, color: c.textMuted, margin: 0 }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Team Tree */}
            <div style={{ background: c.bgCard, borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, color: c.text }}>
                  🌳 {t("شجرة الفريق", "Team Tree")}
                </h3>
                {teamCount > 0 && (
                  <span style={{ fontSize: 11, background: `${GOLD}18`, color: GOLD, padding: "3px 12px", borderRadius: 20, fontWeight: 700 }}>
                    {teamCount} {t("عضو", "members")}
                  </span>
                )}
              </div>

              {/* Upline - Team Leader */}
              {upline && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, height: 1, background: `${GOLD}33` }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>
                      {t("القائد", "Team Leader")}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `${GOLD}33` }} />
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", borderRadius: 14, marginBottom: 6,
                    background: `linear-gradient(135deg, ${GOLD}10, ${GOLD}05)`,
                    border: `1.5px solid ${GOLD}33`,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}50)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 16, color: "#fff",
                      border: `2px solid ${GOLD}44`,
                    }}>
                      {upline.avatar ? <img src={upline.avatar} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "cover" }} /> : (upline.full_name || "?")[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: c.text }}>{upline.full_name}</p>
                      <p style={{ fontSize: 10, margin: "1px 0 0", direction: "ltr" }}><span style={{ color: c.textMuted }}>ID:</span> <span style={{ color: c.primary, fontWeight: 700, fontFamily: "monospace" }}>{upline.referral_code || upline.id}</span></p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6, background: `${GOLD}15`, color: GOLD }}>
                          {(() => { const rk = (dbRanks || []).find(r => r.name === upline.rank); return rk?.image ? <img src={rk.image} alt="" style={{width:12,height:12,borderRadius:3,objectFit:"cover",verticalAlign:"middle",marginRight:3}} /> : (rankIcons[upline.rank] || "⭐"); })()} {upline.rank || "Star"}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: `${GOLD}15`, color: GOLD }}>
                      ↑ {t("سبونسر", "Sponsor")}
                    </span>
                  </div>
                  {/* Connecting line down to you */}
                  <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                    <div style={{ width: 2, height: 16, background: `${GOLD}44` }} />
                  </div>
                </div>
              )}

              {/* Current User Node */}
              <div style={{
                padding: "10px 14px", borderRadius: 14, marginBottom: 8,
                background: `linear-gradient(135deg, ${GOLD}12, ${GOLD}06)`,
                border: `2px solid ${GOLD}44`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}60)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 15, color: "#fff",
                }}>
                  {user?.avatar ? <img src={user.avatar} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} /> : (user?.full_name || "Z")[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: c.text }}>
                    {user?.full_name || user?.name}
                    <span style={{ fontSize: 9, background: GOLD, color: "#fff", padding: "1px 6px", borderRadius: 6, marginLeft: 6, fontWeight: 700 }}>
                      {t("أنت", "YOU")}
                    </span>
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 6, background: `${GOLD}15`, color: GOLD }}>
                      {(() => { if (!user?.rank) return null; const rk = (dbRanks || []).find(r => r.name === user.rank); return rk?.image ? <img src={rk.image} alt="" style={{width:12,height:12,borderRadius:3,objectFit:"cover",verticalAlign:"middle",marginRight:3}} /> : (rankIcons[user.rank] || "⭐"); })()} {user?.rank || "—"}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: `${GOLD}15`, color: GOLD }}>
                  {teamCount} {t("عضو", "members")}
                </span>
              </div>

              {/* Connecting line down to team */}
              {tree.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
                  <div style={{ width: 2, height: 12, background: `rgba(0,0,0,.12)` }} />
                </div>
              )}

              {/* Level breakdown bar */}
              {tree.length > 0 && (() => {
                const flat = flattenTree(tree);
                const maxDepth = Math.max(...flat.map(f => f._depth)) + 1;
                const levelCounts = {};
                flat.forEach(f => { levelCounts[f._depth] = (levelCounts[f._depth] || 0) + 1; });
                return (
                  <div style={{ display: "flex", gap: 4, marginBottom: 12, height: 8, borderRadius: 4, overflow: "hidden" }}>
                    {Array.from({ length: maxDepth }, (_, i) => (
                      <div key={i} style={{ flex: levelCounts[i] || 0, background: getLevelColor(i), borderRadius: 3, minWidth: 4 }}
                        title={`${t("المستوى", "Level")} ${i + 1}: ${levelCounts[i] || 0} ${t("عضو", "members")}`} />
                    ))}
                  </div>
                );
              })()}

              {tree.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                  <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>🌱</span>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: c.text }}>
                    {t("لا يوجد أعضاء في الفريق بعد", "No team members yet")}
                  </p>
                  <p style={{ fontSize: 13, color: c.textMuted, margin: "0 0 18px" }}>
                    {t("ابدأ بمشاركة كود الإحالة الخاص بك لبناء فريقك", "Start sharing your referral code to build your team")}
                  </p>
                  <button
                    onClick={copyCode}
                    style={{
                      padding: "10px 24px",
                      borderRadius: 12,
                      border: "none",
                      background: `linear-gradient(135deg, ${GOLD}, #6E3BF2)`,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: `0 4px 14px ${GOLD}44`,
                    }}
                  >
                    📋 {t("نسخ الكود والمشاركة", "Copy Code & Share")}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {tree.map((m) => (
                    <TeamMemberNode key={m.id} member={m} depth={0} t={t} c={c} dbRanks={dbRanks} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ COMMISSIONS TAB ============ */}
        {tab === "commissions" && (
          <div
            style={{
              background: c.bgCard,
              borderRadius: 20,
              padding: "20px 18px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8, color: c.text }}>
              📋 {t("سجل العمولات", "Commission History")}
              {commissions.length > 0 && (
                <span style={{ fontSize: 11, background: `${GOLD}18`, color: GOLD, padding: "2px 10px", borderRadius: 8, fontWeight: 600 }}>
                  {commissions.length}
                </span>
              )}
            </h3>

            {commissions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px" }}>
                <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>📭</span>
                <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: c.text }}>
                  {t("لا توجد عمولات بعد", "No commissions yet")}
                </p>
                <p style={{ fontSize: 13, color: c.textMuted }}>
                  {t("ستظهر العمولات هنا عندما ينضم أعضاء لفريقك", "Commissions will appear here when members join your team")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {commissions.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: c.bgInput || `${c.bg}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                      border: `1px solid ${c.border || "#f0f0f0"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: `${GOLD}12`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: GOLD,
                        }}
                      >
                        L{item.level}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: c.text }}>
                          {item.from_name}
                        </p>
                        <p style={{ fontSize: 11, color: c.textMuted, margin: 0 }}>
                          {item.from_email}
                        </p>
                        <p style={{ fontSize: 11, color: c.textMuted, marginTop: 2, margin: 0 }}>
                          {item.created_at?.slice(0, 16) || "—"}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#22c55e",
                        background: "#22c55e10",
                        padding: "4px 10px",
                        borderRadius: 8,
                      }}
                    >
                      +{item.amount} E-Money
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============ TRANSFER TAB ============ */}
        {tab === "transfer" && (
          <div>
            {/* Balance & Upline Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
              className="transfer-header-grid"
            >
              <div
                style={{
                  background: `linear-gradient(135deg, ${GOLD}15, ${GOLD}06)`,
                  border: `1px solid ${GOLD}22`,
                  borderRadius: 18,
                  padding: 22,
                }}
              >
                <p style={{ fontSize: 11, color: c.textMuted, margin: "0 0 6px", fontWeight: 600, letterSpacing: 0.5 }}>
                  {t("رصيدك الحالي", "Your Balance")}
                </p>
                <p style={{ fontSize: 30, fontWeight: 800, color: GOLD, margin: 0, lineHeight: 1 }}>
                  {user?.e_money || 0}
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, marginLeft: 4 }}>E-Money</span>
                </p>
              </div>
              <div
                style={{
                  background: c.bgCard,
                  border: `1px solid ${c.border || "#f0f0f0"}`,
                  borderRadius: 18,
                  padding: 22,
                }}
              >
                <p style={{ fontSize: 11, color: c.textMuted, margin: "0 0 8px", fontWeight: 600 }}>
                  {t("الـ Upline الخاص بك", "Your Upline")}
                </p>
                {upline ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${GOLD}33, ${GOLD}66)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 15,
                        border: `2px solid ${GOLD}44`,
                      }}
                    >
                      {(upline.full_name || "?")[0]}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: c.text }}>{upline.full_name}</p>
                      <p style={{ fontSize: 11, color: c.textMuted, margin: 0 }}>{upline.rank || "Star"}</p>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: c.textMuted, fontSize: 13, margin: 0 }}>{t("ليس لديك Upline", "No upline")}</p>
                )}
              </div>
            </div>

            {/* Info Note */}
            <div
              style={{
                background: c.bgCard,
                borderRadius: 14,
                padding: "12px 16px",
                marginBottom: 16,
                border: `1px solid ${c.border || "#f0f0f0"}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>ℹ️</span>
              <p style={{ fontSize: 12, color: c.textMuted, margin: 0, lineHeight: 1.5 }}>
                {t(
                  "يمكنك التحويل فقط إلى الشخص الذي سجلك (Upline) أو الأشخاص الذين سجلتهم أنت (Downline المباشر).",
                  "You can only transfer to your upline (who referred you) or your direct downlines (who you referred)."
                )}
              </p>
            </div>



            {/* Transfer Form */}
            <div
              style={{
                background: c.bgCard,
                borderRadius: 18,
                padding: 22,
                boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
              }}
            >
              <p style={{ fontWeight: 700, margin: "0 0 14px", fontSize: 15, color: c.text, display: "flex", alignItems: "center", gap: 8 }}>
                🔄 {t("إجراء تحويل", "Make a Transfer")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder={t("أدخل ID المستلم...", "Enter recipient ID...")}
                  style={{
                    flex: 1,
                    minWidth: 180,
                    padding: "12px 14px",
                    border: `1px solid ${c.border || "#e5e5e5"}`,
                    borderRadius: 12,
                    fontSize: 13,
                    background: c.bgInput || c.bg,
                    color: c.text,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder={t("المبلغ", "Amount")}
                  min="1"
                  style={{
                    width: 130,
                    padding: "12px 14px",
                    border: `1px solid ${c.border || "#e5e5e5"}`,
                    borderRadius: 12,
                    fontSize: 13,
                    background: c.bgInput || c.bg,
                    color: c.text,
                    outline: "none",
                  }}
                />
                <button
                  onClick={async () => {
                    if (transferring) return;
                    if (!transferTo || !transferAmount || parseFloat(transferAmount) <= 0) {
                      setTransferMsg(t("اختر مستلم وأدخل مبلغ صحيح", "Select recipient and enter valid amount"));
                      return;
                    }
                    setTransferring(true);
                    try {
                      setTransferMsg(t("جاري التحويل...", "Transferring..."));
                      const r = await api("/api/mlm/transfer", {
                        method: "POST",
                        body: JSON.stringify({
                          from_user_id: user.id,
                          to_user_id: String(transferTo).trim(),
                          amount: parseFloat(transferAmount),
                        }),
                      });
                      setTransferAmount("");
                      setTransferTo("");
                      setTransferTarget(null);
                      const u = await api(`/api/users/${user.id}`);
                      if (u) login({ ...u, session_token: user.session_token });
                      api(`/api/mlm/transfers/${user.id}`).then(setTransferHistory).catch(() => {});
                      setTransferMsg(
                        t(
                          `✅ تم التحويل بنجاح! الرصيد الجديد: ${r.from_balance}`,
                          `✅ Transfer successful! New balance: ${r.from_balance}`
                        )
                      );
                    } catch (e) {
                      setTransferMsg("❌ " + (e.message || t("فشل التحويل", "Transfer failed")));
                    } finally {
                      setTransferring(false);
                    }
                  }}
                  style={{
                    padding: "12px 28px",
                    background: `linear-gradient(135deg, ${GOLD}, #6E3BF2)`,
                    border: "none",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: transferring ? "default" : "pointer",
                    opacity: transferring ? 0.6 : 1,
                    color: "#fff",
                    boxShadow: `0 4px 14px ${GOLD}33`,
                  }}
                >
                  {transferring ? t("جاري التحويل...", "Transferring...") : t("تحويل", "Transfer")}
                </button>
              </div>
              {transferTarget && (
                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 10 }}>
                  {t("المستلم", "Recipient")}: <b style={{ color: c.text }}>{transferTarget.full_name}</b> <span style={{ fontFamily: "monospace", color: c.primary }}>{transferTarget.referral_code}</span>
                </div>
              )}
              {transferMsg && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    padding: "10px 14px",
                    borderRadius: 10,
                    margin: "12px 0 0",
                    background: transferMsg.includes("✅")
                      ? "#22c55e10"
                      : transferMsg.includes("❌")
                      ? "#ef444410"
                      : `${c.textMuted}0a`,
                    color: transferMsg.includes("✅")
                      ? "#22c55e"
                      : transferMsg.includes("❌")
                      ? "#ef4444"
                      : c.textMuted,
                  }}
                >
                  {transferMsg}
                </p>
              )}
            </div>

            {/* Transfer History */}
            {transferHistory.length > 0 && (
              <div style={{ background: c.bgCard, borderRadius: 18, padding: "18px 16px", marginTop: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: c.text, display: "flex", alignItems: "center", gap: 6 }}>
                  📋 {t("سجل التحويلات", "Transfer History")} ({transferHistory.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {transferHistory.slice(0, 10).map((tx) => {
                    const isOutgoing = tx.from_user_id === user?.id;
                    const otherName = isOutgoing ? tx.to_name : tx.from_name;
                    return (
                      <div key={tx.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: isOutgoing ? "rgba(239,68,68,.04)" : "rgba(34,197,94,.04)",
                        border: `1px solid ${isOutgoing ? "rgba(239,68,68,.12)" : "rgba(34,197,94,.12)"}`,
                        borderRadius: 12, padding: "10px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                            background: isOutgoing ? "rgba(239,68,68,.1)" : "rgba(34,197,94,.1)",
                            fontSize: 14, fontWeight: 700, color: isOutgoing ? "#ef4444" : "#22c55e",
                          }}>
                            {isOutgoing ? "↑" : "↓"}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 12, margin: 0, color: c.text }}>
                              {isOutgoing ? t("تحويل إلى", "To") : t("تحويل من", "From")} {otherName}
                            </p>
                            <p style={{ fontSize: 10, color: c.textMuted, margin: 0 }}>
                              {tx.created_at?.slice(0, 16) || "—"}
                            </p>
                          </div>
                        </div>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: isOutgoing ? "#ef4444" : "#22c55e",
                          background: isOutgoing ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)",
                          padding: "3px 10px", borderRadius: 8,
                        }}>
                          {isOutgoing ? "-" : "+"}{tx.amount} EM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FooterSection />

      <style>{`
        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
          .transfer-header-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

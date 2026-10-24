import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import LanguageToggle from "../components/LanguageToggle";
import { api } from "../App";
import { formatWhatsAppLink } from "../whatsapp";
import AppNavbar from "../components/AppNavbar";
import { useTheme } from "../ThemeContext";

function getLevelCounts(tree, maxLevel = 99) {
  const counts = {};
  const walk = (nodes, depth) => {
    if (depth > maxLevel) return;
    if (!nodes) return;
    counts[depth] = (counts[depth] || 0) + nodes.length;
    nodes.forEach(n => walk(n.children, depth + 1));
  };
  walk(tree, 1);
  return counts;
}

export default function ProfilePage() {
  const { user, login:authLogin, logout } = useAuth();
  const { t, lang, dir, toggle: toggleLang } = useLang();
  const { theme, toggle, colors: c } = useTheme();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [rankProgress, setRankProgress] = useState(null);
  const [levelCounts, setLevelCounts] = useState({});
  const [uploading, setUploading] = useState(false);
  const [csWhatsapp, setCsWhatsapp] = useState("");
  const [csEmail, setCsEmail] = useState("");
  const [dbRanks, setDbRanks] = useState([]);

  useEffect(() => {
    if (!user) return;
    api(`/api/users/${user.id}`).then(setProfile).catch(() => setProfile(user));
  }, [user]);

  useEffect(() => {
    if (!profile?.id) return;
    api(`/api/ranks/progress/${profile.id}`).then(setRankProgress).catch(() => {});
    api(`/api/mlm/tree?userId=${profile.id}`).then(tree => {
      setLevelCounts(getLevelCounts(tree));
    }).catch(() => {});
    api("/api/ranks").then((d) => Array.isArray(d) ? setDbRanks(d) : null).catch(() => {});
  }, [profile?.id]);

  useEffect(() => {
    api("/api/customer-service").then(d => {
      setCsWhatsapp(d.customer_service_whatsapp || "");
      setCsEmail(d.customer_service_email || "");
    }).catch(() => {});
  }, []);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const max = 500;
            let w = img.width, h = img.height;
            if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.6));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
      const updated = await api(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify({ avatar: dataUrl }) });
      setProfile(updated);
      authLogin(updated);
    } catch (e) { alert(t("خطأ: ", "Error: ") + (e.message || t("فشل تغيير الصورة", "Failed to change image"))); }
    setUploading(false);
  };

  const copyCode = () => {
    if (profile?.referral_code) { navigator.clipboard.writeText(profile.referral_code); alert(t("تم نسخ كود الإحالة ✅", "Referral code copied ✅")); }
  };

  const p = profile || user || {};
  const rp = rankProgress || {};
  const progressPct = rp.progress || 0;
  const currentRankName = rp.currentRank || p.rank || null;
  const nextRankName = rp.nextRank || "Star";
  const eMoney = p.usd_balance || 0;
  const teamSales = p.total_team_sales || rp.qualifiedTeamCount || 0;

  const [now, setNow] = useState(Date.now());
  const gold = "#6E3BF2";
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);

  const membershipExpires = p.membership_expires_at ? new Date(p.membership_expires_at.replace(" ", "T") + "Z") : null;
  const membershipCreated = p.created_at ? new Date(p.created_at.replace(" ", "T") + "Z") : null;
  const expiresMs = membershipExpires ? membershipExpires.getTime() : null;
  const createdMs = membershipCreated ? membershipCreated.getTime() : null;
  let remainingDays = 183;
  let membershipPct = 100;
  let isExpired = false;
  if (expiresMs && createdMs) {
    const diffMs = expiresMs - now;
    remainingDays = Math.max(0, Math.ceil(diffMs / 86400000));
    isExpired = remainingDays <= 0;
    const totalMs = expiresMs - createdMs;
    membershipPct = totalMs > 0 ? Math.max(0, Math.min(100, (diffMs / totalMs) * 100)) : 100;
  }
  const showRenewButton = expiresMs !== null && remainingDays <= 5;

  const renewMembership = async () => {
    try {
      const res = await api(`/api/users/${p.id}/renew-membership`, { method: "POST" });
      if (res.success) {
        const updated = await api(`/api/users/${p.id}`);
        setProfile(updated);
        authLogin(updated);
        alert(t("تم تجديد العضوية بنجاح! ✅", "Membership renewed successfully! ✅"));
      }
    } catch (e) { alert(t("خطأ: ", "Error: ") + (e.message || t("فشل التجديد", "Renew failed"))); }
  };

  return (
    <div style={{direction: dir, background: c.bg }}>
      <AppNavbar />

      <div className="dash-container" style={{marginTop:30}}>
        {/* Membership Card */}
        <section className="membership-card">
          <div className="membership-content">
            <div>
              <span className="membership-label"> {isExpired ? t("العضوية منتهية", "Membership Expired") : t("العضوية نشطة", "Membership Active")} </span>
              <h2 id="countdown">{isExpired ? t("منتهية", "Expired") : `${remainingDays} ${t("يوم متبقي", "Days Remaining")}`}</h2>
              {showRenewButton && remainingDays > 0 && (
                <p style={{fontSize:13,color:"#6E3BF2",marginTop:8}}>⚠️ {t(`باقي ${remainingDays} أيام على انتهاء العضوية.`, `${remainingDays} days until membership expires.`)}</p>
              )}
              {isExpired && (
                <p style={{fontSize:13,color:"#ef4444",marginTop:8}}>🚫 {t("العضوية منتهية. تواصل مع خدمة العملاء لتجديد العضوية.", "Membership expired. Contact customer service to renew.")}</p>
              )}
            </div>
            {isExpired && csWhatsapp && (
              <a href={formatWhatsAppLink(csWhatsapp)} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",borderRadius:14,background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontWeight:700,fontSize:14,textDecoration:"none",transition:".3s",boxShadow:"0 4px 15px rgba(37,211,102,.3)"}}
                onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform="none"}>
                💬 {t("تواصل مع خدمة العملاء", "Contact Customer Service")} <span style={{opacity:.85,fontSize:12}}>({csWhatsapp})</span>
              </a>
            )}
            {isExpired && !csWhatsapp && csEmail && (
              <a href={`mailto:${csEmail}`}
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 22px",borderRadius:14,background:"linear-gradient(135deg,#6E3BF2,#6E3BF2)",color:"#fff",fontWeight:700,fontSize:14,textDecoration:"none",transition:".3s",boxShadow:"0 4px 15px rgba(110,59,242,.3)"}}
                onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform="none"}>
                📧 {t("تواصل مع خدمة العملاء", "Contact Customer Service")}
              </a>
            )}
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{width: membershipPct + "%"}}></div>
          </div>
        </section>

        {/* Profile Card (avatar, info, stats) */}
        <div className="profile-card" style={{marginTop:10}}>
          <div className="profile-avatar" style={{textAlign:"center"}}>
            <div style={{width:160,height:160,borderRadius:"50%",background:"#eee",border:"4px solid #6E3BF2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:60,fontWeight:700,color:c.textMuted,overflow:"hidden",margin:"0 auto"}}>
              {p?.avatar && p.avatar.trim() ? <img src={p.avatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:56,fontWeight:800,color:"#6E3BF2",lineHeight:1}}>{(p?.full_name || "U")[0].toUpperCase()}</span>}
            </div>
            <label style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:12,padding:"8px 18px",background:c.bgInput,border:`1px solid ${c.borderLight}`,borderRadius:20,fontSize:13,fontWeight:600,color:c.text,cursor:"pointer",transition:".25s"}}>
              📸 {uploading ? t("جاري الرفع...", "Uploading...") : t("تغيير الصورة", "Change Photo")}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>

          <div className="profile-info">
            <div className="profile-top">
              <div>
                <h2>{p.full_name || "—"}</h2>
                <p style={{color:c.textMuted,fontSize:13,marginTop:2}}>{p.email}</p>
                <span className="student-id" style={{direction:"ltr",display:"inline-flex",alignItems:"center",gap:4}}><span style={{color:c.textMuted}}>ID:</span> <span style={{color:c.primary,fontWeight:700,fontFamily:"monospace"}}>{p.referral_code || "—"}</span></span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
                <button onClick={() => { toggleLang(); }}
                  style={{
                    padding:"6px 16px", borderRadius:999,
                    background: c.bgInput, border:`1px solid ${c.borderLight}`,
                    color: c.text, fontSize:13, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:6, transition:"0.25s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#6E3BF2"; e.currentTarget.style.background = "rgba(110,59,242,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = c.borderLight; e.currentTarget.style.background = c.bgInput; }}>
                  <span style={{fontSize:14}}>{lang === "ar" ? "🇺🇸" : "🇸🇦"}</span>
                  {lang === "ar" ? "English" : "العربية"}
                </button>
                <button onClick={() => { logout(); nav("/login"); }}
                  style={{
                    padding:"7px 18px", borderRadius:10, fontSize:13, fontWeight:600,
                    cursor:"pointer", transition:"0.25s", display:"flex", alignItems:"center", gap:6,
                    background: c.bgInput, border:`1px solid ${c.borderLight}`, color: c.text
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = c.borderLight; e.currentTarget.style.color = c.text; e.currentTarget.style.background = c.bgInput; }}>
                  🚪 {t("تسجيل الخروج", "Logout")}
                </button>
              </div>
            </div>

            <div className="profile-stats-grid">
              <div className="stat-box"><span>📞 {t("الهاتف", "Phone")}</span><strong>{p.phone || "—"}</strong></div>
              <div className="stat-box"><span>🏅 {t("الرتبة", "Rank")}</span><strong>{currentRankName || "—"}</strong></div>
              <div className="stat-box"><span>💰 $</span><strong>{eMoney.toLocaleString()}</strong></div>
              <div className="stat-box"><span>👥 {t("المباشرون", "Directs")}</span><strong>{p.direct_count || 0}</strong></div>
              <div className="stat-box"><span>📊 {t("مبيعات الفريق", "Team Sales")}</span><strong>{teamSales}</strong></div>
              <div className="stat-box"><span>📅 {t("تاريخ الانضمام", "Joined")}</span><strong>{(p.created_at || "").slice(0,10) || "—"}</strong></div>
            </div>

            <div className="referral-box">
              <span>🔗 {t("كود الإحالة", "Referral Code")}</span>
              <div className="referral-copy">
                <input type="text" readOnly value={p.referral_code || "—"} />
                <button onClick={copyCode}>{t("نسخ", "Copy")}</button>
              </div>
            </div>

            <button onClick={() => nav("/create-account")} style={{width:"100%",marginTop:14,padding:"12px 0",borderRadius:12,background:"linear-gradient(135deg,#7c3aed,#3b82f6)",color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              👤 {t("إنشاء حساب لشخص آخر", "Create Account for Another User")}
            </button>
          </div>
        </div>

        {/* Welcome + Rank Overview + Contact CS */}
        <section className="dash-overview" style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"stretch"}}>
          <div className="welcome-card" style={{flex:"1 1 300px",minWidth:0}}>
            <h2>{p.full_name || "—"}</h2>
            <p>{t("استمر في بناء شبكتك وأكمل كورساتك لفتح الرتبة التالية.", "Continue building your network, complete your courses and unlock the next rank.")}</p>
            <div className="overview-stats">
              <div className="mini-stat">
                <h3>{eMoney.toLocaleString()}</h3>
                <span>$</span>
              </div>
              <div className="mini-stat">
                <h3>{currentRankName || "—"}</h3>
                <span>{t("الرتبة الحالية", "Current Rank")}</span>
              </div>
              <div className="mini-stat">
                <h3>{nextRankName || "—"}</h3>
                <span>{t("الرتبة التالية", "Next Rank")}</span>
              </div>
            </div>
            <div style={{marginTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:c.textMuted}}>
                <span>{t("التقدم", "Progress")}</span>
                <span style={{fontWeight:700,color:c.text}}>{Math.round(progressPct)}%</span>
              </div>
              <div style={{width:"100%",height:8,borderRadius:99,background:c.bgInput,overflow:"hidden"}}>
                <div style={{width:Math.min(progressPct,100)+"%",height:"100%",borderRadius:99,background:"linear-gradient(90deg,#6E3BF2,#f0d78c)",transition:"width .8s ease"}}></div>
              </div>
            </div>
            <button onClick={() => nav("/affiliate")} style={{width:"100%",marginTop:14,padding:"12px 0",borderRadius:12,background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",color:"#FFFFFF",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              🔗 {t("شبكة الإحالة", "Referral Network")}
            </button>
          </div>

          {/* Customer Service Box */}
          {(csWhatsapp || csEmail) && (
            <div style={{flex:"1 1 260px",minWidth:0,padding:24,borderRadius:20,background:c.bgCard,border:`1px solid ${c.borderLight}`,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
              <div>
                <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#25d366,#128c7e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:14}}>📞</div>
                <h3 style={{margin:"0 0 6px",fontSize:16,color:c.text}}>{t("خدمة العملاء", "Customer Service")}</h3>
                <p style={{fontSize:13,color:c.textMuted,margin:0,lineHeight:1.6}}>{t("تواصل معنا لأي استفسار أو مساعدة", "Contact us for any inquiry or support")}</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:20}}>
                {csWhatsapp && (
                  <a href={formatWhatsAppLink(csWhatsapp)} target="_blank" rel="noopener noreferrer"
                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:14,background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",textDecoration:"none",fontWeight:700,fontSize:14,transition:".3s"}}
                    onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                    onMouseLeave={e => e.currentTarget.style.transform="none"}>
                    <span style={{fontSize:18}}>📱</span> WhatsApp
                  </a>
                )}
                {csEmail && (
                  <a href={`mailto:${csEmail}`}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:14,background:c.bgInput,border:`1px solid ${c.border}`,color:c.text,textDecoration:"none",fontWeight:700,fontSize:14,transition:".3s"}}
                    onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                    onMouseLeave={e => e.currentTarget.style.transform="none"}>
                    <span style={{fontSize:18}}>📧</span> {csEmail}
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

       
      </div>

      <footer className="dash-footer">
        <p>© 2026 Everest Academy. All Rights Reserved.</p>
        <div className="footer-links">
          <a href="#">{t("الدعم", "Support")}</a>
          <a href="#">{t("الخصوصية", "Privacy")}</a>
          <a href="#">{t("الشروط", "Terms")}</a>
        </div>
      </footer>
    </div>
  );
}

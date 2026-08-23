import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api, uploadApi, BACKEND_URL } from "../App";
import AppNavbar from "../components/AppNavbar";
import { ALL_COUNTRIES, COUNTRY_CODE_MAP } from "../countryData.js";

const GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","القليوبية","الدقهلية","الشرقية","الغربية","المنوفية","البحيرة","كفر الشيخ",
  "دمياط","بورسعيد","السويس","الإسماعيلية","شمال سيناء","جنوب سيناء","بني سويف","الفيوم","المنيا","أسيوط",
  "سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح"
];

const gold = "#6E3BF2";

export default function CreateAccountPage() {
  const { user, login: authLogin } = useAuth();
  const { t, lang } = useLang();
  const { colors: c } = useTheme();
  const nav = useNavigate();
  const m = window.innerWidth <= 768;
  const [cost, setCost] = useState(5500);

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "", governorate: "", country: "" });
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [idCard, setIdCard] = useState(null);
  const [countryCode, setCountryCode] = useState("+20");
  const [uploadingImg, setUploadingImg] = useState(null);
  const [createdUsers, setCreatedUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const passRef = useRef(null);
  const confirmRef = useRef(null);

  // Defeat browser password-manager autofill: fields start readOnly and are
  // cleared + unlocked after mount so Chrome can't inject a saved password
  // into the "create account" form (which would store the WRONG password).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (passRef.current) { passRef.current.value = ""; passRef.current.removeAttribute("readOnly"); }
      if (confirmRef.current) { confirmRef.current.value = ""; confirmRef.current.removeAttribute("readOnly"); }
      setForm(prev => ({ ...prev, password: "", confirm: "" }));
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    api(`/api/users/${user.id}`).then(setProfile).catch(() => setProfile(user));
    api(`/api/users/created-by-me/${user.id}`).then(setCreatedUsers).catch(() => {});
    fetch(`${BACKEND_URL}/api/pricing`).then(r => r.json()).then(d => { if (d.create_account_cost) setCost(parseInt(d.create_account_cost) || 5500); }).catch(() => {});
  }, [user]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  // Emails must never contain spaces or invisible bidi/control characters
  // (common after paste or typing with an Arabic keyboard) — strip them live
  // so the browser's native type=email validation accepts the value.
  const setEmail = (val) => setField("email", val.replace(/[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ""));
  const onFocus = (e) => e.target.style.borderColor = gold;
  const onBlur = (e) => e.target.style.borderColor = c.border;

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const max = 800;
          let w = img.width, h = img.height;
          if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file, setter) => {
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setter(localPreview);
    try {
      const blob = await compressImage(file);
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      const uploadUrl = window.location.origin.includes("localhost") ? `${BACKEND_URL}/api/public-upload` : '/upload.php';
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setter(data.url.startsWith("http") ? data.url : `${BACKEND_URL}${data.url}`);
    } catch (e) { console.error("Upload failed:", e); }
  };

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setSuccess(""); setLoading(true);

    const balance = profile?.e_money || 0;
    if (balance < cost) {
      setErr(t(`رصيدك غير كافٍ. المطلوب: ${cost} E-Money، المتاح: ${Math.floor(balance)}`, `Insufficient balance. Required: ${cost} E-Money, Available: ${Math.floor(balance)}`));
      setLoading(false); return;
    }

    if (!form.phone.trim()) {
      setErr(t("يرجى إدخال رقم الهاتف", "Please enter a phone number"));
      setLoading(false); return;
    }
    const cleanedPhone = form.phone.replace(/\D/g, "");
    const codeInfo = COUNTRY_CODE_MAP[countryCode];
    if (codeInfo && !codeInfo.regex.test(cleanedPhone)) {
      setErr(t(`رقم الهاتف غير صحيح لـ ${codeInfo.name}. ${codeInfo.hint}`, `Invalid phone number for ${codeInfo.name}. ${codeInfo.hint}`));
      setLoading(false); return;
    }
    if (form.password.length < 8) { setErr(t("كلمة المرور يجب أن تكون 8 أحرف على الأقل.", "Password must be at least 8 characters.")); setLoading(false); return; }
    if (!/[A-Z]/.test(form.password)) { setErr(t("كلمة المرور يجب أن تحتوي على حرف كبير.", "Password must contain an uppercase letter.")); setLoading(false); return; }
    if (!/[a-z]/.test(form.password)) { setErr(t("كلمة المرور يجب أن تحتوي على حرف صغير.", "Password must contain a lowercase letter.")); setLoading(false); return; }
    if (!/[0-9]/.test(form.password)) { setErr(t("كلمة المرور يجب أن تحتوي على رقم.", "Password must contain a number.")); setLoading(false); return; }
    if (!/[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/~`]/.test(form.password)) { setErr(t("كلمة المرور يجب أن تحتوي على رمز خاص.", "Password must contain a special character.")); setLoading(false); return; }
    if (form.password !== form.confirm) { setErr(t("كلمات المرور غير متطابقة!", "Passwords do not match!")); setLoading(false); return; }


    try {
      const fullPhone = countryCode + form.phone;
      const res = await api("/api/users/create-for-others", {
        method: "POST",
        body: JSON.stringify({
          full_name: form.full_name, email: form.email, phone: fullPhone,
          password: form.password, governorate: form.governorate,
          country: form.country,
          id_card: idCard,
        }),
      });
      setSuccess(t(`تم إنشاء الحساب بنجاح! تم خصم ${cost} E-Money`, `Account created! ${cost} E-Money deducted`));
      setForm({ full_name: "", email: "", phone: "", password: "", confirm: "", governorate: "", country: "" });
      setIdCard(null);
      setProfile(p => ({ ...p, e_money: res.creator_balance }));
      setCreatedUsers(prev => [res.user, ...prev]);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const inputS = { width: "100%", padding: m ? "13px 14px" : "13px 16px", borderRadius: 12, background: c.bgInput, border: `2px solid ${c.border}`, color: c.text, fontSize: 14, outline: "none", transition: "0.3s", boxSizing: "border-box" };

  const isExpiredMembership = user && (user.blocked || (user.membership_expires_at && new Date(user.membership_expires_at) < new Date()));

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <AppNavbar />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: m ? "16px 14px 80px" : "24px 24px 80px" }}>

        {isExpiredMembership && (
          <div style={{textAlign:"center",padding:m?"60px 20px":"80px 40px",background:c.bgCard,borderRadius:20,border:`1px solid ${c.borderLight}`,marginBottom:24}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(239,68,68,.2),rgba(220,38,38,.3))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:36}}>🚫</div>
            <h2 style={{fontWeight:800,color:"#ef4444",fontSize:m?18:22,margin:"0 0 8px"}}>{t("تم انتهاء العضوية", "Membership Expired")}</h2>
            <p style={{fontSize:14,color:c.textMuted,margin:"0 0 24px",lineHeight:1.7}}>{t("تواصل مع خدمة العملاء لتجديد العضوية", "Contact customer service to renew your membership")}</p>
            <p style={{fontSize:13,color:c.textMuted}}>📞 201120730109</p>
          </div>
        )}

        {!isExpiredMembership && (<>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: m ? 20 : 24, fontWeight: 900, color: c.text, marginBottom: 4 }}>
            {t("إنشاء حساب لشخص آخر", "Create Account for Another User")}
          </h1>
          <p style={{ fontSize: 13, color: c.textMuted }}>
            {t(`سيتم خصم ${cost} E-Money من رصيدك`, `${cost} E-Money will be deducted from your balance`)}
          </p>
          {profile && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 16px", borderRadius: 10, background: (profile.e_money || 0) >= cost ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", border: `1px solid ${(profile.e_money || 0) >= cost ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.2)"}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: (profile.e_money || 0) >= cost ? "#22c55e" : "#ef4444" }}>
                {t("رصيدك:", "Your balance:")} {Math.floor(profile.e_money || 0)} E-Money
              </span>
            </div>
          )}
        </div>

        {/* Error / Success */}
        {err && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, color: "#ef4444", fontSize: 13, textAlign: "center" }}>⚠️ {err}</div>}
        {success && <div style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, color: "#22c55e", fontSize: 13, textAlign: "center" }}>✅ {success}</div>}

        {/* Form Card */}
        <div style={{ background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 16, padding: m ? "20px 16px" : "28px 24px", marginBottom: 24 }}>
          <form onSubmit={submit} autoComplete="off">
            {/* Full Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t(" الاسم كما هو مُدوَّن في البطاقة", "Name as shown on your ID")}</label>
              <input type="text" required placeholder={t("أدخل اسم الشخص", "Enter person's name")} value={form.full_name} onChange={e => setField("full_name", e.target.value)} style={inputS} onFocus={onFocus} onBlur={onBlur} />
            </div>

            {/* Phone + Email row */}
            <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("رقم الهاتف", "Phone")}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                    style={{ ...inputS, width: 110, flexShrink: 0, padding: "12px 8px", fontSize: 12 }}>
                    {Object.entries(COUNTRY_CODE_MAP).map(([code, data]) => (
                      <option key={code} value={code}>{code} ({data.name})</option>
                    ))}
                  </select>
                  <input type="tel" required placeholder="xxxxxxxxxxx" value={form.phone} onChange={e => setField("phone", e.target.value)} style={{ ...inputS, flex: 1 }} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("البريد الإلكتروني", "Email")}</label>
                <input type="email" required placeholder="mail@example.com" value={form.email} onChange={e => setEmail(e.target.value)} style={inputS} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Password row */}
            <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("كلمة المرور", "Password")}</label>
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} required placeholder="••••••••" ref={passRef} readOnly autoComplete="new-password" value={form.password} onChange={e => setField("password", e.target.value)} style={{ ...inputS, paddingRight: 44 }} onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: c.textMuted }}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("تأكيد كلمة المرور", "Confirm Password")}</label>
                <input type={showPass ? "text" : "password"} required placeholder="••••••••" ref={confirmRef} readOnly autoComplete="new-password" value={form.confirm} onChange={e => setField("confirm", e.target.value)} style={inputS} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Password strength */}
            {form.password.length > 0 && (
              <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: c.bgInput, border: `1px solid ${c.border}` }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10 }}>
                  {[
                    { ok: form.password.length >= 8, label: t("8 أحرف+", "8+ chars") },
                    { ok: /[A-Z]/.test(form.password), label: t("كبير", "UP") },
                    { ok: /[a-z]/.test(form.password), label: t("صغير", "lo") },
                    { ok: /[0-9]/.test(form.password), label: t("رقم", "#") },
                    { ok: /[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/~`]/.test(form.password), label: t("رمز", "!@") },
                  ].map((r, i) => (
                    <span key={i} style={{ padding: "2px 7px", borderRadius: 5, fontWeight: 600, background: r.ok ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.08)", color: r.ok ? "#22c55e" : "#ef4444", border: `1px solid ${r.ok ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.15)"}` }}>
                      {r.ok ? "✓" : "✗"} {r.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Country */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("الدولة", "Country")}</label>
              <input type="text" list="countries" value={form.country} onChange={e => setField("country", e.target.value)}
                placeholder={t("ابحث عن الدولة...", "Search country...")}
                style={{ ...inputS }} onFocus={onFocus} onBlur={onBlur} />
              <datalist id="countries">
                {ALL_COUNTRIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Governorate (Egypt only) */}
            {form.country === "مصر" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("المحافظة", "Governorate")}</label>
              <select required value={form.governorate} onChange={e => setField("governorate", e.target.value)} style={{ ...inputS, cursor: "pointer" }} onFocus={onFocus} onBlur={onBlur}>
                <option value="">{t("اختر المحافظة", "Select Governorate")}</option>
                {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            )}

            {/* ID Card / Passport */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 700, color: c.text }}>{t("صورة البطاقة أو الباسبور", "ID Card or Passport")}</label>
              {idCard ? (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `2px solid #22c55e` }}>
                  <img src={idCard} alt="ID" style={{ width: "100%", maxHeight: 180, objectFit: "contain", background: "#000", display: "block" }} />
                  <button type="button" onClick={() => setIdCard(null)} style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "rgba(239,68,68,.9)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              ) : (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 12, background: c.bgInput, border: `2px dashed ${c.border}`, color: c.textMuted, fontSize: 13, cursor: "pointer", transition: "0.3s" }}>
                  <input type="file" accept="image/*" hidden onChange={e => handleImageUpload(e.target.files[0], setIdCard)} />
                  {uploadingImg === setIdCard ? "⏳" : "📷 " + t("اضغط لرفع الصورة", "Click to upload")}
                </label>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: "100%", height: 52, borderRadius: 14, border: "none",
              cursor: loading ? "default" : "pointer",
              background: loading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`,
              color: "#fff", fontSize: 15, fontWeight: 800,
              boxShadow: loading ? "none" : `0 8px 30px rgba(110,59,242,.3)`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              {loading ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                : `👤 ${t(`إنشاء حساب (${cost} E-Money)`, `Create Account (${cost} E-Money)`)}`}
            </button>
          </form>
        </div>

        {/* Created Users List */}
        {createdUsers.length > 0 && (
          <div style={{ background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 16, padding: m ? "16px" : "24px" }}>
            <h3 style={{ fontSize: m ? 15 : 17, fontWeight: 700, color: "#B88BFF", marginBottom: 14 }}>{t("الحسابات التي أنشأتها", "Accounts You Created")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {createdUsers.map((u, i) => (
                <div key={u.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: c.bgInput, border: `1px solid ${c.border}` }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6E3BF2,#6E3BF2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {(u.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: c.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.full_name}</p>
                    <p style={{ fontSize: 11, color: c.textMuted, margin: 0 }}>{u.email}</p>
                  </div>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, fontWeight: 600, background: u.status === "active" ? "rgba(34,197,94,.12)" : u.status === "pending" ? "rgba(255,191,0,.12)" : "rgba(239,68,68,.08)", color: u.status === "active" ? "#22c55e" : u.status === "pending" ? "#ffbf00" : "#ef4444" }}>
                    {u.status === "active" ? t("مفعّل", "Active") : u.status === "pending" ? t("قيد المراجعة", "Pending") : u.status === "rejected" ? t("مرفوض", "Rejected") : u.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

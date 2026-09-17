import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { api, pingBackend } from "../App";

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};

const keyframes = `
@keyframes loginFadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
@keyframes loginSlideLeft { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }
@keyframes loginSlideRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
@keyframes loginPulse { 0%,100%{box-shadow:0 0 0 0 rgba(110,59,242,0.3)} 50%{box-shadow:0 0 30px 10px rgba(110,59,242,0.15)} }
@keyframes loginFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
`;

export default function LoginPage() {
  const { t, lang } = useLang();
  const { user: authUser, login } = useAuth();
  const { theme, colors: c } = useTheme();
  const nav = useNavigate();
  const m = useIsMobile();

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState(0); // 0=off, 1=email, 2=otp, 3=newPass
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotErr, setForgotErr] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const emailRef = useRef(null);
  const passRef = useRef(null);

  // Redirect browser back to landing page instead of previous history
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onBack = () => nav("/", { replace: true });
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [nav]);

  const [deviceActive, setDeviceActive] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setDeviceActive(false); setLoading(true);
    try {
      // Read from the DOM refs (what is actually in the fields) instead of React
      // state — Safari/Chrome autofill and mobile/IME keyboards fill the DOM
      // without firing onChange, and the fields are uncontrolled so React never
      // reverts them on re-render.
      const rawEmail = emailRef.current?.value ?? form.email;
      const rawPass = passRef.current?.value ?? form.password;
      if (!rawEmail || !rawEmail.trim() || !rawPass) {
        setErr(t("أدخل البريد الإلكتروني وكلمة المرور", "Enter your email and password"));
        setLoading(false);
        return;
      }
      const payload = {
        email: rawEmail.trim().toLowerCase().replace(/[\s\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\u00ad]/g, ""),
        password: rawPass.replace(/[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\u00ad\ufeff]/g, "").trim(),
      };
      const { user, session_token } = await api("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
      login(user, session_token);
      setForm({ email: "", password: "" });
      window.history.replaceState(null, "", "/home");
      nav("/home", { replace: true });
    } catch (e) {
      if (e.code === "DEVICE_ALREADY_ACTIVE") {
        setDeviceActive(true);
      } else if (e.network) {
        pingBackend().then((backendOk) => {
          setErr(
            backendOk
              ? t(
                  "تعذر إتمام الطلب — المتصفح يمنع الاتصال بالخادم (كاش قديم). امسح بيانات الموقع في إعدادات Chrome (Site Settings) ثم أعد المحاولة.",
                  "Connection to the server was blocked by the browser (stale cache). Clear the site's data in Chrome Site Settings and retry."
                )
              : t(
                  "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.",
                  "Can't reach the server. Check your internet connection and retry."
                )
          );
        }).catch(() => {
          setErr(t("تعذر الاتصال بالخادم. أعد المحاولة.", "Can't reach the server. Please retry."));
        });
      } else {
        setErr(t(e.message || "بيانات الدخول غير صحيحة", e.message || "Invalid login credentials"));
      }
    }
    setLoading(false);
  };

  const gold = "#6E3BF2";

  const handleForgotRequestOTP = async () => {
    if (!forgotEmail.trim()) { setForgotErr(t("أدخل بريدك الإلكتروني", "Enter your email")); return; }
    setForgotLoading(true); setForgotErr("");
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: forgotEmail.trim() }) });
      setForgotStep(2);
    } catch (e) { setForgotErr(e.message || t("حدث خطأ", "Error")); }
    setForgotLoading(false);
  };

  const handleForgotVerifyOTP = async () => {
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) { setForgotErr(t("أدخل كود OTP صحيح", "Enter valid OTP")); return; }
    setForgotLoading(true); setForgotErr("");
    try {
      await api("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim() }) });
      setForgotStep(3);
    } catch (e) { setForgotErr(e.message || t("الكود غير صحيح", "Invalid code")); }
    setForgotLoading(false);
  };

  const handleForgotResetPassword = async () => {
    if (!forgotNewPass || forgotNewPass.length < 6) { setForgotErr(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters")); return; }
    if (forgotNewPass !== forgotConfirmPass) { setForgotErr(t("كلمتا المرور غير متطابقتين", "Passwords do not match")); return; }
    setForgotLoading(true); setForgotErr("");
    try {
      await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email: forgotEmail.trim(), otp: forgotOtp.trim(), new_password: forgotNewPass }) });
      setForgotSuccess(true);
    } catch (e) { setForgotErr(e.message || t("حدث خطأ", "Error")); }
    setForgotLoading(false);
  };

  const resetForgot = () => { setForgotStep(0); setForgotEmail(""); setForgotOtp(""); setForgotNewPass(""); setForgotConfirmPass(""); setForgotErr(""); setForgotSuccess(false); };

  const forgotModal = forgotStep > 0 ? (
    <div key="forgot-modal" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 20, padding: m ? "24px 18px" : "32px 28px", width: "100%", maxWidth: 420, position: "relative" }}>
        <button onClick={resetForgot} style={{ position: "absolute", top: 14, left: 14, background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 14, color: c.text, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        {forgotSuccess ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: c.text, marginBottom: 8 }}>{t("تم تغيير كلمة المرور!", "Password changed!")}</h3>
            <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 20 }}>{t("يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.", "You can now login with your new password.")}</p>
            <button onClick={resetForgot} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${gold}, ${gold}cc)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              {t("تسجيل الدخول", "Login")}
            </button>
          </div>
        ) : forgotStep === 1 ? (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📧</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: c.text, marginBottom: 6 }}>{t("نسيت كلمة المرور؟", "Forgot Password?")}</h3>
            <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 18, lineHeight: 1.6 }}>{t("أدخل بريدك الإلكتروني المرتبط بحسابك وسنرسل لك كود التحقق.", "Enter the email linked to your account and we'll send you a verification code.")}</p>
            {forgotErr && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, color: c.error || "#ef4444", fontSize: 12, textAlign: "center" }}>⚠️ {forgotErr}</div>}
            <input type="email" placeholder={t("البريد الإلكتروني", "Email address")} value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setForgotErr(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: c.bgInput, border: `2px solid ${c.border}`, color: c.text, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16, direction: "ltr", textAlign: "center", letterSpacing: 1 }}
              onFocus={e => e.target.style.borderColor = gold} onBlur={e => e.target.style.borderColor = c.border} />
            <button onClick={handleForgotRequestOTP} disabled={forgotLoading} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: forgotLoading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: forgotLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {forgotLoading ? <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> : t("إرسال الكود", "Send Code")}
            </button>
          </div>
        ) : forgotStep === 2 ? (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: c.text, marginBottom: 6 }}>{t("أدخل كود التحقق", "Enter Verification Code")}</h3>
            <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 18, lineHeight: 1.6 }}>{t(`تم إرسال كود من 6 أرقام إلى ${forgotEmail}`, `A 6-digit code was sent to ${forgotEmail}`)}</p>
            {forgotErr && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, color: c.error || "#ef4444", fontSize: 12, textAlign: "center" }}>⚠️ {forgotErr}</div>}
            <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={forgotOtp} onChange={e => { setForgotOtp(e.target.value.replace(/\D/g, "")); setForgotErr(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: c.bgInput, border: `2px solid ${c.border}`, color: c.text, fontSize: 22, fontWeight: 700, outline: "none", boxSizing: "border-box", marginBottom: 16, direction: "ltr", textAlign: "center", letterSpacing: 12 }}
              onFocus={e => e.target.style.borderColor = gold} onBlur={e => e.target.style.borderColor = c.border} />
            <button onClick={handleForgotVerifyOTP} disabled={forgotLoading} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: forgotLoading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: forgotLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {forgotLoading ? <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> : t("تحقق", "Verify")}
            </button>
          </div>
        ) : forgotStep === 3 ? (
          <div>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: c.text, marginBottom: 6 }}>{t("كلمة مرور جديدة", "New Password")}</h3>
            <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 18 }}>{t("أدخل كلمة المرور الجديدة لحسابك.", "Enter the new password for your account.")}</p>
            {forgotErr && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, color: c.error || "#ef4444", fontSize: 12, textAlign: "center" }}>⚠️ {forgotErr}</div>}
            <input type="password" placeholder={t("كلمة المرور الجديدة", "New password")} value={forgotNewPass} onChange={e => { setForgotNewPass(e.target.value); setForgotErr(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: c.bgInput, border: `2px solid ${c.border}`, color: c.text, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              onFocus={e => e.target.style.borderColor = gold} onBlur={e => e.target.style.borderColor = c.border} />
            <input type="password" placeholder={t("تأكيد كلمة المرور", "Confirm password")} value={forgotConfirmPass} onChange={e => { setForgotConfirmPass(e.target.value); setForgotErr(""); }}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: c.bgInput, border: `2px solid ${c.border}`, color: c.text, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
              onFocus={e => e.target.style.borderColor = gold} onBlur={e => e.target.style.borderColor = c.border} />
            <button onClick={handleForgotResetPassword} disabled={forgotLoading} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: forgotLoading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`, color: "#fff", fontWeight: 800, fontSize: 15, cursor: forgotLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {forgotLoading ? <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> : t("تغيير كلمة المرور", "Change Password")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  // ─── MOBILE LAYOUT ───
  if (m) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", flexDirection: "column" }}>

        {/* Gradient Header */}
        <div style={{
          position: "relative", padding: "60px 24px 40px", textAlign: "center", overflow: "hidden",
          background: "linear-gradient(160deg, #0a0a12 0%, #12101e 40%, #1a1428 70%, #0d0b16 100%)",
          borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
        }}>
          {/* Back button */}
          <Link to="/" style={{
            position: "absolute", top: 16, left: 16, zIndex: 5,
            display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
            color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600,
            padding: "6px 12px", borderRadius: 10,
            background: "rgba(255,255,255,.06)", backdropFilter: "blur(8px)",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            {t("العودة", "Back")}
          </Link>

          {/* Orb decorations */}
          <div style={{ position: "absolute", top: "20%", left: "10%", width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(110,59,242,.15) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "15%", width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />

          {/* Logo */}
          <div style={{
            width: 80, height: 80, margin: "0 auto 16px", borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(110,59,242,.2), rgba(110,59,242,.05))",
            border: "2px solid rgba(110,59,242,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src="/image/logo3.png" alt="Logo" style={{ height: 44, objectFit: "contain" }} />
          </div>

          <h1 style={{
            fontSize: 22, fontWeight: 900, marginBottom: 6,
            background: "linear-gradient(135deg, #6E3BF2, #B88BFF, #6E3BF2)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Everest Academy</h1>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, fontWeight: 500 }}>
            {t("مرحباً بك مجدداً", "Welcome Back")}
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          flex: 1, margin: "-20px 16px 24px", padding: "28px 20px",
          background: c.bgCard, borderRadius: 20,
          border: `1px solid ${c.borderLight}`,
          boxShadow: `0 20px 60px ${c.shadow}`,
        }}>

          {/* Error */}
          {err && (
            <div style={{
              background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
              borderRadius: 12, padding: "10px 14px", marginBottom: 16,
              color: c.error || "#ef4444", fontSize: 13, textAlign: "center",
            }}>⚠️ {err}</div>
          )}

          {/* Device Already Active */}
          {deviceActive && (
            <div style={{
              background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.25)",
              borderRadius: 14, padding: "14px 16px", marginBottom: 16,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
              <p style={{ fontWeight: 700, color: c.text, fontSize: 14, marginBottom: 6 }}>
                {t("الحساب مسجل الدخول على جهاز آخر", "Account is logged in on another device")}
              </p>
              <p style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.7, margin: 0 }}>
                {t(
                  "هذا الحساب مسجل الدخول على جهاز آخر. يرجى تسجيل الخروج من ذلك الجهاز أولاً ثم حاول مرة أخرى.",
                  "This account is already logged in on another device. Please log out from that device first, then try again."
                )}
              </p>
            </div>
          )}

          {/* Email Not Verified */}
          <form onSubmit={submit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: c.text }}>
                {t("البريد الإلكتروني", "Email")}
              </label>
              <input
                type="email" required name="email"
                placeholder={t("أدخل بريدك الإلكتروني", "Enter your email")}
                ref={emailRef} autoComplete="username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                defaultValue="" onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: 14,
                  background: c.bgInput, border: `2px solid ${c.border}`,
                  color: c.text, fontSize: 15, outline: "none", transition: "0.3s", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = gold}
                onBlur={e => e.target.style.borderColor = c.border}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: c.text }}>
                {t("كلمة المرور", "Password")}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} required name="password"
                  placeholder="••••••••"
                  ref={passRef} autoComplete="current-password"
                  defaultValue="" onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{
                    width: "100%", padding: "14px 48px 14px 16px", borderRadius: 14,
                    background: c.bgInput, border: `2px solid ${c.border}`,
                    color: c.text, fontSize: 15, outline: "none", transition: "0.3s", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = gold}
                  onBlur={e => e.target.style.borderColor = c.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", fontSize: 18,
                    color: c.textMuted, padding: 4,
                  }}
                >{showPass ? "🙈" : "👁"}</button>
              </div>
            </div>

            {/* Show password + forgot */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={showPass} onChange={() => setShowPass(!showPass)}
                  style={{ width: 15, height: 15, accentColor: gold }} />
                <span style={{ fontSize: 12, color: c.textSoft }}>{t("إظهار الباسورد", "Show")}</span>
              </label>
              <a href="#" onClick={(e) => { e.preventDefault(); setForgotStep(1); }} style={{ fontSize: 12, color: gold, textDecoration: "none", fontWeight: 600 }}>
                {t("نسيت كلمة المرور؟", "Forgot?")}
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", height: 52, borderRadius: 14, border: "none",
                cursor: loading ? "default" : "pointer",
                background: loading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`,
                color: "#fff", fontSize: 16, fontWeight: 800,
                boxShadow: loading ? "none" : `0 8px 30px rgba(110,59,242,.3)`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (
                <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
              ) : <>🔑 {t("تسجيل الدخول", "Login")}</>}
            </button>
          </form>

          {/* Register link */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <p style={{ fontSize: 14, color: c.textMuted }}>
              {t("ليس لديك حساب؟", "Don't have an account?")}{" "}
              <Link to="/register" style={{ color: gold, textDecoration: "none", fontWeight: 700 }}>
                {t("سجل الآن", "Register")}
              </Link>
            </p>
          </div>
        </div>
        {forgotModal}
      </div>
    );
  }

  // ─── DESKTOP / TABLET LAYOUT ───
  return (
    <>
      <style>{keyframes}</style>
      <div style={{
        minHeight: "100vh", display: "flex", direction: lang === "ar" ? "rtl" : "ltr",
        background: c.bg, overflow: "hidden",
      }}>

        {/* Left Panel — Image & Branding */}
        <div style={{
          flex: 1, position: "relative", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", overflow: "hidden",
          background: `linear-gradient(135deg, #0a0a12 0%, #12101e 40%, #1a1428 70%, #0d0b16 100%)`,
        }}>
          {/* Background orbs */}
          <div style={{ position: "absolute", top: "15%", left: "10%", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(110,59,242,.12) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "20%", right: "15%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(73,94,233,.1) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "60%", width: 150, height: 150, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,.08) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

          {/* Spinning decorative ring */}
          <div style={{
            position: "absolute", width: 400, height: 400, borderRadius: "50%",
            border: "1px dashed rgba(110,59,242,.08)",
            animation: "spin 30s linear infinite",
          }} />
          <div style={{
            position: "absolute", width: 500, height: 500, borderRadius: "50%",
            border: "1px dashed rgba(212,175,255,.05)",
            animation: "spin 45s linear infinite reverse",
          }} />

          {/* Main image */}
          <div style={{
            position: "relative", zIndex: 2, animation: "loginSlideLeft 0.8s ease-out",
          }}>
            <div style={{
              width: 380, height: 380, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(110,59,242,.15), rgba(110,59,242,.03))",
              border: "2px solid rgba(110,59,242,.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "loginPulse 4s ease-in-out infinite",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: -15, borderRadius: "50%",
                border: "1px dashed rgba(110,59,242,.1)",
                animation: "spin 20s linear infinite",
              }} />
              <img
                src="/image/ChatGPT_Image_Jun_15__2026__04_00_05_AM-removebg-preview.png"
                alt="Everest Academy"
                style={{
                  width: 320, height: 320, objectFit: "contain",
                  filter: "drop-shadow(0 20px 50px rgba(110,59,242,.2))",
                  animation: "loginFloat 5s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Brand text below image */}
          <div style={{
            position: "relative", zIndex: 2, textAlign: "center", marginTop: 36,
            animation: "loginFadeIn 0.8s ease-out 0.3s both",
          }}>
          
          
          </div>

          {/* Floating dots */}
          {[
            { top: "10%", left: "20%", size: 6, delay: "0s", dur: "3s" },
            { top: "30%", right: "25%", size: 4, delay: "1s", dur: "4s" },
            { bottom: "15%", left: "30%", size: 5, delay: "0.5s", dur: "3.5s" },
            { top: "60%", left: "8%", size: 3, delay: "1.5s", dur: "4.5s" },
            { bottom: "30%", right: "10%", size: 4, delay: "2s", dur: "3s" },
          ].map((d, i) => (
            <div key={i} style={{
              position: "absolute", ...d, width: d.size, height: d.size,
              borderRadius: "50%", background: gold, opacity: .3,
              animation: `loginFloat ${d.dur} ease-in-out infinite ${d.delay}`,
              pointerEvents: "none",
            }} />
          ))}
        </div>

        {/* Right Panel — Login Form */}
        <div style={{
          width: "48%", minWidth: 440, maxWidth: 560,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "50px 60px",
          background: c.bg,
          position: "relative",
          animation: "loginSlideRight 0.8s ease-out",
        }}>

          {/* Back link */}
          <div style={{ position: "absolute", top: 30, left: lang === "ar" ? 30 : "auto", right: lang === "ar" ? "auto" : 30 }}>
            <Link to="/" style={{
              display: "flex", alignItems: "center", gap: 8,
              textDecoration: "none", color: c.textMuted, fontSize: 14, fontWeight: 600,
              padding: "8px 16px", borderRadius: 12,
              background: c.bgCard, border: `1px solid ${c.border}`,
              transition: "0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = gold; e.currentTarget.style.color = gold; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              {t("العودة", "Back")}
            </Link>
          </div>

          {/* Form card */}
          <div style={{ width: "100%", maxWidth: 420 }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <img src="/image/logo3.png" alt="Logo" style={{ height: 70, marginBottom: 16 }} />
              <h1 style={{
                fontSize: 28, fontWeight: 900, color: c.text, marginBottom: 6,
              }}>{t("مرحباً بك مجدداً", "Welcome Back")}</h1>
              <p style={{ color: c.textMuted, fontSize: 15 }}>
                {t("سجل دخولك للوصول إلى حسابك", "Sign in to access your account")}
              </p>
            </div>

            {/* Error */}
            {err && (
              <div style={{
                background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
                borderRadius: 12, padding: "12px 16px", marginBottom: 20,
                color: c.error || "#ef4444", fontSize: 13, textAlign: "center",
              }}>
                ⚠️ {err}
              </div>
            )}

            {/* Device Already Active */}
            {deviceActive && (
              <div style={{
                background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.25)",
                borderRadius: 14, padding: "16px 20px", marginBottom: 20,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                <p style={{ fontWeight: 700, color: c.text, fontSize: 15, marginBottom: 6 }}>
                  {t("الحساب مسجل الدخول على جهاز آخر", "Account is logged in on another device")}
                </p>
                <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.7, margin: 0 }}>
                  {t(
                    "هذا الحساب مسجل الدخول على جهاز آخر. يرجى تسجيل الخروج من ذلك الجهاز أولاً ثم حاول مرة أخرى.",
                    "This account is already logged in on another device. Please log out from that device first, then try again."
                  )}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit}>
              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: c.text }}>
                  {t("البريد الإلكتروني", "Email")}
                </label>
                <input
                  type="email" required name="email"
                  placeholder={t("أدخل بريدك الإلكتروني", "Enter your email")}
                  ref={emailRef} autoComplete="username"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  defaultValue="" onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{
                    width: "100%", padding: "14px 18px", borderRadius: 14,
                    background: c.bgCard, border: `2px solid ${c.border}`,
                    color: c.text, fontSize: 15, outline: "none", transition: "0.3s",
                  }}
                  onFocus={e => e.target.style.borderColor = gold}
                  onBlur={e => e.target.style.borderColor = c.border}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: c.text }}>
                  {t("كلمة المرور", "Password")}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"} required name="password"
                    placeholder="••••••••"
                    ref={passRef} autoComplete="current-password"
                    defaultValue="" onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{
                      width: "100%", padding: "14px 50px 14px 18px", borderRadius: 14,
                      background: c.bgCard, border: `2px solid ${c.border}`,
                      color: c.text, fontSize: 15, outline: "none", transition: "0.3s",
                    }}
                    onFocus={e => e.target.style.borderColor = gold}
                    onBlur={e => e.target.style.borderColor = c.border}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", fontSize: 18,
                      color: c.textMuted, padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              {/* Options row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={showPass} onChange={() => setShowPass(!showPass)}
                    style={{ width: 16, height: 16, accentColor: gold }} />
                  <span style={{ fontSize: 13, color: c.textSoft }}>{t("إظهار الباسورد", "Show Password")}</span>
                </label>
                <a href="#" onClick={(e) => { e.preventDefault(); setForgotStep(1); }} style={{ fontSize: 13, color: gold, textDecoration: "none", fontWeight: 600 }}>
                  {t("نسيت كلمة المرور؟", "Forgot Password?")}
                </a>
              </div>

              {/* Submit button */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none", cursor: loading ? "default" : "pointer",
                  background: loading ? c.border : `linear-gradient(135deg, ${gold}, ${gold}cc)`,
                  color: "#fff", fontSize: 16, fontWeight: 800,
                  boxShadow: loading ? "none" : `0 8px 30px rgba(110,59,242,.3)`,
                  transition: "all .3s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(110,59,242,.45)"; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 8px 30px rgba(110,59,242,.3)`; } }}
              >
                {loading ? (
                  <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                ) : (
                  <>
                    🔑 {t("تسجيل الدخول", "Login")}
                  </>
                )}
              </button>
            </form>

            {/* Register link */}
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <p style={{ fontSize: 14, color: c.textMuted }}>
                {t("ليس لديك حساب؟", "Don't have an account?")}{" "}
                <Link to="/register" style={{ color: gold, textDecoration: "none", fontWeight: 700 }}>
                  {t("سجل الآن مجاناً", "Register Now")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      {forgotModal}
    </>
  );
}

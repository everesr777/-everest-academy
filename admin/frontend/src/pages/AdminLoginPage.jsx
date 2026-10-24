import React, { useState } from "react";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { BACKEND_URL } from "../api.js";

export default function AdminLoginPage({ onLogin }) {
  const { t: tFn } = useLang();
  const { theme, toggle } = useTheme();
  const t = (ar, en) => tFn(ar, en);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setLoading(false); return; }
      localStorage.setItem("admin_session", JSON.stringify({ userId: d.user.id, token: d.session_token, user: d.user }));
      onLogin(d.user);
    } catch (err) { setError(t("خطأ في الاتصال بالخادم", "Connection error")); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-everest-950 via-everest-900 to-everest-800 flex items-center justify-center p-4">
      {/* Theme toggle */}
              <button data-no-confirm onClick={toggle} title={theme === "dark" ? "Light Mode" : "Dark Mode"} className="absolute top-4 end-4 z-10 w-10 h-10 rounded-xl flex items-center justify-center text-lg cursor-pointer transition border border-white/10 bg-white/5 hover:bg-white/10">
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {/* Decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-everest-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-everest-400/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-everest-500/20 border border-everest-400/30 mb-4 backdrop-blur-sm">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            <span className="text-everest-400">Everest</span> {t("لوحة الإدارة", "Admin Panel")}
          </h1>
          <p className="text-everest-300/70 text-sm">{t("سجّل الدخول للوصول إلى لوحة التحكم", "Sign in to access the admin dashboard")}</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm rounded-xl p-3 mb-4 text-center">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-everest-200 mb-1 block">{t("البريد الإلكتروني", "Email")}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@everest.com"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-everest-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-everest-200 mb-1 block">{t("كلمة المرور", "Password")}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-everest-400 focus:border-transparent transition"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-everest-500 hover:bg-everest-600 text-white font-bold rounded-xl transition disabled:opacity-50 shadow-lg shadow-everest-500/30"
          >
            {loading ? t("جاري الدخول...", "Signing in...") : t("🚪 دخول", "Sign In")}
          </button>
        </form>

        <p className="text-center text-everest-400/50 text-xs mt-6">© 2025 Everest Academy</p>
      </div>
    </div>
  );
}

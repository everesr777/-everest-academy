import React, { useState, useEffect, useRef, useCallback } from "react";
import { Routes, Route, Link, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { LangProvider, useLang } from "./LangContext";
import { ThemeProvider } from "./ThemeContext";
import ScreenProtection from "./components/ScreenProtection";
import PullToRefresh from "./components/PullToRefresh";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CoursesPage from "./pages/CoursesPage";
import CourseViewPage from "./pages/CourseViewPage";
import ProfilePage from "./pages/ProfilePage";
import RankingsPage from "./pages/RankingsPage";
import AffiliatePage from "./pages/AffiliatePage";
import AdminEnrollmentsPage from "./pages/AdminEnrollmentsPage";
import AdminPage from "./pages/AdminPage";
import FeedbackPage from "./pages/FeedbackPage";
import AddFeedbackPage from "./pages/AddFeedbackPage";
import PublicFeedbackPage from "./pages/PublicFeedbackPage";
import AboutPage from "./pages/AboutPage";
import FreeCoursesPage from "./pages/FreeCoursesPage";
import FreeCourseViewPage from "./pages/FreeCourseViewPage";
import PaymentPage from "./pages/PaymentPage";
import CardPaymentPage from "./pages/CardPaymentPage";
import InstaPayPage from "./pages/InstaPayPage";
import VodafoneCashPage from "./pages/VodafoneCashPage";
import VodafoneCashPurchasePage from "./pages/VodafoneCashPurchasePage";
import InstapayPurchasePage from "./pages/InstapayPurchasePage";
import TopUpPage from "./pages/TopUpPage";
import MyCoursesPage from "./pages/MyCoursesPage";
import TopSallerPage from "./pages/TopSallerPage";
import PendingActivationPage from "./pages/PendingActivationPage";
import AssistantPage from "./pages/AssistantPage";
import CreateAccountPage from "./pages/CreateAccountPage";
import PurchaseAllPage from "./pages/PurchaseAllPage";
import MembershipExpiredOverlay from "./components/MembershipExpiredOverlay";
import WhatsAppFloat from "./components/WhatsAppFloat";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

class NetErr extends Error {
  constructor(kind) {
    super(kind === "timeout" ? "The request timed out" : "Failed to fetch");
    this.network = true;
    this.kind = kind;
  }
}

const fetchWithRetry = async (url, opts = {}, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { ...opts, signal: opts.signal || ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      // Timeout — no point retrying the same slow request twice, but a second
      // attempt often succeeds right after (server warm-up / flaky mobile net).
      if (e.name === "AbortError") {
        if (i < tries - 1) { await new Promise(r => setTimeout(r, 1000)); continue; }
        throw new NetErr("timeout");
      }
      // Network-level failure (DNS/TLS/CORS preflight blocked): "Failed to fetch".
      if (e instanceof TypeError || /fetch failed/i.test(e.message || "")) {
        if (i < tries - 1) { await new Promise(r => setTimeout(r, 1200)); continue; }
        throw new NetErr("unreachable");
      }
      throw e;
    }
  }
};

const isLocal = () => window.location.origin.includes("localhost");
const proxyUrl = (path) => `/api.php?path=${encodeURIComponent(path)}`;

// Media URLs returned by the backend are absolute Railway URLs (e.g.
// https://up.railway.app/uploads/x.jpg). In Chrome those cross-origin
// sub-resource requests fail at the network layer — rewrite them to the
// same-origin proxy so covers/avatars load in every browser.
const MEDIA_BASE = "https://everest-academy-production.up.railway.app";
const mediaUrl = (u) =>
  typeof u === "string" && u.indexOf(MEDIA_BASE) === 0
    ? isLocal() ? u : proxyUrl(u.slice(MEDIA_BASE.length))
    : u;
const deepMedia = (v) => {
  if (typeof v === "string") return mediaUrl(v);
  if (Array.isArray(v)) return v.map(deepMedia);
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = deepMedia(v[k]); return o; }
  return v;
};

const apiRequest = async (path, opts = {}) => {
  const headers = { "Content-Type": "application/json" };
  const uid = localStorage.getItem("everest_user");
  const stoken = localStorage.getItem("everest_session_token");
  if (uid && stoken) { try { headers["x-user-id"] = JSON.parse(uid).id; headers["x-session-token"] = stoken; } catch {} }

  const attempt = async (url, omitCreds) =>
    fetchWithRetry(url, { ...opts, credentials: omitCreds ? "omit" : undefined, headers: { ...headers, ...opts.headers } });

  if (path.startsWith("http") || isLocal()) return attempt(`${BACKEND_URL}${path}`, true);
  try {
    return await attempt(`${BACKEND_URL}${path}`, true);
  } catch (e) {
    if (!e.network) throw e;
    try { return await attempt(proxyUrl(path), false); }
    catch { throw e; }
  }
};

// ---- In-memory server-state cache (stale-while-revalidate) ----
// GET responses are cached per user for 5 minutes. Returning to a visited
// page resolves instantly from the cache (no spinner); when a cached entry
// goes stale it is re-fetched in the background and swapped silently.
const CACHE = new Map();
const INFLIGHT = new Map();
const STALE_MS = 5 * 60 * 1000;

const cacheUserKey = () => {
  try {
    const d = JSON.parse(localStorage.getItem("everest_user") || "null");
    return (d && d.id) ? d.id : "anon";
  } catch { return "anon"; }
};
const cacheKeyOf = (path) => `${path}|${cacheUserKey()}`;

const fetchJson = async (path, opts) => {
  const res = await apiRequest(path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.session_expired) {
      localStorage.removeItem("everest_user");
      localStorage.removeItem("everest_session_token");
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    const err = new Error(body.error || `HTTP ${res.status}`);
    if (body.code) err.code = body.code;
    if (body.upgradeRequired) err.upgradeRequired = true;
    throw err;
  }
  return deepMedia(await res.json());
};

const revalidateKey = (path) => {
  const key = cacheKeyOf(path);
  fetchJson(path, {})
    .then(d => CACHE.set(key, { data: d, ts: Date.now(), path }))
    .catch(() => { /* keep the stale copy on network failure */ });
};

const api = async (path, opts = {}) => {
  const method = (opts.method || "GET").toUpperCase();
  const isGet = method === "GET" && opts.cache !== false;
  if (!isGet) {
    // Writes must always hit the network and invalidate cached reads.
    const data = await fetchJson(path, opts);
    if (method !== "GET") CACHE.clear();
    if (opts.cache === false && method === "GET") INFLIGHT.delete(cacheKeyOf(path));
    return data;
  }
  const key = cacheKeyOf(path);
  const now = Date.now();
  const hit = CACHE.get(key);
  if (hit && now - hit.ts < STALE_MS) return hit.data;        // fresh → instant
  if (hit) { revalidateKey(path); return hit.data; }          // stale → SWR
  let p = INFLIGHT.get(key);
  if (!p) {
    p = fetchJson(path, opts)
      .then(d => { CACHE.set(key, { data: d, ts: Date.now(), path }); INFLIGHT.delete(key); return d; })
      .catch(e => { INFLIGHT.delete(key); throw e; });
    INFLIGHT.set(key, p);
  }
  return p;
};

// Force a full background revalidation (used by pull-to-refresh): wipe the
// cache, then silently re-fetch every previously seen URL to repopulate it.
const apiRevalidateAll = () => {
  const seen = [...CACHE.values()].map(e => e.path);
  CACHE.clear();
  INFLIGHT.clear();
  seen.forEach(revalidateKey);
};

const apiClearCache = () => { CACHE.clear(); INFLIGHT.clear(); };

// Lightweight connectivity self-test. Tries the direct backend, then the
// same-origin proxy, so "can't reach the server" is only reported when the
// site's own host really is unreachable.
const pingBackend = async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  const ping = (url) => fetch(url, { credentials: "omit", signal: ctrl.signal }).then(r => r.ok).catch(() => false);
  try {
    if (isLocal()) return await ping(`${BACKEND_URL}/api/pricing`);
    if (await ping(`${BACKEND_URL}/api/pricing`)) return true;
    return await ping(proxyUrl("/api/pricing"));
  } finally {
    clearTimeout(timer);
  }
};

const uploadApi = async (formData) => {
  const uploadUrl = window.location.origin.includes("localhost")
    ? `${BACKEND_URL}/api/upload`
    : '/upload.php';
  const uid = localStorage.getItem("everest_user");
  const stoken = localStorage.getItem("everest_session_token");
  const headers = {};
  if (uid && stoken) { try { headers["x-user-id"] = JSON.parse(uid).id; headers["x-session-token"] = stoken; } catch {} }
  const res = await fetch(uploadUrl, { method: "POST", headers, body: formData });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};

function Guard({ children }) {
  const { user } = useAuth();
  const { t } = useLang();
  if (!user) return <div className="auth-body"><div style={{textAlign:"center"}}><p style={{fontSize:18,marginBottom:16}}>{t("الرجاء تسجيل الدخول", "Please log in")}</p><Link to="/login" style={{color:"#6a0dad",fontWeight:700}}>{t("دخول", "Login")}</Link></div></div>;
  return children;
}

function GuardRanks({ children }) {
  const { user } = useAuth();
  const { t } = useLang();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuardAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <div className="auth-body"><div style={{textAlign:"center"}}><p style={{fontSize:18,marginBottom:16}}>الرجاء تسجيل الدخول</p><Link to="/login" style={{color:"#6a0dad",fontWeight:700}}>دخول</Link></div></div>;
  if (user.role !== "admin") return <div className="auth-body"><div style={{textAlign:"center"}}><p style={{fontSize:18,marginBottom:16}}>هذه الصفحة مخصصة للإدارة فقط</p><Link to="/dashboard" style={{color:"#6a0dad",fontWeight:700}}>الرئيسية</Link></div></div>;
  return children;
}

function MyCoursesRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/courses" />;
  return <MyCoursesPage />;
}

function ReferralRedirect() {
  const { code } = useParams();
  localStorage.setItem("everest_referral_code", code || "");
  return <Navigate to="/register" replace />;
}

export default function App() {
  const [pulse, setPulse] = useState(0);
  const handleRefresh = useCallback(() => {
    apiRevalidateAll();          // fresh data in the background
    setPulse((p) => p + 1);      // remount current route so its hooks re-run
  }, []);
  return (
    <AuthProvider>
      <LangProvider>
      <ThemeProvider>
      <ScreenProtection />
      <MembershipExpiredOverlay />
      <WhatsAppFloat />
      <PullToRefresh onRefresh={handleRefresh}>
      <Routes key={pulse}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<Guard><HomePage /></Guard>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<Guard><DashboardPage /></Guard>} />
        <Route path="/courses" element={<Guard><CoursesPage /></Guard>} />
        <Route path="/purchase-all" element={<PurchaseAllPage />} />
        <Route path="/my-courses" element={<Guard><MyCoursesRedirect /></Guard>} />
        <Route path="/courses/:id" element={<CourseViewPage />} />
        <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
        <Route path="/rankings" element={<GuardRanks><RankingsPage /></GuardRanks>} />
        <Route path="/affiliate" element={<Guard><AffiliatePage /></Guard>} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/free-courses" element={<FreeCoursesPage />} />
        <Route path="/free-courses/:id" element={<FreeCourseViewPage />} />
        <Route path="/feedback" element={<PublicFeedbackPage />} />
        <Route path="/feedback/new" element={<Guard><AddFeedbackPage /></Guard>} />
        <Route path="/courses/:id/vodafone-cash" element={<Guard><VodafoneCashPurchasePage /></Guard>} />
        <Route path="/courses/:id/instapay" element={<Guard><InstapayPurchasePage /></Guard>} />
        <Route path="/topup" element={<Guard><TopUpPage /></Guard>} />
        <Route path="/top-saller" element={<Guard><TopSallerPage /></Guard>} />
        <Route path="/admin/enrollments" element={<GuardAdmin><AdminEnrollmentsPage /></GuardAdmin>} />
        <Route path="/admin" element={<GuardAdmin><AdminPage /></GuardAdmin>} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/payment/card" element={<CardPaymentPage />} />
        <Route path="/payment/instapay" element={<InstaPayPage />} />
        <Route path="/payment/vodafone" element={<VodafoneCashPage />} />
        <Route path="/pending-activation" element={<PendingActivationPage />} />
        <Route path="/assistant" element={<Guard><AssistantPage /></Guard>} />
        <Route path="/create-account" element={<Guard><CreateAccountPage /></Guard>} />
        <Route path="/ref/:code" element={<ReferralRedirect />} />
      </Routes>
      </PullToRefresh>
      </ThemeProvider>
      </LangProvider>
    </AuthProvider>
  );
}

export { apiRequest, api, uploadApi, pingBackend, mediaUrl, deepMedia, apiRevalidateAll, apiClearCache, BACKEND_URL };

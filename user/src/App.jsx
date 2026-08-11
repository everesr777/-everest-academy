import React from "react";
import { Routes, Route, Link, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { LangProvider, useLang } from "./LangContext";
import { ThemeProvider } from "./ThemeContext";
import ScreenProtection from "./components/ScreenProtection";
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

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://steadfast-energy-production-a9d1.up.railway.app";

const api = async (path, opts = {}) => {
  const headers = { "Content-Type": "application/json" };
  const uid = localStorage.getItem("everest_user");
  const stoken = localStorage.getItem("everest_session_token");
  if (uid && stoken) { try { headers["x-user-id"] = JSON.parse(uid).id; headers["x-session-token"] = stoken; } catch {} }
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
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
  return res.json();
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
  return (
    <AuthProvider>
      <LangProvider>
      <ThemeProvider>
      <ScreenProtection />
      <MembershipExpiredOverlay />
      <WhatsAppFloat />
      <Routes>
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
      </ThemeProvider>
      </LangProvider>
    </AuthProvider>
  );
}

export { api, uploadApi, BACKEND_URL };

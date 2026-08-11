import React, { useState, useEffect, useRef } from "react";
import { LangProvider, useLang } from "./LangContext";
import { useTheme } from "./ThemeContext";
import { api, BACKEND_URL } from "./api.js";
import AdminLoginPage from "./pages/AdminLoginPage.jsx";
import RoleManagementPage from "./pages/RoleManagementPage.jsx";
import TopUpsPage from "./pages/TopUpsPage.jsx";
import CourseBuilderPage from "./pages/CourseBuilderPage.jsx";
import CoursesListPage from "./pages/CoursesListPage.jsx";
import QuizAttemptsPage from "./pages/QuizAttemptsPage.jsx";
import StudentListPage from "./pages/StudentListPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import AccountsBySourcePage from "./pages/AccountsBySourcePage.jsx";
import UpgradeRequestsPage from "./pages/UpgradeRequestsPage.jsx";
import LeadersPage from "./pages/LeadersPage.jsx";
import PaymentGatewayPage from "./pages/PaymentGatewayPage.jsx";
import RanksManagementPage from "./pages/RanksManagementPage.jsx";
import WeeklySettlementPage from "./pages/WeeklySettlementPage.jsx";
import RegistrationApprovalsPage from "./pages/RegistrationApprovalsPage.jsx";
import FeedbacksPage from "./pages/FeedbacksPage.jsx";
import AdminLogsPage from "./pages/AdminLogsPage.jsx";
import MembershipSettingsPage from "./pages/MembershipSettingsPage.jsx";
import AdminsListPage from "./pages/AdminsListPage.jsx";
import CustomerServicePage from "./pages/CustomerServicePage.jsx";
import FreeCoursesSettingsPage from "./pages/FreeCoursesSettingsPage.jsx";
import PricingSettingsPage from "./pages/PricingSettingsPage.jsx";
import TransactionsPage from "./pages/TransactionsPage.jsx";


function AppInner() {
  const [page, setPage] = useState("dashboard");
  const [stats, setStats] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const { lang, toggle, t } = useLang();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("admin_session") || "{}");
    if (!s.userId || !s.token) { setChecking(false); return; }
    fetch(`${BACKEND_URL}/api/admin-auth/me`, { headers: { "Content-Type": "application/json", "x-user-id": s.userId, "x-session-token": s.token } })
      .then(r => r.json())
      .then(d => { if (d.error) { localStorage.removeItem("admin_session"); } else { setCurrentUser(d); } })
      .catch(() => localStorage.removeItem("admin_session"))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (currentUser) api("/api/dashboard/stats").then(setStats);
  }, [currentUser]);

  const handleLogin = (user) => { setCurrentUser(user); setPage("dashboard"); };
  const handleLogout = () => { localStorage.removeItem("admin_session"); setCurrentUser(null); };

  if (checking) return <div className="min-h-screen bg-theme-primary flex items-center justify-center"><p className="text-theme-text-secondary text-lg animate-pulse">{t("جاري التحقق...", "Checking...")}</p></div>;
  if (!currentUser) return <LangProvider><AdminLoginPage onLogin={handleLogin} /></LangProvider>;

  const isManager = currentUser.role === "manager";

  const navItems = [
    { id: "dashboard", label: lang === "ar" ? "الإحصائيات" : "Dashboard", icon: "📊" },
    { id: "approvals-external", label: lang === "ar" ? "تفعيل الحسابات التسجيل الخارجى" : "External Sign-up Approvals", icon: "🔐" },
    { id: "approvals-created", label: lang === "ar" ? "تفعيل الحسابات انشاء حساب للاخر" : "Created Account Approvals", icon: "🔐" },
    { id: "users", label: lang === "ar" ? "إدارة المستخدمين" : "User Management", icon: "👤" },
    { id: "role-mgmt", label: lang === "ar" ? "إدارة الصلاحيات" : "Role Management", icon: "🔐" },
    { id: "external-accounts", label: lang === "ar" ? "حسابات التسجيل الخارجي" : "External Sign-up Accounts", icon: "📝" },
    { id: "created-accounts", label: lang === "ar" ? "حسابات إنشاء حساب لآخر" : "Created Accounts", icon: "👥" },
    { id: "course-builder", label: lang === "ar" ? "بناء الكورس" : "Course Builder", icon: "📝" },
    { id: "courses", label: lang === "ar" ? "قائمة الكورسات" : "Courses", icon: "📚" },
    { id: "free-courses", label: lang === "ar" ? " ظهور الكورسات" : "Course Visibility", icon: "👁️" },
    { id: "quiz-attempts", label: lang === "ar" ? "نتائج الاختبارات" : "Quiz Results", icon: "📋" },
    { id: "ranks-mgmt", label: lang === "ar" ? "إدارة الرتب" : "Ranks", icon: "🏅" },
    { id: "settlement-settings", label: lang === "ar" ? "التسوية الأسبوعية" : "Weekly Settlement", icon: "⏳" },
    { id: "leaders", label: lang === "ar" ? "القادة" : "Leaders", icon: "🏆" },
    { id: "admin-logs", label: lang === "ar" ? "سجل الإجراءات" : "Admin Logs", icon: "📋" },
    { id: "membership-settings", label: lang === "ar" ? "إعدادات العضوية" : "Membership", icon: "⏱️" },
    { id: "feedbacks", label: lang === "ar" ? "التقييمات" : "Feedbacks", icon: "💬" },
    { id: "cs", label: lang === "ar" ? "خدمة العملاء" : "Customer Service", icon: "📞" },
    { id: "pricing", label: lang === "ar" ? "إعدادات الأسعار" : "Pricing Settings", icon: "💰" },
    { id: "transactions", label: lang === "ar" ? "سجل المعاملات" : "Transactions", icon: "💳" },

    ...(isManager ? [{ id: "admins-mgmt", label: lang === "ar" ? "👥 إدارة الأدمنز" : "👥 Admin Management", icon: "👥" }] : []),
    { id: "profile-settings", label: lang === "ar" ? "الإعدادات الشخصية" : "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex h-screen bg-theme-primary theme-transition" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Sidebar navItems={navItems} current={page} onChange={setPage} />
      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-theme-text-secondary">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isManager ? 'badge-amber' : 'badge-blue'}`}>
                {isManager ? '👑 Manager' : '🔧 Admin'}
              </span>
              <span className="hidden sm:inline">{currentUser.full_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="w-9 h-9 flex items-center justify-center rounded-lg border border-theme-border bg-theme-surface shadow-card hover:bg-theme-surface-hover text-lg">
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              <button onClick={toggle} className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-theme-surface border border-theme-border rounded-lg shadow-card hover:bg-theme-surface-hover text-theme-text-primary">
                {lang === "ar" ? "English" : "العربية"}
              </button>
              <button onClick={handleLogout} className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-theme-surface text-theme-text-secondary border border-theme-border rounded-lg shadow-card hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition">
                🚪 {t("خروج", "Logout")}
              </button>
            </div>
          </div>
          {page === "dashboard" && <DashboardPage stats={stats} />}
          {page === "approvals-external" && <RegistrationApprovalsPage source="external" />}
          {page === "approvals-created" && <RegistrationApprovalsPage source="created" />}
          {page === "users" && <UsersPage />}
          {page === "role-mgmt" && <RoleManagementPage />}
          {page === "external-accounts" && <AccountsBySourcePage source="external" />}
          {page === "created-accounts" && <AccountsBySourcePage source="created" />}
          {page === "course-builder" && <CourseBuilderPage />}
          {page === "courses" && <CoursesListPage />}
          {page === "free-courses" && <FreeCoursesSettingsPage />}
          {page === "quiz-attempts" && <QuizAttemptsPage />}
          {page === "ranks-mgmt" && <RanksManagementPage />}
          {page === "settlement-settings" && <WeeklySettlementPage />}
          {page === "leaders" && <LeadersPage />}
          {page === "feedbacks" && <FeedbacksPage />}
          {page === "cs" && <CustomerServicePage />}
          {page === "pricing" && <PricingSettingsPage />}
          {page === "transactions" && <TransactionsPage />}

          {page === "admin-logs" && <AdminLogsPage />}
          {page === "membership-settings" && <MembershipSettingsPage />}
          {page === "admins-mgmt" && isManager && <AdminsListPage />}
          {page === "profile-settings" && <ProfilePage />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <LangProvider><AppInner /></LangProvider>;
}

function Sidebar({ navItems, current, onChange }) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <button onClick={() => setOpen(true)} className="lg:hidden fixed top-3 right-3 z-50 bg-everest-950 text-white p-3 rounded-xl shadow-lg text-xl">☰</button>
      {open && <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setOpen(false)} />}
      <aside className={`${open ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 transition-transform duration-300 w-64 bg-everest-950 text-white flex flex-col fixed lg:static inset-y-0 right-0 z-40`}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-lg font-bold"><span className="text-everest-400">Everest</span> Admin</h1>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-white/60 hover:text-white text-sm transition">{theme === "dark" ? "☀️" : "🌙"}</button>
            <button onClick={() => setOpen(false)} className="lg:hidden text-white/60 hover:text-white">✕</button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" style={{maxHeight:"calc(100vh - 80px)"}}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { onChange(item.id); setOpen(false); }}
              className={`w-full text-right px-4 py-3 rounded-lg text-sm font-medium transition flex items-center gap-3 ${current === item.id ? "bg-everest-600 text-white" : "text-theme-text-secondary hover:bg-white/5"}`}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0; const duration = 1200; const step = Math.ceil(Math.max(1, value / 30));
    const timer = setInterval(() => { start += step; if (start >= value) { setDisplay(value); clearInterval(timer); } else setDisplay(start); }, duration / 30);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}{suffix}</>;
}

function RingChart({ value, max, color, size = 90 }) {
  const r = 36; const circ = 2 * Math.PI * r; const pct = Math.min(value / (max || 1), 1);
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" style={{transform:"rotate(-90deg)"}}>
      <circle cx="45" cy="45" r={r} fill="none" stroke="var(--border-color)" strokeWidth="7" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1.5s ease"}} />
    </svg>
  );
}

function DashboardPage({ stats }) {
  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const { lang, t } = useLang();

  function openDetail(type) {
    if (detail === type) { setDetail(null); setDetailData([]); return; }
    setDetail(type);
    setDetailLoading(true);
    setDetailData([]);

    const fetches = {
      "all-users": () => api("/api/users").then(d => setDetailData(d.filter(u => u.role !== "admin" && u.role !== "manager"))),
      "students": () => api("/api/users/filter/student").then(setDetailData),
      "courses": () => api("/api/courses").then(setDetailData),
      "active-enrollments": () => api("/api/courses/enrollments/list").then(d => setDetailData(d.filter(e => e.status === "approved"))),
      "enrollment-rate": () => api("/api/courses/enrollments/list").then(setDetailData),
      "quiz-pass-rate": () => api("/api/courses/attempts").then(setDetailData),
      "published-courses": () => api("/api/courses").then(d => setDetailData(d.filter(c => c.status === "published"))),
      "pending-activation": () => api("/api/users").then(d => setDetailData(d.filter(u => u.status === "pending"))),
      "pending-enrollments": () => api("/api/courses/enrollments/list").then(d => setDetailData(d.filter(e => e.status === "pending"))),
      "pending-topup": () => api("/api/wallets/topups?status=pending").then(setDetailData),
      "upgrade-requests": () => api("/api/users/upgrade-requests/list").then(d => Array.isArray(d) ? setDetailData(d.filter(r => r.status === "pending")) : setDetailData([])),
      "blocked": () => api("/api/users").then(d => setDetailData(d.filter(u => u.blocked))),
      "registration": () => api("/api/users/filter/registration").then(setDetailData),
      "commissions": () => api("/api/mlm/commissions").then(setDetailData),
      "quizzes-passed": () => api("/api/courses/attempts").then(d => setDetailData(d.filter(q => q.result === "pass"))),
      "total-enrollments": () => api("/api/courses/enrollments/list").then(setDetailData),
      "feedbacks": () => api("/api/feedbacks").then(d => setDetailData(d.feedbacks || d)),
      "pending-enrollments2": () => api("/api/courses/enrollments/list").then(d => setDetailData(d.filter(e => e.status === "pending"))),
    };
    (fetches[type] || (() => setDetailData([])))().catch(() => setDetailData([])).finally(() => setDetailLoading(false));
  }

  const mainCards = [
    { label: t("إجمالي المستخدمين", "Total Users"), sub: t("(باستثناء المشرفين)", "(excl. admins)"), value: stats.totalUsers, icon: "👥", bg: "from-indigo-500", type: "all-users" },
    { label: t("الطلاب", "Students"), sub: t("(حسابات طلاب فقط)", "(student accounts only)"), value: stats.totalStudents, icon: "🎓", bg: "from-emerald-500", type: "students" },
    { label: t("الكورسات", "Courses"), sub: `${stats.publishedCourses || 0} ${t("منشور", "published")}`, value: stats.totalCourses, icon: "📚", bg: "from-violet-500", type: "courses" },
    { label: t("الاشتراكات النشطة", "Active Enrollments"), sub: `${stats.approvedEnrollments || 0} / ${stats.totalEnrollments || 0}`, value: stats.approvedEnrollments, icon: "✅", bg: "from-emerald-500", type: "active-enrollments" },
  ];

  const ringData = [
    { label: t("معدل الموافقة على الاشتراكات", "Enrollment Approval Rate"), value: stats.approvedEnrollments || 0, max: stats.totalEnrollments || 1, color: "#10b981", detail: `${stats.approvedEnrollments || 0} / ${stats.totalEnrollments || 0}`, type: "enrollment-rate" },
    { label: t("معدل نجاح الاختبارات", "Quiz Pass Rate"), value: stats.passedQuizzes || 0, max: stats.totalQuizAttempts || 1, color: "#8b5cf6", detail: `${stats.passedQuizzes || 0} / ${stats.totalQuizAttempts || 0}`, type: "quiz-pass-rate" },
    { label: t("الكورسات المنشرة", "Published Courses"), value: stats.publishedCourses || 0, max: stats.totalCourses || 1, color: "#6366f1", detail: `${stats.publishedCourses || 0} / ${stats.totalCourses || 0}`, type: "published-courses" },
  ];

  const pendingCards = [
    { label: t("بانتظار التفعيل", "Pending Activation"), value: stats.pendingApprovals, icon: "⏳", color: "#f59e0b", desc: t("مستخدمين جدد يحتاجون تفعيل", "New users awaiting approval"), type: "pending-activation" },
    { label: t("اشتراكات بانتظار المراجعة", "Pending Enrollments"), value: stats.pendingEnrollments, icon: "🛒", color: "#ec4899", desc: t("طلبات شراء كورسات", "Course purchase requests"), type: "pending-enrollments" },
    { label: t("شحن معلق", "Pending Top-up"), value: stats.topUpPending, icon: "💳", color: "#ef4444", desc: t("طلباتشحن المحافظ", "Wallet top-up requests"), type: "pending-topup" },
    { label: t("طلبات ترقية", "Upgrade Requests"), value: stats.upgradeRequests, icon: "⬆️", color: "#8b5cf6", desc: t("ترقية نوع الحساب", "Account type upgrade"), type: "upgrade-requests" },
  ];

  const breakdownCards = [
    { label: t("الحسابات المحظورة", "Blocked Accounts"), value: stats.totalBlocked, icon: "🚫", color: "#ef4444", desc: t("محظورين من المنصة", "Blocked from platform"), type: "blocked" },
    { label: t("حسابات التسجيل المجاني", "Reg Free Accounts"), value: stats.totalRegistration, icon: "🆓", color: "#a855f7", desc: t("حسابات غير مفعلة كطلاب", "Not activated as students"), type: "registration" },
    { label: t("العمولات المدفوعة", "Commissions Paid"), value: stats.totalCommissions, icon: "💎", color: "#10b981", desc: "EM " + t("إجمالي", "total"), type: "commissions" },
    { label: t("اختبارات ناجحة", "Quizzes Passed"), value: stats.passedQuizzes, icon: "📋", color: "#8b5cf6", desc: `${stats.totalQuizAttempts || 0} ${t("إجمالي محاولات", "total attempts")}`, type: "quizzes-passed" },
  ];

  const summaryItems = [
    { label: t("إجمالي الاشتراكات", "Total Enrollments"), value: stats.totalEnrollments, icon: "📋", type: "total-enrollments" },
    { label: t("اشتراكات بانتظار المراجعة", "Pending Enrollments"), value: stats.pendingEnrollments, icon: "⏳", type: "pending-enrollments2" },
    { label: t("التقييمات", "Feedbacks"), value: stats.totalFeedbacks, icon: "⭐", type: "feedbacks" },
  ];

  const detailTitles = {
    "all-users": t("قائمة جميع المستخدمين", "All Users List"),
    "students": t("قائمة الطلاب", "Student List"),
    "courses": t("قائمة الكورسات", "Courses List"),
    "active-enrollments": t("الاشتراكات النشطة", "Active Enrollments"),
    "enrollment-rate": t("جميع الاشتراكات", "All Enrollments"),
    "quiz-pass-rate": t("جميع محاولات الاختبارات", "All Quiz Attempts"),
    "published-courses": t("الكورسات المنشرة", "Published Courses"),
    "pending-activation": t("بانتظار التفعيل", "Pending Activation"),
    "pending-enrollments": t("اشتراكات بانتظار المراجعة", "Pending Enrollments"),
    "pending-topup": t("طلبات الشحن المعلقة", "Pending Top-ups"),
    "upgrade-requests": t("طلبات الترقية", "Upgrade Requests"),
    "blocked": t("الحسابات المحظورة", "Blocked Accounts"),
    "registration": t("حسابات التسجيل المجاني", "Reg Free Accounts"),
    "commissions": t("العمولات المدفوعة", "Commissions Paid"),
    "quizzes-passed": t("اختبارات ناجحة", "Quizzes Passed"),
    "total-enrollments": t("جميع الاشتراكات", "All Enrollments"),
    "feedbacks": t("التقييمات والآراء", "Feedbacks & Reviews"),
    "pending-enrollments2": t("اشتراكات بانتظار المراجعة", "Pending Enrollments"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">{t("📊 لوحة الإحصائيات", "📊 Dashboard")}</h1>
          <p className="section-sub">{t("نظرة عامة على أداء المنصة — بيانات حقيقية من قاعدة البيانات", "Platform performance overview — real data from database")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-theme-text-secondary bg-theme-surface px-3 py-1.5 rounded-lg border border-theme-border">{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm bg-theme-surface border border-theme-border rounded-xl shadow-card hover:shadow-lg transition flex items-center gap-2 text-theme-text-primary">
            <span className="text-base">🔄</span> {t("تحديث", "Refresh")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mainCards.map((c, i) => (
          <button key={i} onClick={() => openDetail(c.type)}
            className={`relative overflow-hidden bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${detail === c.type ? 'card-active' : 'border-theme-border'}`}
            style={{animation: `slideUp 0.4s ease ${i * 0.08}s both`}}>
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full bg-gradient-to-br ${c.bg} to-white/5 opacity-10`} />
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{c.icon}</span>
              <p className="text-theme-text-secondary text-xs font-medium">{c.label}</p>
            </div>
            <p className="text-3xl font-extrabold text-theme-text-primary"><AnimatedNumber value={c.value || 0} /></p>
            <p className="text-[10px] text-theme-text-secondary mt-1">{c.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {ringData.map((r, i) => (
          <button key={i} onClick={() => openDetail(r.type)}
            className={`bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 flex items-center gap-5 text-left hover:shadow-lg transition-all duration-300 ${detail === r.type ? 'card-active' : 'border-theme-border'}`}
            style={{animation: `slideUp 0.4s ease ${0.4 + i * 0.1}s both`}}>
            <RingChart value={r.value} max={r.max} color={r.color} />
            <div>
              <p className="text-theme-text-primary font-bold text-sm">{r.label}</p>
              <p className="text-2xl font-extrabold text-theme-text-primary mt-1">{r.detail}</p>
              <p className="text-xs text-theme-text-secondary mt-0.5">{Math.round((r.value / (r.max || 1)) * 100)}%</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {pendingCards.map((c, i) => (
          <button key={i} onClick={() => openDetail(c.type)}
            className={`bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 flex items-center gap-4 text-left hover:shadow-md transition-all duration-300 ${detail === c.type ? 'card-active' : 'border-theme-border'}`}
            style={{animation: `slideUp 0.4s ease ${0.7 + i * 0.08}s both`}}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg" style={{background: c.color + "15"}}>{c.icon}</div>
            <div>
              <p className="text-theme-text-secondary text-xs">{c.label}</p>
              <p className="text-xl font-extrabold text-theme-text-primary"><AnimatedNumber value={c.value || 0} /></p>
              <p className="text-[10px] text-theme-text-secondary mt-0.5">{c.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {breakdownCards.map((c, i) => (
          <button key={i} onClick={() => openDetail(c.type)}
            className={`relative overflow-hidden bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${detail === c.type ? 'card-active' : 'border-theme-border'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{c.icon}</span>
              <p className="text-theme-text-secondary text-xs font-medium">{c.label}</p>
            </div>
            <p className="text-2xl font-extrabold text-theme-text-primary">{(c.value || 0).toLocaleString()}</p>
            <p className="text-[10px] text-theme-text-secondary mt-0.5">{c.desc}</p>
          </button>
        ))}
      </div>

      {detail && (
        <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 mb-6" style={{animation:"slideUp 0.3s ease both"}}>
            <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-theme-text-primary">{detailTitles[detail] || detail}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-theme-text-secondary bg-theme-secondary px-2 py-1 rounded-lg">{detailData.length} {t("عنصر", "items")}</span>
              {(detail === "quiz-pass-rate" || detail === "quizzes-passed") && detailData.length > 0 && (
                <button onClick={async () => {
                  if (!confirm(t("هل أنت متأكد من حذف جميع نتائج الاختبارات؟", "Are you sure you want to delete all quiz results?"))) return;
                  await api("/api/courses/attempts", { method: "DELETE" });
                  setDetailData([]);
                  setDetail(null);
                }} className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg font-medium transition">
                  🗑️ {t("حذف الكل", "Delete All")}
                </button>
              )}
              <button onClick={() => { setDetail(null); setDetailData([]); }} className="text-sm text-theme-text-secondary hover:text-theme-text-primary">{t("إغلاق ✕", "Close ✕")}</button>
            </div>
          </div>
          {detailLoading ? (
            <p className="text-theme-text-secondary text-center py-8">{t("جاري التحميل...", "Loading...")}</p>
          ) : detailData.length === 0 ? (
            <p className="text-theme-text-secondary text-center py-8">{t("لا يوجد بيانات", "No data")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-theme-border">
                  {detail === "courses" || detail === "published-courses" ? (
                    <><th className="table-header">{t("الكورس", "Course")}</th><th className="table-header">{t("الفئة", "Category")}</th><th className="table-header">{t("السعر", "Price")}</th><th className="table-header">{t("الحالة", "Status")}</th></>
                  ) : detail === "commissions" ? (
                    <><th className="table-header">{t("العضو", "Member")}</th><th className="table-header">{t("الرتبة", "Rank")}</th><th className="table-header">{t("المبلغ", "Amount")}</th><th className="table-header">{t("التاريخ", "Date")}</th></>
                  ) : detail === "feedbacks" ? (
                    <><th className="table-header">{t("العضو", "Member")}</th><th className="table-header">{t("التقييم", "Rating")}</th><th className="table-header">{t("التعليق", "Comment")}</th></>
                  ) : detail === "quiz-pass-rate" || detail === "quizzes-passed" ? (
                    <><th className="table-header">{t("العضو", "Member")}</th><th className="table-header">{t("الاختبار", "Quiz")}</th><th className="table-header">{t("النتيجة", "Result")}</th><th className="table-header">{t("الدرجة", "Score")}</th></>
                  ) : detail.includes("enrollment") || detail === "total-enrollments" || detail === "pending-enrollments2" ? (
                    <><th className="table-header">{t("العضو", "Member")}</th><th className="table-header">{t("الكورس", "Course")}</th><th className="table-header">{t("الحالة", "Status")}</th><th className="table-header">{t("التاريخ", "Date")}</th></>
                  ) : detail === "pending-topup" ? (
                    <><th className="table-header">{t("العضو", "Member")}</th><th className="table-header">{t("المبلغ", "Amount")}</th><th className="table-header">{t("الحالة", "Status")}</th><th className="table-header">{t("التاريخ", "Date")}</th></>
                  ) : (
                    <><th className="table-header">{t("الاسم", "Name")}</th><th className="table-header">{t("البريد", "Email")}</th><th className="table-header">{t("النوع", "Type")}</th><th className="table-header">{t("الرتبة", "Rank")}</th><th className="table-header">{t("الحالة", "Status")}</th></>
                  )}
                </tr></thead>
                <tbody>
                  {detailData.map((item, idx) => {
                    if (detail === "courses" || detail === "published-courses") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.title_ar || item.title}</td><td className="table-cell text-theme-text-secondary">{item.category_ar || item.category || "–"}</td><td className="table-cell">{item.is_free ? <span className="text-green-600 font-bold">{t("مجاني", "Free")}</span> : `${item.price_egp || item.price} EGP`}</td><td className="table-cell"><span className={`badge ${item.status === 'published' ? 'badge-green' : 'badge-gray'}`}>{item.status}</span></td></tr>;
                    }
                    if (detail === "commissions") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.user_name || item.user_id}</td><td className="table-cell text-theme-text-secondary">{item.rank_name || "–"}</td><td className="table-cell text-green-600 font-bold">{item.amount} EM</td><td className="table-cell text-theme-text-secondary text-xs">{item.created_at ? item.created_at.slice(0,10) : "–"}</td></tr>;
                    }
                    if (detail === "feedbacks") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.full_name || item.user_name || item.user_id}</td><td className="table-cell text-theme-text-secondary text-xs max-w-xs truncate">{item.comment || "–"}</td></tr>;
                    }
                    if (detail === "quiz-pass-rate" || detail === "quizzes-passed") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.student_name || item.user_name || item.user_id}</td><td className="table-cell text-theme-text-secondary text-xs">{item.quiz_title || item.quiz_id}</td><td className="table-cell"><span className={`badge ${item.result === 'pass' ? 'badge-green' : 'badge-red'}`}>{item.result === 'pass' ? t("ناجح", "Pass") : t("راسب", "Fail")}</span></td><td className="table-cell">{item.correct_answers ?? item.correct}/{item.total_marks ?? item.total}</td></tr>;
                    }
                    if (detail.includes("enrollment") || detail === "total-enrollments" || detail === "pending-enrollments2") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.student_name || item.user_name || item.user_id}</td><td className="table-cell text-theme-text-secondary text-xs">{item.course_name || item.course_title || item.course_id}</td><td className="table-cell"><span className={`badge ${item.status === 'approved' ? 'badge-green' : item.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>{item.status}</span></td><td className="table-cell text-theme-text-secondary text-xs">{item.enrolled_at ? item.enrolled_at.slice(0,10) : "–"}</td></tr>;
                    }
                    if (detail === "pending-topup") {
                      return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.user_name || item.user_id}</td><td className="table-cell font-bold">{item.amount} EGP</td><td className="table-cell"><span className="badge badge-yellow">{item.status}</span></td><td className="table-cell text-theme-text-secondary text-xs">{item.created_at ? item.created_at.slice(0,10) : "–"}</td></tr>;
                    }
                    return <tr key={idx} className="table-row"><td className="table-cell font-medium">{item.full_name || item.name}</td><td className="table-cell text-theme-text-secondary text-xs">{item.email}</td><td className="table-cell"><span className={`badge ${item.role === 'student' ? 'badge-blue' : item.role === 'registration' ? 'badge-yellow' : 'badge-gray'}`}>{item.role || item.account_type}</span></td><td className="table-cell text-theme-text-secondary">{item.rank || "–"}</td><td className="table-cell">{item.blocked ? <span className="text-red-600 font-bold">🚫</span> : <span className={`badge ${item.status === 'active' ? 'badge-green' : item.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{item.status}</span>}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-theme-surface rounded-2xl shadow-card border border-theme-border p-5 mb-6" style={{animation: "slideUp 0.4s ease 1s both"}}>
        <div className="flex items-center gap-2 mb-3"><span className="text-sm">📋</span><span className="text-sm font-bold text-theme-text-primary">{t("ملخص المنصة", "Platform Summary")}</span></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {summaryItems.map((s, i) => (
            <button key={i} onClick={() => openDetail(s.type)}
              className={`flex items-center gap-2 bg-theme-secondary rounded-xl px-4 py-3 text-left hover:bg-theme-surface-hover transition ${detail === s.type ? 'ring-2 ring-everest-500' : ''}`}>
              <span>{s.icon}</span>
              <div><p className="text-theme-text-secondary text-xs">{s.label}</p><p className="font-bold text-theme-text-primary">{(s.value || 0).toLocaleString()}</p></div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

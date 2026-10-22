# تقرير مشروع Everest Academy (منصة مستر زيزو للكورسات التداولية)

## نبذة عن المشروع

منصة تعليمية متكاملة لتعليم **تداول الأسواق المالية (الفوركس والبورصة)**، عربية أولًا (RTL) مع دعم كامل للغة الإنجليزية. تتكون المنصة من **3 تطبيقات** تعمل معًا (Monorepo):
1. **تطبيق الطالب (User Frontend)** — React + Vite + Tailwind CSS.
2. **لوحة التحكم (Admin Frontend)** — React + Vite + Tailwind CSS.
3. **الخادم المركزي (Backend)** — Node.js + Express + SQLite (مع توافق Turso/libsql).

تم نشر النظام في الإنتاج على **Railway** (Backend عبر Docker) و **Hostinger** (الواجهات الأمامية + بروكسي `api.php`).

---

## التقنيات المستخدمة (Tech Stack)

### Frontend (الطالب)
- React 18, React Router 6, Vite 5
- Tailwind CSS + PostCSS/Autoprefixer
- تصميم RTL عربي + تبديل لغة (AR/EN)
- SWR Cache Layer + Pull-to-Refresh

### Frontend (الأدمن)
- React 18, Vite 5, Tailwind CSS
- jspdf + jspdf-autotable (تصدير تقارير PDF)
- tus-js-client (رفع فيديوهات قابلة للاستئناف إلى CDN)

### Backend
- Node.js + Express 4
- sql.js (SQLite in-memory + persistence) + @libsql/client (Turso)
- bcryptjs (تشفير كلمات المرور), express-rate-limit (حماية من الهجمات)
- nodemailer (إرسال الإيميلات: OTP، تأكيد، استرداد كلمة المرور)
- node-cron (جدولة المهام: التسوية الأسبوعية)
- multer (رفع الملفات/الصور)
- @google/generative-ai + API مخصصة لـ Groq (مساعد AI)

---

## المميزات الرئيسية

### 1) تجربة الطالب 🎓
- **تسجيل عضوية فردية** (External) بالبريد أو **إنشاء حساب لشخص آخر** (بمعرف العضو).
- **التحقق من البريد** برمز OTP + نموذج إعادة إرسال + استرداد كلمة المرور.
- **لوحة تحكم الطالب**: الكورسات الخاصة، الرتب، الأموال الإلكترونية (E-Money)، الملف الشخصي، الأشعارات.
- **متجر الكورسات**: كتالوج كورسات، كورسات مجانية، معاينة فيديو، اختبارات (Quiz) داخل الكورس.
- **نظام الاختبارات**: أسئلة متعددة، لوحة أفضل المتسابقين، حفظ التقدم.
- **بوابات دفع متعددة**: InstaPay، Vodafone Cash، بطاقة بنكية، شراء شامل (تحويل + إثبات دفع).
- **شحن الرصيد (Top-Up)** بالعمولة/الأرباح.
- **نظام عمولة تسويقي (Affiliate/MLM)**:
  - توليد كود إحالة لكل عضو.
  - بناء الشبكة (شجرة علاقات) واستعراضها من الأعلى.
  - رتب تصاعدية (Star → Executive → … → Everest Ambassador).
  - **ترقية أسبوعية تلقائية** + **تمويل عمولة أسبوعية** (E-Money) لأعلى رتبة مؤهلة.
- **صفحة المتصدرين (Top Sellers / Rankings)** + **قائمة الأعضاء القادة (Leaders)**.
- **مساعد ذكي مدمج (AI Assistant)** يجيب على أسئلة المنصة/الكورسات (Gemini + Groq).
- **تواصل سريع**: WhatsApp Floating، خدمة عملاء مدمجة، دعم الكول.
- **حماية الشاشة (Screen Protection overlay)** لمنع مشاركة المحتوى التعليمي.
- **ذكاء وإنشاء السيرة الذاتية**: صفحة الـ About ونظرة عامة عن الأكاديمية.
- **سحب للتحديث (Pull-to-Refresh)** وذاكرة تخزين مؤقتة (SWR) لتجربة أسرع دون إبطاء الشبكة.

### 2) لوحة التحكم الإدارية 🛠️
- **الدخول متعدد الأدوار**: Admin / Manager مع إدارة المهام والأدوار (Role Management).
- **إدارة الكورسات (Course Builder)**: إنشاء كامبونات، دروس، اختبارات، رفع فيديوهات عبر CDN (Bunny + tus).
- **الموافقات**: تسجيلات طلاب pending، طلبات ترقية الحساب، طلبات تجديد الاشتراك.
- **إدارة المستخدمين**: قائمة طلاب (بحث/فلترة)، عرض من سجّل كل عضو، بطاقات الهوية، حسابات حسب المصدر (External/Created).
- **إدارة الرتب**: تعديل الحدود والمكافآت، تتبع تقدم كل عضو، دفع عمولات يدوي.
- **التسوية الأسبوعية (Weekly Settlement)**:
  - ضبط اليوم/الساعة/المنطقة الزمنية/الحد الأدنى للديرةكت.
  - تشغيل تلقائي أو يدوي، سجل عمليات، التزامن ضد المضاعفة (double-commission guard).
- **المدفوعات**: بوابات الدفع InstaPay/Vodafone/Card، متابعة التحويلات، عمليات الشحن (Top-Ups)، سجل المعاملات الكامل.
- **لوحات وأدوات**: Feedbacks والمراجعات، سجل الأنشطة (Activity Logs)، إشعارات، إعدادات الأكاديمية (العضوية، الأسعار، التداول، Gemini Keys).
- **تصدير PDF** لطلبات/معاملات عبر jsPDF.

### 3) الخادم (Backend/API) ⚙️
- بنية RESTful APIs موحّدة تحت `/api` مع **مصادقة بالجلسة** (Session-based، متعددة الأجهزة CSV).
- Middleware `sessionAuth` + `adminAuth` (تفريق بين الطالب والإدارة).
- **حماية**: Rate Limiting لكل API، Sanitization لبيانات الدخول (استخدام Unicode غير مرئي: ZWSP/Bidi/NBSP)، تشفير كلمات المرور (bcrypt)، معالجة الهجمات وإعادة التحقق.
- **قاعدة بيانات SQLite** مع دعم استمرارية/نسخ احتياطي تلقائي كل 10 دقائق + وضع Turso عن بُعد (Cloud).
- **جدولة تلقائية**: Scheduler يتحقق كل 30 ثانية من إعدادات التسوية وينفذها تلقائيًا.
- **Service Layer**: `weeklySettlement` (العمولات + الرتب + الشبكة + Top-10 Leaders) مع **اختبارات وحدة شاملة (15 test)**.
- **لوغات وتشخيص**: تسجيل أعمق للأخطاء، إصلاحات أمنية وتصحيحات لأنظمة الدفع والتصفح.

---

## المعمارية والبيانات

### بيئة التشغيل (Production)
```
طالب / أدمن (React Apps)  تُنشر على Hostinger  🡒/ api.php proxy/ 🡒 Railway API
                                                                           |
                                                    SQLite (sql.js/Turso) local + auto-save
```
- **Dockerfile**: بناء backend-only على Railway (حسب البنية الجديدة).
- **Hostinger**: `hostinger-update/` يحتوي `user`, `admin`, و`api.php` (بروكسي يمرر `/api/` و`/uploads/`).
- **CDN**: رفع الفيديو عبر Bunny (زرع tus) لضمان رفع مستقر للفيديوهات الكبيرة.

### جدوال البيانات الأساسية
`users`, `courses`, `topics`, `lessons`, `quizzes`, `enrollments`, `upload progress`, `weekly_sales`, `weekly_commissions`, `weekly_history`, `weekly_settlements`, `leaderboard_history`, `leaders`, `excluded_leaders`, `user_closure`, `ranks`, `wallet_transactions`, `proofs`, `feedbacks`, `notifications`, `settings`, … وغيرها.

---

## ملاحظات إضافية عن الثبات والأمان

- معالجة ثغرات أمنية: منع غروب البيانات غير المرئي عند الدخول، مراجعة الـ OTP، رفع حد الجلسات، تنظيف الجلسات منتهية.
- تحسين الأخطاء في المتصفحات المختلفة (Chrome/Safari/Edge/Brave) لمشاكل الـ Autofill والـ Login.
- إصلاح أخطاء بناء/deployment وضبط عمل الـ Docker والتسوية.

---

## أبرز الإنجازات التي أبرزها في الـ CV

- تصميم وبناء **نظام تسويق شَبكي (MLM) كامل** بترقيات أسبوعية وعمولات تلقائية ولوحات تصدّري.
- بناء **نظام ترويجي تسويقي (Affiliate)** مع روابط إحالة وبنية علاقات (Closure).
- تطوير **واجهة عربية RTL** كاملة + دعم ثنائي اللغة.
- تنفيذ **تسوية أسبوعية آمنة من التكرار** (اتوميك كلين + دوائر حماية) مع اختبارات.
- نشر وإدارة **بيئة إنتاج حقيقية** (Railway + Hostinger + CDN).
- خبرة واسعة في **Express, React, SQLite, Redis-like caching, Web APIs, AI Assistant (Gemini/Groq)**.
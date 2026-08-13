import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

.footer-section * { box-sizing: border-box; margin: 0; padding: 0; }
.footer-section { font-family: 'Poppins', sans-serif; }

/* CTA Banner */
.fs-cta-wrapper {
  padding: 0 5% 0;
  direction: ltr;
}
.fs-cta {
  position: relative;
  width: 100%;
  min-height: 380px;
  border-radius: 28px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.fs-cta-bg {
  position: absolute;
  inset: 0;
  background-image: url('/image/footer-cta.jpeg');
  background-size: cover;
  background-position: center;
  z-index: 0;
}
.fs-cta-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1;
}
.fs-cta-content {
  position: relative;
  z-index: 2;
  padding: 60px 20px;
  max-width: 700px;
}
.fs-cta h2 {
  font-size: clamp(30px, 5vw, 52px);
  font-weight: 700;
  color: #fff;
  line-height: 1.15;
  margin-bottom: 16px;
}
.fs-cta-desc {
  font-size: 17px;
  color: rgba(255,255,255,0.7);
  line-height: 1.6;
  margin-bottom: 32px;
}
.fs-email-form {
  display: flex;
  align-items: center;
  max-width: 560px;
  margin: 0 auto;
  background: #fff;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}
.fs-email-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 16px 24px;
  font-size: 16px;
  font-family: 'Poppins', sans-serif;
  color: #1F2937;
  background: transparent;
  border-radius: 999px 0 0 999px;
}
.fs-email-input::placeholder { color: #9CA3AF; }
.fs-email-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #111827;
  color: #fff;
  border: none;
  padding: 16px 28px;
  font-size: 16px;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
  border-radius: 999px;
  margin: 4px;
  transition: background 0.3s, transform 0.3s;
  white-space: nowrap;
}
.fs-email-btn:hover { background: #0F766E; transform: translateY(-1px); }
.fs-email-btn svg { flex-shrink: 0; }

/* Footer Body */
.fs-footer {
  background: #fff;
  padding: 64px 5% 0;
  direction: ltr;
}
.fs-footer-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.fs-brand-col {}
.fs-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.fs-logo-icon {
  width: 40px;
  height: 40px;
  background: #0F766E;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 20px;
}
.fs-logo-text {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  letter-spacing: -0.3px;
}
.fs-brand-desc {
  font-size: 15px;
  color: #6B7280;
  line-height: 1.7;
  margin-bottom: 24px;
  max-width: 320px;
}
.fs-socials {
  display: flex;
  gap: 12px;
}
.fs-social-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B7280;
  text-decoration: none;
  transition: all 0.3s;
}
.fs-social-icon:hover {
  color: #0F766E;
  border-color: #0F766E;
  transform: scale(1.08);
}
.fs-social-icon svg { width: 18px; height: 18px; }

/* Link Columns */
.fs-col-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 22px;
}
.fs-col-links {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.fs-col-link {
  font-size: 15px;
  color: #6B7280;
  text-decoration: none;
  transition: color 0.3s;
  line-height: 1.5;
}
.fs-col-link:hover { color: #0F766E; }
.fs-col-link span { margin-left: 6px; }

/* Bottom Bar */
.fs-bottom {
  max-width: 1200px;
  margin: 48px auto 0;
  padding: 24px 0;
  border-top: 1px solid #E5E7EB;
  text-align: center;
}
.fs-bottom p {
  font-size: 14px;
  color: #9CA3AF;
  line-height: 1.8;
}

/* Responsive */
@media (max-width: 900px) {
  .fs-footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
}
@media (max-width: 600px) {
  .fs-cta { min-height: 320px; border-radius: 20px; }
  .fs-email-form { flex-direction: column; border-radius: 16px; max-width: 320px; }
  .fs-email-input { border-radius: 16px 16px 0 0; text-align: center; }
  .fs-email-btn { width: 100%; justify-content: center; border-radius: 0 0 16px 16px; margin: 0; padding: 14px 20px; }
  .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; text-align: center; }
  .fs-brand-desc { max-width: 100%; margin-left: auto; margin-right: auto; }
  .fs-socials { justify-content: center; }
  .fs-logo { justify-content: center; }
}

/* Dark Mode */
[data-theme="dark"] .footer-section .fs-footer { background: #1a1a2e; }
[data-theme="dark"] .footer-section .fs-logo-text { color: #f0f0f0; }
[data-theme="dark"] .footer-section .fs-brand-desc { color: #aaa; }
[data-theme="dark"] .footer-section .fs-social-icon { border-color: #333; color: #aaa; }
[data-theme="dark"] .footer-section .fs-social-icon:hover { color: #6E3BF2; border-color: #6E3BF2; }
[data-theme="dark"] .footer-section .fs-col-title { color: #f0f0f0; }
[data-theme="dark"] .footer-section .fs-col-link { color: #aaa; }
[data-theme="dark"] .footer-section .fs-col-link:hover { color: #6E3BF2; }
[data-theme="dark"] .footer-section .fs-bottom { border-top-color: #333; }
[data-theme="dark"] .footer-section .fs-bottom p { color: #888; }
[data-theme="dark"] .footer-section .fs-email-input { color: #f0f0f0; }
[data-theme="dark"] .footer-section .fs-email-input::placeholder { color: #666; }
`;

export default function FooterSection({ showCTA }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [socials, setSocials] = useState({});

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/customer-service`)
      .then((r) => r.json())
      .then((d) => setSocials(d))
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    window.location.href = "/register";
  };

  return (
    <div className="footer-section">
      <style>{styles}</style>

      {/* CTA Banner */}
      {showCTA && (
      <div className="fs-cta-wrapper">
        <div className="fs-cta">
          <div className="fs-cta-bg" />
          <div className="fs-cta-overlay" />
          <div className="fs-cta-content">
            <h2>{t("ابدأ رحلتك اليوم", "Start Your Journey Today")}</h2>
            <p className="fs-cta-desc">
              {t(
                "تعلم مهارات عملية، وطور دخلك، وانضم إلى مجتمع إيفرست.",
                "Learn practical skills, grow your income, and become part of the Everest community."
              )}
            </p>
            <form className="fs-email-form" onSubmit={handleSubmit}>
              <input
                className="fs-email-input"
                type="email"
                placeholder={t("أدخل بريدك الإلكتروني", "Enter your email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="fs-email-btn" type="submit">
                {t("انضم الآن", "Join Now")}
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* Footer */}
      <footer className="fs-footer">
        <div className="fs-footer-grid">
          {/* Brand */}
          <div className="fs-brand-col">
            <div className="fs-logo">
              <div className="fs-logo-icon">E</div>
              <span className="fs-logo-text">EVEREST ACADEMY</span>
            </div>
            <p className="fs-brand-desc">
              {t(
                "تمكين الأفراد الطموحين بالتعليم العملي والفرص الحقيقية والمجتمع المصمم للنجاح على المدى الطويل.",
                "Empowering ambitious people with practical education, real opportunities, and a community built for long-term success."
              )}
            </p>
            <div className="fs-socials">
              {socials.social_tiktok && (
                <a href={socials.social_tiktok} target="_blank" rel="noreferrer" className="fs-social-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43V13.2a8.16 8.16 0 004.77 1.52V11.3a4.85 4.85 0 01-.81-.07 4.8 4.8 0 01-.38-.52z"/></svg>
                </a>
              )}
              {socials.social_instagram && (
                <a href={socials.social_instagram} target="_blank" rel="noreferrer" className="fs-social-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              )}
              {socials.social_telegram && (
                <a href={socials.social_telegram} target="_blank" rel="noreferrer" className="fs-social-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </a>
              )}
            </div>
          </div>

          {/* Academy */}
          <div>
            <h4 className="fs-col-title">{t("الأكاديمية", "Academy")}</h4>
            <div className="fs-col-links">
              <Link to="/courses" className="fs-col-link">{t("الدروس المميزة", "Premium Courses")}</Link>
              <Link to="/courses" className="fs-col-link">{t("برامج التعلم", "Learning Programs")}</Link>
              <Link to="/feedback" className="fs-col-link">{t("المجتمع", "Community")}</Link>
              <Link to="/feedback" className="fs-col-link">{t("قصص النجاح", "Success Stories")}</Link>
            </div>
          </div>

          {/* Why Everest */}
          <div>
            <h4 className="fs-col-title">{t("لماذا إيفرست", "Why Everest")}</h4>
            <div className="fs-col-links">
              <a href="#" className="fs-col-link">{t("ضمان استرداد الأموال بعد 48 ساعة", "48-Hour Money Refund Guarantee")}</a>
              <a href="#" className="fs-col-link">{t("مدفوعات آمنة", "Secure Payments")}</a>
              <a href="#" className="fs-col-link">{t("دعم على مدار الساعة", "24/7 Support")}</a>
              <a href="#" className="fs-col-link">{t("تعليم عملي", "Practical Learning")}</a>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="fs-col-title">{t("الدعم", "Support")}</h4>
            <div className="fs-col-links">
              <Link to="/about" className="fs-col-link">{t("تواصل معنا", "Contact Us")}</Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="fs-bottom">
          <p>
            {t("© 2026 أكاديمية إيفرست. جميع الحقوق محفوظة.", "© 2026 Everest Academy. All Rights Reserved.")}
          </p>
        </div>
      </footer>
    </div>
  );
}

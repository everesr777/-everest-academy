import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465");

  if (!user || !pass) {
    console.warn("EMAIL_USER/EMAIL_PASS not configured — falling back to Resend API");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    socketTimeout: 12000,
  });
}

export function buildVerificationEmailHtml(name, verifyUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
          <!-- Purple header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6E3BF2,#B88BFF);padding:36px 30px;text-align:center;">
              <img src="https://myeverestcompany.com/image/logo3.png" alt="Everest Academy" style="height:52px;margin-bottom:12px;" />
              <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px;">Verify Your Email</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <p style="font-size:16px;color:#1a1a2e;margin:0 0 6px;font-weight:600;">Welcome, ${name}!</p>
              <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
                Thank you for joining Everest Academy. Please click the button below to verify your email address and activate your account.
              </p>
              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="background:linear-gradient(135deg,#6E3BF2,#B88BFF);border-radius:12px;padding:0;">
                    <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:12px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 8px;">
                Or copy and paste this link in your browser:
              </p>
              <p style="font-size:12px;color:#6E3BF2;word-break:break-all;margin:0 0 24px;padding:10px;background:#f8f6ff;border-radius:8px;border:1px solid #e9d8ff;">
                ${verifyUrl}
              </p>
              <!-- Expiry notice -->
              <p style="font-size:13px;color:#999;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:20px;">
                This verification link expires in <strong>24 hours</strong>. If you did not create an account with Everest Academy, please ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#fafafe;border-top:1px solid #f0ecff;">
              <p style="font-size:11px;color:#aaa;text-align:center;margin:0;">
                Everest Academy &copy; ${new Date().getFullYear()} &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(to, name, token) {
  const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === "production"
    ? "https://everest-academy-production.up.railway.app"
    : "http://localhost:5000");
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;
  const html = buildVerificationEmailHtml(name, verifyUrl);

  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Everest Academy" <noreply@myeverestcompany.com>`,
        to,
        subject: "Verify Your Email - Everest Academy",
        html,
      });
      return;
    } catch (smtpErr) {
      console.warn("SMTP send failed, falling back to Resend:", smtpErr.message);
    }
  }

  // Fallback: use Resend API
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email provider configured (SMTP or Resend)");
  const from = "Everest Academy <noreply@myeverestcompany.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Verify Your Email - Everest Academy", html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend email failed");
}

export async function sendOTPEmail(to, otp, name, purpose = "general") {
  const subject = purpose === "email_verification"
    ? "Verify Your Email - Everest Academy"
    : "Password Reset Code - Everest Academy";

  const heading = purpose === "email_verification"
    ? "Email Verification Code"
    : "Password Reset Code";

  const bodyText = purpose === "email_verification"
    ? "Thank you for joining Everest Academy. Use the code below to verify your email address."
    : "You requested a password reset. Use the code below to reset your password.";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#6E3BF2,#B88BFF);padding:36px 30px;text-align:center;">
              <img src="https://myeverestcompany.com/image/logo3.png" alt="Everest Academy" style="height:52px;margin-bottom:12px;" />
              <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <p style="font-size:16px;color:#1a1a2e;margin:0 0 6px;font-weight:600;">Hello${name ? `, ${name}` : ''}!</p>
              <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">${bodyText}</p>
              <div style="text-align:center;margin:24px 0;padding:24px;background:#f8f6ff;border-radius:12px;border:1px solid #e9d8ff;">
                <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6E3BF2;">${otp}</span>
              </div>
              <p style="font-size:13px;color:#999;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:20px;">
                This code expires in <strong>10 minutes</strong>. If you did not request this, please ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafe;border-top:1px solid #f0ecff;">
              <p style="font-size:11px;color:#aaa;text-align:center;margin:0;">
                Everest Academy &copy; ${new Date().getFullYear()} &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Everest Academy" <noreply@myeverestcompany.com>`,
        to,
        subject,
        html,
      });
      return;
    } catch (smtpErr) {
      console.warn("SMTP OTP send failed, falling back to Resend:", smtpErr.message);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email provider configured (SMTP or Resend)");
  const from = "Everest Academy <noreply@myeverestcompany.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend email failed");
}

export async function sendActivationFollowUpEmail(to, name, csNumber) {
  const subject = "Account Activated - Contact Customer Service | تم تفعيل حسابك - تواصل مع خدمة العملاء";
  const phone = csNumber || process.env.CUSTOMER_SERVICE_NUMBER || "+201234567890";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Customer Service</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#6E3BF2,#B88BFF);padding:36px 30px;text-align:center;">
              <img src="https://myeverestcompany.com/image/logo3.png" alt="Everest Academy" style="height:52px;margin-bottom:12px;" />
              <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px;">Account Activated / تم تفعيل الحساب</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <p style="font-size:16px;color:#1a1a2e;margin:0 0 6px;font-weight:600;">Hello${name ? `, ${name}` : ''}! / مرحباً${name ? `، ${name}` : ''}!</p>
              <div style="font-size:14px;color:#555;line-height:1.9;margin:0 0 20px;">
                <p style="margin:0 0 8px;">تواصل معنا لدفع الرسوم وسيتم تفعيل الكورسات وحسابك فوراً.</p>
                <p style="margin:0 0 8px;">Contact us to pay the fees and your courses and account will be activated.</p>
              </div>
              <div style="text-align:center;margin:24px 0;padding:24px;background:#f8f6ff;border-radius:12px;border:1px solid #e9d8ff;">
                <p style="font-size:13px;color:#6E3BF2;font-weight:700;margin:0 0 8px;">Customer Service / خدمة العملاء</p>
                <a href="https://wa.me/${String(phone).replace(/[^0-9]/g, '')}" target="_blank" style="display:inline-block;font-size:24px;font-weight:bold;color:#25d366;text-decoration:none;">${phone}</a>
              </div>
              <p style="font-size:13px;color:#999;line-height:1.6;margin:0;border-top:1px solid #eee;padding-top:20px;">
                Your account email is verified. Please contact customer service to complete your activation and start learning. / تم تأكيد بريدك الإلكتروني. يرجى التواصل مع خدمة العملاء لإتمام تفعيلك وبدء التعلم.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafe;border-top:1px solid #f0ecff;">
              <p style="font-size:11px;color:#aaa;text-align:center;margin:0;">
                Everest Academy &copy; ${new Date().getFullYear()} &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Everest Academy" <noreply@myeverestcompany.com>`,
        to,
        subject,
        html,
      });
      return;
    } catch (smtpErr) {
      console.warn("SMTP follow-up email failed, falling back to Resend:", smtpErr.message);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email provider configured (SMTP or Resend)");
  const from = "Everest Academy <noreply@myeverestcompany.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend email failed");
}

export async function sendRejectionEmail(to, name, reason) {
  const subject = "Account Registration Rejected - Everest Academy";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Rejected</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#6E3BF2,#B88BFF);padding:36px 30px;text-align:center;">
              <img src="https://myeverestcompany.com/image/logo3.png" alt="Everest Academy" style="height:52px;margin-bottom:12px;" />
              <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px;">Registration Rejected</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <p style="font-size:16px;color:#1a1a2e;margin:0 0 6px;font-weight:600;">Hello${name ? `, ${name}` : ''},</p>
              <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px;">
                We regret to inform you that your account registration at Everest Academy has been rejected.
              </p>
              ${reason ? `
              <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
                <p style="font-size:13px;font-weight:700;color:#dc2626;margin:0 0 6px;">Reason for rejection:</p>
                <p style="font-size:14px;color:#333;line-height:1.7;margin:0;">${reason}</p>
              </div>
              ` : ''}
              <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px;">
                If you have any questions, please contact our customer service team.
              </p>
              <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">
                You are welcome to register again with corrected information.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafe;border-top:1px solid #f0ecff;">
              <p style="font-size:11px;color:#aaa;text-align:center;margin:0;">
                Everest Academy &copy; ${new Date().getFullYear()} &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Everest Academy" <noreply@myeverestcompany.com>`,
        to,
        subject,
        html,
      });
      return;
    } catch (smtpErr) {
      console.warn("SMTP rejection email failed, falling back to Resend:", smtpErr.message);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email provider configured (SMTP or Resend)");
  const from = "Everest Academy <noreply@myeverestcompany.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend email failed");
}

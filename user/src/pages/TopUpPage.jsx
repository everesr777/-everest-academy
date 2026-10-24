import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { api, uploadApi } from "../App";
import AppNavbar from "../components/AppNavbar";
import { useTheme } from "../ThemeContext";

export default function TopUpPage() {
  const { t, dir } = useLang();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const { colors: c } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount < 1) { setErr(t("من فضلك أدخل مبلغ صحيح", "Please enter a valid amount")); return; }
    if (!phoneNumber) { setErr(t("من فضلك أدخل رقم الهاتف المحول عليه", "Please enter the phone number you transferred to")); return; }
    setLoading(true); setErr("");

    try {
      let proofUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const data = await uploadApi(formData);
        proofUrl = data.url;
      }

      await api("/api/wallets/topups", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, amount: Number(amount), payment_method: "vodafone", payment_proof: proofUrl, phone_number: phoneNumber })
      });

      setDone(true);
    } catch (e) {
      setErr(e.message || t("حدث خطأ", "An error occurred"));
    }
    setLoading(false);
  };

  if (done) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:c.bg}}>
      <div style={{textAlign:"center",padding:40,background:c.bgCard,borderRadius:35,maxWidth:450}}>
        <p style={{fontSize:60,marginBottom:16}}>✅</p>
        <h2 style={{marginBottom:8}}>{t("تم إرسال طلب الشحن", "Top-up request sent")}</h2>
        <p style={{color:c.textSoft,marginBottom:20}}>{t("في انتظار موافقة الادمن. سيتم إضافة الرصيد بعد التأكد من الدفع.", "Awaiting admin approval. Balance will be added after payment confirmation.")}</p>
        <Link to="/dashboard" style={{padding:"12px 24px",background:"#111",borderRadius:12,color:"#6E3BF2",fontWeight:700,textDecoration:"none",display:"inline-block"}}>{t("العودة للوحة التحكم", "Back to Dashboard")}</Link>
      </div>
    </div>
  );

  return (
    <div style={{background:c.bg}}>
      <AppNavbar />

      <div className="dash-container" style={{marginTop:30,maxWidth:600}}>
        <div className="auth-card" style={{boxShadow:"0 5px 30px rgba(0,0,0,.04)",borderRadius:20,padding:30}}>
          <div style={{textAlign:"center",marginBottom:25}}>
            <h2 style={{fontSize:22,fontWeight:800}}>{t("💰 شحن الرصيد", "💰 Top Up Balance")}</h2>
            <p style={{color:c.textSoft,fontSize:14,marginTop:4}}>{t("اشحن رصيد $ عبر فودافون كاش", "Top up your $ balance via Vodafone Cash")}</p>
          </div>
          {err && <p style={{color:"#ff4d4d",textAlign:"center",marginBottom:15,fontSize:14}}>{err}</p>}
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>{t("المبلغ (EGP)", "Amount (EGP)")}</label>
              <input type="number" required min="1" placeholder={t("أدخل المبلغ", "Enter amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div style={{background:"rgba(254,212,0,.06)",border:"1px solid rgba(254,212,0,.15)",borderRadius:14,padding:16,marginBottom:20}}>
              <p style={{color:"#b48800",fontSize:13,fontWeight:700,marginBottom:6}}>{t("📱 بيانات الدفع عبر فودافون كاش:", "📱 Payment details via Vodafone Cash:")}</p>
              <p style={{color:c.textSoft,fontSize:14}}>{t("حول المبلغ على الرقم التالي:", "Transfer the amount to the following number:")}</p>
              <p style={{color:c.text,fontSize:22,fontWeight:800,letterSpacing:2,direction:dir,textAlign:"center",marginTop:8}}>0100 000 0000</p>
            </div>
            <div className="auth-field">
              <label>{t("رقم الهاتف المحول عليه", "Phone number transferred to")}</label>
              <input type="tel" required placeholder={t("أدخل رقم الهاتف الذي حولت عليه", "Enter the phone number you transferred to")} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>{t("صورة التحويل (Screenshot)", "Transfer Screenshot")}</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
              {file && <p style={{fontSize:12,color:c.textSoft,marginTop:4}}>{file.name}</p>}
            </div>
            <div style={{textAlign:"center",marginTop:20}}>
              <button type="submit" disabled={loading} style={{padding:"12px 40px",background:"#111",color:"#6E3BF2",border:"none",borderRadius:14,fontWeight:700,cursor:"pointer",fontSize:15}}>{loading ? t("جاري الإرسال...", "Sending...") : t("إرسال طلب الشحن", "Send Top-up Request")}</button>
            </div>
          </form>
        </div>
      </div>

      <footer className="dash-footer">
        <p>{t("© 2026 Everest Academy. جميع الحقوق محفوظة.", "© 2026 Everest Academy. All Rights Reserved.")}</p>
        <div className="footer-links">
          <a href="#">{t("الدعم", "Support")}</a>
          <a href="#">{t("الخصوصية", "Privacy")}</a>
          <a href="#">{t("الشروط", "Terms")}</a>
        </div>
      </footer>
    </div>
  );
}

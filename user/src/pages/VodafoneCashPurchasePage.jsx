import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { useLang } from "../LangContext";
import { uploadApi } from "../App";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const api2 = async (path, opts = {}) => {
  const headers = { "Content-Type": "application/json" };
  const uid = localStorage.getItem("everest_user");
  const stoken = localStorage.getItem("everest_session_token");
  if (uid && stoken) { try { headers["x-user-id"] = JSON.parse(uid).id; headers["x-session-token"] = stoken; } catch {} }
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `HTTP ${res.status}`); }
  return res.json();
};

export default function VodafoneCashPurchasePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { t } = useLang();
  const [course, setCourse] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [gateways, setGateways] = useState([]);
  const { colors: c } = useTheme();

  useEffect(() => {
    api2(`/api/courses/${id}`).then(setCourse).catch(() => nav("/courses"));
    api2("/api/payment-gateways/active").then((data) => {
      if (Array.isArray(data)) setGateways(data.filter(g => g.type === "vodafone"));
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user && id) {
      api2(`/api/courses/my?userId=${user.id}&courseId=${id}`).then((data) => {
        const active = data.filter(e => e.status === "approved" || e.status === "pending");
        if (active.length) { setDone(true); setErr("existing"); }
      }).catch(() => {});
    }
  }, [user, id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setErr(t("من فضلك اختر صورة التحويل", "Please select transfer image")); return; }
    setUploading(true); setErr("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await uploadApi(formData);

      await api2(`/api/courses/${id}/purchase`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id, payment_method: "vodafone", payment_proof: url })
      });

      setDone(true);
    } catch (e) {
      setErr(e.message || t("حدث خطأ أثناء عملية الشراء", "An error occurred during purchase"));
    }
    setUploading(false);
  };

  if (!course) return <div className="courses-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><p style={{color:c.textSoft}}>{t("جاري التحميل...", "Loading...")}</p></div>;

  if (done) return (
    <div className="courses-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{textAlign:"center",padding:40}}>
        <p style={{fontSize:60,marginBottom:16}}>✅</p>
        <h2 style={{color:c.text,marginBottom:8}}>{err === "existing" ? t("أنت مسجل بالفعل", "Already Enrolled") : t("تم إرسال طلب الشراء", "Purchase Request Sent")}</h2>
        <p style={{color:c.textSoft,marginBottom:20}}>{err === "existing" ? t("هذا الكورس مسجل لك بالفعل أو في انتظار الموافقة.", "You are already enrolled or awaiting approval.") : t("في انتظار موافقة الادمن. سيتم تفعيل الكورس بعد التأكد من الدفع.", "Waiting for admin approval. Course will be activated after payment confirmation.")}</p>
        <Link to="/courses" style={{padding:"12px 24px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",borderRadius:12,color:"#FFFFFF",fontWeight:700,textDecoration:"none"}}>{t("العودة للكورسات", "Back to Courses")}</Link>
      </div>
    </div>
  );

  return (
    <div className="courses-body" style={{background:c.bg}}>
      <header className="courses-header">
        <div className="courses-nav">
          <Link to={`/courses/${id}`} className="courses-brand"><h1>EVEREST ACADEMY</h1></Link>
        </div>
      </header>

      <main className="courses-main" style={{maxWidth:600,margin:"0 auto",padding:"40px 0"}}>
        <div style={{background:"rgba(20,16,36,.6)",border:`1px solid ${c.border}`,borderRadius:20,padding:30}}>
          <h2 style={{color:"#B88BFF",fontSize:20,marginBottom:20,textAlign:"center"}}>{t("💳 شراء الكورس عبر فودافون كاش", "💳 Purchase via Vodafone Cash")}</h2>

          <div style={{background:c.bgCard,borderRadius:14,padding:20,marginBottom:24}}>
            <p style={{color:c.text,fontWeight:700,fontSize:16,marginBottom:8}}>{course.title_ar || course.title}</p>
            <p style={{color:"#B88BFF",fontSize:24,fontWeight:800}}>{course.price} E-Money</p>
          </div>

          <div style={{background:"rgba(254,212,0,.06)",border:"1px solid rgba(254,212,0,.15)",borderRadius:14,padding:16,marginBottom:24}}>
            <p style={{color:"#fed400",fontSize:13,fontWeight:700,marginBottom:6}}>{t("📱 بيانات الدفع عبر فودافون كاش:", "📱 Vodafone Cash Payment Info:")}</p>
            <p style={{color:"#9a95b0",fontSize:14}}>{t("يرجى تحويل المبلغ إلى أحد الأرقام التالية ثم رفع صورة التحويل:", "Please transfer to one of the following numbers then upload proof:")}</p>
            {gateways.length > 0 ? gateways.map((g, i) => (
              <div key={g.id} style={{background:c.bgCard,borderRadius:10,padding:"10px 14px",marginTop:8}}>
                {g.label && <p style={{color:"#9a95b0",fontSize:12,marginBottom:2}}>{g.label}</p>}
                <p style={{color:c.text,fontSize:20,fontWeight:800,letterSpacing:1,direction:"ltr",textAlign:"center"}}>{g.value}</p>
              </div>
            )            ) : (
              <div style={{textAlign:"center",padding:20}}>
                <p style={{fontSize:40,marginBottom:8}}>⚠️</p>
                <p style={{color:"#ff5b5b",fontSize:14,fontWeight:600}}>{t("هذه الخدمة غير متوفرة حالياً", "This service is currently unavailable")}</p>
                <p style={{color:"#9a95b0",fontSize:13,marginTop:4}}>{t("لم يتم إضافة وسيلة دفع فودافون كاش بعد. يرجى التواصل مع الإدارة.", "Vodafone Cash payment not added yet. Please contact support.")}</p>
              </div>
            )}
          </div>

          {err && <p style={{color:"#ff5b5b",fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</p>}

          {gateways.length > 0 && (
            <form onSubmit={handleUpload}>
              <div style={{marginBottom:20}}>
                <label style={{color:"#9a95b0",fontSize:13,display:"block",marginBottom:8}}>{t("صورة التحويل (Screenshot):", "Transfer Screenshot:")}</label>
                <div style={{border:`2px dashed ${c.border}`,borderRadius:14,padding:20,textAlign:"center",cursor:"pointer",background:c.bgCard}}
                  onClick={() => document.getElementById("proofInput").click()}>
                  <p style={{fontSize:40,marginBottom:8}}>📸</p>
                  <p style={{color:"#9a95b0",fontSize:13}}>{file ? file.name : t("اضغط لاختيار صورة التحويل", "Click to select transfer image")}</p>
                </div>
                <input id="proofInput" type="file" accept="image/*" style={{display:"none"}} onChange={(e) => setFile(e.target.files[0])} />
              </div>

              <button type="submit" disabled={uploading}
                style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",border:"none",borderRadius:14,color:"#FFFFFF",fontWeight:800,fontSize:16,cursor:"pointer",opacity:uploading?0.6:1}}>
                {uploading ? t("جاري رفع الصورة...", "Uploading image...") : t("تأكيد الدفع وإرسال الطلب", "Confirm Payment & Submit")}
              </button>
            </form>
          )}

          <Link to={`/courses/${id}`} style={{display:"block",textAlign:"center",marginTop:16,color:"#9a95b0",fontSize:13}}>{t("الرجوع", "Go Back")}</Link>
        </div>
      </main>
    </div>
  );
}

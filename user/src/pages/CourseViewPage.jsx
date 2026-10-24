import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { api } from "../App";
import { useTheme } from "../ThemeContext";
import AppNavbar from "../components/AppNavbar";
import QuizModal from "../components/QuizModal";
import { formatWhatsAppLink } from "../whatsapp";

export default function CourseViewPage() {
  const { t, dir, lang } = useLang();
  const { id } = useParams();
  const { user, login, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { colors: c, theme } = useTheme();
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => { const h = () => setM(window.innerWidth <= 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const [course, setCourse] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [buying, setBuying] = useState(false);
  const [err, setErr] = useState("");
  const [gateways, setGateways] = useState([]);
  const [balanceError, setBalanceError] = useState("");
  const [quizProgress, setQuizProgress] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [verifiedType, setVerifiedType] = useState(false);
  const [reviewData, setReviewData] = useState({ reviews: [], avg_rating: 0, count: 0 });
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [viewedLessons, setViewedLessons] = useState(new Set());
  const [prevLessonId, setPrevLessonId] = useState(null);
  const [csData, setCsData] = useState(null);

  const getViewedKey = () => `viewed_lessons_${user?.id}_${id}`;

  const trackViewed = (lessonId) => {
    if (!user?.id || !lessonId) return;
    setViewedLessons(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) return prev;
      const prevArr = Array.from(next);
      const lastPrev = prevArr.length > 0 ? prevArr[prevArr.length - 1] : null;
      if (lastPrev) setPrevLessonId(lastPrev);
      next.add(lessonId);
      localStorage.setItem(getViewedKey(), JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    api(`/api/courses/${id}`).then((data) => {
      setCourse(data);
      const params = new URLSearchParams(loc.search);
      const lessonId = params.get("lesson");
      if (lessonId && data?.topics) {
        for (const topic of data.topics) {
          const found = (topic.lessons || []).find(l => l.id === lessonId);
          if (found) { setPlaying({ ...found, topicTitle: topic.title_ar || topic.title, topicId: topic.id }); trackViewed(lessonId); break; }
        }
      } else if (user?.id && data?.topics) {
        const savedViewed = localStorage.getItem(`viewed_lessons_${user.id}_${id}`);
        const savedLast = localStorage.getItem(`last_viewed_${user.id}_${id}`);
        if (savedViewed) {
          try { setViewedLessons(new Set(JSON.parse(savedViewed))); } catch {}
        }
        if (savedLast) {
          for (const topic of data.topics) {
            const found = (topic.lessons || []).find(l => l.id === savedLast);
            if (found) { setPlaying({ ...found, topicTitle: topic.title_ar || topic.title, topicId: topic.id }); break; }
          }
        }
      }
    }).catch(() => setErr(t("الكورس غير موجود", "Course not found")));
  }, [id]);

  useEffect(() => {
    api(`/api/courses/${id}/reviews`).then(setReviewData).catch(() => {});
  }, [id]);

  useEffect(() => {
    api("/api/customer-service").then(setCsData).catch(() => {});
    api("/api/payment-gateways/active").then((data) => {
      if (Array.isArray(data)) setGateways(data);
    }).catch(() => {});
    if (user?.id) {
      api(`/api/users/${user.id}`).then((u) => {
        login({ ...user, ...u, session_token: user.session_token });
        setVerifiedType(true);
      }).catch(() => setVerifiedType(true));
    } else {
      setVerifiedType(true);
    }
  }, []);

  useEffect(() => {
    if (user && course) {
      api(`/api/courses/my?userId=${user.id}&courseId=${id}`).then((data) => {
        const active = data.filter(e => e.status === "approved" || e.status === "pending");
        if (active.length) setEnrollment(active[0]);
        else setEnrollment(null);
      }).catch(() => {});
    }
  }, [user, course, id]);

  useEffect(() => {
    if (user && course) {
      api(`/api/courses/${id}/quiz-progress?userId=${user.id}`).then(setQuizProgress).catch(() => {});
    }
  }, [user, course, id]);

  const isQuizPassed = useCallback((quizId) => {
    if (!quizId) return true;
    return quizProgress.some(q => q.id === quizId && q.passed);
  }, [quizProgress]);

  const refreshQuizProgress = () => {
    if (user && course) {
      api(`/api/courses/${id}/quiz-progress?userId=${user.id}`).then(setQuizProgress).catch(() => {});
    }
  };

  const buyCourse = async (method = "emoney") => {
    if (!user) { nav("/login"); return; }
    setBuying(true);
    try {
      const result = await api(`/api/courses/${id}/purchase`, {
        method: "POST", body: JSON.stringify({ userId: user.id, payment_method: "emoney" })
      });
      setEnrollment(result);
      const freshUser = await api(`/api/users/${user.id}`);
      login({ ...user, ...freshUser, session_token: user.session_token });
    } catch (e) {
      alert(t("خطأ: ", "Error: ") + (e.message || t("فشل عملية الشراء", "Purchase failed")));
    }
    setBuying(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "PrintScreen" || e.keyCode === 44) { e.preventDefault(); alert(t("لا يُسمح بالتقاط الشاشة", "Screenshots are not allowed")); return false; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S")) { e.preventDefault(); alert(t("لا يُسمح بتسجيل الشاشة", "Screen recording is not allowed")); return false; }
      if (e.ctrlKey && e.key === "p") { e.preventDefault(); return false; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const blockCtx = (e) => { e.preventDefault(); return false; };

  // Find the lesson quiz for the current lesson
  const getCurrentLessonQuiz = (lesson) => {
    if (!course?.topics) return null;
    for (const topic of course.topics) {
      for (const l of (topic.lessons || [])) {
        if (l.id === lesson.id && l.quiz) return l.quiz;
      }
    }
    return null;
  };

  // Find the topic quiz for a given topic
  const getTopicQuiz = (topic) => {
    if (!topic.quizzes) return null;
    return topic.quizzes.find(q => q.type === "topic" || (!q.type && !q.lesson_id)) || null;
  };

  // Check if all lessons in a topic are completed (for topic quiz gating)
  const isTopicFullyCompleted = (topic) => {
    return (topic.lessons || []).every(l => completedLessons.has(l.id));
  };

  // Navigate to next lesson, checking quiz requirements
  const goToNext = () => {
    const allLessons = (course.topics || []).flatMap((t) => (t.lessons || []).map((l) => ({ ...l, topicTitle: t.title_ar || t.title, topicId: t.id })));
    const currentIdx = allLessons.findIndex((l) => l.id === current?.id);
    if (currentIdx >= allLessons.length - 1) {
      // Check for final quiz
      if (course.final_quiz && !isQuizPassed(course.final_quiz.id)) {
        setActiveQuiz(course.final_quiz);
      }
      return;
    }

    // Mark current lesson as completed
    setCompletedLessons(prev => new Set([...prev, current.id]));

    // Check if current lesson has a quiz that hasn't been passed
    const lessonQuiz = getCurrentLessonQuiz(current);
    if (lessonQuiz && !isQuizPassed(lessonQuiz.id)) {
      setActiveQuiz(lessonQuiz);
      return;
    }

    const nextLesson = allLessons[currentIdx + 1];

    // Check if we're moving to a new topic - check topic quiz
    if (nextLesson.topicId !== current.topicId) {
      const nextTopic = course.topics.find(t => t.id === nextLesson.topicId);
      const prevTopic = course.topics.find(t => t.id === current.topicId);
      if (prevTopic) {
        const topicQuiz = getTopicQuiz(prevTopic);
        if (topicQuiz && !isQuizPassed(topicQuiz.id)) {
          setActiveQuiz(topicQuiz);
          return;
        }
      }
    }

    setPlaying(nextLesson);
    trackViewed(nextLesson.id);
  };

  const goToPrev = () => {
    const allLessons = (course.topics || []).flatMap((t) => (t.lessons || []).map((l) => ({ ...l, topicTitle: t.title_ar || t.title })));
    const currentIdx = allLessons.findIndex((l) => l.id === current?.id);
    if (currentIdx > 0) { setPlaying(allLessons[currentIdx - 1]); trackViewed(allLessons[currentIdx - 1].id); }
  };

  const onQuizPassed = () => {
    refreshQuizProgress();
    setCompletedLessons(prev => new Set([...prev, current?.id]));
  };

  if (err) return <div className="courses-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><p style={{color:"#ff5b5b"}}>{err}</p></div>;
  if (!course) return <div className="courses-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><p style={{color:"#9a95b0"}}>{t("جاري التحميل...", "Loading...")}</p></div>;

  const isFree = course.is_free || course.price === 0;
  const isApproved = enrollment?.status === "approved";
  const isPending = enrollment?.status === "pending";
  const isEnrolled = isApproved || (isFree && enrollment);
  const isStudentAccount = user?.account_type === "student" || user?.account_type === "registration_free";
  const canWatchAll = isEnrolled || isFree || isStudentAccount;
  const isExpiredMembership = user && (user.blocked || (user.membership_expires_at && new Date(user.membership_expires_at) < new Date()));

  const allLessons = (course.topics || []).flatMap((t) => (t.lessons || []).map((l) => ({ ...l, topicTitle: t.title_ar || t.title, topicId: t.id })));
  const current = playing || allLessons[0] || null;
  const idx = allLessons.findIndex((l) => l.id === current?.id);
  const isYoutube = (url) => url && (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube.com/embed"));
  const isBunny = (url) => url && (url.includes("player.mediadelivery.net") || url.includes("bunnycdn.com") || url.includes(".b-cdn.net"));
  const getBunnyEmbed = (url) => { if (url.includes(".b-cdn.net")) { const m = url.match(/\.b-cdn\.net\/([a-f0-9-]+)\//); return m ? `https://video.bunnycdn.com/embed/706401/${m[1]}?autoplay=true` : url; } return url.replace("/play/", "/embed/").replace(/(\?.*)?$/, "?autoplay=true"); };
  const getYtEmbed = (url) => { const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/); return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0` : null; };
  const videoSrc = current?.video_url ? (isYoutube(current.video_url) ? getYtEmbed(current.video_url) : isBunny(current.video_url) ? getBunnyEmbed(current.video_url) : current.video_url) : null;

  // Check if the current lesson is blocked by a quiz
  const currentLessonQuiz = current ? getCurrentLessonQuiz(current) : null;
  const currentQuizBlocked = currentLessonQuiz && !isQuizPassed(currentLessonQuiz.id);

  // Check if next lesson is blocked by lesson/topic quiz
  const nextLesson = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;
  const isNextTopicNew = nextLesson && current && nextLesson.topicId !== current.topicId;

  return (
    <div className="course-view-page" style={{background:c.bg,minHeight:"100vh"}}>
      <AppNavbar />

        <main className="courses-main" style={{maxWidth:1000,margin:"0 auto",padding:m?"0 14px 16px":"90px 5% 40px"}}>

        {/* Non-logged-in banner */}
        {!user && (
          <div style={{background:"rgba(179,135,40,.1)",border:"1px solid rgba(179,135,40,.25)",borderRadius:14,padding:m?"14px 16px":"16px 20px",marginBottom:m?12:20,display:"flex",flexDirection:m?"column":"row",alignItems:"center",justifyContent:"space-between",gap:m?10:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:m?20:24}}>🔒</span>
              <div>
                <p style={{fontWeight:700,color:"#B88BFF",fontSize:m?13:15,margin:0}}>{t("سجّل دخولك للمشاهدة الكاملة", "Sign in for full access")}</p>
                <p style={{fontSize:m?11:12,color:c.textMuted,margin:"2px 0 0"}}>{t("بعض الدروس مقفلة. سجّل دخولك أو أنشئ حسابًا جديدًا للمشاهدة.", "Some lessons are locked. Sign in or create an account to watch.")}</p>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              <Link to="/login" style={{padding:m?"10px 18px":"10px 22px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",borderRadius:10,color:"#FFFFFF",fontWeight:800,fontSize:m?12:13,textDecoration:"none",whiteSpace:"nowrap"}}>
                🔑 {t("تسجيل الدخول", "Login")}
              </Link>
              <Link to="/register" style={{padding:m?"10px 18px":"10px 22px",background:"transparent",border:`1px solid ${c.borderLight}`,borderRadius:10,color:c.text,fontWeight:700,fontSize:m?12:13,textDecoration:"none",whiteSpace:"nowrap"}}>
                ✨ {t("حساب جديد", "Register")}
              </Link>
            </div>
          </div>
        )}

        {isPending && (
          <div style={{background:"rgba(254,212,0,.08)",border:"1px solid rgba(254,212,0,.2)",borderRadius:14,padding:m?12:16,marginBottom:m?12:20,fontSize:m?13:14}}>
            <p style={{color:"#fed400",marginBottom:8}}>⏳ {t("طلبك في مرحلة المراجعة. في انتظار موافقة الادمن.", "Your request is under review. Waiting for admin approval.")}</p>
            {csData?.customer_service_whatsapp && (
              <a href={formatWhatsAppLink(csData.customer_service_whatsapp)} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 20px",background:"#25d366",borderRadius:10,color:"#fff",fontWeight:800,fontSize:m?13:14,textDecoration:"none",marginTop:6,boxShadow:"0 2px 12px rgba(37,211,102,.3)",transition:"transform .2s,box-shadow .2s"}}
                onMouseEnter={(e)=>{e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.boxShadow="0 4px 20px rgba(37,211,102,.45)"}}
                onMouseLeave={(e)=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 2px 12px rgba(37,211,102,.3)"}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
          </div>
        )}

        {!isEnrolled && !isPending && !isFree && !isStudentAccount && verifiedType && (
          <div style={{textAlign:"center",padding:m?"12px 0":"16px 0",marginBottom:m?12:20}}>
            {!user ? (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:m?10:14}}>
                <div style={{display:"flex",gap:m?8:12,justifyContent:"center",flexWrap:"wrap",width:"100%"}}>
                  <Link to="/login" style={{padding:m?"12px 22px":"14px 28px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",borderRadius:12,color:"#FFFFFF",fontWeight:800,fontSize:m?13:14,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8}}>
                    🔑 {t("سجّل دخولك لشراء الكورس", "Login to Buy")} — {course.price} $
                  </Link>
                  <Link to="/register" style={{padding:m?"12px 22px":"14px 28px",background:"transparent",border:`1px solid ${c.borderLight}`,borderRadius:12,color:c.text,fontWeight:700,fontSize:m?13:14,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8}}>
                    ✨ {t("حساب جديد", "Register")}
                  </Link>
                </div>
              </div>
            ) : (
              <>

                {balanceError && (
                  <p style={{color:"#ff5b5b",fontSize:m?12:13,marginBottom:10,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {balanceError}
                    {csData?.customer_service_whatsapp && (
                      <a href={formatWhatsAppLink(csData.customer_service_whatsapp)} target="_blank" rel="noopener noreferrer"
                        style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 14px",background:"#25d366",borderRadius:8,color:"#fff",fontWeight:700,fontSize:m?12:13,textDecoration:"none",boxShadow:"0 1px 8px rgba(37,211,102,.25)"}}
                        onMouseEnter={(e)=>{e.currentTarget.style.transform="scale(1.04)"}}
                        onMouseLeave={(e)=>{e.currentTarget.style.transform="scale(1)"}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                    )}
                  </p>
                )}
                <div style={{display:"flex",gap:m?8:12,justifyContent:"center",flexWrap:"wrap"}}>
                  <button onClick={async () => {
                    if ((user?.usd_balance || 0) < course.price) { setBalanceError(t("رصيد $ غير كافٍ. تواصل مع خدمة العملاء لشحن رصيدك.", "Insufficient $ balance. Contact customer service to top up.")); return; }
                    setBalanceError(""); await buyCourse("emoney");
                  }} disabled={buying || (user?.usd_balance || 0) < course.price}
                    style={{padding:m?"12px 18px":"14px 26px",background:(user?.usd_balance || 0) < course.price ? "#555" : "linear-gradient(135deg,#6E3BF2,#B88BFF)",border:"none",borderRadius:12,color:"#FFFFFF",fontWeight:800,fontSize:m?13:14,cursor:(user?.usd_balance || 0) < course.price ? "not-allowed" : "pointer",opacity:buying?0.6:1}}>
                    {buying ? t("جاري الشراء...", "Purchasing...") : `💳 ${t("اشتري بـ", "Buy for")} ${course.price} $`}
                  </button>
                </div>
                <p style={{color:c.textMuted,fontSize:12,marginTop:8}}>{t("رصيدك الحالي:", "Your current balance:")} {user?.usd_balance || 0} $</p>
              </>
            )}
          </div>
        )}

        {/* 1. Video Player */}
        <div style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:m?12:16,overflow:"hidden",position:"relative",marginBottom:m?12:20}}>
          <div onContextMenu={blockCtx} style={{aspectRatio:"16/9",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",userSelect:"none",WebkitUserSelect:"none"}}>
            {isExpiredMembership ? (
              <div style={{textAlign:"center",padding:m?24:40}}>
                <div style={{width:m?60:80,height:m?60:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(239,68,68,.2),rgba(220,38,38,.3))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:m?28:36}}>🚫</div>
                <p style={{fontWeight:800,color:"#ef4444",marginBottom:6,fontSize:m?15:18}}>{t("تم انتهاء العضوية", "Membership Expired")}</p>
                <p style={{fontSize:m?12:14,color:"#888",marginBottom:m?16:24,lineHeight:1.5,maxWidth:350,marginLeft:"auto",marginRight:"auto"}}>
                  {t("تواصل مع خدمة العملاء لتجديد العضوية.", "Contact customer service to renew your membership.")}
                </p>
                <a href={formatWhatsAppLink(csData?.customer_service_whatsapp)} target="_blank" rel="noopener noreferrer" style={{
                  padding:m?"12px 28px":"14px 32px",background:"linear-gradient(135deg,#25d366,#128c7e)",
                  borderRadius:12,color:"#fff",fontWeight:800,fontSize:m?13:15,textDecoration:"none",
                  display:"inline-flex",alignItems:"center",gap:8,transition:"all 0.3s"
                }}>
                  💬 {t("تواصل مع خدمة العملاء", "Contact Customer Service")}
                </a>
              </div>
            ) : !user && current && current.is_free ? (
              videoSrc ? (
                isYoutube(current?.video_url) ? (
                  <iframe src={videoSrc} style={{width:"100%",height:"100%",aspectRatio:"16/9",border:"none"}} allowFullScreen allow="autoplay; encrypted-media" title="video" />
                ) : isBunny(current?.video_url) ? (
                  <iframe src={videoSrc} style={{width:"100%",height:"100%",aspectRatio:"16/9",border:"none"}} allowFullScreen allow="autoplay; encrypted-media" title="video" />
                ) : (
                  <video src={videoSrc} controls playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture style={{width:"100%",height:"100%",objectFit:"contain"}} />
                )
              ) : (
                <div style={{color:"#555",textAlign:"center",padding:m?20:30}}>
                  <p style={{fontSize:m?36:48,marginBottom:m?8:12}}>🎬</p>
                  <p style={{fontSize:m?12:14}}>{t("هذا الدرس لا يحتوي على فيديو", "This lesson has no video")}</p>
                </div>
              )
            ) : !user ? (
              <div style={{textAlign:"center",padding:m?24:40}}>
                <div style={{width:m?60:80,height:m?60:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(110,59,242,.15),rgba(110,59,242,.25))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:m?28:36}}>🔒</div>
                <p style={{fontWeight:800,color:"#fff",marginBottom:6,fontSize:m?15:18}}>{t("هذا الدرس مقفل", "This lesson is locked")}</p>
                <p style={{fontSize:m?12:14,color:"#888",marginBottom:m?16:24,lineHeight:1.5,maxWidth:350,marginLeft:"auto",marginRight:"auto"}}>
                  {t("سجّل دخولك أو أنشئ حسابًا جديدًا لمشاهدة هذا الدرس والمحتوى المدفوع.", "Sign in or create a new account to watch this lesson and paid content.")}
                </p>
                <div style={{display:"flex",gap:m?8:12,justifyContent:"center",flexWrap:"wrap"}}>
                  <Link to="/login" style={{
                    padding:m?"12px 28px":"14px 32px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",
                    borderRadius:12,color:"#FFFFFF",fontWeight:800,fontSize:m?13:15,textDecoration:"none",
                    display:"inline-flex",alignItems:"center",gap:8,transition:"all 0.3s"
                  }}>
                    🔑 {t("تسجيل الدخول", "Login")}
                  </Link>
                  <Link to="/register" style={{
                    padding:m?"12px 28px":"14px 32px",background:"rgba(255,255,255,.06)",
                    border:"1px solid rgba(255,255,255,.12)",borderRadius:12,color:"#fff",
                    fontWeight:700,fontSize:m?13:15,textDecoration:"none",
                    display:"inline-flex",alignItems:"center",gap:8,transition:"all 0.3s"
                  }}>
                    ✨ {t("إنشاء حساب جديد", "Create Account")}
                  </Link>
                </div>
              </div>
            ) : current && (isEnrolled ? false : (!canWatchAll && !current.is_free)) ? (
              <div style={{textAlign:"center",color:"#555",padding:m?16:30}}>
                <p style={{fontSize:m?32:48,marginBottom:m?6:12}}>🔒</p>
                <p style={{fontWeight:700,color:c.text,marginBottom:4,fontSize:m?13:16}}>{t("هذا الدرس مقفل", "This lesson is locked")}</p>
                <p style={{fontSize:m?11:13,color:c.textMuted,marginBottom:m?10:16}}>{t("اشترِ الكورس للمشاهدة الكاملة", "Buy the course for full access")}</p>
                <Link to={`/courses/${id}`} style={{display:"inline-flex",alignItems:"center",gap:8,padding:m?"10px 18px":"10px 24px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",borderRadius:10,color:"#FFFFFF",fontWeight:800,fontSize:m?12:13,textDecoration:"none"}}>
                  💳 {t("اشترِ الكورس", "Buy Course")} — {course.price} $
                </Link>
              </div>
            ) : videoSrc ? (
              isYoutube(current?.video_url) ? (
                <iframe src={videoSrc} style={{width:"100%",height:"100%",aspectRatio:"16/9",border:"none"}} allowFullScreen allow="autoplay; encrypted-media" title="video" />
              ) : isBunny(current?.video_url) ? (
                <iframe src={videoSrc} style={{width:"100%",height:"100%",aspectRatio:"16/9",border:"none"}} allowFullScreen allow="autoplay; encrypted-media" title="video" />
              ) : (
                <video src={videoSrc} controls playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture style={{width:"100%",height:"100%",objectFit:"contain"}} onEnded={() => {
                  if (currentLessonQuiz && !isQuizPassed(currentLessonQuiz.id)) {
                    setActiveQuiz(currentLessonQuiz);
                  } else {
                    setCompletedLessons(prev => new Set([...prev, current?.id]));
                  }
                }} />
              )
            ) : (
              <div style={{color:"#555",textAlign:"center",padding:m?20:30}}>
                <p style={{fontSize:m?36:48,marginBottom:m?8:12}}>🎬</p>
                <p style={{fontSize:m?12:14}}>{t("هذا الدرس لا يحتوي على فيديو", "This lesson has no video")}</p>
              </div>
            )}
          </div>
          {current && (
            <div style={{padding:m?10:16,borderTop:`1px solid ${c.borderLight}`}}>
              {currentQuizBlocked && (
                <div style={{background:"rgba(110,59,242,.1)",border:"1px solid rgba(110,59,242,.3)",borderRadius:10,padding:m?10:14,marginBottom:m?8:12,display:"flex",flexDirection:m?"column":"row",justifyContent:"space-between",alignItems:m?"stretch":"center",gap:m?8:0}}>
                  <div style={{color:"#6E3BF2",fontSize:m?11:14,fontWeight:700}}>
                    📝 {t("هذا الدرس له اختبار. أجب على الاختبار للمتابعة.", "This lesson has a quiz. Complete it to continue.")}
                  </div>
                  <button onClick={() => setActiveQuiz(currentLessonQuiz)}
                    style={{padding:"8px 20px",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",border:"none",borderRadius:10,color:"#FFFFFF",fontWeight:800,fontSize:m?12:13,cursor:"pointer",marginTop:m?4:0}}>
                    {t("ابدأ الاختبار", "Take Quiz")}
                  </button>
                </div>
              )}
              <div style={{display:"flex",flexDirection:m?"column":"row",justifyContent:"space-between",alignItems:m?"stretch":"center",gap:m?8:0}}>
                <div>
                  <p style={{fontWeight:700,color:c.text,fontSize:m?13:15}}>{current.title_ar || current.title}</p>
                  <p style={{fontSize:m?10:12,color:c.textMuted,marginTop:2}}>{current.topicTitle}</p>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:m?"space-between":"flex-end",marginTop:m?4:0}}>
                  {idx > 0 && <button onClick={goToPrev} style={{padding:m?"10px 14px":"8px 16px",background:c.bgInput,border:`1px solid ${c.borderLight}`,borderRadius:8,color:c.text,cursor:"pointer",fontSize:m?12:13,flex:m?1:"none",minHeight:40}}>{t("السابق", "Previous")}</button>}
                  {idx < allLessons.length-1 && (
                    <button onClick={goToNext} disabled={currentQuizBlocked}
                      style={{padding:m?"10px 14px":"8px 16px",background:currentQuizBlocked ? c.border : "linear-gradient(135deg,#6E3BF2,#B88BFF)",border:"none",borderRadius:8,color:currentQuizBlocked ? c.textMuted : "#FFFFFF",cursor:currentQuizBlocked ? "not-allowed" : "pointer",fontWeight:700,fontSize:m?12:13,opacity:currentQuizBlocked ? 0.5 : 1,flex:m?1:"none",minHeight:40}}>
                      {t("التالي", "Next")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Course Content */}
        {(isEnrolled || isStudentAccount) && (<div style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:m?12:16,padding:m?14:20,marginBottom:m?12:20}}>
          <h3 style={{fontSize:m?14:15,fontWeight:700,color:"#B88BFF",marginBottom:m?12:16,letterSpacing:1}}>{t("محتوى الكورس", "COURSE CONTENT")}</h3>
          {(course.topics || []).map((topic) => {
            const topicQuiz = getTopicQuiz(topic);
            const topicQuizPassed = topicQuiz ? isQuizPassed(topicQuiz.id) : true;
            return (
              <div key={topic.id} style={{marginBottom:m?12:16}}>
                <p style={{fontSize:m?11:12,fontWeight:700,color:c.textMuted,marginBottom:6,padding:"0 4px"}}>
                  {topic.title_ar || topic.title}
                  {topicQuiz && <span style={{marginLeft:6,fontSize:10,color:topicQuizPassed ? "#22c55e" : "#B88BFF"}}>{topicQuizPassed ? "✅" : "📝"}</span>}
                </p>
                {(topic.lessons || []).map((lesson) => {
                  const locked = !canWatchAll && !lesson.is_free;
                  const lessonQuiz = lesson.quiz;
                  const lessonQuizPassed = lessonQuiz ? isQuizPassed(lessonQuiz.id) : true;
                  const isPlaying = current?.id === lesson.id;
                  const isViewed = viewedLessons.has(lesson.id) && !isPlaying;
                  return (
                    <button key={lesson.id} onClick={() => { if (locked) { setPlaying(lesson); } else { setPlaying(lesson); trackViewed(lesson.id); } }}
                      style={{width:"100%",textAlign:lang==="ar"?"right":"left",padding:m?"10px 12px":"10px 14px",borderRadius:10,border:"none",fontSize:m?12:13,cursor:locked?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:3,
                        background:isPlaying?"linear-gradient(135deg,#6E3BF2,#B88BFF)":c.bgInput,
                        color:isPlaying?"#FFFFFF":locked?"#555":c.text,
                        fontWeight:isPlaying?700:400,transition:"all 0.2s",minHeight:42
                      }}>
                      <span style={{width:m?22:24,height:m?22:24,borderRadius:6,background:isPlaying?"rgba(0,0,0,.1)":isViewed?"rgba(34,197,94,.15)":theme==="dark"?"rgba(255,255,255,.06)":"rgba(0,0,0,.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:m?10:11,flexShrink:0}}>
                        {locked ? "🔒" : isPlaying ? "▶" : isViewed ? "✓" : "🎬"}
                      </span>
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:lang==="ar"?"right":"left"}}>{lesson.title_ar || lesson.title}</span>
                      {isViewed && !locked && <span style={{fontSize:9,background:"rgba(34,197,94,.15)",color:"#22c55e",padding:"2px 6px",borderRadius:6,whiteSpace:"nowrap"}}>{t("تمت المشاهدة", "Watched")}</span>}
                      {locked && <span style={{fontSize:9,background:"rgba(255,91,91,.1)",color:"#ff5b5b",padding:"2px 6px",borderRadius:6,whiteSpace:"nowrap"}}>{t("مقفل", "Locked")}</span>}
                      {lesson.is_free && <span style={{fontSize:9,background:"rgba(254,212,0,.15)",color:"#fed400",padding:"2px 6px",borderRadius:6,whiteSpace:"nowrap"}}>{t("مجاني", "FREE")}</span>}
                      {lessonQuiz && <span style={{fontSize:9,background:lessonQuizPassed ? "rgba(34,197,94,.15)" : "rgba(255,91,91,.15)",color:lessonQuizPassed ? "#22c55e" : "#ff5b5b",padding:"2px 6px",borderRadius:6}}>{lessonQuizPassed ? "✅" : "📝"}</span>}
                    </button>
                  );
                })}
                {topicQuiz && (
                  <button onClick={() => setActiveQuiz(topicQuiz)}
                    style={{width:"100%",textAlign:lang==="ar"?"right":"left",padding:m?"8px 12px":"8px 14px",borderRadius:10,border:"none",fontSize:m?11:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:3,minHeight:38,
                      background:topicQuizPassed ? "rgba(34,197,94,.08)" : "rgba(110,59,242,.08)",
                      color:topicQuizPassed ? "#22c55e" : "#6E3BF2",
                      fontWeight:600
                    }}>
                    <span>📝</span>
                    <span style={{flex:1,textAlign:lang==="ar"?"right":"left"}}>{topicQuiz.title || t("اختبار الموضوع", "Topic Quiz")}</span>
                    <span style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:topicQuizPassed ? "rgba(34,197,94,.15)" : "rgba(255,91,91,.15)",whiteSpace:"nowrap"}}>{topicQuizPassed ? "✅" : t("لم يُكمل", "Pending")}</span>
                  </button>
                )}
              </div>
            );
          })}
          {course.final_quiz && (
            <button onClick={() => setActiveQuiz(course.final_quiz)}
              style={{width:"100%",textAlign:lang==="ar"?"right":"left",padding:m?"10px 12px":"10px 14px",borderRadius:10,border:"none",fontSize:m?12:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:4,marginTop:8,minHeight:42,
                background:isQuizPassed(course.final_quiz.id) ? "rgba(34,197,94,.08)" : "rgba(110,59,242,.08)",
                color:isQuizPassed(course.final_quiz.id) ? "#22c55e" : "#6E3BF2",
                fontWeight:600
              }}>
              <span>🏆</span>
              <span style={{flex:1,textAlign:lang==="ar"?"right":"left"}}>{course.final_quiz.title || t("الاختبار النهائي", "Final Quiz")}</span>
              <span style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:isQuizPassed(course.final_quiz.id) ? "rgba(34,197,94,.15)" : "rgba(255,91,91,.15)",whiteSpace:"nowrap"}}>{isQuizPassed(course.final_quiz.id) ? "✅" : t("لم يُكمل", "Pending")}</span>
            </button>
          )}
        </div>)}

        {/* 3. Course Information */}
        <div style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:m?12:16,padding:m?16:28,marginBottom:m?12:20}}>
          <h2 style={{fontSize:m?"1.15rem":"1.6rem",fontWeight:800,background:"linear-gradient(135deg,#fdfbfb,#B88BFF,#6E3BF2)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:12}}>
            {course.title_ar || course.title}
          </h2>
          <p style={{color:c.textMuted,fontSize:m?12:14,lineHeight:m?1.6:1.8,marginBottom:m?14:20}}>{course.description_ar || course.description}</p>
          <div style={{display:"grid",gridTemplateColumns:m?"1fr 1fr":"1fr 1fr",gap:m?10:16}}>
            <div style={{background:c.bgInput,borderRadius:10,padding:m?"10px 12px":"14px 16px"}}>
              <p style={{fontSize:m?10:11,color:c.textMuted,margin:"0 0 3px",fontWeight:600}}>{t("المستوى", "Level")}</p>
              <p style={{fontSize:m?12:14,fontWeight:700,color:c.text,margin:0}}>
                {course.difficulty === "beginner" ? t("مبتدئ", "Beginner") : course.difficulty === "intermediate" ? t("متوسط", "Intermediate") : t("متقدم", "Advanced")}
              </p>
            </div>
            <div style={{background:c.bgInput,borderRadius:10,padding:m?"10px 12px":"14px 16px"}}>
              <p style={{fontSize:m?10:11,color:c.textMuted,margin:"0 0 3px",fontWeight:600}}>{t("الدروس", "Lessons")}</p>
              <p style={{fontSize:m?12:14,fontWeight:700,color:c.text,margin:0}}>{allLessons.length} {t("درس", "lessons")}</p>
            </div>
            {reviewData.avg_rating > 0 && (
              <div style={{background:c.bgInput,borderRadius:10,padding:m?"10px 12px":"14px 16px"}}>
                <p style={{fontSize:m?10:11,color:c.textMuted,margin:"0 0 3px",fontWeight:600}}>{t("التقييم", "Rating")}</p>
                <p style={{fontSize:m?12:14,fontWeight:700,color:"#f59e0b",margin:0}}>⭐ {reviewData.avg_rating} <span style={{fontSize:m?10:12,color:c.textMuted,fontWeight:400}}>({reviewData.count})</span></p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Course Reviews */}
        {(isEnrolled || isStudentAccount) && (
          <div style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:m?12:16,padding:m?16:24,marginBottom:m?12:20}}>
            <h3 style={{fontSize:m?14:16,fontWeight:700,color:"#B88BFF",marginBottom:m?12:16}}>⭐ {t("قيّم هذا الكورس", "Rate This Course")}</h3>
            <div style={{display:"flex",gap:m?4:6,marginBottom:12}}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setMyRating(s)} style={{fontSize:m?26:28,cursor:"pointer",background:"none",border:"none",color:s <= myRating ? "#f59e0b" : c.textMuted,transition:"transform 0.2s",transform:s<=myRating?"scale(1.2)":"scale(1)",padding:"4px"}}>★</button>
              ))}
            </div>
            <textarea value={myComment} onChange={(e) => setMyComment(e.target.value)} placeholder={t("اكتب تعليقك (اختياري)...", "Write your comment (optional)...")} style={{width:"100%",padding:m?"8px 12px":"10px 14px",borderRadius:10,border:`1px solid ${c.borderLight}`,background:c.bgInput,color:c.text,fontSize:m?12:13,minHeight:50,resize:"vertical",marginBottom:12,boxSizing:"border-box"}} />
            <button onClick={async () => {
              if (!myRating || !user) return;
              setSubmittingReview(true);
              try {
                await api(`/api/courses/${id}/reviews`, { method:"POST", body:JSON.stringify({userId:user.id, rating:myRating, comment:myComment}) });
                const fresh = await api(`/api/courses/${id}/reviews`);
                setReviewData(fresh);
                setMyRating(0); setMyComment("");
              } catch(e) {}
              setSubmittingReview(false);
            }} disabled={!myRating || submittingReview} style={{padding:m?"10px 18px":"10px 24px",background:myRating && !submittingReview ? "linear-gradient(135deg,#6E3BF2,#B88BFF)" : c.border,border:"none",borderRadius:10,color:myRating && !submittingReview ? "#FFFFFF" : c.textMuted,fontWeight:700,fontSize:m?12:13,cursor:myRating && !submittingReview ? "pointer" : "not-allowed"}}>
              {submittingReview ? t("جاري الإرسال...", "Submitting...") : t("إرسال التقييم", "Submit Review")}
            </button>
          </div>
        )}

        {/* 5. Student Reviews */}
        {reviewData.reviews.length > 0 && (
          <div style={{background:c.bgCard,border:`1px solid ${c.borderLight}`,borderRadius:m?12:16,padding:m?16:24,marginBottom:m?12:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:m?14:20,flexWrap:"wrap"}}>
              <h3 style={{fontSize:m?14:16,fontWeight:700,color:"#B88BFF",margin:0}}>⭐ {t("تقييمات الطلاب", "Student Reviews")}</h3>
              <span style={{fontSize:m?13:14,color:"#f59e0b",fontWeight:700}}>{reviewData.avg_rating}</span>
              <span style={{fontSize:m?11:12,color:c.textMuted}}>({reviewData.count} {t("تقييم", "reviews")})</span>
            </div>
            {reviewData.reviews.map((r) => (
              <div key={r.id} style={{padding:m?"12px 0":"14px 0",borderBottom:`1px solid ${c.borderLight}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <div style={{width:m?28:32,height:m?28:32,borderRadius:"50%",background:"linear-gradient(135deg,#6E3BF2,#B88BFF)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFFFFF",fontWeight:700,fontSize:m?11:13,flexShrink:0}}>
                    {r.full_name?.charAt(0) || "?"}
                  </div>
                  <span style={{fontSize:m?12:13,fontWeight:600,color:c.text}}>{r.full_name}</span>
                  <span style={{fontSize:m?11:12,color:"#f59e0b"}}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <span style={{fontSize:m?10:11,color:c.textMuted}}>{r.created_at?.slice(0,10)}</span>
                </div>
                {r.comment && <p style={{fontSize:m?12:13,color:c.textMuted,margin:0,paddingRight:m?36:42}}>{r.comment}</p>}
              </div>
            ))}
          </div>
        )}

      </main>

      {activeQuiz && (
        <QuizModal quiz={activeQuiz} onClose={() => setActiveQuiz(null)} onPassed={onQuizPassed} />
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../AuthContext";
import { api } from "../App";

export default function QuizModal({ quiz, onClose, onPassed }) {
  const { t, lang } = useLang();
  const { colors: c } = useTheme();
  const { user } = useAuth();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Quiz protection: block copy, right-click, paste, select, drag during quiz
  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    const blockKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = String(e.key || "").toLowerCase();
      // Block Ctrl+C (copy), Ctrl+V (paste), Ctrl+A (select all), Ctrl+X (cut)
      if (ctrl && (key === "c" || key === "v" || key === "a" || key === "x")) { e.preventDefault(); return false; }
      // Block Ctrl+Shift+I/C/J (DevTools)
      if (ctrl && e.shiftKey && (key === "i" || key === "c" || key === "j")) { e.preventDefault(); return false; }
      // Block F12
      if (key === "f12") { e.preventDefault(); return false; }
      // Block PrintScreen
      if (key === "printscreen") { e.preventDefault(); return false; }
    };

    document.addEventListener("contextmenu", prevent);
    document.addEventListener("keydown", blockKey);
    document.addEventListener("dragstart", prevent);
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.msUserSelect = "none";
    document.body.style.MozUserSelect = "none";

    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("keydown", blockKey);
      document.removeEventListener("dragstart", prevent);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.msUserSelect = "";
      document.body.style.MozUserSelect = "";
    };
  }, []);

  const questions = JSON.parse(quiz?.questions || "[]");
  const q = questions[current];

  const setAnswer = (val) => setAnswers(prev => ({ ...prev, [current]: val }));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api(`/api/courses/quizzes/${quiz.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id, answers }),
      });
      setResult(res);
    } catch (err) {
      alert(t("خطأ في تسجيل الإجابة", "Error submitting quiz") + ": " + err.message);
    }
    setSubmitting(false);
  };

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0;

  if (result) {
    const passed = result.result === "pass";
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
        <div style={{ background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 24, padding: "36px 30px", maxWidth: 460, width: "90%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: passed ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 36 }}>
            {passed ? "🎉" : "😢"}
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: passed ? "#22c55e" : "#ef4444", marginBottom: 6 }}>
            {passed ? t("أحسنت! نجحت", "You Passed!") : t("لم تنجح", "Not Passed")}
          </h2>
          <p style={{ color: c.textMuted, fontSize: 13, marginBottom: 24 }}>
            {passed ? t("أحسنت على إتمام الاختبار بنجاح", "Great job completing the quiz") : t("يمكنك إعادة المحاولة", "You can try again")}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#22c55e" }}>{result.correct}</div>
              <div style={{ color: c.textMuted, fontSize: 12 }}>{t("صحيحة", "Correct")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#ef4444" }}>{result.incorrect}</div>
              <div style={{ color: c.textMuted, fontSize: 12 }}>{t("خاطئة", "Wrong")}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#6E3BF2" }}>{result.marks}%</div>
              <div style={{ color: c.textMuted, fontSize: 12 }}>{t("النتيجة", "Score")}</div>
            </div>
          </div>
          <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 8, background: passed ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: passed ? "#22c55e" : "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            {t("نسبة النجاح:", "Pass mark:")} {result.passMark}% {t("— نتيجتك:", "— Your score:")} {result.marks}%
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {passed ? (
              <button onClick={() => { onPassed(); onClose(); }}
                style={{ padding: "14px 40px", background: "linear-gradient(135deg,#6E3BF2,#B88BFF)", border: "none", borderRadius: 14, color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                {t("متابعة", "Continue")}
              </button>
            ) : (
              <>
                <button onClick={() => { setResult(null); setCurrent(0); setAnswers({}); }}
                  style={{ padding: "14px 32px", background: "linear-gradient(135deg,#6E3BF2,#B88BFF)", border: "none", borderRadius: 14, color: "#FFFFFF", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                  {t("إعادة المحاولة", "Retry")}
                </button>
                <button onClick={onClose}
                  style={{ padding: "14px 32px", background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 14, color: c.text, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  {t("إغلاق", "Close")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: c.bgCard, border: `1px solid ${c.borderLight}`, borderRadius: 24, maxWidth: 620, width: "92%", maxHeight: "88vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${c.borderLight}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: c.text, margin: 0 }}>📝 {quiz.title || t("اختبار", "Quiz")}</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: c.textMuted, fontSize: 22, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: c.textMuted }}>
              {t("السؤال", "Question")} <strong style={{ color: c.text }}>{current + 1}</strong> {t("من", "of")} {questions.length}
            </span>
            <span style={{ fontSize: 12, color: answeredCount === questions.length ? "#22c55e" : c.textMuted }}>
              {answeredCount}/{questions.length} {t("تم الإجابة", "answered")}
            </span>
          </div>
          {/* Progress */}
          <div style={{ height: 4, background: c.borderLight, borderRadius: 4 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(135deg,#6E3BF2,#B88BFF)", borderRadius: 4, transition: "width .3s" }} />
          </div>
        </div>

        {q && (
          <div style={{ padding: "18px 20px" }}>
            {/* Question type badge */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: q.type === "tf" ? "rgba(34,197,94,.12)" : "rgba(59,130,246,.12)", color: q.type === "tf" ? "#22c55e" : "#3b82f6" }}>
                {q.type === "tf" ? "✅ T/F" : "🔘 MCQ"}
              </span>
            </div>
            {/* Question */}
            <p style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 18, lineHeight: 1.7 }}>{q.question}</p>

            {q.type === "tf" ? (
              /* True / False buttons */
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setAnswer(true)}
                  style={{
                    flex: 1, padding: "16px 14px", borderRadius: 16, cursor: "pointer",
                    border: `3px solid ${answers[current] === true ? "#22c55e" : c.borderLight}`,
                    background: answers[current] === true ? "rgba(34,197,94,.08)" : "transparent",
                    color: c.text, fontSize: 15, fontWeight: 700, transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
                  }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: answers[current] === true ? "#22c55e" : c.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: answers[current] === true ? "#fff" : c.textMuted }}>✓</div>
                  {t("صح", "True")}
                </button>
                <button onClick={() => setAnswer(false)}
                  style={{
                    flex: 1, padding: "16px 14px", borderRadius: 16, cursor: "pointer",
                    border: `3px solid ${answers[current] === false ? "#ef4444" : c.borderLight}`,
                    background: answers[current] === false ? "rgba(239,68,68,.08)" : "transparent",
                    color: c.text, fontSize: 15, fontWeight: 700, transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
                  }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: answers[current] === false ? "#ef4444" : c.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: answers[current] === false ? "#fff" : c.textMuted }}>✕</div>
                  {t("غلط", "False")}
                </button>
              </div>
            ) : (
              /* MCQ options */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(q.options || []).map((opt, i) => {
                  const selected = answers[current] === i;
                  return (
                    <button key={i} onClick={() => setAnswer(i)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                        border: `2px solid ${selected ? "#6E3BF2" : c.borderLight}`,
                        background: selected ? "rgba(110,59,242,.08)" : "transparent",
                        color: c.text, fontSize: 14, textAlign: "right", transition: "all .2s"
                      }}>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: selected ? "#6E3BF2" : c.border,
                        color: selected ? "#FFFFFF" : c.textMuted,
                        fontWeight: 700, fontSize: 13, transition: "all .2s"
                      }}>{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${c.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          {/* Question dots */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {questions.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} style={{
                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: i === current ? "#6E3BF2" : answers[i] !== undefined ? "#22c55e" : c.border,
                color: i === current ? "#FFFFFF" : answers[i] !== undefined ? "#fff" : c.textMuted,
                fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .2s"
              }}>{i + 1}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {current > 0 && (
              <button onClick={() => setCurrent(current - 1)}
                style={{ padding: "10px 22px", background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 12, color: c.text, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {t("السابق", "Prev")}
              </button>
            )}
            {current < questions.length - 1 ? (
              <button onClick={() => setCurrent(current + 1)}
                style={{ padding: "10px 22px", background: "linear-gradient(135deg,#6E3BF2,#B88BFF)", border: "none", borderRadius: 12, color: "#FFFFFF", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                {t("التالي", "Next")}
              </button>
            ) : (
              <button onClick={submit} disabled={submitting || answeredCount < questions.length}
                style={{
                  padding: "10px 22px", borderRadius: 12, border: "none", cursor: answeredCount >= questions.length ? "pointer" : "not-allowed",
                  background: answeredCount >= questions.length ? "linear-gradient(135deg,#6E3BF2,#B88BFF)" : c.border,
                  color: answeredCount >= questions.length ? "#FFFFFF" : c.textMuted,
                  fontSize: 13, fontWeight: 700, opacity: submitting ? 0.6 : 1
                }}>
                {submitting ? t("جاري...", "...") : t("إنهاء", "Finish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLang } from "../LangContext";
import { api } from "../api.js";

export default function QuizAttemptsPage() {
  const { t } = useLang();
  const [attempts, setAttempts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api("/api/courses/attempts").then(setAttempts);
  }, []);

  const openDetail = async (attempt) => {
    setDetail({ ...attempt, quizData: null });
    setDetailLoading(true);
    try {
      const quiz = await api(`/api/courses/quizzes/${attempt.quiz_id}`);
      setDetail({ ...attempt, quizData: quiz });
    } catch {
      setDetail({ ...attempt, quizData: null });
    } finally {
      setDetailLoading(false);
    }
  };

  const getQuestions = () => {
    if (!detail?.quizData?.questions) return [];
    try {
      const parsed = JSON.parse(detail.quizData.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  const downloadPDF = () => {
    try {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Quiz Results /", 14, 15);
    doc.text("نتائج الاختبارات", 100, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString("ar-EG")}  |  Total: ${attempts.length}`, 14, 23);

    const rows = attempts.map((a) => {
      const pct = a.earned_marks || 0;
      return [
        a.quiz_title || "—",
        a.student_name || "—",
        a.student_email || "—",
        a.student_id || "—",
        a.course_name || "—",
        String(a.total_marks),
        String(a.correct_answers),
        String(a.incorrect_answers),
        `${a.correct_answers}/${a.total_marks} (${pct}%)`,
        a.result === "pass" ? "PASS" : "FAIL",
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [[
        "Quiz", "Student", "Email", "ID", "Course",
        "Total", "Correct", "Wrong", "Score", "Result"
      ]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 9) {
          const val = data.cell.raw;
          data.cell.styles.textColor = val === "PASS" ? [22, 163, 74] : [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.save("quiz-results.pdf");
    } catch (e) { alert(t("خطأ في تحميل PDF:", "PDF download error:") + " " + e.message); }
  };

  const downloadDetailPDF = () => {
    if (!detail) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pct = detail.earned_marks || 0;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Quiz Detail / ", 14, 15);
    doc.text(t("تفاصيل الاختبار", "Quiz Detail") + " / ", 80, 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Quiz: ${detail.quiz_title || "—"}`, 14, 25);
    doc.text(`Student: ${detail.student_name || "—"}`, 14, 31);
    doc.text(`Email: ${detail.student_email || "—"}`, 14, 37);
    doc.text(`ID: ${detail.student_id || "—"}`, 14, 43);
    doc.text(`Course: ${detail.course_name || "—"}`, 14, 49);
    doc.text(`Score: ${detail.correct_answers}/${detail.total_marks} (${pct}%)`, 14, 55);
    doc.text(`Result: ${detail.result === "pass" ? "PASS" : "FAIL"}`, 14, 61);
    doc.text(`Correct: ${detail.correct_answers}  |  Wrong: ${detail.incorrect_answers}`, 14, 67);

    const questions = getQuestions();
    if (questions.length > 0) {
      const rows = questions.map((q, i) => {
        let answerText = "";
        if (q.type === "tf") {
          answerText = q.answer === true ? "True" : "False";
        } else {
          answerText = q.options?.[q.answer] || String.fromCharCode(65 + q.answer);
        }
        return [
          String(i + 1),
          q.type === "tf" ? "T/F" : "MCQ",
          q.question,
          answerText,
        ];
      });

      autoTable(doc, {
        startY: 75,
        head: [["#", "Type", "Question", "Correct Answer"]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 15 },
          2: { cellWidth: 120 },
          3: { cellWidth: 50 },
        },
      });
    }

    doc.save(`quiz-${detail.quiz_title || "detail"}.pdf`);
  };

  const deleteAll = async () => {
    if (!confirm(t("هل أنت متأكد من حذف جميع نتائج الاختبارات؟", "Are you sure you want to delete all quiz results?"))) return;
    await api("/api/courses/attempts", { method: "DELETE" });
    setAttempts([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t("📋 نتائج الاختبارات", "📋 Quiz Results")}</h2>
        <div className="flex gap-2">
          {attempts.length > 0 && (
            <>
              <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
                <span>📥</span>
                <span>{t("تنزيل PDF", "Download PDF")}</span>
              </button>
              <button data-no-confirm onClick={deleteAll} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition">
                <span>🗑️</span>
                <span>{t("حذف الكل", "Delete All")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
        <table className="w-full table-data mobile-card-table">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="p-3 text-right">{t("الاختبار والتاريخ", "Quiz & Date")}</th>
              <th className="p-3 text-right">{t("الطالب", "Student")}</th>
              <th className="p-3 text-right">{t("الكورس", "Course")}</th>
              <th className="p-3 text-right">{t("عدد الأسئلة", "Questions")}</th>
              <th className="p-3 text-right">{t("إجابات صحيحة", "Correct")}</th>
              <th className="p-3 text-right">{t("إجابات خاطئة", "Wrong")}</th>
              <th className="p-3 text-right">{t("الدرجة", "Score")}</th>
              <th className="p-3 text-right">{t("النتيجة", "Result")}</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => {
              const pct = a.earned_marks || 0;
              return (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td data-label={t("الاختبار والتاريخ", "Quiz & Date")} className="p-3">
                    <p className="font-medium text-sm">{a.quiz_title}</p>
                    <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString("ar-EG")}</p>
                  </td>
                  <td data-label={t("الطالب", "Student")} className="p-3">
                    <p className="text-sm font-medium">{a.student_name}</p>
                    <p className="text-xs text-gray-400">{a.student_email}</p>
                    <p className="text-xs text-gray-300 font-mono"><span className="text-gray-400">ID:</span> <span className="font-semibold text-gray-600">{a.student_referral_code || a.student_id}</span></p>
                  </td>
                  <td data-label={t("الكورس", "Course")} className="p-3 text-sm">{a.course_name}</td>
                  <td data-label={t("عدد الأسئلة", "Questions")} className="p-3 text-sm">{a.total_marks}</td>
                  <td data-label={t("إجابات صحيحة", "Correct")} className="p-3 text-sm text-green-600 font-medium">{a.correct_answers}</td>
                  <td data-label={t("إجابات خاطئة", "Wrong")} className="p-3 text-sm text-red-600 font-medium">{a.incorrect_answers}</td>
                  <td data-label={t("الدرجة", "Score")} className="p-3 text-sm font-medium">{a.correct_answers} / {a.total_marks} ({pct}%)</td>
                  <td data-label={t("النتيجة", "Result")} className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.result === "pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {a.result === "pass" ? t("ناجح", "Pass") : t("راسب", "Fail")}
                    </span>
                  </td>
                  <td data-label="">
                    <button onClick={() => openDetail(a)} className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                      {t("تفاصيل", "Details")}
                    </button>
                  </td>
                </tr>
              );
            })}
            {attempts.length === 0 && (
              <tr><td colSpan="9" className="text-center text-gray-400 py-8">{t("لا توجد محاولات اختبار", "No quiz attempts")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold">📝 {detail.quiz_title}</h3>
                <p className="text-xs text-gray-400">{detail.student_name} · {detail.course_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadDetailPDF} className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <span>📥</span> PDF
                </button>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-black text-xl">✕</button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{detail.correct_answers}</p>
                  <p className="text-xs text-green-700">{t("صحيحة", "Correct")}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{detail.incorrect_answers}</p>
                  <p className="text-xs text-red-700">{t("خاطئة", "Wrong")}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{detail.earned_marks}%</p>
                  <p className="text-xs text-blue-700">{t("الدرجة", "Score")}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${detail.result === "pass" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <p className={`text-2xl font-bold ${detail.result === "pass" ? "text-green-600" : "text-red-600"}`}>
                    {detail.result === "pass" ? "✅ " + t("ناجح", "Pass") : "❌ " + t("راسب", "Fail")}
                  </p>
                  <p className="text-xs text-gray-500">{t("نسبة النجاح:", "Pass rate:")} {detail.quizData?.pass_mark || 50}%</p>
                </div>
              </div>

              {detailLoading ? (
                <p className="text-center text-gray-400 py-6">{t("جاري تحميل بيانات الاختبار...", "Loading quiz data...")}</p>
              ) : (() => {
                const questions = getQuestions();
                return questions.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm mb-3">{t("الأسئلة والإجابات", "Questions & Answers")} ({questions.length}):</h4>
                    {questions.map((q, i) => (
                      <div key={i} className={`border-2 rounded-lg p-4 ${q.type === "tf" ? "border-green-200" : "border-blue-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${q.type === "tf" ? "bg-green-200 text-green-800" : "bg-blue-200 text-blue-800"}`}>
                            {q.type === "tf" ? "T/F" : "MCQ"}
                          </span>
                          <span className="font-medium text-sm">#{i + 1} {q.question}</span>
                        </div>
                        {q.type === "tf" ? (
                          <div className="flex gap-3 ml-8">
                            <span className={`px-3 py-1 rounded text-sm ${q.answer === true ? "bg-green-100 text-green-700 border border-green-300 font-bold" : "bg-gray-100 text-gray-500"}`}>✓ صح</span>
                            <span className={`px-3 py-1 rounded text-sm ${q.answer === false ? "bg-red-100 text-red-700 border border-red-300 font-bold" : "bg-gray-100 text-gray-500"}`}>✕ غلط</span>
                          </div>
                        ) : (
                          <div className="ml-8 space-y-1">
                            {(q.options || []).map((opt, oIdx) => (
                              <div key={oIdx} className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${q.answer === oIdx ? "bg-green-100 text-green-700 border border-green-300 font-bold" : "bg-gray-50 text-gray-500"}`}>
                                <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                <span>{opt}</span>
                                {q.answer === oIdx && <span className="mr-auto text-green-600">✓</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-4">{t("لا توجد أسئلة مسجلة لهذا الاختبار", "No questions recorded for this quiz")}</p>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

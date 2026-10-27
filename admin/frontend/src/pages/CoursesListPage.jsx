import React, { useState, useEffect } from "react";
import { useLang } from "../LangContext";
import PageLoading from "../components/PageLoading";
import { api, uploadApi, uploadVideoToBunny } from "../api.js";

const statusOpts = [
  { ar: "منشور", en: "Published", val: "published" },
  { ar: "مسودة", en: "Draft", val: "draft" },
];

export default function CoursesListPage() {
  const { lang } = useLang();
  const t = (ar, en) => (lang === "ar" ? ar : en);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editCourse, setEditCourse] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("info");
  const [viewCourse, setViewCourse] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [playingLesson, setPlayingLesson] = useState(null);
  const [newLessonTopic, setNewLessonTopic] = useState(null);
  const [showStudents, setShowStudents] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({ status: "", expires_at: "" });
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonAr, setNewLessonAr] = useState("");
  const [newLessonVideo, setNewLessonVideo] = useState("");
  const [newLessonContent, setNewLessonContent] = useState("");
  const [newLessonContentAr, setNewLessonContentAr] = useState("");
  const [newLessonIsFree, setNewLessonIsFree] = useState(false);
  const [videoUploadPct, setVideoUploadPct] = useState(null);
  const [uploadingLessonId, setUploadingLessonId] = useState(null);
  const [quizEditor, setQuizEditor] = useState(null); // { type: 'topic'|'lesson'|'final', topicId, lessonId?, quizId? }
  const [quizForm, setQuizForm] = useState({ title: "", questions: [], pass_mark: 50, quiz_type: "mcq" });
  const [catList, setCatList] = useState([]);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatAr, setNewCatAr] = useState("");
  const [newCatEn, setNewCatEn] = useState("");

  const loadCategories = () => api("/api/categories").then(setCatList);

  useEffect(() => { loadCategories(); }, []);

  const load = () => api("/api/courses").then(setCourses).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!editCourse) { setDetail(null); return; }
    api(`/api/courses/${editCourse.id}`).then(setDetail);
  }, [editCourse]);

  useEffect(() => {
    if (!viewCourse) { setViewData(null); setPlayingLesson(null); return; }
    api(`/api/courses/${viewCourse.id}`).then(setViewData);
  }, [viewCourse]);

  const delCourse = async (id) => {
    if (!confirm(t("متأكد من حذف هذا الكورس؟", "Delete this course?"))) return;
    await api(`/api/courses/${id}`, { method: "DELETE" });
    load();
  };

  const saveCourse = async () => {
    if (!detail) return;
    await api(`/api/courses/${detail.id}`, { method: "PUT", body: JSON.stringify(detail) });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    setEditCourse(fresh);
    load();
    alert(t("تم التحديث", "Updated"));
  };

  const addCategory = async () => {
    const ar = newCatAr.trim();
    if (!ar) { alert(t("اكتب اسم التصنيف بالعربية", "Enter category name in Arabic")); return; }
    try {
      await api("/api/categories", { method: "POST", body: JSON.stringify({ name_ar: ar, name_en: newCatEn.trim() || ar }) });
      setNewCatAr(""); setNewCatEn(""); setAddingCat(false);
      await loadCategories();
    } catch (err) {
      alert(t("خطأ في إضافة التصنيف: ", "Error adding category: ") + err.message);
    }
  };

  const deleteCategory = async (catId) => {
    if (!confirm(t("متأكد من حذف هذا التصنيف؟", "Delete this category?"))) return;
    try {
      await api(`/api/categories/${catId}`, { method: "DELETE" });
      await loadCategories();
    } catch (err) {
      alert(t("خطأ في حذف التصنيف: ", "Error deleting category: ") + err.message);
    }
  };

  const addTopic = async () => {
    const title = prompt(t("عنوان الموضوع:", "Topic title:"));
    if (!title) return;
    await api(`/api/courses/${detail.id}/topics`, { method: "POST", body: JSON.stringify({ title }) });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
  };

  const updateTopic = async (topic) => {
    await api(`/api/courses/topics/${topic.id}`, { method: "PUT", body: JSON.stringify(topic) });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
  };

  const delTopic = async (id) => {
    if (!confirm(t("حذف الموضوع؟", "Delete topic?"))) return;
    await api(`/api/courses/topics/${id}`, { method: "DELETE" });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
  };

  const addLesson = async (topicId) => {
    if (!newLessonTitle.trim()) return;
    try {
      await api(`/api/courses/topics/${topicId}/lessons`, { method: "POST", body: JSON.stringify({ title: newLessonTitle, title_ar: newLessonAr, video_url: newLessonVideo, content: newLessonContent, content_ar: newLessonContentAr, is_free: newLessonIsFree }) });
      const fresh = await api(`/api/courses/${detail.id}`);
      setDetail(fresh);
      load();
      setNewLessonTopic(null);
      setNewLessonTitle("");
      setNewLessonAr("");
      setNewLessonVideo("");
      setNewLessonContent("");
      setNewLessonContentAr("");
      setNewLessonIsFree(false);
    } catch (err) {
      alert(t("خطأ في إضافة الدرس: ", "Error adding lesson: ") + err.message);
    }
  };

  const updateLesson = async (topicId, lesson) => {
    try {
      await api(`/api/courses/topics/${topicId}/lessons/${lesson.id}`, { method: "PUT", body: JSON.stringify(lesson) });
      const fresh = await api(`/api/courses/${detail.id}`);
      setDetail(fresh);
      load();
      alert(t("تم حفظ الدرس ✅", "Lesson saved ✅"));
    } catch (err) {
      alert(t("خطأ في حفظ الدرس: ", "Error saving lesson: ") + err.message);
    }
  };

  const delLesson = async (topicId, id) => {
    if (!confirm(t("حذف الدرس؟", "Delete lesson?"))) return;
    try {
      await api(`/api/courses/topics/${topicId}/lessons/${id}`, { method: "DELETE" });
      const fresh = await api(`/api/courses/${detail.id}`);
      setDetail(fresh);
      load();
    } catch (err) {
      alert(t("خطأ في حذف الدرس: ", "Error deleting lesson: ") + err.message);
    }
  };

  const addQuiz = async (topicId) => {
    const title = prompt(t("عنوان اختبار الموضوع:", "Topic Quiz title:"));
    if (!title) return;
    const res = await api(`/api/courses/topics/${topicId}/quizzes`, { method: "POST", body: JSON.stringify({ title, questions: [], total_marks: 0, type: "topic", pass_mark: 50, quiz_type: "mcq" }) });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
    openQuizEditor("topic", topicId, null, { id: res.id, title, questions: "[]", pass_mark: 50, quiz_type: "mcq" });
  };

  const addLessonQuiz = async (topicId, lessonId) => {
    await api(`/api/courses/topics/${topicId}/quizzes`, {
      method: "POST",
      body: JSON.stringify({ title: t("اختبار الدرس", "Lesson Quiz"), questions: [], total_marks: 0, type: "lesson", lesson_id: lessonId }),
    });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    openQuizEditor("lesson", topicId, lessonId);
  };

  const addFinalQuiz = async () => {
    try {
      await api(`/api/courses/${detail.id}/final-quiz`, {
        method: "POST",
        body: JSON.stringify({ title: t("الاختبار النهائي", "Final Quiz"), questions: [], total_marks: 0, pass_mark: 50, quiz_type: "mixed" }),
      });
      const fresh = await api(`/api/courses/${detail.id}`);
      setDetail(fresh);
      openQuizEditor("final", null, null, fresh.final_quiz);
    } catch (err) {
      alert(t("خطأ في إضافة الاختبار النهائي: ", "Error adding final quiz: ") + err.message);
    }
  };

  const openQuizEditor = (type, topicId, lessonId, quiz) => {
    if (quiz) {
      setQuizForm({ title: quiz.title || "", questions: JSON.parse(quiz.questions || "[]"), pass_mark: quiz.pass_mark || 50, quiz_type: quiz.quiz_type || "mcq" });
      setQuizEditor({ type, topicId, lessonId, quizId: quiz.id });
    } else {
      setQuizForm({ title: "", questions: [], pass_mark: 50, quiz_type: "mcq" });
      setQuizEditor({ type, topicId, lessonId, quizId: null });
    }
  };

  const saveQuizEditor = async () => {
    if (!quizEditor) return;
    if (quizEditor.type === "final") {
      await api(`/api/courses/${detail.id}/final-quiz`, {
        method: "POST",
        body: JSON.stringify({ title: quizForm.title, questions: quizForm.questions, total_marks: quizForm.questions.length, pass_mark: quizForm.pass_mark, quiz_type: quizForm.quiz_type }),
      });
    } else {
      const topicId = quizEditor.topicId;
      const payload = { title: quizForm.title, questions: quizForm.questions, total_marks: quizForm.questions.length, type: quizEditor.type, pass_mark: quizForm.pass_mark, quiz_type: quizForm.quiz_type };
      if (quizEditor.type === "lesson") payload.lesson_id = quizEditor.lessonId;
      if (quizEditor.quizId) {
        await api(`/api/courses/topics/${topicId}/quizzes/${quizEditor.quizId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api(`/api/courses/topics/${topicId}/quizzes`, { method: "POST", body: JSON.stringify(payload) });
      }
    }
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
    setQuizEditor(null);
  };

  const delLessonQuiz = async (topicId, lessonId) => {
    const quizzes = detail.topics?.find(t => t.id === topicId)?.lessons?.find(l => l.id === lessonId)?.quiz;
    if (!quizzes) return;
    if (!confirm(t("حذف اختبار الدرس؟", "Delete lesson quiz?"))) return;
    await api(`/api/courses/topics/${topicId}/quizzes/${quizzes.id}`, { method: "DELETE" });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
  };

  const delQuiz = async (topicId, id) => {
    if (!confirm(t("حذف الاختبار؟", "Delete quiz?"))) return;
    await api(`/api/courses/topics/${topicId}/quizzes/${id}`, { method: "DELETE" });
    const fresh = await api(`/api/courses/${detail.id}`);
    setDetail(fresh);
    load();
  };

  const loadStudents = async (courseId) => {
    if (showStudents === courseId) { setShowStudents(null); setStudents([]); return; }
    setShowStudents(courseId);
    setLoadingStudents(true);
    setEditStudent(null);
    try { const data = await api(`/api/courses/enrollments/list/${courseId}`); setStudents(data); }
    catch (e) { alert(e.message); }
    setLoadingStudents(false);
  };

  const deleteStudent = async (id, name) => {
    if (!confirm(t(`حذف الطالب ${name} من هذا الكورس؟`, `Delete ${name} from this course?`))) return;
    try { await api(`/api/courses/enrollments/${id}`, { method: "DELETE" }); if (showStudents) loadStudents(showStudents); }
    catch (e) { alert(e.message); }
  };

  const saveStudent = async (id) => {
    try {
      await api(`/api/courses/enrollments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: studentForm.status || undefined, expires_at: studentForm.expires_at || undefined })
      });
      setEditStudent(null);
      if (showStudents) loadStudents(showStudents);
    } catch (e) { alert(e.message); }
  };

  const startEditStudent = (enr) => {
    setEditStudent(enr.id);
    setStudentForm({ status: enr.status || "", expires_at: enr.expires_at || "" });
  };

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.title || "").toLowerCase().includes(q) || (c.title_ar || "").includes(q);
    const matchCat = !catFilter || c.category === catFilter || c.category_ar === catFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(courses.flatMap((c) => [c.category, c.category_ar].filter(Boolean)))];

  /* ───── Edit Modal ───── */
  if (editCourse && detail) {
    const cv = detail;
    const setCv = (field, value) => setDetail((prev) => ({ ...prev, [field]: value }));
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <h3 className="text-lg font-bold">{t("تعديل الكورس", "Edit Course")}</h3>
            <button onClick={() => { setEditCourse(null); setDetail(null); }} className="text-gray-400 hover:text-black text-xl">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4 border-b">
            {[
              { id: "info", ar: "معلومات الكورس", en: "Course Info" },
              { id: "curriculum", ar: "المنهج", en: "Curriculum" },
            ].map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === tb.id ? "bg-everest-600 text-white" : "bg-gray-100 text-gray-500"}`}
              >{lang === "ar" ? tb.ar : tb.en}</button>
            ))}
          </div>

          {tab === "info" && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">English Title</label>
                  <input value={cv.title || ""} onChange={(e) => setCv("title", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">العنوان بالعربية</label>
                  <input value={cv.title_ar || ""} onChange={(e) => setCv("title_ar", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">English Description</label>
                  <textarea value={cv.description || ""} onChange={(e) => setCv("description", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">الوصف بالعربية</label>
                  <textarea value={cv.description_ar || ""} onChange={(e) => setCv("description_ar", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("التصنيف", "Category")}</label>
                  <select value={cv.category || ""} onChange={(e) => {
                    const sel = e.target.value;
                    const c = catList.find((x) => (x.name_en || x.name_ar) === sel);
                    setCv("category", sel);
                    if (c) setCv("category_ar", c.name_ar);
                  }} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">{t("اختر تصنيفاً...", "Select category...")}</option>
                    {catList.map((c) => (
                      <option key={c.id} value={c.name_en || c.name_ar}>{c.name_en || c.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">التصنيف بالعربية</label>
                  <div className="flex gap-2">
                    <select value={cv.category_ar || ""} onChange={(e) => {
                      const sel = e.target.value;
                      const c = catList.find((x) => x.name_ar === sel);
                      setCv("category_ar", sel);
                      if (c) setCv("category", c.name_en || c.name_ar);
                    }} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">{t("اختر تصنيفاً...", "Select category...")}</option>
                      {catList.map((c) => (
                        <option key={c.id} value={c.name_ar}>{c.name_ar}</option>
                      ))}
                    </select>
                    <button onClick={() => setAddingCat(true)} className="px-3 py-2 bg-everest-600 text-white rounded-lg text-sm whitespace-nowrap">＋ {t("إضافة", "Add")}</button>
                  </div>
                  {addingCat && (
                    <div className="mt-2 space-y-2 border rounded-lg p-3 bg-gray-50">
                      <input value={newCatAr} onChange={(e) => setNewCatAr(e.target.value)} placeholder={t("اسم التصنيف بالعربية", "Category name (Arabic)")} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <input value={newCatEn} onChange={(e) => setNewCatEn(e.target.value)} placeholder={t("الاسم بالإنجليزية (اختياري)", "Name in English (optional)")} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <div className="flex gap-2">
                        <button onClick={addCategory} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">{t("حفظ التصنيف", "Save Category")}</button>
                        <button onClick={() => { setAddingCat(false); setNewCatAr(""); setNewCatEn(""); }} className="px-3 py-1.5 border rounded-lg text-xs">{t("إلغاء", "Cancel")}</button>
                      </div>
                    </div>
                  )}
                  {cv.category_ar && (() => { const cc = catList.find((x) => x.name_ar === cv.category_ar); return cc ? (
                    <button data-no-confirm onClick={() => deleteCategory(cc.id)} className="mt-2 text-xs text-red-500">🗑 {t("حذف هذا التصنيف", "Delete this category")}</button>
                  ) : null; })()}
                </div>
                <div>
                  <label className="text-sm font-medium">{t("الصعوبة", "Difficulty")}</label>
                  <select value={cv.difficulty || "beginner"} onChange={(e) => setCv("difficulty", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="beginner">{t("مبتدئ", "Beginner")}</option>
                    <option value="intermediate">{t("متوسط", "Intermediate")}</option>
                    <option value="advanced">{t("متقدم", "Advanced")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("الحالة", "Status")}</label>
                  <select value={cv.status || "draft"} onChange={(e) => setCv("status", e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    {statusOpts.map((o) => <option key={o.val} value={o.val}>{lang === "ar" ? o.ar : o.en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">$ {t("السعر", "Price")}</label>
                  <input type="number" value={cv.price || 0} onChange={(e) => setCv("price", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cv.is_free} onChange={(e) => setCv("is_free", e.target.checked)} />
                    {t("مجاني", "Free")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cv.is_public} onChange={(e) => setCv("is_public", e.target.checked)} />
                    {t("عام", "Public")}
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium">{t("صورة الغلاف", "Cover Image")}</label>
                  <div className="flex items-center gap-3 mt-1">
                    {cv.featured_image ? (
                      <div className="relative">
                        <img src={cv.featured_image} alt="" className="w-20 h-14 object-cover rounded border" />
                        <button onClick={() => setCv("featured_image", "")} className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">✕</button>
                      </div>
                    ) : null}
                    <label className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center text-gray-400 text-xs cursor-pointer hover:border-everest-400 block flex-1">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const fd = new FormData(); fd.append("file", file);
                        const d = await uploadApi(fd);
                        if (d.url) { setCv("featured_image", d.url); }
                      }} />
                      {t("اضغط لرفع الصورة", "Click to upload image")}
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={saveCourse} className="px-6 py-2 bg-everest-600 text-white rounded-lg text-sm font-medium">{t("حفظ التغييرات", "Save Changes")}</button>
                <button onClick={() => { setEditCourse(null); setDetail(null); }} className="px-6 py-2 border rounded-lg text-sm">{t("إلغاء", "Cancel")}</button>
              </div>
            </div>
          )}

          {tab === "curriculum" && (
            <div className="p-6 space-y-4">
              {(cv.topics || []).map((topic) => (
                <div key={topic.id} className="border rounded-lg p-4 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <input value={topic.title || ""} onChange={(e) => {
                      const updated = { ...topic, title: e.target.value };
                      setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id ? updated : t) }));
                    }} className="flex-1 px-2 py-1 border rounded text-sm font-medium" placeholder="English title" />
                    <input value={topic.title_ar || ""} onChange={(e) => {
                      const updated = { ...topic, title_ar: e.target.value };
                      setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id ? updated : t) }));
                    }} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="العنوان بالعربية" />
                    <button onClick={() => updateTopic(topic)} className="text-xs text-everest-600 border px-2 py-1 rounded">{t("حفظ", "Save")}</button>
                    <button onClick={() => delTopic(topic.id)} className="text-xs text-red-500 border px-2 py-1 rounded">✕</button>
                  </div>

                  <div className="mr-4 space-y-1">
                    {(topic.lessons || []).map((lesson) => (
                      <div key={lesson.id} className="bg-white rounded border p-2 mb-1 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <input value={lesson.title || ""} onChange={(e) => {
                            const upd = { ...lesson, title: e.target.value };
                            setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                              ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                          }} className="flex-1 px-1 border-b text-xs" placeholder="EN title" />
                          <input value={lesson.title_ar || ""} onChange={(e) => {
                            const upd = { ...lesson, title_ar: e.target.value };
                            setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                              ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                          }} className="flex-1 px-1 border-b text-xs" placeholder="العنوان بالعربية" />
                        </div>
                        <div className="flex items-center gap-2">
                          <textarea value={lesson.content || ""} onChange={(e) => {
                            const upd = { ...lesson, content: e.target.value };
                            setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                              ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                          }} className="flex-1 px-2 py-1 border rounded text-xs" rows={2} placeholder={t("محتوى (إنجليزي)", "Content (EN)")} />
                          <textarea value={lesson.content_ar || ""} onChange={(e) => {
                            const upd = { ...lesson, content_ar: e.target.value };
                            setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                              ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                          }} className="flex-1 px-2 py-1 border rounded text-xs" rows={2} placeholder={t("المحتوى (عربي)", "Content (AR)")} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input value={lesson.video_url || ""} onChange={(e) => {
                            const upd = { ...lesson, video_url: e.target.value };
                            setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                              ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                          }} className="flex-1 px-2 py-1 border rounded text-xs" placeholder={t("رابط فيديو (YouTube)...", "Video URL (YouTube)...")} />
                          <label className={`px-3 py-1.5 text-xs text-white rounded-lg cursor-pointer hover:opacity-90 whitespace-nowrap font-medium ${uploadingLessonId ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"}`}>
                            {uploadingLessonId === lesson.id ? `${videoUploadPct}%` : t("رفع فيديو", "Upload")}
                            <input type="file" accept="video/*" className="hidden" disabled={!!uploadingLessonId} onChange={async (e) => {
                              const file = e.target.files?.[0]; if (!file) return;
                              try {
                                setUploadingLessonId(lesson.id);
                                setVideoUploadPct(0);
                                const url = await uploadVideoToBunny(file, (pct) => setVideoUploadPct(pct));
                                const upd = { ...lesson, video_url: url };
                                setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                                  ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                                await updateLesson(topic.id, { ...lesson, video_url: url });
                                } catch (err) { alert(t("فشل رفع الفيديو: ", "Video upload failed: ") + err.message + t("\nاضغط رفع فيديو مرة أخرى بنفس الملف للمتابعة من حيث توقف.", "\nClick Upload again with the same file to resume.")); }
                              setUploadingLessonId(null);
                              setVideoUploadPct(null);
                            }} />
                          </label>
                          <button onClick={() => updateLesson(topic.id, lesson)} className="px-3 py-1.5 text-xs bg-everest-600 text-white rounded-lg">💾</button>
                          <button onClick={() => delLesson(topic.id, lesson.id)} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg">✕</button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 border border-green-200 rounded text-xs cursor-pointer select-none">
                            <input type="checkbox" checked={!!lesson.is_free} onChange={(e) => {
                              const upd = { ...lesson, is_free: e.target.checked ? 1 : 0 };
                              setDetail((prev) => ({ ...prev, topics: prev.topics.map((t) => t.id === topic.id
                                ? { ...t, lessons: t.lessons.map((l) => l.id === lesson.id ? upd : l) } : t) }));
                            }} className="accent-green-500" />
                            {t("مجاني (Preview)", "Free (Preview)")}
                          </label>
                        </div>
                        {lesson.video_url && <p className="text-xs text-green-600 mt-1 truncate">{lesson.video_url}</p>}
                        {/* Lesson Quiz */}
                        {lesson.quiz ? (
                          <div className="flex items-center gap-2 mt-1 bg-blue-50 rounded px-2 py-1 border border-blue-200">
                            <span className="text-xs">📝</span>
                            <span className="text-xs font-medium">{lesson.quiz.title || t("اختبار الدرس", "Lesson Quiz")} ({JSON.parse(lesson.quiz.questions || "[]").length} {t("أسئلة", "Q")})</span>
                            <button onClick={() => openQuizEditor("lesson", topic.id, lesson.id, lesson.quiz)} className="text-xs text-everest-600 hover:underline ml-auto">{t("تعديل", "Edit")}</button>
                            <button onClick={() => delLessonQuiz(topic.id, lesson.id)} className="text-xs text-red-500">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => addLessonQuiz(topic.id, lesson.id)} className="mt-1 text-xs text-blue-500 hover:underline">
                            + {t("إضافة اختبار للدرس", "Add lesson quiz")}
                          </button>
                        )}
                      </div>
                    ))}
                    {(topic.quizzes || []).map((quiz) => (
                      <div key={quiz.id} className="flex items-center gap-2 bg-yellow-50 rounded px-3 py-1.5 border text-sm">
                        <span className="text-xs">📝</span>
                        <span className="flex-1">{quiz.title} <span className="text-xs text-gray-400">({JSON.parse(quiz.questions || "[]").length} {t("سؤال", "Q")})</span></span>
                        <button onClick={() => openQuizEditor("topic", topic.id, null, quiz)} className="text-xs text-everest-600 hover:underline">{t("تعديل", "Edit")}</button>
                        <button onClick={() => delQuiz(topic.id, quiz.id)} className="text-xs text-red-500">✕</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      {newLessonTopic === topic.id ? (
                        <div className="flex flex-col gap-2 w-full bg-gray-100 rounded-lg p-3 border">
                          <div className="flex items-center gap-2">
                            <input value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)}
                              placeholder={t("عنوان الدرس (إنجليزي)", "Lesson title (English)")}
                              className="flex-1 px-2 py-1 border rounded text-xs" autoFocus />
                            <input value={newLessonAr} onChange={(e) => setNewLessonAr(e.target.value)}
                              placeholder={t("عنوان الدرس (عربي)", "Lesson title (Arabic)")}
                              className="flex-1 px-2 py-1 border rounded text-xs" />
                          </div>
                          <div className="flex items-center gap-2">
                            <textarea value={newLessonContent} onChange={(e) => setNewLessonContent(e.target.value)}
                              placeholder={t("محتوى الدرس (إنجليزي)", "Lesson content (English)")}
                              className="flex-1 px-2 py-1 border rounded text-xs" rows={2} />
                            <textarea value={newLessonContentAr} onChange={(e) => setNewLessonContentAr(e.target.value)}
                              placeholder={t("محتوى الدرس (عربي)", "Lesson content (Arabic)")}
                              className="flex-1 px-2 py-1 border rounded text-xs" rows={2} />
                          </div>
                          <div className="flex items-center gap-2">
                            <input value={newLessonVideo} onChange={(e) => setNewLessonVideo(e.target.value)}
                              placeholder={t("رابط فيديو (YouTube)...", "Video URL (YouTube)...")}
                              className="flex-1 px-2 py-1 border rounded text-xs" />
                            <label className={`px-3 py-1.5 text-xs text-white rounded-lg cursor-pointer hover:opacity-90 whitespace-nowrap font-medium ${videoUploadPct !== null ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"}`}>
                              {videoUploadPct !== null ? `${videoUploadPct}%` : t("رفع فيديو", "Upload")}
                              <input type="file" accept="video/*" className="hidden" disabled={videoUploadPct !== null} onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                try {
                                  setVideoUploadPct(0);
                                  const url = await uploadVideoToBunny(file, (pct) => setVideoUploadPct(pct));
                                  setNewLessonVideo(url);
                              } catch (err) { alert(t("فشل رفع الفيديو: ", "Video upload failed: ") + err.message + t("\nاضغط رفع فيديو مرة أخرى بنفس الملف للمتابعة من حيث توقف.", "\nClick Upload again with the same file to resume.")); }
                                setVideoUploadPct(null);
                              }} />
                            </label>
                            <label className="flex items-center gap-1.5 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={newLessonIsFree} onChange={(e) => setNewLessonIsFree(e.target.checked)} className="accent-green-500" />
                              {t("مجاني (Preview)", "Free (Preview)")}
                            </label>
                          <button onClick={() => addLesson(topic.id)} className="px-3 py-1.5 text-xs bg-everest-600 text-white rounded-lg">{t("حفظ", "Save")}</button>
                          <button onClick={() => { setNewLessonTopic(null); setNewLessonTitle(""); setNewLessonAr(""); setNewLessonVideo(""); setNewLessonIsFree(false); }} className="px-3 py-1.5 text-xs border rounded-lg">{t("إلغاء", "Cancel")}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setNewLessonTopic(topic.id); setNewLessonTitle(""); setNewLessonAr(""); }} className="text-xs border border-dashed border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
                            + {t("درس", "Lesson")}
                          </button>
                          <button onClick={() => addQuiz(topic.id)} className="text-xs border border-dashed border-gray-300 px-3 py-1 rounded hover:bg-gray-100">
                            + {t("اختبار", "Quiz")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addTopic} className="w-full py-2 border-2 border-dashed border-everest-300 text-everest-600 rounded-lg text-sm font-medium hover:bg-everest-50">
                + {t("إضافة موضوع", "Add Topic")}
              </button>
              {/* Final Quiz Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-bold mb-2">🏆 {t("الاختبار النهائي للكورس", "Course Final Quiz")}</h4>
                {detail?.final_quiz ? (
                  <div className="flex items-center gap-2 bg-yellow-50 rounded-lg px-4 py-2 border border-yellow-200">
                    <span>🏆</span>
                    <span className="text-sm font-medium">{detail.final_quiz.title} ({JSON.parse(detail.final_quiz.questions || "[]").length} {t("أسئلة", "questions")})</span>
                    <button onClick={() => openQuizEditor("final", null, null, detail.final_quiz)} className="text-xs text-everest-600 hover:underline ml-auto">{t("تعديل", "Edit")}</button>
                  </div>
                ) : (
                  <button onClick={addFinalQuiz} className="w-full py-3 border-2 border-dashed border-yellow-400 text-yellow-600 rounded-lg text-sm font-medium hover:bg-yellow-50">
                    + {t("إضافة اختبار نهائي", "Add Final Quiz")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quiz Editor Modal */}
          {quizEditor && (
            <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setQuizEditor(null)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                  <h3 className="text-lg font-bold">📝 {quizEditor.type === "final" ? t("الاختبار النهائي", "Final Quiz") : quizEditor.type === "lesson" ? t("اختبار الدرس", "Lesson Quiz") : t("اختبار الموضوع", "Topic Quiz")}</h3>
                  <button onClick={() => setQuizEditor(null)} className="text-gray-400 hover:text-black text-xl">✕</button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{t("عنوان الاختبار", "Quiz Title")}</label>
                      <input value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t("نسبة النجاح %", "Pass Mark %")}</label>
                      <input type="number" min={0} max={100} value={quizForm.pass_mark} onChange={e => setQuizForm({...quizForm, pass_mark: parseInt(e.target.value) || 50})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                  {/* Quiz Type Selector */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("نوع الاختبار", "Quiz Type")}</label>
                    <div className="flex gap-3">
                      {[
                        { val: "mcq", label: "MCQ", desc: t("اختيارات متعددة", "Multiple Choice"), icon: "🔘" },
                        { val: "tf", label: "T/F", desc: t("صح وغلط", "True or False"), icon: "✅" },
                        { val: "mixed", label: "MCQ + T/F", desc: t("النوعين معاً", "Both types"), icon: "🔀" },
                      ].map(opt => (
                        <button key={opt.val} onClick={() => {
                          if (quizForm.questions.length > 0 && !confirm(t("تغيير النوع سيحذف الأسئلة. متأكد؟", "Changing type deletes questions. Sure?"))) return;
                          setQuizForm({...quizForm, quiz_type: opt.val, questions: []});
                        }}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${quizForm.quiz_type === opt.val ? "border-everest-600 bg-everest-50" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="text-2xl mb-1">{opt.icon}</div>
                          <div className="text-sm font-bold">{opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>🔘 MCQ: {quizForm.questions.filter(q => q.type === "mcq").length}</span>
                      <span>✅ T/F: {quizForm.questions.filter(q => q.type === "tf").length}</span>
                      <span className="font-bold text-gray-700">{t("المجموع:", "Total:")} {quizForm.questions.length}</span>
                    </div>
                  </div>
                  {/* Questions */}
                  <div className="space-y-4">
                    {quizForm.questions.map((q, qIdx) => (
                      <div key={qIdx} className={`border-2 rounded-xl p-4 space-y-3 ${q.type === "tf" ? "border-green-200 bg-green-50/30" : "border-blue-200 bg-blue-50/30"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${q.type === "tf" ? "bg-green-200 text-green-800" : "bg-blue-200 text-blue-800"}`}>
                            {q.type === "tf" ? "T/F" : "MCQ"}
                          </span>
                          <span className="text-xs font-bold text-gray-400">#{qIdx + 1}</span>
                          <input value={q.question} onChange={e => { const newQs = quizForm.questions.map((qq, i) => i === qIdx ? {...qq, question: e.target.value} : qq); setQuizForm({...quizForm, questions: newQs}); }}
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm" placeholder={t("نص السؤال...", "Question text...")} />
                          <button onClick={() => setQuizForm({...quizForm, questions: quizForm.questions.filter((_, i) => i !== qIdx)})} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                        </div>
                        {q.type === "tf" ? (
                          <div className="flex gap-3 ml-10">
                            <button onClick={() => { const newQs = quizForm.questions.map((qq, i) => i === qIdx ? {...qq, answer: true} : qq); setQuizForm({...quizForm, questions: newQs}); }}
                              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition ${q.answer === true ? "border-green-500 bg-green-500 text-white" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                              ✓ {t("صح", "True")}
                            </button>
                            <button onClick={() => { const newQs = quizForm.questions.map((qq, i) => i === qIdx ? {...qq, answer: false} : qq); setQuizForm({...quizForm, questions: newQs}); }}
                              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition ${q.answer === false ? "border-red-500 bg-red-500 text-white" : "border-gray-200 text-gray-600 hover:border-red-300"}`}>
                              ✕ {t("غلط", "False")}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 ml-10">
                            {(q.options || []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <button onClick={() => { const newQs = quizForm.questions.map((qq, i) => i === qIdx ? {...qq, answer: oIdx} : qq); setQuizForm({...quizForm, questions: newQs}); }}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition ${q.answer === oIdx ? "border-green-500 bg-green-500 text-white" : "border-gray-300 text-gray-400"}`}>
                                  {String.fromCharCode(65 + oIdx)}
                                </button>
                                <input value={opt} onChange={e => { const newQs = quizForm.questions.map((qq, i) => { if (i !== qIdx) return qq; const newOpts = [...(qq.options || [])]; newOpts[oIdx] = e.target.value; return {...qq, options: newOpts}; }); setQuizForm({...quizForm, questions: newQs}); }}
                                  className="flex-1 px-3 py-1.5 border-b text-sm" placeholder={`${t("الخيار", "Option")} ${String.fromCharCode(65 + oIdx)}`} />
                              </div>
                            ))}
                            {(q.options || []).length < 6 && (
                              <button onClick={() => { const newQs = quizForm.questions.map((qq, i) => i === qIdx ? {...qq, options: [...(qq.options || []), ""]} : qq); setQuizForm({...quizForm, questions: newQs}); }}
                                className="text-xs text-everest-600 hover:underline">+ {t("إضافة خيار", "Add option")}</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Add Question Buttons */}
                  <div className="flex gap-3">
                    {(quizForm.quiz_type === "mcq" || quizForm.quiz_type === "mixed") && (
                      <button onClick={() => setQuizForm({...quizForm, questions: [...quizForm.questions, { type: "mcq", question: "", options: ["", "", "", ""], answer: 0 }]})}
                        className="flex-1 py-3 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition">
                        + {t("إضافة سؤال MCQ", "Add MCQ")}
                      </button>
                    )}
                    {(quizForm.quiz_type === "tf" || quizForm.quiz_type === "mixed") && (
                      <button onClick={() => setQuizForm({...quizForm, questions: [...quizForm.questions, { type: "tf", question: "", answer: true }]})}
                        className="flex-1 py-3 border-2 border-dashed border-green-300 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50 transition">
                        + {t("إضافة سؤال صح/غلط", "Add T/F")}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveQuizEditor} className="px-6 py-2 bg-everest-600 text-white rounded-lg text-sm font-medium">{t("حفظ الاختبار", "Save Quiz")}</button>
                    <button onClick={() => setQuizEditor(null)} className="px-6 py-2 border rounded-lg text-sm">{t("إلغاء", "Cancel")}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ───── View / Play Modal ───── */
  const isYoutube = (url) => url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const getYoutubeEmbed = (url) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };
  const isBunny = (url) => url && url.includes(".b-cdn.net");
  const getBunnyEmbed = (url) => { const m = url.match(/\.b-cdn\.net\/([a-f0-9-]+)\//); return m ? `https://video.bunnycdn.com/embed/706401/${m[1]}` : url; };

  if (viewCourse && viewData) {
    const allLessons = (viewData.topics || []).flatMap((t) => (t.lessons || []).map((l) => ({ ...l, topicTitle: t.title || t.title_ar })));
    const current = playingLesson || allLessons[0] || null;
    const total = allLessons.length;
    const idx = allLessons.findIndex((l) => l.id === current?.id);

    const videoSrc = current?.video_url
      ? isYoutube(current.video_url) ? getYoutubeEmbed(current.video_url) : isBunny(current.video_url) ? getBunnyEmbed(current.video_url) : current.video_url
      : null;

    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewCourse(null)}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <div>
              <h3 className="font-bold text-lg">{viewData.title_ar || viewData.title}</h3>
              <p className="text-xs text-gray-400">{viewData.title && viewData.title_ar ? viewData.title : ""}</p>
            </div>
            <button onClick={() => setViewCourse(null)} className="text-gray-400 hover:text-black text-xl">✕</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar - Lessons List */}
            <div className="w-64 border-l overflow-y-auto bg-gray-50 p-3 space-y-1 hidden md:block">
              {(viewData.topics || []).map((topic) => (
                <div key={topic.id}>
                  <p className="text-xs font-bold text-gray-500 mt-3 mb-1 px-2">{topic.title_ar || topic.title}</p>
                  {(topic.lessons || []).map((lesson) => (
                    <button key={lesson.id} onClick={() => setPlayingLesson(lesson)}
                      className={`w-full text-right px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${current?.id === lesson.id ? "bg-everest-600 text-white" : "hover:bg-gray-200 text-gray-700"}`}
                    >
                      <span className="text-xs">{current?.id === lesson.id ? "▶" : "🎬"}</span>
                      <span className="truncate">{lesson.title_ar || lesson.title}</span>
                    </button>
                  ))}
                </div>
              ))}
              {(!viewData.topics || viewData.topics.length === 0) && (
                <p className="text-xs text-gray-400 p-3">{t("لا توجد دروس", "No lessons yet")}</p>
              )}
            </div>

            {/* Video Player */}
            <div className="flex-1 flex flex-col">
              <div className="bg-black flex-1 flex items-center justify-center min-h-[300px]">
                {videoSrc ? (
                  isYoutube(current.video_url) || isBunny(current.video_url) ? (
                    <iframe src={videoSrc} className="w-full h-full min-h-[300px]" allowFullScreen allow="autoplay; encrypted-media" title="video" />
                  ) : (
                    <video src={videoSrc} controls className="w-full h-full max-h-[60vh]" autoPlay />
                  )
                ) : (
                  <div className="text-gray-500 text-center">
                    <p className="text-4xl mb-2">🎬</p>
                    <p className="text-sm">{t("هذا الدرس لا يحتوي على فيديو", "This lesson has no video")}</p>
                  </div>
                )}
              </div>
              {current && (
                <div className="px-6 py-3 border-t bg-white flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{current.title_ar || current.title}</p>
                    <p className="text-xs text-gray-400">{current.topicTitle}</p>
                  </div>
                  <div className="flex gap-2">
                    {idx > 0 && <button onClick={() => setPlayingLesson(allLessons[idx - 1])} className="px-4 py-1.5 border rounded text-sm">{t("السابق", "Prev")}</button>}
                    {idx < total - 1 && <button onClick={() => setPlayingLesson(allLessons[idx + 1])} className="px-4 py-1.5 bg-everest-600 text-white rounded text-sm">{t("التالي", "Next")}</button>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ───── Courses Table ───── */
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t("قائمة الكورسات", "Courses List")}</h2>

      <div className="bg-white rounded-xl shadow-sm border table-responsive-wrapper">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-4 py-2 border rounded-lg text-sm bg-white">
            <option value="">{t("كل التصنيفات", "All Categories")}</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("بحث...", "Search...")} className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[150px]" />
          <span className="text-xs text-gray-400">{t(`${filtered.length} كورس`, `${filtered.length} courses`)}</span>
        </div>

        <table className="w-full mobile-card-table">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
              <th className="p-3 text-right">{t("صورة", "Image")}</th>
              <th className="p-3 text-right">{t("العنوان", "Title")}</th>
              <th className="p-3 text-right">{t("التصنيف", "Category")}</th>
              <th className="p-3 text-right">{t("السعر", "Price")}</th>
              <th className="p-3 text-right">{t("المؤلف", "Author")}</th>
              <th className="p-3 text-right">{t("الحالة", "Status")}</th>
              <th className="p-3 text-right">{t("إجراءات", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <React.Fragment key={c.id}>
              <tr className="border-t hover:bg-gray-50">
                <td data-label={t("صورة", "Image")} className="p-3">
                  {c.featured_image
                    ? <img src={c.featured_image} alt="" className="w-14 h-10 object-cover rounded" />
                    : <div className="w-14 h-10 bg-gray-200 rounded" />}
                </td>
                <td data-label={t("العنوان", "Title")} className="p-3">
                  <p className="font-medium text-sm">{c.title || c.title_ar}</p>
                  <p className="text-xs text-gray-400">
                    {c.topic_count || 0} {t("مواضيع", "topics")} · {c.lesson_count || 0} {t("دروس", "lessons")} · {c.quiz_count || 0} {t("اختبارات", "quizzes")}
                  </p>
                  {c.title && c.title_ar && <p className="text-xs text-gray-400 mt-0.5">{c.title_ar}</p>}
                </td>
                <td data-label={t("التصنيف", "Category")} className="p-3 text-xs text-gray-500">{c.category_ar || c.category || "—"}</td>
                <td data-label={t("السعر", "Price")} className="p-3 text-sm font-medium">{c.is_free ? (t("مجاني", "Free")) : `${c.price} $`}</td>
                <td data-label={t("المؤلف", "Author")} className="p-3 text-xs">{c.author_name || "—"}</td>
                <td data-label={t("الحالة", "Status")} className="p-3">
                  <select value={c.status || "draft"} onChange={async (e) => {
                    await api(`/api/courses/${c.id}`, { method: "PUT", body: JSON.stringify({ status: e.target.value }) });
                    load();
                  }} className="px-2 py-1 border rounded text-xs">
                    {statusOpts.map((o) => <option key={o.val} value={o.val}>{lang === "ar" ? o.ar : o.en}</option>)}
                  </select>
                </td>
                <td data-label={t("إجراءات", "Actions")} className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => { setViewCourse(c); }} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                      {t("عرض", "View")}
                    </button>
                    <button onClick={() => setEditCourse(c)} className="px-3 py-1.5 text-xs bg-everest-600 text-white rounded-lg hover:bg-everest-700">
                      {t("تعديل", "Edit")}
                    </button>
                    <button onClick={() => loadStudents(c.id)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {showStudents === c.id ? t("إخفاء", "Hide") : t("الطلاب", "Students")}
                    </button>
                    <button data-no-confirm onClick={() => delCourse(c.id)} className="px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded-lg hover:bg-red-50">
                      {t("حذف", "Delete")}
                    </button>
                  </div>
                </td>
              </tr>
              {showStudents === c.id && (
                <tr><td colSpan={7} className="p-0">
                      <div className="bg-gray-50 p-4 border-t">
                    {loadingStudents ? (
                      <PageLoading>
                        <p className="text-sm text-gray-400">{t("جاري التحميل...", "Loading...")}</p>
                      </PageLoading>
                    ) : students.length === 0 ? (
                      <p className="text-sm text-gray-400">{t("لا يوجد طلاب مسجلين في هذا الكورس", "No students enrolled in this course")}</p>
                    ) : (
                      <div>
                        <p className="text-sm font-bold mb-3">🎓 {t("الطلاب المسجلين", "Enrolled Students")} ({students.length})</p>
                        <div className="space-y-3">
                          {students.map((enr) => (
                            <div key={enr.id} className="bg-white rounded-lg border p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-everest-100 text-everest-700 flex items-center justify-center font-bold text-sm">
                                    {(enr.student_name || "?")[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{enr.student_name}</p>
                                    <p className="text-xs text-gray-400">{enr.student_email}</p>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {editStudent === enr.id ? (
                                    <>
                                      <button onClick={() => saveStudent(enr.id)} className="px-2 py-1 text-xs bg-green-500 text-white rounded">{t("حفظ", "Save")}</button>
                                      <button onClick={() => setEditStudent(null)} className="px-2 py-1 text-xs border rounded">{t("إلغاء", "Cancel")}</button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditStudent(enr)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">{t("تعديل", "Edit")}</button>
                                      <button data-no-confirm onClick={() => deleteStudent(enr.id, enr.student_name)} className="px-2 py-1 text-xs bg-red-500 text-white rounded">{t("حذف", "Delete")}</button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {editStudent === enr.id ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-gray-400">{t("الحالة", "Status")}</span>
                                    <select value={studentForm.status} onChange={(e) => setStudentForm({...studentForm, status: e.target.value})} className="w-full px-2 py-1 border rounded mt-1">
                                      <option value="">—</option>
                                      <option value="approved">Approved</option>
                                      <option value="pending">Pending</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("تاريخ الانتهاء", "Expires")}</span>
                                    <input type="date" value={studentForm.expires_at} onChange={(e) => setStudentForm({...studentForm, expires_at: e.target.value})} className="w-full px-2 py-1 border rounded mt-1" />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-gray-400">{t("الهاتف", "Phone")}</span>
                                    <p className="font-medium">{enr.student_phone || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("العنوان", "Address")}</span>
                                    <p className="font-medium">{enr.student_address || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("الرتبة", "Rank")}</span>
                                    <p><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">{enr.student_rank || "—"}</span></p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("حالة الحساب", "Account Status")}</span>
                                    <p><span className={`px-2 py-0.5 rounded font-medium ${enr.student_status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{enr.student_status || "—"}</span></p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("حالة الاشتراك", "Enrollment")}</span>
                                    <p><span className={`px-2 py-0.5 rounded font-medium ${enr.status === "approved" ? "bg-green-100 text-green-700" : enr.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{enr.status}</span></p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("طريقة الدفع", "Payment")}</span>
                                    <p className="font-medium">{enr.payment_method || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("رصيد $", "$")}</span>
                                    <p className="font-medium">{enr.student_emoney || 0}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("مبيعات الفريق", "Team Sales")}</span>
                                    <p className="font-medium">{enr.student_team_sales || 0}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("المباشرين", "Directs")}</span>
                                    <p className="font-medium">{enr.student_direct_count || 0}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("كود الإحالة", "Referral")}</span>
                                    <p className="font-medium font-mono text-everest-600">{enr.student_referral_code || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("تاريخ التسجيل بالكورس", "Enrolled")}</span>
                                    <p className="font-medium">{enr.enrolled_at?.slice(0, 10) || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("انتهاء العضوية", "Membership Expires")}</span>
                                    <p className="font-medium">{enr.student_membership_expires?.slice(0, 10) || "—"}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">{t("عضو منذ", "Joined")}</span>
                                    <p className="font-medium">{enr.student_joined?.slice(0, 10) || "—"}</p>
                                  </div>
                                  {enr.student_bio && (
                                    <div className="col-span-2 md:col-span-4">
                                      <span className="text-gray-400">{t("البايو", "Bio")}</span>
                                      <p className="font-medium">{enr.student_bio}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td></tr>
              )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="text-center text-gray-400 py-8">{t("لا توجد كورسات", "No courses found")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

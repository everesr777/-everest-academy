import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import PageLoading from "../components/PageLoading";
import { useLang } from "../LangContext.jsx";

export default function FreeCoursesSettingsPage() {
  const { t, lang } = useLang();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    api("/api/courses")
      .then((d) => setCourses(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleFree = async (courseId, current) => {
    setSaving(courseId);
    try {
      await api(`/api/courses/${courseId}/show-free`, {
        method: "PUT",
        body: JSON.stringify({ is_show_free: current ? 0 : 1 }),
      });
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, is_show_free: current ? 0 : 1 } : c
        )
      );
    } catch (e) {}
    setSaving(null);
  };

  const toggleHomepage = async (courseId, current) => {
    setSaving(courseId);
    try {
      await api(`/api/courses/${courseId}/show-homepage`, {
        method: "PUT",
        body: JSON.stringify({ is_show_homepage: current ? 0 : 1 }),
      });
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, is_show_homepage: current ? 0 : 1 } : c
        )
      );
    } catch (e) {}
    setSaving(null);
  };

  const toggleCourses = async (courseId, current) => {
    setSaving(courseId);
    try {
      await api(`/api/courses/${courseId}/show-courses`, {
        method: "PUT",
        body: JSON.stringify({ is_show_courses: current ? 0 : 1 }),
      });
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, is_show_courses: current ? 0 : 1 } : c
        )
      );
    } catch (e) {}
    setSaving(null);
  };

  const published = courses.filter((c) => c.status === "published");
  const filtered = published.filter(
    (c) =>
      !search ||
      (c.title_ar || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const freeCount = filtered.filter((c) => c.is_show_free).length;
  const homeCount = filtered.filter((c) => c.is_show_homepage !== 0).length;
  const coursesCount = filtered.filter((c) => c.is_show_courses !== 0).length;

  const Toggle = ({ checked, onChange, disabled }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
        checked ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  if (loading)
    return (
      <PageLoading>
        <p className="text-gray-400 animate-pulse">{t("جاري التحميل...", "Loading...")}</p>
      </PageLoading>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          👁️ {t("إدارة ظهور الكورسات", "Course Visibility")}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t(
            "تحكم في ظهور الكورسات في صفحة المجانيات والهوم بيج وصفحة الكورسات.",
            "Control which courses appear on the free courses page, homepage, and courses page."
          )}
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-white rounded-xl border px-4 py-2 text-sm flex items-center gap-3">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold">🆓 {freeCount}</span>
          <span className="text-gray-400">|</span>
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-bold">🏠 {homeCount}</span>
          <span className="text-gray-400">|</span>
          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold">📚 {coursesCount}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-400">{filtered.length} {t("منشور", "published")}</span>
        </div>
        <input
          type="text"
          placeholder={t("🔍 بحث...", "Search...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition w-64"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
          <div className="col-span-4">{t("الكورس", "Course")}</div>
          <div className="col-span-2 text-center">🆓 {t("صفحة المجانيات", "Free Page")}</div>
          <div className="col-span-2 text-center">🏠 {t("الهوم بيج", "Homepage")}</div>
          <div className="col-span-2 text-center">📚 {t("صفحة الكورسات", "Courses Page")}</div>
          <div className="col-span-2 text-center">💰 {t("السعر", "Price")}</div>
        </div>

        {filtered.map((course) => (
          <div
            key={course.id}
            className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition"
          >
            <div className="col-span-4 flex items-center gap-3 min-w-0">
              {course.featured_image ? (
                <img src={course.featured_image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">📚</div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">{course.title_ar || course.title}</p>
                <p className="text-xs text-gray-400">{course.category_ar || course.category || "—"}</p>
              </div>
            </div>

            <div className="col-span-2 flex justify-center">
              <Toggle
                checked={!!course.is_show_free}
                onChange={() => toggleFree(course.id, course.is_show_free)}
                disabled={saving === course.id}
              />
            </div>

            <div className="col-span-2 flex justify-center">
              <Toggle
                checked={course.is_show_homepage !== 0}
                onChange={() => toggleHomepage(course.id, course.is_show_homepage)}
                disabled={saving === course.id}
              />
            </div>

            <div className="col-span-2 flex justify-center">
              <Toggle
                checked={course.is_show_courses !== 0}
                onChange={() => toggleCourses(course.id, course.is_show_courses)}
                disabled={saving === course.id}
              />
            </div>

            <div className="col-span-2 text-center text-xs text-gray-400">
              {course.is_free ? "🆓" : `${course.price} $`}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p className="font-bold text-gray-500">
              {t("لا توجد كورسات منشرة", "No published courses found")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import PageLoading from "../components/PageLoading";
import { useLang } from "../LangContext";
import { api, getAdminSession, BACKEND_URL } from "../api.js";

export default function FeedbacksPage() {
  const { lang } = useLang();
  const t = (ar, en) => lang === "ar" ? ar : en;
  const [tab, setTab] = useState("feedbacks");
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [proofs, setProofs] = useState([]);
  const [proofLoading, setProofLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { load(); }, [page]);
  useEffect(() => { loadProofs(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/feedbacks?page=${page}&limit=50`);
      setFeedbacks(data.feedbacks);
      setPages(data.pages);
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const remove = async (id) => {
    if (!confirm(t("هل أنت متأكد من حذف هذا التقييم؟", "Delete this feedback?"))) return;
    try {
      await api(`/api/feedbacks/${id}`, { method: "DELETE" });
      setFeedbacks(feedbacks.filter(f => f.id !== id));
    } catch (e) { alert(e.message); }
  };

  const loadProofs = async () => {
    setProofLoading(true);
    try {
      const data = await api("/api/proofs");
      setProofs(data);
    } catch (e) { alert(e.message); }
    setProofLoading(false);
  };

  const uploadProof = async (e) => {
    e.preventDefault();
    if (!file) { alert(t("اختر صورة أولاً", "Select an image first")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("caption", caption);
      const s = getAdminSession();
      const headers = {};
      if (s.userId) headers["x-user-id"] = s.userId;
      if (s.token) headers["x-session-token"] = s.token;
      const r = await fetch(`${BACKEND_URL}/api/proofs`, { method: "POST", headers, body: fd });
      if (!r.ok) {
        let errMsg = "Upload failed";
        try { const d = await r.json(); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg + ` (${r.status})`);
      }
      setFile(null); setCaption("");
      document.getElementById("proof-file-input").value = "";
      await loadProofs();
    } catch (e) {
      console.error("Upload error:", e);
      alert(t("خطأ في الرفع: " + e.message, "Upload error: " + e.message));
    }
    setUploading(false);
  };

  const deleteProof = async (id) => {
    if (!confirm(t("حذف هذه الصورة؟", "Delete this image?"))) return;
    try {
      await api(`/api/proofs/${id}`, { method: "DELETE" });
      setProofs(proofs.filter(p => p.id !== id));
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button onClick={() => setTab("feedbacks")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${tab==="feedbacks"?"bg-everest-600 text-white":"bg-white text-gray-600 border hover:border-everest-300"}`}>
          {t("التقييمات", "Feedbacks")}
        </button>
        <button onClick={() => setTab("proofs")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${tab==="proofs"?"bg-everest-600 text-white":"bg-white text-gray-600 border hover:border-everest-300"}`}>
          {t("صور الإنجازات", "Success Proofs")}
        </button>
      </div>

      {tab === "feedbacks" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">{t("التقييمات", "Feedbacks")}</h1>
              <p className="text-gray-500 text-sm mt-1">{t("جميع تقييمات المستخدمين", "All user feedbacks")}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={load} className="px-4 py-2 text-sm bg-white border rounded-xl shadow-sm hover:shadow-md transition">{t("🔄 تحديث", "🔄 Refresh")}</button>
              <span className="text-sm text-gray-400">{t(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
            </div>
          </div>
          {loading ? (
            <PageLoading>
              <p className="text-gray-400 text-center py-10">{t("جاري التحميل...", "Loading...")}</p>
            </PageLoading>
          ) : feedbacks.length === 0 ? (
            <p className="text-gray-400 text-center py-10">{t("لا توجد تقييمات", "No feedbacks yet")}</p>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {fb.avatar ? (
                        <img src={fb.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-everest-100 flex items-center justify-center font-bold text-everest-700">
                          {(fb.full_name || "?")[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800">{fb.full_name}</p>
                        <p className="text-xs text-gray-400">{fb.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-amber-400 text-sm">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</div>
                      <span className="text-xs text-gray-400">{fb.created_at?.slice(0, 10)}</span>
                      <button onClick={() => remove(fb.id)} className="text-red-500 hover:text-red-700 text-lg leading-none">&times;</button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{fb.message}</p>
                </div>
              ))}
              {pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {Array.from({length:pages},(_,i)=>i+1).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${p===page?'bg-everest-600 text-white border-everest-600':'bg-white text-gray-600 border-gray-200 hover:border-everest-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "proofs" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">{t("صور الإنجازات", "Success Proofs")}</h1>
              <p className="text-gray-500 text-sm mt-1">{t("الصور التي تظهر في صفحة التقييمات", "Images shown on the feedback page")}</p>
            </div>
            <button onClick={loadProofs} className="px-4 py-2 text-sm bg-white border rounded-xl shadow-sm hover:shadow-md transition">{t("🔄 تحديث", "🔄 Refresh")}</button>
          </div>

          <form onSubmit={uploadProof} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="font-bold text-gray-800 mb-4">{t("إضافة صورة جديدة", "Add New Image")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">{t("الصورة", "Image")}</label>
                <input id="proof-file-input" type="file" accept="image/*" onChange={e => setFile(e.target.files[0])}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-everest-50 file:text-everest-700 hover:file:bg-everest-100" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">{t("التعليق", "Caption")}</label>
                <input type="text" value={caption} onChange={e => setCaption(e.target.value)} placeholder={t("وصف الصورة", "Image description")}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-everest-400" />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={uploading || !file}
                  className="px-5 py-2 bg-everest-600 text-white rounded-lg text-sm font-bold hover:bg-everest-700 transition disabled:opacity-50">
                  {uploading ? t("جاري الرفع...", "Uploading...") : t("رفع", "Upload")}
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {proofLoading ? (
              <PageLoading>
                <p className="text-gray-400 text-center py-10 col-span-full">{t("جاري التحميل...", "Loading...")}</p>
              </PageLoading>
            ) : proofs.length === 0 ? (
              <p className="text-gray-400 text-center py-10 col-span-full">{t("لا توجد صور", "No images yet")}</p>
            ) : proofs.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                <div className="relative">
                  <img src={p.image} alt={p.caption} className="w-full h-48 object-cover" />
                  <button onClick={() => deleteProof(p.id)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full text-lg leading-none opacity-0 group-hover:opacity-100 transition">&times;</button>
                </div>
                {p.caption && <p className="text-xs text-gray-500 p-3">{p.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

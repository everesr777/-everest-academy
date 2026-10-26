import React, { useEffect, useRef, useState } from "react";
import { useLang } from "./LangContext";
import { markUserAction, subscribeAction, getPendingCount, subscribePending } from "./api.js";

const SKIP = new Set(["", "x", "+", "-", "cancel", "close", "back", "prev", "next", "previous", "إلغاء", "رجوع", "إغلاق", "تم", "موافق"]);

// Only destructive / money-related actions need the extra "are you sure?" step.
// Everything else (open, save, edit, add, filter, tab, pagination…) must run
// immediately — confirming every single click made the panel feel broken.
const SENSITIVE = [
  /حذف/, /مسح/, /إزالة/, /ازالة/, /حظر/, /إيقاف/, /ايقاف/, /تعطيل/,
  /تحويل/, /سحب/, /خصم/, /رفض/, /استرداد/, /تصفير/, /إعادة تعيين/,
  /\b(delete|remove|block|unblock|ban|transfer|withdraw|deduct|reject|refund|reset|deactivate|disable|purge)\b/i,
];

function norm(s) {
  return String(s || "").replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isPag(l) { return /^(\d+|\d+\s*\/\s*\d+)$/.test(l); }

function isSensitive(el, label) {
  if (el.hasAttribute("data-confirm")) return true;
  return SENSITIVE.some((re) => re.test(label));
}

function skipEl(el) {
  if (!el) return true;
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return true;
  if (el.tagName === "INPUT" && (el.type === "reset" || el.type === "checkbox" || el.type === "radio")) return true;
  if (el.closest("[data-no-confirm]")) return true;
  if (el.closest("aside, nav, [role='tablist']")) return true;
  const l = norm(el.getAttribute("aria-label") || el.title || el.innerText || "");
  if (SKIP.has(l)) return true;
  if (isPag(l)) return true;
  return false;
}

function getLabel(el) {
  const raw = (el.getAttribute("aria-label") || el.title || el.innerText || "").replace(/\s+/g, " ").trim();
  return raw.length > 70 ? raw.slice(0, 70) + "..." : raw;
}

export default function ActionGuard() {
  const { lang } = useLang();
  const t = (ar, en) => (lang === "ar" ? ar : en);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const bypass = useRef(null);
  const pendingRef = useRef(null);
  pendingRef.current = pending;

  // A real write (POST/PUT/DELETE) must lock the screen so the same action can
  // never be submitted twice. Plain reads only show the spinner: the admin can
  // still navigate while a slow list is loading instead of being frozen.
  useEffect(() => {
    const onChange = (count) => setMutating(count > 0);
    onChange(getPendingCount());
    return subscribePending(onChange);
  }, []);

  // Loading overlay for EVERY action (not just the sensitive ones):
  // a click marks a user action, and any request that starts right after it
  // keeps the spinner on screen until it finishes. Requests triggered in the
  // background (cache revalidation) never open it, so pages stay instant.
  const shownAtRef = useRef(0);
  const hideTimerRef = useRef(null);
  useEffect(() => {
    const unsub = subscribeAction((count) => {
      if (count > 0) {
        if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
        setBusy((prev) => { if (!prev) shownAtRef.current = Date.now(); return true; });
      } else {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        // Keep it visible long enough to be noticed even for very fast requests.
        const elapsed = Date.now() - shownAtRef.current;
        const wait = Math.max(0, 500 - elapsed);
        hideTimerRef.current = setTimeout(() => { hideTimerRef.current = null; setBusy(false); }, wait);
      }
    });
    return () => {
      unsub();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest("button, [role='button']");
      if (!el) return;
      // Mark the click so the loading overlay can follow the request it starts.
      markUserAction();
      if (bypass.current === el) { bypass.current = null; return; }
      if (el.closest("[data-guard-ignore]")) return;
      if (pendingRef.current || getPendingCount() > 0) { e.preventDefault(); e.stopPropagation(); return; }
      if (skipEl(el)) return;
      const label = getLabel(el);
      if (!isSensitive(el, norm(label))) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ el, label });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const confirm = () => {
    const cur = pendingRef.current;
    if (!cur) return;
    setPending(null);
    markUserAction();
    bypass.current = cur.el;
    setTimeout(() => {
      try { cur.el.click(); } catch {}
    }, 10);
  };

  return (
    <>
      {pending && (
        <div data-guard-ignore dir={lang === "ar" ? "rtl" : "ltr"} className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={() => setPending(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {t("تأكيد الإجراء", "Confirm Action")}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {t("هل أنت متأكد من", "Are you sure you want to")}{" "}
                <span className="font-semibold text-gray-900 dark:text-white">{pending.label}</span>؟
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPending(null)} className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700">
                {t("إلغاء", "Cancel")}
              </button>
              <button onClick={confirm} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700">
                {t("نعم، متأكد", "Yes, Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {busy && !pending && (
        <div
          data-guard-ignore
          dir={lang === "ar" ? "rtl" : "ltr"}
          className={`fixed inset-0 z-[9990] bg-black/40 flex items-center justify-center ${mutating ? "" : "pointer-events-none"}`}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-gray-900 dark:text-white font-medium">{t("جاري التنفيذ...", "Processing...")}</p>
            <p className="text-gray-500 text-xs">
              {mutating
                ? t("يرجى الانتظار وعدم الضغط مرة أخرى", "Please wait, do not click again")
                : t("يمكنك التنقل أثناء التحميل", "You can keep navigating while it loads")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

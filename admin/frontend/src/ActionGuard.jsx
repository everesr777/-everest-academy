import React, { useEffect, useRef, useState } from "react";
import { useLang } from "./LangContext";
import { getPendingCount } from "./api.js";

const SKIP = new Set(["", "x", "+", "-", "cancel", "close", "back", "prev", "next", "previous"]);

function norm(s) {
  return String(s || "").replace(/[\u{1F000}-\u{1FAFF}]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isPag(l) { return /^(\d+|\d+\s*\/\s*\d+)$/.test(l); }

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
  const bypass = useRef(null);
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  pendingRef.current = pending;
  busyRef.current = busy;

  useEffect(() => {
    const onClick = (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest("button, [role='button']");
      if (!el) return;
      if (bypass.current === el) { bypass.current = null; return; }
      if (el.closest("[data-guard-ignore]")) return;
      if (busyRef.current || pendingRef.current) { e.preventDefault(); e.stopPropagation(); return; }
      if (skipEl(el)) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ el, label: getLabel(el) });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => {
      if (getPendingCount() === 0) setBusy(false);
    }, 200);
    const timeout = setTimeout(() => setBusy(false), 300000);
    return () => { clearInterval(id); clearTimeout(timeout); };
  }, [busy]);

  const confirm = () => {
    const cur = pendingRef.current;
    if (!cur) return;
    setPending(null);
    setBusy(true);
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
      {busy && (
        <div data-guard-ignore dir={lang === "ar" ? "rtl" : "ltr"} className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-gray-900 dark:text-white font-medium">{t("جاري التنفيذ...", "Processing...")}</p>
            <p className="text-gray-500 text-xs">{t("يرجى الانتظار وعدم الضغط مرة أخرى", "Please wait, do not click again")}</p>
          </div>
        </div>
      )}
    </>
  );
}

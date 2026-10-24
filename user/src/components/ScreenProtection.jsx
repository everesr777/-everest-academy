import { useEffect } from "react";

export default function ScreenProtection() {
  useEffect(() => {
    const onKey = (e) => {
      const key = String(e.key || "").toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // PrintScreen
      if (key === "printscreen") { e.preventDefault(); return false; }

      // Ctrl+Shift+S (Firefox screenshot)
      if (ctrl && shift && key === "s") { e.preventDefault(); return false; }

      // Ctrl+Shift+I / Ctrl+Shift+J (DevTools)
      if (ctrl && shift && (key === "i" || key === "j")) { e.preventDefault(); return false; }

      // F12 (DevTools)
      if (key === "f12") { e.preventDefault(); return false; }

      // Ctrl+U (View Source)
      if (ctrl && key === "u") { e.preventDefault(); return false; }

      // Ctrl+P (Print)
      if (ctrl && key === "p") { e.preventDefault(); return false; }

      // Cmd+Shift+3/4/5 (Mac screenshots)
      if (e.metaKey && shift && (key === "3" || key === "4" || key === "5")) { e.preventDefault(); return false; }
    };
    document.addEventListener("keydown", onKey);

    // Blur video elements when tab loses focus
    const onBlur = () => {
      document.querySelectorAll("video").forEach(v => { v.style.filter = "blur(20px)"; });
    };
    const onFocus = () => {
      document.querySelectorAll("video").forEach(v => { v.style.filter = "none"; });
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}

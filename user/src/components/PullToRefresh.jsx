import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../ThemeContext";

// Pull-down-to-refresh: on mobile, pulling the screen down at the top of the
// page triggers a background data revalidation instead of a full page reload.
// The visible indicator mirrors the native "pull to refresh" spinner.
export default function PullToRefresh({ onRefresh, children }) {
  const { theme } = useTheme();
  const startY = useRef(null);
  const pullRef = useRef(0);
  const activeRef = useRef(false);
  const [pull, setPull] = useState(0);
  const THRESHOLD = 75;

  useEffect(() => {
    const onStart = (e) => {
      if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
      else startY.current = null;
    };
    const onMove = (e) => {
      if (startY.current == null) return;
      const d = e.touches[0].clientY - startY.current;
      if (d > 6 && window.scrollY <= 0) {
        activeRef.current = true;
        if (d > THRESHOLD) e.preventDefault();
        const v = Math.min(130, Math.round(d));
        pullRef.current = v;
        setPull(v);
      }
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      if (activeRef.current) {
        const ready = pullRef.current >= THRESHOLD;
        activeRef.current = false;
        pullRef.current = 0;
        setPull(0);
        if (ready && onRefresh) onRefresh();
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  return (
    <>
      {pull > 0 && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, height: Math.max(0, pull),
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            background: "transparent", zIndex: 2147483000, pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 22, height: 22, marginBottom: 8,
              borderRadius: "50%",
              border: `2px solid ${theme === "dark" ? "#555" : "#ccc"}`,
              borderTopColor: theme === "dark" ? "#fff" : "#6a0dad",
              borderRightColor: theme === "dark" ? "#fff" : "#6a0dad",
              transform: `rotate(${Math.round((pull / 130) * 270)}deg)`,
              transition: "transform .15s",
            }}
          />
        </div>
      )}
      {children}
    </>
  );
}
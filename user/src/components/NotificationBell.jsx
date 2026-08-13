import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../ThemeContext";
import { useLang } from "../LangContext";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const api = (path, opts = {}) => {
  const uid = localStorage.getItem("everest_user");
  const stoken = localStorage.getItem("everest_session_token");
  const headers = { "Content-Type": "application/json" };
  if (uid && stoken) { try { headers["x-user-id"] = JSON.parse(uid).id; headers["x-session-token"] = stoken; } catch {} }
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  return fetch(url, { ...opts, headers: { ...headers, ...opts.headers } }).then((r) => r.json());
};

export default function NotificationBell({ userId }) {
  const { colors: c } = useTheme();
  const { t, dir } = useLang();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userId) return;
    api(`/api/notifications?userId=${userId}`).then((d) => {
      setNotifications(d.notifications || []);
      setUnreadCount(d.unreadCount || 0);
    }).catch(() => {});
    const interval = setInterval(() => {
      api(`/api/notifications?userId=${userId}`).then((d) => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => {
    await api(`/api/notifications/${id}/read`, { method: "PUT" });
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  const markAllRead = async () => {
    await api(`/api/notifications/read-all/${userId}`, { method: "PUT" });
    setNotifications(notifications.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const typeStyles = {
    success: { bg: "#ecfdf5", dot: "#10b981" },
    error: { bg: "#fef2f2", dot: "#ef4444" },
    warning: { bg: "#fffbeb", dot: "#f59e0b" },
    commission: { bg: "#fffbeb", dot: "#f59e0b" },
    info: { bg: "#eff6ff", dot: "#3b82f6" },
    transfer: { bg: "#f5f3ff", dot: "#8b5cf6" },
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={{ position: "relative", width: 48, height: 48, border: "none", outline: "none", cursor: "pointer", borderRadius: 14, background: c.bgInput, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className="fa-regular fa-bell"></i>
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: 8, right: 10, width: 20, height: 20, background: "#ff3b30", borderRadius: "50%", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: 56, [dir === "rtl" ? "left" : "right"]: 0, maxHeight: 420, background: c.bgCard, borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: `1px solid ${c.border}`, overflow: "hidden", zIndex: 9999, width: Math.min(360, (typeof window !== "undefined" ? window.innerWidth - 24 : 360)) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${c.border}` }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t("الإشعارات", "Notifications")}</h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 12, color: "#2563ff", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {t("تحديد الكل كمقروء", "Mark all read")}
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", maxHeight: 350 }}>
            {notifications.length === 0 ? (
              <p style={{ textAlign: "center", color: c.textMuted, padding: "40px 20px", fontSize: 13 }}>{t("لا توجد إشعارات", "No notifications")}</p>
            ) : (
              notifications.map((n) => {
                const ts = typeStyles[n.type] || typeStyles.info;
                return (
                  <div key={n.id} onClick={() => { if (!n.is_read) markRead(n.id); }} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", cursor: "pointer", background: n.is_read ? c.bgCard : c.bgSoft, borderBottom: `1px solid ${c.border}`, transition: "0.2s" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: n.is_read ? c.textMuted : ts.dot, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: c.text, margin: 0 }}>{n.title}</p>
                      <p style={{ fontSize: 12, color: c.textMuted, marginTop: 4, lineHeight: 1.5 }}>{n.message}</p>
                      <p style={{ fontSize: 11, color: c.textMuted, marginTop: 5 }}>{n.created_at?.slice(0, 16)?.replace("T", " ")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

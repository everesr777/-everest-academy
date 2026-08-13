import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();
const API = window.location.origin.includes("localhost") ? "http://localhost:5000/api" : "https://everest-academy-production.up.railway.app/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const d = localStorage.getItem("everest_user");
      if (!d) return null;
      const u = JSON.parse(d);
      const st = localStorage.getItem("everest_session_token");
      if (st) u.session_token = st;
      return u;
    } catch { return null; }
  });

  // Refresh stale user data on mount (old localStorage may lack account_type etc.)
  useEffect(() => {
    if (!user?.id || !user?.session_token) return;
    fetch(`${API}/users/${user.id}`, {
      headers: { "x-user-id": user.id, "x-session-token": user.session_token }
    })
      .then(r => r.ok ? r.json() : null)
      .then(fresh => {
        if (fresh && fresh.account_type) {
          const updated = { ...user, ...fresh, session_token: user.session_token };
          setUser(updated);
          localStorage.setItem("everest_user", JSON.stringify(updated));
        }
      })
      .catch(() => {});
  }, []);

  // Heartbeat: ping server every 3 seconds + auto-logout if session killed
  useEffect(() => {
    if (!user?.id || !user?.session_token) return;
    let failedCount = 0;
    const sendHeartbeat = () => {
      fetch(`${API}/auth/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.id, "x-session-token": user.session_token },
        body: JSON.stringify({ user_id: user.id }),
      }).then(res => {
        failedCount = 0;
        return res.json();
      }).then(data => {
        if (data && data.logout) {
          setUser(null);
          localStorage.removeItem("everest_user");
          localStorage.removeItem("everest_session_token");
        }
      }).catch(() => {
        failedCount++;
        if (failedCount >= 5) {
          setUser(null);
          localStorage.removeItem("everest_user");
          localStorage.removeItem("everest_session_token");
        }
      });
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") sendHeartbeat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.id, user?.session_token]);

  const login = (u, sessionToken) => {
    const prevToken = localStorage.getItem("everest_session_token");
    const token = sessionToken || u.session_token || prevToken;
    const userData = { ...u, session_token: token };
    setUser(userData);
    localStorage.setItem("everest_user", JSON.stringify(userData));
    if (token) localStorage.setItem("everest_session_token", token);
  };

  const logout = () => {
    try {
      const u = JSON.parse(localStorage.getItem("everest_user"));
      if (u && u.id && u.session_token) {
        fetch(`${API}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": u.id,
            "x-session-token": u.session_token,
          },
        }).catch(() => {});
      }
    } catch {}
    setUser(null);
    localStorage.removeItem("everest_user");
    localStorage.removeItem("everest_session_token");
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangContext";
import { useTheme } from "../ThemeContext";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = window.location.origin.includes("localhost") ? "http://localhost:5000" : "https://everest-academy-production.up.railway.app";

const useIsMobile = () => {
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
};

export default function AssistantPage() {
  const { user } = useAuth();
  const { t, dir } = useLang();
  const { colors: c } = useTheme();
  const nav = useNavigate();
  const m = useIsMobile();
  const [chatSidebar, setChatSidebar] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversations, setConversations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ea_chats")) || []; } catch { return []; }
  });
  const [activeConvId, setActiveConvId] = useState(null);
  const chatRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const chatMsgs = activeConv?.messages || [];

  const saveConvs = (convs) => {
    setConversations(convs);
    localStorage.setItem("ea_chats", JSON.stringify(convs));
  };

  const newChat = () => {
    setChatSidebar(false);
    const id = Date.now().toString();
    const conv = { id, title: t("محادثة جديدة", "New chat"), messages: [], createdAt: id };
    saveConvs([conv, ...conversations]);
    setActiveConvId(id);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    const convs = conversations.filter(c => c.id !== id);
    saveConvs(convs);
    if (activeConvId === id) setActiveConvId(convs.length > 0 ? convs[0].id : null);
  };

  const sendChat = async (preMsg) => {
    const raw = preMsg || chatInput;
    if (!raw.trim() || chatLoading) return;
    const msg = raw.trim();
    setChatInput("");
    let convs = [...conversations];
    let conv = convs.find(c => c.id === activeConvId);
    if (!conv) {
      const id = Date.now().toString();
      conv = { id, title: msg.slice(0, 30), messages: [], createdAt: id };
      convs.unshift(conv);
      setActiveConvId(id);
    }
    if (conv.title === t("محادثة جديدة", "New chat")) conv.title = msg.slice(0, 30);
    conv.messages.push({ role: "user", text: msg });
    saveConvs(convs);
    setChatLoading(true);
    try {
      const history = conv.messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history })
      });
      const data = await res.json();
      convs = JSON.parse(localStorage.getItem("ea_chats")) || [];
      conv = convs.find(c => c.id === activeConvId);
      if (conv) {
        conv.messages.push({ role: "bot", text: data.reply || data.error || t("عذراً، حدث خطأ. حاول مرة أخرى.", "Sorry, an error occurred. Try again.") });
        saveConvs(convs);
      }
    } catch {
      convs = JSON.parse(localStorage.getItem("ea_chats")) || [];
      conv = convs.find(c => c.id === activeConvId);
      if (conv) {
        conv.messages.push({ role: "bot", text: t("عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.", "Sorry, a connection error occurred. Try again.") });
        saveConvs(convs);
      }
    }
    setChatLoading(false);
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMsgs]);

  useEffect(() => {
    if (conversations.length > 0 && !activeConvId) setActiveConvId(conversations[0].id);
    if (conversations.length === 0) newChat();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 72px)", background: c.bg, direction: dir }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        {chatSidebar && (
          <div style={{
            width: m ? 240 : 280, flexShrink: 0, background: c.bgCard,
            borderRight: `1px solid ${c.borderLight}`, display: "flex", flexDirection: "column",
            overflow: "auto"
          }}>
            <div style={{ padding: "16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${c.borderLight}` }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: c.text }}>{t("المحادثات", "Conversations")}</span>
              <button onClick={() => setChatSidebar(false)} style={{ background: "none", border: "none", color: c.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 8 }}>
              <button onClick={newChat} style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${c.borderLight}`,
                background: c.bgInput, color: c.text, fontWeight: 600, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, marginBottom: 8
              }}>+ {t("محادثة جديدة", "New chat")}</button>
            </div>
            {conversations.map(cv => (
              <div key={cv.id} onClick={() => { setActiveConvId(cv.id); setChatSidebar(false); }}
                style={{
                  padding: "10px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: cv.id === activeConvId ? `${c.primary}15` : "transparent",
                  borderLeft: cv.id === activeConvId ? `3px solid ${c.primary}` : "3px solid transparent",
                  transition: "0.2s"
                }}>
                <span style={{ fontSize: 13, color: cv.id === activeConvId ? c.primary : c.text, fontWeight: cv.id === activeConvId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{cv.title}</span>
                <button onClick={(e) => deleteChat(e, cv.id)} style={{ background: "none", border: "none", color: c.textMuted, fontSize: 14, cursor: "pointer", padding: "0 4px" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: m ? "12px 14px" : "16px 20px",
            background: c.bgCard, borderBottom: `1px solid ${c.borderLight}`, flexShrink: 0
          }}>
            <button onClick={() => nav(-1)} title={t("خروج", "Exit")} style={{
              width: 40, height: 40, borderRadius: 12, border: `1px solid ${c.borderLight}`,
              background: c.bgInput, color: c.text, fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            </button>
            <button onClick={() => setChatSidebar(!chatSidebar)} style={{
              width: 40, height: 40, borderRadius: 12, border: `1px solid ${c.borderLight}`,
              background: c.bgInput, color: c.text, fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>☰</button>
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: 0, fontSize: m ? 14 : 16, fontWeight: 700, color: c.text }}>
                {activeConv?.title || t("مساعد إيفرست الذكي", "Everest AI Assistant")}
              </h5>
              <span style={{ fontSize: 12, color: "#25d366" }}>{t("متصل الآن", "Online now")}</span>
            </div>
            <button onClick={newChat} style={{
              width: 40, height: 40, borderRadius: 12, border: `1px solid ${c.borderLight}`,
              background: c.bgInput, color: c.text, fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>+</button>
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflow: "auto", padding: m ? "16px 12px" : "24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {chatMsgs.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", gap: 16, padding: 40 }}>
                <div style={{ fontSize: 48 }}>🏔️</div>
                <h4 style={{ margin: 0, fontSize: m ? 18 : 22, fontWeight: 800, color: c.text }}>{t("مرحباً بك!", "Welcome!")}</h4>
                <p style={{ margin: 0, fontSize: m ? 13 : 15, color: c.textMuted, maxWidth: 400, lineHeight: 1.6 }}>{t("أنا مساعد إيفرست الذكي. اسألني عن أي شيء!", "I'm the Everest AI assistant. Ask me anything!")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8, maxWidth: 500 }}>
                  {[
                    { msg: "ايه هي ايفرست؟", label: t("ما هي إيفرست؟", "What is Everest?") },
                    { msg: "الكورسات", label: t("الكورسات", "Courses") },
                    { msg: "نظام الرتب", label: t("نظام الرتب", "Ranks") },
                    { msg: "طرق الدفع", label: t("طرق الدفع", "Payment") }
                  ].map((chip) => (
                    <div key={chip.label} onClick={() => sendChat(chip.msg)} style={{
                      padding: "10px 18px", borderRadius: 999, border: `1px solid ${c.borderLight}`,
                      background: c.bgInput, color: c.text, fontSize: 13, cursor: "pointer",
                      transition: "0.2s", fontWeight: 500
                    }} onMouseEnter={e => { e.currentTarget.style.borderColor = c.primary; e.currentTarget.style.color = c.primary; }}
                       onMouseLeave={e => { e.currentTarget.style.borderColor = c.borderLight; e.currentTarget.style.color = c.text; }}>
                      {chip.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: m ? "85%" : "70%", padding: "12px 16px", borderRadius: 16,
                background: msg.role === "user"
                  ? `linear-gradient(135deg, ${c.primary || "#6E3BF2"}, ${c.primaryEnd || "#6E3BF2"})`
                  : c.bgCard,
                color: msg.role === "user" ? "#fff" : c.text,
                border: msg.role === "user" ? "none" : `1px solid ${c.borderLight}`,
                fontSize: m ? 13 : 14, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word"
              }}>
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", gap: 4, padding: "12px 16px", alignSelf: "flex-start" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: "50%", background: c.textMuted,
                    animation: `bounce 1.2s infinite ${i * 0.2}s`
                  }} />
                ))}
                <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }`}</style>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: m ? "12px" : "16px 20px", borderTop: `1px solid ${c.borderLight}`,
            background: c.bgCard, flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 800, margin: "0 auto" }}>
              <input type="text" placeholder={t("اكتب سؤالك هنا...", "Type your question here...")}
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                style={{
                  flex: 1, padding: m ? "12px 14px" : "14px 18px", borderRadius: 14,
                  border: `1px solid ${c.borderLight}`, background: c.bgInput,
                  color: c.text, fontSize: m ? 14 : 15, outline: "none"
                }} />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: m ? 44 : 48, height: m ? 44 : 48, borderRadius: 14,
                  background: chatInput.trim() && !chatLoading
                    ? `linear-gradient(135deg, ${c.primary || "#6E3BF2"}, ${c.primaryEnd || "#6E3BF2"})`
                    : c.bgInput,
                  border: "none", cursor: chatInput.trim() && !chatLoading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "0.3s"
                }}>
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: chatInput.trim() && !chatLoading ? "#fff" : c.textMuted }}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

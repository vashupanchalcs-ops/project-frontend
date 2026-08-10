import { useEffect, useMemo, useRef, useState } from "react";

const BASE = "http://127.0.0.1:8000";
const wsBaseFromHttpBase = () => {
  try {
    const u = new URL(BASE);
    return `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`;
  } catch {
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000`;
  }
};

export default function BookingChatPanel({
  role = "user",
  thread,
  canSend = true,
  title = "AI Dispatch Chat",
  compact = false,
  messageTarget = "all",
  visibleTargets = null,
  allowedSenderRoles = null,
  extraActions = null,
  instagramMode = false,
  showControls = true,
  onMessagesChange = null,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingTimer, setTypingTimer] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [syncMode, setSyncMode] = useState(false);
  const [presence, setPresence] = useState({});
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem("sr_voice_assistant_on") === "1";
    } catch {
      return false;
    }
  });
  const [micOn, setMicOn] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("ready");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenPreview, setSpokenPreview] = useState("");
  const listRef = useRef(null);
  const wsRef = useRef(null);
  const spokenIdsRef = useRef(new Set());
  const speechRef = useRef(null);

  const myName = useMemo(
    () => localStorage.getItem("name") || role.toUpperCase(),
    [role]
  );
  const spokenStorageKey = useMemo(
    () => (thread?.id ? `sr_spoken_msgs_${role}_${thread.id}` : ""),
    [role, thread?.id]
  );
  const voiceLabel = role === "admin" ? "Control Voice" : role === "driver" ? "Driver Voice" : "User Voice";
  const visibleTargetsKey = useMemo(() => {
    const base = Array.isArray(visibleTargets) && visibleTargets.length ? visibleTargets : ["all", role];
    return base.map((x) => String(x || "").toLowerCase()).join("|");
  }, [visibleTargets, role]);
  const targetSet = useMemo(() => new Set(visibleTargetsKey.split("|").filter(Boolean)), [visibleTargetsKey]);
  const senderRoleKey = useMemo(() => {
    const base = Array.isArray(allowedSenderRoles) && allowedSenderRoles.length
      ? allowedSenderRoles
      : [];
    return base.map((x) => String(x || "").toLowerCase()).join("|");
  }, [allowedSenderRoles]);
  const senderRoleSet = useMemo(() => new Set(senderRoleKey.split("|").filter(Boolean)), [senderRoleKey]);

  const isVisibleMessage = (m) => {
    const tr = String(m?.target_role || "all").toLowerCase();
    const sr = String(m?.sender_role || "").toLowerCase();
    if (!targetSet.has(tr)) return false;
    if (senderRoleSet.size > 0 && !senderRoleSet.has(sr)) return false;
    return true;
  };

  const speakNow = (text) => {
    if (!voiceOn) return;
    const msg = String(text || "").trim();
    if (!msg || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(msg);
      ut.rate = role === "driver" ? 1.02 : 1;
      ut.pitch = role === "admin" ? 0.98 : 1;
      ut.volume = 1;
      const v = window.speechSynthesis
        .getVoices()
        .find((x) => /en-in|india|hindi|english/i.test(x.lang + " " + x.name));
      if (v) ut.voice = v;
      ut.onstart = () => {
        setIsSpeaking(true);
        setVoiceStatus("speaking");
        setSpokenPreview(msg.slice(0, 90));
      };
      ut.onend = () => {
        setIsSpeaking(false);
        setVoiceStatus("ready");
      };
      ut.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus("speech-error");
      };
      window.speechSynthesis.speak(ut);
    } catch {}
  };

  const recognizeSpeech = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus("speech-api-not-supported");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "en-IN";
      rec.interimResults = false;
      rec.continuous = false;
      speechRef.current = rec;
      setMicOn(true);
      setVoiceStatus("listening");
      rec.onresult = (e) => {
        const txt = e?.results?.[0]?.[0]?.transcript || "";
        if (txt) setDraft((prev) => `${prev ? `${prev} ` : ""}${txt}`.trim());
      };
      rec.onerror = () => setVoiceStatus("mic-error");
      rec.onend = () => {
        setMicOn(false);
        setVoiceStatus("ready");
      };
      rec.start();
    } catch {
      setMicOn(false);
      setVoiceStatus("mic-error");
    }
  };

  const loadMessages = async () => {
    if (!thread?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/messages/?role=${encodeURIComponent(role)}`);
      const data = await res.json();
      const rows = Array.isArray(data.messages) ? data.messages : [];
      const filtered = rows.filter(isVisibleMessage);
      setMessages(filtered);
      if (typeof onMessagesChange === "function") onMessagesChange(filtered);
      await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/read/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const setPresenceHttp = async (payload) => {
    if (!thread?.id) return;
    await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/presence/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, ...payload }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!thread?.id) return;
    setPresence({
      user_online: !!thread.user_online,
      driver_online: !!thread.driver_online,
      admin_online: !!thread.admin_online,
      user_typing: !!thread.user_typing,
      driver_typing: !!thread.driver_typing,
      admin_typing: !!thread.admin_typing,
    });

    loadMessages();
    const wsUrl = `${wsBaseFromHttpBase()}/ws/chat/${thread.id}/?role=${encodeURIComponent(role)}&name=${encodeURIComponent(myName)}`;
    let reconnectTimer = null;
    let fallbackPoll = null;
    let fallbackPresencePulse = null;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setSyncMode(false);
          ws.send(JSON.stringify({ type: "read" }));
          if (fallbackPoll) {
            clearInterval(fallbackPoll);
            fallbackPoll = null;
          }
          if (fallbackPresencePulse) {
            clearInterval(fallbackPresencePulse);
            fallbackPresencePulse = null;
          }
        };

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data || "{}");
            if (payload.type === "history" && Array.isArray(payload.messages)) {
              const filtered = payload.messages.filter(isVisibleMessage);
              setMessages(filtered);
              if (typeof onMessagesChange === "function") onMessagesChange(filtered);
            } else if (payload.type === "message" && payload.message) {
              if (!isVisibleMessage(payload.message)) return;
              setMessages((prev) => {
                if (prev.some((m) => m.id === payload.message.id)) return prev;
                const next = [...prev, payload.message];
                if (typeof onMessagesChange === "function") onMessagesChange(next);
                return next;
              });
            } else if (payload.type === "presence" && payload.presence) {
              setPresence(payload.presence);
            }
          } catch {}
        };

        ws.onclose = () => {
          setWsConnected(false);
          setSyncMode(true);
          if (!fallbackPoll) fallbackPoll = setInterval(loadMessages, 3500);
          if (!fallbackPresencePulse) {
            setPresenceHttp({ online: true, typing: false });
            fallbackPresencePulse = setInterval(() => {
              setPresenceHttp({ online: true });
            }, 5000);
          }
          reconnectTimer = setTimeout(connectWs, 2200);
        };

        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
      } catch {
        setSyncMode(true);
        if (!fallbackPoll) fallbackPoll = setInterval(loadMessages, 3500);
        if (!fallbackPresencePulse) {
          setPresenceHttp({ online: true, typing: false });
          fallbackPresencePulse = setInterval(() => {
            setPresenceHttp({ online: true });
          }, 5000);
        }
      }
    };
    connectWs();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fallbackPoll) clearInterval(fallbackPoll);
      if (fallbackPresencePulse) clearInterval(fallbackPresencePulse);
      setWsConnected(false);
      setSyncMode(false);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "typing", typing: false }));
        } catch {}
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      setPresenceHttp({ online: false, typing: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, role, myName, visibleTargetsKey, senderRoleKey]);

  useEffect(() => {
    try {
      localStorage.setItem("sr_voice_assistant_on", voiceOn ? "1" : "0");
    } catch {}
    if (!voiceOn && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } catch {}
    }
  }, [voiceOn]);

  useEffect(() => {
    if (!spokenStorageKey) return;
    try {
      const raw = localStorage.getItem(spokenStorageKey);
      const arr = raw ? JSON.parse(raw) : [];
      spokenIdsRef.current = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      spokenIdsRef.current = new Set();
    }
  }, [spokenStorageKey]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!voiceOn || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest) return;
    // Admin ke case me own messages bhi announce honge (control room announcement style)
    if (role !== "admin" && latest.sender_role === role) return;
    if (spokenIdsRef.current.has(latest.id)) return;
    spokenIdsRef.current.add(latest.id);
    try {
      if (spokenStorageKey) {
        localStorage.setItem(spokenStorageKey, JSON.stringify(Array.from(spokenIdsRef.current)));
      }
    } catch {}
    const prefix =
      latest.sender_role === "system"
        ? "YiCare update."
        : latest.sender_role === "admin"
        ? "Admin message."
        : latest.sender_role === "driver"
        ? "Driver update."
        : "User message.";
    speakNow(`${prefix} ${latest.message}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceOn, role, spokenStorageKey]);

  const clearChat = async () => {
    if (!thread?.id) return;
    const yes = window.confirm("Clear this full chat history?");
    if (!yes) return;
    try {
      await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/messages/`, {
        method: "DELETE",
      });
      setMessages([]);
      spokenIdsRef.current = new Set();
      if (spokenStorageKey) {
        try {
          localStorage.removeItem(spokenStorageKey);
        } catch {}
      }
    } catch {}
  };

  const sendMessage = async (text, messageType = "text") => {
    if (!thread?.id || !String(text || "").trim()) return;
    try {
      setSending(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            sender_role: role,
            sender_name: myName,
            message: text.trim(),
            message_type: messageType,
            target_role: messageTarget,
          })
        );
      } else {
        await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/messages/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender_role: role,
            sender_name: myName,
            message: text.trim(),
            message_type: messageType,
            target_role: messageTarget,
          }),
        });
      }
      setDraft("");
      if (!(wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
        loadMessages();
      }
    } catch {}
    finally {
      setSending(false);
    }
  };

  const onTyping = async (val) => {
    setDraft(val);
    if (!thread?.id) return;
    if (typingTimer) clearTimeout(typingTimer);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "typing", typing: true }));
      } catch {}
    } else {
      await fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/presence/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, typing: true }),
      }).catch(() => {});
    }
    const timer = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "typing", typing: false }));
        } catch {}
      } else {
        fetch(`${BASE}/api/bookings/chat/threads/${thread.id}/presence/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, typing: false }),
        }).catch(() => {});
      }
    }, 1200);
    setTypingTimer(timer);
  };

  const presenceText = (() => {
    if (!thread) return "";
    const isTyping =
      (role !== "admin" && presence.admin_typing) ||
      (role !== "driver" && presence.driver_typing) ||
      (role !== "user" && presence.user_typing);
    if (isTyping) return "Typing...";
    const onlineCount = [presence.admin_online, presence.driver_online, presence.user_online].filter(Boolean).length;
    if (onlineCount > 0) return `${onlineCount} online${wsConnected ? " · live" : syncMode ? " · sync" : ""}`;
    if (wsConnected) return "Live connected";
    if (syncMode) return "Sync mode";
    return "Offline";
  })();

  return (
    <div className={`chat-panel ${compact ? "compact" : ""} ${instagramMode ? "insta" : ""}`}>
      <style>{`
        .chat-panel{
          border:1px solid rgba(20,20,20,.12);
          border-radius:18px;
          background:#f6f7f2;
          overflow:hidden;
          display:grid;
          grid-template-rows:auto auto minmax(0,1fr) auto auto;
          height:100%;
          min-height:0;
        }
        .chat-panel.compact{
          height: 100%;
          min-height: 0;
        }
        .chat-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(20,20,20,.1);background:#f1f4df}
        .chat-head h3{margin:0;font-size:16px;color:#111}
        .chat-pres{font-size:12px;color:#5f6374}
        .chat-head-left{display:flex;align-items:center;gap:10px;min-width:0}
        .chat-head-id{font-size:11px;color:#666}
        .chat-avatar{
          width:30px;height:30px;border-radius:50%;
          background:#e7ead5;border:1px solid #d3d8b0;
          display:grid;place-items:center;
          font-weight:800;font-size:13px;color:#333;
          flex-shrink:0;
        }
        .chat-list{
          height:auto;
          min-height:0;
          overflow:auto;
          overflow-x:hidden;
          overscroll-behavior:contain;
          padding:12px;
          display:flex;
          flex-direction:column;
          gap:8px;
          background:#eceee6;
        }
        .chat-panel.compact .chat-list{
          min-height: 0;
        }
        .chat-msg{max-width:78%;padding:10px 12px;border-radius:16px;border:1px solid rgba(20,20,20,.08);font-size:13px;line-height:1.4}
        .chat-msg.mine{align-self:flex-end;background:#ffffff;border-color:#ffffff;color:#fff}
        .chat-msg.other{align-self:flex-start;background:#fff;border-color:#d9ddd0;color:#111}
        .chat-meta{margin-top:4px;font-size:10px;color:#5d606f}
        .chat-ctrl{padding:10px;border-top:1px solid rgba(20,20,20,.1);display:flex;gap:8px;flex-wrap:wrap;background:#f6f7f2}
        .chat-ctrl textarea{flex:1;min-height:44px;max-height:88px;border:1px solid rgba(20,20,20,.2);border-radius:12px;padding:9px 10px;font-family:inherit;background:#fff;color:#111}
        .chat-btn{border:none;border-radius:12px;background:#ffffff;color:#fff;padding:10px 12px;font-weight:700;cursor:pointer}
        .chat-btn:disabled{opacity:.55;cursor:not-allowed}
        .chat-voice-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid rgba(20,20,20,.08);background:#f9faf4}
        .chat-chip{border:1px solid rgba(20,20,20,.18);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;background:#fff;color:#111}
        .chat-chip.on{background:#ffffff;border-color:#ffffff;color:#fff}
        .chat-panel.insta{
          border-radius: 0;
          border: none;
          background: #f6f7f2;
          grid-template-rows:auto auto minmax(0,1fr) auto auto;
        }
        @media (max-width: 640px){
           .chat-panel.insta{
             border-radius: 0px; 
           }
        }
        .chat-panel.insta .chat-head{
          background:#fff;
          padding:14px 16px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .chat-panel.insta .chat-head h3{
          font-size:17px;
          font-weight:800;
          letter-spacing: -0.3px;
        }
        .chat-panel.insta .chat-list{
          background:#f4f5f0;
          padding:16px 14px;
          gap:14px;
        }
        .chat-panel.insta .chat-msg{
          border-radius: 20px;
          border:none;
          padding:10px 14px;
          max-width:75%;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          font-size: 14px;
        }
        .chat-panel.insta .chat-msg.other{
          background:#fff;
          color:#111;
          align-self:flex-start;
          border-bottom-left-radius: 4px;
        }
        .chat-panel.insta .chat-msg.mine{
          background:#ffffff;
          color:#fff;
          align-self:flex-end;
          border-bottom-right-radius: 4px;
        }
        .chat-panel.insta .chat-msg.mine .chat-meta{
          color:rgba(255,255,255,0.8);
        }
        .chat-panel.insta .chat-ctrl{
          background:#fff;
          border-top:1px solid rgba(0,0,0,0.06);
          padding:10px 14px;
          gap:10px;
          flex-wrap:nowrap;
          align-items: center;
        }
        .chat-panel.insta .chat-head-id{
          color:#999;
        }
        .chat-panel.insta .chat-ctrl textarea{
          min-height:24px;
          max-height:88px;
          border-radius:24px;
          border: 1px solid rgba(0,0,0,0.1);
          padding:13px 18px;
          background:#f9f9f9;
          font-size: 14px;
        }
        .chat-panel.insta .chat-btn{
          border-radius:50%;
          width: 44px;
          height: 44px;
          min-width: 44px;
          padding: 0;
          background:#111;
          color:#ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .chat-panel.insta .chat-btn:disabled{
          opacity: 0.5;
        }
        .chat-panel.insta .chat-voice-row{
          background:#fff;
          border-bottom:1px solid rgba(0,0,0,0.04);
          padding:8px 12px;
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          gap: 8px;
          white-space: nowrap;
          flex-wrap: nowrap;
        }
        .chat-panel.insta .chat-voice-row::-webkit-scrollbar {
          display: none;
        }
        .chat-panel.insta .chat-chip{
          padding: 6px 12px;
          font-size: 11px;
          border-radius: 100px;
          border: 1px solid rgba(0,0,0,0.1);
          background: #fdfdfd;
          flex-shrink: 0;
        }
        .chat-panel.insta .chat-chip.on{
          background: #ffffff;
          border-color: #c8de00;
        }
        .chat-panel.insta .chat-meta {
          flex-shrink: 0;
          font-size: 11px;
        }

        @media (max-width: 920px){
          .chat-panel{
            height: 100%;
            min-height: 0;
          }
          .chat-panel.compact{
            height: 100%;
            min-height: 0;
          }
        }
        @media (max-width: 640px){
          .chat-panel{
            height: 100%;
            min-height: 0;
            border-radius: 14px;
          }
          .chat-panel.compact{
            height: 100%;
            min-height: 0;
          }
          .chat-panel.compact .chat-list{
            min-height: 0;
          }
          .chat-head{
            padding: 10px;
          }
          .chat-head h3{
            font-size: 14px;
            max-width: 68%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .chat-voice-row{
            padding: 8px;
            gap: 6px;
          }
          .chat-chip{
            padding: 6px 9px;
            font-size: 10px;
          }
          .chat-msg{
            max-width: 92%;
          }
          .chat-panel.insta .chat-msg{
            max-width: 86%;
          }
          .chat-ctrl{
            padding: 8px;
            gap: 6px;
          }
          .chat-ctrl textarea{
            min-height: 42px;
          }
          .chat-panel.insta .chat-ctrl{
            padding:8px;
          }
          .chat-panel.insta .chat-btn{
            min-width:64px;
            padding:10px;
          }
        }
        .voice-mini{
          margin-left:auto;
          font-size:11px;
          font-weight:700;
          color:${isSpeaking ? "#7d8f00" : "#667"};
        }
      `}</style>
      <div className="chat-head">
        <h3>{title}</h3>
        <div className="chat-pres">{presenceText}</div>
      </div>
      {showControls && (
      <div className="chat-voice-row">
        <button className={`chat-chip ${voiceOn ? "on" : ""}`} onClick={() => setVoiceOn((v) => !v)}>
          {voiceOn ? "Voice ON" : "Voice OFF"} · {voiceLabel}
        </button>
        <button className={`chat-chip ${micOn ? "on" : ""}`} onClick={recognizeSpeech}>
          {micOn ? "Listening..." : "Mic Input"}
        </button>
        <button
          className="chat-chip"
          onClick={() => {
            const latest = messages[messages.length - 1];
            if (latest?.message) speakNow(latest.message);
          }}
        >
          Read Last Update
        </button>
        <button className="chat-chip" onClick={clearChat}>
          Clear Chat
        </button>
        <span className="chat-meta">voice status: {voiceStatus}</span>
        {voiceOn ? <span className="voice-mini">{isSpeaking ? "Voice AI speaking..." : "Voice AI ready"}</span> : null}
      </div>
      )}
      <div className="chat-list" ref={listRef}>
        {loading && <div className="chat-meta">Loading...</div>}
        {!loading && messages.length === 0 && (
          <div className="chat-meta">No messages yet.</div>
        )}
        {messages.map((m) => {
          const mine = m.sender_role === role;
          return (
            <div key={m.id} className={`chat-msg ${mine ? "mine" : "other"}`}>
              <div><b>{m.sender_name || m.sender_role}</b></div>
              <div>{m.message}</div>
              <div className="chat-meta">
                {new Date(m.created_at).toLocaleTimeString()} {mine ? "· sent" : ""}
              </div>
            </div>
          );
        })}
      </div>
      {extraActions ? <div className="chat-ctrl">{extraActions}</div> : null}
      {canSend && (
        <div className="chat-ctrl">
          <textarea
            value={draft}
            onChange={(e) => onTyping(e.target.value)}
            placeholder={instagramMode ? "Message..." : "Type message..."}
          />
          <button
            className="chat-btn"
            disabled={sending || !draft.trim()}
            onClick={() => sendMessage(draft, "text")}
          >
            {instagramMode ? (sending ? "..." : "➤") : (sending ? "Sending..." : "Send")}
          </button>
        </div>
      )}
    </div>
  );
}

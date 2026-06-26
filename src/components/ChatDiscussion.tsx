import { useEffect, useRef } from "react";
import { FeatureRequestMessage } from "@/lib/types";
import { Textarea } from "@/components/ui";

interface ChatDiscussionProps {
  messages: FeatureRequestMessage[];
  currentRole: "client" | "admin";
  body: string;
  setBody: (body: string) => void;
  sendMessage: () => void;
  sending: boolean;
}

export function ChatDiscussion({
  messages,
  currentRole,
  body,
  setBody,
  sendMessage,
  sending,
}: ChatDiscussionProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mt-8 border-4 border-border-strong bg-bg-panel shadow-[8px_8px_0px_0px_var(--border-strong)] flex flex-col h-[500px]">
      {/* Header */}
      <div className="bg-bg-panel-alt border-b-4 border-border-strong px-5 py-4 flex items-center justify-between">
        <h4 className="font-label-caps text-label-caps uppercase tracking-widest text-text-main font-black flex items-center gap-3">
          <span className="material-symbols-outlined text-coral-red">forum</span>
          Direct Comm Channel
        </h4>
        <span className="font-data-mono text-[10px] text-coral-red bg-coral-red/10 px-2 py-1 border border-coral-red uppercase font-bold animate-pulse">
          Live
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-bg-base scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <span className="material-symbols-outlined text-6xl mb-4">chat_bubble</span>
            <p className="font-data-mono text-sm uppercase tracking-widest font-bold">
              Awaiting Transmission
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_role === currentRole;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] relative group ${
                    isMine
                      ? "bg-coral-red text-white border-coral-red"
                      : "bg-bg-panel-alt text-text-main border-border-strong"
                  } border-2 p-4 shadow-[4px_4px_0px_0px_var(--border-strong)] transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--border-strong)]`}
                  style={{
                    borderBottomRightRadius: isMine ? "0px" : "16px",
                    borderBottomLeftRadius: !isMine ? "0px" : "16px",
                    borderTopLeftRadius: "16px",
                    borderTopRightRadius: "16px",
                  }}
                >
                  <div
                    className={`flex justify-between items-end mb-2 gap-6 border-b pb-2 ${
                      isMine ? "border-white/20" : "border-border-subtle"
                    }`}
                  >
                    <span
                      className={`font-data-mono text-xs uppercase tracking-widest font-bold ${
                        isMine ? "text-white" : "text-coral-red"
                      }`}
                    >
                      {m.sender_role}
                    </span>
                    <span
                      className={`font-data-mono text-[10px] uppercase tracking-wider ${
                        isMine ? "text-white/80" : "text-text-muted"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-body-md leading-relaxed whitespace-pre-wrap break-words">
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-bg-panel-alt border-t-4 border-border-strong p-4 flex gap-3 items-end">
        <Textarea
          rows={1}
          className="flex-1 max-h-32 shadow-[4px_4px_0px_0px_var(--border-strong)] py-3 px-4"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Transmit message... (Enter to send)"
          style={{ minHeight: "52px", resize: "none" }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={sending || !body.trim()}
          className="bg-coral-red text-white h-[52px] px-6 border-2 border-border-strong flex items-center justify-center hover:bg-bg-panel-alt hover:text-coral-red transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_var(--border-strong)] active:translate-y-1 active:translate-x-1 active:shadow-none"
        >
          <span className={`material-symbols-outlined text-2xl ${sending ? "animate-spin" : ""}`}>
            {sending ? "sync" : "send"}
          </span>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, Send, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AgentChatResponse, SessionSummary } from "@/features/ai-agent/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AgentChatResponse["action"];
  timestamp: Date;
}

function AIAgentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setConfirmingAction(null);

    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(sessionId ? { sessionId } : {}),
          message: text,
          mode: "act",
        }),
      });

      const json = await res.json();

      if (json.success) {
        const data = json.data as AgentChatResponse;

        if (!sessionId) {
          setSessionId(data.sessionId);
          loadSessions();
        }

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message.content,
          action: data.action,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (data.action?.status === "awaiting_confirmation") {
          setConfirmingAction(data.action.actionId);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: json.error ?? "Sorry, something went wrong.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Network error. Please check your connection.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (actionId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionId }),
      });
      const json = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `confirm-${Date.now()}`,
          role: "assistant",
          content: json.success
            ? "✅ Action completed successfully!"
            : `❌ ${json.error ?? "Action failed"}`,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `fail-${Date.now()}`,
          role: "assistant",
          content: "❌ Network error during confirmation.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setConfirmingAction(null);
      setLoading(false);
    }
  };

  const handleCancel = async (actionId: string) => {
    try {
      await fetch("/api/ai-agent/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionId }),
      });
    } catch {}
    setConfirmingAction(null);
  };

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/ai-agent/chat", { credentials: "include" });
      const json = await res.json();
      if (json.success) setSessions(json.data.sessions ?? []);
    } catch {}
  };

  const loadSession = async (sid: string) => {
    try {
      const res = await fetch(`/api/ai-agent/sessions/${sid}`, { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setSessionId(sid);
        setMessages(
          (json.data.messages ?? [])
            .filter((m: any) => m.role !== "system")
            .map((m: any) => ({
              id: m.messageId,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.createdAt),
            })),
        );
        setShowSessions(false);
      }
    } catch {}
  };

  const newSession = () => {
    setSessionId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Hello! I'm your AI assistant. I can help you manage the school system. What would you like to do?",
        timestamp: new Date(),
      },
    ]);
    setShowSessions(false);
  };

  useEffect(() => {
    loadSessions();
    newSession();
  }, []);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Session Sidebar */}
      <div className="hidden w-64 flex-col rounded-xl border border-secondary-200 bg-white lg:flex">
        <div className="flex items-center justify-between border-b border-secondary-200 p-3">
          <h3 className="text-sm font-semibold text-secondary-900">Sessions</h3>
          <button
            onClick={newSession}
            className="rounded-lg p-1.5 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => loadSession(s.sessionId)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                s.sessionId === sessionId
                  ? "bg-primary-50 text-primary-700"
                  : "text-secondary-600 hover:bg-secondary-50",
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.title}</span>
              </div>
              <p className="mt-0.5 text-xs text-secondary-400">
                {s.messageCount} messages · {s.status}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col rounded-xl border border-secondary-200 bg-white">
        {/* Welcome Header */}
        {messages.length <= 1 && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl bg-primary-50 p-4">
              <Bot className="h-12 w-12 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-secondary-900">AI Assistant</h2>
            <p className="mt-2 max-w-md text-sm text-secondary-500">
              Ask me anything about your school — students, attendance, fees, reports, and more.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "Show my class attendance this week",
                "Who are the fee defaulters?",
                "Generate a lesson plan for Grade 4 Math",
                "Record payment for ADM001",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => sendMessage(), 100);
                  }}
                  className="rounded-full border border-secondary-200 bg-secondary-50 px-4 py-2 text-xs text-secondary-600 transition-colors hover:bg-secondary-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.slice(1).map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-secondary-100 text-secondary-800",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.action?.status === "awaiting_confirmation" && (
                    <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        Risk level: {msg.action.riskLevel}
                      </div>
                      {msg.action.preview && Object.keys(msg.action.preview).length > 0 && (
                        <pre className="text-xs text-amber-800">
                          {JSON.stringify(msg.action.preview, null, 2)}
                        </pre>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleConfirm(msg.action!.actionId)}
                          disabled={loading}
                        >
                          Confirm Action
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(msg.action!.actionId)}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-secondary-100 px-4 py-2.5 text-sm text-secondary-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-secondary-200 p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask me anything..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm placeholder:text-secondary-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AIAgentPage };

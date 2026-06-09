"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, AlertTriangle, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AgentChatResponse } from "@/features/ai-agent/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: AgentChatResponse["action"];
  timestamp: Date;
}

interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function AIAgentPanel({ isOpen, onClose }: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI assistant. I can help you find information, answer questions, and perform tasks. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

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
          sessionId,
          message: text,
          mode: "assist",
        }),
      });

      const json = await res.json();

      if (json.success) {
        const data = json.data as AgentChatResponse;

        if (!sessionId) setSessionId(data.sessionId);

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
            content: json.error ?? "Sorry, something went wrong. Please try again.",
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
          content: "Network error. Please check your connection and try again.",
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

      if (json.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `confirm-${Date.now()}`,
            role: "assistant",
            content: "✅ Action completed successfully!",
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `fail-${Date.now()}`,
            role: "assistant",
            content: `❌ ${json.error ?? "Action failed"}`,
            timestamp: new Date(),
          },
        ]);
      }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 320 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 320 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-y-0 right-0 z-modal flex w-full flex-col border-l border-secondary-200 bg-white shadow-xl sm:w-[400px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-secondary-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary-100 p-1.5 text-primary-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-secondary-900">AI Assistant</h2>
                <p className="text-xs text-secondary-500">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-secondary-100 text-secondary-800",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.action?.status === "awaiting_confirmation" && (
                    <div className="mt-3 space-y-2">
                      {msg.action.riskLevel && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Risk level: {msg.action.riskLevel}
                        </div>
                      )}
                      {msg.action.preview && Object.keys(msg.action.preview).length > 0 && (
                        <div className="rounded-lg border border-secondary-200 bg-white/50 p-2 text-xs">
                          <pre className="whitespace-pre-wrap text-secondary-600">
                            {JSON.stringify(msg.action.preview, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleConfirm(msg.action!.actionId)}
                          disabled={loading}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Confirm
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

          {/* Input */}
          <div className="border-t border-secondary-200 p-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2.5 text-sm placeholder:text-secondary-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { AIAgentPanel };

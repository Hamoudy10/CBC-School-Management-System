"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface Message {
  message_id?: string;
  id?: string;
  subject?: string;
  body?: string;
  content?: string;
  is_read?: boolean;
  read_status?: boolean;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
  } | null;
  recipient?: {
    first_name: string;
    last_name: string;
  } | null;
}

export function MessagesList() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/communication/messages");
      if (!res.ok) {
        throw new Error("Failed to fetch messages");
      }
      const json = await res.json();
      setMessages(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
        <div className="text-sm text-gray-500">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchMessages();
              }}
              className="mt-2 text-sm font-medium text-red-800 underline"
            >
              Try again
            </button>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-2 text-sm text-gray-500">Loading messages...</p>
          </div>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && messages.length === 0 && (
        <EmptyState
          title="No messages"
          description="Your inbox is empty. Messages from other users will appear here."
        />
      )}

      {/* Messages List */}
      {!loading && messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg) => (
            <Card key={msg.message_id || msg.id}>
              <div
                className={`p-4 ${(msg.is_read === false || msg.read_status === false) ? "border-l-4 border-l-blue-500" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {msg.subject || "No Subject"}
                      </h3>
                      {(msg.is_read === false || msg.read_status === false) && (
                        <Badge variant="info">Unread</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {msg.body || msg.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      {msg.sender && (
                        <span>
                          From: {msg.sender.first_name} {msg.sender.last_name}
                        </span>
                      )}
                      {msg.recipient && (
                        <span>
                          To: {msg.recipient.first_name}{" "}
                          {msg.recipient.last_name}
                        </span>
                      )}
                      <span>
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

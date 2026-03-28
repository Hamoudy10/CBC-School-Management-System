"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";

interface MessageSummary {
  message_id?: string;
  id?: string;
  sender_id?: string;
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
  recipient_summary?: string | null;
  recipient_count?: number;
}

interface MessageRecipient {
  id?: string;
  recipient_id?: string;
  read_status?: boolean;
  recipient?: {
    first_name?: string;
    last_name?: string;
  } | null;
}

interface MessageDetail {
  id: string;
  sender_id?: string;
  subject?: string;
  body?: string;
  created_at: string;
  sender?: {
    first_name?: string;
    last_name?: string;
  } | null;
  recipients?: MessageRecipient[] | null;
}

interface RecipientOption {
  id: string;
  name?: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface RecipientLookupResponse {
  users: RecipientOption[];
  roles: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
}

type Folder = "inbox" | "sent";
type RecipientType = "user" | "role" | "class";

const priorityOptions = ["normal", "high", "urgent"] as const;

export function MessagesList() {
  const { user, checkPermission } = useAuth();
  const canCompose = checkPermission("communication", "create");
  const canDelete = checkPermission("communication", "delete");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState<RecipientLookupResponse>({
    users: [],
    roles: [],
    classes: [],
  });
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeSuccess, setComposeSuccess] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState<RecipientType>("user");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]>("normal");

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        folder,
        pageSize: "50",
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const res = await fetch(`/api/communication/messages?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to fetch messages");
      }
      setMessages(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const fetchRecipients = useCallback(async () => {
    if (
      !canCompose ||
      recipientOptions.users.length > 0 ||
      recipientOptions.roles.length > 0 ||
      recipientOptions.classes.length > 0
    ) {
      return;
    }

    try {
      setRecipientsLoading(true);
      const res = await fetch("/api/communication/messages/recipients");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load recipients");
      }
      setRecipientOptions(
        json.data || {
          users: [],
          roles: [],
          classes: [],
        },
      );
    } catch (err) {
      setComposeError(
        err instanceof Error ? err.message : "Failed to load recipients",
      );
    } finally {
      setRecipientsLoading(false);
    }
  }, [canCompose, recipientOptions]);

  const openCompose = useCallback(
    (prefill?: {
      recipientIds?: string[];
      recipientType?: RecipientType;
      subject?: string;
      body?: string;
    }) => {
      setComposeError(null);
      setComposeSuccess(null);
      setRecipientType(prefill?.recipientType ?? "user");
      setSelectedRecipientIds(prefill?.recipientIds ?? []);
      setSubject(prefill?.subject ?? "");
      setBody(prefill?.body ?? "");
      setPriority("normal");
      setComposeOpen(true);
      fetchRecipients();
    },
    [fetchRecipients],
  );

  const openMessage = useCallback(async (messageId: string) => {
    try {
      setDetailLoading(true);
      setDetailError(null);
      const res = await fetch(`/api/communication/messages/${messageId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load message");
      }
      setDetail(json.data);
      fetchMessages();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load message");
    } finally {
      setDetailLoading(false);
    }
  }, [fetchMessages]);

  const handleSend = async () => {
    if (selectedRecipientIds.length === 0 || !subject.trim() || !body.trim()) {
      setComposeError("Recipient, subject, and message body are required.");
      return;
    }

    try {
      setSending(true);
      setComposeError(null);
      setComposeSuccess(null);

      const res = await fetch("/api/communication/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          priority,
          category: "general",
          recipients: selectedRecipientIds.map((recipientId) => ({
            recipient_id: recipientId,
            recipient_type: recipientType,
          })),
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to send message");
      }

      setComposeSuccess("Message sent successfully.");
      setSubject("");
      setBody("");
      setSelectedRecipientIds([]);
      if (folder === "sent") {
        fetchMessages();
      }
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/communication/messages/read-all", {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to mark messages as read");
      }
      fetchMessages();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark messages as read",
      );
    }
  };

  const handleDeleteMessage = async () => {
    if (!detail?.id) {
      return;
    }

    try {
      setDeleting(true);
      setDetailError(null);

      const res = await fetch(`/api/communication/messages/${detail.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete message");
      }

      setDetail(null);
      await fetchMessages();
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Failed to delete message",
      );
    } finally {
      setDeleting(false);
    }
  };

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (msg) => msg.is_read === false || msg.read_status === false,
      ).length,
    [messages],
  );

  const selectedRecipientLabel = useMemo(() => {
    if (recipientType === "user") {
      return recipientOptions.users.filter((option) =>
        selectedRecipientIds.includes(option.id),
      );
    }

    const source =
      recipientType === "role" ? recipientOptions.roles : recipientOptions.classes;
    return source.filter((option) => selectedRecipientIds.includes(option.id));
  }, [recipientOptions, recipientType, selectedRecipientIds]);

  const availableRecipientOptions =
    recipientType === "user"
      ? recipientOptions.users.map((option) => ({
          id: option.id,
          label: `${option.first_name} ${option.last_name} - ${option.role}`,
        }))
      : recipientType === "role"
        ? recipientOptions.roles.map((option) => ({
            id: option.id,
            label: option.name,
          }))
        : recipientOptions.classes.map((option) => ({
            id: option.id,
            label: option.name,
          }));
  const canReplyToDetail =
    canCompose &&
    folder === "inbox" &&
    !!detail?.sender_id &&
    detail.sender_id !== user?.id &&
    detail.sender_id !== user?.user_id;
  const canDeleteDetail = canDelete && folder === "inbox" && !!detail?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFolder("inbox")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${folder === "inbox" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Inbox
            {unreadCount > 0 && folder === "inbox" ? (
              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setFolder("sent")}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${folder === "sent" ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Sent
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${folder} messages`}
            className="w-64"
          />
          {folder === "inbox" && unreadCount > 0 ? (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              Mark All Read
            </Button>
          ) : null}
          {canCompose ? (
            <Button onClick={() => openCompose()}>Compose</Button>
          ) : null}
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {loading ? (
        <Card>
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-2 text-sm text-gray-500">Loading messages...</p>
          </div>
        </Card>
      ) : messages.length === 0 ? (
        <EmptyState
          title={folder === "inbox" ? "No messages" : "No sent messages"}
          description={
            folder === "inbox"
              ? "Your inbox is empty."
              : "Messages you send will appear here."
          }
          action={
            canCompose && folder === "sent"
              ? { label: "Compose Message", onClick: () => openCompose() }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => {
            const id = msg.message_id || msg.id || "";
            const isUnread = msg.is_read === false || msg.read_status === false;

            return (
              <Card key={id}>
                <button
                  type="button"
                  onClick={() => openMessage(id)}
                  className={`w-full p-4 text-left ${isUnread && folder === "inbox" ? "border-l-4 border-l-blue-500 bg-blue-50/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {msg.subject || "No Subject"}
                        </h3>
                        {isUnread && folder === "inbox" ? (
                          <Badge variant="info">Unread</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {msg.body || msg.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        {folder === "inbox" && msg.sender ? (
                          <span>
                            From: {msg.sender.first_name} {msg.sender.last_name}
                          </span>
                        ) : null}
                        {folder === "sent" && msg.recipient ? (
                          <span>
                            To:{" "}
                            {(msg as any).recipient_summary ??
                              `${msg.recipient.first_name} ${msg.recipient.last_name}`}
                          </span>
                        ) : null}
                        <span>{formatDate(msg.created_at)}</span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-blue-600">Open</span>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Compose Message</ModalTitle>
          <ModalDescription>
            Send a message to selected users, roles, or classes in your school.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {composeError ? <Alert variant="destructive">{composeError}</Alert> : null}
          {composeSuccess ? <Alert variant="success">{composeSuccess}</Alert> : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Recipient Type</span>
            <select
              value={recipientType}
              onChange={(event) => {
                setRecipientType(event.target.value as RecipientType);
                setSelectedRecipientIds([]);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="user">Users</option>
              <option value="role">Roles</option>
              <option value="class">Classes</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Recipients</span>
            <select
              multiple
              value={selectedRecipientIds}
              onChange={(event) =>
                setSelectedRecipientIds(
                  Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  ),
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              size={Math.min(8, Math.max(4, availableRecipientOptions.length || 4))}
            >
              {availableRecipientOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Hold Ctrl or Cmd to select more than one recipient.
            </p>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Subject</span>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Message subject"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Priority</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as (typeof priorityOptions)[number])
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Message</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={7}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Write your message"
            />
          </label>

          {selectedRecipientLabel.length > 0 ? (
            <p className="text-xs text-gray-500">
              Sending to{" "}
              {selectedRecipientLabel
                .map((recipient: any) =>
                  recipient.name
                    ? recipient.name
                    : `${recipient.first_name} ${recipient.last_name}`.trim(),
                )
                .join(", ")}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setComposeOpen(false)} disabled={sending}>
            Close
          </Button>
          <Button onClick={handleSend} loading={sending} disabled={recipientsLoading}>
            Send Message
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!detail || detailLoading || !!detailError} onClose={() => {
        setDetail(null);
        setDetailError(null);
      }} size="lg">
        <ModalHeader>
          <ModalTitle>{detail?.subject || "Message Details"}</ModalTitle>
          <ModalDescription>
            Review full message content and take the relevant inbox action.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {detailLoading ? (
            <p className="text-sm text-gray-500">Loading message...</p>
          ) : null}
          {detailError ? <Alert variant="destructive">{detailError}</Alert> : null}
          {detail ? (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {detail.sender ? (
                  <span>
                    From: {detail.sender.first_name} {detail.sender.last_name}
                  </span>
                ) : null}
                <span>{formatDate(detail.created_at, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}</span>
              </div>
              {detail.recipients && detail.recipients.length > 0 ? (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  To:{" "}
                  {detail.recipients
                    .map((recipient) =>
                      `${recipient.recipient?.first_name ?? ""} ${recipient.recipient?.last_name ?? ""}`.trim(),
                    )
                    .filter(Boolean)
                    .join(", ")}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap rounded-lg border border-gray-200 p-4 text-sm text-gray-800">
                {detail.body}
              </div>
            </>
          ) : null}
        </ModalBody>
        <ModalFooter>
          {canDeleteDetail ? (
            <Button
              variant="danger"
              onClick={handleDeleteMessage}
              loading={deleting}
            >
              Delete
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => {
              setDetail(null);
              setDetailError(null);
            }}
            disabled={deleting}
          >
            Close
          </Button>
          {canReplyToDetail && detail?.sender ? (
            <Button
              onClick={() => {
                setDetail(null);
                openCompose({
                  recipientIds: detail.sender_id ? [detail.sender_id] : [],
                  recipientType: "user",
                  subject: detail.subject ? `Re: ${detail.subject}` : "Re:",
                  body:
                    `\n\n--- Original message ---\n${detail.body ?? ""}`,
                });
              }}
              disabled={deleting}
            >
              Reply
            </Button>
          ) : null}
        </ModalFooter>
      </Modal>
    </div>
  );
}

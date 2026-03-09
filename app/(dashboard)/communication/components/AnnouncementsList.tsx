"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";

interface Announcement {
  announcement_id?: string;
  id?: string;
  title: string;
  body?: string;
  content?: string;
  priority?: string;
  status?: string;
  target_audience?: string;
  created_at: string;
  author?: {
    first_name: string;
    last_name: string;
  } | null;
}

export function AnnouncementsList() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/communication/announcements");
      if (!res.ok) {
        throw new Error("Failed to fetch announcements");
      }
      const json = await res.json();
      setAnnouncements(json.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load announcements",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/communication/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: content.trim(),
          category: "announcement",
          priority,
          publish_date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create announcement");
      }

      setTitle("");
      setContent("");
      setPriority("normal");
      setShowForm(false);
      fetchAnnouncements();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create announcement",
      );
    } finally {
      setCreating(false);
    }
  };

  const getPriorityVariant = (p?: string) => {
    switch (p) {
      case "high":
      case "urgent":
        return "danger" as const;
      case "medium":
        return "warning" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Announcement"}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <div className="p-4">
            <h3 className="mb-4 text-md font-semibold text-gray-900">
              Create Announcement
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Title *
                </label>
                <Input
                  type="text"
                  placeholder="Announcement title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Content *
                </label>
                <textarea
                  placeholder="Announcement content..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Announcement"}
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card>
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchAnnouncements();
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
            <p className="mt-2 text-sm text-gray-500">
              Loading announcements...
            </p>
          </div>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && announcements.length === 0 && (
        <EmptyState
          title="No announcements"
          description="Create your first announcement to communicate with the school community."
          action={
            !showForm
              ? { label: "New Announcement", onClick: () => setShowForm(true) }
              : undefined
          }
        />
      )}

      {/* Announcements List */}
      {!loading && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.announcement_id || a.id}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      {a.priority && a.priority !== "normal" && (
                        <Badge variant={getPriorityVariant(a.priority)}>
                          {a.priority}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {a.body || a.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      {a.author && (
                        <span>
                          By {a.author.first_name} {a.author.last_name}
                        </span>
                      )}
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                      {a.target_audience && (
                        <Badge variant="default">{a.target_audience}</Badge>
                      )}
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

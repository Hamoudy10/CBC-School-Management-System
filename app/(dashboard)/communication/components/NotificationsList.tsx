'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface Notification {
  notification_id?: string;
  id?: string;
  title?: string;
  body?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  read_status?: boolean;
  created_at: string;
}

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/communication/notifications');
      if (!res.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const json = await res.json();
      setNotifications(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/communication/notifications/${id}/read`, {
        method: 'PUT',
      });
      setNotifications((prev) =>
        prev.map((n) =>
          (n.notification_id || n.id) === id
            ? { ...n, is_read: true, read_status: true }
            : n
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const getTypeVariant = (type?: string) => {
    switch (type) {
      case 'error':
      case 'alert':
        return 'danger' as const;
      case 'warning':
        return 'warning' as const;
      case 'success':
        return 'success' as const;
      case 'info':
        return 'info' as const;
      default:
        return 'default' as const;
    }
  };

  const unreadCount = notifications.filter(
    (n) => !(n.is_read ?? n.read_status)
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="info">{unreadCount} unread</Badge>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => { setError(null); fetchNotifications(); }}
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
            <p className="mt-2 text-sm text-gray-500">Loading notifications...</p>
          </div>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          title="No notifications"
          description="You're all caught up! New notifications will appear here."
        />
      )}

      {/* Notifications List */}
      {!loading && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => {
            const nId = n.notification_id || n.id || '';
            return (
              <Card key={nId}>
                <div
                  className={`p-4 ${!(n.is_read ?? n.read_status) ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {n.title || 'Notification'}
                        </h3>
                        {n.type && (
                          <Badge variant={getTypeVariant(n.type)}>{n.type}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {n.body || n.message}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!(n.is_read ?? n.read_status) && (
                      <button
                        onClick={() => markAsRead(nId)}
                        className="ml-3 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

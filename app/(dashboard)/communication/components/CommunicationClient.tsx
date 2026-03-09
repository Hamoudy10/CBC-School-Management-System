'use client';

import dynamic from 'next/dynamic';
import { startTransition, useState, useTransition } from 'react';
import { RouteLoading } from '@/components/ui/RouteLoading';

const AnnouncementsList = dynamic(
  () => import('./AnnouncementsList').then((mod) => mod.AnnouncementsList),
  {
    loading: () => <RouteLoading label="Loading announcements..." />,
  }
);

const MessagesList = dynamic(
  () => import('./MessagesList').then((mod) => mod.MessagesList),
  {
    loading: () => <RouteLoading label="Loading messages..." />,
  }
);

const NotificationsList = dynamic(
  () => import('./NotificationsList').then((mod) => mod.NotificationsList),
  {
    loading: () => <RouteLoading label="Loading notifications..." />,
  }
);

type TabType = 'announcements' | 'messages' | 'notifications';

const tabs: { key: TabType; label: string }[] = [
  { key: 'announcements', label: 'Announcements' },
  { key: 'messages', label: 'Messages' },
  { key: 'notifications', label: 'Notifications' },
];

export function CommunicationClient() {
  const [activeTab, setActiveTab] = useState<TabType>('announcements');
  const [isPending, startTabTransition] = useTransition();

  const handleTabChange = (tab: TabType) => {
    startTabTransition(() => {
      startTransition(() => {
        setActiveTab(tab);
      });
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {isPending && activeTab !== tab.key ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                ) : null}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'announcements' && <AnnouncementsList />}
      {activeTab === 'messages' && <MessagesList />}
      {activeTab === 'notifications' && <NotificationsList />}
    </div>
  );
}

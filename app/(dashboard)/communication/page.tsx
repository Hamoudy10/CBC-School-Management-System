import { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommunicationClient } from './components/CommunicationClient';

export const metadata: Metadata = {
  title: 'Communication',
  description: 'Manage announcements, messages, and notifications',
};

export default function CommunicationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        description="Manage announcements, messages, and notifications"
      />
      <CommunicationClient />
    </div>
  );
}

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommunicationClient } from './components/CommunicationClient';

export const metadata: Metadata = {
  title: 'Communication',
  description: 'Manage announcements, messages, and notifications',
};

export default async function CommunicationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
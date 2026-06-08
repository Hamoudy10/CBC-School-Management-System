'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  MessageSquareText,
  GraduationCap,
  Brain,
  AlertTriangle,
  CheckSquare,
  DollarSign,
  Calendar,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface AIToolCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: string;
}

const tools: AIToolCard[] = [
  {
    title: 'Adaptive Homework',
    description: 'Generate personalized worksheets targeting weak CBC competencies',
    icon: <BookOpen className="h-6 w-6" />,
    href: '/assessments/adaptive-homework',
    color: 'bg-blue-100 text-blue-600',
    badge: 'New',
  },
  {
    title: 'Curriculum Alignment',
    description: 'Check lesson plans against KICD CBC standards',
    icon: <CheckSquare className="h-6 w-6" />,
    href: '/academics/curriculum-alignment',
    color: 'bg-green-100 text-green-600',
    badge: 'New',
  },
  {
    title: 'Fee Predictor',
    description: 'Analyze payment patterns and predict default risk',
    icon: <DollarSign className="h-6 w-6" />,
    href: '/finance/fee-predictor',
    color: 'bg-emerald-100 text-emerald-600',
    badge: 'New',
  },
  {
    title: 'Early Warning System',
    description: 'Multi-signal risk detection for at-risk students',
    icon: <AlertTriangle className="h-6 w-6" />,
    href: '/analytics/early-warning',
    color: 'bg-amber-100 text-amber-600',
    badge: 'New',
  },
  {
    title: 'Timetable Optimizer',
    description: 'AI-assisted conflict-free timetable suggestions',
    icon: <Calendar className="h-6 w-6" />,
    href: '/timetable/optimizer',
    color: 'bg-purple-100 text-purple-600',
    badge: 'New',
  },
  {
    title: 'SMS & WhatsApp',
    description: 'Send fee reminders, attendance alerts, and notices via Africa\'s Talking',
    icon: <MessageSquareText className="h-6 w-6" />,
    href: '/communication/send',
    color: 'bg-cyan-100 text-cyan-600',
    badge: 'New',
  },
  {
    title: 'Parent Chatbot',
    description: 'Multi-channel bot that answers parent queries in real-time',
    icon: <Brain className="h-6 w-6" />,
    href: '/communication/chatbot',
    color: 'bg-indigo-100 text-indigo-600',
    badge: 'New',
  },
  {
    title: 'Voice Mark Entry',
    description: 'Dictate assessment scores using your microphone',
    icon: <GraduationCap className="h-6 w-6" />,
    href: '/assessments/voice',
    color: 'bg-rose-100 text-rose-600',
  },
];

export default function AIToolsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Tools"
        description="AI-powered features for CBC school management"
        icon={<Sparkles className="h-6 w-6" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((tool) => (
          <button
            key={tool.href}
            type="button"
            onClick={() => router.push(tool.href)}
            className="group text-left"
          >
            <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div className={cn('rounded-xl p-2.5', tool.color)}>
                    {tool.icon}
                  </div>
                  {tool.badge && (
                    <Badge variant="info" size="xs">{tool.badge}</Badge>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {tool.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface FilterOption<T = string> {
  value: T;
  label: string;
  stream?: string | null;
}

interface ReportsFiltersProps {
  terms: FilterOption[];
  classes: FilterOption[];
  students: Array<{
    student_id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
  }>;
}

export default function ReportsFilters({ terms, classes, students }: ReportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = {
    term: searchParams.get('term') ?? '',
    class: searchParams.get('class') ?? '',
    student: searchParams.get('student') ?? '',
    status: searchParams.get('status') ?? '',
    reportType: searchParams.get('reportType') ?? '',
    search: searchParams.get('search') ?? '',
  };

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.push(pathname);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400" />
        <input
          type="text"
          placeholder="Search by student name or admission..."
          value={current.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="block w-full rounded-lg border border-secondary-300 bg-white pl-10 pr-3 py-2 text-sm text-secondary-900 placeholder-secondary-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      {/* Filter Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-600">Term</label>
          <select
            value={current.term}
            onChange={(e) => setFilter('term', e.target.value)}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Terms</option>
            {terms.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-600">Class</label>
          <select
            value={current.class}
            onChange={(e) => setFilter('class', e.target.value)}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}{c.stream ? ` ${c.stream}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-600">Student</label>
          <select
            value={current.student}
            onChange={(e) => setFilter('student', e.target.value)}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Students</option>
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.first_name} {s.last_name} &middot; {s.admission_number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-600">Status</label>
          <select
            value={current.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary-600">Report Type</label>
          <select
            value={current.reportType}
            onChange={(e) => setFilter('reportType', e.target.value)}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Types</option>
            <option value="term">Term</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={resetFilters}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}

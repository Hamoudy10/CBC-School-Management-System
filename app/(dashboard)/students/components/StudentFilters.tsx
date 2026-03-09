// app/(dashboard)/students/components/StudentFilters.tsx
'use client';

import React from 'react';
import { Search, RotateCcw, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StudentFilters as StudentFiltersType } from '@/features/students';

interface ClassOption {
  classId: string;
  name: string;
  gradeId?: string;
  gradeName?: string;
}

interface GradeOption {
  gradeId: string;
  name: string;
}

interface StudentFiltersProps {
  filters: StudentFiltersType;
  onFiltersChange: (filters: StudentFiltersType) => void;
  onReset: () => void;
  classes: ClassOption[];
  grades: GradeOption[];
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Transferred', value: 'transferred' },
  { label: 'Graduated', value: 'graduated' },
  { label: 'Withdrawn', value: 'withdrawn' },
  { label: 'Suspended', value: 'suspended' },
];

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

export function StudentFilters({
  filters,
  onFiltersChange,
  onReset,
  classes,
  grades,
  isLoading,
}: StudentFiltersProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleFilterChange = (key: keyof StudentFiltersType, value: any) => {
    onFiltersChange({ ...filters, [key]: value === '' ? undefined : value });
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <Input
                placeholder="Search by name or admission number..."
                value={filters.search || ''}
                onChange={handleSearchChange}
                leftIcon={<Search className="h-4 w-4" />}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsExpanded(!isExpanded)}
                className="relative"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge
                    variant="primary"
                    className="ml-2 h-5 w-5 justify-center rounded-full p-0 text-[10px]"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={onReset} size="sm">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary-500">
                  Grade / Level
                </label>
                <Select
                  value={filters.gradeId || ''}
                  onChange={(val) => handleFilterChange('gradeId', val)}
                >
                  <option value="">All Grades</option>
                  {grades.map((g) => (
                    <option key={g.gradeId} value={g.gradeId}>
                      {g.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary-500">
                  Class
                </label>
                <Select
                  value={filters.classId || ''}
                  onChange={(val) => handleFilterChange('classId', val)}
                >
                  <option value="">All Classes</option>
                  {classes
                    .filter((c) => !filters.gradeId || c.gradeId === filters.gradeId)
                    .map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary-500">
                  Status
                </label>
                <Select
                  value={filters.status || ''}
                  onChange={(val) => handleFilterChange('status', val)}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-secondary-500">
                  Gender
                </label>
                <Select
                  value={filters.gender || ''}
                  onChange={(val) => handleFilterChange('gender', val)}
                >
                  <option value="">All Genders</option>
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center gap-4 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="filter-special-needs"
                    checked={!!filters.hasSpecialNeeds}
                    onChange={(e) =>
                      handleFilterChange('hasSpecialNeeds', e.target.checked || undefined)
                    }
                    className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="filter-special-needs"
                    className="text-sm text-secondary-700"
                  >
                    Special Needs Only
                  </label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {Object.entries(filters).map(([key, value]) => {
            if (!value || key === 'search') return null;
            
            let label = String(value);
            if (key === 'gradeId') label = grades.find(g => g.gradeId === value)?.name || label;
            if (key === 'classId') label = classes.find(c => c.classId === value)?.name || label;
            if (key === 'hasSpecialNeeds') label = 'Special Needs';
            
            return (
              <Badge
                key={key}
                variant="default"
                className="flex items-center gap-1 py-1"
              >
                <span className="text-xs font-normal text-secondary-500 capitalize">
                  {key.replace(/([A-Z])/g, ' $1')}:
                </span>
                {label}
                <button
                  onClick={() => handleFilterChange(key as any, undefined)}
                  className="ml-1 rounded-full p-0.5 hover:bg-secondary-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

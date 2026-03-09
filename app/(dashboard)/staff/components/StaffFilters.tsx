// app/(dashboard)/staff/components/StaffFilters.tsx
// ============================================================
// Staff Filters — Client Component
// Search, position, status, and contract type filters
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  STAFF_POSITION_LABELS,
  STAFF_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
} from '@/features/staff';
import { useDebouncedCallback } from '@/hooks/useDebounce';

// ============================================================
// Types
// ============================================================
interface StaffFiltersProps {
  initialFilters: {
    search: string;
    position: string;
    status: string;
    contractType: string;
  };
}

// ============================================================
// Main Component
// ============================================================
export function StaffFilters({ initialFilters }: StaffFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [search, setSearch] = useState(initialFilters.search);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initialFilters.position || initialFilters.status || initialFilters.contractType)
  );

  // Update URL with new params
  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      
      const newFilters = {
        search,
        position: initialFilters.position,
        status: initialFilters.status,
        contractType: initialFilters.contractType,
        ...updates,
      };

      // Only add non-empty params
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      // Reset to page 1 when filters change
      params.set('page', '1');

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, search, initialFilters]
  );

  // Debounced search handler
  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateFilters({ search: value });
  }, 400);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };

  const handleFilterChange = (key: string, value: string) => {
    updateFilters({ [key]: value });
  };

  const clearFilters = () => {
    setSearch('');
    router.push(pathname);
  };

  const hasActiveFilters =
    search ||
    initialFilters.position ||
    initialFilters.status ||
    initialFilters.contractType;

  return (
    <div className="space-y-4">
      {/* Primary Search Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, email, or TSC number..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        {/* Toggle Advanced Filters */}
        <Button
          variant="outline"
          size="md"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="md"
            onClick={clearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Advanced Filters Row */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          {/* Position Filter */}
          <Select
            value={initialFilters.position}
            onChange={(e) => handleFilterChange('position', e.target.value)}
            label="Position"
          >
            <option value="">All Positions</option>
            {Object.entries(STAFF_POSITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          {/* Status Filter */}
          <Select
            value={initialFilters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            label="Status"
          >
            <option value="">All Statuses</option>
            {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          {/* Contract Type Filter */}
          <Select
            value={initialFilters.contractType}
            onChange={(e) => handleFilterChange('contractType', e.target.value)}
            label="Contract Type"
          >
            <option value="">All Contract Types</option>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
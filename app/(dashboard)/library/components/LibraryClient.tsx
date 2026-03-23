'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';

type TabType = 'overview' | 'catalog' | 'borrowing' | 'returns';
type VisibleTab = {
  key: TabType;
  label: string;
  allowed: boolean;
};

export function LibraryClient() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { checkPermission } = useAuth();

  const canView = checkPermission('library', 'view');
  const canManage =
    checkPermission('library', 'create') ||
    checkPermission('library', 'update') ||
    checkPermission('library', 'delete');

  const visibleTabs = useMemo(
    () =>
      ([
        { key: 'overview', label: 'Overview', allowed: canView },
        { key: 'catalog', label: 'Book Catalog', allowed: canView },
        { key: 'borrowing', label: 'Borrowing', allowed: canManage },
        { key: 'returns', label: 'Returns', allowed: canManage },
      ] as VisibleTab[]).filter((tab) => tab.allowed),
    [canView, canManage],
  );

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? 'overview');
    }
  }, [activeTab, visibleTabs]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && canView && (
        <LibraryOverview canManage={canManage} />
      )}
      {activeTab === 'catalog' && canView && (
        <BookCatalog canManage={canManage} />
      )}
      {activeTab === 'borrowing' && canManage && (
        <BorrowingSection canManage={canManage} />
      )}
      {activeTab === 'returns' && canManage && (
        <ReturnsSection canManage={canManage} />
      )}
    </div>
  );
}

function LibraryOverview({ canManage }: { canManage: boolean }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Total Books</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">--</p>
            <p className="mt-1 text-xs text-gray-400">Inventory count</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Books Borrowed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">--</p>
            <p className="mt-1 text-xs text-gray-400">Currently checked out</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-red-600">--</p>
            <p className="mt-1 text-xs text-gray-400">Past return date</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Available</p>
            <p className="mt-1 text-2xl font-bold text-green-600">--</p>
            <p className="mt-1 text-xs text-gray-400">Ready for borrowing</p>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      {canManage && (
        <Card>
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
              onClick={() => {}}
            >
              <span className="text-2xl">📚</span>
              <div>
                <p className="font-medium text-gray-900">Add Book</p>
                <p className="text-xs text-gray-500">Register new book</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
              onClick={() => {}}
            >
              <span className="text-2xl">📖</span>
              <div>
                <p className="font-medium text-gray-900">Issue Book</p>
                <p className="text-xs text-gray-500">Lend to student/staff</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
              onClick={() => {}}
            >
              <span className="text-2xl">🔄</span>
              <div>
                <p className="font-medium text-gray-900">Return Book</p>
                <p className="text-xs text-gray-500">Process return</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50"
              onClick={() => {}}
            >
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-medium text-gray-900">Reports</p>
                <p className="text-xs text-gray-500">Library statistics</p>
              </div>
            </button>
          </div>
        </div>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent Activity</h3>
          <EmptyState
            title="No recent activity"
            description="Library transactions will appear here once the library module backend is connected."
          />
        </div>
      </Card>
    </div>
  );
}

function BookCatalog({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="text"
          placeholder="Search by title, author, ISBN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80"
        />
        {canManage && <Button>Add Book</Button>}
      </div>

      <Card>
        <div className="p-6">
          <EmptyState
            title="No books in catalog"
            description="Start building your library catalog by adding books. The catalog will support search by title, author, ISBN, and category."
          />
        </div>
      </Card>

      {/* Table structure for when data is available */}
      <Card>
        <div className="p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-500">Catalog Structure</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Author</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ISBN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Copies</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Available</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No books added yet. Click "Add Book" to get started.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BorrowingSection({ canManage }: { canManage: boolean }) {
  if (!canManage) {return null;}

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Active Borrowings</h2>
        <Button>Issue Book</Button>
      </div>

      <Card>
        <div className="p-6">
          <EmptyState
            title="No active borrowings"
            description="When books are issued to students or staff, active borrowing records will appear here with due dates and status tracking."
          />
        </div>
      </Card>

      {/* Table structure */}
      <Card>
        <div className="p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-500">Borrowing Records Structure</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Book</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Borrower</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Issue Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No borrowing records yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReturnsSection({ canManage }: { canManage: boolean }) {
  if (!canManage) {return null;}

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Book Returns</h2>
        <Button>Process Return</Button>
      </div>

      {/* Overdue Alert */}
      <Card>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <h3 className="font-medium text-red-800">Overdue Books</h3>
              <p className="text-sm text-red-600">
                No overdue books at this time. Overdue tracking will activate once borrowing records exist.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <EmptyState
            title="No return history"
            description="Completed returns and their records will appear here, including any fines or penalties applied."
          />
        </div>
      </Card>
    </div>
  );
}

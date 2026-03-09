import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { StaffTable } from "./components/StaffTable";
import { StaffFilters } from "./components/StaffFilters";
import { StaffStatsCards } from "./components/StaffStatsCards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeletons";

export const metadata: Metadata = {
  title: "Staff Management | School Management System",
  description: "Manage staff members, view profiles, and handle leave requests",
};

interface StaffPageProps {
  searchParams: {
    search?: string;
    position?: string;
    status?: string;
    contractType?: string;
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

export default function StaffPage({ searchParams }: StaffPageProps) {
  const filters = {
    search: searchParams.search || "",
    position: searchParams.position || "",
    status: searchParams.status || "",
    contractType: searchParams.contractType || "",
    page: parseInt(searchParams.page || "1", 10),
    pageSize: parseInt(searchParams.pageSize || "20", 10),
    sortBy: searchParams.sortBy || "created_at",
    sortOrder: (searchParams.sortOrder || "desc") as "asc" | "desc",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        description="Manage teachers, administrators, and support staff"
        icon={<Users className="h-8 w-8 text-blue-600" />}
      >
        <Link href="/staff/new">
          <Button variant="primary" size="md">
            <Plus className="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
        </Link>
      </PageHeader>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <StaffStatsCards />
      </Suspense>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <StaffFilters initialFilters={filters} />
        </div>

        <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
          <StaffTable filters={filters} />
        </Suspense>
      </Card>
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="mt-3 h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </Card>
      ))}
    </div>
  );
}

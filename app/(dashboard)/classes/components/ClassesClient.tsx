"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface ClassRecord {
  class_id: string;
  class_name: string;
  grade_level: string | null;
  stream: string | null;
  capacity: number | null;
  academic_year_id: string | null;
  class_teacher_id: string | null;
  academic_years?: {
    academic_year_id: string;
    year_name: string;
  } | null;
  class_teacher?: {
    user_id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface AcademicYear {
  academic_year_id: string;
  year_name: string;
  is_current: boolean;
}

export function ClassesClient() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newClassName, setNewClassName] = useState("");
  const [newGradeLevel, setNewGradeLevel] = useState("");
  const [newStream, setNewStream] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newAcademicYearId, setNewAcademicYearId] = useState("");

  const fetchAcademicYears = useCallback(async () => {
    try {
      const res = await fetch("/api/academic-years");
      if (res.ok) {
        const json = await res.json();
        setAcademicYears(json.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch academic years:", err);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedYear) params.set("academic_year_id", selectedYear);

      const res = await fetch(`/api/classes?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch classes");
      }
      const json = await res.json();
      setClasses(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch classes");
    } finally {
      setLoading(false);
    }
  }, [search, selectedYear]);

  useEffect(() => {
    fetchAcademicYears();
  }, [fetchAcademicYears]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_name: newClassName.trim(),
          grade_level: newGradeLevel.trim() || null,
          stream: newStream.trim() || null,
          capacity: newCapacity ? parseInt(newCapacity) : null,
          academic_year_id: newAcademicYearId || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create class");
      }

      // Reset form and refresh
      setNewClassName("");
      setNewGradeLevel("");
      setNewStream("");
      setNewCapacity("");
      setNewAcademicYearId("");
      setShowCreateForm(false);
      fetchClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setCreating(false);
    }
  };

  // Summary stats
  const totalClasses = classes.length;
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
  const gradeLevels = [
    ...new Set(classes.map((c) => c.grade_level).filter(Boolean)),
  ];
  const classesWithTeacher = classes.filter((c) => c.class_teacher).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Total Classes</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalClasses}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Grade Levels</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {gradeLevels.length}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">Total Capacity</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {totalCapacity}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm font-medium text-gray-500">
              With Class Teacher
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {classesWithTeacher}
            </p>
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="text"
                placeholder="Search classes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Academic Years</option>
                {academicYears.map((year) => (
                  <option
                    key={year.academic_year_id}
                    value={year.academic_year_id}
                  >
                    {year.year_name} {year.is_current ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? "Cancel" : "Add Class"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <div className="p-4">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Class
            </h3>
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Class Name *
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Grade 1A"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Grade Level
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Grade 1"
                  value={newGradeLevel}
                  onChange={(e) => setNewGradeLevel(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Stream
                </label>
                <Input
                  type="text"
                  placeholder="e.g., East, West"
                  value={newStream}
                  onChange={(e) => setNewStream(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Capacity
                </label>
                <Input
                  type="number"
                  placeholder="e.g., 40"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Academic Year
                </label>
                <select
                  value={newAcademicYearId}
                  onChange={(e) => setNewAcademicYearId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year) => (
                    <option
                      key={year.academic_year_id}
                      value={year.academic_year_id}
                    >
                      {year.year_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Class"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <div className="p-4">
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  fetchClasses();
                }}
                className="mt-2 text-sm font-medium text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-2 text-sm text-gray-500">Loading classes...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && classes.length === 0 && (
        <EmptyState
          title="No classes found"
          description={
            search || selectedYear
              ? "Try adjusting your search or filters."
              : "Get started by creating your first class."
          }
          action={
            !showCreateForm
              ? { label: "Add Class", onClick: () => setShowCreateForm(true) }
              : undefined
          }
        />
      )}

      {/* Classes Table */}
      {!loading && !error && classes.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Grade Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stream
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Academic Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Class Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Capacity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {classes.map((cls) => (
                  <tr key={cls.class_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {cls.class_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.grade_level || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.stream ? (
                        <Badge variant="default">{cls.stream}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.academic_years?.year_name || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.class_teacher
                        ? `${cls.class_teacher.first_name} ${cls.class_teacher.last_name}`
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.capacity || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

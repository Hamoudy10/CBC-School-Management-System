"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { STAFF_POSITION_LABELS, type StaffPosition } from "@/features/staff";
import { useAuth } from "@/hooks/useAuth";

function getStaffPositionLabel(position: unknown) {
  if (typeof position !== "string") {
    return "";
  }

  return STAFF_POSITION_LABELS[position as StaffPosition] || position;
}

function normalizeTeacherOption(staff: any) {
  const userId =
    typeof staff?.userId === "string"
      ? staff.userId
      : typeof staff?.user_id === "string"
        ? staff.user_id
        : "";
  const firstName =
    typeof staff?.firstName === "string"
      ? staff.firstName
      : typeof staff?.first_name === "string"
        ? staff.first_name
        : "";
  const lastName =
    typeof staff?.lastName === "string"
      ? staff.lastName
      : typeof staff?.last_name === "string"
        ? staff.last_name
        : "";
  const rawPosition =
    typeof staff?.position === "string"
      ? staff.position
      : typeof staff?.roleName === "string"
        ? staff.roleName
        : typeof staff?.role_name === "string"
          ? staff.role_name
          : "";
  const rawRoleName =
    typeof staff?.roleName === "string"
      ? staff.roleName
      : typeof staff?.role_name === "string"
        ? staff.role_name
        : "";

  return {
    userId,
    firstName,
    lastName,
    position: rawPosition.toLowerCase(),
    roleName: rawRoleName.toLowerCase(),
  };
}

type TeacherOption = ReturnType<typeof normalizeTeacherOption>;

function sortTeacherOptions(teachers: TeacherOption[]) {
  return [...teachers].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function getTeacherOptionLabel(
  teacher: TeacherOption,
  assignedClassName?: string,
) {
  const teacherName = `${teacher.firstName} ${teacher.lastName}`.trim();
  const effectiveRole = teacher.position || teacher.roleName || "";
  const positionLabel = getStaffPositionLabel(effectiveRole);

  if (assignedClassName) {
    return `${teacherName} · ${positionLabel} (Assigned to ${assignedClassName})`;
  }

  return `${teacherName} · ${positionLabel}`;
}

export default function ClassesSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    grade_level: "1",
    stream: "",
    capacity: "45",
    class_teacher_id: "",
    academic_year: "",
  });
  const [editForm, setEditForm] = useState({
    stream: "",
    capacity: "",
    class_teacher_id: "",
  });

  const canUpdate = checkPermission("settings", "update");
  const canCreate = checkPermission("settings", "create") || canUpdate;
  const canDelete = checkPermission("settings", "delete");

  const fetchAcademicYears = useCallback(async () => {
    const res = await fetch("/api/settings/academic-years");
    if (!res.ok) {
      throw new Error("Failed to fetch academic years");
    }
    const json = await res.json();
    const data = json.data || [];
    setAcademicYears(data);
    const active = data.find((year: any) => year.is_active);
    const nextYear = active?.year || data[0]?.year || "";
    setSelectedYear(nextYear);
    setForm((prev) => ({ ...prev, academic_year: nextYear }));
  }, []);

  const fetchTeachers = useCallback(async () => {
    const res = await fetch("/api/settings/classes/teachers", {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to fetch teacher options");
    }

    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    const uniqueTeachers = Array.from(
      new Map(
        data
          .map(normalizeTeacherOption)
          .filter((staff: TeacherOption) => Boolean(staff.userId))
          .map((staff) => [staff.userId, staff]),
      ).values(),
    );

    setTeachers(sortTeacherOptions(uniqueTeachers));
  }, []);

  const teacherAssignments = useMemo(() => {
    const assignments = new Map<string, string>();

    classes.forEach((cls: any) => {
      if (
        cls?.status === "active" &&
        typeof cls?.class_teacher_id === "string" &&
        cls.class_teacher_id.length > 0 &&
        typeof cls?.name === "string" &&
        !assignments.has(cls.class_teacher_id)
      ) {
        assignments.set(cls.class_teacher_id, cls.name);
      }
    });

    return assignments;
  }, [classes]);

  const teacherOptions = useMemo(() => {
    const sortedTeachers = sortTeacherOptions(teachers);

    return sortedTeachers.sort((a, b) => {
      const aAssigned = teacherAssignments.has(a.userId);
      const bAssigned = teacherAssignments.has(b.userId);

      if (aAssigned === bAssigned) {
        return 0;
      }

      return aAssigned ? 1 : -1;
    });
  }, [teacherAssignments, teachers]);

  const fetchClasses = useCallback(async (year?: string) => {
    const params = new URLSearchParams();
    if (year) {
      params.set("academic_year", year);
    }
    params.set("status", "all");
    const res = await fetch(`/api/settings/classes?${params.toString()}`);
    if (!res.ok) {
      throw new Error("Failed to fetch classes");
    }
    const json = await res.json();
    setClasses(json.data || []);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        await Promise.all([fetchAcademicYears(), fetchTeachers()]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load classes");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchAcademicYears, fetchTeachers]);

  useEffect(() => {
    if (!selectedYear) {
      return;
    }
    fetchClasses(selectedYear).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    });
  }, [selectedYear, fetchClasses]);

  useEffect(() => {
    setEditingClassId(null);
  }, [selectedYear]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) {
      toastError(
        "Access denied",
        "You do not have permission to create settings.",
      );
      return;
    }
    if (!form.name.trim()) {
      toastError("Invalid class name", "Class name is required.");
      return;
    }
    const capacityValue = Number(form.capacity);
    if (Number.isNaN(capacityValue) || capacityValue < 1) {
      toastError("Invalid capacity", "Capacity must be a positive number.");
      return;
    }
    const gradeLevelValue = Number(form.grade_level);
    if (
      Number.isNaN(gradeLevelValue) ||
      gradeLevelValue < 1 ||
      gradeLevelValue > 12
    ) {
      toastError(
        "Invalid grade level",
        "Grade level must be between 1 and 12.",
      );
      return;
    }
    if (!form.academic_year) {
      toastError("Invalid academic year", "Select an academic year.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        grade_level: Number(form.grade_level),
        stream: form.stream || undefined,
        capacity: Number(form.capacity),
        class_teacher_id: form.class_teacher_id || undefined,
        academic_year: form.academic_year,
      };

      const response = await fetch("/api/settings/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to create class");
      }
      success("Class created", result?.message);
      setForm({
        name: "",
        grade_level: "1",
        stream: "",
        capacity: "45",
        class_teacher_id: "",
        academic_year: form.academic_year,
      });
      fetchClasses(selectedYear);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create class";
      toastError("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!canDelete) {
      toastError(
        "Access denied",
        "You do not have permission to delete settings.",
      );
      return;
    }
    if (
      !confirm("Deactivate this class? Existing students will remain linked.")
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/settings/classes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to deactivate class");
      }
      success("Class updated", result?.message);
      fetchClasses(selectedYear);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update class";
      toastError("Error", message);
    }
  };

  const handleReactivate = async (id: string) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    try {
      const response = await fetch(`/api/settings/classes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "active" }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to reactivate class");
      }
      success("Class updated", result?.message);
      fetchClasses(selectedYear);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update class";
      toastError("Error", message);
    }
  };

  const startEdit = (cls: any) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    setEditingClassId(cls.class_id);
    setEditForm({
      stream: cls.stream || "",
      capacity: cls.capacity ? String(cls.capacity) : "",
      class_teacher_id: cls.class_teacher_id || "",
    });
  };

  const cancelEdit = () => {
    setEditingClassId(null);
    setEditForm({ stream: "", capacity: "", class_teacher_id: "" });
  };

  const handleUpdate = async (id: string) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    const capacityValue = Number(editForm.capacity);
    if (Number.isNaN(capacityValue) || capacityValue < 1) {
      toastError("Invalid capacity", "Capacity must be a positive number.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        stream: editForm.stream,
        capacity: capacityValue,
        class_teacher_id: editForm.class_teacher_id || "",
      };

      const response = await fetch(`/api/settings/classes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to update class");
      }
      success("Class updated", result?.message);
      setEditingClassId(null);
      fetchClasses(selectedYear);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update class";
      toastError("Error", message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">Loading classes...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </Card>
    );
  }

  if (academicYears.length === 0) {
    return (
      <EmptyState
        title="No academic years available"
        description="Create an academic year first, then configure classes."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Create Class</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set up classes for the selected academic year.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <Input
              label="Class Name"
              placeholder="e.g. Grade 6 East"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              disabled={!canCreate}
            />
            <Select
              label="Academic Year"
              value={form.academic_year}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, academic_year: e.target.value }));
                setSelectedYear(e.target.value);
              }}
              required
              disabled={!canCreate}
            >
              {academicYears.map((year: any) => (
                <option key={year.academic_year_id} value={year.year}>
                  {year.year} {year.is_active ? "(Active)" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Grade Level"
              value={form.grade_level}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, grade_level: e.target.value }))
              }
              required
              disabled={!canCreate}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Grade {i + 1}
                </option>
              ))}
            </Select>
            <Input
              label="Stream"
              placeholder="e.g. East, North (optional)"
              value={form.stream}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, stream: e.target.value }))
              }
              disabled={!canCreate}
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, capacity: e.target.value }))
              }
              required
              disabled={!canCreate}
            />
            <Select
              label="Class Teacher (optional)"
              value={form.class_teacher_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  class_teacher_id: e.target.value,
                }))
              }
              disabled={!canCreate}
            >
              <option value="">Unassigned</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {getTeacherOptionLabel(
                    teacher,
                    teacherAssignments.get(teacher.userId),
                  )}
                </option>
              ))}
            </Select>

            <div className="sm:col-span-2 flex items-center justify-end">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={!canCreate}
              >
                Create Class
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Classes</h2>
          <p className="text-sm text-gray-500">
            Showing classes for {selectedYear || "selected academic year"}.
          </p>
        </div>
        <Select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          {academicYears.map((year: any) => (
            <option key={year.academic_year_id} value={year.year}>
              {year.year} {year.is_active ? "(Active)" : ""}
            </option>
          ))}
        </Select>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes"
          description="Create classes for this academic year to get started."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stream
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {classes.map((cls: any) => {
                  const isEditing = editingClassId === cls.class_id;

                  return (
                    <tr key={cls.class_id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {cls.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        Grade {cls.grade_level}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <Input
                            value={editForm.stream}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                stream: e.target.value,
                              }))
                            }
                            placeholder="Stream"
                            className="min-w-[140px] py-1.5"
                          />
                        ) : (
                          <span className="whitespace-nowrap">
                            {cls.stream || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={editForm.capacity}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                capacity: e.target.value,
                              }))
                            }
                            className="w-24 py-1.5"
                          />
                        ) : (
                          <span className="whitespace-nowrap">
                            {cls.capacity || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isEditing ? (
                          <Select
                            value={editForm.class_teacher_id}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                class_teacher_id: e.target.value,
                              }))
                            }
                            className="min-w-[220px] py-1.5"
                          >
                            <option value="">Unassigned</option>
                            {teacherOptions.map((teacher) => (
                              <option
                                key={teacher.userId}
                                value={teacher.userId}
                              >
                                {getTeacherOptionLabel(
                                  teacher,
                                  teacherAssignments.get(teacher.userId),
                                )}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="whitespace-nowrap">
                            {cls.class_teacher
                              ? `${cls.class_teacher.first_name} ${cls.class_teacher.last_name}`
                              : "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {cls.status === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={isUpdating}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleUpdate(cls.class_id)}
                                loading={isUpdating}
                                disabled={!canUpdate}
                              >
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(cls)}
                                disabled={!canUpdate}
                              >
                                Edit
                              </Button>
                              {cls.status === "active" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeactivate(cls.class_id)}
                                  disabled={!canDelete}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReactivate(cls.class_id)}
                                  disabled={!canUpdate}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}


"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { STAFF_POSITION_LABELS, type StaffPosition } from "@/features/staff";
import { useAuth } from "@/hooks/useAuth";

type SettingsTab = "school" | "academic-years" | "terms" | "classes" | "system";

const settingsTabs: { key: SettingsTab; label: string }[] = [
  { key: "school", label: "School Profile" },
  { key: "academic-years", label: "Academic Years" },
  { key: "terms", label: "Terms" },
  { key: "classes", label: "Classes" },
  { key: "system", label: "System Config" },
];

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
  const effectiveRole =
    teacher.position || teacher.roleName || "";
  const positionLabel = getStaffPositionLabel(effectiveRole);

  if (assignedClassName) {
    return `${teacherName} · ${positionLabel} (Assigned to ${assignedClassName})`;
  }

  return `${teacherName} · ${positionLabel}`;
}

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");
  const searchParams = useSearchParams();
  const { checkPermission } = useAuth();

  const canViewSettings = checkPermission("settings", "view");

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (!tabParam) {
      return;
    }

    const isValidTab = settingsTabs.some((tab) => tab.key === tabParam);
    if (isValidTab) {
      setActiveTab(tabParam as SettingsTab);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {settingsTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "school" && <SchoolProfileSection />}
      {activeTab === "academic-years" && <AcademicYearsSection />}
      {activeTab === "terms" && <TermsSection />}
      {activeTab === "classes" && <ClassesSection />}
      {activeTab === "system" && <SystemConfigSection />}
    </div>
  );
}

function SchoolProfileSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    registration_number: "",
    type: "primary",
    motto: "",
    contact_email: "",
    contact_phone: "",
    secondary_phone: "",
    website: "",
    county: "",
    sub_county: "",
    address: "",
    mission: "",
    vision: "",
    established_year: "",
  });
  const canViewSettings = checkPermission("settings", "view");
  const canUpdateSettings = checkPermission("settings", "update");

  const syncForm = useCallback((schoolData: any) => {
    setForm({
      name: schoolData?.name || "",
      registration_number: schoolData?.registration_number || "",
      type: schoolData?.type || "primary",
      motto: schoolData?.motto || "",
      contact_email: schoolData?.contact_email || "",
      contact_phone: schoolData?.contact_phone || "",
      secondary_phone: schoolData?.secondary_phone || "",
      website: schoolData?.website || "",
      county: schoolData?.county || "",
      sub_county: schoolData?.sub_county || "",
      address: schoolData?.address || "",
      mission: schoolData?.mission || "",
      vision: schoolData?.vision || "",
      established_year: schoolData?.established_year
        ? String(schoolData.established_year)
        : "",
    });
  }, []);

  const fetchSchool = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/school");
      if (!res.ok) {
        const altRes = await fetch("/api/settings/config");
        if (altRes.ok) {
          const json = await altRes.json();
          const schoolData = json.data?.school || null;
          setSchool(schoolData);
          syncForm(schoolData);
          setError(null);
          return;
        }
        throw new Error("Failed to fetch school profile");
      }
      const json = await res.json();
      const schoolData = json.data || null;
      setSchool(schoolData);
      syncForm(schoolData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load school profile",
      );
    } finally {
      setLoading(false);
    }
  }, [syncForm]);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  const handleCancelEdit = () => {
    syncForm(school);
    setIsEditing(false);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!canUpdateSettings) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        registration_number: form.registration_number.trim(),
        type: form.type,
        motto: form.motto.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
        secondary_phone: form.secondary_phone.trim(),
        website: form.website.trim(),
        county: form.county.trim(),
        sub_county: form.sub_county.trim(),
        address: form.address.trim(),
        mission: form.mission.trim(),
        vision: form.vision.trim(),
        established_year: form.established_year
          ? Number(form.established_year)
          : undefined,
      };

      const response = await fetch("/api/settings/school", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to update school profile");
      }

      setSchool(result.data || null);
      syncForm(result.data || null);
      setIsEditing(false);
      success(
        "School profile updated",
        result?.message || "Changes saved successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update school profile";
      toastError("Error", message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewSettings) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have permission to view settings.
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">
            Loading school profile...
          </p>
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

  if (!school) {
    return (
      <EmptyState
        title="No school profile found"
        description="School profile information is not configured yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSave} className="p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                School Information
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Maintain the core profile details used across reports,
                communication, and school identity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={school.is_active ? "success" : "danger"}>
                {school.is_active ? "Active" : "Inactive"}
              </Badge>
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={isSaving}>
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setIsEditing(true)}
                  disabled={!canUpdateSettings}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="School Name"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={!isEditing}
              required
            />
            <Input
              label="Registration Number"
              value={form.registration_number}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  registration_number: e.target.value,
                }))
              }
              disabled={!isEditing}
            />
            <Select
              label="School Type"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value }))
              }
              disabled={!isEditing}
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="mixed">Mixed</option>
              <option value="academy">Academy</option>
            </Select>
            <Input
              label="Established Year"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={form.established_year}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  established_year: e.target.value,
                }))
              }
              disabled={!isEditing}
            />
            <Input
              label="Contact Email"
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contact_email: e.target.value }))
              }
              disabled={!isEditing}
            />
            <Input
              label="Primary Phone"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, contact_phone: e.target.value }))
              }
              disabled={!isEditing}
            />
            <Input
              label="Secondary Phone"
              value={form.secondary_phone}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  secondary_phone: e.target.value,
                }))
              }
              disabled={!isEditing}
            />
            <Input
              label="Website"
              value={form.website}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, website: e.target.value }))
              }
              disabled={!isEditing}
            />
            <Input
              label="County"
              value={form.county}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, county: e.target.value }))
              }
              disabled={!isEditing}
            />
            <Input
              label="Sub County"
              value={form.sub_county}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sub_county: e.target.value }))
              }
              disabled={!isEditing}
            />
            <div className="sm:col-span-2">
              <Input
                label="Motto"
                value={form.motto}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, motto: e.target.value }))
                }
                disabled={!isEditing}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                rows={3}
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, address: e.target.value }))
                }
                disabled={!isEditing}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Mission
              </label>
              <textarea
                rows={4}
                value={form.mission}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, mission: e.target.value }))
                }
                disabled={!isEditing}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Vision
              </label>
              <textarea
                rows={4}
                value={form.vision}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, vision: e.target.value }))
                }
                disabled={!isEditing}
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

function AcademicYearsSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [form, setForm] = useState({
    year: "",
    start_date: "",
    end_date: "",
  });

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/academic-years");
      if (!res.ok) {
        throw new Error("Failed to fetch academic years");
      }
      const json = await res.json();
      setYears(json.data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load academic years",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const canViewSettings = checkPermission("settings", "view");
  const canUpdate = checkPermission("settings", "update");
  const canCreate = checkPermission("settings", "create") || canUpdate;
  const canDelete = checkPermission("settings", "delete");

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (editingYearId && !canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    if (!editingYearId && !canCreate) {
      toastError(
        "Access denied",
        "You do not have permission to create settings.",
      );
      return;
    }
    if (!/^\d{4}$/.test(form.year)) {
      toastError("Invalid year", "Year must be in YYYY format.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toastError("Invalid dates", "Start and end dates are required.");
      return;
    }
    if (form.start_date >= form.end_date) {
      toastError("Invalid dates", "End date must be after start date.");
      return;
    }
    setIsSubmitting(true);
    try {
      const isEditing = !!editingYearId;
      const response = await fetch(
        isEditing
          ? `/api/settings/academic-years/${editingYearId}`
          : "/api/settings/academic-years",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.error ||
            (isEditing
              ? "Failed to update academic year"
              : "Failed to create academic year"),
        );
      }

      success(
        isEditing ? "Academic year updated" : "Academic year created",
        result?.message,
      );
      setForm({ year: "", start_date: "", end_date: "" });
      setEditingYearId(null);
      fetchYears();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingYearId
            ? "Failed to update academic year"
            : "Failed to create academic year";
      toastError("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (year: any) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    setEditingYearId(year.academic_year_id);
    setForm({
      year: year.year || "",
      start_date: year.start_date || "",
      end_date: year.end_date || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingYearId(null);
    setForm({ year: "", start_date: "", end_date: "" });
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toastError(
        "Access denied",
        "You do not have permission to delete settings.",
      );
      return;
    }
    if (!confirm("Delete this academic year? This cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`/api/settings/academic-years/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete academic year");
      }
      success("Academic year deleted", result?.message);
      fetchYears();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete academic year";
      toastError("Error", message);
    }
  };

  const handleActivate = async (id: string) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    try {
      const response = await fetch(
        `/api/settings/academic-years/${id}/activate`,
        { method: "POST", credentials: "include" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to set active year");
      }
      success("Academic year updated", result?.message);
      fetchYears();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update academic year";
      toastError("Error", message);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">
            Loading academic years...
          </p>
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

  const activeYear = years.find((year: any) => year.is_active);

  if (!canViewSettings) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have permission to view settings.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingYearId ? "Edit Academic Year" : "Create Academic Year"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Define the academic calendar window for your school.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 sm:grid-cols-3"
          >
            <Input
              label="Year"
              placeholder="e.g. 2026"
              value={form.year}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, year: e.target.value }))
              }
              required
              disabled={editingYearId ? !canUpdate : !canCreate}
            />
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, start_date: e.target.value }))
              }
              required
              disabled={editingYearId ? !canUpdate : !canCreate}
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, end_date: e.target.value }))
              }
              required
              disabled={editingYearId ? !canUpdate : !canCreate}
            />

            <div className="sm:col-span-3 flex items-center justify-end">
              <div className="flex items-center gap-2">
                {editingYearId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={editingYearId ? !canUpdate : !canCreate}
                >
                  {editingYearId ? "Save Changes" : "Create Academic Year"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Card>

      {years.length === 0 ? (
        <EmptyState
          title="No academic years"
          description="Configure academic years to organize your school calendar."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    End Date
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
                {years.map((year: any) => (
                  <tr key={year.academic_year_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {year.year}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {year.start_date
                        ? new Date(year.start_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {year.end_date
                        ? new Date(year.end_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {year.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {!year.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleActivate(year.academic_year_id)
                            }
                            disabled={!canUpdate}
                          >
                            Set Active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(year)}
                          disabled={!canUpdate}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(year.academic_year_id)}
                          disabled={year.is_active || !canDelete}
                        >
                          Delete
                        </Button>
                        {year.is_active && activeYear && (
                          <span className="text-xs text-gray-500 self-center">
                            Current year
                          </span>
                        )}
                      </div>
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

function TermsSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [terms, setTerms] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [form, setForm] = useState({
    academic_year_id: "",
    name: "Term 1",
    start_date: "",
    end_date: "",
  });

  const fetchYears = useCallback(async () => {
    const res = await fetch("/api/settings/academic-years");
    if (!res.ok) {
      throw new Error("Failed to fetch academic years");
    }
    const json = await res.json();
    const data = json.data || [];
    setYears(data);
    const active = data.find((year: any) => year.is_active);
    const nextYearId =
      active?.academic_year_id || data[0]?.academic_year_id || "";
    setSelectedYearId(nextYearId);
    setForm((prev) => ({
      ...prev,
      academic_year_id: nextYearId,
    }));
  }, []);

  const canUpdate = checkPermission("settings", "update");
  const canCreate = checkPermission("settings", "create") || canUpdate;
  const canDelete = checkPermission("settings", "delete");

  const fetchTerms = useCallback(async (yearId?: string) => {
    if (!yearId) {
      setTerms([]);
      return;
    }
    const res = await fetch(`/api/settings/terms?academic_year_id=${yearId}`);
    if (!res.ok) {
      throw new Error("Failed to fetch terms");
    }
    const json = await res.json();
    setTerms(json.data || []);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        await fetchYears();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load terms");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchYears]);

  useEffect(() => {
    if (!selectedYearId) {
      return;
    }
    fetchTerms(selectedYearId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load terms");
    });
  }, [selectedYearId, fetchTerms]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (editingTermId && !canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    if (!editingTermId && !canCreate) {
      toastError(
        "Access denied",
        "You do not have permission to create settings.",
      );
      return;
    }
    if (!form.academic_year_id) {
      toastError(
        "Invalid academic year",
        "Select an academic year for the term.",
      );
      return;
    }
    if (!form.start_date || !form.end_date) {
      toastError("Invalid dates", "Start and end dates are required.");
      return;
    }
    if (form.start_date >= form.end_date) {
      toastError("Invalid dates", "End date must be after start date.");
      return;
    }
    setIsSubmitting(true);
    try {
      const isEditing = !!editingTermId;
      const response = await fetch(
        isEditing
          ? `/api/settings/terms/${editingTermId}`
          : "/api/settings/terms",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.error ||
            (isEditing ? "Failed to update term" : "Failed to create term"),
        );
      }
      success(isEditing ? "Term updated" : "Term created", result?.message);
      setForm((prev) => ({
        ...prev,
        name: "Term 1",
        start_date: "",
        end_date: "",
      }));
      setEditingTermId(null);
      fetchTerms(form.academic_year_id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : editingTermId
            ? "Failed to update term"
            : "Failed to create term";
      toastError("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (id: string) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    try {
      const response = await fetch(`/api/settings/terms/${id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to set active term");
      }
      success("Term updated", result?.message);
      await fetchYears();
      if (selectedYearId) {
        fetchTerms(selectedYearId);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update term";
      toastError("Error", message);
    }
  };

  const handleEdit = (term: any) => {
    if (!canUpdate) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }
    setEditingTermId(term.term_id);
    setForm({
      academic_year_id: term.academic_year_id,
      name: term.name,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
    });
    setSelectedYearId(term.academic_year_id);
  };

  const handleCancelEdit = () => {
    setEditingTermId(null);
    setForm((prev) => ({
      ...prev,
      name: "Term 1",
      start_date: "",
      end_date: "",
    }));
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toastError(
        "Access denied",
        "You do not have permission to delete settings.",
      );
      return;
    }
    if (!confirm("Delete this term? This cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`/api/settings/terms/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete term");
      }
      success("Term deleted", result?.message);
      fetchTerms(selectedYearId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete term";
      toastError("Error", message);
    }
  };

  const selectedYear = years.find(
    (year: any) => year.academic_year_id === selectedYearId,
  );

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">Loading terms...</p>
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

  if (years.length === 0) {
    return (
      <EmptyState
        title="No academic years available"
        description="Create an academic year first, then configure terms."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingTermId ? "Edit Term" : "Create Term"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Define academic terms for the selected academic year.
          </p>

          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <Select
              label="Academic Year"
              value={form.academic_year_id}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  academic_year_id: e.target.value,
                }));
                setSelectedYearId(e.target.value);
              }}
              required
              disabled={editingTermId ? !canUpdate : !canCreate}
            >
              {years.map((year: any) => (
                <option
                  key={year.academic_year_id}
                  value={year.academic_year_id}
                >
                  {year.year} {year.is_active ? "(Active)" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Term"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              disabled={editingTermId ? !canUpdate : !canCreate}
            >
              <option value="Term 1">Term 1</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 3">Term 3</option>
            </Select>
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, start_date: e.target.value }))
              }
              required
              disabled={editingTermId ? !canUpdate : !canCreate}
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, end_date: e.target.value }))
              }
              required
              disabled={editingTermId ? !canUpdate : !canCreate}
            />

            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              {editingTermId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={editingTermId ? !canUpdate : !canCreate}
              >
                {editingTermId ? "Save Changes" : "Create Term"}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Terms</h2>
          <p className="text-sm text-gray-500">
            Showing terms for {selectedYear?.year || "selected academic year"}.
          </p>
        </div>
        <Select
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
        >
          {years.map((year: any) => (
            <option key={year.academic_year_id} value={year.academic_year_id}>
              {year.year} {year.is_active ? "(Active)" : ""}
            </option>
          ))}
        </Select>
      </div>

      {terms.length === 0 ? (
        <EmptyState
          title="No terms configured"
          description="Create terms for this academic year."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Term
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Academic Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    End Date
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
                {terms.map((term: any) => (
                  <tr key={term.term_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {term.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {selectedYear?.year || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {term.start_date
                        ? new Date(term.start_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {term.end_date
                        ? new Date(term.end_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {term.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {!term.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleActivate(term.term_id)}
                            disabled={!canUpdate}
                          >
                            Set Active
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(term)}
                          disabled={!canUpdate}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(term.term_id)}
                          disabled={term.is_active || !canDelete}
                        >
                          Delete
                        </Button>
                      </div>
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

function ClassesSection() {
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

type SystemConfigFormState = {
  academic: {
    grading_system: "cbc_4point" | "percentage" | "letter_grade";
    allow_teacher_report_comments: boolean;
    require_principal_approval: boolean;
    attendance_threshold_warning: string;
    attendance_threshold_critical: string;
  };
  finance: {
    currency: string;
    currency_symbol: string;
    payment_reminder_days: string;
    allow_partial_payments: boolean;
    generate_receipts: boolean;
    overdue_penalty_enabled: boolean;
    overdue_penalty_rate: string;
  };
  communication: {
    allow_parent_messaging: boolean;
    allow_teacher_parent_messaging: boolean;
    announcement_approval_required: boolean;
    max_message_recipients: string;
  };
  general: {
    timezone: string;
    date_format: string;
    school_days: string[];
    term_dates_visible_to_parents: boolean;
    show_student_rankings: boolean;
  };
};

type SystemConfigOverview = {
  activeYearLabel: string;
  activeTermLabel: string;
  classCount: number;
};

const SYSTEM_DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SYSTEM_TIMEZONE_OPTIONS = [
  "Africa/Nairobi",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Europe/London",
  "UTC",
];

const SYSTEM_DATE_FORMAT_OPTIONS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const SYSTEM_CURRENCY_OPTIONS = [
  { value: "KES", label: "KES" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
  { value: "EUR", label: "EUR" },
];

const SYSTEM_GRADING_OPTIONS = [
  { value: "cbc_4point", label: "CBC 4-Point" },
  { value: "percentage", label: "Percentage" },
  { value: "letter_grade", label: "Letter Grade" },
];

function createDefaultSystemConfigForm(): SystemConfigFormState {
  return {
    academic: {
      grading_system: "cbc_4point",
      allow_teacher_report_comments: true,
      require_principal_approval: true,
      attendance_threshold_warning: "80",
      attendance_threshold_critical: "60",
    },
    finance: {
      currency: "KES",
      currency_symbol: "KES",
      payment_reminder_days: "7, 14, 30",
      allow_partial_payments: true,
      generate_receipts: true,
      overdue_penalty_enabled: false,
      overdue_penalty_rate: "",
    },
    communication: {
      allow_parent_messaging: true,
      allow_teacher_parent_messaging: true,
      announcement_approval_required: false,
      max_message_recipients: "100",
    },
    general: {
      timezone: "Africa/Nairobi",
      date_format: "DD/MM/YYYY",
      school_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      term_dates_visible_to_parents: true,
      show_student_rankings: false,
    },
  };
}

function normalizeSystemGradingSystem(
  value: unknown,
): SystemConfigFormState["academic"]["grading_system"] {
  if (value === "cbc_4_point") {
    return "cbc_4point";
  }

  if (
    value === "cbc_4point" ||
    value === "percentage" ||
    value === "letter_grade"
  ) {
    return value;
  }

  return "cbc_4point";
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function coerceNumberString(value: unknown, fallback: string): string {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return fallback;
}

function coerceStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const validValues = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && SYSTEM_DAY_OPTIONS.includes(entry),
  );

  return validValues.length > 0 ? validValues : fallback;
}

function parseReminderDays(value: string): number[] | null {
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number(entry));

  if (
    parsed.length === 0 ||
    parsed.some((entry) => !Number.isInteger(entry) || entry < 1 || entry > 90)
  ) {
    return null;
  }

  return Array.from(new Set(parsed));
}

function mapSettingsToSystemConfigForm(
  settingsPayload: any,
): SystemConfigFormState {
  const defaults = createDefaultSystemConfigForm();
  const resolved = settingsPayload?.settings ?? settingsPayload ?? {};
  const academic = resolved?.academic ?? {};
  const finance = resolved?.finance ?? {};
  const communication = resolved?.communication ?? {};
  const general = resolved?.general ?? {};

  return {
    academic: {
      grading_system: normalizeSystemGradingSystem(academic.grading_system),
      allow_teacher_report_comments: coerceBoolean(
        academic.allow_teacher_report_comments,
        defaults.academic.allow_teacher_report_comments,
      ),
      require_principal_approval: coerceBoolean(
        academic.require_principal_approval,
        defaults.academic.require_principal_approval,
      ),
      attendance_threshold_warning: coerceNumberString(
        academic.attendance_threshold_warning,
        defaults.academic.attendance_threshold_warning,
      ),
      attendance_threshold_critical: coerceNumberString(
        academic.attendance_threshold_critical,
        defaults.academic.attendance_threshold_critical,
      ),
    },
    finance: {
      currency: coerceString(finance.currency, defaults.finance.currency),
      currency_symbol: coerceString(
        finance.currency_symbol,
        defaults.finance.currency_symbol,
      ),
      payment_reminder_days: Array.isArray(finance.payment_reminder_days)
        ? finance.payment_reminder_days.join(", ")
        : defaults.finance.payment_reminder_days,
      allow_partial_payments: coerceBoolean(
        finance.allow_partial_payments,
        defaults.finance.allow_partial_payments,
      ),
      generate_receipts: coerceBoolean(
        finance.generate_receipts,
        defaults.finance.generate_receipts,
      ),
      overdue_penalty_enabled: coerceBoolean(
        finance.overdue_penalty_enabled,
        defaults.finance.overdue_penalty_enabled,
      ),
      overdue_penalty_rate: coerceNumberString(
        finance.overdue_penalty_rate,
        defaults.finance.overdue_penalty_rate,
      ),
    },
    communication: {
      allow_parent_messaging: coerceBoolean(
        communication.allow_parent_messaging,
        defaults.communication.allow_parent_messaging,
      ),
      allow_teacher_parent_messaging: coerceBoolean(
        communication.allow_teacher_parent_messaging,
        defaults.communication.allow_teacher_parent_messaging,
      ),
      announcement_approval_required: coerceBoolean(
        communication.announcement_approval_required,
        defaults.communication.announcement_approval_required,
      ),
      max_message_recipients: coerceNumberString(
        communication.max_message_recipients,
        defaults.communication.max_message_recipients,
      ),
    },
    general: {
      timezone: coerceString(general.timezone, defaults.general.timezone),
      date_format: coerceString(
        general.date_format,
        defaults.general.date_format,
      ),
      school_days: coerceStringArray(
        general.school_days,
        defaults.general.school_days,
      ),
      term_dates_visible_to_parents: coerceBoolean(
        general.term_dates_visible_to_parents,
        defaults.general.term_dates_visible_to_parents,
      ),
      show_student_rankings: coerceBoolean(
        general.show_student_rankings,
        defaults.general.show_student_rankings,
      ),
    },
  };
}

function buildSystemConfigPayload(form: SystemConfigFormState) {
  const warningThreshold = Number(form.academic.attendance_threshold_warning);
  const criticalThreshold = Number(form.academic.attendance_threshold_critical);
  const reminderDays = parseReminderDays(form.finance.payment_reminder_days);
  const maxRecipients = Number(form.communication.max_message_recipients);
  const penaltyRate = form.finance.overdue_penalty_rate.trim()
    ? Number(form.finance.overdue_penalty_rate)
    : undefined;

  if (
    !Number.isInteger(warningThreshold) ||
    warningThreshold < 50 ||
    warningThreshold > 100
  ) {
    return {
      error:
        "Attendance warning threshold must be a whole number between 50 and 100.",
    };
  }

  if (
    !Number.isInteger(criticalThreshold) ||
    criticalThreshold < 30 ||
    criticalThreshold > 100
  ) {
    return {
      error:
        "Attendance critical threshold must be a whole number between 30 and 100.",
    };
  }

  if (criticalThreshold >= warningThreshold) {
    return {
      error:
        "Attendance critical threshold should be lower than the warning threshold.",
    };
  }

  if (!reminderDays) {
    return {
      error:
        "Payment reminder days must be comma-separated whole numbers between 1 and 90.",
    };
  }

  if (!form.finance.currency.trim() || !form.finance.currency_symbol.trim()) {
    return {
      error: "Finance settings require both a currency and currency symbol.",
    };
  }

  if (
    !Number.isInteger(maxRecipients) ||
    maxRecipients < 1 ||
    maxRecipients > 500
  ) {
    return {
      error:
        "Maximum message recipients must be a whole number between 1 and 500.",
    };
  }

  if (!SYSTEM_DATE_FORMAT_OPTIONS.includes(form.general.date_format)) {
    return { error: "Select a supported date format before saving." };
  }

  if (!form.general.timezone.trim()) {
    return { error: "Timezone is required." };
  }

  if (form.general.school_days.length === 0) {
    return { error: "Select at least one school day." };
  }

  if (
    form.finance.overdue_penalty_enabled &&
    (penaltyRate === undefined ||
      Number.isNaN(penaltyRate) ||
      penaltyRate < 0 ||
      penaltyRate > 100)
  ) {
    return {
      error:
        "Overdue penalty rate must be a number between 0 and 100 when penalties are enabled.",
    };
  }

  return {
    payload: {
      academic: {
        grading_system: form.academic.grading_system,
        allow_teacher_report_comments:
          form.academic.allow_teacher_report_comments,
        require_principal_approval: form.academic.require_principal_approval,
        attendance_threshold_warning: warningThreshold,
        attendance_threshold_critical: criticalThreshold,
      },
      finance: {
        currency: form.finance.currency.trim(),
        currency_symbol: form.finance.currency_symbol.trim(),
        payment_reminder_days: reminderDays,
        allow_partial_payments: form.finance.allow_partial_payments,
        generate_receipts: form.finance.generate_receipts,
        overdue_penalty_enabled: form.finance.overdue_penalty_enabled,
        overdue_penalty_rate: form.finance.overdue_penalty_enabled
          ? penaltyRate
          : undefined,
      },
      communication: {
        allow_parent_messaging: form.communication.allow_parent_messaging,
        allow_teacher_parent_messaging:
          form.communication.allow_teacher_parent_messaging,
        announcement_approval_required:
          form.communication.announcement_approval_required,
        max_message_recipients: maxRecipients,
      },
      general: {
        timezone: form.general.timezone.trim(),
        date_format: form.general.date_format,
        school_days: form.general.school_days,
        term_dates_visible_to_parents:
          form.general.term_dates_visible_to_parents,
        show_student_rankings: form.general.show_student_rankings,
      },
    },
  };
}

function SettingsCategoryCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="h-full">
      <div className="border-b border-gray-100 p-6 pb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="space-y-5 p-6 pt-5">{children}</div>
    </Card>
  );
}

function BooleanSettingField({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={value ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          Enabled
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!value ? "primary" : "outline"}
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          Disabled
        </Button>
      </div>
    </div>
  );
}

function SystemConfigSection() {
  const { success, error: toastError } = useToast();
  const { checkPermission } = useAuth();
  const [form, setForm] = useState<SystemConfigFormState>(
    createDefaultSystemConfigForm,
  );
  const [savedForm, setSavedForm] = useState<SystemConfigFormState>(
    createDefaultSystemConfigForm,
  );
  const [overview, setOverview] = useState<SystemConfigOverview>({
    activeYearLabel: "Not set",
    activeTermLabel: "Not set",
    classCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canViewSettings = checkPermission("settings", "view");
  const canUpdateSettings = checkPermission("settings", "update");

  const fetchSettings = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      const res = await fetch("/api/settings/config");
      if (!res.ok) {
        throw new Error("Failed to fetch settings");
      }

      const json = await res.json();
      const data = json.data ?? {};
      const nextForm = mapSettingsToSystemConfigForm(data.settings);

      setForm(nextForm);
      setSavedForm(nextForm);
      setOverview({
        activeYearLabel: data.active_year?.year || "Not set",
        activeTermLabel: data.active_term?.name || "Not set",
        classCount: Array.isArray(data.classes) ? data.classes.length : 0,
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load system configuration",
      );
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!canViewSettings) {
      setLoading(false);
      return;
    }

    fetchSettings();
  }, [canViewSettings, fetchSettings]);

  const updateSectionField = (
    section: keyof SystemConfigFormState,
    key: string,
    value: string | boolean | string[],
  ) => {
    setForm(
      (prev) =>
        ({
          ...prev,
          [section]: {
            ...(prev as any)[section],
            [key]: value,
          },
        }) as SystemConfigFormState,
    );
  };

  const toggleSchoolDay = (day: string) => {
    setForm((prev) => {
      const exists = prev.general.school_days.includes(day);

      return {
        ...prev,
        general: {
          ...prev.general,
          school_days: exists
            ? prev.general.school_days.filter((entry) => entry !== day)
            : [...prev.general.school_days, day],
        },
      };
    });
  };

  const handleReset = () => {
    setForm(savedForm);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!canUpdateSettings) {
      toastError(
        "Access denied",
        "You do not have permission to update settings.",
      );
      return;
    }

    const prepared = buildSystemConfigPayload(form);
    if ("error" in prepared) {
      toastError("Invalid configuration", prepared.error);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prepared.payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to update system settings");
      }

      setSavedForm(form);
      await fetchSettings(false);
      success(
        "System configuration updated",
        result?.message || "Operational settings were saved successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update system settings";
      toastError("Error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(savedForm);

  if (!canViewSettings) {
    return (
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access denied</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have permission to view settings.
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="mt-2 text-sm text-gray-500">
            Loading system configuration...
          </p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="space-y-4 p-6">
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchSettings()}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSave}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            System Configuration
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Configure the operational defaults used across academics, finance,
            communication, and the parent-facing experience.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="warning">Unsaved changes</Badge>
          )}
          {!canUpdateSettings && <Badge variant="outline">View only</Badge>}
          <Button
            type="button"
            variant="outline"
            disabled={!hasUnsavedChanges || isSaving}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            type="submit"
            loading={isSaving}
            disabled={!canUpdateSettings || !hasUnsavedChanges}
          >
            Save settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">
            Active academic year
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.activeYearLabel}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">Active term</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.activeTermLabel}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-gray-500">Active classes</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {overview.classCount}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SettingsCategoryCard
          title="Academic Settings"
          description="Control report-comment policy, approval workflow, and attendance alert thresholds."
        >
          <Select
            label="Grading system"
            value={form.academic.grading_system}
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "academic",
                "grading_system",
                event.target.value,
              )
            }
          >
            {SYSTEM_GRADING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Attendance warning threshold (%)"
              type="number"
              min="50"
              max="100"
              value={form.academic.attendance_threshold_warning}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "academic",
                  "attendance_threshold_warning",
                  event.target.value,
                )
              }
            />
            <Input
              label="Attendance critical threshold (%)"
              type="number"
              min="30"
              max="100"
              value={form.academic.attendance_threshold_critical}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "academic",
                  "attendance_threshold_critical",
                  event.target.value,
                )
              }
            />
          </div>

          <BooleanSettingField
            label="Allow teacher report comments"
            description="Let teachers add narrative comments directly to report cards."
            value={form.academic.allow_teacher_report_comments}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "academic",
                "allow_teacher_report_comments",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Require principal approval"
            description="Keep a principal sign-off step before reports or academic outputs are finalized."
            value={form.academic.require_principal_approval}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "academic",
                "require_principal_approval",
                value,
              )
            }
          />
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="Finance Settings"
          description="Define billing defaults, receipt behavior, reminder cadence, and overdue handling."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Currency"
              value={form.finance.currency}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("finance", "currency", event.target.value)
              }
            >
              {SYSTEM_CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Currency symbol"
              value={form.finance.currency_symbol}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField(
                  "finance",
                  "currency_symbol",
                  event.target.value.toUpperCase(),
                )
              }
            />
          </div>

          <Input
            label="Payment reminder days"
            value={form.finance.payment_reminder_days}
            helperText="Use comma-separated day offsets, for example 7, 14, 30."
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "finance",
                "payment_reminder_days",
                event.target.value,
              )
            }
          />

          <BooleanSettingField
            label="Allow partial payments"
            description="Permit finance staff to record payments that do not clear the full balance."
            value={form.finance.allow_partial_payments}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "allow_partial_payments", value)
            }
          />

          <BooleanSettingField
            label="Generate receipts automatically"
            description="Issue receipts as part of the default payment workflow."
            value={form.finance.generate_receipts}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "generate_receipts", value)
            }
          />

          <BooleanSettingField
            label="Enable overdue penalties"
            description="Apply a configurable penalty rate to overdue balances."
            value={form.finance.overdue_penalty_enabled}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("finance", "overdue_penalty_enabled", value)
            }
          />

          <Input
            label="Overdue penalty rate (%)"
            type="number"
            min="0"
            max="100"
            value={form.finance.overdue_penalty_rate}
            helperText="Leave blank if overdue penalties are disabled."
            disabled={
              !canUpdateSettings ||
              isSaving ||
              !form.finance.overdue_penalty_enabled
            }
            onChange={(event) =>
              updateSectionField(
                "finance",
                "overdue_penalty_rate",
                event.target.value,
              )
            }
          />

          <p className="text-sm text-gray-500">
            Fee structures and charge schedules remain in{" "}
            <a
              href="/finance/fee-structures"
              className="font-medium text-blue-600 hover:text-blue-800"
            >
              Finance
            </a>
            .
          </p>
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="Communication Settings"
          description="Define who can message guardians and how large operational broadcasts may be."
        >
          <Input
            label="Maximum message recipients"
            type="number"
            min="1"
            max="500"
            value={form.communication.max_message_recipients}
            disabled={!canUpdateSettings || isSaving}
            onChange={(event) =>
              updateSectionField(
                "communication",
                "max_message_recipients",
                event.target.value,
              )
            }
          />

          <BooleanSettingField
            label="Allow parent messaging"
            description="Let guardians send and receive messages through the communication module."
            value={form.communication.allow_parent_messaging}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "allow_parent_messaging",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Allow teacher-to-parent messaging"
            description="Enable direct teacher conversations with guardians when needed."
            value={form.communication.allow_teacher_parent_messaging}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "allow_teacher_parent_messaging",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Require announcement approval"
            description="Add an approval step before staff announcements are sent broadly."
            value={form.communication.announcement_approval_required}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "communication",
                "announcement_approval_required",
                value,
              )
            }
          />
        </SettingsCategoryCard>

        <SettingsCategoryCard
          title="General Settings"
          description="Set the school calendar display defaults and the operational profile used across the app."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Timezone"
              value={form.general.timezone}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("general", "timezone", event.target.value)
              }
            >
              {SYSTEM_TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>

            <Select
              label="Date format"
              value={form.general.date_format}
              disabled={!canUpdateSettings || isSaving}
              onChange={(event) =>
                updateSectionField("general", "date_format", event.target.value)
              }
            >
              {SYSTEM_DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">School days</p>
              <p className="text-sm text-gray-500">
                Choose the weekdays that count toward attendance and routine
                operations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_DAY_OPTIONS.map((day) => {
                const selected = form.general.school_days.includes(day);

                return (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={selected ? "primary" : "outline"}
                    disabled={!canUpdateSettings || isSaving}
                    onClick={() => toggleSchoolDay(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>

          <BooleanSettingField
            label="Show term dates to parents"
            description="Expose the configured term schedule in guardian-facing views."
            value={form.general.term_dates_visible_to_parents}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField(
                "general",
                "term_dates_visible_to_parents",
                value,
              )
            }
          />

          <BooleanSettingField
            label="Show student rankings"
            description="Display ranking-related outputs where reporting features support them."
            value={form.general.show_student_rankings}
            disabled={!canUpdateSettings || isSaving}
            onChange={(value) =>
              updateSectionField("general", "show_student_rankings", value)
            }
          />
        </SettingsCategoryCard>
      </div>
    </form>
  );
}

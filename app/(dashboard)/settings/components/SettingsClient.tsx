"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";

type SettingsTab = "school" | "academic-years" | "terms" | "classes" | "system";

const settingsTabs: { key: SettingsTab; label: string }[] = [
  { key: "school", label: "School Profile" },
  { key: "academic-years", label: "Academic Years" },
  { key: "terms", label: "Terms" },
  { key: "classes", label: "Classes" },
  { key: "system", label: "System Config" },
];

const ClassesSection = dynamic(() => import("./ClassesSection"), {
  loading: () => (
    <Card>
      <div className="p-8 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading classes...</p>
      </div>
    </Card>
  ),
});

const SystemConfigSection = dynamic(() => import("./SystemConfigSection"), {
  loading: () => (
    <Card>
      <div className="p-8 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <p className="mt-2 text-sm text-gray-500">
          Loading system configuration...
        </p>
      </div>
    </Card>
  ),
});

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


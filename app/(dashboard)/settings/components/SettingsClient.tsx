"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
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

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");
  const searchParams = useSearchParams();
  const { checkPermission } = useAuth();

  const canViewSettings = checkPermission("settings", "view");

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (!tabParam) {return;}

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
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchool() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/school");
        if (!res.ok) {
          // Try alternate settings endpoint
          const altRes = await fetch("/api/settings/config");
          if (altRes.ok) {
            const json = await altRes.json();
            setSchool(json.data?.school || null);
            return;
          }
          throw new Error("Failed to fetch school profile");
        }
        const json = await res.json();
        setSchool(json.data || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load school profile",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchSchool();
  }, []);

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
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            School Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-500">
                School Name
              </label>
              <p className="mt-1 text-sm text-gray-900">{school.name || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Registration Number
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.registration_number || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Type</label>
              <p className="mt-1 text-sm text-gray-900">{school.type || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Motto</label>
              <p className="mt-1 text-sm text-gray-900">
                {school.motto || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Contact Email
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.contact_email || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Contact Phone
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.contact_phone || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                County
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.county || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Sub County
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.sub_county || "-"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-500">
                Address
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {school.address || "-"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Status
              </label>
              <div className="mt-1">
                <Badge variant={school.is_active ? "success" : "danger"}>
                  {school.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
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
      if (!res.ok) {throw new Error("Failed to fetch academic years");}
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
  const canCreate = checkPermission("settings", "create");
  const canUpdate = checkPermission("settings", "update");
  const canDelete = checkPermission("settings", "delete");

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (editingYearId && !canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
      return;
    }
    if (!editingYearId && !canCreate) {
      toastError("Access denied", "You do not have permission to create settings.");
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
            (isEditing ? "Failed to update academic year" : "Failed to create academic year"),
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
      toastError("Access denied", "You do not have permission to update settings.");
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
      toastError("Access denied", "You do not have permission to delete settings.");
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
      const message = err instanceof Error ? err.message : "Failed to delete academic year";
      toastError("Error", message);
    }
  };

  const handleActivate = async (id: string) => {
    if (!canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
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
      const message = err instanceof Error ? err.message : "Failed to update academic year";
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

          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-3">
            <Input
              label="Year"
              placeholder="e.g. 2026"
              value={form.year}
              onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
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
                      {year.start_date ? new Date(year.start_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {year.end_date ? new Date(year.end_date).toLocaleDateString() : "-"}
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
                          onClick={() => handleActivate(year.academic_year_id)}
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
    if (!res.ok) {throw new Error("Failed to fetch academic years");}
    const json = await res.json();
    const data = json.data || [];
    setYears(data);
    const active = data.find((year: any) => year.is_active);
    const nextYearId = active?.academic_year_id || data[0]?.academic_year_id || "";
    setSelectedYearId(nextYearId);
    setForm((prev) => ({
      ...prev,
      academic_year_id: nextYearId,
    }));
  }, []);

  const canCreate = checkPermission("settings", "create");
  const canUpdate = checkPermission("settings", "update");
  const canDelete = checkPermission("settings", "delete");

  const fetchTerms = useCallback(async (yearId?: string) => {
    if (!yearId) {
      setTerms([]);
      return;
    }
    const res = await fetch(`/api/settings/terms?academic_year_id=${yearId}`);
    if (!res.ok) {throw new Error("Failed to fetch terms");}
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
    if (!selectedYearId) {return;}
    fetchTerms(selectedYearId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load terms");
    });
  }, [selectedYearId, fetchTerms]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (editingTermId && !canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
      return;
    }
    if (!editingTermId && !canCreate) {
      toastError("Access denied", "You do not have permission to create settings.");
      return;
    }
    if (!form.academic_year_id) {
      toastError("Invalid academic year", "Select an academic year for the term.");
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
        isEditing ? `/api/settings/terms/${editingTermId}` : "/api/settings/terms",
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
          result?.error || (isEditing ? "Failed to update term" : "Failed to create term"),
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
      toastError("Access denied", "You do not have permission to update settings.");
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
      const message = err instanceof Error ? err.message : "Failed to update term";
      toastError("Error", message);
    }
  };

  const handleEdit = (term: any) => {
    if (!canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
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
      toastError("Access denied", "You do not have permission to delete settings.");
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
      const message = err instanceof Error ? err.message : "Failed to delete term";
      toastError("Error", message);
    }
  };

  const selectedYear = years.find((year: any) => year.academic_year_id === selectedYearId);

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

          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
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
                <option key={year.academic_year_id} value={year.academic_year_id}>
                  {year.year} {year.is_active ? "(Active)" : ""}
                </option>
              ))}
            </Select>
            <Select
              label="Term"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
                      {term.start_date ? new Date(term.start_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {term.end_date ? new Date(term.end_date).toLocaleDateString() : "-"}
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
  const [teachers, setTeachers] = useState<any[]>([]);
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

  const canCreate = checkPermission("settings", "create");
  const canUpdate = checkPermission("settings", "update");
  const canDelete = checkPermission("settings", "delete");

  const fetchAcademicYears = useCallback(async () => {
    const res = await fetch("/api/settings/academic-years");
    if (!res.ok) {throw new Error("Failed to fetch academic years");}
    const json = await res.json();
    const data = json.data || [];
    setAcademicYears(data);
    const active = data.find((year: any) => year.is_active);
    const nextYear = active?.year || data[0]?.year || "";
    setSelectedYear(nextYear);
    setForm((prev) => ({ ...prev, academic_year: nextYear }));
  }, []);

  const fetchTeachers = useCallback(async () => {
    const res = await fetch(
      "/api/staff?status=active&pageSize=200&sortBy=first_name&sortOrder=asc",
    );
    if (!res.ok) {throw new Error("Failed to fetch staff list");}
    const json = await res.json();
    const data = json.data || [];
    const teachingPositions = new Set([
      "class_teacher",
      "subject_teacher",
      "teacher",
      "principal",
      "deputy_principal",
    ]);
    setTeachers(
      data.filter((staff: any) => teachingPositions.has(staff.position)),
    );
  }, []);

  const fetchClasses = useCallback(
    async (year?: string) => {
      const params = new URLSearchParams();
      if (year) {params.set("academic_year", year);}
      const res = await fetch(`/api/settings/classes?${params.toString()}`);
      if (!res.ok) {throw new Error("Failed to fetch classes");}
      const json = await res.json();
      setClasses(json.data || []);
    },
    [],
  );

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
    if (!selectedYear) {return;}
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
      toastError("Access denied", "You do not have permission to create settings.");
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
    if (Number.isNaN(gradeLevelValue) || gradeLevelValue < 1 || gradeLevelValue > 12) {
      toastError("Invalid grade level", "Grade level must be between 1 and 12.");
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
      const message = err instanceof Error ? err.message : "Failed to create class";
      toastError("Error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!canDelete) {
      toastError("Access denied", "You do not have permission to delete settings.");
      return;
    }
    if (!confirm("Deactivate this class? Existing students will remain linked.")) {
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
      const message = err instanceof Error ? err.message : "Failed to update class";
      toastError("Error", message);
    }
  };

  const handleReactivate = async (id: string) => {
    if (!canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
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
      const message = err instanceof Error ? err.message : "Failed to update class";
      toastError("Error", message);
    }
  };

  const startEdit = (cls: any) => {
    if (!canUpdate) {
      toastError("Access denied", "You do not have permission to update settings.");
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
      toastError("Access denied", "You do not have permission to update settings.");
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
      const message = err instanceof Error ? err.message : "Failed to update class";
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

          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="Class Name"
              placeholder="e.g. Grade 6 East"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
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
              onChange={(e) => setForm((prev) => ({ ...prev, stream: e.target.value }))}
              disabled={!canCreate}
            />
            <Input
              label="Capacity"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
              required
              disabled={!canCreate}
            />
            <Select
              label="Class Teacher (optional)"
              value={form.class_teacher_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, class_teacher_id: e.target.value }))
              }
              disabled={!canCreate}
            >
              <option value="">Unassigned</option>
              {teachers.map((teacher: any) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {teacher.firstName} {teacher.lastName} ·{" "}
                  {getStaffPositionLabel(teacher.position)}
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
        <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
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
                              setEditForm((prev) => ({ ...prev, stream: e.target.value }))
                            }
                            placeholder="Stream"
                            className="min-w-[140px] py-1.5"
                          />
                        ) : (
                          <span className="whitespace-nowrap">{cls.stream || "-"}</span>
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
                              setEditForm((prev) => ({ ...prev, capacity: e.target.value }))
                            }
                            className="w-24 py-1.5"
                          />
                        ) : (
                          <span className="whitespace-nowrap">{cls.capacity || "-"}</span>
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
                            {teachers.map((teacher: any) => (
                              <option key={teacher.userId} value={teacher.userId}>
                                {teacher.firstName} {teacher.lastName} ·{" "}
                                {getStaffPositionLabel(teacher.position)}
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

function SystemConfigSection() {
  const { checkPermission } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewSettings = checkPermission("settings", "view");

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings/config");
        if (!res.ok) {throw new Error("Failed to fetch settings");}
        const json = await res.json();
        const data = json.data;
        if (Array.isArray(data)) {
          setSettings(data);
          return;
        }

        const settingsPayload =
          data?.settings?.settings ?? data?.settings ?? null;

        if (settingsPayload && typeof settingsPayload === "object") {
          const rows: any[] = [];
          Object.entries(settingsPayload).forEach(([category, values]) => {
            if (values && typeof values === "object" && !Array.isArray(values)) {
              Object.entries(values as Record<string, unknown>).forEach(
                ([key, value]) => {
                  rows.push({
                    setting_key: `${category}.${key}`,
                    setting_value: value,
                    category,
                  });
                },
              );
            } else {
              rows.push({
                setting_key: String(category),
                setting_value: values,
                category: "general",
              });
            }
          });
          setSettings(rows);
          return;
        }

        setSettings([]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load settings",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

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
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </Card>
    );
  }

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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        System Configuration
      </h2>

      {settings.length === 0 ? (
        <Card>
          <div className="p-6">
            <h3 className="mb-4 text-md font-semibold text-gray-900">
              Configuration Overview
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900">Grading System</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Configure grade boundaries and scoring criteria
                </p>
                <Badge variant="default" className="mt-2">
                  Not configured
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900">
                  Notification Preferences
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  Email and SMS notification settings
                </p>
                <Badge variant="default" className="mt-2">
                  Default
                </Badge>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900">Fee Configuration</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Payment methods and billing cycles
                </p>
                <a
                  href="/finance/fee-structures"
                  className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
                >
                  Manage â†’
                </a>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-medium text-gray-900">Report Templates</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Configure report card formats and templates
                </p>
                <a
                  href="/reports"
                  className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
                >
                  Manage â†’
                </a>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Setting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {settings.map((setting: any, idx: number) => (
                  <tr
                    key={setting.setting_id || idx}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {setting.setting_key ||
                        setting.name ||
                        `Setting ${idx + 1}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {typeof setting.setting_value === "object"
                        ? JSON.stringify(setting.setting_value)
                        : String(setting.setting_value || setting.value || "-")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {setting.category || "-"}
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



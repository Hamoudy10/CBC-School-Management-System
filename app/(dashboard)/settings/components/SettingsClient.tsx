"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type SettingsTab = "school" | "academic-years" | "terms" | "classes" | "system";

const settingsTabs: { key: SettingsTab; label: string }[] = [
  { key: "school", label: "School Profile" },
  { key: "academic-years", label: "Academic Years" },
  { key: "terms", label: "Terms" },
  { key: "classes", label: "Classes" },
  { key: "system", label: "System Config" },
];

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");

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
          const altRes = await fetch("/api/settings");
          if (altRes.ok) {
            const json = await altRes.json();
            setSchool(json.data?.school || json.data || null);
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
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchYears() {
      try {
        setLoading(true);
        const res = await fetch("/api/academic-years");
        if (!res.ok) throw new Error("Failed to fetch academic years");
        const json = await res.json();
        setYears(json.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load academic years",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchYears();
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Academic Years</h2>
      </div>

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
                    Year Name
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {years.map((year: any) => (
                  <tr key={year.academic_year_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {year.year_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(year.start_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(year.end_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {year.is_current ? (
                        <Badge variant="success">Current</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
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
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTerms() {
      try {
        setLoading(true);
        const res = await fetch("/api/terms");
        if (!res.ok) throw new Error("Failed to fetch terms");
        const json = await res.json();
        setTerms(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load terms");
      } finally {
        setLoading(false);
      }
    }
    fetchTerms();
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Terms</h2>
      </div>

      {terms.length === 0 ? (
        <EmptyState
          title="No terms configured"
          description="Configure academic terms within your academic years."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Term Name
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {terms.map((term: any) => (
                  <tr key={term.term_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {term.term_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {term.academic_years?.year_name || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(term.start_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(term.end_date).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {term.is_current ? (
                        <Badge variant="success">Current</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
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
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClasses() {
      try {
        setLoading(true);
        const res = await fetch("/api/classes");
        if (!res.ok) throw new Error("Failed to fetch classes");
        const json = await res.json();
        setClasses(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load classes");
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Classes</h2>
        <a
          href="/classes"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Manage Classes →
        </a>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes"
          description="Go to Classes Management to create and manage classes."
          action={{
            label: "Manage Classes",
            onClick: () => (window.location.href = "/classes"),
          }}
        />
      ) : (
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
                    Capacity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {classes.map((cls: any) => (
                  <tr key={cls.class_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {cls.class_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.grade_level || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {cls.stream || "-"}
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

function SystemConfigSection() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const json = await res.json();
        // school_settings may be an array or nested
        const data = json.data;
        if (Array.isArray(data)) {
          setSettings(data);
        } else if (data?.settings) {
          setSettings(Array.isArray(data.settings) ? data.settings : []);
        } else {
          setSettings([]);
        }
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
                  Manage →
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
                  Manage →
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

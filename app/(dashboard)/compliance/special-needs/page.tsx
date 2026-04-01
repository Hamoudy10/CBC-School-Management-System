"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeletons";
import { useToast } from "@/components/ui/Toast";
import { Plus, Search, Filter, Eye, Edit3, X, FileDown } from "lucide-react";
import { NEEDS_TYPE_LABELS, type NeedsType, type SpecialNeed } from "@/features/special-needs";

const NEEDS_TYPE_COLORS: Record<string, "default" | "info" | "warning" | "error" | "success"> = {
  learning_disability: "warning",
  physical_disability: "info",
  visual_impairment: "info",
  hearing_impairment: "info",
  speech_impairment: "info",
  autism_spectrum: "warning",
  adhd: "warning",
  dyslexia: "warning",
  dyscalculia: "warning",
  emotional_behavioral: "error",
  gifted_talented: "success",
  medical_condition: "info",
  other: "default",
};

export default function SpecialNeedsPage() {
  const { user } = useAuth();
  const { success: successToast, error: errorToast } = useToast();
  const [records, setRecords] = useState<SpecialNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SpecialNeed | null>(null);
  const [formData, setFormData] = useState({
    studentId: "",
    needsType: "" as NeedsType | "",
    description: "",
    accommodations: "",
  });

  const pageSize = 20;

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (typeFilter) params.set("needsType", typeFilter);
      if (statusFilter) params.set("isActive", statusFilter);

      const res = await fetch(`/api/special-needs?${params}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      console.error("Failed to load special needs:", err);
    } finally {
      setLoading(false);
    }
  }, [user, page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = search
    ? records.filter(
        (r) =>
          r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
          r.studentAdmissionNo?.toLowerCase().includes(search.toLowerCase()) ||
          r.needsTypeLabel.toLowerCase().includes(search.toLowerCase()),
      )
    : records;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.needsType) {
      errorToast("Validation Error", "Student and needs type are required.");
      return;
    }

    try {
      const res = await fetch("/api/special-needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: formData.studentId,
          needsType: formData.needsType,
          description: formData.description || undefined,
          accommodations: formData.accommodations || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        successToast("Success", json.message);
        setShowModal(false);
        setFormData({ studentId: "", needsType: "", description: "", accommodations: "" });
        fetchRecords();
      } else {
        errorToast("Error", json.error || json.message);
      }
    } catch (err) {
      errorToast("Error", "Failed to save record.");
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/special-needs/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        successToast("Success", json.message);
        fetchRecords();
      } else {
        errorToast("Error", json.error || json.message);
      }
    } catch (err) {
      errorToast("Error", "Failed to deactivate record.");
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("needsType", typeFilter);
      if (statusFilter) params.set("isActive", statusFilter);

      const res = await fetch(`/api/special-needs/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `special-needs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      errorToast("Error", "Failed to export records.");
    }
  };

  const canManage = user && ["super_admin", "school_admin", "principal", "deputy_principal", "class_teacher"].includes(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Special Needs & Accommodations"
        description="Manage student special needs, accommodations, and assessment adjustments."
      >
        <div className="flex gap-2">
          <Button size="sm" variant="outline" leftIcon={<FileDown className="h-4 w-4" />} onClick={handleExport}>
            Export CSV
          </Button>
          {canManage && (
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
              Add Record
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Records</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Active Accommodations</p>
            <p className="mt-2 text-3xl font-semibold text-green-600">
              {records.filter((r) => r.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Unique Needs Types</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {new Set(records.map((r) => r.needsType)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4 text-gray-400" />}
              />
            </div>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-[200px]">
              <option value="">All Types</option>
              {Object.entries(NEEDS_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[150px]">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              title="No special needs records found"
              description="Records for students with special needs and accommodations will appear here."
              icon={<Filter className="h-12 w-12 text-gray-300" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No</TableHead>
                  <TableHead>Needs Type</TableHead>
                  <TableHead>Accommodations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  {canManage && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.specialNeedsId}>
                    <TableCell className="font-medium">{record.studentName || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{record.studentAdmissionNo || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={NEEDS_TYPE_COLORS[record.needsType] ?? "default"}>
                        {record.needsTypeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-gray-500">
                      {record.accommodations || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.isActive ? "success" : "default"}>
                        {record.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(record.updatedAt).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {record.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivate(record.specialNeedsId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setSelectedRecord(null); }}>
        <ModalHeader>
          <ModalTitle>{selectedRecord ? "View Record" : "Add Special Needs Record"}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <Input
                value={formData.studentId}
                onChange={(e) => setFormData((f) => ({ ...f, studentId: e.target.value }))}
                placeholder="Enter student UUID"
                disabled={!!selectedRecord}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Needs Type</label>
              <Select
                value={formData.needsType}
                onChange={(e) => setFormData((f) => ({ ...f, needsType: e.target.value as NeedsType }))}
                disabled={!!selectedRecord}
              >
                <option value="">Select type</option>
                {Object.entries(NEEDS_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the special need"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accommodations</label>
              <Input
                value={formData.accommodations}
                onChange={(e) => setFormData((f) => ({ ...f, accommodations: e.target.value }))}
                placeholder="List accommodations provided"
              />
            </div>
            {selectedRecord && (
              <div className="rounded-lg bg-gray-50 p-4 text-sm">
                <p className="font-medium">Record Details</p>
                <p className="text-gray-500 mt-1">Created: {new Date(selectedRecord.createdAt).toLocaleString()}</p>
                <p className="text-gray-500">Updated: {new Date(selectedRecord.updatedAt).toLocaleString()}</p>
                {selectedRecord.createdByName && <p className="text-gray-500">By: {selectedRecord.createdByName}</p>}
              </div>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowModal(false); setSelectedRecord(null); }}>
            Close
          </Button>
          {!selectedRecord && canManage && (
            <Button onClick={handleSubmit}>Save Record</Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}

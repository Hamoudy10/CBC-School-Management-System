"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ConfirmDialog,
} from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { canManageRole } from "@/lib/auth/permissions";
import type { RoleName } from "@/types/roles";

interface UserRow {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  roleName?: string;
  roles?: {
    name?: string;
  } | null;
}

interface RoleOption {
  roleId: string;
  name: RoleName;
  description?: string;
}

export function UsersClient() {
  const { success, error: toastError } = useToast();
  const { user: currentUser, checkPermission } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<UserRow | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHardDeleting, setIsHardDeleting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    middleName: "",
    phone: "",
    gender: "",
    roleName: "",
  });
  const [editForm, setEditForm] = useState({
    userId: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    middleName: "",
    phone: "",
    gender: "",
    status: "active",
    roleId: "",
  });
  const formRef = useRef<HTMLFormElement | null>(null);

  const canCreate = checkPermission("users", "create");
  const canUpdate = checkPermission("users", "update");
  const canDelete = checkPermission("users", "delete");
  const showActions = canUpdate || canDelete;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) {params.set("search", search);}

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }

      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchRoles = useCallback(async () => {
    if (!canCreate && !canUpdate) {return;}
    const res = await fetch("/api/roles");
    if (!res.ok) {
      throw new Error("Failed to fetch roles");
    }
    const json = await res.json();
    setRoles(json.data || []);
  }, [canCreate, canUpdate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if ((createOpen || editOpen) && roles.length === 0) {
      fetchRoles().catch((err) => {
        toastError(
          "Error",
          err instanceof Error ? err.message : "Failed to fetch roles",
        );
      });
    }
  }, [createOpen, editOpen, fetchRoles, roles.length, toastError]);

  const availableRoles = useMemo(() => {
    if (!currentUser) {return [];}
    return roles.filter((role) => canManageRole(currentUser.role, role.name));
  }, [roles, currentUser]);

  const editRoleOptions = useMemo(() => {
    if (!currentUser) {return [];}
    const manageable = roles.filter((role) =>
      canManageRole(currentUser.role, role.name),
    );
    const currentRole = roles.find((role) => role.roleId === editForm.roleId);
    if (currentRole && !manageable.some((role) => role.roleId === currentRole.roleId)) {
      return [currentRole, ...manageable];
    }
    return manageable;
  }, [roles, currentUser, editForm.roleId]);

  const formatRoleName = (name: string) =>
    name
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const resetForm = () => {
    setForm({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      middleName: "",
      phone: "",
      gender: "",
      roleName: "",
    });
  };

  const resetEditForm = () => {
    setEditForm({
      userId: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      middleName: "",
      phone: "",
      gender: "",
      status: "active",
      roleId: "",
    });
  };

  const collectFormValues = () => {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    const readDomValue = (key: keyof typeof form) => {
      const selector = `[name="${String(key)}"]`;
      const element = formRef.current?.querySelector(selector) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      return element?.value ?? "";
    };
    const getValue = (key: keyof typeof form) => {
      const dataValue = formData?.get(key);
      if (typeof dataValue === "string" && dataValue.length > 0) {
        return dataValue;
      }
      const domValue = readDomValue(key);
      if (domValue.length > 0) {return domValue;}
      return form[key] as string;
    };

    return {
      email: getValue("email"),
      password: getValue("password"),
      firstName: getValue("firstName"),
      lastName: getValue("lastName"),
      middleName: getValue("middleName"),
      phone: getValue("phone"),
      gender: getValue("gender"),
      roleName: getValue("roleName"),
    };
  };

  const validateForm = (values: ReturnType<typeof collectFormValues>) => {
    if (!values.firstName.trim() || !values.lastName.trim()) {
      return "First and last name are required.";
    }

    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(values.firstName.trim()) || !nameRegex.test(values.lastName.trim())) {
      return "Name contains invalid characters.";
    }

    if (!values.email.trim()) {
      return "Email is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(values.email.trim())) {
      return "Enter a valid email address.";
    }

    if (!values.roleName) {
      return "Role is required.";
    }

    if (!values.password) {
      return "Password is required.";
    }

    if (values.password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/;
    if (!passwordRegex.test(values.password)) {
      return "Password must include uppercase, lowercase, number, and special character.";
    }

    return null;
  };

  const getValidationMessage = (details?: Record<string, string[]>) => {
    if (!details) {return null;}
    const firstKey = Object.keys(details)[0];
    const firstMessage = firstKey ? details[firstKey]?.[0] : undefined;
    if (!firstMessage) {return null;}
    return firstKey ? `${firstKey}: ${firstMessage}` : firstMessage;
  };

  const resolveUserId = (row: UserRow) =>
    row.user_id || (row as { userId?: string }).userId || "";

  const resolveUserName = (row: UserRow) => {
    const firstName =
      row.first_name || (row as { firstName?: string }).firstName || "";
    const lastName =
      row.last_name || (row as { lastName?: string }).lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || row.email || "this user";
  };

  const resolveRoleName = (row: UserRow): RoleName | undefined =>
    (row.roleName || row.roles?.name) as RoleName | undefined;

  const openEdit = async (row: UserRow) => {
    const userId = resolveUserId(row);
    if (!userId) {
      toastError("Error", "Unable to determine user ID.");
      return;
    }

    setEditOpen(true);
    setIsEditLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to load user details.");
      }

      const data = result?.data || {};
      setEditForm({
        userId: data.userId || userId,
        email: data.email || row.email || "",
        password: "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        middleName: data.middleName || "",
        phone: data.phone || "",
        gender: data.gender || "",
        status: data.status || "active",
        roleId: data.roleId || "",
      });
    } catch (err) {
      toastError(
        "Error",
        err instanceof Error ? err.message : "Failed to load user details",
      );
      setEditOpen(false);
      resetEditForm();
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleCreate = async () => {
    const values = collectFormValues();
    const validationMessage = validateForm(values);
    if (validationMessage) {
      toastError("Validation error", validationMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          password: values.password,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          middleName: values.middleName.trim() || "",
          phone: values.phone.trim() || "",
          gender: values.gender || undefined,
          roleName: values.roleName,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        const validationMessage = getValidationMessage(result?.details);
        throw new Error(validationMessage || result?.error || "Failed to create user");
      }

      success("User created", result?.data?.message || "User created successfully.");
      if (result?.data?.warning) {
        toastError("Warning", result.data.warning);
      }
      setCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      toastError(
        "Error",
        err instanceof Error ? err.message : "Failed to create user",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateEditForm = (isSelf: boolean) => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      return "First and last name are required.";
    }

    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (
      !nameRegex.test(editForm.firstName.trim()) ||
      !nameRegex.test(editForm.lastName.trim())
    ) {
      return "Name contains invalid characters.";
    }

    if (!isSelf && !editForm.roleId) {
      return "Role is required.";
    }

    return null;
  };

  const handleEditSave = async () => {
    if (!editForm.userId) {
      toastError("Error", "Missing user ID for update.");
      return;
    }

    const isSelf =
      editForm.userId === currentUser?.id ||
      editForm.userId === currentUser?.user_id;
    const validationMessage = validateEditForm(isSelf);
    if (validationMessage) {
      toastError("Validation error", validationMessage);
      return;
    }

    const payload: Record<string, any> = {
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      middleName: editForm.middleName.trim(),
      phone: editForm.phone.trim(),
    };

    if (editForm.email) {
      payload.email = editForm.email.trim();
    }

    if (editForm.password) {
      payload.password = editForm.password;
    }

    if (editForm.gender) {
      payload.gender = editForm.gender;
    }

    if (!isSelf) {
      if (editForm.status) {
        payload.status = editForm.status;
      }
      if (editForm.roleId) {
        payload.roleId = editForm.roleId;
      }
    }

    setIsEditSubmitting(true);
    try {
      const response = await fetch(`/api/users/${editForm.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        const validationMessage = getValidationMessage(result?.details);
        throw new Error(validationMessage || result?.error || "Failed to update user");
      }

      success("User updated", result?.data?.message || "User updated successfully.");
      setEditOpen(false);
      resetEditForm();
      fetchUsers();
    } catch (err) {
      toastError(
        "Error",
        err instanceof Error ? err.message : "Failed to update user",
      );
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) {return;}
    const userId = resolveUserId(deleteConfirm);
    if (!userId) {
      toastError("Error", "Unable to determine user ID.");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to deactivate user.");
      }

      success("User deactivated", result?.data?.message || "User deactivated.");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      toastError(
        "Error",
        err instanceof Error ? err.message : "Failed to deactivate user",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDeleteConfirm = async () => {
    if (!hardDeleteConfirm) {return;}
    const userId = resolveUserId(hardDeleteConfirm);
    if (!userId) {
      toastError("Error", "Unable to determine user ID.");
      return;
    }

    setIsHardDeleting(true);
    try {
      const response = await fetch(`/api/users/${userId}/hard-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to delete user.");
      }

      success("User deleted", result?.data?.message || "User deleted permanently.");
      setHardDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      toastError(
        "Error",
        err instanceof Error ? err.message : "Failed to delete user",
      );
    } finally {
      setIsHardDeleting(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "inactive":
      case "suspended":
      case "archived":
        return "error" as const;
      default:
        return "default" as const;
    }
  };

  const editIsSelf =
    !!editForm.userId &&
    (editForm.userId === currentUser?.id ||
      editForm.userId === currentUser?.user_id);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            type="search"
            placeholder="Search users by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              Create User
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <Card className="p-8">
          <div className="text-sm text-gray-500">Loading users...</div>
        </Card>
      ) : error ? (
        <Card className="p-8">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No users matched the current filters."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  {showActions && (
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((row, index) => {
                  const rowId = resolveUserId(row);
                  const isSelf =
                    !!rowId &&
                    (rowId === currentUser?.id || rowId === currentUser?.user_id);
                  const targetRole = resolveRoleName(row);
                  const canManageTarget =
                    !targetRole ||
                    (!!currentUser && canManageRole(currentUser.role, targetRole));
                  const canEditRow =
                    canUpdate &&
                    !!rowId &&
                    (isSelf || canManageTarget);
                  const canDeleteRow =
                    canDelete && !!rowId && !isSelf && canManageTarget;

                  return (
                    <tr key={rowId || row.email || `user-${index}`}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={resolveUserName(row)}
                          src={(row as any).photoUrl}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {resolveUserName(row)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {row.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {resolveRoleName(row) || "Unassigned"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={getStatusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                    {showActions && (
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(row)}
                              disabled={!canEditRow}
                            >
                              Edit
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(row)}
                              disabled={!canDeleteRow}
                            >
                              Deactivate
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-error-600 hover:text-error-700"
                              onClick={() => setHardDeleteConfirm(row)}
                              disabled={!canDeleteRow}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Create User</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault();
              handleCreate();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                name="firstName"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                required
              />
              <Input
                label="Last Name"
                name="lastName"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                required
              />
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                helperText="Must include uppercase, lowercase, number, and special character."
                required
              />
              <Select
                label="Role"
                name="roleName"
                value={form.roleName}
                onChange={(e) => setForm((prev) => ({ ...prev, roleName: e.target.value }))}
                required
              >
                <option value="">Select role</option>
                {availableRoles.map((role) => (
                  <option key={role.roleId} value={role.name}>
                    {formatRoleName(role.name)}
                  </option>
                ))}
              </Select>
              <Input
                label="Phone (optional)"
                name="phone"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <Select
                label="Gender (optional)"
                name="gender"
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
              >
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
              <Input
                label="Middle Name (optional)"
                name="middleName"
                autoComplete="additional-name"
                value={form.middleName}
                onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
              />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={isSubmitting}>
            Create User
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          resetEditForm();
        }}
        size="lg"
      >
        <ModalHeader>
          <ModalTitle>Edit User</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {isEditLoading ? (
            <div className="text-sm text-gray-500">Loading user...</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                value={editForm.firstName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                required
              />
              <Input
                label="Last Name"
                value={editForm.lastName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                required
              />
              <Input
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
              <Input
                label="New Password (leave blank to keep current)"
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Min 8 chars, upper+lower+number+special"
              />
              <Select
                label="Role"
                value={editForm.roleId}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, roleId: e.target.value }))
                }
                disabled={editIsSelf}
                required
              >
                <option value="">Select role</option>
                {editRoleOptions.map((role) => (
                  <option key={role.roleId} value={role.roleId}>
                    {formatRoleName(role.name)}
                  </option>
                ))}
              </Select>
              <Select
                label="Status"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, status: e.target.value }))
                }
                disabled={editIsSelf}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </Select>
              <Input
                label="Phone (optional)"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
              <Select
                label="Gender (optional)"
                value={editForm.gender}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, gender: e.target.value }))
                }
              >
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
              <Input
                label="Middle Name (optional)"
                value={editForm.middleName}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    middleName: e.target.value,
                  }))
                }
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setEditOpen(false);
              resetEditForm();
            }}
            disabled={isEditSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleEditSave}
            loading={isEditSubmitting}
            disabled={isEditLoading}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Deactivate user?"
        description={`This will disable ${deleteConfirm ? resolveUserName(deleteConfirm) : "this user"} from accessing the system.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={isDeleting}
      />

      <ConfirmDialog
        open={!!hardDeleteConfirm}
        onClose={() => setHardDeleteConfirm(null)}
        onConfirm={handleHardDeleteConfirm}
        title="Delete user permanently?"
        description={`This will permanently remove ${hardDeleteConfirm ? resolveUserName(hardDeleteConfirm) : "this user"} and cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="danger"
        loading={isHardDeleting}
      />
    </div>
  );
}

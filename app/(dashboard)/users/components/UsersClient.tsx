"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";

interface UserRow {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  roles?: {
    name?: string;
  } | null;
}

export function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.set("search", search);

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Input
          type="search"
          placeholder="Search users by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((user, index) => (
                  <tr key={user.user_id || user.email || `user-${index}`}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${user.first_name} ${user.last_name}`}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {user.roles?.name || "Unassigned"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={getStatusVariant(user.status)}>
                        {user.status}
                      </Badge>
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

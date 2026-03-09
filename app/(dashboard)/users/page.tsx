import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { UsersClient } from "./components/UsersClient";

export const metadata: Metadata = {
  title: "Users Management",
  description: "Manage system users, roles, and permissions",
};

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users Management"
        description="Manage system users, roles, and access permissions"
      />
      <UsersClient />
    </div>
  );
}

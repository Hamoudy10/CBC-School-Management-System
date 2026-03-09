import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClassesClient } from "./components/ClassesClient";

export const metadata: Metadata = {
  title: "Classes Management",
  description: "Manage school classes, streams, and grade levels",
};

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes Management"
        description="View and manage all classes, streams, and grade levels"
      />
      <ClassesClient />
    </div>
  );
}

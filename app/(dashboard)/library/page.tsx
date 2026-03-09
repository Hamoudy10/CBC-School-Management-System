import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryClient } from "./components/LibraryClient";

export const metadata: Metadata = {
  title: "Library Management",
  description: "Manage books, inventory, and borrowing records",
};

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library Management"
        description="Manage book inventory, borrowing, and returns"
      />
      <LibraryClient />
    </div>
  );
}

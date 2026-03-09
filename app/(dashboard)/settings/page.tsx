import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsClient } from "./components/SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "System and school configuration settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure school profile, academic settings, and system preferences"
      />
      <SettingsClient />
    </div>
  );
}

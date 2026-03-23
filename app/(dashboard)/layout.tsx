import React from "react";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { getServerUser } from "@/services/auth.server.service";

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
}

export default async function DashboardLayoutWrapper({
  children,
}: DashboardLayoutWrapperProps) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthProvider initialUser={user}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}

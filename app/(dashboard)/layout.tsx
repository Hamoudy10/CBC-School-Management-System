import React from "react";
import { DashboardLayout } from "@/components/layout";

export const dynamic = "force-dynamic";

interface DashboardLayoutWrapperProps {
  children: React.ReactNode;
}

export default function DashboardLayoutWrapper({
  children,
}: DashboardLayoutWrapperProps) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

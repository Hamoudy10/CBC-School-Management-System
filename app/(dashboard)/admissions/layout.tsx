import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";

interface ModuleLayoutProps { children: ReactNode }

export default async function ModuleLayout({ children }: ModuleLayoutProps) {
  await requireRole(["super_admin", "school_admin", "principal", "deputy_principal"]);
  return children;
}

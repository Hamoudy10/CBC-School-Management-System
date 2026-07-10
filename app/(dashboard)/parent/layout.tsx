import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";

interface ModuleLayoutProps { children: ReactNode }

export default async function ModuleLayout({ children }: ModuleLayoutProps) {
  await requireRole(["parent"]);
  return children;
}

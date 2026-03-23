import type { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth/guards";

interface ModuleLayoutProps {
  children: ReactNode;
}

export default async function ModuleLayout({ children }: ModuleLayoutProps) {
  await requireModuleAccess("academics");
  return children;
}

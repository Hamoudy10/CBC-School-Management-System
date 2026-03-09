import Link from "next/link";
import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

interface Shortcut {
  href: string;
  label: string;
  description: string;
}

interface ModulePlaceholderPageProps {
  title: string;
  description: string;
  icon: ReactNode;
  summary: string;
  shortcuts: Shortcut[];
}

export function ModulePlaceholderPage({
  title,
  description,
  icon,
  summary,
  shortcuts,
}: ModulePlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={icon} />

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-xl border border-secondary-200 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-secondary-900">
                    {shortcut.label}
                  </h3>
                  <p className="mt-1 text-sm text-secondary-500">
                    {shortcut.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary-600" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

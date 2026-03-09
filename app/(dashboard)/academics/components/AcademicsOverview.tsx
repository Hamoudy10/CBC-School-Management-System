import Link from "next/link";
import { Card } from "@/components/ui/Card";

interface AcademicsOverviewProps {
  academicYears: any[];
  terms: any[];
  classes: any[];
}

export function AcademicsOverview({
  academicYears,
  terms,
  classes,
}: AcademicsOverviewProps) {
  const cards = [
    {
      label: "Academic Years",
      value: academicYears.length,
      href: "/settings",
      description: "Review active and historical academic years.",
    },
    {
      label: "Terms",
      value: terms.length,
      href: "/settings",
      description: "Manage school terms and current academic context.",
    },
    {
      label: "Classes",
      value: classes.length,
      href: "/classes",
      description: "View classes participating in academic operations.",
    },
    {
      label: "Assessments",
      value: "Open",
      href: "/assessments",
      description: "Record competency assessments and learner progress.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link key={card.label} href={card.href}>
          <Card className="h-full p-6">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-gray-600">{card.description}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

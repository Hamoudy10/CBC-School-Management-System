"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { NLQueryInterface } from "@/features/nl-query/components/NLQueryInterface";

type ClassOption = { classId: string; name: string; gradeName: string };

export default function NLQueryPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");

  useEffect(() => {
    fetch("/api/settings/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setClasses((d.data ?? []).map((c: any) => ({
            classId: c.classId ?? c.class_id ?? c.id,
            name: c.name,
            gradeName: c.gradeName ?? c.grade_name ?? "",
          })).filter((c: any) => c.classId));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Data Query"
        description="Ask questions about your school data in plain English and get instant answers with visualizations"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">All classes...</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId || ""}>
                    {c.name} {c.gradeName ? `- ${c.gradeName}` : ""}
                  </option>
                ))}
              </Select>
          </div>
        </CardContent>
      </Card>

      <NLQueryInterface classId={classId || undefined} />
    </div>
  );
}

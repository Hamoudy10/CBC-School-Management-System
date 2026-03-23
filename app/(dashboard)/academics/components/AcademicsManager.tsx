"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { TabContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useReferenceData } from "@/hooks/useReferenceData";
import type { CBCHierarchy, LearningArea, TeacherSubjectAssignment } from "@/features/academics";

type AcademicsManagerProps = {
  initialLearningAreas: LearningArea[];
};

type TeacherOption = {
  staffId: string;
  fullName: string;
  position: string;
};

type LearningAreaForm = {
  id: string | null;
  name: string;
  description: string;
  isCore: boolean;
};

const EMPTY_FORM: LearningAreaForm = {
  id: null,
  name: "",
  description: "",
  isCore: true,
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || "Request failed");
  }

  return payload.data as T;
}

export function AcademicsManager({ initialLearningAreas }: AcademicsManagerProps) {
  const { success, error } = useToast();
  const { classes, academicYears, activeYear, activeTerm } = useReferenceData();
  const [tab, setTab] = useState("learning-areas");
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>(initialLearningAreas);
  const [selectedLearningAreaId, setSelectedLearningAreaId] = useState(initialLearningAreas[0]?.learningAreaId ?? "");
  const [learningAreaForm, setLearningAreaForm] = useState<LearningAreaForm>(EMPTY_FORM);
  const [hierarchy, setHierarchy] = useState<CBCHierarchy | null>(null);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [strandName, setStrandName] = useState("");
  const [strandDescription, setStrandDescription] = useState("");
  const [strandSortOrder, setStrandSortOrder] = useState("0");
  const [selectedStrandId, setSelectedStrandId] = useState("");
  const [subStrandName, setSubStrandName] = useState("");
  const [subStrandDescription, setSubStrandDescription] = useState("");
  const [subStrandSortOrder, setSubStrandSortOrder] = useState("0");
  const [selectedSubStrandId, setSelectedSubStrandId] = useState("");
  const [competencyName, setCompetencyName] = useState("");
  const [competencyDescription, setCompetencyDescription] = useState("");
  const [competencySortOrder, setCompetencySortOrder] = useState("0");
  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: "",
    learningAreaId: initialLearningAreas[0]?.learningAreaId ?? "",
    classId: "",
    academicYearId: "",
    termId: "",
  });

  const strands = useMemo(() => hierarchy?.strands.map((entry) => entry.strand) ?? [], [hierarchy]);
  const subStrands = useMemo(
    () => hierarchy?.strands.flatMap((entry) => entry.subStrands.map((item) => item.subStrand)) ?? [],
    [hierarchy],
  );

  useEffect(() => {
    if (!assignmentForm.academicYearId && activeYear?.id) {
      setAssignmentForm((prev) => ({ ...prev, academicYearId: activeYear.id }));
    }
  }, [activeYear, assignmentForm.academicYearId]);

  useEffect(() => {
    if (!assignmentForm.termId && activeTerm?.id) {
      setAssignmentForm((prev) => ({ ...prev, termId: activeTerm.id }));
    }
  }, [activeTerm, assignmentForm.termId]);

  const loadLearningAreas = useCallback(async () => {
    const response = await fetch("/api/learning-areas?pageSize=200", { credentials: "include" });
    const data = await parseResponse<LearningArea[]>(response);
    setLearningAreas(data);
    setSelectedLearningAreaId((current) =>
      data.some((item) => item.learningAreaId === current)
        ? current
        : data[0]?.learningAreaId || "",
    );
  }, []);

  const loadHierarchy = useCallback(async () => {
    if (!selectedLearningAreaId) {
      setHierarchy(null);
      return;
    }

    setLoadingHierarchy(true);
    try {
      const response = await fetch(`/api/learning-areas/${selectedLearningAreaId}/hierarchy`, {
        credentials: "include",
      });
      const data = await parseResponse<CBCHierarchy>(response);
      setHierarchy(data);
      setSelectedStrandId((current) => current || data.strands[0]?.strand.strandId || "");
      setSelectedSubStrandId((current) => current || data.strands[0]?.subStrands[0]?.subStrand.subStrandId || "");
    } catch (err) {
      setHierarchy(null);
      error("Hierarchy", err instanceof Error ? err.message : "Failed to load hierarchy");
    } finally {
      setLoadingHierarchy(false);
    }
  }, [error, selectedLearningAreaId]);

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const response = await fetch("/api/teacher-subjects?pageSize=200", { credentials: "include" });
      const data = await parseResponse<TeacherSubjectAssignment[]>(response);
      setAssignments(data);
    } catch (err) {
      error("Assignments", err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoadingAssignments(false);
    }
  }, [error]);

  const loadTeachers = useCallback(async () => {
    try {
      const response = await fetch("/api/staff?pageSize=200", { credentials: "include" });
      const data = await parseResponse<any[]>(response);
      setTeachers(
        data
          .filter((item) => ["teacher", "class_teacher", "subject_teacher"].includes(item.position ?? ""))
          .map((item) => ({
            staffId: item.staffId,
            fullName: `${item.firstName} ${item.lastName}`.trim(),
            position: item.position,
          })),
      );
    } catch {
      setTeachers([]);
    }
  }, []);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  useEffect(() => {
    loadAssignments();
    loadTeachers();
  }, [loadAssignments, loadTeachers]);

  const saveEntity = async (
    endpoint: string,
    method: "POST" | "PATCH" | "DELETE",
    payload?: Record<string, unknown>,
    message?: string,
  ) => {
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: payload ? JSON.stringify(payload) : undefined,
      });
      await parseResponse(response);
      if (message) {
        success("Academics", message);
      }
      await loadLearningAreas();
      await loadHierarchy();
      await loadAssignments();
    } catch (err) {
      error("Academics", err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="learning-areas">Learning Areas</TabsTrigger>
        <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
        <TabsTrigger value="assignments">Assignments</TabsTrigger>
      </TabsList>

      <TabContent value="learning-areas">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Learning Areas</CardTitle>
              <CardDescription>Manage core and optional CBC subjects.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {learningAreas.length === 0 ? (
                <EmptyState title="No learning areas" description="Create a learning area to start building the curriculum tree." />
              ) : (
                learningAreas.map((item) => (
                  <div key={item.learningAreaId} className={`rounded-lg border p-4 ${selectedLearningAreaId === item.learningAreaId ? "border-primary-300 bg-primary-50/40" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <Badge variant={item.isCore ? "success" : "default"}>{item.isCore ? "Core" : "Optional"}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{item.description || "No description."}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setSelectedLearningAreaId(item.learningAreaId);
                          setAssignmentForm((prev) => ({ ...prev, learningAreaId: item.learningAreaId }));
                        }}>Open</Button>
                        <Button size="sm" variant="ghost" onClick={() => setLearningAreaForm({ id: item.learningAreaId, name: item.name, description: item.description || "", isCore: item.isCore })}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => saveEntity(`/api/learning-areas/${item.learningAreaId}`, "DELETE", undefined, "Learning area deleted.")}>Delete</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{learningAreaForm.id ? "Edit learning area" : "Create learning area"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                saveEntity(
                  learningAreaForm.id ? `/api/learning-areas/${learningAreaForm.id}` : "/api/learning-areas",
                  learningAreaForm.id ? "PATCH" : "POST",
                  {
                    name: learningAreaForm.name,
                    description: learningAreaForm.description,
                    isCore: learningAreaForm.isCore,
                    applicableGrades: [],
                  },
                  learningAreaForm.id ? "Learning area updated." : "Learning area created.",
                ).then(() => setLearningAreaForm(EMPTY_FORM));
              }}>
                <Input label="Name" value={learningAreaForm.name} onChange={(e) => setLearningAreaForm((prev) => ({ ...prev, name: e.target.value }))} required />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea className="min-h-[110px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={learningAreaForm.description} onChange={(e) => setLearningAreaForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={learningAreaForm.isCore} onChange={(e) => setLearningAreaForm((prev) => ({ ...prev, isCore: e.target.checked }))} />
                  Core learning area
                </label>
                <div className="flex gap-2">
                  <Button type="submit" loading={submitting}>{learningAreaForm.id ? "Update" : "Create"}</Button>
                  {learningAreaForm.id ? <Button type="button" variant="ghost" onClick={() => setLearningAreaForm(EMPTY_FORM)}>Cancel</Button> : null}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabContent>

      <TabContent value="curriculum">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Curriculum Tree</CardTitle>
                  <CardDescription>{learningAreas.find((item) => item.learningAreaId === selectedLearningAreaId)?.name || "Select a learning area."}</CardDescription>
                </div>
                <Select value={selectedLearningAreaId} onChange={(e) => setSelectedLearningAreaId(e.target.value)}>
                  <option value="">Select learning area</option>
                  {learningAreas.map((item) => <option key={item.learningAreaId} value={item.learningAreaId}>{item.name}</option>)}
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHierarchy ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : !hierarchy ? <EmptyState title="No hierarchy" description="Select a learning area to manage strands, sub-strands, and competencies." /> : (
                <div className="space-y-4">
                  {hierarchy.strands.map(({ strand, subStrands: items }) => (
                    <div key={strand.strandId} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{strand.name}</h3>
                          <p className="text-sm text-gray-500">{strand.description || "No description."}</p>
                        </div>
                        <Button size="sm" variant="danger" onClick={() => saveEntity(`/api/strands/${strand.strandId}`, "DELETE", undefined, "Strand deleted.")}>Delete</Button>
                      </div>
                      <div className="mt-4 space-y-3 pl-4">
                        {items.map(({ subStrand, competencies }) => (
                          <div key={subStrand.subStrandId} className="rounded-lg bg-gray-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-medium text-gray-900">{subStrand.name}</h4>
                                <p className="text-sm text-gray-500">{subStrand.description || "No description."}</p>
                              </div>
                              <Button size="sm" variant="danger" onClick={() => saveEntity(`/api/sub-strands/${subStrand.subStrandId}`, "DELETE", undefined, "Sub-strand deleted.")}>Delete</Button>
                            </div>
                            <div className="mt-3 space-y-2 pl-4">
                              {competencies.length === 0 ? <p className="text-sm text-gray-400">No competencies yet.</p> : competencies.map((competency) => (
                                <div key={competency.competencyId} className="flex items-start justify-between gap-3 rounded-md bg-white p-3">
                                  <div>
                                    <p className="font-medium text-gray-900">{competency.name}</p>
                                    <p className="text-sm text-gray-500">{competency.description || "No description."}</p>
                                  </div>
                                  <Button size="sm" variant="danger" onClick={() => saveEntity(`/api/competencies/${competency.competencyId}`, "DELETE", undefined, "Competency deleted.")}>Delete</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card><CardHeader><CardTitle>Add Strand</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveEntity("/api/strands", "POST", { learningAreaId: selectedLearningAreaId, name: strandName, description: strandDescription, sortOrder: Number(strandSortOrder || 0) }, "Strand created.").then(() => { setStrandName(""); setStrandDescription(""); setStrandSortOrder("0"); }); }}><Input label="Name" value={strandName} onChange={(e) => setStrandName(e.target.value)} required /><Input label="Sort order" type="number" value={strandSortOrder} onChange={(e) => setStrandSortOrder(e.target.value)} /><textarea className="min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={strandDescription} onChange={(e) => setStrandDescription(e.target.value)} placeholder="Description" /><Button type="submit" loading={submitting} disabled={!selectedLearningAreaId}>Create strand</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle>Add Sub-strand</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveEntity("/api/sub-strands", "POST", { strandId: selectedStrandId, name: subStrandName, description: subStrandDescription, sortOrder: Number(subStrandSortOrder || 0) }, "Sub-strand created.").then(() => { setSubStrandName(""); setSubStrandDescription(""); setSubStrandSortOrder("0"); }); }}><Select value={selectedStrandId} onChange={(e) => setSelectedStrandId(e.target.value)}><option value="">Select strand</option>{strands.map((strand) => <option key={strand.strandId} value={strand.strandId}>{strand.name}</option>)}</Select><Input label="Name" value={subStrandName} onChange={(e) => setSubStrandName(e.target.value)} required /><Input label="Sort order" type="number" value={subStrandSortOrder} onChange={(e) => setSubStrandSortOrder(e.target.value)} /><textarea className="min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={subStrandDescription} onChange={(e) => setSubStrandDescription(e.target.value)} placeholder="Description" /><Button type="submit" loading={submitting} disabled={!selectedStrandId}>Create sub-strand</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle>Add Competency</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveEntity("/api/competencies", "POST", { subStrandId: selectedSubStrandId, name: competencyName, description: competencyDescription, sortOrder: Number(competencySortOrder || 0) }, "Competency created.").then(() => { setCompetencyName(""); setCompetencyDescription(""); setCompetencySortOrder("0"); }); }}><Select value={selectedSubStrandId} onChange={(e) => setSelectedSubStrandId(e.target.value)}><option value="">Select sub-strand</option>{subStrands.map((item) => <option key={item.subStrandId} value={item.subStrandId}>{item.name}</option>)}</Select><Input label="Name" value={competencyName} onChange={(e) => setCompetencyName(e.target.value)} required /><Input label="Sort order" type="number" value={competencySortOrder} onChange={(e) => setCompetencySortOrder(e.target.value)} /><textarea className="min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={competencyDescription} onChange={(e) => setCompetencyDescription(e.target.value)} placeholder="Description" /><Button type="submit" loading={submitting} disabled={!selectedSubStrandId}>Create competency</Button></form></CardContent></Card>
          </div>
        </div>
      </TabContent>

      <TabContent value="assignments">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card><CardHeader><CardTitle>Create Assignment</CardTitle><CardDescription>Link teachers to learning areas and classes for the active term.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveEntity("/api/teacher-subjects", "POST", assignmentForm, "Assignment created."); }}><Select value={assignmentForm.teacherId} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, teacherId: e.target.value }))}><option value="">Select teacher</option>{teachers.map((teacher) => <option key={teacher.staffId} value={teacher.staffId}>{teacher.fullName} ({teacher.position})</option>)}</Select><Select value={assignmentForm.learningAreaId} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, learningAreaId: e.target.value }))}><option value="">Select learning area</option>{learningAreas.map((item) => <option key={item.learningAreaId} value={item.learningAreaId}>{item.name}</option>)}</Select><Select value={assignmentForm.classId} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, classId: e.target.value }))}><option value="">Select class</option>{classes.map((item) => <option key={item.classId} value={item.classId}>{item.name}</option>)}</Select><Select value={assignmentForm.academicYearId} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, academicYearId: e.target.value }))}><option value="">Select academic year</option>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.year}</option>)}</Select><Select value={assignmentForm.termId} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, termId: e.target.value }))}><option value="">Select term</option>{activeTerm ? <option value={activeTerm.id}>{activeTerm.name}</option> : null}</Select><Button type="submit" loading={submitting} disabled={!assignmentForm.teacherId || !assignmentForm.learningAreaId || !assignmentForm.classId || !assignmentForm.academicYearId || !assignmentForm.termId}>Create assignment</Button></form></CardContent></Card>
          <Card><CardHeader><CardTitle>Assignments</CardTitle><CardDescription>Current teacher-subject mappings.</CardDescription></CardHeader><CardContent className="space-y-3">{loadingAssignments ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> : assignments.length === 0 ? <EmptyState title="No assignments" description="Create an assignment to connect curriculum delivery to classes." /> : assignments.map((assignment) => <div key={assignment.id} className="rounded-lg border border-gray-200 p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-gray-900">{assignment.learningAreaName || "Learning area"}</h3><Badge variant={assignment.isActive ? "success" : "default"}>{assignment.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-sm text-gray-500">{assignment.teacherName || "Teacher"} · {assignment.className || "Class"} · {assignment.termName || "Term"}</p></div>{assignment.isActive ? <Button size="sm" variant="danger" onClick={() => saveEntity(`/api/teacher-subjects/${assignment.id}`, "DELETE", undefined, "Assignment deactivated.")}>Deactivate</Button> : null}</div></div>)}</CardContent></Card>
        </div>
      </TabContent>
    </Tabs>
  );
}

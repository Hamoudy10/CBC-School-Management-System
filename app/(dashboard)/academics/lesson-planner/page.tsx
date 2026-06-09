'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpenCheck, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
}

interface CompetencyNode { id: string; name: string }
interface SubStrandNode { id: string; name: string; competencies: CompetencyNode[] }
interface StrandNode { id: string; name: string; subStrands: SubStrandNode[] }
interface LearningAreaNode { id: string; name: string; strands: StrandNode[] }

interface LessonPlanData {
  result: {
    objectives: string[];
    activities: string[];
    materials: string[];
    assessment: string[];
    cbcCompetenciesMapped: string[];
  };
  context: { class: any; learning_area: any; strand: any; sub_strand: any; competency: any; warnings: string[] };
  confidence: number;
  warnings: string[];
}

function normalizeHierarchy(raw: any[]): LearningAreaNode[] {
  return (raw ?? []).map((la) => ({
    id: la.learning_area_id ?? la.learningAreaId ?? '',
    name: la.name ?? 'Learning Area',
    strands: (la.strands ?? []).map((s: any) => ({
      id: s.strand_id ?? s.strandId ?? '',
      name: s.name ?? 'Strand',
      subStrands: (s.sub_strands ?? s.subStrands ?? []).map((sub: any) => ({
        id: sub.sub_strand_id ?? sub.subStrandId ?? '',
        name: sub.name ?? 'Sub-strand',
        competencies: (sub.competencies ?? []).map((c: any) => ({
          id: c.competency_id ?? c.competencyId ?? '',
          name: c.name ?? 'Competency',
        })),
      })),
    })),
  }));
}

export default function LessonPlannerPage() {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [hierarchy, setHierarchy] = useState<LearningAreaNode[]>([]);

  const [classId, setClassId] = useState('');
  const [learningAreaId, setLearningAreaId] = useState('');
  const [strandId, setStrandId] = useState('');
  const [subStrandId, setSubStrandId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('40');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LessonPlanData | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      try {
        const [refRes, hierRes] = await Promise.all([
          fetch('/api/settings/reference-data?includeLearningAreas=true', { credentials: 'include' }),
          fetch('/api/learning-areas?includeHierarchy=true', { credentials: 'include' }),
        ]);
        const refJson = await refRes.json();
        const hierJson = await hierRes.json();
        if (!active) return;
        if (refRes.ok) {
          setClasses((refJson.data?.classes ?? []).map((c: any) => ({
            classId: c.classId, name: c.name, gradeName: c.gradeName || `Grade ${c.gradeLevel ?? ''}`,
          })));
        }
        if (hierRes.ok) {
          setHierarchy(normalizeHierarchy(hierJson.data ?? []));
        }
      } catch { error('Failed to load data'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [user, error]);

  const selectedLearningArea = useMemo(() => hierarchy.find((la) => la.id === learningAreaId), [hierarchy, learningAreaId]);
  const availableStrands = selectedLearningArea?.strands ?? [];
  const selectedStrand = useMemo(() => availableStrands.find((s) => s.id === strandId), [availableStrands, strandId]);
  const availableSubStrands = selectedStrand?.subStrands ?? [];

  const handleGenerate = useCallback(async () => {
    if (!classId || !learningAreaId || !strandId || !subStrandId) {
      error('Select class, learning area, strand, and sub-strand');
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/cbc-copilot/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          classId, learningAreaId, strandId, subStrandId,
          durationMinutes: Number(durationMinutes),
          additionalInstructions: additionalInstructions || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      setResult(json.data);
      success('Lesson plan generated');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to generate lesson plan');
    } finally { setGenerating(false); }
  }, [classId, learningAreaId, strandId, subStrandId, durationMinutes, additionalInstructions, success, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson Plan Generator"
        description="Generate CBC-aligned lesson plans with objectives, activities, and assessments"
        icon={<BookOpenCheck className="h-6 w-6" />}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Curriculum Context</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Class *">
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.classId} value={c.classId}>{c.name} ({c.gradeName})</option>)}
            </Select>
            <Select value={learningAreaId} onChange={(e) => { setLearningAreaId(e.target.value); setStrandId(''); setSubStrandId(''); }} placeholder="Learning Area *">
              <option value="">Select learning area</option>
              {hierarchy.map((la) => <option key={la.id} value={la.id}>{la.name}</option>)}
            </Select>
          </div>
          {selectedLearningArea && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select value={strandId} onChange={(e) => { setStrandId(e.target.value); setSubStrandId(''); }} placeholder="Strand *">
                <option value="">Select strand</option>
                {availableStrands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select value={subStrandId} onChange={(e) => setSubStrandId(e.target.value)} placeholder="Sub-strand *">
                <option value="">Select sub-strand</option>
                {availableSubStrands.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration (minutes)</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                type="number" min={10} max={180} value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional Instructions</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional instructions..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
              />
            </div>
          </div>
          <Button leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>
            Generate Lesson Plan
          </Button>
        </CardContent>
      </Card>

      {generating && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500">Generating CBC-aligned lesson plan...</span>
          </CardContent>
        </Card>
      )}

      {result && !generating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Generated Lesson Plan
              <Badge variant="info" size="sm">Confidence: {result.confidence}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.warnings?.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>{result.warnings.join(', ')}</AlertDescription>
              </Alert>
            )}

            <Section title="Learning Objectives" items={result.result.objectives} />
            <Section title="Learning Activities" items={result.result.activities} />
            <Section title="Materials & Resources" items={result.result.materials} />
            <Section title="Assessment Methods" items={result.result.assessment} />
            <Section title="CBC Competencies Mapped" items={result.result.cbcCompetenciesMapped} />

            <div className="flex gap-2">
              <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleGenerate} loading={generating}>
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {(items ?? []).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';

interface ParentSummaryGeneratorProps {
  onSummaryGenerated?: (summary: string) => void;
}

export function ParentSummaryGenerator({ onSummaryGenerated }: ParentSummaryGeneratorProps) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [summary, setSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    if (!studentId || !studentName || !className || !term || !year || !schoolName) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedSummary = [
        `Dear Parent,`,
        '',
        `We are pleased to share ${studentName}'s ${term.replace('_', ' ')} update.`,
        `${studentName} has shown consistent growth in class ${className} and attends school regularly.`,
        '',
        'Highlights:',
        '- Strong participation during lessons.',
        '- Steady progress across learning activities.',
        '- Positive classroom behavior and effort.',
        '',
        'Areas to support at home:',
        '- Encourage daily reading and short written reflections.',
        '- Continue practicing core math facts for fluency.',
        '- Keep regular communication with the class teacher.',
        '',
        `Thank you for your continued partnership with ${schoolName}.`,
        `Together, we can keep ${studentName} on a strong learning path.`,
      ].join('\n');

      setSummary(generatedSummary);
      if (onSummaryGenerated) {
        onSummaryGenerated(generatedSummary);
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate summary.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(summary);
  };

  const downloadSummary = () => {
    const file = new Blob([summary], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `${studentName.replace(/\s+/g, '_')}_Parent_Summary_${term}_${year}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearForm = () => {
    setStudentId('');
    setStudentName('');
    setClassName('');
    setTerm('');
    setYear('');
    setSchoolName('');
    setSummary('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Parent-Friendly Summary Generator</CardTitle>
          <CardDescription>
            Create clear and encouraging summaries that families can understand quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input id="student-id" label="Student ID" placeholder="e.g., STU001" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
            <Input id="student-name" label="Student Name" placeholder="e.g., John Doe" value={studentName} onChange={(event) => setStudentName(event.target.value)} />
            <Input id="class" label="Class" placeholder="e.g., Grade 5" value={className} onChange={(event) => setClassName(event.target.value)} />

            <Select id="term" label="Term" value={term} onChange={(event) => setTerm(event.target.value)}>
              <option value="">Select term</option>
              <option value="TERM_1">First Term</option>
              <option value="TERM_2">Second Term</option>
              <option value="TERM_3">Third Term</option>
            </Select>

            <Select id="year" label="Academic Year" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="">Select year</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2025_2026">2025-2026</option>
            </Select>

            <Input id="school-name" label="School Name" placeholder="e.g., Example Primary School" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
          </div>

          <div className="mt-6 flex gap-2">
            <Button onClick={generateSummary} disabled={isGenerating} className="flex-1">
              {isGenerating ? 'Generating...' : 'Generate Summary'}
            </Button>
            <Button onClick={clearForm} variant="outline">
              Clear
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Parent-Friendly Summary</span>
              <div className="flex gap-2">
                <Button onClick={() => void copyToClipboard()} variant="outline" size="sm">
                  Copy
                </Button>
                <Button onClick={downloadSummary} variant="outline" size="sm">
                  Download
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="whitespace-pre-line text-sm leading-relaxed">{summary}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

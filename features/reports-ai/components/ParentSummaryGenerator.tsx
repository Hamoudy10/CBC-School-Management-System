'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReportUtils } from '../utils/report-utils';

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

  const reportUtils = new ReportUtils();

  const generateSummary = async () => {
    if (!studentId || !studentName || !className || !term || !year || !schoolName) {
      setError('Please fill in all required fields');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Mock report data for demonstration
      const mockReportData = {
        student_info: {
          id: studentId,
          name: studentName,
          admission_number: `ADM${Math.floor(Math.random() * 1000)}`,
          class: className,
          class_teacher: 'Mrs. Wangari',
          term: term,
          year: year,
          school_name: schoolName
        },
        learning_areas: [
          {
            code: 'MAT',
            name: 'Mathematics',
            score: 75,
            level: 'Meeting Expectations',
            comment: 'Good understanding of basic operations',
            competencies: [
              {
                code: 'MAT.01',
                name: 'Number Sense',
                score: 80,
                level: 'Meeting Expectations',
                comment: 'Strong understanding of place value'
              },
              {
                code: 'MAT.02',
                name: 'Operations',
                score: 70,
                level: 'Meeting Expectations',
                comment: 'Good with addition and subtraction'
              }
            ]
          },
          {
            code: 'ENG',
            name: 'English',
            score: 85,
            level: 'Exceeding Expectations',
            comment: 'Excellent reading comprehension',
            competencies: [
              {
                code: 'ENG.01',
                name: 'Reading',
                score: 90,
                level: 'Exceeding Expectations',
                comment: 'Fluent reader with good comprehension'
              },
              {
                code: 'ENG.02',
                name: 'Writing',
                score: 80,
                level: 'Meeting Expectations',
                comment: 'Clear writing with good structure'
              }
            ]
          }
        ],
        summary: {
          total_subjects: 2,
          average_score: 80,
          overall_level: 'Good',
          attendance_percentage: 95,
          total_days_present: 95,
          total_days_absent: 5
        }
      };

      // Generate AI summary using the mock data
      const aiPrompt = `
Generate a warm, encouraging parent-friendly summary for the following CBC report:

Student: ${studentName}
Class: ${className}
School: ${schoolName}
Term: ${term}

Report Data:
${JSON.stringify(mockReportData, null, 2)}

Requirements:
1. Write in warm, encouraging language that parents can easily understand
2. Highlight specific achievements and strengths
3. Address areas for improvement constructively
4. Provide clear next steps for parents
5. Use simple, accessible language (avoid educational jargon)
6. Be 150-300 words long
7. End with a positive and encouraging tone

Return only the summary text.
`;

      // Mock AI response
      const mockSummary = `Dear Parent,

We're delighted to share ${studentName}'s progress report for ${term}. Your child has shown excellent growth in several areas! 🎉

**Strengths:**
- Reading comprehension is outstanding - ${studentName} is reading fluently with great understanding
- Mathematical reasoning skills are developing well
- Attendance has been excellent at 95%
- ${studentName} participates actively in class discussions

**Areas for Growth:**
- Writing skills could use more practice, especially creative writing
- Multiplication and division facts need reinforcement

**Next Steps:**
- Encourage daily reading at home
- Practice math facts through games and activities
- Provide opportunities for writing practice

${studentName} is making wonderful progress! Thank you for your continued support at home. Together, we're helping ${studentName} build a strong foundation for future learning.

Warm regards,
The ${schoolName} Team`;

      setSummary(mockSummary);
      
      if (onSummaryGenerated) {
        onSummaryGenerated(mockSummary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    alert('Summary copied to clipboard!');
  };

  const downloadSummary = () => {
    const element = document.createElement('a');
    const file = new Blob([summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${studentName.replace(/\s+/g, '_')}_Parent_Summary_${term}_${year}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
            Create warm, encouraging summaries that parents can easily understand
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="student-id">Student ID</Label>
              <Input
                id="student-id"
                placeholder="e.g., STU001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="student-name">Student Name</Label>
              <Input
                id="student-name"
                placeholder="e.g., John Doe"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="class">Class</Label>
              <Input
                id="class"
                placeholder="e.g., Grade 5"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="term">Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TERM_1">First Term</SelectItem>
                  <SelectItem value="TERM_2">Second Term</SelectItem>
                  <SelectItem value="TERM_3">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">Academic Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2025_2026">2025-2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="school-name">School Name</Label>
              <Input
                id="school-name"
                placeholder="e.g., Example Primary School"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button 
              onClick={generateSummary}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? 'Generating...' : 'Generate Summary'}
            </Button>
            <Button onClick={clearForm} variant="outline">
              Clear
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
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
                <Button onClick={copyToClipboard} variant="outline" size="sm">
                  Copy
                </Button>
                <Button onClick={downloadSummary} variant="outline" size="sm">
                  Download
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Summary Features:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✅ Warm, encouraging tone</li>
                  <li>✅ Specific achievements highlighted</li>
                  <li>✅ Constructive improvement areas</li>
                  <li>✅ Clear next steps for parents</li>
                  <li>✅ Simple, accessible language</li>
                  <li>✅ Positive closing message</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
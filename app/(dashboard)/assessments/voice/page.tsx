// app/(dashboard)/assessments/voice/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  Square,
  RotateCcw,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Volume2,
  GraduationCap,
  BookOpen,
  Layers,
  Target,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useVoiceRecorder } from '@/features/voice-mark-entry/components/useVoiceRecorder';
import type { VoiceMarkEntryResult } from '@/features/voice-mark-entry/types';

interface ClassOption {
  classId: string;
  name: string;
  gradeName: string;
  studentCount: number;
}

export default function VoiceMarkEntryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses, isLoading: isReferenceLoading } = useReferenceData({ enabled: Boolean(user) });

  const {
    isRecording,
    transcript,
    interimTranscript,
    error: recorderError,
    isSupported,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useVoiceRecorder();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VoiceMarkEntryResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const classes: ClassOption[] = (referenceClasses || []).map((c: any) => ({
    classId: c.classId || c.id,
    name: c.name,
    gradeName: c.gradeName || c.grade_level || '',
    studentCount: c.studentCount || c.student_count || 0,
  }));

  const handleStartRecording = useCallback(() => {
    setResult(null);
    startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleReset = useCallback(() => {
    resetTranscript();
    setResult(null);
  }, [resetTranscript]);

  const handleParse = useCallback(async () => {
    if (!transcript.trim()) {return;}

    setIsProcessing(true);

    try {
      const response = await fetch('/api/voice-mark-entry/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcribedText: transcript.trim(),
          classId: selectedClassId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse assessment');
      }

      setResult(data.data);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to process voice entry');
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, selectedClassId, error]);

  const handleSave = useCallback(async () => {
    if (!result?.parsedAssessment) {return;}

    setIsSaving(true);

    try {
      const textToCopy = `${result.parsedAssessment.studentName}: ${result.parsedAssessment.subject} - ${result.parsedAssessment.strand} → Score ${result.parsedAssessment.score}/4${result.parsedAssessment.remarks ? ` (${result.parsedAssessment.remarks})` : ''}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Copied to clipboard. Enter it in the Score Entry tab.');
    } catch {
      setCopied(true);
    } finally {
      setIsSaving(false);
    }
  }, [result, success]);

  const handleRecordAnother = useCallback(() => {
    resetTranscript();
    setResult(null);
  }, [resetTranscript]);

  const canRecord = isSupported && !isRecording;
  const hasTranscript = transcript.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice Mark Entry"
        description="Dictate assessment scores using your microphone"
        icon={<Mic className="h-6 w-6" />}
      />

      {/* Browser Support Warning */}
      {!isSupported && (
        <Alert variant="warning">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Browser Not Supported</AlertTitle>
          <AlertDescription>
            Voice recording requires Chrome or Edge. Your current browser does not support the Web Speech API.
          </AlertDescription>
        </Alert>
      )}

      {recorderError && (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Recording Error</AlertTitle>
          <AlertDescription>{recorderError}</AlertDescription>
        </Alert>
      )}

      {/* Class Selector + Recording Controls */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5" />
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={isRecording}
              placeholder="Select a class"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.classId} value={cls.classId}>
                  {cls.name} ({cls.studentCount} students)
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Volume2 className="h-5 w-5" />
                Voice Recorder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                {/* Recording Button */}
                <div className="flex items-center gap-4">
                  {!isRecording ? (
                    <Button
                      size="xl"
                      variant="primary"
                      leftIcon={<Mic className="h-6 w-6" />}
                      onClick={handleStartRecording}
                      disabled={!canRecord}
                      className="h-16 w-16 rounded-full"
                    >
                      Record
                    </Button>
                  ) : (
                    <Button
                      size="xl"
                      variant="danger"
                      leftIcon={<Square className="h-6 w-6" />}
                      onClick={handleStopRecording}
                      className="h-16 w-16 rounded-full animate-pulse"
                    >
                      Stop
                    </Button>
                  )}

                  {hasTranscript && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RotateCcw className="h-4 w-4" />}
                      onClick={handleReset}
                    >
                      Reset
                    </Button>
                  )}
                </div>

                {/* Recording indicator */}
                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    Recording... speak clearly
                  </div>
                )}

                {/* Live Transcript */}
                {isRecording && (
                  <div className="w-full max-w-2xl">
                    <div className="rounded-lg border bg-gray-50 p-4 min-h-[60px]">
                      {interimTranscript ? (
                        <p className="text-gray-500 italic">{interimTranscript}</p>
                      ) : (
                        <p className="text-gray-400 italic text-sm">Listening...</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Final Transcript */}
                {hasTranscript && !isRecording && (
                  <div className="w-full max-w-2xl space-y-2">
                    <div className="rounded-lg border bg-white p-4">
                      <p className="text-sm font-medium text-gray-900">{transcript.trim()}</p>
                    </div>
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="primary"
                        leftIcon={<ArrowRight className="h-4 w-4" />}
                        onClick={handleParse}
                        loading={isProcessing}
                      disabled={isProcessing}
                      >
                        Parse Assessment
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Analyzing dictation with AI...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsed Result */}
      {result && !isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5" />
              Parsed Assessment
              {result.warnings.length > 0 && (
                <Badge variant="warning" size="sm">{result.warnings.length} warnings</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.parsedAssessment ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Student Name */}
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Student
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {result.parsedAssessment.studentName}
                    </p>
                  </div>

                  {/* Subject */}
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      Learning Area
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {result.parsedAssessment.subject}
                    </p>
                  </div>

                  {/* Strand */}
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                      <Layers className="h-3.5 w-3.5" />
                      Strand
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {result.parsedAssessment.strand}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                      <Target className="h-3.5 w-3.5" />
                      Score
                    </div>
                    <Badge
                      variant={
                        result.parsedAssessment.score >= 3
                          ? result.parsedAssessment.score === 4 ? 'exceeding' : 'meeting'
                          : result.parsedAssessment.score === 2
                            ? 'approaching'
                            : 'below_expectation'
                      }
                      size="md"
                    >
                      {result.parsedAssessment.score}/4
                    </Badge>
                  </div>
                </div>

                {/* Remarks */}
                {result.parsedAssessment.remarks && (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Remarks</p>
                    <p className="text-sm text-gray-900">{result.parsedAssessment.remarks}</p>
                  </div>
                )}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 text-sm">
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-4 pt-2">
                  <Button
                    variant="primary"
                    leftIcon={copied ? <CheckCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    onClick={handleRecordAnother}
                  >
                    Record Another
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/assessments')}
                  >
                    Score Entry Tab
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could Not Parse</AlertTitle>
                  <AlertDescription>
                    AI could not extract assessment data from your dictation. Try being more specific.
                    Example: <em>&ldquo;John Kamau scores 3 in mathematics, strand: measurements&rdquo;</em>
                  </AlertDescription>
                </Alert>

                {result.warnings.map((w, i) => (
                  <p key={i} className="text-sm text-gray-500">{w}</p>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={handleRecordAnother}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-5 w-5" />
            Tips for Best Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-600" />
              Speak clearly and at a moderate pace. Include the student&apos;s full name.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-600" />
              Use format: <em>&ldquo;Student Name scores [1-4] in [subject], strand: [name]&rdquo;</em>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-600" />
              Score scale: 1=Below, 2=Approaching, 3=Meeting, 4=Exceeding
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-600" />
              Optional: add remarks after the score, e.g., &ldquo;good effort but needs practice in multiplication&rdquo;
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-600" />
              Works best in a quiet environment with a good microphone.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

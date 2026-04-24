'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ReportTranslatorService } from '../services/translator.service';
import type { ParentFriendlyTranslationRequest } from '../types/report-ai.types';

interface TranslationResult {
  original: string;
  translated: string;
  explanation: string;
}

interface TranslatorProps {
  onTranslation?: (result: TranslationResult) => void;
}

type TranslationStyle = ParentFriendlyTranslationRequest['target_language'];

export function AIReportTranslator({ onTranslation }: TranslatorProps) {
  const [technicalTerm, setTechnicalTerm] = useState('');
  const [context, setContext] = useState<ParentFriendlyTranslationRequest['context']>({
    subject: '',
    grade: '',
    performance_level: '',
    learning_area: ''
  });
  const [targetLanguage, setTargetLanguage] = useState<TranslationStyle>('simple-en');
  const [translatedText, setTranslatedText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translator = new ReportTranslatorService();

  const emitResult = (original: string, translated: string, details: string) => {
    if (onTranslation) {
      onTranslation({ original, translated, explanation: details });
    }
  };

  const handleTranslate = async () => {
    if (!technicalTerm.trim()) {
      setError('Please enter a technical term to translate.');
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await translator.translateToParentFriendly(technicalTerm, {
        ...context,
        target_language: targetLanguage
      });

      if (!response.success) {
        setError(response.warnings?.[0] || 'Translation failed. Please try again.');
        return;
      }

      const details = `Technical term "${technicalTerm}" translated to ${targetLanguage}.`;
      setTranslatedText(response.data);
      setExplanation(details);
      emitResult(technicalTerm, response.data, details);
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateComment = async () => {
    if (!technicalTerm.trim()) {
      setError('Please enter a comment to translate.');
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const translated = await translator.translateReportComment(technicalTerm, {
        competency_name: context.learning_area || 'General competency',
        score: 0,
        level: context.performance_level || 'Not provided',
        subject: context.subject,
        grade: context.grade,
        learning_area: context.learning_area
      });

      const details = 'Teacher comment translated to parent-friendly language.';
      setTranslatedText(translated);
      setExplanation(details);
      emitResult(technicalTerm, translated, details);
    } catch (translateError) {
      setError(translateError instanceof Error ? translateError.message : 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  const clearTranslation = () => {
    setTechnicalTerm('');
    setTranslatedText('');
    setExplanation('');
    setError(null);
  };

  const commonTechnicalTerms = [
    'Numeracy',
    'Literacy',
    'Competency-based assessment',
    'Formative assessment',
    'Summative assessment',
    'Learning outcomes',
    'Skills acquisition',
    'Cognitive development',
    'Motor skills',
    'Social-emotional learning',
    'Differentiated instruction',
    'Inclusive education'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Technical Term Translator</CardTitle>
          <CardDescription>
            Translate educational jargon into parent-friendly language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="technical-term" className="text-sm font-medium text-secondary-700">
                Technical Term/Comment
              </label>
              <textarea
                id="technical-term"
                placeholder="Enter educational term or teacher comment..."
                value={technicalTerm}
                onChange={(event) => setTechnicalTerm(event.target.value)}
                className="min-h-[80px] w-full rounded-lg border border-secondary-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="subject"
                label="Subject"
                placeholder="e.g., Mathematics"
                value={context.subject}
                onChange={(event) => setContext({ ...context, subject: event.target.value })}
              />
              <Input
                id="grade"
                label="Grade Level"
                placeholder="e.g., Grade 5"
                value={context.grade}
                onChange={(event) => setContext({ ...context, grade: event.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="performance-level"
                label="Performance Level"
                placeholder="e.g., Meeting Expectations"
                value={context.performance_level}
                onChange={(event) => setContext({ ...context, performance_level: event.target.value })}
              />
              <Input
                id="learning-area"
                label="Learning Area"
                placeholder="e.g., Environmental Activities"
                value={context.learning_area}
                onChange={(event) => setContext({ ...context, learning_area: event.target.value })}
              />
            </div>

            <Select
              id="target-language"
              label="Target Language Style"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value as TranslationStyle)}
            >
              <option value="simple-en">Simple English</option>
              <option value="swahili">Swahili Translation</option>
              <option value="parent-focused">Parent-Focused</option>
            </Select>

            <div className="flex gap-2">
              <Button onClick={handleTranslate} disabled={isTranslating} className="flex-1">
                {isTranslating ? 'Translating...' : 'Translate Term'}
              </Button>
              <Button onClick={handleTranslateComment} disabled={isTranslating} variant="outline" className="flex-1">
                {isTranslating ? 'Translating...' : 'Translate Comment'}
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {translatedText && (
        <Card>
          <CardHeader>
            <CardTitle>Translation Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Original</p>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <p className="text-sm">{technicalTerm}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Parent-Friendly Translation</p>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-800">{translatedText}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Explanation</p>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">{explanation}</p>
                </div>
              </div>

              <Button onClick={clearTranslation} variant="outline">
                Clear Translation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Common Terms to Translate</CardTitle>
          <CardDescription>
            Click on any term to quickly load it into the translator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {commonTechnicalTerms.map((term, index: number) => (
              <Button
                key={`${term}-${index}`}
                variant="outline"
                size="sm"
                onClick={() => {
                  setTechnicalTerm(term);
                  setContext({
                    subject: '',
                    grade: '',
                    performance_level: '',
                    learning_area: ''
                  });
                }}
                className="h-fit text-xs"
              >
                {term}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

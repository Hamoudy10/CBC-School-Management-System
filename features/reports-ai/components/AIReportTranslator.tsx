'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportTranslatorService } from '../services/translator.service';

interface TranslatorProps {
  onTranslation?: (result: { original: string; translated: string; explanation: string }) => void;
}

export function AIReportTranslator({ onTranslation }: TranslatorProps) {
  const [technicalTerm, setTechnicalTerm] = useState('');
  const [context, setContext] = useState({
    subject: '',
    grade: '',
    performance_level: '',
    learning_area: ''
  });
  const [targetLanguage, setTargetLanguage] = useState<'simple-en' | 'swahili' | 'parent-focused'>('simple-en');
  const [translatedText, setTranslatedText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translator = new ReportTranslatorService();

  const handleTranslate = async () => {
    if (!technicalTerm.trim()) {
      setError('Please enter a technical term to translate');
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await translator.translateToParentFriendly(technicalTerm, context);
      
      if (response.success) {
        setTranslatedText(response.data);
        setExplanation(`Technical term "${technicalTerm}" translated to parent-friendly language.`);
        
        if (onTranslation) {
          onTranslation({
            original: technicalTerm,
            translated: response.data,
            explanation: explanation
          });
        }
      } else {
        setError('Translation failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateComment = async () => {
    if (!technicalTerm.trim()) {
      setError('Please enter a comment to translate');
      return;
    }

    setIsTranslating(true);
    setError(null);

    try {
      const response = await translator.translateReportComment(technicalTerm, context);
      
      if (response) {
        setTranslatedText(response);
        setExplanation('Teacher comment translated to parent-friendly language.');
        
        if (onTranslation) {
          onTranslation({
            original: technicalTerm,
            translated: response,
            explanation: explanation
          });
        }
      } else {
        setError('Translation failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
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
            Translate educational jargon into parent-friendly language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="technical-term">Technical Term/Comment</Label>
              <Textarea
                id="technical-term"
                placeholder="Enter educational term or teacher comment..."
                value={technicalTerm}
                onChange={(e) => setTechnicalTerm(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Mathematics"
                  value={context.subject}
                  onChange={(e) => setContext({ ...context, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="grade">Grade Level</Label>
                <Input
                  id="grade"
                  placeholder="e.g., Grade 5"
                  value={context.grade}
                  onChange={(e) => setContext({ ...context, grade: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="performance-level">Performance Level</Label>
                <Input
                  id="performance-level"
                  placeholder="e.g., Exceeding Expectations"
                  value={context.performance_level}
                  onChange={(e) => setContext({ ...context, performance_level: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="learning-area">Learning Area</Label>
                <Input
                  id="learning-area"
                  placeholder="e.g., Environmental"
                  value={context.learning_area}
                  onChange={(e) => setContext({ ...context, learning_area: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="target-language">Target Language Style</Label>
              <Select value={targetLanguage} onValueChange={(value: any) => setTargetLanguage(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple-en">Simple English</SelectItem>
                  <SelectItem value="swahili">Swahili Translation</SelectItem>
                  <SelectItem value="parent-focused">Parent-Focused</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleTranslate}
                disabled={isTranslating}
                className="flex-1"
              >
                {isTranslating ? 'Translating...' : 'Translate Term'}
              </Button>
              <Button 
                onClick={handleTranslateComment}
                disabled={isTranslating}
                variant="outline"
                className="flex-1"
              >
                {isTranslating ? 'Translating...' : 'Translate Comment'}
              </Button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
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
                <Label className="text-sm font-medium text-gray-500">Original</Label>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-sm">{technicalTerm}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Parent-Friendly Translation</Label>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">{translatedText}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Explanation</Label>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
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
            Click on any term to quickly translate it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {commonTechnicalTerms.map((term, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => {
                  setTechnicalTerm(term);
                  setContext({ ...context, subject: '', grade: '', performance_level: '', learning_area: '' });
                }}
                className="text-xs h-fit"
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
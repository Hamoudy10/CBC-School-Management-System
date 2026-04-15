// app/(dashboard)/academics/components/SchemeImport.tsx
// ============================================================
// Intelligent Scheme of Work Import Component
// Supports: paste, drag-and-drop, file upload (.txt, .docx)
// Auto-creates: Learning Areas, Strands, Sub-Strands, Competencies
// Detects missing elements and warns the user
// ============================================================

"use client";

import { useState, useRef, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileUp,
  Loader2,
  Upload,
  XCircle,
  FileText,
  X,
} from "lucide-react";
import mammoth from "mammoth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface SchemeImportResult {
  parsed: {
    header: { school: string; grade: string; learningArea: string; term: string; year: string };
    lessonCount: number;
    strandCount: number;
    subStrandCount: number;
    competencyCount: number;
    weeks: number[];
    strands: string[];
  };
  warnings: string[];
  missingElements: string[];
  databaseImport: {
    success: boolean;
    message: string;
    createdStrands: string[];
    createdSubStrands: string[];
    createdCompetencies: string[];
  } | null;
}

const ALLOWED_TYPES = [
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_EXTENSIONS = [".txt", ".docx"];

export function SchemeImport() {
  const { success, error: toastError, warning } = useToast();
  const [textContent, setTextContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<SchemeImportResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [importToDb, setImportToDb] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ─── File Processing ─────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setParseError(null);
    setUploadedFile(file.name);

    try {
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text();
        setTextContent(text);
        success("File loaded", `Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      } else if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setTextContent(result.value);

        if (result.messages.length > 0) {
          console.warn("Mammoth warnings:", result.messages);
        }

        success("Document parsed", `Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      } else {
        setParseError(`Unsupported file type: ${file.type || file.name}. Please use .txt or .docx files.`);
        setUploadedFile(null);
      }
    } catch (err) {
      setParseError(`Failed to read file: ${err instanceof Error ? err.message : "Unknown error"}`);
      setUploadedFile(null);
    }
  }, [success]);

  // ─── Drag and Drop ───────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we left the drop zone
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check file type/extension
      const isValid = ALLOWED_TYPES.includes(file.type) ||
        ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));

      if (isValid) {
        processFile(file);
      } else {
        setParseError(`Unsupported file: ${file.name}. Please use .txt or .docx files.`);
      }
    }
  }, [processFile]);

  // ─── File Input ──────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [processFile]);

  // ─── Sample Text ─────────────────────────────────────────────────

  const loadSampleText = () => {
    setTextContent(`2024 GRADE 6 JKF NEW PRIMARY ENGLISH SCHEMES OF WORK - TERM 2

SCHOOL\tGRADE\tLEARNING AREA\tTERM\tYEAR
\t6\tENGLISH\t2\t2024

Week\tLesson\tStrand\tSub-Strand\tSpecific-Learning Outcomes\tLearning Experiences\tKey Inquiry Questions\tLearning Resources\tAssessment Methods\tReflection
1\t1\tOur Tourist Attractions\tListening and Speaking

Pronunciation and vocabulary\tBy the end of the lesson, the learner should be able to:
Listen to the words with the sound containing letters th from a recording.
Pronounce words that have the same sound with letters th.
Appreciate the importance of correct pronunciation of sounds, words and phrases\tLearners are guided in pairs, in groups or individually to:
Listen to the words with the sound containing letters th from a recording.
Pronounce words that have the same sound with letters th.\tWhat difference have you noted in the way the words with the sound of letters th are said?\tJKF New Primary English Learner's Book Grade 6 pg. 44
Dictionaries
Charts
Realia\tWritten questions
Oral questions
Portfolio
Oral Report Observation
Self and peer assessment\t`);
    success("Sample loaded", "This shows the expected format. Replace with your own scheme.");
  };

  // ─── Import ──────────────────────────────────────────────────────

  const handleImport = async () => {
    if (textContent.trim().length < 100) {
      setParseError("Please paste at least 100 characters of scheme content.");
      return;
    }

    setIsImporting(true);
    setParseError(null);
    setResult(null);

    try {
      const response = await fetch("/api/academics/scheme-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          textContent: textContent.trim(),
          importToDatabase: importToDb,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || json.message || "Import failed");
      }

      const data = json.data;
      setResult(data);
      setShowModal(true);

      if (data.missingElements.length > 0) {
        warning("Missing Elements", `${data.missingElements.length} required element(s) not found.`);
      }
      if (data.warnings.length > 0) {
        warning("Warnings", `${data.warnings.length} warning(s) about the scheme.`);
      }
      if (data.databaseImport?.success) {
        success("Import Successful", data.databaseImport.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import scheme";
      setParseError(message);
      toastError("Import Failed", message);
    } finally {
      setIsImporting(false);
    }
  };

  const clearFile = () => {
    setTextContent("");
    setUploadedFile(null);
    setParseError(null);
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Main Import Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Import Scheme of Work</CardTitle>
              <CardDescription>
                Upload or paste your CBC scheme to auto-create learning areas, strands, sub-strands, and competencies
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Instructions */}
          <Alert>
            <ClipboardPaste className="h-4 w-4" />
            <AlertTitle>How to import your scheme</AlertTitle>
            <AlertDescription className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Option 1: Upload a file</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    <li>Drag &amp; drop a <code className="bg-gray-100 px-1 rounded">.docx</code> or <code className="bg-gray-100 px-1 rounded">.txt</code> file</li>
                    <li>Or click &quot;Upload&quot; to browse files</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Option 2: Copy &amp; paste</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                    <li>Open your scheme document</li>
                    <li>Select all (Ctrl+A) → Copy (Ctrl+C)</li>
                    <li>Paste into the text area below</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                The system intelligently extracts strands, sub-strands, learning outcomes, and validates CBC compliance.
              </p>
            </AlertDescription>
          </Alert>

          {/* Drag & Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Upload className={cn(
              "mx-auto h-8 w-8 transition-colors",
              isDragging ? "text-blue-500" : "text-gray-400",
            )} />
            <p className="mt-2 text-sm font-medium text-gray-700">
              {isDragging ? "Drop your file here" : "Drag & drop your scheme file here"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Supports <code className="bg-gray-100 px-1 rounded">.docx</code> (Word) and <code className="bg-gray-100 px-1 rounded">.txt</code> files
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Browse Files
            </button>
          </div>

          {/* Uploaded File Badge */}
          {uploadedFile && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">{uploadedFile}</span>
              <Badge variant="success" className="text-xs ml-auto">Loaded</Badge>
              <button
                type="button"
                onClick={clearFile}
                className="ml-1 text-gray-400 hover:text-gray-600"
                title="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400 uppercase">or paste text below</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Text Area */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Scheme Content
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your scheme of work here...&#10;&#10;The system expects a table with columns:&#10;Week | Lesson | Strand | Sub-Strand | Learning Outcomes | Learning Experiences | Inquiry Questions | Resources | Assessment Methods"
              rows={12}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{textContent.length} characters</span>
              <button
                type="button"
                onClick={loadSampleText}
                className="text-gray-500 hover:text-gray-700"
              >
                Load sample
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="importToDb"
              checked={importToDb}
              onChange={(e) => setImportToDb(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="importToDb" className="text-sm text-gray-700">
              Auto-create strands, sub-strands, and competencies in the database
            </label>
          </div>

          {/* Error Display */}
          {parseError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-sm whitespace-pre-wrap">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleImport}
              loading={isImporting}
              disabled={textContent.trim().length < 100}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Scheme...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  Analyze &amp; Import
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} size="xl">
        <ModalHeader>
          <ModalTitle>Scheme Import Results</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-6">
          {result && (
            <>
              {/* Parsed Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Parsed Scheme Summary</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryCard label="Learning Area" value={result.parsed.header.learningArea || "Not detected"} />
                  <SummaryCard label="Grade" value={result.parsed.header.grade || "Not detected"} />
                  <SummaryCard label="Term" value={result.parsed.header.term || "Not detected"} />
                  <SummaryCard label="Year" value={result.parsed.header.year || "Not detected"} />
                  <SummaryCard label="Weeks" value={result.parsed.weeks.length.toString()} />
                  <SummaryCard label="Lessons" value={result.parsed.lessonCount.toString()} />
                  <SummaryCard label="Strands" value={result.parsed.strandCount.toString()} />
                  <SummaryCard label="Sub-Strands" value={result.parsed.subStrandCount.toString()} />
                  <SummaryCard label="Competencies" value={result.parsed.competencyCount.toString()} />
                </div>
              </div>

              {/* Strands List */}
              {result.parsed.strands.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Extracted Strands</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.parsed.strands.map((s) => (
                      <Badge key={s} variant="info">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Elements */}
              {result.missingElements.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Missing Elements ({result.missingElements.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      {result.missingElements.map((m) => (
                        <li key={m} className="text-sm">{m}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warnings ({result.warnings.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      {result.warnings.map((w) => (
                        <li key={w} className="text-sm">{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Database Import Results */}
              {result.databaseImport && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Database Import
                    {result.databaseImport.success ? (
                      <Badge variant="success" className="ml-2">Success</Badge>
                    ) : (
                      <Badge variant="error" className="ml-2">Failed</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">{result.databaseImport.message}</p>

                  {result.databaseImport.createdStrands.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Strands Created:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.databaseImport.createdStrands.slice(0, 10).map((s) => (
                          <Badge key={s} variant="success" className="text-xs">{s}</Badge>
                        ))}
                        {result.databaseImport.createdStrands.length > 10 && (
                          <Badge variant="default" className="text-xs">+{result.databaseImport.createdStrands.length - 10} more</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {result.databaseImport.createdSubStrands.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Sub-Strands Created:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.databaseImport.createdSubStrands.slice(0, 10).map((s) => (
                          <Badge key={s} variant="info" className="text-xs">{s}</Badge>
                        ))}
                        {result.databaseImport.createdSubStrands.length > 10 && (
                          <Badge variant="default" className="text-xs">+{result.databaseImport.createdSubStrands.length - 10} more</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {result.databaseImport.createdCompetencies.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Competencies Created:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.databaseImport.createdCompetencies.slice(0, 5).map((c) => (
                          <Badge key={c} variant="default" className="text-xs">{c}</Badge>
                        ))}
                        {result.databaseImport.createdCompetencies.length > 5 && (
                          <Badge variant="default" className="text-xs">+{result.databaseImport.createdCompetencies.length - 5} more</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No issues */}
              {result.missingElements.length === 0 && result.warnings.length === 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Scheme is Complete</AlertTitle>
                  <AlertDescription className="text-green-700">
                    All required CBC elements are present. No issues detected.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setShowModal(false)}>Close</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}

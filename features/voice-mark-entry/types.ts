export interface VoiceMarkEntryResult {
  transcribedText: string;
  confidence: number;
  parsedAssessment: {
    studentName: string;
    subject: string;
    strand: string;
    score: number;
    remarks?: string;
  } | null;
  warnings: string[];
}

export interface VoiceRecordingState {
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

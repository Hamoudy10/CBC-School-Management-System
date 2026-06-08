export interface ChatbotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatbotSession {
  sessionId: string;
  parentUserId: string | null;
  parentPhone: string;
  schoolId: string | null;
  messages: ChatbotMessage[];
  context: {
    studentIds: string[];
    currentStudentId?: string;
    lastQueryType?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotQueryResult {
  reply: string;
  confidence: number;
  requiresHuman: boolean;
  dataQueried: {
    studentPerformance?: boolean;
    feeBalance?: boolean;
    attendance?: boolean;
    discipline?: boolean;
    upcomingEvents?: boolean;
  };
  warnings: string[];
}

export interface ChatbotWebhookPayload {
  from: string;
  text: string;
  sessionId?: string;
  channel: 'whatsapp' | 'sms' | 'telegram' | 'messenger';
}

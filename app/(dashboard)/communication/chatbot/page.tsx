'use client';

import React, { useState, useCallback } from 'react';
import { MessageCircle, Send, Bot, Phone, Globe } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  requiresHuman?: boolean;
}

export default function ChatbotPage() {
  const { success, error } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('+254');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [isSending, setIsSending] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !phoneNumber.trim()) {
      error('Please enter both phone number and message');
      return;
    }

    setIsSending(true);
    setChat((prev) => [...prev, { role: 'user', text: message.trim(), timestamp: new Date() }]);

    try {
      const res = await fetch('/api/parent-chatbot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          message: message.trim(),
          channel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.reply || 'Request failed');
      }

      setChat((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data.reply,
          timestamp: new Date(),
          requiresHuman: data.requires_human,
        },
      ]);

      if (data.requires_human) {
        success('This query requires human follow-up');
      }

      setMessage('');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to get response');
      setChat((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [message, phoneNumber, channel, error, success]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Chatbot"
        description="Test the multi-channel parent query chatbot"
        icon={<MessageCircle className="h-6 w-6" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Parent Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
              placeholder="+2547XXXXXXXX"
            />

            <div>
              <label className="text-sm font-medium text-gray-700">Channel</label>
              <div className="mt-1 flex gap-2">
                {[
                  { value: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
                  { value: 'sms', label: 'SMS', icon: <MessageCircle className="h-4 w-4" /> },
                  { value: 'telegram', label: 'Telegram', icon: <Globe className="h-4 w-4" /> },
                ].map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      channel === ch.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    onClick={() => setChannel(ch.value)}
                  >
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <Alert variant="info">
              <Bot className="h-4 w-4" />
              <AlertTitle>Test Mode</AlertTitle>
              <AlertDescription>
                This sends a real request to the chatbot API. The parent phone must exist in the system.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5" />
              Chat Simulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-[400px] overflow-y-auto space-y-3 rounded-lg border bg-gray-50 p-4">
                {chat.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Bot className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-2 text-sm text-gray-400">
                        Send a test message to see the chatbot response
                      </p>
                      <p className="text-xs text-gray-300">
                        Try: &quot;How is my child performing?&quot; or &quot;What is my fee balance?&quot;
                      </p>
                    </div>
                  </div>
                )}

                {chat.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-white border text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <div className={`mt-1 flex items-center gap-2 text-[10px] ${msg.role === 'user' ? 'text-primary-200' : 'text-gray-400'}`}>
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                        {msg.requiresHuman && (
                          <Badge variant="warning" size="xs">Needs human</Badge>
                        )}
                        {msg.role === 'bot' && <Bot className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-white border px-4 py-3">
                      <Spinner size="sm" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a test message..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="flex-1"
                />
                <Button
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={handleSend}
                  loading={isSending}
                  disabled={!message.trim() || !phoneNumber.trim()}
                >
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

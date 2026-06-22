"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare, AlertTriangle, BarChart3, Table2, PieChart, TrendingUp, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert, AlertDescription } from "@/components/ui/Alert";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: any;
  timestamp: Date;
}

const EXAMPLE_QUERIES = [
  "Show me all students with average score below 2.0",
  "What is the class average performance?",
  "How many students are exceeding expectations?",
  "Show attendance statistics for this class",
  "List discipline incidents by type",
  "Show me the top performers in each learning area",
  "What is the fee payment status breakdown?",
  "Which students have declining performance trends?",
];

const VISUALIZATION_ICONS: Record<string, any> = {
  table: Table2,
  bar_chart: BarChart3,
  line_chart: TrendingUp,
  pie_chart: PieChart,
  stat_card: BarChart3,
  text: MessageSquare,
  list: List,
};

function VizDisplay({ viz, data }: { viz: any; data: any }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500">No data to display.</p>;
  }

  if (viz.type === "stat_card") {
    const keys = Object.keys(data[0]);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((item: any, i: number) => (
          <Card key={i}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-gray-500">{keys[0]}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{item[keys[0]]}</p>
              {keys[1] && <p className="text-xs text-gray-500">{keys[1]}: {item[keys[1]]}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (viz.type === "table" || viz.type === "list") {
    if (data.length === 0) return <p className="text-sm text-gray-500">No results.</p>;
    const keys = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              {keys.map((key) => (
                <th key={key} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                  {key.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 whitespace-nowrap">
                    {typeof row[key] === "number" ? row[key].toFixed(2) : String(row[key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (viz.type === "bar_chart" || viz.type === "pie_chart") {
    const maxVal = Math.max(...data.map((d: any) => d.value || d.count || 0));
    return (
      <div className="space-y-2">
        {data.map((item: any, i: number) => {
          const val = item.value || item.count || 0;
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-indigo-500"];
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-32 truncate text-right">{item.name || item.label || "Unknown"}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5">
                <div className={`${colors[i % colors.length]} h-5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium w-12 text-left">{val}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item: any, i: number) => (
        <div key={i} className="p-2 bg-gray-50 rounded text-sm">
          {JSON.stringify(item)}
        </div>
      ))}
    </div>
  );
}

export function NLQueryInterface({
  classId,
  termId,
  academicYearId,
}: {
  classId?: string;
  termId?: string;
  academicYearId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const executeQuery = async (query: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/nl-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          classId,
          termId,
          academicYearId,
          format: "auto",
        }),
      });
      const json = await res.json();

      if (json.success) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: json.data.summary,
          result: json.data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `Error: ${json.error || "Failed to process query"}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Network error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Ask a Question</CardTitle>
            <Badge variant="info">AI Powered</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && input.trim()) {
                  executeQuery(input.trim());
                }
              }}
              placeholder="Ask about student performance, attendance, discipline..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
            />
            <Button onClick={() => executeQuery(input.trim())} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => executeQuery(q)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Type a question above to get insights from your school data.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-50 border border-gray-200"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {msg.result && (
                <div className="mt-3 space-y-2">
                  {msg.result.warnings?.length > 0 && (
                    <Alert variant="warning" className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {msg.result.warnings.join("; ")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Intent: {msg.result.interpretedIntent}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">
                      Confidence: {Math.round(msg.result.confidence * 100)}%
                    </span>
                  </div>

                  <VizDisplay viz={msg.result.visualization} data={msg.result.data} />
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

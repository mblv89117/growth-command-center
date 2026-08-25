"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/tenant/context";
import { SUGGESTED_PROMPTS } from "@/lib/ai/prompts";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Send, Sparkles } from "lucide-react";

interface AiAdvisorPanelProps {
  department?: "executive" | "finance" | "sales" | "operations";
  className?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiAdvisorPanel({ department = "executive", className }: AiAdvisorPanelProps) {
  const { organization } = useTenant();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const askAdvisor = async (question: string) => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          department,
          message: question,
          conversationId,
        }),
      });

      const data = (await res.json()) as {
        insights?: string;
        conversationId?: string;
        error?: string;
        dataSource?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "AI Advisor request failed");
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);
      const answer = data.insights ?? "";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${answer}${data.dataSource ? `\n\n— Grounded in ${data.dataSource} data` : ""}`,
        },
      ]);
      setMessage("");
    } catch {
      setError("Unable to reach AI Advisor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && messages.length === 0) {
      void askAdvisor("Give me a brief executive summary of my financial position and top 3 priorities.");
    }
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI CFO
            </CardTitle>
            <CardDescription>
              Ask questions about cash, margin, forecast, and priorities — grounded in your data
            </CardDescription>
          </div>
          <Button type="button" variant={open ? "secondary" : "default"} onClick={handleToggle}>
            AI CFO
            {open ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void askAdvisor(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 text-sm",
                  msg.role === "user" ? "bg-primary/10 ml-8" : "bg-card mr-8"
                )}
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {msg.role === "user" ? "You" : "AI CFO"}
                </p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your data...
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void askAdvisor(message);
            }}
          >
            <Input
              placeholder="Ask your AI CFO..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTenant } from "@/lib/tenant/context";
import { stepLabel } from "@/lib/onboarding/progress";
import type { OnboardingMessage, OnboardingStep } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Send, Sparkles } from "lucide-react";

export function OnboardingChat() {
  const { organization } = useTenant();
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const applyState = useCallback(
    (data: {
      messages?: OnboardingMessage[];
      progress?: number;
      onboardingStep?: OnboardingStep;
      onboardingComplete?: boolean;
    }) => {
      if (data.messages) setMessages(data.messages);
      if (typeof data.progress === "number") setProgress(data.progress);
      if (data.onboardingStep) setOnboardingStep(data.onboardingStep);
      if (typeof data.onboardingComplete === "boolean") {
        setOnboardingComplete(data.onboardingComplete);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (message?: string) => {
      setSending(true);
      setError(null);

      try {
        const res = await fetch("/api/ai-onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization.id,
            message,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "AI Onboarding request failed");
          return;
        }

        applyState(data);
      } catch {
        setError("Unable to reach AI Onboarding. Please try again.");
      } finally {
        setSending(false);
        setTimeout(scrollToBottom, 50);
      }
    },
    [applyState, organization.id]
  );

  useEffect(() => {
    let active = true;
    let started = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/onboarding?organizationId=${organization.id}`);
        const data = await res.json();

        if (!res.ok) {
          if (active) setError(data.error ?? "Unable to load onboarding");
          return;
        }

        if (!active) return;

        applyState(data);

        if (!started && (data.messages?.length ?? 0) === 0 && !data.onboardingComplete) {
          started = true;
          await sendMessage();
        }
      } catch {
        if (active) setError("Unable to load onboarding");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending || onboardingComplete) return;
    setInput("");
    await sendMessage(trimmed);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-primary/20 bg-card/95 shadow-xl">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Onboarding
              </CardTitle>
              <CardDescription>
                Set up {organization.name} with a guided CFO onboarding conversation
              </CardDescription>
            </div>
            {onboardingComplete && (
              <Button asChild>
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{stepLabel(onboardingStep)}</span>
              <span>{progress}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "assistant" ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    message.role === "assistant"
                      ? "bg-muted/60 text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!onboardingComplete ? (
            <form onSubmit={handleSubmit} className="border-t border-border/60 p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Type your answer..."
                  className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-2"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !input.trim()}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="border-t border-border/60 p-4">
              <Button asChild className="w-full">
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

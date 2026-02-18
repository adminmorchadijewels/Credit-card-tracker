import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Payment } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPdf, chunkText } from "@/lib/pdf-extractor";
import { createEmbedding, chatCompletion, ChatMessage } from "@/lib/ai-utils";
import { Send, FileText, Loader2, Bot, User, Sparkles, RefreshCw } from "lucide-react";

const SUGGESTED = [
  "What is the total amount due?",
  "List the largest transactions",
  "Show all dining or food expenses",
  "Are there any EMI or interest charges?",
];

interface Props {
  payment: Payment;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const StatementChat = ({ payment, onClose }: Props) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isIndexed, setIsIndexed] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [checkingIndex, setCheckingIndex] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkIndexed();
  }, [payment.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkIndexed = async () => {
    setCheckingIndex(true);
    const { count } = await supabase
      .from("statement_chunks")
      .select("*", { count: "exact", head: true })
      .eq("payment_id", payment.id);
    setIsIndexed((count ?? 0) > 0);
    setCheckingIndex(false);
  };

  const handleIndex = async (reindex = false) => {
    if (!payment.statementFileUrl) {
      toast({ title: "No statement file", description: "Upload a PDF statement first.", variant: "destructive" });
      return;
    }
    if (!apiKey) {
      toast({
        title: "OpenAI API key missing",
        description: "Add VITE_OPENAI_API_KEY to your .env file and restart the dev server.",
        variant: "destructive",
      });
      return;
    }

    setIsIndexing(true);
    setIndexProgress(0);

    try {
      toast({ title: "Extracting text from PDF…" });
      const text = await extractTextFromPdf(payment.statementFileUrl);
      if (!text.trim()) {
        throw new Error("No text found. The PDF may be a scanned image – text extraction requires a text-based PDF.");
      }

      const chunks = chunkText(text);

      if (reindex) {
        await supabase.from("statement_chunks").delete().eq("payment_id", payment.id);
        setMessages([]);
      }

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i], apiKey);
        await supabase.from("statement_chunks").insert({
          payment_id: payment.id,
          chunk_index: i,
          content: chunks[i],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          embedding: JSON.stringify(embedding) as any,
        });
        setIndexProgress(Math.round(((i + 1) / chunks.length) * 100));
        // Throttle to respect OpenAI rate limits
        if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 150));
      }

      setIsIndexed(true);
      toast({ title: `Ready! ${chunks.length} chunk${chunks.length !== 1 ? "s" : ""} indexed.` });
    } catch (err: unknown) {
      toast({
        title: "Indexing failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsIndexing(false);
      setIndexProgress(0);
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isSending) return;
    if (!apiKey) {
      toast({
        title: "OpenAI API key missing",
        description: "Add VITE_OPENAI_API_KEY to your .env file and restart the dev server.",
        variant: "destructive",
      });
      return;
    }

    setInput("");
    const updatedMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(updatedMessages);
    setIsSending(true);

    try {
      const queryEmbedding = await createEmbedding(question, apiKey);

      const { data: chunks, error } = await supabase.rpc("match_statement_chunks", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query_embedding: JSON.stringify(queryEmbedding) as any,
        payment_id_filter: payment.id,
        match_count: 5,
      });

      if (error) throw error;

      const context = ((chunks as { content: string }[]) ?? [])
        .map((c) => c.content)
        .join("\n\n---\n\n");

      const systemPrompt = `You are a precise financial assistant helping a user understand their credit card statement.

Card: ${payment.cardName}
Statement date: ${payment.statementDate}
Total amount due: ₹${payment.paymentDue.toLocaleString("en-IN")}

Answer questions based strictly on the statement content below. Be concise and specific.
If the information is not present in the content, say so clearly.

Statement content:
${context}`;

      const chatMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ];

      const answer = await chatCompletion(chatMessages, apiKey);
      setMessages([...updatedMessages, { role: "assistant", content: answer }]);
    } catch (err: unknown) {
      toast({
        title: "Failed to get response",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setMessages(messages); // rollback optimistic user message
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl flex flex-col p-0 gap-0 h-[85vh] sm:h-[75vh]">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles size={16} className="text-primary" />
              Ask about Statement
            </DialogTitle>
            {isIndexed && !isIndexing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-body-xs gap-1 text-muted-foreground"
                onClick={() => handleIndex(true)}
              >
                <RefreshCw size={12} /> Re-index
              </Button>
            )}
          </div>
          <p className="text-body-xs text-muted-foreground">
            {payment.cardName} · {payment.statementDate}
          </p>
        </DialogHeader>

        {/* Body */}
        {checkingIndex ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : !isIndexed ? (
          /* ── Not indexed yet ── */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="rounded-full bg-primary/10 p-5">
              <FileText size={30} className="text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Statement not indexed yet</p>
              <p className="text-body-sm text-muted-foreground max-w-xs">
                Extract text from the PDF and create embeddings so you can ask questions about it.
              </p>
            </div>

            {isIndexing ? (
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between text-body-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Processing PDF…
                  </span>
                  <span>{indexProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${indexProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={() => handleIndex(false)} className="gap-2">
                <Sparkles size={14} /> Index PDF for AI Chat
              </Button>
            )}

            {!apiKey && (
              <p className="text-body-xs text-destructive max-w-xs">
                <strong>VITE_OPENAI_API_KEY</strong> is not set. Add it to your .env file and restart.
              </p>
            )}
          </div>
        ) : (
          /* ── Chat interface ── */
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <p className="text-body-xs text-muted-foreground text-center">
                    Statement indexed and ready. Try one of these or ask your own question.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-body-xs rounded-full border border-border bg-background px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Bot size={13} className="text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-body-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                      <User size={13} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex gap-2.5">
                  <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot size={13} className="text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-border shrink-0 space-y-1.5">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your statement…"
                  disabled={isSending}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim() || isSending}>
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Powered by OpenAI · gpt-4o-mini · text-embedding-3-small
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

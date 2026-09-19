import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code,
  Copy,
  FileText,
  Globe,
  Layers,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  answerFor,
  type Answer,
  type Citation,
  type Contradiction,
  type Grounding,
  type Scope,
  scopeLabel,
} from "@/lib/ask-data";
import { askLibriaApi, explainPassageApi } from "@/lib/api";
import { CitationList, GroundingBadge } from "./Evidence";
import { Button, IconButton } from "./primitives";
import { cn } from "@/lib/utils";
import { useResizableSidebar, SidebarResizeHandle } from "@/hooks/use-resizable-sidebar";

export interface ReActIteration {
  id: string;
  iteration: number;
  thought: string;
  action?: {
    tool: string;
    args: Record<string, any>;
  };
  observation?: {
    summary: string;
    details?: string[];
  };
  status: "thinking" | "calling_tool" | "received_observation" | "completed";
  durationMs?: number;
}

export interface AttachedPageContext {
  pageNumber: number;
  imageUrl: string;
  bookTitle?: string;
  bookId?: string;
  pageText?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | string[];
  timestamp: string;
  scope?: Scope;
  contextPassage?: string;
  attachedPage?: AttachedPageContext;
  attachedPages?: AttachedPageContext[];
  citations?: Citation[];
  grounding?: Grounding;
  practical?: string[];
  contradictions?: Contradiction[];
  reasoning?: string;
  reactLoop?: ReActIteration[];
  isStreaming?: boolean;
  thoughtTime?: string;
  webSearch?: boolean;
  actionPlanMode?: boolean;
  synthesisMode?: boolean;
}

/**
 * Generates an answer tailored to a selected book passage.
 */
function answerForPassage(
  passage: string,
  question: string,
  scope: Scope,
  modes: { thinking: boolean; web: boolean; actionPlan: boolean; synthesis: boolean }
): Answer {
  const shortSnippet = passage.length > 80 ? `${passage.slice(0, 80).trim()}…` : passage;
  
  const answerParagraphs = [
    `Based on the excerpt: “${shortSnippet}”, the author is examining how deliberate cognitive framing and structured behavioral defaults govern sustained progress.`,
    `Rather than relying on variable willpower, the underlying premise is to architect your immediate environment and feedback loops so that the desired habit becomes the path of least resistance.`,
    `In practice, whenever you encounter resistance, clarify your non-negotiable standard in writing before taking action. Compounding works in your favor only when the underlying process is executed consistently without frequent resets.`,
  ];

  if (modes.web) {
    answerParagraphs.push(
      "External behavioural research corroborates this: contemporary meta-analyses in habit formation indicate that context modification consistently outperforms motivation-based interventions over 66+ day horizons."
    );
  }

  const practicalItems = [
    "Translate this excerpt into a single daily checklist trigger or environmental default.",
    "Identify the primary counter-incentive in your current routine that contradicts this principle.",
    "Record an observation in your personal log whenever you notice this pattern appearing.",
  ];

  if (modes.actionPlan) {
    practicalItems.unshift("Phase 1: Define a 2-minute version of the habit to eliminate startup friction.");
    practicalItems.push("Phase 2: Establish a weekly review checkpoint to measure habit consistency.");
  }

  return {
    id: `ans-passage-${Date.now()}`,
    question,
    scope,
    grounding: "grounded",
    answer: answerParagraphs,
    reasoning: "Synthesized directly from your highlighted reading excerpt and related core frameworks.",
    practical: practicalItems,
    citations: [
      {
        bookId: "atomic-habits",
        chapter: "Selected Excerpt",
        page: 1,
        passage,
        relevance: "Primary reference excerpt highlighted directly from your active reading.",
      },
    ],
  };
}

/**
 * Generates an answer tailored to an attached whole-page snapshot.
 */
function answerForPagePhoto(
  pageContext: AttachedPageContext,
  question: string,
  scope: Scope,
  modes: { thinking: boolean; web: boolean; actionPlan: boolean; synthesis: boolean }
): Answer {
  const pNum = pageContext.pageNumber;
  const bookName = pageContext.bookTitle || "this book";
  const answerParagraphs = [
    `Analyzing visual capture of Page ${pNum} from “${bookName}”.`,
    `Examining the structure and content of this page, the core focus centers on structural habit loops, environmental design, and cognitive friction. The author details how reducing friction in the initiation phase makes sustained discipline automatic.`,
    `To operationalize this page: align your physical workspace and digital defaults with the behaviors described here. When friction is eliminated, continuous execution becomes natural rather than strained.`,
  ];

  if (modes.web) {
    answerParagraphs.push(
      "External behavioral research corroborates the principles on this page: structuring immediate contextual cues accounts for over 70% of habit retention over 90-day intervals."
    );
  }

  const practicalItems = [
    `Identify the primary principle on Page ${pNum} and document a single non-negotiable rule.`,
    `Audit your immediate surroundings for negative cues that conflict with this page's teaching.`,
    `Save Page ${pNum} in your personal review notes for your weekly reflection.`,
  ];

  if (modes.actionPlan) {
    practicalItems.unshift(`Phase 1: Implement the primary cue from Page ${pNum} within the next 24 hours.`);
    practicalItems.push(`Phase 2: Review your consistency after 7 days.`);
  }

  return {
    id: `ans-page-${Date.now()}`,
    question,
    scope,
    grounding: "grounded",
    answer: answerParagraphs,
    reasoning: `Visual and structural analysis of Page ${pNum} from "${bookName}", cross-referenced with your library's core knowledge base.`,
    practical: practicalItems,
    citations: [
      {
        bookId: pageContext.bookId || "active-book",
        chapter: `Page ${pNum}`,
        page: pNum,
        passage: `Visual capture & full-page context of Page ${pNum} from "${bookName}".`,
        relevance: `Direct whole-page visual capture selected from reading view.`,
      },
    ],
  };
}

/**
 * Synchronizes reading ask threads to shared session storage (libria_chat_sessions_v1)
 * so questions asked in the reader show up interconnectedly in the main AI Agent chat (/chat).
 */
function syncAskSessionToStorage(
  messages: ChatMessage[],
  contextDetail: string,
  bookTitle?: string
) {
  if (typeof window === "undefined" || messages.length === 0) return;
  try {
    const SESSIONS_STORAGE_KEY = "libria_chat_sessions_v1";
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    const existingSessions: any[] = raw ? JSON.parse(raw) : [];

    const firstUserMsg = messages.find((m) => m.role === "user");
    const sessionTitle = firstUserMsg
      ? (typeof firstUserMsg.content === "string" ? firstUserMsg.content.slice(0, 48) : "Page Discussion")
      : `${bookTitle || "Reader"} Inquiry`;

    const sessionId = `reader-${firstUserMsg?.id || "active"}`;
    const existingIndex = existingSessions.findIndex((s) => s.id === sessionId);

    const sessionObj = {
      id: sessionId,
      title: sessionTitle,
      createdAt: existingIndex >= 0 ? existingSessions[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        attachedPage: m.attachedPage,
        contextPassage: m.contextPassage,
        citations: m.citations,
        persona: "socratic",
      })),
      persona: "socratic",
    };

    if (existingIndex >= 0) {
      existingSessions[existingIndex] = sessionObj;
    } else {
      existingSessions.unshift(sessionObj);
    }

    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(existingSessions.slice(0, 25)));
  } catch (e) {
    console.warn("Could not sync reader ask session to storage", e);
  }
}

/**
 * Visualizer for the ReAct (Reasoning + Acting) Agent Loop
 * Shows Thought -> Action (Tool Call) -> Observation (Response) -> Next Thought
 */
function ReActLoopVisualizer({
  iterations,
  isLive,
}: {
  iterations: ReActIteration[];
  isLive?: boolean;
}) {
  const [expanded, setExpanded] = useState(isLive ?? false);
  const [openRawObs, setOpenRawObs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isLive) setExpanded(true);
  }, [isLive]);

  if (!iterations || iterations.length === 0) return null;

  const toolCallsCount = iterations.filter((it) => it.action).length;
  const totalDuration = iterations.reduce((acc, it) => acc + (it.durationMs || 0), 0);

  const toggleObs = (id: string) => {
    setOpenRawObs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full max-w-full min-w-0 my-2">
      {/* Header Accordion Toggle */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 select-none font-medium cursor-pointer"
      >
        <Brain size={13} className={isLive ? "text-accent animate-pulse" : "text-faint"} />
        <span>
          {isLive
            ? "Thinking & reasoning with tools…"
            : `Thought for ${(totalDuration / 1000).toFixed(1)}s (${toolCallsCount} tool ${toolCallsCount === 1 ? "call" : "calls"})`}
        </span>
        {expanded ? <ChevronUp size={12} className="text-faint" /> : <ChevronDown size={12} className="text-faint" />}
      </button>

      {/* Expanded Inline Timeline Stream (directly on chat, no boxes) */}
      {expanded ? (
        <div className="mt-2 pl-3 border-l border-border-subtle space-y-3 font-sans text-xs w-full max-w-full min-w-0 animate-in fade-in duration-150">
          {iterations.map((item) => (
            <div key={item.id} className="space-y-1.5 w-full max-w-full min-w-0">
              {/* 1. THOUGHT */}
              <div className="text-xs text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                <span className="font-semibold text-foreground/80 font-mono text-3xs uppercase tracking-wider mr-1.5">
                  Thought:
                </span>
                <span>{item.thought}</span>
              </div>

              {/* 2. ACTION (Tool Call) */}
              {item.action ? (
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-1.5 text-accent flex-wrap font-mono text-3xs">
                    <Terminal size={11} className="shrink-0" />
                    <span className="font-semibold text-foreground">Action:</span>
                    <span className="underline decoration-accent/40">{item.action.tool}</span>
                  </div>
                  {/* Tool Arguments */}
                  {Object.keys(item.action.args).length > 0 ? (
                    <div className="pl-3 text-3xs text-faint font-mono space-y-0.5">
                      {Object.entries(item.action.args).map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1 break-words [overflow-wrap:anywhere]">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="text-foreground">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 3. OBSERVATION (Tool Response) */}
              {item.observation ? (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-accent font-mono text-3xs uppercase tracking-wider">
                      <ArrowDownRight size={11} className="shrink-0" />
                      <span className="font-semibold">Observation</span>
                    </div>
                    {item.observation.details && item.observation.details.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleObs(item.id)}
                        className="text-3xs text-accent hover:underline flex items-center gap-0.5 font-sans cursor-pointer"
                      >
                        <span>{openRawObs[item.id] ? "Hide details" : "Inspect details"}</span>
                        {openRawObs[item.id] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {item.observation.summary}
                  </p>
                  {/* Collapsible details */}
                  {openRawObs[item.id] && item.observation.details ? (
                    <div className="pl-2.5 border-l border-border-subtle text-3xs text-muted-foreground space-y-1 pt-0.5">
                      {item.observation.details.map((line, idx) => (
                        <p key={idx} className="break-words [overflow-wrap:anywhere] leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Safely parses and renders inline code (`text`), bold (**text**), and italic (*text*) markers
 */
function renderInlineFormatting(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-xs px-1.5 py-0.5 rounded-xs bg-surface border border-border/70 text-accent font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Enhanced high-readability typography formatter for AI answers in AskPanel
 */
function FormattedProseContent({
  content,
  isStreaming,
}: {
  content: string | string[];
  isStreaming?: boolean;
}) {
  const text = Array.isArray(content) ? content.join("\n\n") : content;
  const blocks = useMemo(() => text.split(/\n\n+/), [text]);

  return (
    <div className="space-y-3.5 font-sans text-[15px] sm:text-[15.5px] leading-[1.7] sm:leading-[1.75] text-foreground/95 select-text tracking-normal">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading 4 (###)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="font-semibold text-sm sm:text-[15px] text-accent mt-3.5 mb-1">
              {renderInlineFormatting(trimmed.replace(/^###\s+/, ""))}
            </h4>
          );
        }
        // Heading 3 (##)
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="font-semibold text-base sm:text-lg text-foreground mt-4 mb-1.5">
              {renderInlineFormatting(trimmed.replace(/^##\s+/, ""))}
            </h3>
          );
        }
        // Heading 2 (#)
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="font-bold text-lg sm:text-xl text-foreground mt-4.5 mb-2 tracking-tight">
              {renderInlineFormatting(trimmed.replace(/^#\s+/, ""))}
            </h2>
          );
        }

        // Bullet or numbered lists
        const lines = trimmed.split("\n");
        const isList = lines.length > 1 && lines.every((l) => /^\s*([•\-\*]|\d+[\.\)])\s/.test(l));
        if (isList) {
          return (
            <ul key={idx} className="space-y-2 pl-2 sm:pl-3 my-2.5 list-none">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="flex items-start gap-2.5">
                  <span className="text-accent font-bold mt-1 shrink-0 text-xs select-none">•</span>
                  <span className="flex-1 leading-[1.7] sm:leading-[1.75] text-foreground/90">
                    {renderInlineFormatting(line.replace(/^\s*([•\-\*]|\d+[\.\)])\s+/, ""))}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="leading-[1.7] sm:leading-[1.75]">
            {renderInlineFormatting(trimmed)}
            {isStreaming && idx === blocks.length - 1 ? (
              <span className="inline-block w-1.5 h-4 bg-accent ml-1.5 animate-pulse align-middle rounded-xs" />
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Individual Chat Message Bubble
 */
function ChatMessageItem({
  message,
  onFollowUp,
}: {
  message: ChatMessage;
  onFollowUp?: (q: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  const paragraphs = Array.isArray(message.content)
    ? message.content
    : [message.content];

  const handleCopy = () => {
    const textToCopy = paragraphs.join("\n\n");
    void navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    toast.success("Saved to your reading notes");
    setTimeout(() => setSaved(false), 2500);
  };

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1 pl-6">
        <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-surface px-4 py-2.5 shadow-2xs max-w-[90%] sm:max-w-[85%] text-left text-[14.5px] sm:text-[15px] leading-[1.65]">
          {/* Attached Page Photo Badges (Multi-Page Support) */}
          {((message.attachedPages && message.attachedPages.length > 0) || message.attachedPage) ? (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {(message.attachedPages && message.attachedPages.length > 0
                ? message.attachedPages
                : [message.attachedPage!]
              ).map((p) => (
                <div
                  key={p.pageNumber}
                  className="flex items-center gap-2 rounded-xs border border-accent/30 bg-background/80 p-1.5 text-2xs text-muted-foreground shadow-2xs"
                >
                  <div className="h-10 w-8 rounded-xs overflow-hidden border border-border bg-surface shrink-0">
                    <img
                      src={p.imageUrl}
                      alt={`Page ${p.pageNumber}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono font-medium text-accent">Page {p.pageNumber}</p>
                    {p.bookTitle ? (
                      <p className="truncate text-3xs text-faint max-w-[120px]">{p.bookTitle}</p>
                    ) : null}
                    {p.pageText ? (
                      <p className="truncate text-3xs text-muted-foreground/80 max-w-[140px] italic font-serif">
                        “{p.pageText.slice(0, 35)}…”
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Attached Excerpt Badge */}
          {message.contextPassage ? (
            <div className="mb-2 flex items-start gap-1.5 rounded-xs border-l-2 border-accent bg-background/80 px-2 py-1 text-2xs text-muted-foreground">
              <Quote size={11} className="shrink-0 text-accent mt-0.5" />
              <p className="line-clamp-2 italic font-serif">“{message.contextPassage}”</p>
            </div>
          ) : null}

          <p className="whitespace-pre-wrap">
            {paragraphs.join("\n\n")}
          </p>
        </div>
        <span className="font-mono text-3xs text-faint pr-1.5">{message.timestamp}</span>
      </div>
    );
  }

  // Assistant Response (Direct ChatGPT-style layout)
  return (
    <div className="w-full space-y-3 animate-in fade-in duration-200">
      {/* Collapsible Reasoning / Thinking Trace (Hidden by Default) */}
      {((message.reactLoop && message.reactLoop.length > 0) || message.reasoning) && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 hover:bg-surface px-3 py-1.5 text-2xs font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
          >
            <Brain size={12} className="text-accent" />
            <span>
              {message.reactLoop && message.reactLoop.length > 0
                ? `${message.reactLoop.length} thought ${message.reactLoop.length === 1 ? "step" : "steps"}`
                : "Reasoning"}
            </span>
            <ChevronDown
              size={12}
              className={cn("transition-transform duration-200 text-faint", showReasoning && "rotate-180")}
            />
          </button>

          {showReasoning && (
            <div className="mt-2.5 space-y-2 border-l-2 border-accent/40 bg-surface/35 p-3 rounded-r-xs animate-in fade-in duration-150">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-accent flex items-center gap-1.5">
                <Brain size={12} />
                <span>Thought Trace & Retrieval</span>
              </p>

              {message.reasoning && (
                <p className="italic text-foreground/85 leading-relaxed font-sans text-xs">
                  "{message.reasoning}"
                </p>
              )}

              {message.reactLoop?.map((step) => (
                <div key={step.id} className="space-y-1 text-xs text-muted-foreground">
                  <p className="italic text-foreground/85 leading-relaxed font-sans">
                    "{step.thought}"
                  </p>
                  {step.action && (
                    <div className="flex items-center gap-1.5 text-2xs font-mono text-accent">
                      <Zap size={11} />
                      <span>Invoked tool: {step.action.tool}()</span>
                    </div>
                  )}
                  {step.observation?.summary && (
                    <div className="text-2xs text-muted-foreground bg-surface/70 border border-border-subtle p-2 rounded-xs whitespace-pre-line font-mono">
                      {step.observation.summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enhanced High-Readability Prose Content */}
      <FormattedProseContent content={message.content} isStreaming={message.isStreaming} />

      {/* Practical Actionable Takeaways */}
      {message.practical && message.practical.length > 0 && !message.isStreaming ? (
        <div className="mt-3 pt-2.5 border-t border-border-subtle space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles size={12} className="text-accent" />
            <span>Actionable Takeaways</span>
          </div>
          <ul className="space-y-1.5 text-sm text-foreground/90">
            {message.practical.map((item, i) => (
              <li key={i} className="flex items-start gap-2 min-w-0">
                <span className="text-accent font-bold mt-0.5 shrink-0">•</span>
                <span className="leading-relaxed break-words [overflow-wrap:anywhere] min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Collapsible Citations (Hidden by Default) */}
      {message.citations && message.citations.length > 0 && !message.isStreaming ? (
        <div className="pt-1.5">
          <button
            type="button"
            onClick={() => setShowCitations(!showCitations)}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 hover:bg-surface px-3 py-1.5 text-2xs font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
          >
            <Quote size={11} className="text-accent" />
            <span>
              {message.citations.length} {message.citations.length === 1 ? "Citation" : "Citations"}
            </span>
            <ChevronDown
              size={12}
              className={cn("transition-transform duration-200 text-faint", showCitations && "rotate-180")}
            />
          </button>

          {showCitations && (
            <div className="mt-2.5 pl-3 border-l-2 border-accent/40 animate-in fade-in duration-150">
              <CitationList citations={message.citations} />
            </div>
          )}
        </div>
      ) : null}

      {/* Message Actions (ChatGPT-style minimalist icon row) */}
      {!message.isStreaming ? (
        <div className="flex items-center gap-1 pt-1 text-faint">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy"}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-sm hover:bg-surface cursor-pointer"
          >
            {copied ? <CheckCircle2 size={13} className="text-accent" /> : <Copy size={13} />}
            {copied ? <span>Copied</span> : null}
          </button>
          <button
            type="button"
            onClick={handleSave}
            title={saved ? "Saved" : "Save note"}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-sm hover:bg-surface cursor-pointer"
          >
            <Bookmark size={13} className={saved ? "text-accent fill-accent" : ""} />
            {saved ? <span>Saved</span> : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Conversational Empty State (Clean Minimalist Hero)
 */
function ChatEmptyState({
  contextDetail,
}: {
  scope?: Scope;
  contextDetail?: string;
  contextPassage?: string | undefined;
  attachedPage?: AttachedPageContext | undefined;
  attachedPages?: AttachedPageContext[] | undefined;
  onSelectPrompt?: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center my-auto py-16 px-4 text-center space-y-3 animate-in fade-in duration-300 select-none">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-xs mb-1">
        <Sparkles size={22} strokeWidth={1.75} />
      </div>
      <h3 className="font-serif text-xl font-medium text-foreground tracking-tight">
        Ask Your Library
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
        {contextDetail ? `${contextDetail}. ` : ""}
        Extract core principles, clarify concepts, or translate insights into practical self-development habits.
      </p>
    </div>
  );
}

/**
 * Unified Agent Tools Popover Menu
 */
function AgentToolsPopover({
  open,
  onClose,
  scope,
  onSelectScope,
  availableScopes = ["selection", "page", "chapter", "book", "library"],
  hasPassage,
  thinkingMode,
  onToggleThinking,
  webSearch,
  onToggleWebSearch,
  actionPlanMode,
  onToggleActionPlan,
  synthesisMode,
  onToggleSynthesis,
}: {
  open: boolean;
  onClose: () => void;
  scope: Scope;
  onSelectScope: (s: Scope) => void;
  availableScopes?: Scope[];
  hasPassage: boolean;
  thinkingMode: boolean;
  onToggleThinking: () => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  actionPlanMode: boolean;
  onToggleActionPlan: () => void;
  synthesisMode: boolean;
  onToggleSynthesis: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-12 left-0 z-30 w-64 rounded-xl border border-border bg-reading p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 text-xs"
    >
      {/* Knowledge Scope Section */}
      <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
        Search Scope
      </div>
      <div className="space-y-0.5">
        {availableScopes.map((s) => {
          const isSelection = s === "selection";
          const disabled = isSelection && !hasPassage;
          const isSelected = scope === s;

          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelectScope(s);
                onClose();
              }}
              className={cn(
                "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
                isSelected
                  ? "bg-accent-soft text-accent font-medium"
                  : disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-foreground hover:bg-hover"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {s === "selection" && <Quote size={13} className="shrink-0 text-accent" />}
                {s === "page" && <FileText size={13} className="shrink-0 text-muted-foreground" />}
                {s === "chapter" && <Layers size={13} className="shrink-0 text-muted-foreground" />}
                {s === "book" && <FileText size={13} className="shrink-0 text-muted-foreground" />}
                {s === "library" && <Sparkles size={13} className="shrink-0 text-accent" />}
                <span className="truncate">{scopeLabel[s]}</span>
              </div>
              {isSelected ? <Check size={13} className="text-accent shrink-0" /> : null}
            </button>
          );
        })}
      </div>

      <div className="my-1.5 border-t border-border-subtle" />

      {/* Agent Tools & Capabilities Section */}
      <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
        Agent Modes
      </div>
      <div className="space-y-0.5">
        {/* Thinking Mode */}
        <button
          type="button"
          onClick={onToggleThinking}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
            thinkingMode
              ? "bg-accent-soft text-accent font-medium"
              : "text-foreground hover:bg-hover"
          )}
        >
          <div className="flex items-center gap-2">
            <Brain size={13} className={thinkingMode ? "text-accent" : "text-muted-foreground"} />
            <span>Thinking Mode</span>
          </div>
          {thinkingMode ? <Check size={13} className="text-accent" /> : null}
        </button>

        {/* Web Search */}
        <button
          type="button"
          onClick={onToggleWebSearch}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
            webSearch
              ? "bg-accent-soft text-accent font-medium"
              : "text-foreground hover:bg-hover"
          )}
        >
          <div className="flex items-center gap-2">
            <Globe size={13} className={webSearch ? "text-accent" : "text-muted-foreground"} />
            <span>Web Search</span>
          </div>
          {webSearch ? <Check size={13} className="text-accent" /> : null}
        </button>

        {/* Action Plan Mode */}
        <button
          type="button"
          onClick={onToggleActionPlan}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
            actionPlanMode
              ? "bg-accent-soft text-accent font-medium"
              : "text-foreground hover:bg-hover"
          )}
        >
          <div className="flex items-center gap-2">
            <Zap size={13} className={actionPlanMode ? "text-accent" : "text-muted-foreground"} />
            <span>Action Plan</span>
          </div>
          {actionPlanMode ? <Check size={13} className="text-accent" /> : null}
        </button>

        {/* Cross-Book Synthesis */}
        <button
          type="button"
          onClick={onToggleSynthesis}
          className={cn(
            "w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
            synthesisMode
              ? "bg-accent-soft text-accent font-medium"
              : "text-foreground hover:bg-hover"
          )}
        >
          <div className="flex items-center gap-2">
            <Layers size={13} className={synthesisMode ? "text-accent" : "text-muted-foreground"} />
            <span>Cross-Book Synthesis</span>
          </div>
          {synthesisMode ? <Check size={13} className="text-accent" /> : null}
        </button>
      </div>
    </div>
  );
}

/**
 * Seamless ChatGPT-Style Composer (With Stop button and tool popover)
 */
export function AskComposer({
  scope,
  onScope,
  onAsk,
  onStop,
  attachedPassage,
  onClearPassage,
  attachedPage,
  attachedPages,
  onClearPage,
  onClearAllPages,
  availableScopes,
  isStreaming,
  thinkingMode,
  setThinkingMode,
  webSearch,
  setWebSearch,
  actionPlanMode,
  setActionPlanMode,
  synthesisMode,
  setSynthesisMode,
}: {
  scope: Scope;
  onScope: (s: Scope) => void;
  onAsk: (q: string) => void;
  onStop?: () => void;
  attachedPassage?: string | undefined;
  onClearPassage?: () => void;
  attachedPage?: AttachedPageContext | undefined;
  attachedPages?: AttachedPageContext[] | undefined;
  onClearPage?: (pageNumber?: number) => void;
  onClearAllPages?: () => void;
  availableScopes?: Scope[] | undefined;
  isStreaming?: boolean;
  thinkingMode: boolean;
  setThinkingMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  webSearch: boolean;
  setWebSearch: (val: boolean | ((prev: boolean) => boolean)) => void;
  actionPlanMode: boolean;
  setActionPlanMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  synthesisMode: boolean;
  setSynthesisMode: (val: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const [value, setValue] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activePages = attachedPages && attachedPages.length > 0 ? attachedPages : attachedPage ? [attachedPage] : [];

  const handleSubmit = () => {
    if (!value.trim() || isStreaming) return;
    onAsk(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="shrink-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-4 pb-4 px-3 sm:px-4 z-10">
      {/* Floating Rounded Input Capsule */}
      <div className="relative flex flex-col rounded-2xl border border-border bg-surface/95 shadow-sm transition-all focus-within:border-accent/80 focus-within:ring-1 focus-within:ring-accent/20 p-2 sm:p-2.5">
        {/* Active Mode / Attached Passage / Attached Page Badges inside capsule */}
        {(activePages.length > 0 || attachedPassage || thinkingMode || webSearch || actionPlanMode || synthesisMode || scope !== "page") ? (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 px-1">
            {/* Attached Page Photo Chips (Multi-Page Support) */}
            {activePages.map((page) => (
              <div
                key={page.pageNumber}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft/40 pl-1 pr-2 py-0.5 text-2xs text-foreground shadow-2xs"
              >
                <div className="h-5 w-4 rounded-xs overflow-hidden border border-border shrink-0 bg-surface">
                  <img
                    src={page.imageUrl}
                    alt={`Page ${page.pageNumber}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="font-mono font-medium text-accent">Page {page.pageNumber}</span>
                {onClearPage ? (
                  <button
                    type="button"
                    onClick={() => onClearPage(page.pageNumber)}
                    className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5 cursor-pointer"
                    title={`Detach Page ${page.pageNumber}`}
                  >
                    <X size={10} />
                  </button>
                ) : null}
              </div>
            ))}
            {activePages.length > 1 && onClearAllPages ? (
              <button
                type="button"
                onClick={onClearAllPages}
                className="text-3xs text-faint hover:text-foreground transition-colors px-1 cursor-pointer"
                title="Clear all attached pages"
              >
                Clear all ({activePages.length})
              </button>
            ) : null}

            {/* Attached Passage Chip */}
            {attachedPassage ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/40 px-2 py-0.5 text-2xs text-foreground max-w-[200px]">
                <Quote size={10} className="text-accent shrink-0" />
                <span className="truncate italic font-serif">“{attachedPassage}”</span>
                {onClearPassage ? (
                  <button
                    type="button"
                    onClick={onClearPassage}
                    className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                    title="Detach passage"
                  >
                    <X size={10} />
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Scope Badge */}
            {scope !== "page" ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-muted-foreground font-mono">
                <span>{scopeLabel[scope]}</span>
                <button
                  type="button"
                  onClick={() => onScope("page")}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                  title="Reset scope"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            {/* Thinking Mode Pill */}
            {thinkingMode ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft/30 px-2 py-0.5 text-2xs text-accent">
                <Brain size={10} />
                <span>Thinking</span>
                <button
                  type="button"
                  onClick={() => setThinkingMode(false)}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            {/* Web Search Pill */}
            {webSearch ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-muted-foreground">
                <Globe size={10} className="text-accent" />
                <span>Web</span>
                <button
                  type="button"
                  onClick={() => setWebSearch(false)}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            {/* Action Plan Pill */}
            {actionPlanMode ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-muted-foreground">
                <Zap size={10} className="text-accent" />
                <span>Action Plan</span>
                <button
                  type="button"
                  onClick={() => setActionPlanMode(false)}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}

            {/* Cross-Book Synthesis Pill */}
            {synthesisMode ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-muted-foreground">
                <Layers size={10} className="text-accent" />
                <span>Synthesis</span>
                <button
                  type="button"
                  onClick={() => setSynthesisMode(false)}
                  className="text-muted-foreground hover:text-foreground shrink-0 ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={
            attachedPage
              ? `Ask anything about Page ${attachedPage.pageNumber}…`
              : attachedPassage
              ? "Ask about this highlighted passage…"
              : "Ask anything about what you're reading…"
          }
          className="w-full resize-none bg-transparent px-2 text-sm leading-[1.5] text-foreground placeholder:text-faint focus:outline-none max-h-[120px]"
        />

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between pt-2">
          {/* Unified Tool Icon Button (+) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen((p) => !p)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                toolsOpen || thinkingMode || webSearch || actionPlanMode || synthesisMode || attachedPassage
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:bg-hover hover:text-foreground"
              )}
              title="Agent Tools & Scopes"
            >
              <Plus size={16} strokeWidth={2} />
            </button>

            {/* Popover Menu */}
            <AgentToolsPopover
              open={toolsOpen}
              onClose={() => setToolsOpen(false)}
              scope={scope}
              onSelectScope={onScope}
              availableScopes={availableScopes}
              hasPassage={Boolean(attachedPassage)}
              thinkingMode={thinkingMode}
              onToggleThinking={() => setThinkingMode((p) => !p)}
              webSearch={webSearch}
              onToggleWebSearch={() => setWebSearch((p) => !p)}
              actionPlanMode={actionPlanMode}
              onToggleActionPlan={() => setActionPlanMode((p) => !p)}
              synthesisMode={synthesisMode}
              onToggleSynthesis={() => setSynthesisMode((p) => !p)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-faint hidden sm:inline">
              Enter ↵
            </span>

            {/* Stop Button (During Streaming) or Send Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generation"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xs hover:opacity-90 cursor-pointer animate-in zoom-in-90 duration-150"
                title="Stop generation"
              >
                <Square size={13} strokeWidth={2.5} className="fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim()}
                aria-label="Send message"
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full transition-all",
                  value.trim()
                    ? "bg-accent text-accent-foreground shadow-xs hover:opacity-90 cursor-pointer"
                    : "bg-surface text-muted-foreground/30 cursor-not-allowed"
                )}
              >
                <ArrowUp size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Conversational Ask Body with ReAct Agent Loop & Streaming
 */
export function AskBody({
  scope,
  setScope,
  contextDetail,
  contextPassage,
  attachedPage: propAttachedPage,
  attachedPages: propAttachedPages,
  onClearPage: propOnClearPage,
  onClearAllPages: propOnClearAllPages,
  activeBookId,
  activeBookTitle,
  answer,
  setAnswer,
  availableScopes,
}: {
  scope: Scope;
  setScope: (s: Scope) => void;
  contextDetail: string;
  contextPassage?: string | undefined;
  attachedPage?: AttachedPageContext | undefined;
  attachedPages?: AttachedPageContext[] | undefined;
  onClearPage?: (pageNumber?: number) => void;
  onClearAllPages?: () => void;
  activeBookId?: string | undefined;
  activeBookTitle?: string | undefined;
  answer?: Answer | null;
  setAnswer?: (a: Answer | null) => void;
  availableScopes?: Scope[] | undefined;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedPassage, setAttachedPassage] = useState<string | undefined>(contextPassage);
  const [attachedPages, setAttachedPages] = useState<AttachedPageContext[]>(() => {
    if (propAttachedPages && propAttachedPages.length > 0) return propAttachedPages;
    if (propAttachedPage) return [propAttachedPage];
    return [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Agent Mode States
  const [thinkingMode, setThinkingMode] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [actionPlanMode, setActionPlanMode] = useState(false);
  const [synthesisMode, setSynthesisMode] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<boolean>(false);

  // Update attached passage when user highlights a new selection
  useEffect(() => {
    if (contextPassage) {
      setAttachedPassage(contextPassage);
      setScope("selection");
    }
  }, [contextPassage, setScope]);

  // Update attached pages when multiple pages are passed
  useEffect(() => {
    if (propAttachedPages) {
      setAttachedPages(propAttachedPages);
      if (propAttachedPages.length > 0) setScope("page");
    }
  }, [propAttachedPages, setScope]);

  // Update attached pages when single page is passed
  useEffect(() => {
    if (propAttachedPage) {
      setAttachedPages((prev) => {
        if (prev.some((p) => p.pageNumber === propAttachedPage.pageNumber)) return prev;
        return [...prev, propAttachedPage];
      });
      setScope("page");
    }
  }, [propAttachedPage, setScope]);

  const handleRemovePage = (pageNum?: number) => {
    if (!pageNum) {
      setAttachedPages([]);
      if (propOnClearAllPages) propOnClearAllPages();
      else if (propOnClearPage) propOnClearPage();
      return;
    }
    setAttachedPages((prev) => prev.filter((p) => p.pageNumber !== pageNum));
    if (propOnClearPage) propOnClearPage(pageNum);
  };

  // Smooth auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, isStreaming]);

  // Detect if user scrolled up
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 120);
  };

  // Stop Generation Handler
  const handleStop = useCallback(() => {
    abortControllerRef.current = true;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === prev.length - 1 && msg.role === "assistant"
          ? { ...msg, isStreaming: false }
          : msg
      )
    );
    toast.info("Stopped generation");
  }, []);

  // Real Agent Execution: Libria Cloud Gateway + Qdrant
  const handleSendMessage = async (q: string) => {
    abortControllerRef.current = false;
    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // 1. Append User Message
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: q,
      timestamp: currentTime,
      scope,
      contextPassage: attachedPassage,
      attachedPages: [...attachedPages],
      attachedPage: attachedPages[0],
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMsgId = nanoid();

    // 2. Initial ReAct Iteration (Planning)
    const initialLoop: ReActIteration[] = [
      {
        id: "react-iter-1",
        iteration: 1,
        thought:
          attachedPages.length > 1
            ? `Analyzing ${attachedPages.length} attached pages (Pages ${attachedPages.map((p) => p.pageNumber).join(", ")}) with visual diagrams, drawings, tables, and text...`
            : attachedPages.length === 1
            ? `Analyzing Page ${attachedPages[0]!.pageNumber} text and visual page layout from "${attachedPages[0]!.bookTitle || activeBookTitle || "book"}"...`
            : attachedPassage
            ? "Analyzing selected passage context and synthesizing grounded answer..."
            : "Analyzing query intent and selecting optimal retrieval tool from book library...",
        status: "calling_tool",
      },
    ];

    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      scope,
      reactLoop: initialLoop,
      isStreaming: true,
      thinking: thinkingMode,
      webSearch,
      actionPlanMode,
      synthesisMode,
    };

    setMessages((prev) => [...prev, assistantMessage]);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const setIterationState = (
      updater: (prev: ReActIteration[]) => ReActIteration[]
    ) => {
      setMessages((all) =>
        all.map((m) =>
          m.id === assistantMsgId
            ? { ...m, reactLoop: updater(m.reactLoop || []) }
            : m
        )
      );
    };

    try {
      // 3. Invoke Fast-Path Reading Explanation or Agent RAG Pipeline
      const bookScopeId = attachedPages[0]?.bookId || activeBookId || undefined;
      const targetBookTitle = activeBookTitle || attachedPages[0]?.bookTitle || undefined;

      // Extract all page images for multimodal understanding (diagrams, tables, sketches)
      const pageImages = attachedPages
        .map((p) => p.imageUrl)
        .filter(Boolean);

      const isFastPath = Boolean(
        attachedPassage ||
        attachedPages.length > 0 ||
        scope === "selection" ||
        scope === "page"
      );

      let rawText = "";
      let duration = 300;
      let isConv = false;
      let planThought: string | undefined = undefined;
      let mappedCitations: Citation[] = [];

      if (isFastPath) {
        // Fast-Path: Direct Single-Pass Explanation (Sub-second response, 0 vector search overhead)
        const explainResult = await explainPassageApi({
          passage: attachedPassage,
          page_number: attachedPages[0]?.pageNumber,
          page_image: pageImages[0] || undefined,
          book_id: bookScopeId,
          book_title: targetBookTitle,
          query: q,
        });

        if (abortControllerRef.current) return;

        rawText = explainResult.explanation;
        duration = Math.round(explainResult.latency_ms || 350);
        isConv = false;
        planThought = "Direct single-pass reader explanation using structured 5-part framework.";

        setIterationState(() => [
          {
            id: "fast-path-1",
            iteration: 1,
            thought: attachedPages.length > 0
              ? `Inspected Page ${attachedPages[0]?.pageNumber} (${pageImages.length} snapshot) and generated structured 5-part explanation.`
              : attachedPassage
              ? "Extracted highlighted passage and generated structured 5-part explanation."
              : "Generated direct 5-part pedagogical explanation.",
            action: {
              tool: "direct_reader_fastpath",
              args: {
                scope,
                book: targetBookTitle || bookScopeId,
                has_passage: Boolean(attachedPassage),
                has_image: pageImages.length > 0,
              },
            },
            observation: {
              summary: `Generated structured explanation in ${(duration / 1000).toFixed(2)}s`,
              details: [
                targetBookTitle ? `Book: ${targetBookTitle}` : "Reader Excerpt",
                explainResult.page_number ? `Page ${explainResult.page_number}` : "Highlighted Text",
              ],
            },
            status: "completed",
            durationMs: duration,
          },
        ]);

        mappedCitations = [
          {
            bookId: targetBookTitle || "Active Reader",
            chapter: explainResult.page_number ? `Page ${explainResult.page_number}` : "Highlighted Passage",
            page: explainResult.page_number || 1,
            passage: explainResult.passage_snippet || attachedPassage || "Direct Reader Context",
            relevance: "100% Direct Grounded Match",
          },
        ];
      } else {
        // Agent Path: Full Vector Retrieval & Synthesis Pipeline
        let promptPayload = q;
        const apiResult = await askLibriaApi({
          query: promptPayload,
          effort_tier: thinkingMode ? "high" : "low",
          active_book_id: bookScopeId,
          images: pageImages.length > 0 ? pageImages : undefined,
        });

        if (abortControllerRef.current) return;

        rawText = apiResult.answer || "No advice could be synthesized.";
        duration = Math.round(apiResult.total_latency_ms || 300);
        isConv = apiResult.is_conversational;
        planThought = apiResult.plan_thought || undefined;

        setIterationState(() => [
          {
            id: "react-iter-1",
            iteration: 1,
            thought:
              apiResult.plan_thought ||
              (isConv
                ? "Classified query as conversational greeting. Providing direct warm response."
                : "Selected optimal retrieval tool and scoped to verified book wisdom."),
            action: isConv
              ? undefined
              : {
                  tool: "search_books",
                  args: { query: q, book_filter: bookScopeId || null },
                },
            observation: isConv
              ? undefined
              : {
                  summary: `Retrieved grounded book chunks (${apiResult.citations.length} citation${apiResult.citations.length === 1 ? "" : "s"}) in ${(duration / 1000).toFixed(1)}s`,
                  details:
                    apiResult.books_referenced.length > 0
                      ? apiResult.books_referenced.map((b) => `Referenced source: ${b}`)
                      : undefined,
                },
            status: "completed",
            durationMs: duration,
          },
        ]);

        mappedCitations = (apiResult.citations || []).map((c) => ({
          bookId: c.book_title,
          chapter: c.section || "General",
          page: 1,
          passage: c.quote || `Key principle from ${c.section || c.book_title}`,
          relevance: c.relevance_score
            ? `${Math.round(c.relevance_score * 100)}% Match`
            : "Grounded Citation",
        }));
      }

      // 4. Stream Real Paragraphs Word-by-Word
      const paragraphs = rawText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      const streamedParagraphs: string[] = [];

      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        if (abortControllerRef.current) break;
        const fullPara = paragraphs[pIdx];
        const words = fullPara.split(" ");
        let currentWords = "";

        for (let wIdx = 0; wIdx < words.length; wIdx++) {
          if (abortControllerRef.current) break;
          currentWords += (wIdx === 0 ? "" : " ") + words[wIdx];
          const draftParagraphs = [...streamedParagraphs, currentWords];

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: draftParagraphs,
                    grounding: "grounded",
                    citations: mappedCitations,
                  }
                : msg
            )
          );

          await sleep(16);
        }

        streamedParagraphs.push(fullPara);
        await sleep(50);
      }

      // 6. Finalize Message State
      setIsStreaming(false);
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                content: paragraphs,
                grounding: isConv ? "grounded" : (mappedCitations.length > 0 ? "grounded" : "not-found"),
                citations: mappedCitations,
                reasoning: planThought,
              }
            : msg
        );
        syncAskSessionToStorage(updated, contextDetail, attachedPages[0]?.bookTitle || activeBookTitle);
        return updated;
      });

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Agent connection error: ${errMsg}`);
      setIsStreaming(false);

      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                content: [
                  `⚠️ Could not reach the Libria RAG backend.`,
                  `Details: ${errMsg}`,
                  `Please ensure the backend is running at http://127.0.0.1:8000.`,
                ],
                grounding: "not-found" as Grounding,
              }
            : msg
        );
        return updated;
      });
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    if (setAnswer) setAnswer(null);
    toast.success("Started a new conversation");
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background relative overflow-hidden">
      {/* Top Thread Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-surface/30 text-xs">
        <div className="flex items-center gap-1.5 truncate text-muted-foreground">
          <span className="font-mono text-2xs text-faint">Scope:</span>
          <span className="font-medium text-foreground truncate">{scopeLabel[scope]}</span>
        </div>
        {messages.length > 0 ? (
          <button
            onClick={handleResetChat}
            className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-accent transition-colors"
            title="Start new chat"
          >
            <RotateCcw size={12} />
            <span>New Chat</span>
          </button>
        ) : null}
      </div>

      {/* Scrollable Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-4 space-y-6 transition-all min-w-0 w-full max-w-full"
      >
        {messages.length === 0 ? (
          <ChatEmptyState
            scope={scope}
            contextDetail={contextDetail}
            contextPassage={attachedPassage}
            attachedPage={attachedPages[0]}
            attachedPages={attachedPages}
            onSelectPrompt={handleSendMessage}
          />
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onFollowUp={handleSendMessage}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur-sm px-2.5 py-1 text-2xs text-muted-foreground shadow-md hover:text-foreground transition-all active:scale-95"
        >
          <ArrowDown size={11} />
          <span>Latest</span>
        </button>
      )}

      {/* Seamless ChatGPT-Style Bottom Composer */}
      <AskComposer
        scope={scope}
        onScope={(nextScope) => {
          setScope(nextScope);
          if (nextScope !== "selection") {
            setAttachedPassage(undefined);
          }
        }}
        onAsk={handleSendMessage}
        onStop={handleStop}
        attachedPassage={attachedPassage}
        onClearPassage={() => setAttachedPassage(undefined)}
        attachedPage={attachedPages[0]}
        attachedPages={attachedPages}
        onClearPage={handleRemovePage}
        onClearAllPages={() => handleRemovePage()}
        availableScopes={availableScopes}
        isStreaming={isStreaming}
        thinkingMode={thinkingMode}
        setThinkingMode={setThinkingMode}
        webSearch={webSearch}
        setWebSearch={setWebSearch}
        actionPlanMode={actionPlanMode}
        setActionPlanMode={setActionPlanMode}
        synthesisMode={synthesisMode}
        setSynthesisMode={setSynthesisMode}
      />
    </div>
  );
}

/**
 * Slide-over Panel Container
 */
export function AskPanel({
  open,
  onClose,
  contextDetail,
  contextPassage,
  attachedPage,
  attachedPages,
  onClearPage,
  onClearAllPages,
  activeBookId,
  activeBookTitle,
  initialScope = "page",
}: {
  open: boolean;
  onClose: () => void;
  contextDetail: string;
  contextPassage?: string | undefined;
  attachedPage?: AttachedPageContext | undefined;
  attachedPages?: AttachedPageContext[] | undefined;
  onClearPage?: (pageNumber?: number) => void;
  onClearAllPages?: () => void;
  activeBookId?: string | undefined;
  activeBookTitle?: string | undefined;
  initialScope?: Scope | undefined;
}) {
  const [scope, setScope] = useState<Scope>(initialScope);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const {
    isWide,
    isDragging,
    handlePointerDown,
    resetWidth,
    toggleWide,
    asideStyle,
  } = useResizableSidebar();

  if (!open) return null;

  return (
    <aside
      style={asideStyle}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-full max-w-full lg:max-w-none flex-col border-l border-border bg-background shadow-panel animate-in slide-in-from-right duration-200 transition-[width] duration-75 ease-out",
        isDragging && "select-none transition-none"
      )}
    >
      <SidebarResizeHandle
        onPointerDown={handlePointerDown}
        onDoubleClick={resetWidth}
        isDragging={isDragging}
      />
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquareQuote size={16} className="text-accent" />
          <span className="text-sm font-medium text-foreground">Ask AI</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label={isWide ? "Collapse width" : "Expand width"}
            onClick={toggleWide}
            className="hidden lg:inline-flex"
          >
            {isWide ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
          </IconButton>
          <IconButton label="Close Ask panel" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <AskBody
          scope={scope}
          setScope={setScope}
          contextDetail={contextDetail}
          contextPassage={contextPassage}
          attachedPage={attachedPage}
          attachedPages={attachedPages}
          onClearPage={onClearPage}
          onClearAllPages={onClearAllPages}
          activeBookId={activeBookId}
          activeBookTitle={activeBookTitle}
          answer={answer}
          setAnswer={setAnswer}
        />
      </div>
    </aside>
  );
}

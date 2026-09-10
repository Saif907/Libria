import { useState, useRef, useEffect, useCallback } from "react";
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
  suggestions,
  type Answer,
  type Citation,
  type Contradiction,
  type Grounding,
  type Scope,
  scopeLabel,
} from "@/lib/ask-data";
import { recentQuestions } from "@/lib/library-data";
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | string[];
  timestamp: string;
  scope?: Scope;
  contextPassage?: string;
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
  const [showSources, setShowSources] = useState(false);

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
      <div className="flex flex-col items-end gap-1.5 pl-8">
        <div className="rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-xs max-w-[90%] sm:max-w-[85%] text-left">
          {/* Attached Excerpt Badge */}
          {message.contextPassage ? (
            <div className="mb-2 flex items-start gap-1.5 rounded-xs border-l-2 border-accent bg-background/80 px-2 py-1 text-2xs text-muted-foreground">
              <Quote size={11} className="shrink-0 text-accent mt-0.5" />
              <p className="line-clamp-2 italic font-serif">“{message.contextPassage}”</p>
            </div>
          ) : null}

          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {paragraphs.join("\n\n")}
          </p>
        </div>
        <span className="font-mono text-2xs text-faint pr-1">{message.timestamp}</span>
      </div>
    );
  }

  // Assistant Response
  return (
    <div className="flex flex-col gap-2 pr-1 sm:pr-2 animate-in fade-in slide-in-from-bottom-1 duration-200 w-full max-w-full min-w-0 overflow-hidden">
      {/* Assistant Header */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-xs bg-accent-soft text-accent border border-accent/20 shrink-0">
          <Sparkles size={13} strokeWidth={2} />
        </div>
        <span className="text-xs font-medium text-foreground shrink-0">Marginalia</span>
        {message.grounding ? <GroundingBadge grounding={message.grounding} /> : null}
        {message.scope ? (
          <span className="text-2xs text-faint font-mono truncate">· {scopeLabel[message.scope]}</span>
        ) : null}
        <span className="ml-auto font-mono text-2xs text-faint shrink-0">{message.timestamp}</span>
      </div>

      {/* Assistant Body */}
      <div className="pl-5 sm:pl-6 space-y-3 w-full max-w-full min-w-0 overflow-hidden">
        {/* ReAct Agent Loop Visualizer (Thought -> Action -> Observation) */}
        {message.reactLoop && message.reactLoop.length > 0 ? (
          <ReActLoopVisualizer iterations={message.reactLoop} isLive={message.isStreaming} />
        ) : null}

        {/* Web Search Badge */}
        {message.webSearch ? (
          <div className="flex items-center gap-1.5 text-2xs text-faint font-mono">
            <Globe size={11} className="text-accent" />
            <span>Augmented with external search verification</span>
          </div>
        ) : null}

        {/* Streamed Paragraphs */}
        {paragraphs.map((para, idx) => (
          <p key={idx} className="font-serif text-sm sm:text-[14.5px] leading-[1.65] text-foreground break-words [overflow-wrap:anywhere]">
            {para}
            {message.isStreaming && idx === paragraphs.length - 1 ? (
              <span className="inline-block w-1.5 h-3.5 bg-accent ml-1 animate-pulse align-middle" />
            ) : null}
          </p>
        ))}

        {/* Practical Actionable Takeaways - directly in chat flow, no box */}
        {message.practical && message.practical.length > 0 && !message.isStreaming ? (
          <div className="mt-4 pt-3 border-t border-border-subtle space-y-2">
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

        {/* Collapsible Citations & Evidence - directly on chat */}
        {message.citations && message.citations.length > 0 && !message.isStreaming ? (
          <div className="pt-2">
            <button
              onClick={() => setShowSources((p) => !p)}
              className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showSources ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>
                {message.citations.length} {message.citations.length === 1 ? "Source citation" : "Source citations"}
              </span>
            </button>
            {showSources ? (
              <div className="mt-2 pl-3 border-l border-border-subtle">
                <CitationList citations={message.citations} />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Message Action Bar (Hidden while streaming) */}
        {!message.isStreaming ? (
          <div className="flex items-center gap-1 pt-1">
            <Button
              size="sm"
              variant="tertiary"
              onClick={handleCopy}
              className="h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>

            <Button
              size="sm"
              variant="tertiary"
              onClick={handleSave}
              className="h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
            >
              <Bookmark size={11} className={saved ? "text-accent fill-accent" : ""} />
              <span>{saved ? "Saved" : "Save note"}</span>
            </Button>
          </div>
        ) : null}

        {/* Quick Follow-up Chips */}
        {onFollowUp && !message.isStreaming ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button
              onClick={() => onFollowUp("Can you give a practical real-world example?")}
              className="rounded-xs border border-border-subtle bg-background px-2 py-1 text-2xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
            >
              Give a practical example
            </button>
            <button
              onClick={() => onFollowUp("What is the primary counter-argument to this?")}
              className="rounded-xs border border-border-subtle bg-background px-2 py-1 text-2xs text-muted-foreground hover:border-accent hover:text-accent transition-colors"
            >
              What is the counter-argument?
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Conversational Empty State
 */
function ChatEmptyState({
  scope,
  contextDetail,
  contextPassage,
  onSelectPrompt,
}: {
  scope: Scope;
  contextDetail: string;
  contextPassage?: string | undefined;
  onSelectPrompt: (q: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center my-auto py-8 px-2 text-center space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="space-y-2 max-w-xs">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xs bg-accent-soft text-accent border border-accent/20">
          <Sparkles size={20} strokeWidth={1.75} />
        </div>
        <h3 className="font-serif text-lg font-medium text-foreground">
          Ask Your Library
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {contextDetail ? `${contextDetail}. ` : ""}
          Extract core principles, clarify concepts, or translate insights into practical self-development habits.
        </p>
      </div>

      {/* Selected Passage Card */}
      {contextPassage ? (
        <div
          onClick={() => onSelectPrompt("Explain what the author means in this passage and how to apply it.")}
          className="group w-full max-w-sm rounded-sm border border-accent/40 bg-accent-soft/20 p-3 text-left transition-all hover:border-accent hover:bg-accent-soft/30 cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.08em] text-accent mb-1.5">
            <Quote size={11} />
            <span>Selected Passage Ready</span>
          </div>
          <p className="font-serif text-xs italic text-foreground line-clamp-3 leading-relaxed">
            “{contextPassage}”
          </p>
          <p className="mt-2 text-2xs text-accent font-medium flex items-center gap-1">
            <span>Ask about this passage</span>
            <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
      ) : null}

      {/* Contextual Suggestions Grid */}
      <div className="w-full max-w-sm space-y-2 text-left">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-faint px-1">
          Suggested Questions ({scopeLabel[scope]})
        </p>
        <div className="grid gap-2">
          {(suggestions[scope] || suggestions.book).slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => onSelectPrompt(q)}
              className="w-full rounded-xs border border-border bg-surface/50 p-2.5 text-left text-xs text-foreground transition-all hover:border-accent hover:bg-surface hover:text-accent flex items-center justify-between gap-2 shadow-2xs"
            >
              <span className="truncate">{q}</span>
              <ChevronRight size={13} className="shrink-0 text-faint" />
            </button>
          ))}
        </div>
      </div>

      {/* Recent Inquiries */}
      {recentQuestions.length > 0 ? (
        <div className="w-full max-w-sm text-left pt-1">
          <p className="text-2xs font-medium uppercase tracking-[0.08em] text-faint px-1 mb-1.5">
            Recent Inquiries
          </p>
          <div className="space-y-1">
            {recentQuestions.slice(0, 2).map((q) => (
              <button
                key={q}
                onClick={() => onSelectPrompt(q)}
                className="w-full truncate text-left text-xs text-muted-foreground hover:text-accent transition-colors py-1 px-1"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
            <span>Thinking Mode (ReAct)</span>
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
        {/* Active Mode / Attached Passage Badges inside capsule */}
        {(attachedPassage || thinkingMode || webSearch || actionPlanMode || synthesisMode || scope !== "page") ? (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 px-1">
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
                <span>ReAct</span>
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
            attachedPassage
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
  answer,
  setAnswer,
  availableScopes,
}: {
  scope: Scope;
  setScope: (s: Scope) => void;
  contextDetail: string;
  contextPassage?: string | undefined;
  answer?: Answer | null;
  setAnswer?: (a: Answer | null) => void;
  availableScopes?: Scope[] | undefined;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedPassage, setAttachedPassage] = useState<string | undefined>(contextPassage);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Agent Mode States
  const [thinkingMode, setThinkingMode] = useState(true);
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

  // ReAct Orchestrator: Thought -> Action -> Observation -> Next Thought -> Final Output
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
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMsgId = nanoid();

    // 2. Build Iteration 1 of ReAct Loop
    const initialLoop: ReActIteration[] = [
      {
        id: "react-iter-1",
        iteration: 1,
        thought: `To answer this inquiry within '${scopeLabel[scope]}', I need to extract the foundational principles and author frameworks on habit architecture and cognitive friction.`,
        action: {
          tool: "search_library_vectors",
          args: {
            query: attachedPassage ? attachedPassage.slice(0, 50) : q,
            scope,
            top_k: 4,
          },
        },
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

    // Helper: update or add ReAct iteration
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

    // Execute Iteration 1 (Tool Call -> Observation)
    await sleep(400);
    if (abortControllerRef.current) return;

    setIterationState((list) =>
      list.map((it) =>
        it.id === "react-iter-1"
          ? {
              ...it,
              status: "received_observation",
              durationMs: 400,
              observation: {
                summary: "Retrieved 3 high-confidence semantic chunks from Chapter 3 & 4 (Relevance: 0.91)",
                details: [
                  "Chunk 1: 'Environment design is the invisible hand that shapes human behavior...'",
                  "Chunk 2: 'Friction must be reduced to near-zero for the initiation phase of compounding...'",
                  "Chunk 3: 'Never rely on motivation when standardizing defaults in writing.'",
                ],
              },
            }
          : it
      )
    );

    // Iteration 2: Next Thought based on Observation 1
    await sleep(250);
    if (abortControllerRef.current) return;

    const secondIteration: ReActIteration = {
      id: "react-iter-2",
      iteration: 2,
      thought: webSearch
        ? "The retrieved book passages establish the internal theory. However, the user requested external empirical validation. I will call web search to cross-verify contemporary studies."
        : "The retrieved passages provide strong theoretical foundations. Now I must analyze potential contradictions and synthesize a concrete personal development heuristic.",
      action: webSearch
        ? {
            tool: "web_grounding_search",
            args: { query: "habit formation friction defaults empirical studies 66 days", max_results: 3 },
          }
        : {
            tool: "synthesize_cross_perspectives",
            args: {
              primary_principle: "Environment defaults over resolve",
              counter_perspective_check: true,
            },
          },
      status: "calling_tool",
    };

    setIterationState((list) => [...list, secondIteration]);

    await sleep(450);
    if (abortControllerRef.current) return;

    setIterationState((list) =>
      list.map((it) =>
        it.id === "react-iter-2"
          ? {
              ...it,
              status: "completed",
              durationMs: 450,
              observation: {
                summary: webSearch
                  ? "Validated with 2 peer-reviewed behavioral papers on context modification"
                  : "Synthesized core agreement across 3 library authors; identified 1 actionable nuance",
                details: webSearch
                  ? [
                      "Study A: 'Context architecture demonstrates a 2.4x higher adherence rate than willpower goals.'",
                      "Study B: 'Habit automaticity averages 66 days when environmental triggers are consistent.'",
                    ]
                  : [
                      "Synthesis: Clear (Atomic Habits) and Newport (Deep Work) agree on structural defense of attention.",
                      "Nuance: Epstein (Range) cautions against premature narrow specialization.",
                    ],
              },
            }
          : it
      )
    );

    // Final Thought before answering
    await sleep(200);
    if (abortControllerRef.current) return;

    const finalIteration: ReActIteration = {
      id: "react-iter-3",
      iteration: 3,
      thought: "Sufficient evidence collected from all tool observations. I am now synthesizing the complete grounded response with direct actionable heuristics.",
      status: "completed",
      durationMs: 150,
    };

    setIterationState((list) => [...list, finalIteration]);

    // 3. Resolve Answer Content
    let resolvedAnswer: Answer;
    if (attachedPassage && scope === "selection") {
      resolvedAnswer = answerForPassage(attachedPassage, q, scope, {
        thinking: thinkingMode,
        web: webSearch,
        actionPlan: actionPlanMode,
        synthesis: synthesisMode,
      });
    } else {
      resolvedAnswer = answerFor(scope, q);
    }

    // 4. Stream Answer Word by Word
    const paragraphs = resolvedAnswer.answer;
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
                  grounding: resolvedAnswer.grounding,
                  citations: resolvedAnswer.citations,
                  practical: resolvedAnswer.practical,
                }
              : msg
          )
        );

        await sleep(26);
      }

      streamedParagraphs.push(fullPara);
      await sleep(70);
    }

    // 5. Finalize
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMsgId
          ? {
              ...msg,
              isStreaming: false,
              content: paragraphs,
              grounding: resolvedAnswer.grounding,
              citations: resolvedAnswer.citations,
              practical: resolvedAnswer.practical,
              contradictions: resolvedAnswer.contradictions,
              reasoning: resolvedAnswer.reasoning,
            }
          : msg
      )
    );

    if (setAnswer) {
      setAnswer(resolvedAnswer);
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
      <div className="shrink-0 flex items-center justify-between border-b border-border-subtle px-4 py-2 bg-surface/30 text-xs">
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
            onSelectPrompt={handleSendMessage}
          />
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onFollowUp={msg.role === "assistant" ? handleSendMessage : undefined}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottom ? (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur-sm px-2.5 py-1 text-2xs text-muted-foreground shadow-md hover:text-foreground transition-all"
        >
          <ArrowDown size={12} />
          <span>Latest</span>
        </button>
      ) : null}

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
  initialScope = "page",
}: {
  open: boolean;
  onClose: () => void;
  contextDetail: string;
  contextPassage?: string | undefined;
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
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3 shrink-0">
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
          answer={answer}
          setAnswer={setAnswer}
        />
      </div>
    </aside>
  );
}

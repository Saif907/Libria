import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchCloudSessions,
  fetchSessionMessages,
  createCloudSession,
  deleteCloudSession,
  updateCloudSessionTitle,
  persistTurnInBackground,
  generateUuid,
} from "@/lib/chat-service";
import { AppShell } from "@/components/app/AppShell";
import { Button, IconButton } from "@/components/app/primitives";
import { AgentSettingsModal } from "@/components/app/AgentSettingsModal";
import { TagPickerPopover } from "@/components/app/TagPicker";
import {
  useAgentSettings,
  AGENT_PERSONAS,
  type AgentPersonaId,
} from "@/lib/agent-settings";
import { getLibrary, type LibraryBook } from "@/lib/books";
import { type Citation } from "@/lib/ask-data";
import { askLibriaApi } from "@/lib/api";
import type { AttachedPageContext } from "@/components/app/AskPanel";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Send,
  Square,
  BookOpen,
  Hash,
  Brain,
  Globe,
  SlidersHorizontal,
  User,
  Plus,
  Trash2,
  MessageSquare,
  History,
  Copy,
  Bookmark,
  Zap,
  CheckCircle2,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Quote,
  X,
} from "lucide-react";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Libria Agent — Personal AI Wisdom Workspace" },
      {
        name: "description",
        content:
          "Conversational AI mentor grounded in your library of books, personal notes, and growth goals.",
      },
    ],
  }),
  component: ChatWorkspacePage,
});

/* ---------- Types for Chat Sessions ---------- */

interface ReActIteration {
  id: string;
  iteration: number;
  thought: string;
  action?: {
    tool: string;
    args: Record<string, unknown>;
  };
  observation?: string;
  status: "thinking" | "calling_tool" | "observing" | "complete";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | string[];
  timestamp: string;
  attachedPage?: AttachedPageContext;
  contextPassage?: string;
  persona?: AgentPersonaId;
  taggedBooks?: string[];
  taggedCategories?: string[];
  personalContextUsed?: boolean;
  notesAccessed?: boolean;
  reactLoop?: ReActIteration[];
  reasoning?: string;
  isStreaming?: boolean;
  citations?: Citation[];
  takeaways?: string[];
  actionProtocol?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  persona: AgentPersonaId;
}

// Local storage helpers deprecated in favor of Supabase cloud persistence in chat-service.ts

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
 * Enhanced high-readability typography formatter for AI answers
 * Features 16px/16.5px font size, relaxed 1.85 line-height, proper paragraph separation, and formatted headings
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
 * Modular Chat Message Bubble with collapsible Reasoning and Citations dropdowns
 */
function ChatMessageItem({
  msg,
  books,
}: {
  msg: ChatMessage;
  books: LibraryBook[];
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = () => {
    const text = Array.isArray(msg.content) ? msg.content.join("\n\n") : msg.content;
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success("Copied answer to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    toast.success("Saved advice to your reading notes");
    setTimeout(() => setSaved(false), 2500);
  };

  if (msg.role === "user") {
    return (
      <div className="flex items-start justify-end gap-3 animate-in fade-in duration-200">
        <div className="max-w-[85%] sm:max-w-[75%] space-y-1.5 text-right">
          <div className="inline-block rounded-2xl sm:rounded-3xl bg-surface border border-border/80 px-4 py-2.5 sm:py-3 text-[14.5px] sm:text-[15px] text-foreground shadow-2xs leading-[1.65] text-left">
            {/* Attached Page Photo Badge */}
            {msg.attachedPage ? (
              <div className="mb-2.5 flex items-center gap-2 rounded-sm border border-accent/30 bg-background/80 p-2 text-2xs text-muted-foreground">
                <div className="h-10 w-8 rounded-xs overflow-hidden border border-border bg-surface shrink-0 shadow-2xs">
                  <img
                    src={msg.attachedPage.imageUrl}
                    alt={`Page ${msg.attachedPage.pageNumber}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-mono font-medium text-accent">Page {msg.attachedPage.pageNumber}</p>
                  {msg.attachedPage.bookTitle ? (
                    <p className="truncate text-3xs text-faint max-w-[180px]">{msg.attachedPage.bookTitle}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Attached Excerpt Badge */}
            {msg.contextPassage ? (
              <div className="mb-2.5 flex items-start gap-2 rounded-xs border-l-2 border-accent bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground">
                <Quote size={12} className="shrink-0 text-accent mt-0.5" />
                <p className="line-clamp-2 italic font-serif">“{msg.contextPassage}”</p>
              </div>
            ) : null}

            {typeof msg.content === "string" ? msg.content : msg.content.join("\n\n")}
          </div>

          {/* Tag badges */}
          {((msg.taggedBooks && msg.taggedBooks.length > 0) ||
            (msg.taggedCategories && msg.taggedCategories.length > 0)) && (
            <div className="flex flex-wrap items-center justify-end gap-1.5 text-2xs font-mono text-muted-foreground pt-0.5">
              {msg.taggedBooks?.map((bid) => {
                const b = books.find((x) => x.id === bid);
                return (
                  <span
                    key={bid}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs"
                  >
                    <BookOpen size={10} className="text-accent" />
                    <span>{b?.title || bid}</span>
                  </span>
                );
              })}
              {msg.taggedCategories?.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs capitalize"
                >
                  <Hash size={10} className="text-accent" />
                  <span>{cat.replace(/_/g, " ")}</span>
                </span>
              ))}
            </div>
          )}

          <span className="block text-2xs text-faint font-mono pr-1">
            {msg.timestamp}
          </span>
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="w-full space-y-3.5 animate-in fade-in duration-200">

        {/* Collapsible Reasoning / Thinking Trace (Hidden by Default) */}
        {((msg.reactLoop && msg.reactLoop.length > 0) || msg.reasoning) && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 hover:bg-surface px-3 py-1.5 text-2xs font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
            >
              <Brain size={12} className="text-accent" />
              <span>
                {msg.reactLoop && msg.reactLoop.length > 0
                  ? `${msg.reactLoop.length} thought ${msg.reactLoop.length === 1 ? "step" : "steps"}`
                  : "Reasoning"}
              </span>
              <ChevronDown
                size={12}
                className={cn("transition-transform duration-200 text-faint", showReasoning && "rotate-180")}
              />
            </button>

            {showReasoning && (
              <div className="mt-3 space-y-2.5 border-l-2 border-accent/40 bg-surface/35 p-3 rounded-r-xs animate-in fade-in duration-150">
                <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-accent flex items-center gap-1.5">
                  <Brain size={12} />
                  <span>Thought Trace & Retrieval</span>
                </p>

                {msg.reasoning && (
                  <p className="italic text-foreground/85 leading-relaxed font-serif text-xs">
                    "{msg.reasoning}"
                  </p>
                )}

                {msg.reactLoop?.map((step) => (
                  <div key={step.id} className="space-y-1 text-xs text-muted-foreground">
                    <p className="italic text-foreground/85 leading-relaxed font-serif">
                      "{step.thought}"
                    </p>

                    {step.action && (
                      <div className="flex items-center gap-1.5 text-2xs font-mono text-accent">
                        <Zap size={11} />
                        <span>Invoked tool: {step.action.tool}()</span>
                      </div>
                    )}

                    {step.observation && (
                      <div className="text-2xs text-muted-foreground bg-surface/70 border border-border-subtle p-2 rounded-xs whitespace-pre-line font-mono">
                        {step.observation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enhanced High-Readability Prose Content */}
        <FormattedProseContent content={msg.content} isStreaming={msg.isStreaming} />

        {/* Action Protocol (If Coach mode) */}
        {msg.actionProtocol && msg.actionProtocol.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground flex items-center gap-1.5">
              <Zap size={12} className="text-accent" />
              <span>Action Protocol</span>
            </p>
            <div className="space-y-1.5">
              {msg.actionProtocol.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-sm text-foreground bg-surface/40 p-2.5 rounded-sm border border-border-subtle"
                >
                  <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Takeaways */}
        {msg.takeaways && msg.takeaways.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
              Key Takeaways
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
              {msg.takeaways.map((t, idx) => (
                <li key={idx} className="leading-relaxed">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible Literature Citations (Hidden by Default) */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCitations(!showCitations)}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 hover:bg-surface px-3 py-1.5 text-2xs font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
            >
              <Quote size={11} className="text-accent" />
              <span>{msg.citations.length} {msg.citations.length === 1 ? "Citation" : "Citations"}</span>
              <ChevronDown
                size={12}
                className={cn("transition-transform duration-200 text-faint", showCitations && "rotate-180")}
              />
            </button>

            {showCitations && (
              <div className="mt-3 space-y-2 pt-1 animate-in fade-in duration-150">
                <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint flex items-center gap-1.5">
                  <Quote size={11} />
                  <span>Literature Grounding</span>
                </p>
                <div className="grid gap-2">
                  {msg.citations.map((c, idx) => {
                    const b = books.find((x) => x.id === c.bookId);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-sm border border-border bg-surface/40 space-y-1 text-2xs"
                      >
                        <div className="flex items-center justify-between font-mono text-foreground font-medium">
                          <span>{b?.title || c.bookId}</span>
                          <span className="text-faint">{c.chapter}</span>
                        </div>
                        <p className="font-serif italic text-muted-foreground leading-relaxed">
                          “{c.passage}”
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message Actions (ChatGPT-style clean action row) */}
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
      </div>
  );
}

/* ---------- Main Component ---------- */

function ChatWorkspacePage() {
  const { settings, activePersona, setPersona } = useAgentSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Books Query
  const { data: books = [] } = useQuery({
    queryKey: ["library"],
    queryFn: () => getLibrary(),
    staleTime: 5 * 60 * 1000,
  });

  // Sessions State (Loaded from Cloud Supabase)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Initial Cloud Load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const cloudSessions = await fetchCloudSessions();
      if (!isMounted) return;

      if (cloudSessions.length > 0) {
        setSessions(cloudSessions);
        setActiveSessionId(cloudSessions[0].id);

        // Pre-fetch messages for the most recent conversation
        const initialMsgs = await fetchSessionMessages(cloudSessions[0].id);
        if (isMounted) {
          setSessions((prev) =>
            prev.map((s) => (s.id === cloudSessions[0].id ? { ...s, messages: initialMsgs } : s))
          );
        }
      } else {
        // Create initial default session if none exist in cloud
        const initial = await createCloudSession(
          "Self-Development & Habit Architecture",
          settings.persona
        );
        if (isMounted) {
          setSessions([initial]);
          setActiveSessionId(initial.id);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Active Session helper
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const messages = activeSession?.messages || [];

  // Smooth Session Switcher (Fetches messages on-demand with 0ms in-memory cache)
  const handleSelectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const target = sessions.find((s) => s.id === sessionId);
    if (target && target.messages.length === 0) {
      const msgs = await fetchSessionMessages(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, messages: msgs } : s))
      );
    }
  }, [sessions]);

  // Composer Input & Toggles
  const [inputQuery, setInputQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Tagging & Tools Toggles
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerMode, setTagPickerMode] = useState<"books" | "categories">("books");
  const [thinkingMode, setThinkingMode] = useState(false);
  const [webSearch, setWebSearch] = useState(settings.webSearchDefault);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  // Close tools popover when clicking outside
  useEffect(() => {
    if (!toolsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [toolsMenuOpen]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<boolean>(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputQuery]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages.length, isStreaming]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 120);
  };

  // Session Actions
  const handleNewChat = async () => {
    // 1. If currently in a new chat with 0 messages, do not create another one
    if (activeSession && activeSession.messages.length === 0) {
      setSelectedBooks([]);
      setSelectedCategories([]);
      textareaRef.current?.focus();
      return;
    }

    // 2. If an empty session already exists in the list, switch to it instead of creating duplicates
    const existingEmpty = sessions.find((s) => s.messages.length === 0);
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      setSelectedBooks([]);
      setSelectedCategories([]);
      textareaRef.current?.focus();
      return;
    }

    // 3. Otherwise, create a new conversation
    const newSession = await createCloudSession("New Conversation", settings.persona);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setSelectedBooks([]);
    setSelectedCategories([]);
    textareaRef.current?.focus();
    toast.success("Started a new conversation");
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCloudSession(sessionId).catch(() => {});
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const freshId = generateUuid();
        const fresh: ChatSession = {
          id: freshId,
          title: "New Conversation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          persona: settings.persona,
        };
        createCloudSession(fresh.title, fresh.persona).catch(() => {});
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0]!.id);
      }
      return filtered;
    });
    toast.info("Deleted conversation");
  };

  const handleStop = () => {
    abortControllerRef.current = true;
    setIsStreaming(false);
    toast.info("Stopped generation");
  };

  // Send & Stream Message
  const handleSendMessage = async (rawQuery?: string) => {
    const q = (rawQuery || inputQuery).trim();
    if (!q || isStreaming || !activeSession) return;

    abortControllerRef.current = false;
    setInputQuery("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // 1. Append User Message (Optimistic UI update)
    const userMsg: ChatMessage = {
      id: generateUuid(),
      role: "user",
      content: q,
      timestamp: currentTime,
      taggedBooks: [...selectedBooks],
      taggedCategories: [...selectedCategories],
    };

    // Auto-update session title if it was "New Conversation"
    const isFirst = messages.length === 0;
    const updatedTitle = isFirst ? (q.length > 38 ? `${q.slice(0, 38)}...` : q) : activeSession.title;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: updatedTitle,
              updatedAt: new Date().toISOString(),
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    setIsStreaming(true);

    const assistantMsgId = generateUuid();

    // Map tagged book titles for prompt synthesis
    const taggedBookTitles = selectedBooks
      .map((id) => books.find((b) => b.id === id)?.title)
      .filter(Boolean) as string[];

    const personalContextUsed = settings.personalContext.enabled;
    const notesAccessed = settings.accessNotes;    // 2. Initialize ReAct Loop with real initial status
    const initialLoop: ReActIteration[] = [
      {
        id: "react-iter-1",
        iteration: 1,
        thought: `Synthesizing inquiry under ${activePersona.name} persona: "${q}". ${
          taggedBookTitles.length > 0
            ? `Restricting retrieval to tagged books: ${taggedBookTitles.join(", ")}.`
            : "Searching across verified book library."
        } ${
          personalContextUsed
            ? `Aligning with user's current focus ("${settings.personalContext.currentFocus}").`
            : ""
        }`,
        action: {
          tool: "search_books",
          args: {
            query: q,
            books: taggedBookTitles.length > 0 ? taggedBookTitles : "All library books",
          },
        },
        status: "calling_tool",
      },
    ];

    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      persona: settings.persona,
      personalContextUsed,
      notesAccessed,
      reactLoop: initialLoop,
      isStreaming: true,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? { ...s, messages: [...s.messages, initialAssistantMsg] }
          : s
      )
    );

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // 3. Invoke Real Backend API (Dynamic Effort Tier, Scoped Books & Context Window)
      const bookScopeId = selectedBooks.length > 0 ? selectedBooks[0] : undefined;

      // Extract prior conversation history based on user settings (0 to 30 turns)
      const contextTurns = settings.contextWindowTurns ?? 10;
      const historyTurns =
        contextTurns > 0
          ? messages.slice(-contextTurns).map((m) => ({
              role: m.role,
              content: Array.isArray(m.content) ? m.content.join("\n\n") : m.content,
            }))
          : [];

      const apiResult = await askLibriaApi({
        query: q,
        effort_tier: thinkingMode ? "high" : "low",
        active_book_id: bookScopeId,
        tagged_books: selectedBooks.length > 0 ? selectedBooks : null,
        history: historyTurns.length > 0 ? historyTurns : null,
      });

      if (abortControllerRef.current) return;

      // Update ReAct Loop Visualization with real execution metadata
      const duration = Math.round(apiResult.total_latency_ms || 350);
      const isConv = apiResult.is_conversational;

      const updatedLoop: ReActIteration[] = [
        {
          id: "react-iter-1",
          iteration: 1,
          thought:
            apiResult.plan_thought ||
            (isConv
              ? "Classified query as conversational dialog. Providing direct response."
              : `Synthesized retrieval plan scoped to verified library wisdom.`),
          action: isConv
            ? undefined
            : {
                tool: "search_books",
                args: {
                  query: q,
                  books: taggedBookTitles.length > 0 ? taggedBookTitles : "Library collection",
                },
              },
          observation: isConv
            ? "Direct conversational synthesis completed."
            : `Retrieved grounded chunks (${apiResult.citations?.length || 0} citation${apiResult.citations?.length === 1 ? "" : "s"}) in ${(duration / 1000).toFixed(1)}s`,
          status: "complete",
        },
      ];

      // 4. Map Grounded Citations
      const mappedCitations: Citation[] = (apiResult.citations || []).map((c) => ({
        bookId: c.book_title,
        chapter: c.section || "General",
        page: 1,
        passage: c.quote || `Core principle from ${c.section || c.book_title}`,
        relevance: c.relevance_score
          ? `${Math.round(c.relevance_score * 100)}% Match`
          : "Grounded Citation",
      }));

      // 5. Stream Real Paragraphs Word-by-Word
      const rawText = apiResult.answer || "No advice could be synthesized.";
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

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== activeSession.id) return s;
              return {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id !== assistantMsgId) return m;
                  return {
                    ...m,
                    content: draftParagraphs,
                    citations: mappedCitations,
                    reactLoop: updatedLoop,
                  };
                }),
              };
            })
          );

          await sleep(16);
        }

        streamedParagraphs.push(fullPara);
        await sleep(35);
      }

      // 6. Finalize Message State
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSession.id) return s;
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return {
                ...m,
                content: paragraphs,
                citations: mappedCitations,
                reactLoop: updatedLoop,
                isStreaming: false,
              };
            }),
          };
        })
      );

      // 7. Non-blocking Background Cloud Persistence (Supabase messages + telemetry)
      persistTurnInBackground({
        sessionId: activeSession.id,
        userMessage: {
          id: userMsg.id,
          content: q,
          taggedBooks: selectedBooks,
        },
        assistantMessage: {
          id: assistantMsgId,
          content: paragraphs,
          citations: mappedCitations,
          booksReferenced: apiResult.books_referenced,
        },
        telemetry: {
          executionId: apiResult.execution_id,
          effortTier: thinkingMode ? "high" : "low",
          latencyMs: apiResult.total_latency_ms,
          planThought: apiResult.plan_thought,
          toolCallsCount: apiResult.total_tool_calls,
        },
      });

      if (isFirst) {
        updateCloudSessionTitle(activeSession.id, updatedTitle);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reach Libria AI backend");
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSession.id) return s;
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return {
                ...m,
                content: [
                  "⚠️ Unable to reach the Libria backend service. Please verify that the FastAPI backend server is running on http://127.0.0.1:8000.",
                ],
                isStreaming: false,
              };
            }),
          };
        })
      );
    } finally {
      setIsStreaming(false);
    }
  };



  return (
    <AppShell fullHeight>
      <div className="flex flex-col h-full w-full bg-background overflow-hidden select-text relative">
        {/* Header Bar */}
        <header className="shrink-0 flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 bg-background/90 backdrop-blur z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-sm bg-accent-soft text-accent border border-accent/20 shrink-0">
              <Sparkles size={15} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="font-sans text-xs sm:text-sm font-semibold text-foreground truncate">
                  Libria Agent
                </h2>
                <span
                  className={cn(
                    "text-3xs sm:text-2xs px-1.5 sm:px-2 py-0.5 rounded-full border font-mono font-medium truncate max-w-[80px] sm:max-w-none",
                    activePersona.badgeColor
                  )}
                >
                  {activePersona.name}
                </span>
              </div>
              <p className="text-3xs sm:text-2xs text-muted-foreground truncate">
                {activeSession?.title || "New Conversation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* New Chat Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNewChat}
              className="gap-1 px-2 sm:px-2.5 text-xs shadow-2xs h-8"
              aria-label="New Chat"
            >
              <Plus size={13} strokeWidth={2} />
              <span className="hidden sm:inline">New Chat</span>
            </Button>

            {/* Conversation History Modal Trigger */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1 px-2 sm:px-2.5 text-xs shadow-2xs h-8"
              aria-label="History"
            >
              <History size={13} strokeWidth={1.75} />
              <span className="hidden sm:inline">History</span>
              {sessions.length > 0 && (
                <span className="ml-0.5 rounded-full bg-surface px-1.5 py-0.2 text-3xs font-mono text-muted-foreground border border-border-subtle">
                  {sessions.length}
                </span>
              )}
            </Button>

            {/* Personal Context Status Pill */}
            {settings.personalContext.enabled ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title={`Personal context active: "${settings.personalContext.currentFocus}"`}
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <User size={11} />
                <span>Personal Context Active</span>
              </button>
            ) : null}

            {/* Notes Status Pill */}
            {settings.accessNotes ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Reading notes & highlights access enabled"
                className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookOpen size={11} className="text-accent" />
                <span>Notes Enabled</span>
              </button>
            ) : null}

            {/* Configure Agent Trigger */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="gap-1 px-2 sm:px-2.5 text-xs shadow-2xs h-8"
              aria-label="Settings"
            >
              <SlidersHorizontal size={13} strokeWidth={1.75} />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </header>

        {/* Scrollable Conversation Canvas */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2.5 sm:px-6 md:px-12 lg:px-20 py-2.5 sm:py-6 space-y-4 sm:space-y-8 min-w-0"
        >
            {messages.length === 0 ? (
              /* CLEAN EMPTY STATE HERO (MATCHING ASK PANEL) */
              <div className="flex flex-col items-center justify-center my-auto py-10 sm:py-20 px-3 sm:px-4 text-center space-y-2.5 sm:space-y-3 animate-in fade-in duration-300 select-none">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent border border-accent/20 shadow-xs mb-1">
                  <Sparkles size={22} strokeWidth={1.75} />
                </div>
                <h2 className="font-serif text-2xl font-medium text-foreground tracking-tight">
                  Ask Your Library
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                  Extract core principles, synthesize ideas across books, or turn insights into actionable habits.
                </p>
              </div>
            ) : (
              /* MESSAGE FEED WITH ENHANCED READABILITY & COLLAPSIBLE CONTROLS */
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg) => (
                  <ChatMessageItem key={msg.id} msg={msg} books={books} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollBottom && (
            <button
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-36 lg:bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full border border-border bg-background/95 backdrop-blur-sm px-3 py-1 text-2xs text-muted-foreground shadow-md hover:text-foreground transition-all active:scale-95"
            >
              <ArrowDown size={12} />
              <span>Latest</span>
            </button>
          )}

          {/* BOTTOM CHATGPT-STYLE COMPOSER */}
          <div className="shrink-0 bg-background/95 backdrop-blur-xs w-full z-10 mb-[56px] lg:mb-0">
            <div className="max-w-3xl mx-auto p-2 sm:p-4 relative">
              {/* Tag Picker Popover */}
              <TagPickerPopover
                open={tagPickerOpen}
              mode={tagPickerMode}
              onClose={() => setTagPickerOpen(false)}
              books={books}
              selectedBooks={selectedBooks}
              onToggleBook={(id) => {
                setSelectedBooks((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                );
              }}
              selectedCategories={selectedCategories}
              onToggleCategory={(cat) => {
                setSelectedCategories((prev) =>
                  prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
                );
              }}
            />

            {/* Active Tag Chips (Selected Books & Categories) */}
            {(selectedBooks.length > 0 || selectedCategories.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2">
                {selectedBooks.map((bid) => {
                  const b = books.find((x) => x.id === bid);
                  return (
                    <span
                      key={bid}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-foreground font-mono"
                    >
                      <BookOpen size={10} className="text-accent" />
                      <span className="max-w-[140px] truncate">{b?.title || bid}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedBooks((p) => p.filter((x) => x !== bid))}
                        className="hover:text-destructive shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}

                {selectedCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-reading px-2 py-0.5 text-2xs text-foreground font-mono capitalize"
                  >
                    <Hash size={10} className="text-accent" />
                    <span>{cat.replace(/_/g, " ")}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories((p) => p.filter((x) => x !== cat))}
                      className="hover:text-destructive shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBooks([]);
                    setSelectedCategories([]);
                  }}
                  className="text-2xs text-faint hover:text-foreground transition-colors ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Main Input Box */}
            <div className="rounded-lg border border-border bg-surface/50 p-2.5 shadow-xs focus-within:border-accent focus-within:bg-surface transition-all space-y-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder={
                  selectedBooks.length > 0
                    ? `Ask about ${selectedBooks.length} tagged book(s)...`
                    : `Ask Libria anything across your library and personal context...`
                }
                className="w-full bg-transparent text-sm sm:text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed min-h-[26px]"
              />

              {/* Composer Toolbar */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Plus Icon Trigger & Tools Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setToolsMenuOpen((p) => !p)}
                      title="Agent features & tools"
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all cursor-pointer",
                        toolsMenuOpen
                          ? "border-accent bg-accent-soft text-accent shadow-xs"
                          : "border-border-subtle bg-surface/70 hover:bg-surface text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Plus
                        size={14}
                        className={cn("transition-transform duration-200", toolsMenuOpen && "rotate-45")}
                      />
                    </button>

                    {/* Tools Popover Menu */}
                    {toolsMenuOpen && (
                      <div
                        ref={toolsMenuRef}
                        className="absolute bottom-9 left-0 z-40 w-56 rounded-xl border border-border bg-surface/95 backdrop-blur-md p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 text-xs space-y-0.5 select-none"
                      >
                        <div className="px-2.5 py-1 text-3xs font-semibold uppercase tracking-[0.08em] text-faint">
                          Agent Features
                        </div>

                        {/* Tag Books Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setToolsMenuOpen(false);
                            setTagPickerMode("books");
                            setTagPickerOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-accent-soft/40 transition-colors text-left text-foreground cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-accent shrink-0" />
                            <span className="text-xs font-medium">Tag Books</span>
                          </div>
                          {selectedBooks.length > 0 && (
                            <span className="text-3xs font-mono px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
                              {selectedBooks.length}
                            </span>
                          )}
                        </button>

                        {/* Filter Category Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setToolsMenuOpen(false);
                            setTagPickerMode("categories");
                            setTagPickerOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-accent-soft/40 transition-colors text-left text-foreground cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-accent shrink-0" />
                            <span className="text-xs font-medium">Filter Category</span>
                          </div>
                          {selectedCategories.length > 0 && (
                            <span className="text-3xs font-mono px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
                              {selectedCategories.length}
                            </span>
                          )}
                        </button>

                        <div className="my-1 border-t border-border-subtle" />

                        {/* Thinking Mode Option */}
                        <button
                          type="button"
                          onClick={() => setThinkingMode((p) => !p)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer",
                            thinkingMode
                              ? "bg-accent-soft/60 text-accent font-medium"
                              : "hover:bg-accent-soft/20 text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Brain size={14} className={thinkingMode ? "text-accent" : "text-muted-foreground"} />
                            <span className="text-xs font-medium">Deep Thinking</span>
                          </div>
                          <span
                            className={cn(
                              "text-3xs font-mono px-1.5 py-0.5 rounded-full",
                              thinkingMode
                                ? "bg-accent text-accent-foreground font-semibold"
                                : "text-faint"
                            )}
                          >
                            {thinkingMode ? "On" : "Off"}
                          </span>
                        </button>

                        {/* Web Search Option */}
                        <button
                          type="button"
                          onClick={() => setWebSearch((p) => !p)}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer",
                            webSearch
                              ? "bg-accent-soft/60 text-accent font-medium"
                              : "hover:bg-accent-soft/20 text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Globe size={14} className={webSearch ? "text-accent" : "text-muted-foreground"} />
                            <span className="text-xs font-medium">Web Search</span>
                          </div>
                          <span
                            className={cn(
                              "text-3xs font-mono px-1.5 py-0.5 rounded-full",
                              webSearch
                                ? "bg-accent text-accent-foreground font-semibold"
                                : "text-faint"
                            )}
                          >
                            {webSearch ? "On" : "Off"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active Feature Pills (Only shown when active) */}
                  {thinkingMode && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/50 px-2 py-0.5 text-3xs font-mono text-accent animate-in fade-in duration-150">
                      <Brain size={10} />
                      <span>Thinking</span>
                      <button
                        type="button"
                        onClick={() => setThinkingMode(false)}
                        className="text-accent/70 hover:text-accent ml-0.5 cursor-pointer"
                        title="Disable thinking"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )}

                  {webSearch && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/50 px-2 py-0.5 text-3xs font-mono text-accent animate-in fade-in duration-150">
                      <Globe size={10} />
                      <span>Web</span>
                      <button
                        type="button"
                        onClick={() => setWebSearch(false)}
                        className="text-accent/70 hover:text-accent ml-0.5 cursor-pointer"
                        title="Disable web search"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </div>

                {/* Send / Stop Action */}
                {isStreaming ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleStop}
                    className="h-7 w-7 rounded-full p-0 flex items-center justify-center text-destructive"
                  >
                    <Square size={12} fill="currentColor" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!inputQuery.trim()}
                    onClick={() => void handleSendMessage()}
                    className="h-7 w-7 rounded-full p-0 flex items-center justify-center shadow-2xs"
                  >
                    <Send size={12} />
                  </Button>
                )}
              </div>
            </div>
            <p className="hidden sm:block text-center text-3xs text-faint pt-2">
              Libria Agent synthesizes literature and personal context. Verify core author citations when applying advice.
            </p>
            </div>
          </div>
        </div>

      {/* AGENT SETTINGS MODAL */}
      <AgentSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* CHAT HISTORY MODAL */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-5 bg-background border border-border sm:rounded-lg shadow-dialog">
          <DialogHeader className="pb-3 border-b border-border-subtle shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-accent" />
                <DialogTitle className="text-base font-serif font-medium text-foreground">
                  Previous Conversations
                </DialogTitle>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  handleNewChat();
                  setHistoryOpen(false);
                }}
                className="gap-1.5 text-xs shadow-2xs"
              >
                <Plus size={13} strokeWidth={2} />
                <span>New Chat</span>
              </Button>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Select any past discussion to continue or review recommendations.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2 space-y-1.5 max-h-[55vh]">
            {sessions.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">
                No previous conversations yet
              </p>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                const p = AGENT_PERSONAS[s.persona || "coach"];
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      handleSelectSession(s.id);
                      setHistoryOpen(false);
                    }}
                    className={cn(
                      "group flex items-center justify-between gap-3 p-3 rounded-sm border transition-all cursor-pointer select-none",
                      isActive
                        ? "border-accent bg-accent-soft/30 text-foreground font-medium ring-1 ring-accent/30"
                        : "border-border-subtle bg-surface/30 hover:border-accent/40 hover:bg-surface text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{s.title}</p>
                      <div className="flex items-center gap-2 text-2xs text-faint font-mono mt-1">
                        <span className="capitalize">{p?.name.split(" ")[0]}</span>
                        <span>·</span>
                        <span>{s.messages.length} msgs</span>
                        <span>·</span>
                        <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 text-faint hover:text-destructive transition-opacity p-1.5 rounded-xs hover:bg-destructive/10"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

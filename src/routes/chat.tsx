import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { toast } from "sonner";
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

const SESSIONS_STORAGE_KEY = "libria_chat_sessions_v1";

function loadSavedSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Failed to save chat sessions", err);
  }
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

  // Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = loadSavedSessions();
    if (saved.length > 0) return saved;
    const initialSession: ChatSession = {
      id: nanoid(),
      title: "Self-Development & Habit Architecture",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      persona: settings.persona,
    };
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || "");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Active Session helper
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId]
  );

  const messages = activeSession?.messages || [];

  // Save sessions to localStorage on changes
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
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
  const [thinkingMode, setThinkingMode] = useState(settings.deepThinkingDefault);
  const [webSearch, setWebSearch] = useState(settings.webSearchDefault);

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
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: nanoid(),
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      persona: settings.persona,
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setSelectedBooks([]);
    setSelectedCategories([]);
    toast.success("Started a new conversation");
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh: ChatSession = {
          id: nanoid(),
          title: "New Conversation",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
          persona: settings.persona,
        };
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

    // 1. Append User Message
    const userMsg: ChatMessage = {
      id: nanoid(),
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

    const assistantMsgId = nanoid();

    // Map tagged book titles for prompt synthesis
    const taggedBookTitles = selectedBooks
      .map((id) => books.find((b) => b.id === id)?.title)
      .filter(Boolean) as string[];

    const personalContextUsed = settings.personalContext.enabled;
    const notesAccessed = settings.accessNotes;

    // 2. Initialize ReAct Loop
    const initialLoop: ReActIteration[] = [
      {
        id: "react-iter-1",
        iteration: 1,
        thought: `Synthesizing inquiry under ${activePersona.name} persona: "${q}". ${
          taggedBookTitles.length > 0
            ? `Restricting retrieval to tagged books: ${taggedBookTitles.join(", ")}.`
            : "Searching across full library."
        } ${
          personalContextUsed
            ? `Aligning with user's current focus ("${settings.personalContext.currentFocus}") and addressing known bottlenecks ("${settings.personalContext.bottlenecks}").`
            : ""
        }`,
        action: {
          tool: "search_library_vectors",
          args: {
            query: q,
            books: taggedBookTitles,
            categories: selectedCategories,
            top_k: 4,
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

    // Simulate Agent Step 1: Observation
    await sleep(650);
    if (abortControllerRef.current) return;

    const observedPassages = [
      `Found 3 foundational passages from ${taggedBookTitles[0] || "Atomic Habits & Deep Work"}:`,
      `• Core law: "Reduce cognitive friction in the first 120 seconds of starting."`,
      `• Cal Newport's principle: "Deep work demands strict boundaries around high-frequency context shifts."`,
    ];

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== assistantMsgId) return m;
            const updatedLoop = [...(m.reactLoop || [])];
            updatedLoop[0] = {
              ...updatedLoop[0]!,
              observation: observedPassages.join("\n"),
              status: "complete",
            };
            return { ...m, reactLoop: updatedLoop };
          }),
        };
      })
    );

    // Simulate Agent Step 2 (Optional Notes query if enabled)
    if (notesAccessed) {
      await sleep(500);
      if (abortControllerRef.current) return;

      const noteLoop: ReActIteration = {
        id: "react-iter-2",
        iteration: 2,
        thought: `Querying user's personal margin notes & highlights to cross-reference with author principles...`,
        action: {
          tool: "query_user_notes",
          args: { query: q, userContext: settings.personalContext.currentFocus },
        },
        observation: `Retrieved user note from Chapter 3: "Struggle most when attempting deep writing without a pre-written outline."`,
        status: "complete",
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSession.id) return s;
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id !== assistantMsgId) return m;
              return { ...m, reactLoop: [...(m.reactLoop || []), noteLoop] };
            }),
          };
        })
      );
    }

    // Step 3: Stream Final Answer Content
    await sleep(550);
    if (abortControllerRef.current) return;

    let paragraph1 = "";
    let paragraph2 = "";
    let takeaways: string[] = [];
    let actionProtocol: string[] = [];

    if (settings.persona === "coach") {
      paragraph1 = `To solve this directly, we must cut through friction and structure your environment so starting requires almost zero willpower. According to James Clear in *Atomic Habits*, human behavior follows the Path of Least Resistance—if cognitive friction is high, procrastination is the inevitable default response.`;
      paragraph2 = personalContextUsed
        ? `Since your focus is ${settings.personalContext.currentFocus}, and you face ${settings.personalContext.bottlenecks}, we need to decouple planning from execution. Do not sit down to write and decide *what* to write simultaneously.`
        : `By anchoring this behavior to an existing trigger in your daily schedule, you remove the daily negotiation with yourself.`;
      takeaways = [
        "Pre-commit the first 2 minutes of the task the evening prior.",
        "Remove all secondary browser tabs before beginning the work block.",
        "Establish an unequivocal finish threshold for each session.",
      ];
      actionProtocol = [
        "Step 1: Set out a single physical notebook with one active task before going to bed.",
        "Step 2: When the morning focus block starts, execute without opening email or messaging.",
        "Step 3: Track completion on a visual calendar to build momentum.",
      ];
    } else if (settings.persona === "mentor") {
      paragraph1 = `When we look deeper into this challenge, the friction is rarely about a lack of discipline; it is almost always about unacknowledged cognitive ambiguity. As Marcus Aurelius observed, "The impediment to action advances action. What stands in the way becomes the way."`;
      paragraph2 = `Ask yourself: What is the emotional resistance attached to starting this particular project? Once you identify whether the friction is fear of imperfection or ambiguity of direction, the path forward clarifies naturally.`;
      takeaways = [
        "Examine the underlying belief causing hesitation.",
        "Separate your identity from the outcome of the initial draft.",
        "Clarity of intent dissolves resistance faster than raw willpower.",
      ];
    } else {
      // scholar
      paragraph1 = `A rigorous comparative analysis reveals a fascinating convergence between Cal Newport's attention-restoration model in *Deep Work* and James Clear's behavioral cue theory. Newport argues that attention operates like a finite cognitive muscle that incurs switching costs with every distraction.`;
      paragraph2 = `Conversely, modern behavioral psychology demonstrates that habits are identity-reinforcing loops. Therefore, the optimal synthesis is not merely scheduling time blocks, but actively cultivating an identity that rejects low-value interruptions.`;
      takeaways = [
        "Attention switching residue degrades executive cognitive function by up to 40%.",
        "Environmental architecture dictates baseline cognitive expenditure.",
        "Identity-aligned behavioral cues generate superior long-term adherence.",
      ];
    }

    const citations: Citation[] = [
      {
        bookId: "atomic_habits_by_james_clear.pdf",
        chapter: "The 3rd Law: Make It Easy",
        page: 152,
        passage:
          "Standardize before you optimize. You cannot improve a habit that doesn't exist. Focus on the two-minute rule.",
        relevance: "Primary behavioral law addressing task initiation and cognitive resistance.",
      },
      {
        bookId: "deep_work_by_cal_newport.pdf",
        chapter: "Rule #1: Work Deeply",
        page: 98,
        passage:
          "To produce at your peak level you need to work for extended periods with full concentration on a single task free from distraction.",
        relevance: "Defines attention boundaries and elimination of shallow friction.",
      },
    ];

    // Stream the paragraphs progressively
    const streamContent = [paragraph1, paragraph2];

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              content: streamContent,
              takeaways,
              actionProtocol: actionProtocol.length > 0 ? actionProtocol : undefined,
              citations,
              isStreaming: false,
            };
          }),
        };
      })
    );

    setIsStreaming(false);
  };

  // Quick Starter Prompts
  const starterPrompts = [
    {
      title: "14-Day Deep Work Protocol",
      prompt: "Design a 14-day progressive protocol to build 3 hours of uninterrupted daily deep work.",
      badge: "Deep Work",
    },
    {
      title: "Overcoming Afternoon Procrastination",
      prompt: "How can I systematically overcome afternoon fatigue and avoid distracted browsing?",
      badge: "Habits",
    },
    {
      title: "Presence in High-Stakes Conversations",
      prompt: "What are the core techniques from The Charisma Myth to project warmth and authority simultaneously?",
      badge: "Psychology",
    },
    {
      title: "Synthesize Stoic & Modern Self-Regulation",
      prompt: "Compare Stoic emotional regulation with modern cognitive behavioral techniques from the library.",
      badge: "Philosophy",
    },
  ];

  return (
    <AppShell fullHeight>
      <div className="flex flex-col h-full w-full bg-background overflow-hidden select-text relative">
        {/* Header Bar */}
        <header className="shrink-0 flex items-center justify-between border-b border-border-subtle px-3 py-2.5 sm:px-4 sm:py-3 bg-background/90 backdrop-blur z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-sm bg-accent-soft text-accent border border-accent/20 shrink-0">
              <Sparkles size={15} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="font-serif text-xs sm:text-sm font-medium text-foreground truncate">
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
          className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-12 lg:px-20 py-4 sm:py-6 space-y-6 sm:space-y-8 min-w-0"
        >
            {messages.length === 0 ? (
              /* EMPTY STATE HERO */
              <div className="max-w-2xl mx-auto my-auto py-8 text-center space-y-8 animate-in fade-in duration-300">
                <div className="space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-accent-soft text-accent border border-accent/20 shadow-xs">
                    <Sparkles size={24} strokeWidth={1.75} />
                  </div>
                  <h1 className="font-serif text-2xl font-medium text-foreground tracking-tight">
                    How can Libria guide your personal growth?
                  </h1>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Operating as your <span className="font-medium text-foreground">{activePersona.name}</span>, grounded in your library of {books.length} books and your personal context.
                  </p>
                </div>

                {/* Personal Context Banner */}
                {settings.personalContext.enabled && (
                  <div
                    onClick={() => setSettingsOpen(true)}
                    className="flex items-center justify-between gap-3 p-3 rounded-sm border border-accent/30 bg-accent-soft/20 text-left cursor-pointer hover:border-accent transition-all max-w-lg mx-auto shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <User size={15} className="text-accent shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-accent">
                          Active Personal Focus
                        </p>
                        <p className="text-xs text-foreground line-clamp-2">
                          “{settings.personalContext.currentFocus}”
                        </p>
                      </div>
                    </div>
                    <SlidersHorizontal size={13} className="text-accent shrink-0" />
                  </div>
                )}

                {/* Starter Prompts Grid */}
                <div className="grid sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                  {starterPrompts.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="group p-3.5 rounded-sm border border-border bg-surface/40 hover:border-accent hover:bg-surface hover:shadow-xs transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-xs font-medium text-foreground group-hover:text-accent transition-colors">
                            {item.title}
                          </span>
                          <span className="text-2xs font-mono text-faint px-1.5 py-0.5 rounded-xs bg-surface border border-border-subtle">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-2xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.prompt}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* MESSAGE FEED */
              <div className="max-w-3xl mx-auto space-y-8">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-4 animate-in fade-in duration-200">
                    {msg.role === "user" ? (
                      /* USER MESSAGE */
                      <div className="flex items-start justify-end gap-3">
                        <div className="max-w-[85%] sm:max-w-[75%] space-y-1.5 text-right">
                          <div className="inline-block rounded-lg bg-surface border border-border px-4 py-2.5 text-xs text-foreground shadow-2xs leading-relaxed text-left">
                            {/* Attached Page Photo Badge */}
                            {msg.attachedPage ? (
                              <div className="mb-2 flex items-center gap-2 rounded-xs border border-accent/30 bg-background/80 p-1.5 text-2xs text-muted-foreground">
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
                                    <p className="truncate text-3xs text-faint max-w-[160px]">{msg.attachedPage.bookTitle}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {/* Attached Excerpt Badge */}
                            {msg.contextPassage ? (
                              <div className="mb-2 flex items-start gap-1.5 rounded-xs border-l-2 border-accent bg-background/80 px-2 py-1 text-2xs text-muted-foreground">
                                <Quote size={11} className="shrink-0 text-accent mt-0.5" />
                                <p className="line-clamp-2 italic font-serif">“{msg.contextPassage}”</p>
                              </div>
                            ) : null}

                            {typeof msg.content === "string" ? msg.content : msg.content.join("\n\n")}
                          </div>

                          {/* Tag badges */}
                          {((msg.taggedBooks && msg.taggedBooks.length > 0) ||
                            (msg.taggedCategories && msg.taggedCategories.length > 0)) && (
                            <div className="flex flex-wrap items-center justify-end gap-1.5 text-2xs font-mono text-muted-foreground">
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

                          <span className="block text-2xs text-faint font-mono">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ASSISTANT MESSAGE */
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent border border-accent/20 mt-0.5">
                          <Sparkles size={14} strokeWidth={2} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-4">
                          {/* Assistant Header Metadata */}
                          <div className="flex items-center gap-2 text-2xs text-muted-foreground font-mono">
                            <span className="font-medium text-foreground">Libria</span>
                            <span>·</span>
                            <span className="capitalize">{msg.persona || "Coach"}</span>
                            {msg.personalContextUsed && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <User size={10} />
                                  Context Grounded
                                </span>
                              </>
                            )}
                            {msg.notesAccessed && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-accent">
                                  <BookOpen size={10} />
                                  Notes Cited
                                </span>
                              </>
                            )}
                            <span className="ml-auto text-faint">{msg.timestamp}</span>
                          </div>

                          {/* REAT CHAIN OF THOUGHT (Pure Transparent Stream) */}
                          {msg.reactLoop && msg.reactLoop.length > 0 && (
                            <div className="space-y-2 border-l-2 border-accent/40 pl-3 py-1 my-2">
                              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-accent flex items-center gap-1.5">
                                <Brain size={12} />
                                <span>Thought Trace & Retrieval</span>
                              </p>

                              {msg.reactLoop.map((step) => (
                                <div key={step.id} className="space-y-1.5 text-xs text-muted-foreground">
                                  <p className="italic text-foreground/80 leading-relaxed font-serif">
                                    "{step.thought}"
                                  </p>

                                  {step.action && (
                                    <div className="flex items-center gap-1.5 text-2xs font-mono text-accent">
                                      <Zap size={11} />
                                      <span>Invoked tool: {step.action.tool}()</span>
                                    </div>
                                  )}

                                  {step.observation && (
                                    <div className="text-2xs text-muted-foreground bg-surface/50 border border-border-subtle p-2 rounded-xs whitespace-pre-line font-mono">
                                      {step.observation}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* MAIN PROSE CONTENT */}
                          <div className="space-y-3 font-serif text-sm leading-relaxed text-foreground">
                            {Array.isArray(msg.content) ? (
                              msg.content.map((p, idx) => <p key={idx}>{p}</p>)
                            ) : (
                              <p>{msg.content}</p>
                            )}
                          </div>

                          {/* ACTION PROTOCOL (If Coach mode) */}
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
                                    className="flex items-start gap-2 text-xs text-foreground bg-surface/40 p-2 rounded-xs border border-border-subtle"
                                  >
                                    <CheckCircle2 size={13} className="text-accent shrink-0 mt-0.5" />
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* KEY TAKEAWAYS */}
                          {msg.takeaways && msg.takeaways.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
                                Key Takeaways
                              </p>
                              <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                                {msg.takeaways.map((t, idx) => (
                                  <li key={idx} className="leading-relaxed">
                                    {t}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* GROUNDED CITATIONS */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="space-y-2 pt-3 border-t border-border-subtle">
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
                                      className="p-2.5 rounded-xs border border-border bg-surface/30 space-y-1 text-2xs"
                                    >
                                      <div className="flex items-center justify-between font-mono text-foreground font-medium">
                                        <span>{b?.title || c.bookId}</span>
                                        <span className="text-faint">{c.chapter}</span>
                                      </div>
                                      <p className="font-serif italic text-muted-foreground">
                                        “{c.passage}”
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Message Actions */}
                          <div className="flex items-center gap-2 pt-2 text-faint">
                            <button
                              type="button"
                              onClick={() => {
                                const text = Array.isArray(msg.content) ? msg.content.join("\n\n") : msg.content;
                                void navigator.clipboard?.writeText(text);
                                toast.success("Copied answer to clipboard");
                              }}
                              className="inline-flex items-center gap-1 text-2xs hover:text-foreground transition-colors p-1"
                            >
                              <Copy size={12} />
                              <span>Copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toast.success("Saved advice to your reading notes")}
                              className="inline-flex items-center gap-1 text-2xs hover:text-foreground transition-colors p-1"
                            >
                              <Bookmark size={12} />
                              <span>Save to Notes</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
          <div className="shrink-0 bg-background/95 backdrop-blur-xs w-full z-10 mb-[56px] lg:mb-0 border-t border-border-subtle lg:border-t-0">
            <div className="max-w-3xl mx-auto p-2.5 sm:p-4 relative">
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
                  {/* Tag Book Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setTagPickerMode("books");
                      setTagPickerOpen((p) => !p);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-2xs transition-colors",
                      selectedBooks.length > 0
                        ? "border-accent bg-accent-soft text-accent font-medium"
                        : "border-border-subtle bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <BookOpen size={11} />
                    <span>@ Book</span>
                  </button>

                  {/* Tag Category Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setTagPickerMode("categories");
                      setTagPickerOpen((p) => !p);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-2xs transition-colors",
                      selectedCategories.length > 0
                        ? "border-accent bg-accent-soft text-accent font-medium"
                        : "border-border-subtle bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Hash size={11} />
                    <span># Category</span>
                  </button>

                  {/* Thinking Toggle */}
                  <button
                    type="button"
                    onClick={() => setThinkingMode((p) => !p)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-2xs transition-colors",
                      thinkingMode
                        ? "border-accent bg-accent-soft text-accent font-medium"
                        : "border-border-subtle bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Brain size={11} />
                    <span>Thinking</span>
                  </button>

                  {/* Web Search Toggle */}
                  <button
                    type="button"
                    onClick={() => setWebSearch((p) => !p)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-2xs transition-colors",
                      webSearch
                        ? "border-accent bg-accent-soft text-accent font-medium"
                        : "border-border-subtle bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Globe size={11} />
                    <span>Web</span>
                  </button>
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
            <p className="text-center text-3xs text-faint pt-2">
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
                      setActiveSessionId(s.id);
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

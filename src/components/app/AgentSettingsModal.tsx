import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AGENT_PERSONAS,
  type AgentPersonaId,
  useAgentSettings,
} from "@/lib/agent-settings";
import { Button } from "./primitives";
import {
  Sparkles,
  User,
  BookOpen,
  Brain,
  Globe,
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentSettingsModal({ open, onOpenChange }: AgentSettingsModalProps) {
  const {
    settings,
    setPersona,
    updatePersonalContext,
    toggleNotesAccess,
    togglePersonalContextEnabled,
    updateSettings,
  } = useAgentSettings();

  const [activeTab, setActiveTab] = useState<"persona" | "context" | "capabilities">("persona");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 bg-background border border-border sm:rounded-lg shadow-dialog">
        <DialogHeader className="pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent-soft text-accent border border-accent/20">
              <Sparkles size={18} strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-lg font-serif font-medium text-foreground">
                Libria Agent Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Customize your AI mentor persona, personal context memory, and retrieval permissions.
              </DialogDescription>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => setActiveTab("persona")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === "persona"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:bg-hover hover:text-foreground"
              )}
            >
              <Zap size={13} />
              <span>Agent Persona</span>
            </button>
            <button
              onClick={() => setActiveTab("context")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === "context"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:bg-hover hover:text-foreground"
              )}
            >
              <User size={13} />
              <span>Personal Context</span>
            </button>
            <button
              onClick={() => setActiveTab("capabilities")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all",
                activeTab === "capabilities"
                  ? "bg-accent text-accent-foreground shadow-xs"
                  : "bg-surface text-muted-foreground hover:bg-hover hover:text-foreground"
              )}
            >
              <BookOpen size={13} />
              <span>Notes & Knowledge</span>
            </button>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-5">
          {/* TAB 1: PERSONA SELECTION */}
          {activeTab === "persona" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-muted-foreground">
                Choose the primary cognitive style Libria uses when synthesizing advice and responding to your questions:
              </p>

              <div className="grid gap-3">
                {(Object.keys(AGENT_PERSONAS) as AgentPersonaId[]).map((id) => {
                  const p = AGENT_PERSONAS[id];
                  const isSelected = settings.persona === id;

                  return (
                    <div
                      key={id}
                      onClick={() => setPersona(id)}
                      className={cn(
                        "group relative flex flex-col p-4 rounded-sm border transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-accent bg-accent-soft/30 shadow-xs ring-1 ring-accent/30"
                          : "border-border bg-surface/40 hover:border-accent/50 hover:bg-surface"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-sm font-medium text-foreground">
                              {p.name}
                            </span>
                            <span
                              className={cn(
                                "text-2xs px-2 py-0.5 rounded-full border font-mono font-medium",
                                p.badgeColor
                              )}
                            >
                              {p.subtitle}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                            {p.description}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                            isSelected
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border bg-background group-hover:border-accent/50"
                          )}
                        >
                          {isSelected && <Check size={12} strokeWidth={2.5} />}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center gap-2 text-2xs text-muted-foreground font-mono">
                        <span className="text-faint">Tone:</span>
                        <span>{p.tone}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL CONTEXT PROFILE */}
          {activeTab === "context" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-3 rounded-sm border border-border bg-surface/50">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground">
                    Enable Personal Context Memory
                  </span>
                  <p className="text-2xs text-muted-foreground">
                    When active, Libria customizes responses to address your specific goals and bottlenecks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePersonalContextEnabled}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    settings.personalContext.enabled ? "bg-accent" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.personalContext.enabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Current Primary Focus & Life Goals</span>
                    <span className="text-2xs text-muted-foreground font-mono">What you are building</span>
                  </label>
                  <textarea
                    rows={2}
                    value={settings.personalContext.currentFocus}
                    onChange={(e) => updatePersonalContext({ currentFocus: e.target.value })}
                    placeholder="e.g., Mastering deep work, establishing a 6:00 AM reading routine, preparing for team leadership..."
                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Known Bottlenecks & Procrastination Triggers</span>
                    <span className="text-2xs text-muted-foreground font-mono">Where friction happens</span>
                  </label>
                  <textarea
                    rows={2}
                    value={settings.personalContext.bottlenecks}
                    onChange={(e) => updatePersonalContext({ bottlenecks: e.target.value })}
                    placeholder="e.g., Afternoon cognitive fatigue, difficulty transitioning between deep tasks, smartphone habits..."
                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Daily Schedule & Existing Routines</span>
                    <span className="text-2xs text-muted-foreground font-mono">Time architecture</span>
                  </label>
                  <textarea
                    rows={2}
                    value={settings.personalContext.routine}
                    onChange={(e) => updatePersonalContext({ routine: e.target.value })}
                    placeholder="e.g., Morning focus window 8:30-11:30 AM, afternoon meetings, evening book reflection..."
                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-sm bg-accent-soft/20 border border-accent/20 text-2xs text-muted-foreground">
                <ShieldCheck size={14} className="text-accent shrink-0" />
                <span>Your personal context is securely saved in your browser and used only to ground RAG responses.</span>
              </div>
            </div>
          )}

          {/* TAB 3: KNOWLEDGE & CAPABILITIES */}
          {activeTab === "capabilities" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-3">
                {/* Personal Notes Access */}
                <div className="flex items-center justify-between p-3 rounded-sm border border-border bg-surface/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <BookOpen size={14} className="text-accent" />
                      Access Personal Notes & Highlights
                    </span>
                    <p className="text-2xs text-muted-foreground">
                      Allows Libria to retrieve your margin highlights and reflections alongside published book chapters.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleNotesAccess}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      settings.accessNotes ? "bg-accent" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        settings.accessNotes ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Deep Thinking Default */}
                <div className="flex items-center justify-between p-3 rounded-sm border border-border bg-surface/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Brain size={14} className="text-accent" />
                      Always Enable Deep Thinking (ReAct Trace)
                    </span>
                    <p className="text-2xs text-muted-foreground">
                      Displays internal chain-of-thought, tool calls, and observations before final answers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        deepThinkingDefault: !prev.deepThinkingDefault,
                      }))
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      settings.deepThinkingDefault ? "bg-accent" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        settings.deepThinkingDefault ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Web Search Default */}
                <div className="flex items-center justify-between p-3 rounded-sm border border-border bg-surface/50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Globe size={14} className="text-accent" />
                      Allow Web Search by Default
                    </span>
                    <p className="text-2xs text-muted-foreground">
                      Fetches external research articles, real-world studies, and current web citations when needed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings((prev) => ({
                        ...prev,
                        webSearchDefault: !prev.webSearchDefault,
                      }))
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      settings.webSearchDefault ? "bg-accent" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        settings.webSearchDefault ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
          <p className="text-2xs text-faint">Settings take effect immediately in your chats.</p>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

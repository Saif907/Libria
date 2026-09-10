import { useState, useEffect, useCallback } from "react";

export type AgentPersonaId = "coach" | "mentor" | "scholar";

export interface AgentPersona {
  id: AgentPersonaId;
  name: string;
  subtitle: string;
  description: string;
  tone: string;
  systemPromptModifier: string;
  badgeColor: string;
}

export const AGENT_PERSONAS: Record<AgentPersonaId, AgentPersona> = {
  coach: {
    id: "coach",
    name: "Action & Habit Coach",
    subtitle: "Tactical, direct, behavior-focused",
    description:
      "Focuses on practical implementation intentions, habit stacking, daily accountability, and breaking goals into immediate micro-steps.",
    tone: "Direct, motivating, and action-oriented",
    systemPromptModifier:
      "You are Libria's Action & Habit Coach. Cut unnecessary theory and focus directly on actionable steps, habit loops, environmental design, and immediate behavioral experiments.",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  mentor: {
    id: "mentor",
    name: "Socratic Mentor",
    subtitle: "Reflective, probing, wisdom-oriented",
    description:
      "Helps you discover answers through thoughtful diagnostic questions, uncovering root causes, and applying timeless philosophical frameworks.",
    tone: "Warm, empathetic, insightful, and thought-provoking",
    systemPromptModifier:
      "You are Libria's Socratic Mentor. Guide the user through clarifying questions, unpack deeper cognitive assumptions, and synthesize timeless wisdom from the books.",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  scholar: {
    id: "scholar",
    name: "Deep Scholar",
    subtitle: "Rigorous, comparative, analytical",
    description:
      "Analyzes theoretical nuances, contrasts differing author perspectives, and reconciles conflicting self-development models with intellectual rigor.",
    tone: "Intellectually precise, balanced, and evidence-grounded",
    systemPromptModifier:
      "You are Libria's Deep Scholar. Provide rigorous comparative synthesis across authors, highlight underlying psychological mechanisms, and address apparent contradictions.",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
};

export interface PersonalContextProfile {
  enabled: boolean;
  currentFocus: string;
  bottlenecks: string;
  routine: string;
  customNotes: string;
}

export interface AgentSettings {
  persona: AgentPersonaId;
  personalContext: PersonalContextProfile;
  accessNotes: boolean;
  deepThinkingDefault: boolean;
  webSearchDefault: boolean;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  persona: "coach",
  personalContext: {
    enabled: true,
    currentFocus: "Mastering deep work and establishing consistent daily writing & reading habits",
    bottlenecks: "Afternoon energy slumps, occasional context switching between browser tabs, and phone distractions",
    routine: "Morning deep work block (8:00 AM - 11:30 AM), evening book reflection & journaling",
    customNotes: "Focusing on sustainable incremental progress rather than all-or-nothing extremes.",
  },
  accessNotes: true,
  deepThinkingDefault: true,
  webSearchDefault: false,
};

const STORAGE_KEY = "libria_agent_settings_v1";

export function loadAgentSettings(): AgentSettings {
  if (typeof window === "undefined") return DEFAULT_AGENT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AGENT_SETTINGS,
      ...parsed,
      personalContext: {
        ...DEFAULT_AGENT_SETTINGS.personalContext,
        ...(parsed.personalContext || {}),
      },
    };
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save Libria agent settings", err);
  }
}

export function useAgentSettings() {
  const [settings, setSettingsState] = useState<AgentSettings>(() => loadAgentSettings());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSettingsState(loadAgentSettings());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateSettings = useCallback((updater: (prev: AgentSettings) => AgentSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      saveAgentSettings(next);
      return next;
    });
  }, []);

  const setPersona = useCallback((persona: AgentPersonaId) => {
    updateSettings((prev) => ({ ...prev, persona }));
  }, [updateSettings]);

  const updatePersonalContext = useCallback(
    (contextUpdate: Partial<PersonalContextProfile>) => {
      updateSettings((prev) => ({
        ...prev,
        personalContext: {
          ...prev.personalContext,
          ...contextUpdate,
        },
      }));
    },
    [updateSettings]
  );

  const toggleNotesAccess = useCallback(() => {
    updateSettings((prev) => ({ ...prev, accessNotes: !prev.accessNotes }));
  }, [updateSettings]);

  const togglePersonalContextEnabled = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      personalContext: {
        ...prev.personalContext,
        enabled: !prev.personalContext.enabled,
      },
    }));
  }, [updateSettings]);

  return {
    settings,
    activePersona: AGENT_PERSONAS[settings.persona],
    updateSettings,
    setPersona,
    updatePersonalContext,
    toggleNotesAccess,
    togglePersonalContextEnabled,
  };
}

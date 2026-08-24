import { useState } from "react";
import { X, CornerDownLeft } from "lucide-react";
import {
  answerFor,
  suggestions,
  type Answer,
  type Scope,
} from "@/lib/ask-data";
import { recentQuestions } from "@/lib/library-data";
import { AnswerBlock, ContextPreview, ScopeSelector } from "./Evidence";
import { Button, IconButton } from "./primitives";

export function AskComposer({
  scope,
  onScope,
  onAsk,
  availableScopes,
}: {
  scope: Scope;
  onScope: (s: Scope) => void;
  onAsk: (q: string) => void;
  availableScopes?: Scope[] | undefined;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAsk(value.trim());
        setValue("");
      }}
      className="space-y-2.5"
    >
      <ScopeSelector scope={scope} onChange={onScope} available={availableScopes} />
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) {
                onAsk(value.trim());
                setValue("");
              }
            }
          }}
          rows={3}
          placeholder="Ask about what you're reading…"
          className="w-full resize-none rounded-sm border border-border bg-reading p-3 pr-11 text-sm leading-[1.55] text-foreground placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="absolute bottom-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-xs bg-accent text-accent-foreground disabled:opacity-40"
          disabled={!value.trim()}
        >
          <CornerDownLeft size={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

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
  answer: Answer | null;
  setAnswer: (a: Answer | null) => void;
  availableScopes?: Scope[] | undefined;
}) {
  const ask = (q: string) => setAnswer(answerFor(scope, q));

  return (
    <div className="space-y-5">
      <ContextPreview
        scope={scope}
        detail={contextDetail}
        passage={scope === "selection" ? contextPassage : undefined}
      />

      <AskComposer
        scope={scope}
        onScope={(s) => {
          setScope(s);
          setAnswer(null);
        }}
        onAsk={ask}
        availableScopes={availableScopes}
      />

      {answer ? (
        <div className="border-t border-border-subtle pt-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-lg leading-[1.4] text-foreground">
              {answer.question}
            </p>
            <IconButton label="Clear answer" onClick={() => setAnswer(null)}>
              <X size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
          <div className="mt-3">
            <AnswerBlock answer={answer} />
          </div>
          <div className="mt-6 flex gap-2">
            <Button size="sm">Save answer</Button>
            <Button size="sm" variant="tertiary">
              Turn into action
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-2xs font-medium uppercase tracking-[0.1em] text-faint">
              Suggested
            </p>
            <ul className="divide-y divide-border-subtle border-y border-border-subtle">
              {suggestions[scope].map((q) => (
                <li key={q}>
                  <button
                    onClick={() => ask(q)}
                    className="w-full py-2.5 text-left text-sm text-foreground transition-colors hover:text-accent"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-2xs font-medium uppercase tracking-[0.1em] text-faint">
              Recent
            </p>
            <ul className="space-y-1.5">
              {recentQuestions.slice(0, 3).map((q) => (
                <li key={q}>
                  <button
                    onClick={() => ask(q)}
                    className="text-left text-sm text-muted-foreground transition-colors hover:text-accent"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

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

  if (!open) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-border bg-background shadow-panel">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-medium text-foreground">Ask</span>
        <IconButton label="Close Ask panel" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
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

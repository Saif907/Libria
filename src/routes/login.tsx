import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Marginalia" },
      {
        name: "description",
        content:
          "Sign in to Marginalia to access your personal book library and grounded reading insights.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("Please fill in both fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            // After the user clicks the confirmation link, Supabase will
            // redirect them to /verify which handles the Steam-like flow.
            emailRedirectTo: `${window.location.origin}/verify`,
          },
        });
        if (signUpError) throw signUpError;

        setSuccess(
          "Check your email for a confirmation link. Once verified, come back here to sign in.",
        );
        setLoading(false);
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
        if (signInError) throw signInError;

        // Don't set loading to false — keep the spinner while the AuthGate
        // detects the new session and redirects to the home page.
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setLoading(false);
    }
  };

  const switchMode = () => {
    resetFeedback();
    setMode((m) => (m === "signin" ? "signup" : "signin"));
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---- Left branding panel (desktop only) ---- */}
      <div className="hidden flex-col justify-between border-r border-border-subtle bg-surface p-10 lg:flex lg:w-[420px] xl:w-[480px]">
        <div>
          <span className="font-serif text-xl font-semibold tracking-[-0.01em] text-foreground">
            Marginalia
          </span>
        </div>

        <div className="max-w-[320px]">
          <BookOpen
            size={32}
            strokeWidth={1.5}
            className="mb-4 text-accent"
          />
          <p className="font-serif text-2xl leading-[1.35] text-foreground">
            Your books, distilled into grounded wisdom.
          </p>
          <p className="mt-4 text-sm leading-[1.6] text-muted-foreground">
            Ask questions across your entire library and receive answers
            backed by real passages — never a generic summary.
          </p>
        </div>

        <p className="text-metadata">
          Insights you can trace back to the page.
        </p>
      </div>

      {/* ---- Right side — auth form ---- */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          {/* Mobile branding */}
          <div className="mb-10 lg:hidden">
            <span className="font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
              Marginalia
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to continue to your library."
              : "Start building your personal knowledge base."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                className="h-10 w-full rounded-sm border border-border bg-reading px-3 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="auth-password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="h-10 w-full rounded-sm border border-border bg-reading px-3 pr-10 text-sm text-foreground placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-faint transition-colors hover:text-muted-foreground"
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={1.75} />
                  ) : (
                    <Eye size={16} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Feedback messages */}
            {error && (
              <div className="rounded-sm border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-sm border border-accent/30 bg-accent-soft px-3 py-2.5 text-sm text-accent">
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-transparent text-sm font-medium transition-colors duration-150 ease-out",
                "bg-accent text-accent-foreground hover:bg-accent-dark",
                "disabled:pointer-events-none disabled:opacity-45",
              )}
            >
              {loading && (
                <Loader2 size={16} strokeWidth={2} className="animate-spin" />
              )}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* Toggle sign-in / sign-up */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="font-medium text-accent transition-colors hover:text-accent-dark"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>

          {/* Placeholder for future OAuth */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-2xs text-faint">
              MORE OPTIONS COMING SOON
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>
          <p className="mt-3 text-center text-xs text-faint">
            Google sign-in will be available in the next update.
          </p>
        </div>
      </div>
    </div>
  );
}

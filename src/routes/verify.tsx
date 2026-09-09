import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Email Verified — Marginalia" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

type Status = "processing" | "verified" | "error";

function VerifyPage() {
  const [status, setStatus] = useState<Status>("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function process() {
      try {
        // Brief pause so the Supabase client can process hash-based tokens
        // that arrive in the redirect URL from the confirmation email.
        await new Promise((r) => setTimeout(r, 400));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Sign out immediately — the user must sign in manually.
        // This mirrors the Steam / Discord pattern where email verification
        // confirms the address but does NOT create a logged-in session.
        if (session) {
          await supabase.auth.signOut();
        }

        setStatus("verified");
      } catch (err) {
        console.error("Verification error:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Verification failed.",
        );
        setStatus("error");
      }
    }

    process();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px] text-center">
        {/* Branding */}
        <span className="mb-10 block font-serif text-lg font-semibold tracking-[-0.01em] text-foreground">
          Marginalia
        </span>

        {/* Processing */}
        {status === "processing" && (
          <>
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Verifying your email…
            </p>
          </>
        )}

        {/* Verified */}
        {status === "verified" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
              <CheckCircle2
                size={28}
                strokeWidth={1.75}
                className="text-accent"
              />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.015em] text-foreground">
              Email verified
            </h1>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
              Your account is confirmed. Sign in to start building your
              personal library.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-sm border border-transparent bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-dark"
            >
              Sign in
            </Link>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.015em] text-foreground">
              Verification failed
            </h1>
            <p className="mt-2 text-sm leading-[1.6] text-muted-foreground">
              {errorMessage ?? "The verification link may have expired."}
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-sm border border-transparent bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-dark"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

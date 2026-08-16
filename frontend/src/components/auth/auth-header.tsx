import { Pizza } from "lucide-react";

type AuthMode = "login" | "register";

const AuthHeader = ({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) => {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white" aria-hidden="true"><Pizza size={23} /></span>
        <div>
          <p className="font-display text-2xl leading-none text-ink">PizzaStore</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand">Fresh pizza, fewer steps</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-control bg-surface-muted p-1" aria-label="Authentication options">
        <button type="button" onClick={() => onChange("login")} aria-pressed={mode === "login"} className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "login" ? "bg-surface text-ink shadow-subtle" : "text-ink-muted hover:text-ink"}`}>Sign in</button>
        <button type="button" onClick={() => onChange("register")} aria-pressed={mode === "register"} className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${mode === "register" ? "bg-surface text-ink shadow-subtle" : "text-ink-muted hover:text-ink"}`}>Create account</button>
      </div>
    </div>
  );
};

export default AuthHeader;

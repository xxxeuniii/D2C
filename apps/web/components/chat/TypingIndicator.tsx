"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 py-2 animate-fade-in">
      {/* Avatar */}
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-text-secondary">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
      </div>

      {/* Typing dots */}
      <div className="flex items-center gap-1 rounded-xl bg-bg-surface border border-border px-4 py-3">
        <div className="flex gap-1">
          <span
            className="h-2 w-2 rounded-full bg-text-tertiary animate-pulse-dot"
            style={{ animationDelay: "0s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-text-tertiary animate-pulse-dot"
            style={{ animationDelay: "0.2s" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-text-tertiary animate-pulse-dot"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    </div>
  );
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

// Mirrors @earendil-works/pi-agent-core's ThinkingLevel (not re-exported by the
// main package, so we redeclare the union locally).
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

const BLURB: Record<ThinkingLevel, string> = {
  off: "no extended thinking",
  minimal: "tiny budget",
  low: "light reasoning",
  medium: "balanced",
  high: "deep reasoning",
  xhigh: "maximum reasoning",
};

/** Resolve a user-typed token to a concrete level (prefix / fuzzy match). */
function resolve(token: string): ThinkingLevel | undefined {
  const t = token.trim().toLowerCase();
  if (!t) return undefined;
  if ((LEVELS as string[]).includes(t)) return t as ThinkingLevel;
  const pref = LEVELS.filter((l) => l.startsWith(t));
  if (pref.length === 1) return pref[0];
  // common shorthands
  const alias: Record<string, ThinkingLevel> = {
    none: "off",
    no: "off",
    min: "minimal",
    med: "medium",
    max: "xhigh",
    xh: "xhigh",
  };
  return alias[t];
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("thinking", {
    description:
      "Switch thinking effort (off/minimal/low/medium/high/xhigh). No arg = picker.",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const current = pi.getThinkingLevel();
      const items = LEVELS.map((l) => ({
        value: l,
        label: `${l}${l === current ? " (current)" : ""} — ${BLURB[l]}`,
      }));
      const filtered = items.filter((i) => i.value.startsWith(prefix.toLowerCase()));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args, ctx) => {
      const current = pi.getThinkingLevel();

      let target: ThinkingLevel | undefined;

      if (args && args.trim()) {
        target = resolve(args);
        if (!target) {
          ctx.ui.notify(
            `Unknown thinking level "${args.trim()}". Valid: ${LEVELS.join(", ")}`,
            "error",
          );
          return;
        }
      } else {
        // Interactive picker, current level marked.
        const labels = LEVELS.map(
          (l) => `${l === current ? "● " : "  "}${l} — ${BLURB[l]}`,
        );
        const choice = await ctx.ui.select("Thinking effort:", labels);
        if (!choice) return; // cancelled
        target = LEVELS[labels.indexOf(choice)];
      }

      if (target === current) {
        ctx.ui.notify(`Thinking effort already "${target}"`, "info");
        return;
      }

      pi.setThinkingLevel(target);
      const applied = pi.getThinkingLevel();

      if (applied !== target) {
        // Clamped by model capabilities (e.g. non-reasoning model -> off).
        ctx.ui.notify(
          `Requested "${target}" but model clamped to "${applied}"`,
          "warning",
        );
      } else {
        ctx.ui.notify(`Thinking effort → ${applied}`, "info");
      }
    },
  });
}

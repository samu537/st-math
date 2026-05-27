import { useEffect, useState } from "react";

export type CursorMode = "glow" | "minimal" | "crosshair" | "system";

export type ThemePreset = {
  id: string;
  label: string;
  primary: string; // oklch values without the oklch() wrapper
  ember: string;
  blood: string;
  ring: string;
  accent: string;
  border: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "red",
    label: "Blood Red",
    primary: "0.55 0.24 27",
    ember: "0.65 0.26 30",
    blood: "0.45 0.25 27",
    ring: "0.55 0.24 27",
    accent: "0.45 0.22 27",
    border: "0.3 0.08 27",
  },
  {
    id: "cyan",
    label: "Neon Cyan",
    primary: "0.7 0.18 200",
    ember: "0.78 0.18 195",
    blood: "0.55 0.18 205",
    ring: "0.7 0.18 200",
    accent: "0.55 0.16 200",
    border: "0.3 0.06 200",
  },
  {
    id: "violet",
    label: "Electric Violet",
    primary: "0.6 0.25 295",
    ember: "0.7 0.25 300",
    blood: "0.5 0.25 295",
    ring: "0.6 0.25 295",
    accent: "0.5 0.22 295",
    border: "0.3 0.08 295",
  },
  {
    id: "green",
    label: "Matrix Green",
    primary: "0.65 0.22 145",
    ember: "0.75 0.22 145",
    blood: "0.55 0.2 145",
    ring: "0.65 0.22 145",
    accent: "0.55 0.2 145",
    border: "0.3 0.08 145",
  },
  {
    id: "orange",
    label: "Solar Orange",
    primary: "0.7 0.2 50",
    ember: "0.78 0.2 60",
    blood: "0.6 0.2 45",
    ring: "0.7 0.2 50",
    accent: "0.6 0.18 50",
    border: "0.3 0.08 50",
  },
  {
    id: "pink",
    label: "Hot Pink",
    primary: "0.65 0.28 350",
    ember: "0.75 0.28 350",
    blood: "0.55 0.26 350",
    ring: "0.65 0.28 350",
    accent: "0.55 0.24 350",
    border: "0.3 0.08 350",
  },
];

export type Settings = {
  themeId: string;
  cursor: CursorMode;
};

const KEY = "samu-settings-v1";
const DEFAULT: Settings = { themeId: "red", cursor: "glow" };

const listeners = new Set<(s: Settings) => void>();
let current: Settings = DEFAULT;

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function write(s: Settings) {
  current = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  listeners.forEach((l) => l(s));
  apply(s);
}

export function apply(s: Settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const preset = THEME_PRESETS.find((t) => t.id === s.themeId) ?? THEME_PRESETS[0];
  root.style.setProperty("--primary", `oklch(${preset.primary})`);
  root.style.setProperty("--ember", `oklch(${preset.ember})`);
  root.style.setProperty("--blood", `oklch(${preset.blood})`);
  root.style.setProperty("--ring", `oklch(${preset.ring})`);
  root.style.setProperty("--accent", `oklch(${preset.accent})`);
  root.style.setProperty("--border", `oklch(${preset.border})`);
  root.style.setProperty("--destructive", `oklch(${preset.primary})`);

  document.body.classList.remove("cursor-glow", "cursor-minimal", "cursor-crosshair", "cursor-system");
  document.body.classList.add(`cursor-${s.cursor}`);
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [state, setState] = useState<Settings>(() => (typeof window === "undefined" ? DEFAULT : current));

  useEffect(() => {
    current = read();
    setState(current);
    apply(current);
    const l = (s: Settings) => setState(s);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const update = (patch: Partial<Settings>) => write({ ...current, ...patch });
  return [state, update];
}

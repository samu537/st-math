import { useState } from "react";
import { Settings as SettingsIcon, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { THEME_PRESETS, useSettings, type CursorMode } from "@/lib/settings-store";

const CURSORS: { id: CursorMode; label: string; hint: string }[] = [
  { id: "glow", label: "Glow", hint: "Dot + ring with blend" },
  { id: "minimal", label: "Minimal", hint: "Single glowing dot" },
  { id: "crosshair", label: "Crosshair", hint: "Sniper lines" },
  { id: "system", label: "System", hint: "Default OS cursor" },
];

export function SettingsPanel() {
  const [settings, update] = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black tracking-tight">Settings</SheetTitle>
          <SheetDescription>Customize your Samu experience.</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8 px-1">
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Theme color
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {THEME_PRESETS.map((t) => {
                const active = settings.themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => update({ themeId: t.id })}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                      active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
                    }`}
                  >
                    <div
                      className="h-10 w-10 rounded-full shadow-lg"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, oklch(${t.ember}), oklch(${t.primary}) 60%, oklch(${t.blood}))`,
                        boxShadow: `0 0 20px oklch(${t.primary} / 0.6)`,
                      }}
                    />
                    <span className="text-xs font-semibold">{t.label}</span>
                    {active && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Cursor style
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {CURSORS.map((c) => {
                const active = settings.cursor === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => update({ cursor: c.id })}
                    className={`relative rounded-xl border p-4 text-left transition ${
                      active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
                    }`}
                  >
                    <div className="text-sm font-bold">{c.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>
                    {active && (
                      <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Settings are saved on this device.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

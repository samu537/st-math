import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings-store";

export function CustomCursor() {
  const [settings] = useSettings();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.cursor === "system") return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf = 0;

    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = mx + "px";
        dotRef.current.style.top = my + "px";
      }
      if (hRef.current) hRef.current.style.top = my + "px";
      if (vRef.current) vRef.current.style.left = mx + "px";
    };
    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      raf = requestAnimationFrame(loop);
    };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const interactive = t.closest("a, button, input, textarea, select, [role='button']");
      dotRef.current?.classList.toggle("active", !!interactive);
      ringRef.current?.classList.toggle("active", !!interactive);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      cancelAnimationFrame(raf);
    };
  }, [settings.cursor]);

  if (settings.cursor === "system") return null;

  if (settings.cursor === "crosshair") {
    return (
      <>
        <div ref={hRef} className="samu-cursor-cross-h" />
        <div ref={vRef} className="samu-cursor-cross-v" />
        <div ref={dotRef} className="samu-cursor-dot" />
      </>
    );
  }

  if (settings.cursor === "minimal") {
    return <div ref={dotRef} className="samu-cursor-dot samu-cursor-minimal" />;
  }

  return (
    <>
      <div ref={ringRef} className="samu-cursor-ring" />
      <div ref={dotRef} className="samu-cursor-dot" />
    </>
  );
}

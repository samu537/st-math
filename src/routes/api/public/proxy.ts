import { createFileRoute } from "@tanstack/react-router";

// Simple unblocker proxy: fetches the target URL server-side and streams it back,
// stripping frame-blocking headers and rewriting HTML asset URLs to also flow
// through this proxy. Good enough to embed sites that block iframes.

const PROXY_PATH = "/api/public/proxy";

function proxify(target: string): string {
  return `${PROXY_PATH}?url=${encodeURIComponent(target)}`;
}

function resolveAndProxy(raw: string, base: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("javascript:") || trimmed.startsWith("#") || trimmed.startsWith("mailto:")) return raw;
  try {
    const abs = new URL(trimmed, base).toString();
    return proxify(abs);
  } catch {
    return raw;
  }
}

function rewriteHtml(html: string, base: string): string {
  // Strip CSP meta tags
  let out = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
  // Inject <base> for relative refs (in case rewrite misses some)
  out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${base}">`);
  // Rewrite src/href attributes
  out = out.replace(/\b(src|href|action|poster)=("([^"]*)"|'([^']*)')/gi, (_m, attr, _q, dq, sq) => {
    const val = dq ?? sq ?? "";
    return `${attr}="${resolveAndProxy(val, base)}"`;
  });
  // Rewrite srcset (comma list)
  out = out.replace(/\bsrcset=("([^"]*)"|'([^']*)')/gi, (_m, _q, dq, sq) => {
    const val = dq ?? sq ?? "";
    const parts = val.split(",").map((p: string) => {
      const seg = p.trim().split(/\s+/);
      seg[0] = resolveAndProxy(seg[0], base);
      return seg.join(" ");
    });
    return `srcset="${parts.join(", ")}"`;
  });
  return out;
}

function rewriteCss(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, q, u) => {
    return `url(${q}${resolveAndProxy(u, base)}${q})`;
  });
}

export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("url");
        if (!target) {
          return new Response("Missing ?url=", { status: 400 });
        }
        let targetUrl: URL;
        try {
          targetUrl = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (!/^https?:$/.test(targetUrl.protocol)) {
          return new Response("Only http/https allowed", { status: 400 });
        }

        let upstream: Response;
        try {
          upstream = await fetch(targetUrl.toString(), {
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
              accept: request.headers.get("accept") ?? "*/*",
              "accept-language": request.headers.get("accept-language") ?? "en-US,en;q=0.9",
            },
            redirect: "follow",
          });
        } catch (e) {
          return new Response(`Proxy fetch failed: ${e instanceof Error ? e.message : "unknown"}`, { status: 502 });
        }

        const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
        const baseHref = targetUrl.toString();

        // Strip frame-blocking headers
        const outHeaders = new Headers();
        outHeaders.set("content-type", contentType);
        outHeaders.set("access-control-allow-origin", "*");
        outHeaders.set("cache-control", "no-store");

        if (contentType.includes("text/html")) {
          const html = await upstream.text();
          return new Response(rewriteHtml(html, baseHref), { status: upstream.status, headers: outHeaders });
        }
        if (contentType.includes("text/css")) {
          const css = await upstream.text();
          return new Response(rewriteCss(css, baseHref), { status: upstream.status, headers: outHeaders });
        }
        // For binary/script/etc, pass through
        return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
      },
    },
  },
});

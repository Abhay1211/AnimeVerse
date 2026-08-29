import { NextResponse } from "next/server";
import {
    verifyProxySignature,
    buildSignedProxyUrl,
} from "../../../lib/megaplay-proxy";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
        "Accept-Ranges, Content-Length, Content-Range, Content-Type",
};

function isProxyableUrl(value: string): URL | null {
    try {
        const url = new URL(value);
        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return null;
        }
        return url;
    } catch {
        return null;
    }
}

function decodeHeaders(value: string | null): Record<string, string> {
    if (!value) return {};

    try {
        const parsed: unknown = JSON.parse(
            Buffer.from(value, "base64url").toString("utf8")
        );
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        const allowed = new Set(["referer", "user-agent"]);
        return Object.fromEntries(
            Object.entries(parsed).filter(
                ([key, headerValue]) =>
                    allowed.has(key.toLowerCase()) &&
                    typeof headerValue === "string"
            )
        );
    } catch {
        return {};
    }
}

function proxyUrl(request: Request, target: URL, headers: Record<string, string>) {
    return new URL(
        buildSignedProxyUrl(request.url, target.href, headers),
        request.url
    ).href;
}

function rewriteManifest(
    manifest: string,
    target: URL,
    request: Request,
    headers: Record<string, string>
): string {
    return manifest
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith("#")) {
                return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
                    const child = new URL(uri, target.href);
                    return `URI="${proxyUrl(request, child, headers)}"`;
                });
            }

            const child = new URL(trimmed, target.href);
            return proxyUrl(request, child, headers);
        })
        .join("\n");
}

function responseHeaders(upstream: Response, contentType?: string) {
    const headers = new Headers(CORS_HEADERS);
    headers.set(
        "Content-Type",
        contentType ||
            upstream.headers.get("content-type") ||
            "application/octet-stream"
    );

    for (const name of [
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
        "etag",
        "last-modified",
    ]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }

    return headers;
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const targetValue = requestUrl.searchParams.get("url") || "";
    const headersParam = requestUrl.searchParams.get("h") || "";
    const target = isProxyableUrl(targetValue);
    const signature = requestUrl.searchParams.get("sig") || "";
    if (!target) {
        return NextResponse.json(
            { error: "Only signed provider URLs may be proxied" },
            { status: 400, headers: CORS_HEADERS }
        );
    }

    if (!signature || !verifyProxySignature(target.href, headersParam, signature)) {
        return NextResponse.json(
            { error: "Invalid proxy signature" },
            { status: 403, headers: CORS_HEADERS }
        );
    }

    const upstreamHeaders = decodeHeaders(headersParam);
    const range = request.headers.get("range");
    if (range) upstreamHeaders.Range = range;

    let upstream: Response;
    try {
        upstream = await fetch(target.href, {
            headers: upstreamHeaders,
            redirect: "follow",
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Upstream fetch failed",
            },
            { status: 502, headers: CORS_HEADERS }
        );
    }

    if (!upstream.ok) {
        return NextResponse.json(
            { error: `MegaPlay CDN returned ${upstream.status}` },
            { status: 502, headers: CORS_HEADERS }
        );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isManifest =
        target.pathname.toLowerCase().endsWith(".m3u8") ||
        contentType.toLowerCase().includes("mpegurl");

    if (isManifest) {
        const manifest = await upstream.text();
        if (!manifest.trimStart().startsWith("#EXTM3U")) {
            return NextResponse.json(
                { error: "Upstream response was not an HLS manifest" },
                { status: 502, headers: CORS_HEADERS }
            );
        }

        const rewritten = rewriteManifest(
            manifest,
            target,
            request,
            upstreamHeaders
        );
        const headers = responseHeaders(
            upstream,
            "application/vnd.apple.mpegurl"
        );
        headers.set("Content-Length", String(new TextEncoder().encode(rewritten).length));

        return new NextResponse(rewritten, {
            status: upstream.status,
            headers,
        });
    }

    return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders(upstream),
    });
}

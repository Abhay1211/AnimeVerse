import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MEGAPLAY_PROXY_PATH = "/api/anime/proxy";

function proxySecret(): string {
    const configured = process.env.MEGAPLAY_PROXY_SECRET?.trim();
    if (configured) return configured;

    // Keep the signing key server-only while allowing the existing local
    // environment to work without adding another required secret immediately.
    return createHash("sha256")
        .update(process.env.TMDB_API_TOKEN || "animeverse-megaplay-proxy")
        .digest("hex");
}

export function encodeProxyHeaders(
    headers: Record<string, string> | undefined
): string {
    return Buffer.from(JSON.stringify(headers || {})).toString("base64url");
}

function signature(targetUrl: string, headersParam: string): string {
    return createHmac("sha256", proxySecret())
        .update(`${targetUrl}\n${headersParam}`)
        .digest("hex");
}

export function buildSignedProxyUrl(
    requestUrl: string,
    targetUrl: string,
    headers: Record<string, string> | undefined
): string {
    const url = new URL(MEGAPLAY_PROXY_PATH, requestUrl);
    const headersParam = encodeProxyHeaders(headers);
    url.searchParams.set("url", targetUrl);
    url.searchParams.set("h", headersParam);
    url.searchParams.set("sig", signature(targetUrl, headersParam));
    return `${url.pathname}${url.search}`;
}

export function verifyProxySignature(
    targetUrl: string,
    headersParam: string,
    providedSignature: string
): boolean {
    const expected = signature(targetUrl, headersParam);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(providedSignature, "utf8");
    return (
        expectedBuffer.length === providedBuffer.length &&
        timingSafeEqual(expectedBuffer, providedBuffer)
    );
}

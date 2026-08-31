import { createHmac, timingSafeEqual } from "node:crypto";

export const MEGAPLAY_PROXY_PATH = "/api/anime/proxy";

/**
 * Whether a proxy target points at an internal / non-routable address.
 *
 * A valid HMAC signature is the primary access control — only URLs this server
 * signed (the initial `cdn.kryntal.top` manifest, then whatever child manifest
 * and segment hosts that manifest rewrite chain produces) carry a usable
 * `sig`. This function is defence-in-depth: even if the signing secret ever
 * leaked, `/api/anime/proxy` must not be usable to reach loopback, private,
 * link-local, or cloud-metadata addresses.
 *
 * MegaPlay serves manifests from `cdn.kryntal.top` and segments from rotating
 * public tunnel hosts (`*.livedns.my`, `*.trycloud.pro`, …); those are all
 * public DNS names and pass. There is deliberately no fixed host allowlist —
 * one is incompatible with the provider's rotating segment CDNs.
 */
function ipv4IsInternal(ip: string): boolean {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    const octets = parts.map((part) => Number(part));
    if (
        octets.some(
            (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255
        )
    ) {
        return false;
    }
    const [a, b] = octets;
    return (
        a === 0 || // 0.0.0.0/8 ("this host")
        a === 127 || // loopback
        a === 10 || // RFC-1918
        (a === 172 && b >= 16 && b <= 31) || // RFC-1918
        (a === 192 && b === 168) || // RFC-1918
        (a === 169 && b === 254) // link-local incl. 169.254.169.254 metadata
    );
}

function isInternalTarget(url: URL): boolean {
    let host = url.hostname.trim().toLowerCase();
    if (host.startsWith("[") && host.endsWith("]")) {
        host = host.slice(1, -1);
    }

    if (
        host === "" ||
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local")
    ) {
        return true;
    }

    if (host.includes(":")) {
        // IPv6: loopback / unspecified / link-local (fe80::/10) / ULA (fc00::/7)
        if (host === "::1" || host === "::") return true;
        const mapped = host.split(":").pop() ?? "";
        if (mapped.includes(".") && ipv4IsInternal(mapped)) return true;
        return (
            host.startsWith("fe8") ||
            host.startsWith("fe9") ||
            host.startsWith("fea") ||
            host.startsWith("feb") ||
            host.startsWith("fc") ||
            host.startsWith("fd")
        );
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        return ipv4IsInternal(host);
    }

    // Public DNS name — allowed (the route still requires a valid signature).
    return false;
}

/**
 * Optional deploy-time host pin. When `MEGAPLAY_PROXY_ALLOWED_HOSTS`
 * (comma-separated) is set, proxying is additionally restricted to those hosts
 * and their subdomains. It is never required and has no default.
 */
function pinnedProxyHosts(): string[] {
    return (process.env.MEGAPLAY_PROXY_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * True when `url` is safe to proxy: not an internal/non-routable address, and —
 * only when `MEGAPLAY_PROXY_ALLOWED_HOSTS` is configured — one of the pinned
 * hosts. A valid HMAC signature is still required by the route regardless.
 */
export function isProxyTargetAllowed(url: URL): boolean {
    if (isInternalTarget(url)) return false;

    const pinned = pinnedProxyHosts();
    if (pinned.length === 0) return true;

    const host = url.hostname.trim().toLowerCase();
    return pinned.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * HMAC key used to sign / verify proxy URLs.
 *
 * Must be provided by the environment — there is deliberately no built-in
 * fallback, because a predictable key would turn `/api/anime/proxy` into an
 * open relay. `MEGAPLAY_PROXY_SECRET` is preferred; `TMDB_API_TOKEN` (already
 * required for metadata) is accepted so no extra secret is mandatory. If
 * neither is set, signing and verification both throw and the proxy fails
 * closed.
 */
function proxySecret(): string {
    const configured =
        process.env.MEGAPLAY_PROXY_SECRET?.trim() ||
        process.env.TMDB_API_TOKEN?.trim();

    if (!configured) {
        throw new Error(
            "HLS proxy is not configured: set MEGAPLAY_PROXY_SECRET (or TMDB_API_TOKEN)."
        );
    }

    return configured;
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

import { ExtractedHeading, ExtractedImage, ExtractedLink, PublishedPageData } from '../types/audit.ts';
import { validateSafePublicUrl } from './ssrfGuard.ts';

const USER_AGENT = 'SEOArticleIntelligenceAuditor/1.0 (+https://aistudio.google.com)';
const MAX_HTML_BYTES = 1_500_000; // 1.5 MB limit
const FETCH_TIMEOUT_MS = 8500;

const robotsCache = new Map<string, boolean>();

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

export async function isAllowedByRobotsTxt(targetUrl: URL): Promise<boolean> {
  const origin = targetUrl.origin;
  if (robotsCache.has(origin)) {
    return robotsCache.get(origin)!;
  }

  try {
    const robotsUrl = new URL('/robots.txt', origin);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(robotsUrl.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      robotsCache.set(origin, true);
      return true;
    }

    const txt = await res.text();
    const lines = txt.split(/\r?\n/);
    let appliesToUs = false;
    let disallowedAll = false;

    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const lower = line.toLowerCase();
      if (lower.startsWith('user-agent:')) {
        const agent = lower.slice('user-agent:'.length).trim();
        appliesToUs = agent === '*';
      } else if (appliesToUs && lower.startsWith('disallow:')) {
        const path = line.slice('disallow:'.length).trim();
        if (path === '/') {
          disallowedAll = true;
        }
      }
    }

    const allowed = !disallowedAll;
    robotsCache.set(origin, allowed);
    return allowed;
  } catch {
    robotsCache.set(origin, true);
    return true;
  }
}

export async function fetchAndParsePublishedPage(
  rawUrl: string,
  focusKeyword: string
): Promise<PublishedPageData> {
  const validation = await validateSafePublicUrl(rawUrl);
  if (!validation.valid || !validation.parsedUrl) {
    return {
      url: rawUrl,
      fetchedSuccessfully: false,
      errorReason: validation.reason || 'Invalid URL',
      headings: [],
      links: [],
      images: [],
      structuredDataTypes: [],
      rawJsonLd: [],
      wordCount: 0,
    };
  }

  const parsedUrl = validation.parsedUrl;
  const robotsAllowed = await isAllowedByRobotsTxt(parsedUrl);
  if (!robotsAllowed) {
    return {
      url: parsedUrl.toString(),
      fetchedSuccessfully: false,
      errorReason: 'Blocked by site robots.txt policy.',
      headings: [],
      links: [],
      images: [],
      structuredDataTypes: [],
      rawJsonLd: [],
      wordCount: 0,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        url: parsedUrl.toString(),
        fetchedSuccessfully: false,
        statusCode: response.status,
        errorReason: `HTTP ${response.status} (${response.statusText || 'Access restricted'})`,
        headings: [],
        links: [],
        images: [],
        structuredDataTypes: [],
        rawJsonLd: [],
        wordCount: 0,
      };
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return parseHtmlDocument(parsedUrl, html, focusKeyword, response.status);
  } catch (err: any) {
    return {
      url: parsedUrl.toString(),
      fetchedSuccessfully: false,
      errorReason: err?.name === 'AbortError' ? 'Request timed out (8.5s limit).' : err?.message || 'Fetch failed.',
      headings: [],
      links: [],
      images: [],
      structuredDataTypes: [],
      rawJsonLd: [],
      wordCount: 0,
    };
  }
}

export function parseHtmlDocument(
  pageUrl: URL,
  html: string,
  focusKeyword: string,
  statusCode = 200
): PublishedPageData {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : undefined;

  const langMatch = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  const htmlLang = langMatch ? langMatch[1].trim() : undefined;

  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const metaDescription = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1]) : undefined;

  const canonicalMatch =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : undefined;

  const robotsMatch =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i);
  const metaRobots = robotsMatch ? robotsMatch[1].trim() : undefined;

  // JSON-LD extraction
  const rawJsonLd: string[] = [];
  const structuredDataTypes: string[] = [];
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
    const raw = ldMatch[1].trim();
    if (raw) {
      rawJsonLd.push(raw.slice(0, 2000));
      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
        for (const item of items) {
          if (item && item['@type']) {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            types.forEach((t: string) => {
              if (typeof t === 'string' && !structuredDataTypes.includes(t)) {
                structuredDataTypes.push(t);
              }
            });
          }
        }
      } catch {
        // Ignore malformed JSON-LD
      }
    }
  }

  // Extract headings with approximate section word count
  const cleanBodyHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  const headingMatches: { level: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'; text: string; index: number; endIndex: number }[] = [];
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingRegex.exec(cleanBodyHtml)) !== null) {
    const text = stripTags(hMatch[2]);
    if (text) {
      headingMatches.push({
        level: hMatch[1].toUpperCase() as any,
        text,
        index: hMatch.index,
        endIndex: hMatch.index + hMatch[0].length,
      });
    }
  }

  const headings: ExtractedHeading[] = headingMatches.slice(0, 60).map((hm, idx) => {
    const nextStart = idx + 1 < headingMatches.length ? headingMatches[idx + 1].index : cleanBodyHtml.length;
    const sectionRaw = cleanBodyHtml.slice(hm.endIndex, Math.min(nextStart, hm.endIndex + 4000));
    const sectionText = stripTags(sectionRaw);
    const words = sectionText.split(/\s+/).filter(Boolean);
    return {
      level: hm.level,
      text: hm.text,
      sourceType: 'Verified HTML',
      sectionWordCount: words.length,
      sectionPreview: sectionText.slice(0, 220),
    };
  });

  // Extract links
  const links: ExtractedLink[] = [];
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const genericAnchors = new Set(['click here', 'read more', 'learn more', 'here', 'link', 'website', 'source', 'this', 'more']);
  const kwLower = focusKeyword.trim().toLowerCase();
  let lMatch: RegExpExecArray | null;
  while ((lMatch = linkRegex.exec(cleanBodyHtml)) !== null && links.length < 50) {
    const hrefRaw = lMatch[1].trim();
    if (hrefRaw.startsWith('javascript:') || hrefRaw.startsWith('mailto:') || hrefRaw.startsWith('tel:')) continue;
    const anchorText = stripTags(lMatch[2]);
    if (!anchorText) continue;
    let resolvedHref = hrefRaw;
    let isInternal = false;
    try {
      const u = new URL(hrefRaw, pageUrl.origin);
      resolvedHref = u.toString();
      isInternal = u.hostname === pageUrl.hostname;
    } catch {
      isInternal = hrefRaw.startsWith('/');
    }
    const anchorLower = anchorText.toLowerCase();
    links.push({
      href: resolvedHref,
      anchorText: anchorText.slice(0, 120),
      isInternal,
      isGenericAnchor: genericAnchors.has(anchorLower),
      isExactKeywordMatch: Boolean(kwLower && anchorLower === kwLower),
    });
  }

  // Extract images
  const images: ExtractedImage[] = [];
  const imgRegex = /<img[^>]+>/gi;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = imgRegex.exec(cleanBodyHtml)) !== null && images.length < 35) {
    const tag = iMatch[0];
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1].trim();
    if (src.startsWith('data:')) continue;
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
    const filename = src.split('/').pop()?.split('?')[0] || 'image';
    images.push({
      src,
      alt,
      filename,
      hasDescriptiveAlt: alt.trim().split(/\s+/).length >= 3,
    });
  }

  const fullText = stripTags(cleanBodyHtml);
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return {
    url: pageUrl.toString(),
    fetchedSuccessfully: true,
    statusCode,
    title,
    metaDescription,
    canonicalUrl,
    metaRobots,
    htmlLang,
    headings,
    links,
    images,
    structuredDataTypes,
    rawJsonLd,
    wordCount,
  };
}

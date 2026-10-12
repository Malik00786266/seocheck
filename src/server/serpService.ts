import { GoogleGenAI } from '@google/genai';
import { CompetitorPageData } from '../types/audit.ts';
import { isAllowedByRobotsTxt, parseHtmlDocument } from './pageFetcher.ts';
import { validateSafePublicUrl } from './ssrfGuard.ts';

const COUNTRY_GL_MAP: Record<string, string> = {
  'United States': 'us',
  'United Kingdom': 'uk',
  Pakistan: 'pk',
  India: 'in',
  Canada: 'ca',
  Australia: 'au',
  Germany: 'de',
  France: 'fr',
  'United Arab Emirates': 'ae',
  'Saudi Arabia': 'sa',
  Singapore: 'sg',
  Malaysia: 'my',
  Nigeria: 'ng',
  'South Africa': 'za',
  Brazil: 'br',
  Mexico: 'mx',
  Spain: 'es',
  Italy: 'it',
  Netherlands: 'nl',
  Japan: 'jp',
};

export interface RawSerpCandidate {
  position: number | null;
  positionSource: 'SERP Provider' | 'Google Search Grounding';
  url: string;
  title: string;
  snippet: string;
}

export async function discoverSerpCompetitors(
  focusKeyword: string,
  targetCountry: string,
  language: string,
  ai: GoogleGenAI
): Promise<{
  providerUsed: string;
  providerDisclosure: string;
  candidates: RawSerpCandidate[];
}> {
  const gl = COUNTRY_GL_MAP[targetCountry] || 'us';
  const serpApiKey = process.env.SERPAPI_API_KEY?.trim();
  const cseKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cseCx = process.env.GOOGLE_CSE_CX?.trim();

  // 1. Dedicated SerpApi Integration (if configured)
  if (serpApiKey) {
    try {
      const candidates: RawSerpCandidate[] = [];
      for (const startOffset of [0, 10]) {
        const url = new URL('https://serpapi.com/search.json');
        url.searchParams.set('engine', 'google');
        url.searchParams.set('q', focusKeyword);
        url.searchParams.set('gl', gl);
        url.searchParams.set('num', '10');
        url.searchParams.set('start', String(startOffset));
        url.searchParams.set('api_key', serpApiKey);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data: any = await res.json();
          const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
          for (const item of organic) {
            if (item.link && typeof item.link === 'string') {
              candidates.push({
                position: typeof item.position === 'number' ? item.position : candidates.length + 1,
                positionSource: 'SERP Provider',
                url: item.link,
                title: item.title || item.link,
                snippet: item.snippet || '',
              });
            }
          }
        }
      }

      if (candidates.length > 0) {
        return {
          providerUsed: 'SerpApi (Country-Targeted Organic SERP)',
          providerDisclosure: `Retrieved ${candidates.length} organic results for "${focusKeyword}" in ${targetCountry} (gl=${gl}) excluding ads and sponsored blocks.`,
          candidates: candidates.slice(0, 20),
        };
      }
    } catch (err) {
      console.warn('SerpApi lookup failed, falling back to Google Search grounding:', err);
    }
  }

  // 2. Google Custom Search JSON API (if configured)
  if (cseKey && cseCx) {
    try {
      const candidates: RawSerpCandidate[] = [];
      for (const startIndex of [1, 11]) {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        url.searchParams.set('key', cseKey);
        url.searchParams.set('cx', cseCx);
        url.searchParams.set('q', focusKeyword);
        url.searchParams.set('gl', gl);
        url.searchParams.set('start', String(startIndex));
        const res = await fetch(url.toString());
        if (res.ok) {
          const data: any = await res.json();
          const items = Array.isArray(data.items) ? data.items : [];
          for (const item of items) {
            if (item.link) {
              candidates.push({
                position: candidates.length + 1,
                positionSource: 'SERP Provider',
                url: item.link,
                title: item.title || item.link,
                snippet: item.snippet || '',
              });
            }
          }
        }
      }
      if (candidates.length > 0) {
        return {
          providerUsed: 'Google Custom Search JSON API',
          providerDisclosure: `Retrieved ${candidates.length} organic results for "${focusKeyword}" targeted to ${targetCountry} (gl=${gl}).`,
          candidates: candidates.slice(0, 20),
        };
      }
    } catch (err) {
      console.warn('Google CSE lookup failed, falling back to Google Search grounding:', err);
    }
  }

  // 3. Real Google Search Grounding via Gemini API
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Search Google for the exact query "${focusKeyword}" targeted to readers in ${targetCountry} (language: ${language}). Identify the top relevant organic informational, authoritative, and competitor web pages covering this query in ${targetCountry}. Summarize what the current search results cover.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenUrls = new Set<string>();
    const candidates: RawSerpCandidate[] = [];

    for (const chunk of chunks) {
      const web = (chunk as any)?.web;
      if (web?.uri && typeof web.uri === 'string') {
        const cleanUri = web.uri.trim();
        if (!seenUrls.has(cleanUri)) {
          seenUrls.add(cleanUri);
          candidates.push({
            position: null, // Grounding does not guarantee exact 1-20 rank index
            positionSource: 'Google Search Grounding',
            url: cleanUri,
            title: web.title || cleanUri,
            snippet: 'Discovered via live Google Search Grounding for query and country context.',
          });
        }
      }
    }

    return {
      providerUsed: 'Google Search Grounding (Live Web Discovery)',
      providerDisclosure:
        `Discovered ${candidates.length} live web sources via Google Search Grounding for "${focusKeyword}" (${targetCountry}). ` +
        `Note: Because no third-party SERP rank-tracking key (SERPAPI_API_KEY or GOOGLE_CSE_API_KEY) is configured in environment secrets, exact 1–20 organic position numbers are marked as Grounded Discovery rather than simulated rank positions.`,
      candidates: candidates.slice(0, 20),
    };
  } catch (err: any) {
    return {
      providerUsed: 'Google Search Grounding (Unavailable)',
      providerDisclosure: `Live search discovery encountered an error: ${err?.message || 'Unknown error'}. No fake competitor URLs were generated.`,
      candidates: [],
    };
  }
}

export async function retrieveCompetitorPages(
  candidates: RawSerpCandidate[],
  focusKeyword: string
): Promise<CompetitorPageData[]> {
  const timestamp = new Date().toISOString();
  const limit = Math.min(candidates.length, 12);
  const selected = candidates.slice(0, limit);

  const results = await Promise.all(
    selected.map(async (cand): Promise<CompetitorPageData> => {
      let domain = 'unknown';
      try {
        domain = new URL(cand.url).hostname.replace(/^www\./, '');
      } catch {
        // keep unknown
      }

      const safety = await validateSafePublicUrl(cand.url);
      if (!safety.valid || !safety.parsedUrl) {
        return {
          position: cand.position,
          positionSource: cand.positionSource,
          url: cand.url,
          domain,
          serpTitle: cand.title,
          serpSnippet: cand.snippet,
          researchTimestamp: timestamp,
          fetchStatus: 'blocked_http',
          fetchNote: safety.reason || 'URL failed safety validation.',
          headings: [],
          wordCount: 0,
          listsCount: 0,
          tablesCount: 0,
          faqs: [],
          structuredDataTypes: [],
          internalLinksCount: 0,
          externalLinksCount: 0,
          imagesCount: 0,
          textContent: '',
        };
      }

      const targetUrl = safety.parsedUrl;
      const allowed = await isAllowedByRobotsTxt(targetUrl);
      if (!allowed) {
        return {
          position: cand.position,
          positionSource: cand.positionSource,
          url: targetUrl.toString(),
          domain,
          serpTitle: cand.title,
          serpSnippet: cand.snippet,
          researchTimestamp: timestamp,
          fetchStatus: 'blocked_robots',
          fetchNote: 'Disallowed by competitor robots.txt. Page content was not fetched.',
          headings: [],
          wordCount: 0,
          listsCount: 0,
          tablesCount: 0,
          faqs: [],
          structuredDataTypes: [],
          internalLinksCount: 0,
          externalLinksCount: 0,
          imagesCount: 0,
          textContent: '',
        };
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(targetUrl.toString(), {
          headers: {
            'User-Agent': 'SEOArticleIntelligenceAuditor/1.0',
            Accept: 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timer);

        const finalUrl = res.url || targetUrl.toString();
        try {
          domain = new URL(finalUrl).hostname.replace(/^www\./, '');
        } catch {
          // ignore
        }

        if (!res.ok) {
          return {
            position: cand.position,
            positionSource: cand.positionSource,
            url: finalUrl,
            domain,
            serpTitle: cand.title,
            serpSnippet: cand.snippet,
            researchTimestamp: timestamp,
            fetchStatus: 'blocked_http',
            fetchNote: `HTTP ${res.status} (${res.statusText || 'Access blocked or paywalled'})`,
            headings: [],
            wordCount: 0,
            listsCount: 0,
            tablesCount: 0,
            faqs: [],
            structuredDataTypes: [],
            internalLinksCount: 0,
            externalLinksCount: 0,
            imagesCount: 0,
            textContent: '',
          };
        }

        const html = (await res.text()).slice(0, 1_000_000);
        const parsedPage = parseHtmlDocument(new URL(finalUrl), html, focusKeyword, res.status);

        const listsCount = (html.match(/<(ul|ol)\b/gi) || []).length;
        const tablesCount = (html.match(/<table\b/gi) || []).length;

        // Extract question-like headings as FAQs
        const faqs = parsedPage.headings
          .map((h) => h.text)
          .filter((t) => t.endsWith('?') || /^(what|how|why|when|where|who|can|is|does|should)\b/i.test(t))
          .slice(0, 10);

        // Extract clean body text for similarity comparison
        const bodyClean = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const isThinOrJs = parsedPage.wordCount < 120;

        return {
          position: cand.position,
          positionSource: cand.positionSource,
          url: finalUrl,
          domain,
          serpTitle: cand.title,
          serpSnippet: cand.snippet,
          researchTimestamp: timestamp,
          fetchStatus: isThinOrJs ? 'js_dependent_or_thin' : 'fetched',
          fetchNote: isThinOrJs
            ? `Page returned only ${parsedPage.wordCount} words of static text (likely JavaScript-rendered or gated).`
            : `Successfully retrieved ${parsedPage.wordCount} words and ${parsedPage.headings.length} headings.`,
          extractedTitle: parsedPage.title || cand.title,
          mainH1: parsedPage.headings.find((h) => h.level === 'H1')?.text,
          headings: parsedPage.headings.slice(0, 30).map((h) => ({ level: h.level, text: h.text })),
          wordCount: parsedPage.wordCount,
          listsCount,
          tablesCount,
          faqs,
          metaDescription: parsedPage.metaDescription,
          structuredDataTypes: parsedPage.structuredDataTypes,
          internalLinksCount: parsedPage.links.filter((l) => l.isInternal).length,
          externalLinksCount: parsedPage.links.filter((l) => !l.isInternal).length,
          imagesCount: parsedPage.images.length,
          textContent: bodyClean.slice(0, 25000),
        };
      } catch (err: any) {
        return {
          position: cand.position,
          positionSource: cand.positionSource,
          url: targetUrl.toString(),
          domain,
          serpTitle: cand.title,
          serpSnippet: cand.snippet,
          researchTimestamp: timestamp,
          fetchStatus: 'timeout_or_error',
          fetchNote: err?.name === 'AbortError' ? 'Timed out after 7s while fetching page.' : 'Connection error while retrieving competitor page.',
          headings: [],
          wordCount: 0,
          listsCount: 0,
          tablesCount: 0,
          faqs: [],
          structuredDataTypes: [],
          internalLinksCount: 0,
          externalLinksCount: 0,
          imagesCount: 0,
          textContent: '',
        };
      }
    })
  );

  return results;
}

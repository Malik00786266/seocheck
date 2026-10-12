import {
  ExtractedHeading,
  ExtractedImage,
  ExtractedLink,
  KeywordPlacementResult,
  PublishedPageData,
} from '../types/audit.ts';

export interface DeterministicArticleAnalysis {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  detectedLanguage: string;
  headings: ExtractedHeading[];
  headingVerificationNote: string;
  links: ExtractedLink[];
  images: ExtractedImage[];
  keywordStats: {
    exactOccurrences: number;
    variantOccurrences: number;
    approximateDensityPercent: number;
    placements: KeywordPlacementResult[];
  };
  cleanPlainText: string;
  sentences: string[];
  paragraphs: string[];
}

export function detectArticleLanguage(text: string, fallback: string): string {
  const sample = text.slice(0, 2000);
  if (/[\u0600-\u06FF]/.test(sample)) return 'Urdu / Arabic Script';
  if (/[\u0900-\u097F]/.test(sample)) return 'Hindi (Devanagari)';
  if (/[\u4E00-\u9FFF]/.test(sample)) return 'Chinese';
  if (/[áéíóúñ¿¡]/i.test(sample) && /\b(el|la|los|las|para|con|por|una)\b/i.test(sample)) return 'Spanish';
  if (/\b(le|la|les|des|dans|pour|avec|une|est)\b/i.test(sample) && /[éèêàùç]/i.test(sample)) return 'French';
  if (/\b(der|die|das|und|in|den|von|mit|auf|für)\b/i.test(sample)) return 'German';
  return fallback || 'English';
}

export function extractHeadingsFromArticleContent(rawContent: string): {
  headings: ExtractedHeading[];
  verificationNote: string;
} {
  const headings: ExtractedHeading[] = [];
  const hasHtmlHeadings = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i.test(rawContent);

  if (hasHtmlHeadings) {
    const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    const matches: { level: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6'; text: string; idx: number; endIdx: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(rawContent)) !== null) {
      const cleanText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanText) {
        matches.push({
          level: m[1].toUpperCase() as any,
          text: cleanText,
          idx: m.index,
          endIdx: m.index + m[0].length,
        });
      }
    }
    for (let i = 0; i < matches.length; i++) {
      const curr = matches[i];
      const nextIdx = i + 1 < matches.length ? matches[i + 1].idx : rawContent.length;
      const sectionRaw = rawContent.slice(curr.endIdx, nextIdx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = sectionRaw.split(/\s+/).filter(Boolean);
      headings.push({
        level: curr.level,
        text: curr.text,
        sourceType: 'Verified HTML',
        sectionWordCount: words.length,
        sectionPreview: sectionRaw.slice(0, 220),
      });
    }
    return {
      headings,
      verificationNote: 'Headings were verified directly from explicit HTML <h1>–<h6> tags in the submitted content.',
    };
  }

  // Check Markdown or explicit H1:/H2: prefixes or inferred short standalone lines
  const lines = rawContent.split(/\r?\n/);
  const lineEntries: {
    level: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
    text: string;
    sourceType: 'Markdown Syntax' | 'Inferred Formatting';
    lineIndex: number;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Markdown ### Heading
    const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      const lvl = `H${mdMatch[1].length}` as 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
      lineEntries.push({
        level: lvl,
        text: mdMatch[2].replace(/#+\s*$/, '').trim(),
        sourceType: 'Markdown Syntax',
        lineIndex: i,
      });
      continue;
    }

    // Explicit H1: / H2: prefix
    const explicitTagMatch = line.match(/^(H[1-6])\s*[:\-–]\s*(.+)$/i);
    if (explicitTagMatch) {
      lineEntries.push({
        level: explicitTagMatch[1].toUpperCase() as any,
        text: explicitTagMatch[2].trim(),
        sourceType: 'Markdown Syntax',
        lineIndex: i,
      });
      continue;
    }

    // Inferred standalone heading line: short line (< 90 chars), not ending in period/comma/semicolon, surrounded by blank lines
    const prevBlank = i === 0 || lines[i - 1].trim() === '';
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === '';
    const wordCount = line.split(/\s+/).length;
    if (
      prevBlank &&
      nextBlank &&
      wordCount >= 2 &&
      wordCount <= 13 &&
      line.length <= 95 &&
      !/[.,;]$/.test(line) &&
      !/^[-*•]\s/.test(line) &&
      !/^\d+\.\s+[a-z]/.test(line)
    ) {
      lineEntries.push({
        level: lineEntries.length === 0 ? 'H1' : 'H2',
        text: line,
        sourceType: 'Inferred Formatting',
        lineIndex: i,
      });
    }
  }

  for (let i = 0; i < lineEntries.length; i++) {
    const curr = lineEntries[i];
    const nextLineIdx = i + 1 < lineEntries.length ? lineEntries[i + 1].lineIndex : lines.length;
    const sectionText = lines
      .slice(curr.lineIndex + 1, nextLineIdx)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = sectionText.split(/\s+/).filter(Boolean);
    headings.push({
      level: curr.level,
      text: curr.text,
      sourceType: curr.sourceType,
      sectionWordCount: words.length,
      sectionPreview: sectionText.slice(0, 220),
    });
  }

  const hasMarkdown = headings.some((h) => h.sourceType === 'Markdown Syntax');
  const hasInferred = headings.some((h) => h.sourceType === 'Inferred Formatting');

  let verificationNote = 'No explicit HTML heading tags were present in the pasted text.';
  if (hasMarkdown && !hasInferred) {
    verificationNote = 'Heading levels were parsed from Markdown (#, ##, ###) or explicit H1:/H2: prefixes.';
  } else if (hasInferred) {
    verificationNote =
      'Some or all headings were inferred from standalone line formatting because explicit HTML <h1>–<h6> tags were not supplied in the pasted text.';
  }

  return { headings, verificationNote };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function runDeterministicArticleAudit(
  articleTitle: string,
  focusKeyword: string,
  articleContent: string,
  language: string,
  publishedPage?: PublishedPageData
): DeterministicArticleAnalysis {
  const cleanPlainText = articleContent
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n');

  const characterCount = cleanPlainText.length;
  const words = cleanPlainText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const sentences = cleanPlainText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(/\s+/).length >= 4);
  const sentenceCount = Math.max(sentences.length, 1);

  const paragraphs = articleContent
    .split(/\n\s*\n/)
    .map((p) => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
  const paragraphCount = Math.max(paragraphs.length, 1);

  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const detectedLanguage = detectArticleLanguage(cleanPlainText, language);

  const { headings, verificationNote } = extractHeadingsFromArticleContent(articleContent);

  // Extract links from HTML or Markdown in pasted content
  const links: ExtractedLink[] = [];
  const genericAnchors = new Set(['click here', 'read more', 'learn more', 'here', 'link', 'website', 'source', 'this']);
  const kwLower = focusKeyword.trim().toLowerCase();

  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g;
  let mMatch: RegExpExecArray | null;
  while ((mMatch = mdLinkRegex.exec(articleContent)) !== null) {
    const anchor = mMatch[1].trim();
    const href = mMatch[2].trim();
    links.push({
      href,
      anchorText: anchor,
      isInternal: href.startsWith('/'),
      isGenericAnchor: genericAnchors.has(anchor.toLowerCase()),
      isExactKeywordMatch: Boolean(kwLower && anchor.toLowerCase() === kwLower),
    });
  }

  const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let hLinkMatch: RegExpExecArray | null;
  while ((hLinkMatch = htmlLinkRegex.exec(articleContent)) !== null) {
    const href = hLinkMatch[1].trim();
    const anchor = hLinkMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (anchor) {
      links.push({
        href,
        anchorText: anchor,
        isInternal: href.startsWith('/'),
        isGenericAnchor: genericAnchors.has(anchor.toLowerCase()),
        isExactKeywordMatch: Boolean(kwLower && anchor.toLowerCase() === kwLower),
      });
    }
  }

  if (publishedPage?.fetchedSuccessfully && publishedPage.links.length > 0 && links.length === 0) {
    links.push(...publishedPage.links);
  }

  // Extract images from HTML or Markdown in pasted content
  const images: ExtractedImage[] = [];
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = mdImgRegex.exec(articleContent)) !== null) {
    const alt = imgMatch[1].trim();
    const src = imgMatch[2].trim();
    images.push({
      src,
      alt,
      filename: src.split('/').pop()?.split('?')[0] || 'image',
      hasDescriptiveAlt: alt.split(/\s+/).filter(Boolean).length >= 3,
    });
  }

  const htmlImgRegex = /<img[^>]+>/gi;
  let hImgMatch: RegExpExecArray | null;
  while ((hImgMatch = htmlImgRegex.exec(articleContent)) !== null) {
    const tag = hImgMatch[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || '';
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] || '';
    if (src) {
      images.push({
        src,
        alt,
        filename: src.split('/').pop()?.split('?')[0] || 'image',
        hasDescriptiveAlt: alt.split(/\s+/).filter(Boolean).length >= 3,
      });
    }
  }

  if (publishedPage?.fetchedSuccessfully && publishedPage.images.length > 0 && images.length === 0) {
    images.push(...publishedPage.images);
  }

  // Keyword placement analysis
  const kwTokens = kwLower
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9\u0600-\u06FF\u0900-\u097F]/gi, ''))
    .filter((t) => t.length > 2);

  const countExact = (text: string): number => {
    if (!kwLower || !text) return 0;
    const regex = new RegExp(escapeRegExp(kwLower), 'gi');
    return (text.match(regex) || []).length;
  };

  const countVariant = (text: string): number => {
    if (kwTokens.length < 2 || !text) return 0;
    const sents = text.split(/(?<=[.!?])\s+|\n+/);
    let count = 0;
    for (const s of sents) {
      const lower = s.toLowerCase();
      if (lower.includes(kwLower)) continue; // already counted as exact
      const matchedTokens = kwTokens.filter((tok) => lower.includes(tok));
      if (matchedTokens.length >= Math.ceil(kwTokens.length * 0.7)) {
        count++;
      }
    }
    return count;
  };

  const exactTotal = countExact(cleanPlainText);
  const variantTotal = countVariant(cleanPlainText);
  const kwWordLen = Math.max(1, kwLower.split(/\s+/).filter(Boolean).length);
  const approximateDensityPercent =
    wordCount > 0 ? Number((((exactTotal * kwWordLen) / wordCount) * 100).toFixed(2)) : 0;

  const h1Text = headings
    .filter((h) => h.level === 'H1')
    .map((h) => h.text)
    .join(' ');
  const h2h3Text = headings
    .filter((h) => h.level === 'H2' || h.level === 'H3')
    .map((h) => h.text)
    .join(' ');
  const openingPara = paragraphs[0] || cleanPlainText.slice(0, 450);
  const conclusionPara = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '';

  const buildPlacement = (location: string, targetText: string | undefined, isAvailable = true): KeywordPlacementResult => {
    if (!isAvailable || targetText === undefined) {
      return {
        location,
        status: 'Not Applicable',
        exactCount: 0,
        variantCount: 0,
        notes: 'Source element not provided or not applicable.',
      };
    }
    const ex = countExact(targetText);
    const vr = countVariant(targetText);
    return {
      location,
      status: ex > 0 ? 'Present (Exact)' : vr > 0 ? 'Present (Variant)' : 'Not Found',
      exactCount: ex,
      variantCount: vr,
      notes:
        ex > 0
          ? `Found ${ex} exact occurrence(s).`
          : vr > 0
          ? `Found ${vr} close variant occurrence(s).`
          : 'Focus keyword or close variant was not detected in this element.',
    };
  };

  const placements: KeywordPlacementResult[] = [
    buildPlacement('SEO / Article Title', articleTitle),
    buildPlacement('H1 Main Heading', h1Text || undefined, Boolean(h1Text)),
    buildPlacement('Opening Paragraph (First 100–150 words)', openingPara),
    buildPlacement('H2 & H3 Subheadings', h2h3Text || undefined, Boolean(h2h3Text)),
    buildPlacement('Main Article Body', cleanPlainText),
    buildPlacement('Conclusion / Final Section', conclusionPara || undefined, Boolean(conclusionPara)),
    buildPlacement(
      'Meta Description (Live URL)',
      publishedPage?.metaDescription,
      Boolean(publishedPage?.fetchedSuccessfully && publishedPage.metaDescription)
    ),
    buildPlacement(
      'Image Alt Text',
      images.map((i) => i.alt).join(' '),
      images.length > 0
    ),
    buildPlacement(
      'URL Slug',
      publishedPage?.url ? new URL(publishedPage.url).pathname.replace(/[-_/]/g, ' ') : undefined,
      Boolean(publishedPage?.url)
    ),
    buildPlacement(
      'Internal Anchor Text',
      links
        .filter((l) => l.isInternal)
        .map((l) => l.anchorText)
        .join(' '),
      links.some((l) => l.isInternal)
    ),
  ];

  return {
    characterCount,
    wordCount,
    sentenceCount,
    paragraphCount,
    readingTimeMinutes,
    detectedLanguage,
    headings,
    headingVerificationNote: verificationNote,
    links,
    images,
    keywordStats: {
      exactOccurrences: exactTotal,
      variantOccurrences: variantTotal,
      approximateDensityPercent,
      placements,
    },
    cleanPlainText,
    sentences,
    paragraphs,
  };
}

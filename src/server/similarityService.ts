import { CompetitorPageData, ExtractedHeading, SimilarityMatchItem, SimilarityReport } from '../types/audit.ts';

const GENERIC_HEADINGS = new Set([
  'introduction',
  'conclusion',
  'summary',
  'final thoughts',
  'frequently asked questions',
  'faqs',
  'faq',
  'overview',
  'key takeaways',
  'what is it',
  'how it works',
  'pros and cons',
  'benefits',
  'requirements',
  'eligibility',
  'how to apply',
  'references',
  'sources',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\u0900-\u097F\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length > 1);
}

function getWordShingles(tokens: string[], k: number): Set<string> {
  const set = new Set<string>();
  if (tokens.length < k) {
    if (tokens.length > 0) set.add(tokens.join(' '));
    return set;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    set.add(tokens.slice(i, i + k).join(' '));
  }
  return set;
}

function calculateShingleOverlap(tokensA: string[], tokensB: string[], k = 4): number {
  const setA = getWordShingles(tokensA, k);
  const setB = getWordShingles(tokensB, k);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  // Containment / Dice hybrid
  return (2 * intersection) / (setA.size + setB.size);
}

function calculateTokenJaccard(tokensA: string[], tokensB: string[]): number {
  const stopWords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'are', 'was', 'were', 'have', 'has', 'not', 'but', 'can', 'will', 'about', 'into']);
  const setA = new Set(tokensA.filter((t) => t.length > 2 && !stopWords.has(t)));
  const setB = new Set(tokensB.filter((t) => t.length > 2 && !stopWords.has(t)));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function runCompetitorSimilarityAnalysis(
  submittedSentences: string[],
  submittedHeadings: ExtractedHeading[],
  competitors: CompetitorPageData[],
  focusKeyword: string
): SimilarityReport {
  const accessibleCompetitors = competitors.filter(
    (c) => c.fetchStatus === 'fetched' && c.textContent && c.textContent.length > 150
  );
  const unavailableCount = competitors.length - accessibleCompetitors.length;

  const sentenceMatches: SimilarityMatchItem[] = [];
  const headingMatches: SimilarityMatchItem[] = [];

  if (accessibleCompetitors.length === 0) {
    return {
      estimatedSimilarityPercentage: 0,
      competitorsSuccessfullyAnalyzed: 0,
      competitorsUnavailableCount: unavailableCount,
      articleTextComparedPercentage: 0,
      comparisonMethod:
        'Normalized Exact Match + 4-Gram Word Shingle Overlap + Non-Stopword Token Jaccard Similarity',
      disclaimerNote:
        'No competitor full-text pages could be retrieved for direct deterministic passage comparison. Similarity could not be calculated against external sources.',
      sentenceMatches: [],
      headingMatches: [],
      semanticAndStructureNotes: [
        'Because zero competitor pages yielded full accessible body text, this report does not claim a 0% plagiarism score.',
      ],
    };
  }

  // 1. Compare Headings
  const kwNorm = normalizeText(focusKeyword);
  for (const subH of submittedHeadings) {
    const subNorm = normalizeText(subH.text);
    const subTokens = getTokens(subH.text);
    if (subTokens.length === 0) continue;

    for (const comp of accessibleCompetitors) {
      for (const compH of comp.headings) {
        const compNorm = normalizeText(compH.text);
        const compTokens = getTokens(compH.text);
        if (compTokens.length === 0) continue;

        const isExact = subNorm === compNorm;
        const jaccard = calculateTokenJaccard(subTokens, compTokens);
        const score = isExact ? 100 : Math.round(jaccard * 100);

        if (score >= 60) {
          const isGeneric =
            GENERIC_HEADINGS.has(subNorm) ||
            GENERIC_HEADINGS.has(subNorm.replace(kwNorm, '').trim()) ||
            subTokens.length <= 3;

          headingMatches.push({
            submittedPassage: `${subH.level}: ${subH.text}`,
            competitorPassage: `${compH.level}: ${compH.text}`,
            competitorTitle: comp.extractedTitle || comp.serpTitle,
            competitorUrl: comp.url,
            competitorPosition: comp.position,
            matchCategory: isGeneric ? 'Generic Heading Similarity' : 'Distinctive Heading Match',
            similarityScore: score,
            methodUsed: isExact ? 'Normalized Exact String Match' : 'Token Jaccard Overlap',
            isConcerning: !isGeneric && score >= 75,
            concernExplanation: isGeneric
              ? 'Standard topical or structural heading common to articles covering this query; not an indicator of copying.'
              : 'Distinctive heading phrasing closely mirrors a competing article. Rewriting the heading will differentiate your outline.',
            recommendedRewrite: isGeneric
              ? `Keep or make more specific to your angle (e.g., "${subH.text}: Practical Breakdown").`
              : `Rewrite with a concrete, reader-focused angle instead of echoing "${compH.text}".`,
          });
          break;
        }
      }
    }
  }

  // 2. Compare Sentences against Competitor Sentences
  const compSentenceBank: {
    comp: CompetitorPageData;
    sentence: string;
    norm: string;
    tokens: string[];
  }[] = [];

  for (const comp of accessibleCompetitors) {
    const rawSents = comp.textContent
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 35 && s.length <= 450);

    for (const s of rawSents.slice(0, 220)) {
      const tokens = getTokens(s);
      if (tokens.length >= 6) {
        compSentenceBank.push({
          comp,
          sentence: s,
          norm: normalizeText(s),
          tokens,
        });
      }
    }
  }

  let matchedSentenceCount = 0;
  const evaluatedSentences = submittedSentences.filter((s) => getTokens(s).length >= 6);

  for (const subSent of evaluatedSentences) {
    const subNorm = normalizeText(subSent);
    const subTokens = getTokens(subSent);

    let bestMatch: {
      entry: (typeof compSentenceBank)[0];
      score: number;
      shingleScore: number;
      jaccardScore: number;
      isExact: boolean;
    } | null = null;

    for (const entry of compSentenceBank) {
      if (subNorm === entry.norm) {
        bestMatch = { entry, score: 100, shingleScore: 1, jaccardScore: 1, isExact: true };
        break;
      }

      const jaccard = calculateTokenJaccard(subTokens, entry.tokens);
      if (jaccard < 0.35) continue;

      const shingle3 = calculateShingleOverlap(subTokens, entry.tokens, 3);
      const combined = Math.round((shingle3 * 0.6 + jaccard * 0.4) * 100);

      if (combined >= 38 && (!bestMatch || combined > bestMatch.score)) {
        bestMatch = {
          entry,
          score: combined,
          shingleScore: shingle3,
          jaccardScore: jaccard,
          isExact: false,
        };
      }
    }

    if (bestMatch) {
      const { entry, score, shingleScore, isExact } = bestMatch;
      let category: SimilarityMatchItem['matchCategory'] = 'Normal Topic Overlap';
      let isConcerning = false;
      let explanation = '';

      if (isExact || score >= 82) {
        category = 'Exact / Near-Exact Sentence Match';
        isConcerning = true;
        matchedSentenceCount += 1;
        explanation =
          'High verbatim or near-verbatim word sequence overlap with an existing competitor page. Should be rewritten with original analysis.';
      } else if (score >= 58 || shingleScore >= 0.42) {
        category = 'Closely Paraphrased Passage';
        isConcerning = true;
        matchedSentenceCount += 0.65;
        explanation =
          'Closely mirrors the sentence structure and phrasing of the competitor passage. Consider restructuring and adding original examples.';
      } else if (shingleScore >= 0.25) {
        category = 'Repeated Distinctive Phrase';
        isConcerning = false;
        matchedSentenceCount += 0.25;
        explanation =
          'Shares a multi-word phrase or terminology cluster. Verify that only necessary technical terms are shared.';
      } else {
        category = 'Normal Topic Overlap';
        isConcerning = false;
        explanation =
          'Shares topical vocabulary expected when answering the same query; not indicative of copied phrasing.';
      }

      if (sentenceMatches.length < 25) {
        sentenceMatches.push({
          submittedPassage: subSent,
          competitorPassage: entry.sentence,
          competitorTitle: entry.comp.extractedTitle || entry.comp.serpTitle,
          competitorUrl: entry.comp.url,
          competitorPosition: entry.comp.position,
          matchCategory: category,
          similarityScore: score,
          methodUsed: isExact ? 'Normalized Exact Match' : '3-Gram Shingle + Jaccard Hybrid',
          isConcerning,
          concernExplanation: explanation,
          recommendedRewrite: isConcerning
            ? 'Restructure this claim from first principles, lead with the specific takeaway for the reader, and cite the primary source directly.'
            : 'No rewrite required unless you wish to add more specific examples.',
        });
      }
    }
  }

  sentenceMatches.sort((a, b) => b.similarityScore - a.similarityScore);
  headingMatches.sort((a, b) => b.similarityScore - a.similarityScore);

  const estimatedSimilarityPercentage =
    evaluatedSentences.length > 0
      ? Math.min(100, Math.round((matchedSentenceCount / evaluatedSentences.length) * 100))
      : 0;

  const semanticAndStructureNotes: string[] = [
    `Compared ${evaluatedSentences.length} substantive sentences (${submittedHeadings.length} headings) against ${accessibleCompetitors.length} accessible competitor page(s).`,
    `Found ${sentenceMatches.filter((m) => m.isConcerning).length} passage(s) with verbatim or close paraphrase overlap and ${headingMatches.filter((h) => h.isConcerning).length} distinctive heading match(es).`,
  ];

  if (unavailableCount > 0) {
    semanticAndStructureNotes.push(
      `${unavailableCount} discovered competitor URL(s) blocked automated retrieval (robots.txt, HTTP 403/paywall, or JS-only rendering) and were excluded from full-text comparison.`
    );
  }

  return {
    estimatedSimilarityPercentage,
    competitorsSuccessfullyAnalyzed: accessibleCompetitors.length,
    competitorsUnavailableCount: unavailableCount,
    articleTextComparedPercentage: evaluatedSentences.length > 0 ? 100 : 0,
    comparisonMethod:
      'Deterministic Normalized Exact Match + 3-Gram Shingle Containment + Non-Stopword Token Jaccard',
    disclaimerNote:
      `Estimated Similarity Against Available Sources (${accessibleCompetitors.length} retrieved competitor pages). ` +
      'This is NOT a universal internet-wide plagiarism check, nor is text similarity alone a legal determination of copyright infringement.',
    sentenceMatches,
    headingMatches,
    semanticAndStructureNotes,
  };
}

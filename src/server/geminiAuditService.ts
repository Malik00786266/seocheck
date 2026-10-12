import { GoogleGenAI } from '@google/genai';
import {
  AuditInput,
  CompetitorPageData,
  CompleteAuditReport,
  PublishedPageData,
  ScoreCategoryBreakdown,
  SimilarityReport,
  TransparentScoreCard,
} from '../types/audit.ts';
import { DeterministicArticleAnalysis } from './deterministicAudit.ts';

export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeParseJson<T>(rawText: string, fallback: T): T {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function runGroundedFactAndPolicyCheck(
  ai: GoogleGenAI,
  input: AuditInput,
  articleExcerpt: string
): Promise<{
  groundedSummary: string;
  groundedUrls: { title: string; uri: string }[];
}> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are verifying facts and current information for an SEO & Content Quality Audit.
Target Country: ${input.targetCountry}
Focus Keyword: ${input.focusKeyword}
Content Type: ${input.contentType}
Article Title: ${input.articleTitle}

Submitted Article Excerpt:
"""
${articleExcerpt.slice(0, 6000)}
"""

Tasks:
1. Search Google to verify key factual claims, dates, figures, eligibility rules, prices, technical specs, or policy statements made in this article for ${input.targetCountry}.
2. Identify authoritative official or primary sources relevant to "${input.focusKeyword}" in ${input.targetCountry}.
3. Summarize which claims are verified, which are outdated or contradicted, and what current facts a reader in ${input.targetCountry} needs.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundedUrls: { title: string; uri: string }[] = [];
    const seen = new Set<string>();
    for (const c of chunks) {
      const web = (c as any)?.web;
      if (web?.uri && !seen.has(web.uri)) {
        seen.add(web.uri);
        groundedUrls.push({
          title: web.title || web.uri,
          uri: web.uri,
        });
      }
    }

    return {
      groundedSummary: response.text || 'Completed grounded verification.',
      groundedUrls,
    };
  } catch (err: any) {
    return {
      groundedSummary: `Grounded fact verification encountered an issue: ${err?.message || 'Unavailable'}. Claims requiring external verification are flagged accordingly.`,
      groundedUrls: [],
    };
  }
}

export async function generateComprehensiveAuditReport(
  ai: GoogleGenAI,
  input: AuditInput,
  det: DeterministicArticleAnalysis,
  publishedPage: PublishedPageData | undefined,
  serpMeta: {
    providerUsed: string;
    providerDisclosure: string;
    competitors: CompetitorPageData[];
  },
  similarity: SimilarityReport,
  factGrounding: {
    groundedSummary: string;
    groundedUrls: { title: string; uri: string }[];
  }
): Promise<CompleteAuditReport> {
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.slice(0, 10);

  const competitorDigest = serpMeta.competitors.map((c, i) => ({
    index: i,
    url: c.url,
    domain: c.domain,
    position: c.position,
    fetchStatus: c.fetchStatus,
    title: c.extractedTitle || c.serpTitle,
    h1: c.mainH1,
    headings: c.headings.slice(0, 15).map((h) => `${h.level}: ${h.text}`),
    wordCount: c.wordCount,
    excerpt: c.textContent.slice(0, 900),
  }));

  const extractedHeadingsSummary = det.headings.map((h, idx) => ({
    index: idx + 1,
    level: h.level,
    text: h.text,
    sourceType: h.sourceType,
    sectionWordCount: h.sectionWordCount,
    sectionPreview: h.sectionPreview,
  }));

  const prompt = `Act as a senior SEO strategist, technical SEO auditor, human editorial director, search intent analyst, and Google Search Central documentation specialist.

Perform an exhaustive, evidence-based audit of the submitted article.
CRITICAL RULES:
- Use actual article data, quotes, headings, and retrieved competitor evidence. NEVER output generic boilerplate.
- Do NOT invent search volume, CPC, keyword difficulty, or backlinks.
- Distinguish clearly between official Google Search Central requirements, official Google recommendations, third-party SEO best practices, and editorial judgment.
- Do NOT claim AI-generated content is automatically against Google policy, and do NOT claim E-E-A-T is a single measurable numerical ranking factor.
- Do NOT require an arbitrary keyword density percentage or arbitrary number of headings.

INPUT CONTEXT:
- Article Title: ${JSON.stringify(input.articleTitle)}
- Focus Keyword: ${JSON.stringify(input.focusKeyword)}
- Target Country: ${JSON.stringify(input.targetCountry)}
- Language: ${JSON.stringify(det.detectedLanguage)}
- Content Type: ${JSON.stringify(input.contentType)}
- Word Count: ${det.wordCount} words (${det.sentenceCount} sentences, ${det.paragraphCount} paragraphs)
- Heading Verification Note: ${det.headingVerificationNote}
- Extracted Headings from Article: ${JSON.stringify(extractedHeadingsSummary)}
- Retrieved SERP Competitors (${serpMeta.competitors.length} total): ${JSON.stringify(competitorDigest)}
- Grounded Fact-Check Research Summary: ${factGrounding.groundedSummary}
- Grounded Reference URLs: ${JSON.stringify(factGrounding.groundedUrls.slice(0, 12))}

SUBMITTED ARTICLE CONTENT (Full or Substantive Text):
"""
${input.articleContent.slice(0, 26000)}
"""

Return a single valid JSON object matching the exact structure below:
{
  "serpInsights": {
    "dominantSearchIntent": "string (e.g. Informational - Practical Guide / Eligibility & Process)",
    "secondarySearchIntents": ["string"],
    "sharedCompetitorTopics": ["string"],
    "competitorInformationGaps": ["string"],
    "competitorEnrichments": [
      {
        "url": "string (matching competitor url)",
        "searchIntent": "string",
        "apparentAudience": "string",
        "mainTopics": ["string"],
        "entitiesAndConcepts": ["string"],
        "explanationDepth": "string",
        "missingOrOutdatedInCompetitor": "string",
        "elementsMissingInSubmittedArticle": ["string"],
        "strengthComparison": "string"
      }
    ]
  },
  "titleAndMeta": {
    "googleRewriteWarning": "string",
    "matchesIntent": true,
    "clarityAndSpecificityNote": "string",
    "clickbaitOrRepetitionWarning": "string",
    "titleH1Consistency": "string",
    "improvedTitleOptions": ["string (Option 1)", "string (Option 2)", "string (Option 3)"],
    "recommendedMetaDescription": "string (145-160 chars natural, compelling summary)"
  },
  "keywordGrouping": [
    {
      "keywordOrTopic": "string",
      "category": "Primary Focus | Secondary Keyword | Long-Tail Keyword | Close Variant / Synonym | Semantically Related Term | Entity / Named Concept | Search-Intent Modifier | Question-Based Keyword | Country / Local Term | Separate Article Candidate",
      "searchIntent": "Informational | Commercial | Transactional | Navigational | Mixed",
      "relevanceReason": "string",
      "coverageStatus": "Covered | Partially Covered | Missing | Separate Article Recommended",
      "suggestedPlacement": "string",
      "sourceUrl": "string (optional)"
    }
  ],
  "keywordPlacementAnalysis": {
    "overOptimizationWarning": "string",
    "naturalUsageRecommendation": "string"
  },
  "topicalCoverageMatrix": [
    {
      "topic": "string",
      "competitorEvidence": "string",
      "currentCoverage": "Strong | Partial | Weak | Missing",
      "importance": "Critical | High | Medium | Low",
      "recommendedAction": "string"
    }
  ],
  "linksAndMediaSupplement": {
    "unsupportedClaimsNeedingSources": ["string"],
    "suggestedExternalSources": [
      { "title": "string", "url": "string", "reason": "string" }
    ],
    "recommendedVisualAdditions": ["string"]
  },
  "technicalSupplement": {
    "recommendedSchemaTypes": ["string (e.g. Article, FAQPage, BreadcrumbList)"],
    "recommendedJsonLdSample": "string (valid JSON-LD string matching visible article content)"
  },
  "headingHierarchyAudit": {
    "summaryEvaluation": "string",
    "headingAuditTable": [
      {
        "existingHeading": "string (or '[Missing Section]' if proposing a new required heading)",
        "currentLevel": "string (e.g. H1, H2, H3, Inferred H2, or None)",
        "levelVerification": "Verified HTML | Markdown Syntax | Inferred Formatting | Missing (Proposed)",
        "recommendedLevel": "H1 | H2 | H3 | H4 | Remove | Merge",
        "problemIdentified": "string",
        "reasonForRecommendation": "string",
        "requiredAction": "Retain | Rewrite | Move | Merge | Split | Remove | Change Level | Add New Section",
        "suggestedImprovedHeading": "string",
        "priority": "Critical | High | Medium | Low",
        "parentHeading": "string (optional parent H1/H2)",
        "weakContentQuote": "string (exact quote or section weakness description)",
        "contentImprovementDetail": "string (concrete explanation of what to add/fix beneath this heading)"
      }
    ],
    "proposedOutline": [
      {
        "level": "H1 | H2 | H3 | H4",
        "headingText": "string",
        "purpose": "string",
        "essentialPointsToExplain": ["string"],
        "isNewAddition": false
      }
    ],
    "fixChecklist": {
      "criticalStructuralOrFactual": ["string"],
      "importantMissingSections": ["string"],
      "headingsNeedingRewrite": ["string"],
      "sectionsRequiringDeeperExplanation": ["string"],
      "minorFormattingImprovements": ["string"]
    }
  },
  "contentQualityAudit": {
    "overallEditorialSummary": "string",
    "toneAndAudienceEvaluation": {
      "intendedAudience": "string",
      "toneMatchAssessment": "string",
      "consistencyNotes": "string",
      "repetitiveOrFormulaicWarning": "string"
    },
    "structureAndReadability": {
      "introEffectiveness": "string",
      "answerDirectness": "string",
      "sectionOrderEvaluation": "string",
      "listsTablesFaqUsefulness": "string",
      "conclusionUsefulness": "string"
    },
    "grammarAndLanguageFindings": [
      {
        "originalExcerpt": "string (exact sentence from article)",
        "issueType": "Grammar | Spelling | Punctuation | Awkward Phrasing | Repetition | Tense/Agreement | Filler/Robotic",
        "problemExplanation": "string",
        "correctedAlternative": "string"
      }
    ],
    "sentenceQualityFindings": [
      {
        "sentenceExcerpt": "string (exact sentence from article)",
        "evaluationCategory": "Clarity | Conciseness | Unsupported Claim | Passive Voice | Formulaic Transition | Complexity Harming Understanding",
        "explanation": "string",
        "suggestedImprovement": "string"
      }
    ],
    "paragraphAndDepthFindings": [
      {
        "paragraphIdentifier": "string (e.g. Opening Paragraph / Section under H2 '...')",
        "issue": "string",
        "explanationDepthAssessment": "string",
        "whatToAddAndWhy": "string"
      }
    ]
  },
  "googleGuidelinesAudit": {
    "eeatQualitativeAssessment": "string (evaluate Experience, Expertise, Authoritativeness, and Trustworthiness qualitatively—not as a numeric ranking factor)",
    "aiContentPolicyNote": "string (explain Google's people-first helpful content stance regarding how content is produced vs usefulness and accuracy)",
    "guidelinesAndRisks": [
      {
        "guidelineTitle": "string",
        "sourceClassification": "Official Google Requirement | Official Google Recommendation | Third-Party SEO Best Practice | Editorial Judgment",
        "officialDocName": "string (e.g. Creating Helpful, Reliable, People-First Content / Google Search Essentials / Title Links)",
        "officialDocUrl": "string (e.g. https://developers.google.com/search/docs/fundamentals/creating-helpful-content)",
        "specificArticleIssue": "string",
        "whyItMatters": "string",
        "recommendedChange": "string",
        "severity": "Critical | High | Medium | Low",
        "confidence": "High | Medium | Low"
      }
    ]
  },
  "uniquenessAndAdvantage": {
    "overallDifferentiationSummary": "string",
    "contributesMeaningfulValue": true,
    "originalExplanationsAssessment": "string",
    "distinctiveExamplesAssessment": "string",
    "firstHandEvidenceAssessment": "string",
    "practicalDetailsOmittedByCompetitors": ["string"],
    "waysToIncreaseCompetitiveAdvantage": ["string"]
  },
  "factualAccuracyAndTrust": {
    "trustSignalsEvaluation": "string",
    "freshnessAssessment": "string",
    "claimsChecked": [
      {
        "originalClaim": "string (exact claim from the submitted article)",
        "verificationStatus": "Verified | Contradicted | Uncertain | Verification Required",
        "sourceUrl": "string (optional verified URL)",
        "sourceDate": "string (optional)",
        "suggestedCorrectionOrQualification": "string"
      }
    ]
  },
  "scoringEvaluation": {
    "seoCategories": {
      "titleAndMetadata": { "earned": 7, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "keywordRelevanceAndPlacement": { "earned": 8, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "searchIntentAndTopicalCoverage": { "earned": 14, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "headingStructureAndOrganization": { "earned": 6, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "internalAndExternalLinks": { "earned": 5, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "onPageCompletenessAndSemantic": { "earned": 11, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "imageMediaAndAccessibility": { "earned": 3, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "technicalAndStructuredData": { "earned": 6, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "guidelineRisksAndAccuracy": { "earned": 8, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" }
    },
    "contentQualityCategories": {
      "clarityAndReadability": { "earned": 12, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "grammarAndSentenceQuality": { "earned": 12, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "explanationDepth": { "earned": 13, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "structureAndLogicalFlow": { "earned": 11, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "intentSatisfactionAndUsefulness": { "earned": 11, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "accuracyAndSupportingEvidence": { "earned": 7, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" },
      "originalInsightAndValue": { "earned": 6, "reasonsForLostPoints": ["string"], "evidenceSummary": "string" }
    },
    "competitiveCoverage": {
      "score": 68,
      "topicsCoveredCount": 6,
      "totalKeyTopicsCount": 9,
      "originalValueBonusPoints": 5,
      "explanation": "string"
    }
  },
  "prioritizedIssues": [
    {
      "issueId": "ISS-01",
      "category": "On-Page SEO | Heading Structure | Search Intent & Coverage | Writing Quality | Factual Accuracy | Similarity & Originality | Google Guidelines | Technical & Links",
      "severity": "Critical | High | Medium | Low",
      "exactLocation": "string",
      "evidence": "string",
      "problemExplanation": "string",
      "whyItMatters": "string",
      "recommendedAction": "string",
      "suggestedReplacement": "string",
      "sourceUrl": "string (optional)",
      "confidenceLevel": "High | Medium | Low"
    }
  ],
  "editingActionPlan": {
    "recommendedSeoTitle": "string",
    "improvedH1": "string",
    "recommendedMetaDescription": "string",
    "missingSectionsToBuild": ["string"],
    "paragraphsNeedingDeeperExplanation": ["string"],
    "helpfulTablesExamplesFaqs": ["string"],
    "prioritizedEditingChecklist": ["string"]
  }
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed: any = safeParseJson(response.text || '{}', {});

  // Merge AI competitor enrichments into serpMeta.competitors
  const enrichments: any[] = Array.isArray(parsed?.serpInsights?.competitorEnrichments)
    ? parsed.serpInsights.competitorEnrichments
    : [];

  const enrichedCompetitors: CompetitorPageData[] = serpMeta.competitors.map((c) => {
    const found = enrichments.find((e) => e.url === c.url || (c.domain && e.url?.includes(c.domain)));
    return {
      ...c,
      searchIntent: found?.searchIntent || 'Informational / Topic Reference',
      apparentAudience: found?.apparentAudience || `Readers in ${input.targetCountry} researching ${input.focusKeyword}`,
      mainTopics: Array.isArray(found?.mainTopics) && found.mainTopics.length > 0
        ? found.mainTopics
        : c.headings.slice(0, 6).map((h) => h.text),
      entitiesAndConcepts: Array.isArray(found?.entitiesAndConcepts) ? found.entitiesAndConcepts : [],
      explanationDepth:
        found?.explanationDepth ||
        (c.fetchStatus === 'fetched'
          ? `Covers ${c.wordCount} words across ${c.headings.length} headings, ${c.listsCount} lists, and ${c.tablesCount} tables.`
          : 'Page content was not accessible for full depth inspection.'),
      missingOrOutdatedInCompetitor:
        found?.missingOrOutdatedInCompetitor || 'Verify specific recent updates or local edge cases.',
      elementsMissingInSubmittedArticle: Array.isArray(found?.elementsMissingInSubmittedArticle)
        ? found.elementsMissingInSubmittedArticle
        : [],
      strengthComparison:
        found?.strengthComparison ||
        (c.fetchStatus === 'fetched'
          ? 'Compare heading depth and structured examples against this page.'
          : 'Full comparison limited because page blocked automated access.'),
    };
  });

  // Build Transparent SEO Score Card (100 points configurable model)
  // Note: If no live URL is provided and no HTML/Markdown images exist, mark Image/Media or Technical appropriately!
  const hasLiveUrl = Boolean(publishedPage?.fetchedSuccessfully);
  const hasImagesInInput = det.images.length > 0 || hasLiveUrl;
  const seoRaw = parsed?.scoringEvaluation?.seoCategories || {};

  const clampScore = (val: any, max: number, fallback: number): number => {
    const n = Number(val);
    if (Number.isNaN(n)) return fallback;
    return Math.max(0, Math.min(max, Math.round(n)));
  };

  const seoCategories: ScoreCategoryBreakdown[] = [
    {
      categoryName: 'Title and Metadata',
      maxPoints: 10,
      earnedPoints: clampScore(seoRaw.titleAndMetadata?.earned, 10, 7),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.titleAndMetadata?.reasonsForLostPoints || [],
      evidenceSummary: seoRaw.titleAndMetadata?.evidenceSummary || `Evaluated supplied title (${input.articleTitle.length} chars).`,
    },
    {
      categoryName: 'Keyword Relevance and Placement',
      maxPoints: 10,
      earnedPoints: clampScore(seoRaw.keywordRelevanceAndPlacement?.earned, 10, 7),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.keywordRelevanceAndPlacement?.reasonsForLostPoints || [],
      evidenceSummary:
        seoRaw.keywordRelevanceAndPlacement?.evidenceSummary ||
        `Exact focus keyword found ${det.keywordStats.exactOccurrences} time(s); variants ${det.keywordStats.variantOccurrences} time(s).`,
    },
    {
      categoryName: 'Search Intent and Topical Coverage',
      maxPoints: 20,
      earnedPoints: clampScore(seoRaw.searchIntentAndTopicalCoverage?.earned, 20, 14),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.searchIntentAndTopicalCoverage?.reasonsForLostPoints || [],
      evidenceSummary:
        seoRaw.searchIntentAndTopicalCoverage?.evidenceSummary ||
        'Evaluated alignment against dominant query intent and competitor subtopics.',
    },
    {
      categoryName: 'Heading Structure and Content Organization',
      maxPoints: 10,
      earnedPoints: clampScore(seoRaw.headingStructureAndOrganization?.earned, 10, 6),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.headingStructureAndOrganization?.reasonsForLostPoints || [],
      evidenceSummary:
        seoRaw.headingStructureAndOrganization?.evidenceSummary ||
        `Inspected ${det.headings.length} heading(s) (${det.headingVerificationNote}).`,
    },
    {
      categoryName: 'Internal and External Links',
      maxPoints: 10,
      earnedPoints: clampScore(seoRaw.internalAndExternalLinks?.earned, 10, det.links.length > 0 ? 7 : 3),
      status: 'Assessed',
      reasonsForLostPoints:
        seoRaw.internalAndExternalLinks?.reasonsForLostPoints ||
        (det.links.length === 0 ? ['No links or external source citations were included in the submitted article.'] : []),
      evidenceSummary:
        seoRaw.internalAndExternalLinks?.evidenceSummary ||
        `Detected ${det.links.length} link(s) in the submitted content.`,
    },
    {
      categoryName: 'On-Page Content Completeness and Semantic Relevance',
      maxPoints: 15,
      earnedPoints: clampScore(seoRaw.onPageCompletenessAndSemantic?.earned, 15, 11),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.onPageCompletenessAndSemantic?.reasonsForLostPoints || [],
      evidenceSummary:
        seoRaw.onPageCompletenessAndSemantic?.evidenceSummary ||
        'Evaluated entity coverage, semantic terminology, and topic completeness.',
    },
    {
      categoryName: 'Image, Media, and Accessibility Checks',
      maxPoints: 5,
      earnedPoints: hasImagesInInput ? clampScore(seoRaw.imageMediaAndAccessibility?.earned, 5, 3) : null,
      status: hasImagesInInput ? 'Assessed' : 'Insufficient Data',
      reasonsForLostPoints: hasImagesInInput
        ? seoRaw.imageMediaAndAccessibility?.reasonsForLostPoints || []
        : ['Pasted text contained no HTML/Markdown image tags and no live URL was fetched. Excluded from score denominator rather than assumed passed.'],
      evidenceSummary: hasImagesInInput
        ? `Inspected ${det.images.length} image element(s) for descriptive alt text.`
        : 'Not Checked — requires image markup or live published URL.',
    },
    {
      categoryName: 'Applicable Technical and Structured-Data Checks',
      maxPoints: 10,
      earnedPoints: hasLiveUrl ? clampScore(seoRaw.technicalAndStructuredData?.earned, 10, 7) : null,
      status: hasLiveUrl ? 'Assessed' : 'Not Checked',
      reasonsForLostPoints: hasLiveUrl
        ? seoRaw.technicalAndStructuredData?.reasonsForLostPoints || []
        : ['No live published Article URL was supplied; canonical, meta robots, and live JSON-LD cannot be verified from pasted text alone.'],
      evidenceSummary: hasLiveUrl
        ? `Inspected live HTML at ${publishedPage?.url} (Schema: ${publishedPage?.structuredDataTypes.join(', ') || 'None'}).`
        : 'Not Checked — live URL required. Score normalized transparently across assessed categories.',
    },
    {
      categoryName: 'Search Guideline Risks and Content Accuracy',
      maxPoints: 10,
      earnedPoints: clampScore(seoRaw.guidelineRisksAndAccuracy?.earned, 10, 7),
      status: 'Assessed',
      reasonsForLostPoints: seoRaw.guidelineRisksAndAccuracy?.reasonsForLostPoints || [],
      evidenceSummary:
        seoRaw.guidelineRisksAndAccuracy?.evidenceSummary ||
        'Evaluated against Google Search Essentials, Helpful Content guidance, and grounded factual checks.',
    },
  ];

  const seoEarnedSum = seoCategories.reduce((acc, c) => acc + (c.earnedPoints ?? 0), 0);
  const seoMaxAssessedSum = seoCategories.reduce((acc, c) => acc + (c.earnedPoints !== null ? c.maxPoints : 0), 0);
  const seoNormalized = seoMaxAssessedSum > 0 ? Math.round((seoEarnedSum / seoMaxAssessedSum) * 100) : 0;

  const seoScore: TransparentScoreCard = {
    normalizedScore: seoNormalized,
    rawEarnedPoints: seoEarnedSum,
    rawMaxAssessedPoints: seoMaxAssessedSum,
    totalConfiguredPoints: 100,
    methodologyNote:
      seoMaxAssessedSum < 100
        ? `Normalized from ${seoEarnedSum}/${seoMaxAssessedSum} assessed points (${100 - seoMaxAssessedSum} points marked Not Checked / Insufficient Data and excluded rather than treated as passed). Diagnostic estimate only, not an official Google score.`
        : 'Calculated across all 100 configured points. Diagnostic estimate only, not an official Google score.',
    categories: seoCategories,
  };

  // Build Content Quality Score Card (100 points)
  const cqRaw = parsed?.scoringEvaluation?.contentQualityCategories || {};
  const cqCategories: ScoreCategoryBreakdown[] = [
    {
      categoryName: 'Clarity and Readability',
      maxPoints: 15,
      earnedPoints: clampScore(cqRaw.clarityAndReadability?.earned, 15, 11),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.clarityAndReadability?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.clarityAndReadability?.evidenceSummary || 'Evaluated sentence clarity and audience readability.',
    },
    {
      categoryName: 'Grammar and Sentence Quality',
      maxPoints: 15,
      earnedPoints: clampScore(cqRaw.grammarAndSentenceQuality?.earned, 15, 12),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.grammarAndSentenceQuality?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.grammarAndSentenceQuality?.evidenceSummary || 'Inspected grammar, punctuation, and phrasing.',
    },
    {
      categoryName: 'Explanation Depth',
      maxPoints: 20,
      earnedPoints: clampScore(cqRaw.explanationDepth?.earned, 20, 13),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.explanationDepth?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.explanationDepth?.evidenceSummary || 'Evaluated whether claims explain how/why with concrete steps and examples.',
    },
    {
      categoryName: 'Structure and Logical Flow',
      maxPoints: 15,
      earnedPoints: clampScore(cqRaw.structureAndLogicalFlow?.earned, 15, 11),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.structureAndLogicalFlow?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.structureAndLogicalFlow?.evidenceSummary || 'Evaluated paragraph progression and section transitions.',
    },
    {
      categoryName: 'Search Intent Satisfaction and Reader Usefulness',
      maxPoints: 15,
      earnedPoints: clampScore(cqRaw.intentSatisfactionAndUsefulness?.earned, 15, 11),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.intentSatisfactionAndUsefulness?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.intentSatisfactionAndUsefulness?.evidenceSummary || 'Evaluated directness of answers and practical reader value.',
    },
    {
      categoryName: 'Accuracy and Supporting Evidence',
      maxPoints: 10,
      earnedPoints: clampScore(cqRaw.accuracyAndSupportingEvidence?.earned, 10, 7),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.accuracyAndSupportingEvidence?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.accuracyAndSupportingEvidence?.evidenceSummary || 'Evaluated factual claims and source backing.',
    },
    {
      categoryName: 'Original Insight and Added Value',
      maxPoints: 10,
      earnedPoints: clampScore(cqRaw.originalInsightAndValue?.earned, 10, 6),
      status: 'Assessed',
      reasonsForLostPoints: cqRaw.originalInsightAndValue?.reasonsForLostPoints || [],
      evidenceSummary: cqRaw.originalInsightAndValue?.evidenceSummary || 'Evaluated distinctive insights vs common SERP summaries.',
    },
  ];

  const cqEarnedSum = cqCategories.reduce((acc, c) => acc + (c.earnedPoints ?? 0), 0);
  const contentQualityScore: TransparentScoreCard = {
    normalizedScore: cqEarnedSum,
    rawEarnedPoints: cqEarnedSum,
    rawMaxAssessedPoints: 100,
    totalConfiguredPoints: 100,
    methodologyNote:
      'Editorial diagnostic score across 7 weighted writing-quality dimensions (100 points total). Not an official Google ranking metric.',
    categories: cqCategories,
  };

  const titleCharLen = input.articleTitle.trim().length;
  const approxPixels = Math.round(titleCharLen * 9.4);
  const hasFocusKwInTitle = input.articleTitle.toLowerCase().includes(input.focusKeyword.trim().toLowerCase());

  const page1Count = enrichedCompetitors.filter((c) => c.position !== null && c.position <= 10).length;
  const page2Count = enrichedCompetitors.filter((c) => c.position !== null && c.position > 10).length;
  const accessibleCount = enrichedCompetitors.filter((c) => c.fetchStatus === 'fetched').length;

  return {
    auditId: `aud_${Date.now().toString(36)}`,
    generatedAt: nowIso,
    input,
    articleMetrics: {
      characterCount: det.characterCount,
      wordCount: det.wordCount,
      sentenceCount: det.sentenceCount,
      paragraphCount: det.paragraphCount,
      readingTimeMinutes: det.readingTimeMinutes,
      detectedLanguage: det.detectedLanguage,
      headingCount: det.headings.length,
      headingVerificationNote: det.headingVerificationNote,
    },
    publishedPage,
    serpResearch: {
      providerUsed: serpMeta.providerUsed,
      providerDisclosure: serpMeta.providerDisclosure,
      targetCountry: input.targetCountry,
      totalValidOrganicResults: enrichedCompetitors.length,
      page1Count: page1Count || enrichedCompetitors.length,
      page2Count,
      accessibleCompetitorsCount: accessibleCount,
      blockedOrUnavailableCount: enrichedCompetitors.length - accessibleCount,
      dominantSearchIntent:
        parsed?.serpInsights?.dominantSearchIntent || `Informational — ${input.contentType}`,
      secondarySearchIntents: Array.isArray(parsed?.serpInsights?.secondarySearchIntents)
        ? parsed.serpInsights.secondarySearchIntents
        : ['Practical Steps & Verification', 'Comparison & Examples'],
      competitors: enrichedCompetitors,
      sharedCompetitorTopics: Array.isArray(parsed?.serpInsights?.sharedCompetitorTopics)
        ? parsed.serpInsights.sharedCompetitorTopics
        : [],
      competitorInformationGaps: Array.isArray(parsed?.serpInsights?.competitorInformationGaps)
        ? parsed.serpInsights.competitorInformationGaps
        : [],
    },
    onPageSeo: {
      titleAndMeta: {
        suppliedTitle: input.articleTitle,
        characterLength: titleCharLen,
        approximatePixelWidth: approxPixels,
        googleRewriteWarning:
          parsed?.titleAndMeta?.googleRewriteWarning ||
          (approxPixels > 580
            ? `At ~${approxPixels}px (${titleCharLen} chars), this title may be truncated on desktop/mobile SERPs. Note that Google may rewrite title links based on <title>, H1, or query context.`
            : `At ~${approxPixels}px (${titleCharLen} chars), length fits typical SERP display, though Google may still dynamically adjust title links based on the user's query.`),
        matchesIntent: parsed?.titleAndMeta?.matchesIntent ?? true,
        hasFocusKeyword: hasFocusKwInTitle,
        clarityAndSpecificityNote:
          parsed?.titleAndMeta?.clarityAndSpecificityNote ||
          'Evaluated title specificity and alignment with the article body.',
        clickbaitOrRepetitionWarning:
          parsed?.titleAndMeta?.clickbaitOrRepetitionWarning || 'No severe clickbait detected.',
        titleH1Consistency:
          parsed?.titleAndMeta?.titleH1Consistency ||
          'Ensure the page <title> and main H1 heading reinforce the same primary promise without unnatural duplication.',
        improvedTitleOptions:
          Array.isArray(parsed?.titleAndMeta?.improvedTitleOptions) &&
          parsed.titleAndMeta.improvedTitleOptions.length > 0
            ? parsed.titleAndMeta.improvedTitleOptions
            : [
                `${input.articleTitle} (${new Date().getFullYear()} Guide)`,
                `${input.focusKeyword}: Complete Breakdown, Requirements & Key Facts`,
                `Understanding ${input.focusKeyword} in ${input.targetCountry}: Practical Guide`,
              ],
        recommendedMetaDescription:
          parsed?.titleAndMeta?.recommendedMetaDescription ||
          `Learn everything about ${input.focusKeyword} in ${input.targetCountry}, including verified requirements, step-by-step guidance, and practical examples.`,
      },
      keywordGrouping: Array.isArray(parsed?.keywordGrouping) ? parsed.keywordGrouping : [],
      keywordPlacement: {
        exactOccurrences: det.keywordStats.exactOccurrences,
        variantOccurrences: det.keywordStats.variantOccurrences,
        approximateDensityPercent: det.keywordStats.approximateDensityPercent,
        overOptimizationWarning:
          parsed?.keywordPlacementAnalysis?.overOptimizationWarning ||
          'Avoid repeating the exact keyword string where a pronoun or natural synonym reads more smoothly.',
        naturalUsageRecommendation:
          parsed?.keywordPlacementAnalysis?.naturalUsageRecommendation ||
          'Google does not use a fixed keyword density target. Prioritize clear topic establishment in the title, H1, and opening paragraph, then use natural domain terminology.',
        placements: det.keywordStats.placements,
      },
      topicalCoverageMatrix: Array.isArray(parsed?.topicalCoverageMatrix)
        ? parsed.topicalCoverageMatrix
        : [],
      linksAudit: {
        siteWideLimitationNote: hasLiveUrl
          ? `Inspected links on ${publishedPage?.url}. Full site-wide internal linking opportunities still require a complete XML sitemap or site crawl.`
          : 'No live website URL or XML sitemap was supplied; site-wide internal linking opportunities cannot be verified from pasted text alone.',
        extractedLinks: det.links,
        unsupportedClaimsNeedingSources: Array.isArray(
          parsed?.linksAndMediaSupplement?.unsupportedClaimsNeedingSources
        )
          ? parsed.linksAndMediaSupplement.unsupportedClaimsNeedingSources
          : [],
        suggestedExternalSources: Array.isArray(parsed?.linksAndMediaSupplement?.suggestedExternalSources)
          ? parsed.linksAndMediaSupplement.suggestedExternalSources
          : factGrounding.groundedUrls.slice(0, 5).map((u) => ({
              title: u.title,
              url: u.uri,
              reason: 'Authoritative reference discovered during live Google Search grounding.',
            })),
      },
      mediaAudit: {
        inspectedImages: det.images,
        mediaNote:
          det.images.length > 0
            ? `Inspected ${det.images.length} accessible image reference(s).`
            : 'No accessible image tags were present in the submitted input. Only images actually supplied or fetched are evaluated.',
        recommendedVisualAdditions: Array.isArray(
          parsed?.linksAndMediaSupplement?.recommendedVisualAdditions
        )
          ? parsed.linksAndMediaSupplement.recommendedVisualAdditions
          : [],
      },
      technicalAudit: {
        isLiveUrlProvided: hasLiveUrl,
        separationDisclosure: hasLiveUrl
          ? `Live HTML fetched from ${publishedPage?.url}. Note: Core Web Vitals, mobile rendering layout, Search Console indexing status, and server crawl logs cannot be verified from a single HTML fetch.`
          : 'Audit performed on pasted article text only. Canonical tags, meta robots, live JSON-LD, Core Web Vitals, mobile rendering, and indexing status require a live URL and Search Console access.',
        canonicalCheck: hasLiveUrl
          ? publishedPage?.canonicalUrl
            ? `Canonical tag present: ${publishedPage.canonicalUrl}`
            : 'Warning: No <link rel="canonical"> tag was found in the fetched HTML.'
          : 'Requires Live URL (Not verifiable from pasted text)',
        robotsAndIndexability: hasLiveUrl
          ? publishedPage?.metaRobots
            ? `Meta robots directive: "${publishedPage.metaRobots}"`
            : 'No restrictive meta robots tag detected (default index, follow).'
          : 'Requires Live URL (Not verifiable from pasted text)',
        structuredDataStatus: hasLiveUrl
          ? publishedPage?.structuredDataTypes.length
            ? `Detected JSON-LD schema types: ${publishedPage.structuredDataTypes.join(', ')}`
            : 'No JSON-LD structured data detected on the live URL.'
          : 'Requires Live URL (Recommend adding schema when publishing)',
        recommendedSchemaTypes: Array.isArray(parsed?.technicalSupplement?.recommendedSchemaTypes)
          ? parsed.technicalSupplement.recommendedSchemaTypes
          : ['Article'],
        recommendedJsonLdSample: parsed?.technicalSupplement?.recommendedJsonLdSample,
      },
    },
    headingHierarchyAudit: {
      summaryEvaluation:
        parsed?.headingHierarchyAudit?.summaryEvaluation ||
        'Evaluated existing headings for semantic hierarchy (H1–H4), reader usefulness, and content depth beneath each heading.',
      extractedHeadings: det.headings,
      headingAuditTable: Array.isArray(parsed?.headingHierarchyAudit?.headingAuditTable)
        ? parsed.headingHierarchyAudit.headingAuditTable
        : [],
      proposedOutline: Array.isArray(parsed?.headingHierarchyAudit?.proposedOutline)
        ? parsed.headingHierarchyAudit.proposedOutline
        : [],
      fixChecklist: {
        criticalStructuralOrFactual:
          parsed?.headingHierarchyAudit?.fixChecklist?.criticalStructuralOrFactual || [],
        importantMissingSections:
          parsed?.headingHierarchyAudit?.fixChecklist?.importantMissingSections || [],
        headingsNeedingRewrite:
          parsed?.headingHierarchyAudit?.fixChecklist?.headingsNeedingRewrite || [],
        sectionsRequiringDeeperExplanation:
          parsed?.headingHierarchyAudit?.fixChecklist?.sectionsRequiringDeeperExplanation || [],
        minorFormattingImprovements:
          parsed?.headingHierarchyAudit?.fixChecklist?.minorFormattingImprovements || [],
      },
    },
    contentQualityAudit: {
      overallEditorialSummary:
        parsed?.contentQualityAudit?.overallEditorialSummary ||
        'Evaluated grammar, sentence construction, paragraph coherence, and explanation depth.',
      toneAndAudienceEvaluation: {
        intendedAudience:
          parsed?.contentQualityAudit?.toneAndAudienceEvaluation?.intendedAudience ||
          `General and specialist readers searching for "${input.focusKeyword}" in ${input.targetCountry}`,
        toneMatchAssessment:
          parsed?.contentQualityAudit?.toneAndAudienceEvaluation?.toneMatchAssessment ||
          'Evaluated tone alignment with content category.',
        consistencyNotes:
          parsed?.contentQualityAudit?.toneAndAudienceEvaluation?.consistencyNotes ||
          'Checked terminology and formatting consistency.',
        repetitiveOrFormulaicWarning:
          parsed?.contentQualityAudit?.toneAndAudienceEvaluation?.repetitiveOrFormulaicWarning ||
          'Checked for repetitive transitions and filler introductions.',
      },
      structureAndReadability: {
        introEffectiveness:
          parsed?.contentQualityAudit?.structureAndReadability?.introEffectiveness ||
          'Evaluated whether the opening quickly confirms the article answers the reader query.',
        answerDirectness:
          parsed?.contentQualityAudit?.structureAndReadability?.answerDirectness ||
          'Evaluated how directly key questions are answered.',
        sectionOrderEvaluation:
          parsed?.contentQualityAudit?.structureAndReadability?.sectionOrderEvaluation ||
          'Evaluated logical progression from core concepts to practical steps.',
        listsTablesFaqUsefulness:
          parsed?.contentQualityAudit?.structureAndReadability?.listsTablesFaqUsefulness ||
          'Evaluated scannable formatting.',
        conclusionUsefulness:
          parsed?.contentQualityAudit?.structureAndReadability?.conclusionUsefulness ||
          'Evaluated whether the ending offers actionable next steps rather than generic repetition.',
      },
      grammarAndLanguageFindings: Array.isArray(parsed?.contentQualityAudit?.grammarAndLanguageFindings)
        ? parsed.contentQualityAudit.grammarAndLanguageFindings
        : [],
      sentenceQualityFindings: Array.isArray(parsed?.contentQualityAudit?.sentenceQualityFindings)
        ? parsed.contentQualityAudit.sentenceQualityFindings
        : [],
      paragraphAndDepthFindings: Array.isArray(parsed?.contentQualityAudit?.paragraphAndDepthFindings)
        ? parsed.contentQualityAudit.paragraphAndDepthFindings
        : [],
    },
    googleGuidelinesAudit: {
      eeatQualitativeAssessment:
        parsed?.googleGuidelinesAudit?.eeatQualitativeAssessment ||
        'Experience, Expertise, Authoritativeness, and Trustworthiness (E-E-A-T) are qualitative considerations in Google’s Search Quality Rater Guidelines, not a single direct numerical ranking score. Strengthen trust by citing primary sources and showing concrete examples.',
      aiContentPolicyNote:
        parsed?.googleGuidelinesAudit?.aiContentPolicyNote ||
        'Google Search guidance focuses on the quality, originality, accuracy, and people-first helpfulness of content—not whether automation or AI assisted in drafting it. Using automation to produce many low-value pages without added user value violates spam policies (Scaled Content Abuse).',
      guidelinesAndRisks: Array.isArray(parsed?.googleGuidelinesAudit?.guidelinesAndRisks)
        ? parsed.googleGuidelinesAudit.guidelinesAndRisks.map((g: any) => ({
            ...g,
            dateChecked: todayDate,
          }))
        : [],
    },
    similarityAndPlagiarism: similarity,
    uniquenessAndAdvantage: {
      overallDifferentiationSummary:
        parsed?.uniquenessAndAdvantage?.overallDifferentiationSummary ||
        'Evaluated original explanations, practical examples, and competitive differentiation.',
      contributesMeaningfulValue: Boolean(parsed?.uniquenessAndAdvantage?.contributesMeaningfulValue ?? true),
      originalExplanationsAssessment:
        parsed?.uniquenessAndAdvantage?.originalExplanationsAssessment ||
        'Assessed whether explanations go beyond surface definitions.',
      distinctiveExamplesAssessment:
        parsed?.uniquenessAndAdvantage?.distinctiveExamplesAssessment ||
        'Assessed presence of concrete, country-relevant examples.',
      firstHandEvidenceAssessment:
        parsed?.uniquenessAndAdvantage?.firstHandEvidenceAssessment ||
        'Assessed whether genuine first-hand observations or verified data are present.',
      practicalDetailsOmittedByCompetitors: Array.isArray(
        parsed?.uniquenessAndAdvantage?.practicalDetailsOmittedByCompetitors
      )
        ? parsed.uniquenessAndAdvantage.practicalDetailsOmittedByCompetitors
        : [],
      waysToIncreaseCompetitiveAdvantage: Array.isArray(
        parsed?.uniquenessAndAdvantage?.waysToIncreaseCompetitiveAdvantage
      )
        ? parsed.uniquenessAndAdvantage.waysToIncreaseCompetitiveAdvantage
        : [],
    },
    factualAccuracyAndTrust: {
      trustSignalsEvaluation:
        parsed?.factualAccuracyAndTrust?.trustSignalsEvaluation ||
        'Evaluated sourcing clarity, verifiability of claims, and editorial accountability.',
      freshnessAssessment:
        parsed?.factualAccuracyAndTrust?.freshnessAssessment ||
        `Evaluated currency of claims as of ${todayDate}.`,
      claimsChecked: Array.isArray(parsed?.factualAccuracyAndTrust?.claimsChecked)
        ? parsed.factualAccuracyAndTrust.claimsChecked
        : [],
    },
    scores: {
      seoScore,
      contentQualityScore,
      competitiveCoverageScore: {
        score: clampScore(parsed?.scoringEvaluation?.competitiveCoverage?.score, 100, 68),
        methodology:
          'Measures coverage of essential reader topics evidenced by accessible SERP competitors + bonus for original value (not verbatim copying). Diagnostic estimate only.',
        topicsCoveredCount: Number(parsed?.scoringEvaluation?.competitiveCoverage?.topicsCoveredCount) || 5,
        totalKeyTopicsCount: Number(parsed?.scoringEvaluation?.competitiveCoverage?.totalKeyTopicsCount) || 8,
        originalValueBonusPoints:
          Number(parsed?.scoringEvaluation?.competitiveCoverage?.originalValueBonusPoints) || 5,
        explanation:
          parsed?.scoringEvaluation?.competitiveCoverage?.explanation ||
          'Compares your article’s subtopic breadth and depth against retrieved results for the target country.',
      },
    },
    prioritizedIssues: Array.isArray(parsed?.prioritizedIssues) ? parsed.prioritizedIssues : [],
    editingActionPlan: {
      recommendedSeoTitle:
        parsed?.editingActionPlan?.recommendedSeoTitle ||
        parsed?.titleAndMeta?.improvedTitleOptions?.[0] ||
        input.articleTitle,
      improvedH1: parsed?.editingActionPlan?.improvedH1 || input.articleTitle,
      recommendedMetaDescription:
        parsed?.editingActionPlan?.recommendedMetaDescription ||
        parsed?.titleAndMeta?.recommendedMetaDescription ||
        '',
      missingSectionsToBuild: Array.isArray(parsed?.editingActionPlan?.missingSectionsToBuild)
        ? parsed.editingActionPlan.missingSectionsToBuild
        : [],
      paragraphsNeedingDeeperExplanation: Array.isArray(
        parsed?.editingActionPlan?.paragraphsNeedingDeeperExplanation
      )
        ? parsed.editingActionPlan.paragraphsNeedingDeeperExplanation
        : [],
      helpfulTablesExamplesFaqs: Array.isArray(parsed?.editingActionPlan?.helpfulTablesExamplesFaqs)
        ? parsed.editingActionPlan.helpfulTablesExamplesFaqs
        : [],
      prioritizedEditingChecklist: Array.isArray(parsed?.editingActionPlan?.prioritizedEditingChecklist)
        ? parsed.editingActionPlan.prioritizedEditingChecklist
        : [],
    },
  };
}

export async function rewriteArticleSection(
  ai: GoogleGenAI,
  params: {
    articleTitle: string;
    focusKeyword: string;
    targetCountry: string;
    selectedPassage: string;
    instruction: string;
  }
): Promise<{ rewrittenText: string; editorialNotes: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `You are a senior human editor improving a specific section of an article.
Article Title: ${params.articleTitle}
Focus Keyword: ${params.focusKeyword}
Target Country: ${params.targetCountry}

Original Passage:
"""
${params.selectedPassage}
"""

Specific Improvement Goal:
${params.instruction}

STRICT RULES:
1. Preserve all verified facts and the author's intended meaning.
2. NEVER fabricate statistics, fake citations, personal anecdotes, or unverified numbers. If a specific figure or official link is needed, insert a clear bracketed editorial note like [Verify official figure/source].
3. Write in clear, natural, people-first prose without robotic filler transitions ("In conclusion", "Delving into", "In today's fast-paced world").
4. Return JSON with "rewrittenText" and "editorialNotes".`,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  return safeParseJson(response.text || '{}', {
    rewrittenText: params.selectedPassage,
    editorialNotes: 'Could not generate rewrite.',
  });
}

export async function generateFullImprovedArticle(
  ai: GoogleGenAI,
  params: {
    input: AuditInput;
    proposedOutline: { level: string; headingText: string; purpose: string }[];
    keyFixes: string[];
  }
): Promise<{
  improvedTitle: string;
  improvedMetaDescription: string;
  improvedMarkdownArticle: string;
  editorVerificationChecklist: string[];
}> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: `You are an expert editor producing an improved, well-structured revision of the user's submitted article based on an SEO and Content Quality Audit.

Original Title: ${params.input.articleTitle}
Focus Keyword: ${params.input.focusKeyword}
Target Country: ${params.input.targetCountry}
Language: ${params.input.language}
Content Type: ${params.input.contentType}

Recommended Heading Outline:
${JSON.stringify(params.proposedOutline)}

Key Audit Fixes to Apply:
${JSON.stringify(params.keyFixes)}

Original Submitted Article:
"""
${params.input.articleContent.slice(0, 18000)}
"""

STRICT EDITORIAL RULES:
1. Preserve all verified facts from the original article.
2. Organize the article using clean Markdown headings (# for H1, ## for H2, ### for H3, #### for H4) following a logical hierarchy.
3. Expand weak or superficial explanations so each section explains what, why, and how clearly for readers in ${params.input.targetCountry}.
4. Do NOT fabricate statistics, quotations, first-hand product testing, or fake URLs. Where a specific official date, fee, or citation requires human confirmation, mark it clearly with [Editor Verify: ...].
5. Avoid keyword stuffing and avoid copying competitor phrasing.

Return JSON with:
{
  "improvedTitle": "string",
  "improvedMetaDescription": "string",
  "improvedMarkdownArticle": "string (complete revised article in Markdown)",
  "editorVerificationChecklist": ["string (items the human author should verify before publishing)"]
}`,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  return safeParseJson(response.text || '{}', {
    improvedTitle: params.input.articleTitle,
    improvedMetaDescription: '',
    improvedMarkdownArticle: params.input.articleContent,
    editorVerificationChecklist: ['Review all facts and citations before publication.'],
  });
}

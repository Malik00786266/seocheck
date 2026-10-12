export interface AuditInput {
  articleTitle: string;
  focusKeyword: string;
  targetCountry: string;
  articleContent: string;
  articleUrl?: string;
  language: string;
  contentType: string;
}

export type StageId =
  | 'validating'
  | 'fetching_published_url'
  | 'serp_research'
  | 'fetching_competitors'
  | 'deterministic_audit'
  | 'similarity_analysis'
  | 'ai_deep_evaluation'
  | 'scoring_and_report';

export interface AnalysisStageEvent {
  stage: StageId;
  status: 'running' | 'completed' | 'skipped' | 'error';
  message: string;
  timestamp: string;
}

export interface ExtractedHeading {
  level: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
  text: string;
  sourceType: 'Verified HTML' | 'Markdown Syntax' | 'Inferred Formatting';
  sectionWordCount: number;
  sectionPreview: string;
}

export interface ExtractedLink {
  href: string;
  anchorText: string;
  isInternal: boolean;
  isGenericAnchor: boolean;
  isExactKeywordMatch: boolean;
  status?: string;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  filename: string;
  hasDescriptiveAlt: boolean;
}

export interface PublishedPageData {
  url: string;
  fetchedSuccessfully: boolean;
  statusCode?: number;
  errorReason?: string;
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  htmlLang?: string;
  headings: ExtractedHeading[];
  links: ExtractedLink[];
  images: ExtractedImage[];
  structuredDataTypes: string[];
  rawJsonLd: string[];
  wordCount: number;
}

export interface CompetitorPageData {
  position: number | null; // null if discovered via grounding without strict rank index
  positionSource: 'SERP Provider' | 'Google Search Grounding';
  url: string;
  domain: string;
  serpTitle: string;
  serpSnippet: string;
  researchTimestamp: string;
  fetchStatus: 'fetched' | 'blocked_robots' | 'blocked_http' | 'js_dependent_or_thin' | 'timeout_or_error';
  fetchNote: string;
  extractedTitle?: string;
  mainH1?: string;
  headings: { level: string; text: string }[];
  wordCount: number;
  listsCount: number;
  tablesCount: number;
  faqs: string[];
  metaDescription?: string;
  structuredDataTypes: string[];
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  textContent: string;
  // AI Comparative Analysis per competitor
  searchIntent?: string;
  apparentAudience?: string;
  mainTopics?: string[];
  entitiesAndConcepts?: string[];
  explanationDepth?: string;
  missingOrOutdatedInCompetitor?: string;
  elementsMissingInSubmittedArticle?: string[];
  strengthComparison?: string;
}

export interface KeywordPlacementResult {
  location: string;
  status: 'Present (Exact)' | 'Present (Variant)' | 'Not Found' | 'Not Applicable';
  exactCount: number;
  variantCount: number;
  notes: string;
}

export interface KeywordGroupItem {
  keywordOrTopic: string;
  category:
    | 'Primary Focus'
    | 'Secondary Keyword'
    | 'Long-Tail Keyword'
    | 'Close Variant / Synonym'
    | 'Semantically Related Term'
    | 'Entity / Named Concept'
    | 'Search-Intent Modifier'
    | 'Question-Based Keyword'
    | 'Country / Local Term'
    | 'Separate Article Candidate';
  searchIntent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational' | 'Mixed';
  relevanceReason: string;
  coverageStatus: 'Covered' | 'Partially Covered' | 'Missing' | 'Separate Article Recommended';
  suggestedPlacement: string;
  sourceUrl?: string;
}

export interface TopicalCoverageItem {
  topic: string;
  competitorEvidence: string;
  currentCoverage: 'Strong' | 'Partial' | 'Weak' | 'Missing';
  importance: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendedAction: string;
}

export interface HeadingAuditRow {
  existingHeading: string;
  currentLevel: string;
  levelVerification: 'Verified HTML' | 'Markdown Syntax' | 'Inferred Formatting' | 'Missing (Proposed)';
  recommendedLevel: 'H1' | 'H2' | 'H3' | 'H4' | 'Remove' | 'Merge';
  problemIdentified: string;
  reasonForRecommendation: string;
  requiredAction: 'Retain' | 'Rewrite' | 'Move' | 'Merge' | 'Split' | 'Remove' | 'Change Level' | 'Add New Section';
  suggestedImprovedHeading: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  parentHeading?: string;
  weakContentQuote?: string;
  contentImprovementDetail?: string;
}

export interface ProposedOutlineNode {
  level: 'H1' | 'H2' | 'H3' | 'H4';
  headingText: string;
  purpose: string;
  essentialPointsToExplain: string[];
  isNewAddition: boolean;
}

export interface GrammarAndLanguageFinding {
  originalExcerpt: string;
  issueType: 'Grammar' | 'Spelling' | 'Punctuation' | 'Awkward Phrasing' | 'Repetition' | 'Tense/Agreement' | 'Filler/Robotic';
  problemExplanation: string;
  correctedAlternative: string;
}

export interface SentenceQualityFinding {
  sentenceExcerpt: string;
  evaluationCategory: 'Clarity' | 'Conciseness' | 'Unsupported Claim' | 'Passive Voice' | 'Formulaic Transition' | 'Complexity Harming Understanding';
  explanation: string;
  suggestedImprovement: string;
}

export interface ParagraphQualityFinding {
  paragraphIdentifier: string;
  issue: string;
  explanationDepthAssessment: string;
  whatToAddAndWhy: string;
}

export interface SimilarityMatchItem {
  submittedPassage: string;
  competitorPassage: string;
  competitorTitle: string;
  competitorUrl: string;
  competitorPosition: number | null;
  matchCategory:
    | 'Exact / Near-Exact Sentence Match'
    | 'Distinctive Heading Match'
    | 'Generic Heading Similarity'
    | 'Closely Paraphrased Passage'
    | 'Repeated Distinctive Phrase'
    | 'Normal Topic Overlap';
  similarityScore: number; // 0-100 deterministic score
  methodUsed: string;
  concernExplanation: string;
  isConcerning: boolean;
  recommendedRewrite: string;
}

export interface SimilarityReport {
  estimatedSimilarityPercentage: number;
  competitorsSuccessfullyAnalyzed: number;
  competitorsUnavailableCount: number;
  articleTextComparedPercentage: number;
  comparisonMethod: string;
  disclaimerNote: string;
  sentenceMatches: SimilarityMatchItem[];
  headingMatches: SimilarityMatchItem[];
  semanticAndStructureNotes: string[];
}

export interface GoogleGuidelineItem {
  guidelineTitle: string;
  sourceClassification: 'Official Google Requirement' | 'Official Google Recommendation' | 'Third-Party SEO Best Practice' | 'Editorial Judgment';
  officialDocName: string;
  officialDocUrl: string;
  dateChecked: string;
  specificArticleIssue: string;
  whyItMatters: string;
  recommendedChange: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  confidence: 'High' | 'Medium' | 'Low';
}

export interface FactualClaimCheck {
  originalClaim: string;
  verificationStatus: 'Verified' | 'Contradicted' | 'Uncertain' | 'Verification Required';
  sourceUrl?: string;
  sourceDate?: string;
  suggestedCorrectionOrQualification: string;
}

export interface ScoreCategoryBreakdown {
  categoryName: string;
  maxPoints: number;
  earnedPoints: number | null; // null if Not Checked / Insufficient Data
  status: 'Assessed' | 'Not Checked' | 'Insufficient Data';
  reasonsForLostPoints: string[];
  evidenceSummary: string;
}

export interface TransparentScoreCard {
  normalizedScore: number; // 0-100
  rawEarnedPoints: number;
  rawMaxAssessedPoints: number;
  totalConfiguredPoints: number;
  methodologyNote: string;
  categories: ScoreCategoryBreakdown[];
}

export interface PrioritizedIssue {
  issueId: string;
  category: 'On-Page SEO' | 'Heading Structure' | 'Search Intent & Coverage' | 'Writing Quality' | 'Factual Accuracy' | 'Similarity & Originality' | 'Google Guidelines' | 'Technical & Links';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  exactLocation: string;
  evidence: string;
  problemExplanation: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedReplacement: string;
  sourceUrl?: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
}

export interface CompleteAuditReport {
  auditId: string;
  generatedAt: string;
  input: AuditInput;
  articleMetrics: {
    characterCount: number;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    readingTimeMinutes: number;
    detectedLanguage: string;
    headingCount: number;
    headingVerificationNote: string;
  };
  publishedPage?: PublishedPageData;
  serpResearch: {
    providerUsed: string;
    providerDisclosure: string;
    targetCountry: string;
    totalValidOrganicResults: number;
    page1Count: number;
    page2Count: number;
    accessibleCompetitorsCount: number;
    blockedOrUnavailableCount: number;
    dominantSearchIntent: string;
    secondarySearchIntents: string[];
    competitors: CompetitorPageData[];
    sharedCompetitorTopics: string[];
    competitorInformationGaps: string[];
  };
  onPageSeo: {
    titleAndMeta: {
      suppliedTitle: string;
      characterLength: number;
      approximatePixelWidth: number;
      googleRewriteWarning: string;
      matchesIntent: boolean;
      hasFocusKeyword: boolean;
      clarityAndSpecificityNote: string;
      clickbaitOrRepetitionWarning: string;
      titleH1Consistency: string;
      improvedTitleOptions: string[];
      recommendedMetaDescription: string;
    };
    keywordGrouping: KeywordGroupItem[];
    keywordPlacement: {
      exactOccurrences: number;
      variantOccurrences: number;
      approximateDensityPercent: number;
      overOptimizationWarning: string;
      naturalUsageRecommendation: string;
      placements: KeywordPlacementResult[];
    };
    topicalCoverageMatrix: TopicalCoverageItem[];
    linksAudit: {
      siteWideLimitationNote: string;
      extractedLinks: ExtractedLink[];
      unsupportedClaimsNeedingSources: string[];
      suggestedExternalSources: { title: string; url: string; reason: string }[];
    };
    mediaAudit: {
      inspectedImages: ExtractedImage[];
      mediaNote: string;
      recommendedVisualAdditions: string[];
    };
    technicalAudit: {
      isLiveUrlProvided: boolean;
      separationDisclosure: string;
      canonicalCheck: string;
      robotsAndIndexability: string;
      structuredDataStatus: string;
      recommendedSchemaTypes: string[];
      recommendedJsonLdSample?: string;
    };
  };
  headingHierarchyAudit: {
    summaryEvaluation: string;
    extractedHeadings: ExtractedHeading[];
    headingAuditTable: HeadingAuditRow[];
    proposedOutline: ProposedOutlineNode[];
    fixChecklist: {
      criticalStructuralOrFactual: string[];
      importantMissingSections: string[];
      headingsNeedingRewrite: string[];
      sectionsRequiringDeeperExplanation: string[];
      minorFormattingImprovements: string[];
    };
  };
  contentQualityAudit: {
    overallEditorialSummary: string;
    toneAndAudienceEvaluation: {
      intendedAudience: string;
      toneMatchAssessment: string;
      consistencyNotes: string;
      repetitiveOrFormulaicWarning: string;
    };
    structureAndReadability: {
      introEffectiveness: string;
      answerDirectness: string;
      sectionOrderEvaluation: string;
      listsTablesFaqUsefulness: string;
      conclusionUsefulness: string;
    };
    grammarAndLanguageFindings: GrammarAndLanguageFinding[];
    sentenceQualityFindings: SentenceQualityFinding[];
    paragraphAndDepthFindings: ParagraphQualityFinding[];
  };
  googleGuidelinesAudit: {
    eeatQualitativeAssessment: string;
    aiContentPolicyNote: string;
    guidelinesAndRisks: GoogleGuidelineItem[];
  };
  similarityAndPlagiarism: SimilarityReport;
  uniquenessAndAdvantage: {
    overallDifferentiationSummary: string;
    contributesMeaningfulValue: boolean;
    originalExplanationsAssessment: string;
    distinctiveExamplesAssessment: string;
    firstHandEvidenceAssessment: string;
    practicalDetailsOmittedByCompetitors: string[];
    waysToIncreaseCompetitiveAdvantage: string[];
  };
  factualAccuracyAndTrust: {
    trustSignalsEvaluation: string;
    freshnessAssessment: string;
    claimsChecked: FactualClaimCheck[];
  };
  scores: {
    seoScore: TransparentScoreCard;
    contentQualityScore: TransparentScoreCard;
    competitiveCoverageScore: {
      score: number;
      methodology: string;
      topicsCoveredCount: number;
      totalKeyTopicsCount: number;
      originalValueBonusPoints: number;
      explanation: string;
    };
  };
  prioritizedIssues: PrioritizedIssue[];
  editingActionPlan: {
    recommendedSeoTitle: string;
    improvedH1: string;
    recommendedMetaDescription: string;
    missingSectionsToBuild: string[];
    paragraphsNeedingDeeperExplanation: string[];
    helpfulTablesExamplesFaqs: string[];
    prioritizedEditingChecklist: string[];
  };
}

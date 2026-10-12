import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wand2,
  Loader2,
  FileCode,
  FileJson,
  Printer,
  Search,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { CompleteAuditReport } from '../types/audit.ts';

export type WorkspaceTab =
  | 'new-audit'
  | 'overview'
  | 'seo'
  | 'headings'
  | 'competitors'
  | 'quality'
  | 'similarity'
  | 'guidelines'
  | 'reports';

interface ReportViewsProps {
  report: CompleteAuditReport;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
}

export const ReportViews: React.FC<ReportViewsProps> = ({ report, activeTab, onSelectTab }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<string>('ALL');
  const [issueSearchQuery, setIssueSearchQuery] = useState<string>('');
  const [kwCategoryFilter, setKwCategoryFilter] = useState<string>('ALL');
  const [expandedCompetitorUrl, setExpandedCompetitorUrl] = useState<string | null>(
    report.serpResearch.competitors[0]?.url || null
  );

  // Interactive Section Rewriter state
  const [rewritePassage, setRewritePassage] = useState<string>(
    report.contentQualityAudit.grammarAndLanguageFindings[0]?.originalExcerpt ||
      report.input.articleContent.split(/\n\s*\n/)[0] ||
      ''
  );
  const [rewriteInstruction, setRewriteInstruction] = useState<string>(
    'Improve clarity, explanation depth, and natural flow while preserving verified facts and avoiding competitor phrasing.'
  );
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteOutput, setRewriteOutput] = useState<{
    rewrittenText: string;
    editorialNotes: string;
  } | null>(null);

  // Full Improved Article Generator state
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<{
    improvedTitle: string;
    improvedMetaDescription: string;
    improvedMarkdownArticle: string;
    editorVerificationChecklist: string[];
  } | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openInRewriter = (passage: string, instruction: string) => {
    setRewritePassage(passage);
    setRewriteInstruction(instruction);
    onSelectTab('reports');
  };

  const handleRunSectionRewrite = async () => {
    if (!rewritePassage.trim()) return;
    setIsRewriting(true);
    try {
      const res = await fetch('/api/rewrite-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleTitle: report.input.articleTitle,
          focusKeyword: report.input.focusKeyword,
          targetCountry: report.input.targetCountry,
          selectedPassage: rewritePassage,
          instruction: rewriteInstruction,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRewriteOutput(data);
      }
    } catch {
      // handled silently
    } finally {
      setIsRewriting(false);
    }
  };

  const handleGenerateFullArticle = async () => {
    setIsGeneratingArticle(true);
    try {
      const res = await fetch('/api/generate-improved-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: report.input,
          proposedOutline: report.headingHierarchyAudit.proposedOutline,
          keyFixes: report.prioritizedIssues.slice(0, 8).map((i) => `${i.exactLocation}: ${i.recommendedAction}`),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedArticle(data);
      }
    } catch {
      // ignore
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-audit-${report.auditId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>SEO Audit Report — ${report.input.articleTitle}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 980px; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.6; }
  h1, h2, h3 { color: #0f172a; }
  .scores { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
</style>
</head>
<body>
  <h1>SEO Article Intelligence — Complete Audit Report</h1>
  <p><strong>Article Title:</strong> ${report.input.articleTitle}<br/>
  <strong>Focus Keyword:</strong> ${report.input.focusKeyword} · <strong>Target Country:</strong> ${report.input.targetCountry} · <strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
  <div class="scores">
    <div class="card"><strong>On-Page SEO Score</strong><br/><span style="font-size:24px;font-weight:bold">${report.scores.seoScore.normalizedScore}/100</span></div>
    <div class="card"><strong>Content Quality Score</strong><br/><span style="font-size:24px;font-weight:bold">${report.scores.contentQualityScore.normalizedScore}/100</span></div>
    <div class="card"><strong>Competitive Coverage</strong><br/><span style="font-size:24px;font-weight:bold">${report.scores.competitiveCoverageScore.score}/100</span></div>
    <div class="card"><strong>Estimated Similarity</strong><br/><span style="font-size:24px;font-weight:bold">${report.similarityAndPlagiarism.estimatedSimilarityPercentage}%</span> (${report.similarityAndPlagiarism.competitorsSuccessfullyAnalyzed} sources)</div>
  </div>
  <h2>Prioritized Issues & Recommendations</h2>
  <table>
    <thead><tr><th>ID</th><th>Severity</th><th>Category</th><th>Location</th><th>Issue & Explanation</th><th>Recommended Fix</th></tr></thead>
    <tbody>
      ${report.prioritizedIssues
        .map(
          (i) =>
            `<tr><td>${i.issueId}</td><td>${i.severity}</td><td>${i.category}</td><td>${i.exactLocation}</td><td>${i.problemExplanation}</td><td>${i.recommendedAction}<br/><em>Suggested: ${i.suggestedReplacement}</em></td></tr>`
        )
        .join('')}
    </tbody>
  </table>
  <h2>Heading Hierarchy Audit Table</h2>
  <table>
    <thead><tr><th>Existing Heading</th><th>Current</th><th>Recommended</th><th>Action</th><th>Problem & Reason</th><th>Suggested Heading</th></tr></thead>
    <tbody>
      ${report.headingHierarchyAudit.headingAuditTable
        .map(
          (h) =>
            `<tr><td>${h.existingHeading}</td><td>${h.currentLevel}</td><td>${h.recommendedLevel}</td><td>${h.requiredAction}</td><td>${h.problemIdentified} — ${h.reasonForRecommendation}</td><td>${h.suggestedImprovedHeading}</td></tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-audit-${report.auditId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreToneClass = (score: number) => {
    if (score >= 80) return 'text-emerald-700';
    if (score >= 60) return 'text-amber-700';
    return 'text-red-700';
  };

  const severityTextClass = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'text-red-700 font-semibold';
      case 'High':
        return 'text-amber-700 font-semibold';
      case 'Medium':
        return 'text-blue-700 font-medium';
      default:
        return 'text-slate-600 font-medium';
    }
  };

  const filteredIssues = report.prioritizedIssues.filter((iss) => {
    if (issueSeverityFilter !== 'ALL' && iss.severity !== issueSeverityFilter) return false;
    if (issueSearchQuery.trim()) {
      const q = issueSearchQuery.toLowerCase();
      return (
        iss.problemExplanation.toLowerCase().includes(q) ||
        iss.exactLocation.toLowerCase().includes(q) ||
        iss.category.toLowerCase().includes(q) ||
        iss.recommendedAction.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredKeywords = report.onPageSeo.keywordGrouping.filter((k) =>
    kwCategoryFilter === 'ALL' ? true : k.category === kwCategoryFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Report Context Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Focus Keyword: <strong className="text-slate-900">{report.input.focusKeyword}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Market: <strong className="text-slate-900">{report.input.targetCountry}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Language: <strong className="text-slate-900">{report.articleMetrics.detectedLanguage}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{report.articleMetrics.wordCount.toLocaleString()} words</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{report.articleMetrics.headingCount} headings</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {report.input.articleTitle}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-600" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleExportHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            Download HTML Report
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: OVERVIEW
      ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Main Diagnostic Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  On-Page SEO Score (Diagnostic)
                </div>
                <div className={`mt-2 text-3xl font-bold font-mono tabular-nums ${scoreToneClass(report.scores.seoScore.normalizedScore)}`}>
                  {report.scores.seoScore.normalizedScore}
                  <span className="text-base font-normal text-slate-400"> / 100</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {report.scores.seoScore.rawEarnedPoints}/{report.scores.seoScore.rawMaxAssessedPoints} points earned across assessed categories.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('seo')}
                className="mt-4 text-xs font-semibold text-blue-600 hover:underline text-left cursor-pointer"
              >
                Inspect On-Page SEO Audit →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Content Quality Score
                </div>
                <div className={`mt-2 text-3xl font-bold font-mono tabular-nums ${scoreToneClass(report.scores.contentQualityScore.normalizedScore)}`}>
                  {report.scores.contentQualityScore.normalizedScore}
                  <span className="text-base font-normal text-slate-400"> / 100</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Evaluates grammar, clarity, explanation depth, structure, and reader usefulness.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('quality')}
                className="mt-4 text-xs font-semibold text-blue-600 hover:underline text-left cursor-pointer"
              >
                Inspect Writing Quality →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Competitive Coverage Score
                </div>
                <div className={`mt-2 text-3xl font-bold font-mono tabular-nums ${scoreToneClass(report.scores.competitiveCoverageScore.score)}`}>
                  {report.scores.competitiveCoverageScore.score}
                  <span className="text-base font-normal text-slate-400"> / 100</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Covers {report.scores.competitiveCoverageScore.topicsCoveredCount} of {report.scores.competitiveCoverageScore.totalKeyTopicsCount} core SERP topics (+{report.scores.competitiveCoverageScore.originalValueBonusPoints} originality pts).
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('competitors')}
                className="mt-4 text-xs font-semibold text-blue-600 hover:underline text-left cursor-pointer"
              >
                Inspect SERP Competitors →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Estimated Similarity (Available Sources)
                </div>
                <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
                  {report.similarityAndPlagiarism.competitorsSuccessfullyAnalyzed > 0
                    ? `${report.similarityAndPlagiarism.estimatedSimilarityPercentage}%`
                    : 'N/A'}
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Compared against {report.similarityAndPlagiarism.competitorsSuccessfullyAnalyzed} retrieved competitor page(s). Not a global scan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('similarity')}
                className="mt-4 text-xs font-semibold text-blue-600 hover:underline text-left cursor-pointer"
              >
                Inspect Passage Comparisons →
              </button>
            </div>
          </div>

          {/* Transparent Score Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SEO Score Rubric Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Transparent SEO Score Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {report.scores.seoScore.methodologyNote}
                </p>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Points</th>
                      <th className="py-2.5 px-3 font-semibold">Evidence &amp; Lost Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.scores.seoScore.categories.map((cat) => (
                      <tr key={cat.categoryName} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {cat.categoryName}
                          <div className="text-[11px] text-slate-500 font-normal">
                            Status: {cat.status}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap">
                          {cat.earnedPoints !== null ? `${cat.earnedPoints} / ${cat.maxPoints}` : `— / ${cat.maxPoints}`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 space-y-1">
                          <div>{cat.evidenceSummary}</div>
                          {cat.reasonsForLostPoints.length > 0 && (
                            <ul className="list-disc pl-4 text-slate-500">
                              {cat.reasonsForLostPoints.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Content Quality Score Rubric Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Content Quality Score Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {report.scores.contentQualityScore.methodologyNote}
                </p>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-semibold">Dimension</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Points</th>
                      <th className="py-2.5 px-3 font-semibold">Editorial Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.scores.contentQualityScore.categories.map((cat) => (
                      <tr key={cat.categoryName} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {cat.categoryName}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right whitespace-nowrap">
                          {cat.earnedPoints} / {cat.maxPoints}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 space-y-1">
                          <div>{cat.evidenceSummary}</div>
                          {cat.reasonsForLostPoints.length > 0 && (
                            <ul className="list-disc pl-4 text-slate-500">
                              {cat.reasonsForLostPoints.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Top 5 Highest-Priority Findings */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Five Most Important Findings Requiring Action
                </h2>
                <p className="text-xs text-slate-500">
                  Prioritized by impact on factual accuracy, search intent satisfaction, and heading structure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('reports')}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                View All {report.prioritizedIssues.length} Issues →
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Severity</th>
                    <th className="py-2.5 px-3 font-semibold">Category &amp; Location</th>
                    <th className="py-2.5 px-3 font-semibold">Problem &amp; Evidence</th>
                    <th className="py-2.5 px-3 font-semibold">Recommended Action &amp; Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.prioritizedIssues.slice(0, 5).map((issue) => (
                    <tr key={issue.issueId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={severityTextClass(issue.severity)}>{issue.severity}</span>
                        <div className="text-[11px] font-mono text-slate-400">{issue.issueId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{issue.category}</div>
                        <div className="text-slate-500 mt-0.5">{issue.exactLocation}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p className="font-medium text-slate-900">{issue.problemExplanation}</p>
                        <p className="text-slate-500">Evidence: {issue.evidence}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1.5">
                        <p>{issue.recommendedAction}</p>
                        {issue.suggestedReplacement && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 flex items-start justify-between gap-2">
                            <span>{issue.suggestedReplacement}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(issue.suggestedReplacement, issue.issueId)}
                              className="text-slate-500 hover:text-blue-600 shrink-0 cursor-pointer"
                              title="Copy suggested text"
                            >
                              {copiedId === issue.issueId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: ON-PAGE SEO ANALYSIS
      ===================================================================== */}
      {activeTab === 'seo' && (
        <div className="space-y-6">
          {/* A. Title & Metadata Audit */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900">
                A. Title &amp; Metadata Evaluation
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates intent alignment, natural keyword usage, approximate SERP pixel width, and title-to-H1 consistency.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-slate-500">Length &amp; Pixel Estimate</span>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                  {report.onPageSeo.titleAndMeta.characterLength} chars · ~{report.onPageSeo.titleAndMeta.approximatePixelWidth}px
                </div>
                <p className="text-slate-600">{report.onPageSeo.titleAndMeta.googleRewriteWarning}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-slate-500">Clarity &amp; Specificity</span>
                <div className="text-sm font-bold text-slate-900">
                  {report.onPageSeo.titleAndMeta.hasFocusKeyword ? 'Focus Keyword Present' : 'Focus Keyword Missing'}
                </div>
                <p className="text-slate-600">{report.onPageSeo.titleAndMeta.clarityAndSpecificityNote}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-slate-500">Title &amp; H1 Consistency</span>
                <div className="text-sm font-bold text-slate-900">
                  {report.onPageSeo.titleAndMeta.matchesIntent ? 'Matches Query Intent' : 'Intent Mismatch Risk'}
                </div>
                <p className="text-slate-600">{report.onPageSeo.titleAndMeta.titleH1Consistency}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-800">
                  Three Improved Natural Title Options
                </h3>
                {report.onPageSeo.titleAndMeta.improvedTitleOptions.map((opt, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-mono text-slate-400 mr-2">0{i + 1}.</span>
                      <span className="font-medium text-slate-900">{opt}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">
                        ({opt.length} chars)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(opt, `title-opt-${i}`)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 shrink-0 cursor-pointer"
                    >
                      {copiedId === `title-opt-${i}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-800">
                  Recommended Meta Description
                </h3>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
                  <p className="text-slate-800 leading-relaxed">
                    {report.onPageSeo.titleAndMeta.recommendedMetaDescription}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-500">
                    <span className="font-mono tabular-nums">
                      {report.onPageSeo.titleAndMeta.recommendedMetaDescription.length} characters
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(report.onPageSeo.titleAndMeta.recommendedMetaDescription, 'meta-desc')
                      }
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      {copiedId === 'meta-desc' ? 'Copied' : 'Copy Description'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* B. Keyword Placement & Over-Optimization Check */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  B. Keyword Placement &amp; Over-Optimization Check
                </h2>
                <p className="text-xs text-slate-500">
                  Descriptive occurrences across structural elements. Note: Google does not use a universal keyword density requirement.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-700">
                <span>Exact Matches: <strong>{report.onPageSeo.keywordPlacement.exactOccurrences}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Close Variants: <strong>{report.onPageSeo.keywordPlacement.variantOccurrences}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Approx. Density: <strong>{report.onPageSeo.keywordPlacement.approximateDensityPercent}%</strong></span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
              <p><strong>Over-Optimization Assessment:</strong> {report.onPageSeo.keywordPlacement.overOptimizationWarning}</p>
              <p><strong>Editorial Guidance:</strong> {report.onPageSeo.keywordPlacement.naturalUsageRecommendation}</p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Element Location</th>
                    <th className="py-2.5 px-3 font-semibold">Detection Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Exact</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Variants</th>
                    <th className="py-2.5 px-3 font-semibold">Diagnostic Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.onPageSeo.keywordPlacement.placements.map((pl) => (
                    <tr key={pl.location} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{pl.location}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={
                            pl.status.startsWith('Present')
                              ? 'text-emerald-700 font-semibold'
                              : pl.status === 'Not Applicable'
                              ? 'text-slate-400'
                              : 'text-amber-700 font-medium'
                          }
                        >
                          {pl.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">{pl.exactCount}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">{pl.variantCount}</td>
                      <td className="py-2.5 px-3 text-slate-600">{pl.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* C. Keyword Research & Semantic Grouping */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  C. Semantic Keyword Grouping, Entities &amp; Subtopics
                </h2>
                <p className="text-xs text-slate-500">
                  Focuses on semantic completeness, named entities, intent modifiers, and country-relevant terminology (no fabricated search volumes).
                </p>
              </div>
              <select
                value={kwCategoryFilter}
                onChange={(e) => setKwCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">All Keyword Categories ({report.onPageSeo.keywordGrouping.length})</option>
                <option value="Primary Focus">Primary Focus</option>
                <option value="Secondary Keyword">Secondary Keyword</option>
                <option value="Long-Tail Keyword">Long-Tail Keyword</option>
                <option value="Entity / Named Concept">Entity / Named Concept</option>
                <option value="Question-Based Keyword">Question-Based Keyword</option>
                <option value="Country / Local Term">Country / Local Term</option>
                <option value="Separate Article Candidate">Separate Article Candidate</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Keyword / Entity / Topic</th>
                    <th className="py-2.5 px-3 font-semibold">Category &amp; Intent</th>
                    <th className="py-2.5 px-3 font-semibold">Article Coverage</th>
                    <th className="py-2.5 px-3 font-semibold">Evidence &amp; Suggested Placement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredKeywords.map((kw, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{kw.keywordOrTopic}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{kw.category}</div>
                        <div className="text-[11px] text-slate-400">Intent: {kw.searchIntent}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={
                            kw.coverageStatus === 'Covered'
                              ? 'text-emerald-700 font-semibold'
                              : kw.coverageStatus === 'Partially Covered'
                              ? 'text-amber-700 font-semibold'
                              : kw.coverageStatus === 'Separate Article Recommended'
                              ? 'text-purple-700 font-medium'
                              : 'text-red-700 font-semibold'
                          }
                        >
                          {kw.coverageStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 space-y-1">
                        <div>{kw.relevanceReason}</div>
                        <div className="text-slate-800">
                          <strong>Placement:</strong> {kw.suggestedPlacement}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* D. Search Intent & Topical Coverage Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                D. Search Intent &amp; Topical Coverage Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Dominant SERP Intent: <strong className="text-slate-800">{report.serpResearch.dominantSearchIntent}</strong>
              </p>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Required Topic / Subtopic</th>
                    <th className="py-2.5 px-3 font-semibold">Competitor / SERP Evidence</th>
                    <th className="py-2.5 px-3 font-semibold">Current Coverage</th>
                    <th className="py-2.5 px-3 font-semibold">Importance</th>
                    <th className="py-2.5 px-3 font-semibold">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.onPageSeo.topicalCoverageMatrix.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.topic}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.competitorEvidence}</td>
                      <td className="py-2.5 px-3 font-medium">
                        <span
                          className={
                            item.currentCoverage === 'Strong'
                              ? 'text-emerald-700'
                              : item.currentCoverage === 'Partial'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }
                        >
                          {item.currentCoverage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={severityTextClass(item.importance)}>{item.importance}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{item.recommendedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* E. Links, Media & Technical Checks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                E. Internal &amp; External Links Audit
              </h2>
              <p className="text-xs text-slate-500">{report.onPageSeo.linksAudit.siteWideLimitationNote}</p>

              {report.onPageSeo.linksAudit.extractedLinks.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <th className="py-2 px-3 font-semibold">Anchor Text</th>
                        <th className="py-2 px-3 font-semibold">URL</th>
                        <th className="py-2 px-3 font-semibold">Diagnostics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.onPageSeo.linksAudit.extractedLinks.map((lnk, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium text-slate-900">{lnk.anchorText}</td>
                          <td className="py-2 px-3 text-slate-500 truncate max-w-[180px]">{lnk.href}</td>
                          <td className="py-2 px-3">
                            {lnk.isGenericAnchor ? (
                              <span className="text-red-700 font-medium">Generic anchor (&ldquo;{lnk.anchorText}&rdquo;)</span>
                            ) : (
                              <span className="text-emerald-700">Descriptive anchor</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Zero links were detected in the submitted article. Adding authoritative external citations for key facts improves reader trust.
                </div>
              )}

              {report.onPageSeo.linksAudit.suggestedExternalSources.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-800">
                    Recommended Authoritative Sources to Cite
                  </h3>
                  <ul className="space-y-2 text-xs">
                    {report.onPageSeo.linksAudit.suggestedExternalSources.map((src, i) => (
                      <li key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {src.title}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <p className="text-slate-600 mt-0.5">{src.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                F. Technical, Media &amp; Structured Data Checks
              </h2>
              <p className="text-xs text-slate-500">{report.onPageSeo.technicalAudit.separationDisclosure}</p>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <strong>Canonical URL Status:</strong> {report.onPageSeo.technicalAudit.canonicalCheck}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <strong>Meta Robots &amp; Indexability:</strong> {report.onPageSeo.technicalAudit.robotsAndIndexability}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <strong>Structured Data (JSON-LD):</strong> {report.onPageSeo.technicalAudit.structuredDataStatus}
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <strong>Recommended Schema Types:</strong>{' '}
                  {report.onPageSeo.technicalAudit.recommendedSchemaTypes.join(', ')}
                </div>
              </div>

              {report.onPageSeo.mediaAudit.recommendedVisualAdditions.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-800">
                    Recommended Diagrams, Tables &amp; Visuals to Add
                  </h3>
                  <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                    {report.onPageSeo.mediaAudit.recommendedVisualAdditions.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: HEADING HIERARCHY & CONTENT WEAKNESS MODULE (SECTION 16)
      ===================================================================== */}
      {activeTab === 'headings' && (
        <div className="space-y-6">
          {/* Summary & Verification Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Heading Structure, Content Gaps &amp; Heading-Level Recommendation Module
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {report.articleMetrics.headingCount} existing heading(s) inspected
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {report.headingHierarchyAudit.summaryEvaluation}
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <strong>Heading Tag Verification Note:</strong> {report.articleMetrics.headingVerificationNote}{' '}
              Note: Google does not enforce a fixed formula of H2/H3 counts or penalize pages automatically for multiple H1s; recommendations prioritize semantic hierarchy, accessibility, and reader comprehension.
            </div>
          </div>

          {/* F. Final Heading Audit Table (Includes Existing + Missing Proposed Sections) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Complete Heading Audit &amp; Section Weakness Table
              </h3>
              <p className="text-xs text-slate-500">
                Inspects every existing heading for level accuracy and content depth beneath it, plus high-value missing sections.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Existing Heading</th>
                    <th className="py-2.5 px-3 font-semibold">Current → Rec. Level</th>
                    <th className="py-2.5 px-3 font-semibold">Action &amp; Priority</th>
                    <th className="py-2.5 px-3 font-semibold">Problem &amp; Section Content Weakness</th>
                    <th className="py-2.5 px-3 font-semibold">Suggested Improved Heading &amp; What to Add</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.headingHierarchyAudit.headingAuditTable.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {row.existingHeading}
                        {row.parentHeading && (
                          <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                            Parent: {row.parentHeading}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <span className="text-slate-600">{row.currentLevel}</span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <strong className="text-blue-700">{row.recommendedLevel}</strong>
                        <div className="text-[10px] font-sans text-slate-400 mt-0.5">
                          {row.levelVerification}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.requiredAction}</div>
                        <div className={severityTextClass(row.priority)}>{row.priority} Priority</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p className="font-medium text-slate-900">{row.problemIdentified}</p>
                        <p className="text-slate-600">{row.reasonForRecommendation}</p>
                        {row.weakContentQuote && (
                          <p className="text-slate-500 italic">
                            &ldquo;{row.weakContentQuote}&rdquo;
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1.5">
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900 flex items-center justify-between gap-2">
                          <span>{row.suggestedImprovedHeading}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(row.suggestedImprovedHeading, `hd-${idx}`)}
                            className="text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                          >
                            {copiedId === `hd-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {row.contentImprovementDetail && (
                          <p className="text-slate-600">{row.contentImprovementDetail}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* E. Corrected Heading Outline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Proposed Article Outline in Correct H1–H4 Hierarchy
                </h3>
                <p className="text-xs text-slate-500">
                  Logical semantic outline preserving strong existing headings and slotting in missing reader-critical subtopics.
                </p>
              </div>

              <div className="space-y-3">
                {report.headingHierarchyAudit.proposedOutline.map((node, i) => {
                  const indentClass =
                    node.level === 'H1'
                      ? 'ml-0 bg-slate-900 text-white'
                      : node.level === 'H2'
                      ? 'ml-4 bg-slate-50 border border-slate-200 text-slate-900'
                      : node.level === 'H3'
                      ? 'ml-9 bg-white border border-slate-200 text-slate-800'
                      : 'ml-14 bg-white border border-dashed border-slate-300 text-slate-700';

                  return (
                    <div key={i} className={`p-3.5 rounded-lg text-xs ${indentClass}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">
                          <span className="font-mono mr-2">{node.level}:</span>
                          <span>{node.headingText}</span>
                        </div>
                        {node.isNewAddition && (
                          <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            Recommended Addition
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 ${node.level === 'H1' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {node.purpose}
                      </p>
                      {node.essentialPointsToExplain?.length > 0 && (
                        <ul className={`list-disc pl-4 mt-1.5 space-y-0.5 ${node.level === 'H1' ? 'text-slate-300' : 'text-slate-500'}`}>
                          {node.essentialPointsToExplain.map((pt, j) => (
                            <li key={j}>{pt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* G. Heading and Content Fix Checklist */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Prioritized Heading &amp; Content Fix Checklist
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-red-700 mb-1.5">
                    1. Critical Structural or Factual Problems
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {report.headingHierarchyAudit.fixChecklist.criticalStructuralOrFactual.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-amber-700 mb-1.5">
                    2. Important Missing Sections
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {report.headingHierarchyAudit.fixChecklist.importantMissingSections.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-blue-700 mb-1.5">
                    3. Headings That Need Rewriting or Restructuring
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {report.headingHierarchyAudit.fixChecklist.headingsNeedingRewrite.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900 mb-1.5">
                    4. Sections Requiring Deeper Explanations
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {report.headingHierarchyAudit.fixChecklist.sectionsRequiringDeeperExplanation.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-600 mb-1.5">
                    5. Minor Formatting &amp; Readability Improvements
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    {report.headingHierarchyAudit.fixChecklist.minorFormattingImprovements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: SERP COMPETITORS
      ===================================================================== */}
      {activeTab === 'competitors' && (
        <div className="space-y-6">
          {/* Provider & Country Disclosure */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Real Google SERP Research &amp; Competitor Landscape ({report.serpResearch.targetCountry})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Source Provider: <strong className="text-slate-800">{report.serpResearch.providerUsed}</strong>
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-700">
                <span>Discovered: <strong>{report.serpResearch.totalValidOrganicResults}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Full-Text Fetched: <strong className="text-emerald-700">{report.serpResearch.accessibleCompetitorsCount}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Blocked/Gated: <strong className="text-amber-700">{report.serpResearch.blockedOrUnavailableCount}</strong></span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 border border-slate-200 rounded-lg">
              {report.serpResearch.providerDisclosure}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">Shared Topics Across Retrieved Competitors</h3>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {report.serpResearch.sharedCompetitorTopics.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">Information Gaps &amp; Opportunities in Current SERP</h3>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {report.serpResearch.competitorInformationGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Individual Competitor Cards */}
          <div className="space-y-3">
            {report.serpResearch.competitors.map((comp, idx) => {
              const isExpanded = expandedCompetitorUrl === comp.url;
              return (
                <div key={comp.url + idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedCompetitorUrl(isExpanded ? null : comp.url)}
                    className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">
                          {comp.position !== null ? `#${comp.position}` : `Result ${idx + 1} (Grounded)`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-blue-600">{comp.domain}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            comp.fetchStatus === 'fetched'
                              ? 'text-emerald-700 font-medium'
                              : 'text-amber-700 font-medium'
                          }
                        >
                          {comp.fetchStatus === 'fetched'
                            ? `Fetched (${comp.wordCount.toLocaleString()} words, ${comp.headings.length} headings)`
                            : comp.fetchNote}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {comp.extractedTitle || comp.serpTitle}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Open URL
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-200 space-y-4 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono tabular-nums">
                        <div>
                          <span className="text-slate-500 block font-sans">Word Count</span>
                          <strong className="text-slate-900">{comp.wordCount}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">Headings / Lists / Tables</span>
                          <strong className="text-slate-900">
                            {comp.headings.length}H · {comp.listsCount}L · {comp.tablesCount}T
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">Links (Int / Ext)</span>
                          <strong className="text-slate-900">
                            {comp.internalLinksCount} / {comp.externalLinksCount}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">Schema Types</span>
                          <strong className="text-slate-900 font-sans">
                            {comp.structuredDataTypes.join(', ') || 'None detected'}
                          </strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <strong className="text-slate-900">Search Intent &amp; Audience: </strong>
                            <span className="text-slate-600">
                              {comp.searchIntent} — {comp.apparentAudience}
                            </span>
                          </div>
                          <div>
                            <strong className="text-slate-900">Explanation Depth &amp; Evidence: </strong>
                            <span className="text-slate-600">{comp.explanationDepth}</span>
                          </div>
                          <div>
                            <strong className="text-slate-900">Comparison with Your Article: </strong>
                            <span className="text-slate-600">{comp.strengthComparison}</span>
                          </div>
                          {comp.elementsMissingInSubmittedArticle &&
                            comp.elementsMissingInSubmittedArticle.length > 0 && (
                              <div>
                                <strong className="text-slate-900">Useful Elements Missing in Your Draft:</strong>
                                <ul className="list-disc pl-4 mt-1 text-slate-600 space-y-0.5">
                                  {comp.elementsMissingInSubmittedArticle.map((el, i) => (
                                    <li key={i}>{el}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>

                        <div className="space-y-2">
                          <strong className="text-slate-900 block">
                            Extracted Competitor Heading Structure:
                          </strong>
                          {comp.headings.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
                              {comp.headings.map((h, i) => (
                                <div key={i} className="text-slate-700">
                                  <span className="font-mono text-slate-400 mr-1.5">{h.level}:</span>
                                  <span>{h.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500 italic">
                              No accessible headings extracted ({comp.fetchNote}).
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: CONTENT WRITING QUALITY & FACTUAL ACCURACY AUDIT
      ===================================================================== */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          {/* Editorial Summary, Tone & Structure */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Complete Content Writing Quality Audit
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {report.contentQualityAudit.overallEditorialSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">Tone, Consistency &amp; Audience</h3>
                <p><strong>Intended Audience:</strong> {report.contentQualityAudit.toneAndAudienceEvaluation.intendedAudience}</p>
                <p><strong>Tone Match:</strong> {report.contentQualityAudit.toneAndAudienceEvaluation.toneMatchAssessment}</p>
                <p><strong>Consistency:</strong> {report.contentQualityAudit.toneAndAudienceEvaluation.consistencyNotes}</p>
                <p><strong>Formulaic / Repetition Check:</strong> {report.contentQualityAudit.toneAndAudienceEvaluation.repetitiveOrFormulaicWarning}</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">Structure &amp; Readability</h3>
                <p><strong>Introduction:</strong> {report.contentQualityAudit.structureAndReadability.introEffectiveness}</p>
                <p><strong>Directness of Answer:</strong> {report.contentQualityAudit.structureAndReadability.answerDirectness}</p>
                <p><strong>Section Progression:</strong> {report.contentQualityAudit.structureAndReadability.sectionOrderEvaluation}</p>
                <p><strong>Conclusion Usefulness:</strong> {report.contentQualityAudit.structureAndReadability.conclusionUsefulness}</p>
              </div>
            </div>
          </div>

          {/* A. Grammar & Language Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              A. Grammar, Punctuation, Word Choice &amp; Filler Diagnostics
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Issue Type</th>
                    <th className="py-2.5 px-3 font-semibold">Original Sentence / Excerpt</th>
                    <th className="py-2.5 px-3 font-semibold">Why It Weakens the Writing</th>
                    <th className="py-2.5 px-3 font-semibold">Corrected Alternative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.contentQualityAudit.grammarAndLanguageFindings.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-semibold text-amber-800 whitespace-nowrap">
                        {item.issueType}
                      </td>
                      <td className="py-3 px-3 text-slate-700 italic">&ldquo;{item.originalExcerpt}&rdquo;</td>
                      <td className="py-3 px-3 text-slate-600">{item.problemExplanation}</td>
                      <td className="py-3 px-3">
                        <div className="p-2 bg-emerald-50/60 border border-emerald-200 rounded text-slate-900 flex items-start justify-between gap-2">
                          <span>{item.correctedAlternative}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.correctedAlternative, `gram-${i}`)}
                            className="text-slate-500 hover:text-blue-600 shrink-0 cursor-pointer"
                          >
                            {copiedId === `gram-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* B & C. Sentence-Level & Paragraph Explanation Depth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                B. Sentence-Level Clarity &amp; Flow
              </h3>
              <div className="space-y-3 text-xs">
                {report.contentQualityAudit.sentenceQualityFindings.map((sf, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="font-semibold text-blue-700">{sf.evaluationCategory}</div>
                    <p className="italic text-slate-700">&ldquo;{sf.sentenceExcerpt}&rdquo;</p>
                    <p className="text-slate-600">{sf.explanation}</p>
                    <p className="text-slate-900"><strong>Suggested Fix:</strong> {sf.suggestedImprovement}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                C. Paragraph Quality &amp; Explanation Depth
              </h3>
              <div className="space-y-3 text-xs">
                {report.contentQualityAudit.paragraphAndDepthFindings.map((pf, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <div className="font-semibold text-slate-900">{pf.paragraphIdentifier}</div>
                    <p className="text-amber-800 font-medium">{pf.issue}</p>
                    <p className="text-slate-600">{pf.explanationDepthAssessment}</p>
                    <p className="text-slate-900"><strong>What to Add &amp; Why:</strong> {pf.whatToAddAndWhy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Factual Accuracy, Trust & Content Freshness */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Factual Accuracy, Trust &amp; Content Freshness Verification
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {report.factualAccuracyAndTrust.trustSignalsEvaluation} · {report.factualAccuracyAndTrust.freshnessAssessment}
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Original Claim in Article</th>
                    <th className="py-2.5 px-3 font-semibold">Verification Status</th>
                    <th className="py-2.5 px-3 font-semibold">Suggested Correction / Qualification &amp; Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.factualAccuracyAndTrust.claimsChecked.map((cl, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 text-slate-800">&ldquo;{cl.originalClaim}&rdquo;</td>
                      <td className="py-3 px-3 whitespace-nowrap font-semibold">
                        <span
                          className={
                            cl.verificationStatus === 'Verified'
                              ? 'text-emerald-700'
                              : cl.verificationStatus === 'Contradicted'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }
                        >
                          {cl.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p>{cl.suggestedCorrectionOrQualification}</p>
                        {cl.sourceUrl && (
                          <a
                            href={cl.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Reference Source {cl.sourceDate ? `(${cl.sourceDate})` : ''}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: SIMILARITY CHECK & COMPETITIVE DIFFERENTIATION
      ===================================================================== */}
      {activeTab === 'similarity' && (
        <div className="space-y-6">
          {/* Corpus & Methodology Disclosure Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Estimated Similarity Against Available Sources
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Method: {report.similarityAndPlagiarism.comparisonMethod}
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <span className="text-2xl font-bold text-slate-900">
                  {report.similarityAndPlagiarism.competitorsSuccessfullyAnalyzed > 0
                    ? `${report.similarityAndPlagiarism.estimatedSimilarityPercentage}%`
                    : 'Insufficient Corpus'}
                </span>
                <div className="text-xs text-slate-500 font-sans">
                  Across {report.similarityAndPlagiarism.competitorsSuccessfullyAnalyzed} accessible competitor page(s)
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
              <p className="font-semibold">Scope &amp; Legal Boundary Disclosure</p>
              <p>{report.similarityAndPlagiarism.disclaimerNote}</p>
            </div>

            <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
              {report.similarityAndPlagiarism.semanticAndStructureNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>

          {/* Side-by-Side Sentence & Passage Comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Side-by-Side Passage &amp; Sentence Comparisons
            </h3>

            {report.similarityAndPlagiarism.sentenceMatches.length > 0 ? (
              <div className="space-y-4">
                {report.similarityAndPlagiarism.sentenceMatches.map((m, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            m.isConcerning ? 'text-red-700 font-semibold' : 'text-slate-700 font-medium'
                          }
                        >
                          {m.matchCategory}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {m.similarityScore}% overlap ({m.methodUsed})
                        </span>
                      </div>
                      <a
                        href={m.competitorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {m.competitorTitle} {m.competitorPosition ? `(#${m.competitorPosition})` : ''}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-[11px] font-semibold text-slate-500 mb-1">
                          Submitted Article Passage
                        </div>
                        <p className="text-slate-900">{m.submittedPassage}</p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                        <div className="text-[11px] font-semibold text-slate-500 mb-1">
                          Competitor Passage
                        </div>
                        <p className="text-slate-800">{m.competitorPassage}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-slate-600">
                      <div>
                        <strong>Assessment:</strong> {m.concernExplanation}
                      </div>
                      <button
                        type="button"
                        onClick={() => openInRewriter(m.submittedPassage, m.recommendedRewrite)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md shrink-0 cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Rewrite in Action Panel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                No high-overlap verbatim or closely paraphrased sentences were detected against the retrieved competitor corpus.
              </p>
            )}
          </div>

          {/* Article Uniqueness & Competitive Advantage Report */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Article Uniqueness &amp; Competitive Advantage Report
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {report.uniquenessAndAdvantage.overallDifferentiationSummary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <strong className="text-slate-900 block">Original Explanations</strong>
                <p className="text-slate-600">{report.uniquenessAndAdvantage.originalExplanationsAssessment}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <strong className="text-slate-900 block">Distinctive Examples</strong>
                <p className="text-slate-600">{report.uniquenessAndAdvantage.distinctiveExamplesAssessment}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <strong className="text-slate-900 block">First-Hand Evidence</strong>
                <p className="text-slate-600">{report.uniquenessAndAdvantage.firstHandEvidenceAssessment}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
                <h4 className="font-semibold text-slate-900">Practical Details Competitors Omit</h4>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {report.uniquenessAndAdvantage.practicalDetailsOmittedByCompetitors.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
                <h4 className="font-semibold text-slate-900">How to Increase Competitive Advantage</h4>
                <ul className="list-disc pl-4 text-slate-600 space-y-1">
                  {report.uniquenessAndAdvantage.waysToIncreaseCompetitiveAdvantage.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: GOOGLE SEARCH GUIDELINES & POTENTIAL RISKS
      ===================================================================== */}
      {activeTab === 'guidelines' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Google Search Central Documentation &amp; Policy Alignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">
                  E-E-A-T Qualitative Content Evaluation
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {report.googleGuidelinesAudit.eeatQualitativeAssessment}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <h3 className="font-semibold text-slate-900">
                  People-First Content &amp; Automation Guidance
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {report.googleGuidelinesAudit.aiContentPolicyNote}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Google Guidance and Potential Risks
            </h3>
            <p className="text-xs text-slate-500">
              Explicitly distinguishes official Google Search Central requirements, official recommendations, third-party SEO practices, and editorial judgment.
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Principle &amp; Classification</th>
                    <th className="py-2.5 px-3 font-semibold">Severity / Confidence</th>
                    <th className="py-2.5 px-3 font-semibold">Specific Article Issue &amp; Why It Matters</th>
                    <th className="py-2.5 px-3 font-semibold">Recommended Fix &amp; Official Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {report.googleGuidelinesAudit.guidelinesAndRisks.map((g, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{g.guidelineTitle}</div>
                        <div className="text-[11px] text-blue-700 mt-0.5">{g.sourceClassification}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className={severityTextClass(g.severity)}>{g.severity}</div>
                        <div className="text-[11px] text-slate-500">Confidence: {g.confidence}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p className="font-medium text-slate-900">{g.specificArticleIssue}</p>
                        <p className="text-slate-600">{g.whyItMatters}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p>{g.recommendedChange}</p>
                        {g.officialDocUrl && (
                          <a
                            href={g.officialDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            {g.officialDocName} (Checked {g.dateChecked})
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 8: ACTION PLAN, REWRITER & FULL PRIORITIZED ISSUES
      ===================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Interactive Section Rewriter & Full Article Generator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section Rewriter */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Interactive Section Rewriter
                </h2>
                <p className="text-xs text-slate-500">
                  Rewrite any weak paragraph or heading section while preserving verified facts and avoiding fabricated claims.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Selected Passage from Your Article
                  </label>
                  <textarea
                    rows={4}
                    value={rewritePassage}
                    onChange={(e) => setRewritePassage(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Editorial Improvement Instruction
                  </label>
                  <input
                    type="text"
                    value={rewriteInstruction}
                    onChange={(e) => setRewriteInstruction(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="button"
                  disabled={isRewriting || !rewritePassage.trim()}
                  onClick={handleRunSectionRewrite}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  {isRewriting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Rewriting Passage...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      Rewrite Selected Section
                    </>
                  )}
                </button>

                {rewriteOutput && (
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-950">Recommended Revision</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(rewriteOutput.rewrittenText, 'rewritten-sec')}
                        className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
                      >
                        {copiedId === 'rewritten-sec' ? 'Copied!' : 'Copy Rewrite'}
                      </button>
                    </div>
                    <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">
                      {rewriteOutput.rewrittenText}
                    </p>
                    <p className="text-[11px] text-slate-600 border-t border-emerald-200 pt-1.5">
                      <strong>Editor Note:</strong> {rewriteOutput.editorialNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Full Improved Article Generator */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Generate Complete Improved Article Draft
                  </h2>
                  <p className="text-xs text-slate-500">
                    Applies the corrected H1–H4 outline and audit recommendations while marking unverified figures with [Editor Verify] tags.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingArticle}
                  onClick={handleGenerateFullArticle}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shrink-0 cursor-pointer"
                >
                  {isGeneratingArticle ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      Generate Improved Article
                    </>
                  )}
                </button>
              </div>

              {generatedArticle ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div><strong>Improved Title:</strong> {generatedArticle.improvedTitle}</div>
                    <div><strong>Meta Description:</strong> {generatedArticle.improvedMetaDescription}</div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedArticle.improvedMarkdownArticle, 'full-art')}
                      className="absolute right-3 top-3 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded shadow-2xs cursor-pointer"
                    >
                      {copiedId === 'full-art' ? 'Copied Markdown' : 'Copy Full Markdown'}
                    </button>
                    <pre className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">
                      {generatedArticle.improvedMarkdownArticle}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-900">Prioritized Editing Checklist:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {report.editingActionPlan.prioritizedEditingChecklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Complete Prioritized Issues Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Complete Prioritized Issues &amp; Recommendations ({filteredIssues.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Filter by severity or search across locations, evidence, and recommended replacements.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  {['ALL', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setIssueSeverityFilter(sev)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        issueSeverityFilter === sev
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={issueSearchQuery}
                    onChange={(e) => setIssueSearchQuery(e.target.value)}
                    placeholder="Filter issues..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">ID &amp; Severity</th>
                    <th className="py-2.5 px-3 font-semibold">Category &amp; Exact Location</th>
                    <th className="py-2.5 px-3 font-semibold">Problem, Evidence &amp; Why It Matters</th>
                    <th className="py-2.5 px-3 font-semibold">Recommended Action &amp; Replacement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredIssues.map((iss) => (
                    <tr key={iss.issueId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className={severityTextClass(iss.severity)}>{iss.severity}</div>
                        <div className="font-mono text-[11px] text-slate-400">{iss.issueId}</div>
                        <div className="text-[11px] text-slate-400">Conf: {iss.confidenceLevel}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{iss.category}</div>
                        <div className="text-slate-500 mt-0.5">{iss.exactLocation}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1">
                        <p className="font-semibold text-slate-900">{iss.problemExplanation}</p>
                        <p className="text-slate-600"><strong>Evidence:</strong> {iss.evidence}</p>
                        <p className="text-slate-500"><strong>Why it matters:</strong> {iss.whyItMatters}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-700 space-y-1.5">
                        <p>{iss.recommendedAction}</p>
                        {iss.suggestedReplacement && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-900 flex items-start justify-between gap-2">
                            <span>{iss.suggestedReplacement}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(iss.suggestedReplacement, `rep-${iss.issueId}`)}
                              className="text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                            >
                              {copiedId === `rep-${iss.issueId}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Search,
  Globe,
  FileText,
  Link2,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AnalysisStageEvent, AuditInput } from '../types/audit.ts';
import {
  CONTENT_TYPES,
  SAMPLE_AUDIT_PRESETS,
  SUPPORTED_COUNTRIES,
  SUPPORTED_LANGUAGES,
} from '../data/countriesAndSamples.ts';

interface AuditInputFormProps {
  input: AuditInput;
  onChange: (updated: AuditInput) => void;
  onSubmit: () => void;
  isAnalyzing: boolean;
  activeStages: AnalysisStageEvent[];
  validationError: string | null;
  onNavigateLegal: (path: string) => void;
}

export const AuditInputForm: React.FC<AuditInputFormProps> = ({
  input,
  onChange,
  onSubmit,
  isAnalyzing,
  activeStages,
  validationError,
  onNavigateLegal,
}) => {
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return SUPPORTED_COUNTRIES;
    return SUPPORTED_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const liveStats = useMemo(() => {
    const text = input.articleContent || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const paragraphs = text.trim()
      ? text
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean).length
      : 0;
    const mdHeadings = (text.match(/^#{1,6}\s+.+$/gm) || []).length;
    const htmlHeadings = (text.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || []).length;
    const detectedScript = /[\u0600-\u06FF]/.test(text)
      ? 'Urdu / Arabic'
      : /[\u0900-\u097F]/.test(text)
      ? 'Hindi'
      : words > 0
      ? 'English / Latin'
      : 'Waiting for text';

    return {
      chars,
      words,
      paragraphs,
      headings: mdHeadings + htmlHeadings,
      readMins: Math.max(1, Math.ceil(words / 220)),
      detectedScript,
    };
  }, [input.articleContent]);

  const handlePresetLoad = (idx: number) => {
    const p = SAMPLE_AUDIT_PRESETS[idx];
    if (!p) return;
    onChange({
      articleTitle: p.articleTitle,
      focusKeyword: p.focusKeyword,
      targetCountry: p.targetCountry,
      language: p.language,
      contentType: p.contentType,
      articleUrl: p.articleUrl,
      articleContent: p.articleContent,
    });
  };

  const handleClear = () => {
    onChange({
      articleTitle: '',
      focusKeyword: '',
      targetCountry: input.targetCountry || 'United States',
      language: 'Auto-Detect',
      contentType: 'Informational Article',
      articleUrl: '',
      articleContent: '',
    });
    try {
      localStorage.removeItem('seo_auditor_draft');
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sample Presets Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              New SEO &amp; Content Quality Audit
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Submit your complete article draft and target market to audit on-page SEO, heading hierarchy (H1–H4), live SERP competitors, writing depth, factual accuracy, and text similarity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500 mr-1">Quick Test Presets:</span>
            {SAMPLE_AUDIT_PRESETS.map((preset, idx) => (
              <button
                key={preset.label}
                type="button"
                disabled={isAnalyzing}
                onClick={() => handlePresetLoad(idx)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {idx === 0 ? 'Load Tech SEO Sample (US)' : 'Load Solar Policy Sample (PK)'}
              </button>
            ))}
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Form
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="pt-5 space-y-5">
          {/* Row 1: Article Title & Focus Keyword */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="audit-title" className="text-xs font-semibold text-slate-800">
                  Article Title <span className="text-red-600">*</span>
                </label>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {input.articleTitle.length} chars · ~{Math.round(input.articleTitle.length * 9.4)}px
                </span>
              </div>
              <input
                id="audit-title"
                type="text"
                disabled={isAnalyzing}
                value={input.articleTitle}
                onChange={(e) => onChange({ ...input, articleTitle: e.target.value })}
                placeholder="Enter the intended H1 / SEO title of your article..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-50"
              />
            </div>

            <div className="lg:col-span-5">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="audit-keyword" className="text-xs font-semibold text-slate-800">
                  Focus Keyword <span className="text-red-600">*</span>
                </label>
                <span className="text-xs text-slate-500">Primary SERP target</span>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="audit-keyword"
                  type="text"
                  disabled={isAnalyzing}
                  value={input.focusKeyword}
                  onChange={(e) => onChange({ ...input, focusKeyword: e.target.value })}
                  placeholder="e.g., solar net metering in Pakistan"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Target Country (Searchable), Content Type, Language, Optional Live URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Searchable Country Selector */}
            <div className="relative">
              <label htmlFor="country-search-btn" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Target Country <span className="text-red-600">*</span>
              </label>
              <button
                id="country-search-btn"
                type="button"
                disabled={isAnalyzing}
                onClick={() => setCountryDropdownOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate font-medium text-slate-900">{input.targetCountry}</span>
                </span>
                <span className="text-xs font-mono text-slate-400 ml-2">
                  {SUPPORTED_COUNTRIES.find((c) => c.name === input.targetCountry)?.code || 'GL'}
                </span>
              </button>

              {countryDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search country (Pakistan, US, India, UK...)"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md mb-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    autoFocus
                  />
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          onChange({ ...input, targetCountry: c.name });
                          setCountryDropdownOpen(false);
                          setCountrySearch('');
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-md text-left cursor-pointer ${
                          input.targetCountry === c.name
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="font-mono text-slate-400">{c.code}</span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <div className="py-3 px-2 text-xs text-slate-500 text-center">
                        No matching country found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Content Type */}
            <div>
              <label htmlFor="audit-content-type" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Content Category
              </label>
              <select
                id="audit-content-type"
                disabled={isAnalyzing}
                value={input.contentType}
                onChange={(e) => onChange({ ...input, contentType: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="audit-language" className="text-xs font-semibold text-slate-800">
                  Article Language
                </label>
                <span className="text-[11px] text-slate-500">
                  Detected: {liveStats.detectedScript}
                </span>
              </div>
              <select
                id="audit-language"
                disabled={isAnalyzing}
                value={input.language}
                onChange={(e) => onChange({ ...input, language: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Published URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="audit-url" className="text-xs font-semibold text-slate-800">
                  Published URL <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-[11px] text-slate-500">Inspects live HTML</span>
              </div>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="audit-url"
                  type="url"
                  disabled={isAnalyzing}
                  value={input.articleUrl || ''}
                  onChange={(e) => onChange({ ...input, articleUrl: e.target.value })}
                  placeholder="https://example.com/article-slug"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Large Article Editor */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label htmlFor="audit-content" className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Complete Article Content (Markdown, HTML, or Plain Text) <span className="text-red-600">*</span>
              </label>

              {/* Unboxed Metadata Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-600">
                <span>{liveStats.words.toLocaleString()} words</span>
                <span aria-hidden="true">·</span>
                <span>{liveStats.chars.toLocaleString()} chars</span>
                <span aria-hidden="true">·</span>
                <span>{liveStats.paragraphs} paragraphs</span>
                <span aria-hidden="true">·</span>
                <span>{liveStats.headings} explicit headings</span>
                <span aria-hidden="true">·</span>
                <span>~{liveStats.readMins} min read</span>
              </div>
            </div>

            <textarea
              id="audit-content"
              rows={15}
              disabled={isAnalyzing}
              value={input.articleContent}
              onChange={(e) => onChange({ ...input, articleContent: e.target.value })}
              placeholder="Paste your complete article here. Include headings (# H1, ## H2, ### H3 or <h1>, <h2>, <h3>), paragraphs, lists, tables, and FAQs so the auditor can verify your heading hierarchy and section depth..."
              className="w-full p-4 text-sm leading-relaxed bg-slate-50/50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-sans disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Tip: Use Markdown (<code className="font-mono"># H1</code>, <code className="font-mono">## H2</code>, <code className="font-mono">### H3</code>) or HTML heading tags (<code className="font-mono">&lt;h2&gt;</code>) for verified heading-level checks. Very long articles are handled gracefully without silent truncation.
            </p>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Audit Error: </span>
                <span>{validationError}</span>
              </div>
            </div>
          )}

          {/* Action Row & Privacy Policy Link */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              By submitting an article for analysis, you acknowledge our{' '}
              <button
                type="button"
                onClick={() => onNavigateLegal('/privacy-policy')}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                Privacy Policy
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => onNavigateLegal('/disclaimer')}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                Diagnostic Disclaimer
              </button>
              .
            </div>

            <button
              type="button"
              disabled={isAnalyzing}
              onClick={onSubmit}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Live SEO &amp; Competitor Audit...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Analyze Article
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Genuine Real-Time Analysis Stages Panel (Only shows stages actually emitted by backend) */}
      {(isAnalyzing || activeStages.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Live Audit Execution Pipeline
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {activeStages.filter((s) => s.status === 'completed').length} / {activeStages.length} active stages completed
            </span>
          </div>

          <div className="space-y-2.5">
            {activeStages.map((st) => (
              <div
                key={st.stage}
                className={`flex items-start justify-between gap-4 p-3 rounded-lg border text-xs ${
                  st.status === 'running'
                    ? 'bg-blue-50/60 border-blue-200 text-blue-950'
                    : st.status === 'completed'
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {st.status === 'running' ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />
                  ) : st.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold capitalize">
                      {st.stage.replace(/_/g, ' ')}:
                    </span>{' '}
                    <span>{st.message}</span>
                  </div>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                  {new Date(st.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

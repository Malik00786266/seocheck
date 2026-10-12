import React, { useEffect, useState } from 'react';
import {
  FilePlus2,
  LayoutDashboard,
  SearchCheck,
  ListTree,
  Globe2,
  PenTool,
  CopyCheck,
  BookOpenCheck,
  ClipboardList,
  Menu,
  X,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import { AnalysisStageEvent, AuditInput, CompleteAuditReport } from './types/audit.ts';
import { SAMPLE_AUDIT_PRESETS } from './data/countriesAndSamples.ts';
import { AuditInputForm } from './components/AuditInputForm.tsx';
import { ReportViews, WorkspaceTab } from './components/ReportViews.tsx';
import { LegalPages, LegalRoute } from './components/LegalPages.tsx';

const LEGAL_ROUTES = new Set<string>([
  '/privacy-policy',
  '/terms',
  '/disclaimer',
  '/cookie-policy',
  '/contact',
  '/about',
]);

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('new-audit');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  const [configStatus, setConfigStatus] = useState<any>(null);

  const [auditInput, setAuditInput] = useState<AuditInput>(() => {
    try {
      const saved = localStorage.getItem('seo_auditor_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    const preset = SAMPLE_AUDIT_PRESETS[0];
    return {
      articleTitle: preset.articleTitle,
      focusKeyword: preset.focusKeyword,
      targetCountry: preset.targetCountry,
      language: preset.language,
      contentType: preset.contentType,
      articleUrl: preset.articleUrl,
      articleContent: preset.articleContent,
    };
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStages, setActiveStages] = useState<AnalysisStageEvent[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<CompleteAuditReport | null>(null);

  // Sync browser history navigation
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Fetch server config status on mount
  useEffect(() => {
    fetch('/api/config-status')
      .then((r) => r.json())
      .then((data) => setConfigStatus(data))
      .catch(() => null);
  }, []);

  // Save draft to localStorage if allowed
  useEffect(() => {
    try {
      if (localStorage.getItem('seo_auditor_cookie_prefs') !== 'essential_only') {
        localStorage.setItem('seo_auditor_draft', JSON.stringify(auditInput));
      }
    } catch {
      // ignore
    }
  }, [auditInput]);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRunAudit = async () => {
    setValidationError(null);

    if (!auditInput.articleTitle.trim()) {
      setValidationError('Please enter your intended Article Title.');
      return;
    }
    if (!auditInput.focusKeyword.trim()) {
      setValidationError('Please enter a primary Focus Keyword.');
      return;
    }
    if (!auditInput.articleContent.trim() || auditInput.articleContent.trim().split(/\s+/).length < 15) {
      setValidationError('Please paste at least 15 words of article content to run a comprehensive audit.');
      return;
    }

    setIsAnalyzing(true);
    setActiveStages([]);

    try {
      const response = await fetch('/api/audit/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditInput),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'stage' && evt.data) {
              const stageEvt: AnalysisStageEvent = evt.data;
              setActiveStages((prev) => {
                const idx = prev.findIndex((s) => s.stage === stageEvt.stage);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = stageEvt;
                  return next;
                }
                return [...prev, stageEvt];
              });
            } else if (evt.type === 'result' && evt.data) {
              setAuditReport(evt.data as CompleteAuditReport);
              setActiveTab('overview');
            } else if (evt.type === 'error') {
              setValidationError(evt.message || 'Audit failed.');
            }
          } catch {
            // ignore partial line parse errors
          }
        }
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Network error while running the SEO audit pipeline.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sidebarItems: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'new-audit', label: 'New Audit', icon: FilePlus2 },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'seo', label: 'SEO Analysis', icon: SearchCheck },
    { id: 'headings', label: 'Heading Hierarchy', icon: ListTree },
    { id: 'competitors', label: 'SERP Competitors', icon: Globe2 },
    { id: 'quality', label: 'Content Quality', icon: PenTool },
    { id: 'similarity', label: 'Similarity Check', icon: CopyCheck },
    { id: 'guidelines', label: 'Google Guidelines', icon: BookOpenCheck },
    { id: 'reports', label: 'Reports & Action Plan', icon: ClipboardList },
  ];

  const isLegalRoute = LEGAL_ROUTES.has(currentPath);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* =====================================================================
          TOP BAR CONTRACT (3 Zones separated by gap-8)
      ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateTo('/');
            setActiveTab('new-audit');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          SEO Article Intelligence
        </a>

        {/* Zone 2: 4–5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/');
              setActiveTab('new-audit');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              !isLegalRoute && activeTab === 'new-audit' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Audit Workspace
          </a>
          <a
            href="#documentation"
            onClick={(e) => {
              e.preventDefault();
              setShowDocsModal(true);
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Documentation
          </a>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/about');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentPath === '/about' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Methodology
          </a>
          <a
            href="/privacy-policy"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/privacy-policy');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentPath === '/privacy-policy' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Privacy
          </a>
          <a
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('/contact');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentPath === '/contact' ? 'text-slate-900 underline underline-offset-4' : ''
            }`}
          >
            Contact
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigateTo('/');
              setActiveTab('new-audit');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Article Audit
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigateTo('/');
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left ${
                    !isLegalRoute && activeTab === item.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 text-xs text-slate-600">
            <button
              type="button"
              onClick={() => {
                setShowDocsModal(true);
                setMobileMenuOpen(false);
              }}
              className="hover:text-blue-600"
            >
              System Settings &amp; Docs
            </button>
            <button
              type="button"
              onClick={() => {
                navigateTo('/privacy-policy');
                setMobileMenuOpen(false);
              }}
              className="hover:text-blue-600"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => {
                navigateTo('/contact');
                setMobileMenuOpen(false);
              }}
              className="hover:text-blue-600"
            >
              Contact Us
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MAIN BODY: LEGAL ROUTES OR SIDEBAR + WORKSPACE
      ===================================================================== */}
      {isLegalRoute ? (
        <main className="flex-1">
          <LegalPages
            route={currentPath as LegalRoute}
            onNavigate={navigateTo}
            configStatus={configStatus}
          />
        </main>
      ) : (
        <div className="flex-1 flex">
          {/* Left Sidebar (Desktop 256px) */}
          <aside className="hidden md:flex md:w-64 flex-col justify-between bg-white border-r border-slate-200 p-4 shrink-0">
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                Audit Modules
              </div>
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                const hasReport = Boolean(auditReport);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id !== 'new-audit' && hasReport && (
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        {item.id === 'overview'
                          ? `${auditReport?.scores.seoScore.normalizedScore}`
                          : item.id === 'competitors'
                          ? `${auditReport?.serpResearch.totalValidOrganicResults}`
                          : item.id === 'headings'
                          ? `${auditReport?.headingHierarchyAudit.headingAuditTable.length}`
                          : item.id === 'reports'
                          ? `${auditReport?.prioritizedIssues.length}`
                          : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => setShowDocsModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Provider Config &amp; Docs</span>
              </button>
              <div className="px-3 text-[11px] text-slate-400 leading-normal">
                SERP Mode:{' '}
                <span className="text-slate-600 font-medium">
                  {configStatus?.hasDedicatedSerpProvider ? 'Dedicated SERP API' : 'Google Search Grounding'}
                </span>
              </div>
            </div>
          </aside>

          {/* Main Workspace Container */}
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {activeTab === 'new-audit' ? (
              <AuditInputForm
                input={auditInput}
                onChange={setAuditInput}
                onSubmit={handleRunAudit}
                isAnalyzing={isAnalyzing}
                activeStages={activeStages}
                validationError={validationError}
                onNavigateLegal={navigateTo}
              />
            ) : auditReport ? (
              <ReportViews
                report={auditReport}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
              />
            ) : (
              /* Empty State if user clicks a report tab before running an audit */
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">
                  No Active Audit Report Yet
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Submit an article in the <strong>New Audit</strong> workspace to generate live SERP competitor comparisons, heading hierarchy recommendations, writing-quality diagnostics, and similarity analysis.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('new-audit')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                  >
                    Go to Article Input Form
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* =====================================================================
          DOCUMENTATION & PROVIDER CONFIGURATION MODAL
      ===================================================================== */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900">
                Documentation, Scoring Rubric &amp; Integration Status
              </h2>
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <h3 className="font-semibold text-slate-900">
                  1. Server-Side Integration &amp; Environment Configuration
                </h3>
                <p>
                  All API keys are kept strictly in server-side environment variables (<code className="font-mono">.env</code> / Secrets panel) and are never sent to the browser:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Gemini API (<code className="font-mono">GEMINI_API_KEY</code>):</strong>{' '}
                    {configStatus?.hasGeminiKey ? (
                      <span className="text-emerald-700 font-semibold">Configured on Server</span>
                    ) : (
                      <span className="text-red-700 font-semibold">Not Configured</span>
                    )}
                  </li>
                  <li>
                    <strong>SERP Discovery Mode:</strong>{' '}
                    <span className="font-medium text-slate-900">{configStatus?.serpProviderMode}</span>. To enable exact 1–20 organic rank position tracking via a dedicated SERP provider, configure <code className="font-mono">SERPAPI_API_KEY</code> or <code className="font-mono">GOOGLE_CSE_API_KEY</code> + <code className="font-mono">GOOGLE_CSE_CX</code> in server secrets.
                  </li>
                  <li>
                    <strong>Contact Form Email Routing (<code className="font-mono">CONTACT_EMAIL</code>):</strong>{' '}
                    {configStatus?.contactEmailConfigured
                      ? `Configured (${configStatus.contactEmailPlaceholder})`
                      : 'Server Queue Mode (Set CONTACT_EMAIL in environment for external email routing)'}
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">
                  2. Transparent Scoring &amp; Normalization Methodology
                </h3>
                <p>
                  The <strong>On-Page SEO Score (100 points)</strong> evaluates 9 weighted categories: Title &amp; Metadata (10), Keyword Relevance &amp; Placement (10), Search Intent &amp; Topical Coverage (20), Heading Structure (10), Links (10), Semantic Completeness (15), Media/Accessibility (5), Technical &amp; Structured Data (10), and Guideline Risks &amp; Accuracy (10). When a category cannot be verified from pasted text alone (such as live canonical tags or image alt attributes when no URL or image tags are supplied), it is marked <em>Not Checked</em> and excluded from the denominator rather than treated as an automatic pass.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-slate-900">
                  3. Safe Competitor Retrieval &amp; Similarity Scope
                </h3>
                <p>
                  Competitor pages are retrieved server-side with SSRF protection (blocking private/loopback IP ranges), <code className="font-mono">robots.txt</code> compliance checks, and 7-second timeouts. The <strong>Similarity Check</strong> calculates deterministic sentence and shingle overlap strictly against the successfully retrieved competitor corpus.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
              >
                Close Documentation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FOOTER WITH COMPLETE LEGAL NAVIGATION
      ===================================================================== */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-6 py-5 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <strong className="text-slate-800">SEO Article Intelligence</strong> — Complete SEO &amp; Content Quality Auditor. Independent diagnostic tool; not affiliated with Google LLC.
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/privacy-policy"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/privacy-policy');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Privacy Policy
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/terms');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Terms of Service
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/disclaimer"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/disclaimer');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Disclaimer
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/cookie-policy"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/cookie-policy');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Cookie Policy
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/about');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              About Us
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('/contact');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

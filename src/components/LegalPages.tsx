import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Shield, Scale, FileWarning, Cookie, Mail, Info } from 'lucide-react';

export type LegalRoute =
  | '/privacy-policy'
  | '/terms'
  | '/disclaimer'
  | '/cookie-policy'
  | '/contact'
  | '/about';

interface ServerConfigStatus {
  hasGeminiKey: boolean;
  serpProviderMode: string;
  hasDedicatedSerpProvider: boolean;
  contactEmailConfigured: boolean;
  contactEmailPlaceholder: string;
  operatorNamePlaceholder: string;
  operatorJurisdictionPlaceholder: string;
  lastLegalUpdateDate: string;
}

interface LegalPageProps {
  route: LegalRoute;
  onNavigate: (path: string) => void;
  configStatus: ServerConfigStatus | null;
}

export const LegalPages: React.FC<LegalPageProps> = ({ route, onNavigate, configStatus }) => {
  const lastUpdated = configStatus?.lastLegalUpdateDate || 'October 12, 2026';
  const operatorName = configStatus?.operatorNamePlaceholder || '[Configuration Required: Set OPERATOR_NAME]';
  const jurisdiction =
    configStatus?.operatorJurisdictionPlaceholder || '[Configuration Required: Set OPERATOR_JURISDICTION]';
  const contactEmail =
    configStatus?.contactEmailPlaceholder || '[Configuration Required: Set CONTACT_EMAIL in environment]';

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmailInput, setContactEmailInput] = useState('');
  const [contactCategory, setContactCategory] = useState('Technical Support');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    submissionId?: string;
  } | null>(null);

  // Cookie preference state (stored in localStorage for local UI preferences)
  const [allowLocalPrefs, setAllowLocalPrefs] = useState<boolean>(() => {
    try {
      return localStorage.getItem('seo_auditor_cookie_prefs') !== 'essential_only';
    } catch {
      return true;
    }
  });
  const [cookieSavedMsg, setCookieSavedMsg] = useState<string | null>(null);

  const handleSaveCookiePrefs = (enablePrefs: boolean) => {
    setAllowLocalPrefs(enablePrefs);
    try {
      localStorage.setItem('seo_auditor_cookie_prefs', enablePrefs ? 'essential_and_prefs' : 'essential_only');
      if (!enablePrefs) {
        localStorage.removeItem('seo_auditor_draft');
      }
    } catch {
      // ignore storage errors
    }
    setCookieSavedMsg(
      enablePrefs
        ? 'Preferences updated: Essential operation and local draft storage enabled.'
        : 'Preferences updated: Strictly essential state only (local draft storage cleared).'
    );
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitResult(null);

    if (!contactName.trim() || !contactEmailInput.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setSubmitResult({
        success: false,
        message: 'Please complete all required fields (Name, Email, Subject, and Message).',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmailInput,
          category: contactCategory,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitResult({
          success: false,
          message: data.error || 'Could not process your request. Please verify your inputs.',
        });
      } else {
        setSubmitResult({
          success: true,
          message: data.deliveryNotice,
          submissionId: data.submissionId,
        });
        setContactSubject('');
        setContactMessage('');
      }
    } catch (err: any) {
      setSubmitResult({
        success: false,
        message: err?.message || 'Network error while submitting contact form.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const navTabs: { path: LegalRoute; label: string }[] = [
    { path: '/privacy-policy', label: 'Privacy Policy' },
    { path: '/terms', label: 'Terms of Service' },
    { path: '/disclaimer', label: 'Disclaimer' },
    { path: '/cookie-policy', label: 'Cookie Policy' },
    { path: '/about', label: 'About Us' },
    { path: '/contact', label: 'Contact Us' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Back Action & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to SEO Audit Workspace
        </button>

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {navTabs.map((t) => (
            <button
              key={t.path}
              type="button"
              onClick={() => onNavigate(t.path)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                route === t.path
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legal Draft Notice Banner */}
      <div className="mb-8 p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold text-amber-950 mb-1">
          Operator Configuration & Legal Review Notice
        </p>
        <p>
          These documents accurately describe the technical data flows, third-party API integrations, and diagnostic boundaries of{' '}
          <strong>SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor</strong>. Items marked with{' '}
          <span className="font-mono text-amber-950">[Configuration Required]</span> must be populated with the website operator’s verified legal identity, contact email, and governing jurisdiction prior to commercial publication. These pages are provided for operational transparency and do not substitute for advice from a qualified attorney.
        </p>
      </div>

      {/* 1. PRIVACY POLICY */}
      {route === '/privacy-policy' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Legal Documentation</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {lastUpdated}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              How SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor collects, processes, transmits, and handles submitted articles and technical information.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">1. Scope and Operator Information</h2>
            <p className="text-sm">
              This Privacy Policy explains how <strong>SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor</strong> (&ldquo;the Application&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) handles information when visitors submit articles for SEO analysis, competitor comparison, writing-quality evaluation, and text-similarity checks, or when visitors submit inquiries through our Contact page.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-1.5">
              <div>
                <strong className="text-slate-900">Website Operator / Data Controller:</strong>{' '}
                <span className="font-mono text-slate-800">{operatorName}</span>
              </div>
              <div>
                <strong className="text-slate-900">Privacy Contact Email:</strong>{' '}
                <span className="font-mono text-slate-800">{contactEmail}</span>
              </div>
              <div>
                <strong className="text-slate-900">Applicable Jurisdiction:</strong>{' '}
                <span className="font-mono text-slate-800">{jurisdiction}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">2. Information You Submit</h2>
            <p className="text-sm">
              When you run an audit or interact with the Application, you may voluntarily submit:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              <li>
                <strong>Article Audit Inputs:</strong> Your intended article title, primary focus keyword, target country, language selection, content category, and the full body text or HTML/Markdown of your article.
              </li>
              <li>
                <strong>Optional Published URL:</strong> If you supply an optional live URL, our server fetches the publicly accessible HTML of that webpage to inspect its metadata, headings, links, images, and structured data.
              </li>
              <li>
                <strong>Section Rewrite Inputs:</strong> Specific passages or sections you select for AI-assisted editorial rewriting.
              </li>
              <li>
                <strong>Contact Form Submissions:</strong> Your name, email address, inquiry category, subject line, and message content when you submit a support, privacy, or audit-accuracy inquiry.
              </li>
            </ul>
            <p className="text-sm">
              Please do not submit confidential personal data, trade secrets, unpublished regulated health/financial records, or sensitive personally identifiable information inside article drafts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">3. Technical Information Collected Automatically</h2>
            <p className="text-sm">
              Based on the actual implementation of this Application:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              <li>
                <strong>Standard HTTP &amp; Hosting Logs:</strong> Like all web applications hosted on cloud infrastructure (such as Google Cloud Run), the underlying hosting environment processes standard request metadata including your IP address, browser user-agent string, request timestamps, and HTTP status codes to route traffic, prevent abuse, and maintain service reliability.
              </li>
              <li>
                <strong>Local Browser Storage:</strong> The Application uses browser <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">localStorage</code> solely on your own device to store your cookie preference selection and optionally preserve your current working audit draft so you do not lose work on accidental page refresh.
              </li>
              <li>
                <strong>No Third-Party Behavioral Advertising Trackers:</strong> This Application does not currently install third-party behavioral advertising pixels or cross-site tracking scripts. If third-party analytics are added by the operator in the future, this policy and the Cookie Policy must be updated prior to activation.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">4. How Submitted Content Is Processed &amp; Third-Party Service Providers</h2>
            <p className="text-sm">
              To perform real SEO, search intent, factual verification, and writing-quality audits, the Application processes your submitted content through the following technical pipeline:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>
                <strong>Google Gemini API (<code className="font-mono text-xs">@google/genai</code>):</strong> Your submitted article title, focus keyword, target country, and article text (or selected rewrite passages) are transmitted from our Node.js backend to Google’s Gemini API to perform semantic evaluation, heading hierarchy analysis, grammar/writing quality checks, and Google Search grounding. How Google handles data sent to the Gemini API depends on whether the operator’s configured <code className="font-mono text-xs">GEMINI_API_KEY</code> is operating under Paid Services terms or Unpaid/Free quota terms under the Google APIs Terms of Service and Gemini API Additional Terms of Service. Because we cannot independently alter Google’s upstream API terms, we do not promise that content processed under a free-tier API key is exempt from provider review or model improvement.
              </li>
              <li>
                <strong>Google Search Grounding &amp; SERP Data Providers:</strong> Your focus keyword and target country are transmitted to Google Search Grounding (and, if configured by the operator via <code className="font-mono text-xs">SERPAPI_API_KEY</code> or <code className="font-mono text-xs">GOOGLE_CSE_API_KEY</code>, to SerpApi or Google Custom Search JSON API) to discover competing organic search results.
              </li>
              <li>
                <strong>Competitor &amp; Live URL Retrieval:</strong> When fetching your optional published URL or discovered competitor URLs, our server makes outbound HTTP GET requests to those public web servers.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">5. Data Retention, Storage, and Deletion</h2>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              <li>
                <strong>Submitted Articles &amp; Audit Reports:</strong> In the default application architecture, submitted articles and generated audit reports are processed in server memory during your active HTTP/streaming request and returned directly to your browser. The Application does not permanently store your submitted articles in a backend database.
              </li>
              <li>
                <strong>Contact Inquiries:</strong> Messages submitted via the <code className="font-mono text-xs">/contact</code> form are held in the server’s inquiry queue (and forwarded to the operator’s configured contact email if SMTP delivery is enabled) so the operator can respond to support or privacy requests.
              </li>
              <li>
                <strong>Clearing Local Browser Data:</strong> You can clear any locally cached draft or report in your browser at any time using the &ldquo;Clear Form&rdquo; button in the workspace or by disabling local preference storage on the Cookie Policy page.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">6. Security Measures</h2>
            <p className="text-sm">
              We implement server-side API key isolation (ensuring <code className="font-mono text-xs">GEMINI_API_KEY</code> and SERP provider credentials are never exposed to client browsers), Server-Side Request Forgery (SSRF) validation on all URL fetches, request payload limits, and HTTPS transport encryption. However, no internet transmission is guaranteed to be 100% immune from interception.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">7. Your Privacy Rights &amp; Deletion Requests</h2>
            <p className="text-sm">
              Depending on your location and applicable law (such as the GDPR, UK GDPR, CCPA/CPRA, or Pakistan’s personal data protection framework), you may have rights to request access to, correction of, or deletion of personal information you have submitted (such as contact form inquiries). To submit a privacy question or deletion request, please use the{' '}
              <button
                type="button"
                onClick={() => onNavigate('/contact')}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                Contact Us page
              </button>{' '}
              and select the <strong>Privacy Requests</strong> category.
            </p>
          </section>
        </article>
      )}

      {/* 2. TERMS OF SERVICE */}
      {route === '/terms' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Legal Documentation</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {lastUpdated}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Conditions governing the use of SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of Terms</h2>
            <p className="text-sm">
              By accessing or using <strong>SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor</strong>, operated by <span className="font-mono text-xs">{operatorName}</span>, you agree to comply with these Terms of Service. If you do not agree with these terms, please discontinue use of the Application.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">2. Acceptable Use and Restrictions</h2>
            <p className="text-sm">
              You may use the Application to audit, analyze, and improve articles that you own or are authorized to edit. You agree not to:
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1.5">
              <li>Submit unlawful, defamatory, infringing, or malicious content.</li>
              <li>Use the URL inspection feature to probe private networks, internal infrastructure, or third-party servers in violation of their terms of service.</li>
              <li>Send automated high-volume requests that overload or degrade the Application’s backend or API quotas.</li>
              <li>Use the rewrite or competitor analysis features to systematically plagiarize or infringe the copyright of competing publishers.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">3. User Responsibility for Submitted Content</h2>
            <p className="text-sm">
              You retain ownership of the article text you submit. By submitting content or a URL for analysis, you represent that you have the necessary rights and permissions to submit that material for automated processing. You are solely responsible for reviewing and verifying the factual accuracy, legal compliance, medical/financial/government accuracy, citations, and copyright status of any content you publish.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">4. Informational Nature of SEO Audits &amp; AI Limitations</h2>
            <p className="text-sm">
              All SEO scores, content quality scores, competitive coverage scores, heading recommendations, factual checks, and AI-assisted rewrites are <strong>informational diagnostic estimates</strong>. Automated language models and search grounding can produce incomplete, inaccurate, or outdated assessments. You must independently verify every recommendation, statistic, date, legal rule, or suggested rewrite before publishing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">5. Estimated Similarity vs. Legal Plagiarism Determination</h2>
            <p className="text-sm">
              The Similarity Check module compares your submitted text only against the specific competitor web pages successfully retrieved during that audit session. An &ldquo;Estimated Similarity Against Available Sources&rdquo; score is a mathematical text-overlap metric—it is <strong>not</strong> a universal internet-wide plagiarism scan and is <strong>not</strong> a legal determination of copyright infringement or originality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">6. No Guarantee of Rankings, Traffic, or Indexing</h2>
            <p className="text-sm">
              Search engine algorithms involve hundreds of dynamic signals outside the scope of on-page text analysis. We make no warranty or guarantee that implementing any recommendation from this Application will result in Google indexing, higher search rankings, increased organic traffic, or commercial revenue.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">7. Intellectual Property and Permitted Use of Reports</h2>
            <p className="text-sm">
              You may freely export, download, copy, and use the audit reports and editorial suggestions generated from your submitted articles for your internal editorial, client, or publishing workflows. The Application’s underlying software code, interface design, and scoring methodology remain the intellectual property of the operator.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">8. Service Availability, Limitation of Liability &amp; Governing Law</h2>
            <p className="text-sm">
              The Application is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of any kind. We may modify, rate-limit, or suspend access at any time to prevent abuse or maintain system stability. To the maximum extent permitted by applicable law in <span className="font-mono text-xs">{jurisdiction}</span>, the operator shall not be liable for any indirect, incidental, consequential, or ranking/traffic-related damages arising from your use of the Application or reliance on its audit outputs.
            </p>
          </section>
        </article>
      )}

      {/* 3. DISCLAIMER */}
      {route === '/disclaimer' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <FileWarning className="w-4 h-4 text-blue-600" />
              <span>Legal Documentation</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {lastUpdated}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Disclaimer
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Important disclosures regarding independence, diagnostic scoring, competitor retrieval, and human verification.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                1. Independent Service — Not Affiliated with Google
              </h2>
              <p className="text-sm text-slate-600">
                <strong>SEO Article Intelligence</strong> is an independent SEO analysis and editorial assistance application. It is <strong>not</strong> affiliated with, endorsed by, sponsored by, or operated by Google LLC. References to Google Search Central documentation, Google Search Essentials, and E-E-A-T are provided strictly for educational and diagnostic reference based on publicly available documentation.
              </p>
            </section>

            <section className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                2. Diagnostic Scores Are Not Official Google Scores
              </h2>
              <p className="text-sm text-slate-600">
                The SEO Score (0–100), Content Quality Score (0–100), and Competitive Coverage Score displayed in this tool are internal diagnostic heuristics calculated by our rubric. Google does not use or publish a universal 0–100 on-page SEO score, nor does a high score guarantee search eligibility or ranking position.
              </p>
            </section>

            <section className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                3. Competitor Data &amp; Retrieval Boundaries
              </h2>
              <p className="text-sm text-slate-600">
                Competitor discovery and page analysis depend on the configured SERP provider or live Google Search grounding and whether competing websites allow automated HTTP retrieval. Pages protected by <code className="font-mono text-xs">robots.txt</code> disallows, paywalls, bot-protection firewalls, or client-side JavaScript rendering cannot be fully inspected and are explicitly disclosed as unavailable.
              </p>
            </section>

            <section className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h2 className="text-base font-semibold text-slate-900">
                4. Similarity Scope &amp; Plagiarism Limitations
              </h2>
              <p className="text-sm text-slate-600">
                Similarity percentages reflect deterministic text comparisons <strong>only against the accessible competitor pages retrieved during your audit</strong>. A low similarity score does not prove global internet-wide originality, and shared factual or technical terminology does not automatically constitute plagiarism.
              </p>
            </section>
          </div>

          <section className="space-y-3 pt-2">
            <h2 className="text-lg font-semibold text-slate-900">
              5. Evolving Search Documentation &amp; Mandatory Human Verification
            </h2>
            <p className="text-sm">
              Google Search documentation, ranking systems, and structured data eligibility rules change over time. Furthermore, AI-generated factual checks and rewrite suggestions can misinterpret context or cite outdated web pages. Editors and publishers must verify all facts, dates, prices, government eligibility rules, legal statements, and medical or financial claims against primary authoritative sources before publication.
            </p>
          </section>
        </article>
      )}

      {/* 4. COOKIE POLICY */}
      {route === '/cookie-policy' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Cookie className="w-4 h-4 text-blue-600" />
              <span>Legal Documentation</span>
              <span aria-hidden="true">·</span>
              <span>Last Updated: {lastUpdated}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Cookie &amp; Local Storage Policy
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Transparent disclosure of browser storage technologies actually used by SEO Article Intelligence.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">1. How This Application Uses Browser Storage</h2>
            <p className="text-sm">
              We believe in strict technical accuracy: <strong>SEO Article Intelligence does not use third-party advertising cookies, cross-site behavioral tracking cookies, or marketing pixels.</strong> Instead, the Application uses minimal browser storage (<code className="font-mono text-xs">localStorage</code>) strictly to support your workspace session and remember your preferences.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">2. Categories of Storage Used</h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Status in Application</th>
                    <th className="py-3 px-4 font-semibold">Purpose &amp; Technical Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">Essential Technical State</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">Active (Required)</td>
                    <td className="py-3 px-4 text-slate-600">
                      Stores your cookie/storage preference choice (<code className="font-mono">seo_auditor_cookie_prefs</code>) and maintains active UI navigation state.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">Workspace Preference Storage</td>
                    <td className="py-3 px-4 text-blue-700 font-medium">Optional (User Controllable)</td>
                    <td className="py-3 px-4 text-slate-600">
                      Optionally caches your in-progress article form draft locally in your browser (<code className="font-mono">seo_auditor_draft</code>) so you do not lose pasted work if you refresh the page.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">Analytics &amp; Advertising Cookies</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">Not Installed</td>
                    <td className="py-3 px-4 text-slate-600">
                      No Google Analytics, Meta Pixel, or third-party ad-network cookies are installed in this application.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              3. Manage Your Storage Preferences
            </h2>
            <p className="text-xs text-slate-600">
              You can toggle optional local draft caching below at any time. Selecting &ldquo;Essential Only&rdquo; immediately clears any saved article draft from your browser’s <code className="font-mono">localStorage</code>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSaveCookiePrefs(true)}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  allowLocalPrefs
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Allow Essential + Local Draft Storage
              </button>
              <button
                type="button"
                onClick={() => handleSaveCookiePrefs(false)}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  !allowLocalPrefs
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Strictly Essential Only (Clear Local Drafts)
              </button>
            </div>
            {cookieSavedMsg && (
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {cookieSavedMsg}
              </p>
            )}
          </section>
        </article>
      )}

      {/* 5. ABOUT US */}
      {route === '/about' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Platform Overview</span>
              <span aria-hidden="true">·</span>
              <span>Methodology &amp; Capabilities</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              About SEO Article Intelligence
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              An evidence-based SEO, search intent, heading hierarchy, and editorial quality auditing platform built for professional editors, publishers, and content strategists.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Our Core Purpose</h2>
            <p className="text-sm">
              Most legacy SEO checkers focus on mechanical keyword repetition and arbitrary word-count targets. <strong>SEO Article Intelligence — Complete SEO &amp; Content Quality Auditor</strong> was built to evaluate content the way modern search engines and human editorial directors actually assess quality: by comparing your draft against live country-specific search results, inspecting heading hierarchy (`H1`–`H4`) and explanation depth beneath every section, verifying factual claims against web sources, and aligning recommendations with official Google Search Central documentation.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">1. Country-Targeted SERP &amp; Competitor Retrieval</h3>
              <p className="text-xs text-slate-600">
                Discovers competing pages for your focus keyword in your target country, fetches accessible competitor HTML (respecting <code className="font-mono">robots.txt</code>), and identifies shared topics and content gaps.
              </p>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">2. Heading Hierarchy &amp; Content Weakness Detection</h3>
              <p className="text-xs text-slate-600">
                Audits every existing heading, recommends semantic H1–H4 levels, flags superficial sections that fail to deliver on their heading’s promise, and builds a corrected outline.
              </p>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">3. Deterministic Text Similarity &amp; Originality</h3>
              <p className="text-xs text-slate-600">
                Uses normalized sentence matching, n-gram word shingles, and token Jaccard overlap to compare your draft against retrieved competitor text without claiming a fake internet-wide plagiarism score.
              </p>
            </div>
            <div className="p-4 border border-slate-200 rounded-lg space-y-1.5">
              <h3 className="text-sm font-semibold text-slate-900">4. Transparent, Normalized Scoring</h3>
              <p className="text-xs text-slate-600">
                Provides separate 0–100 diagnostic scores for On-Page SEO, Content Quality, and Competitive Coverage—marking unverified categories as <em>Not Checked</em> rather than assuming a pass.
              </p>
            </div>
          </section>
        </article>
      )}

      {/* 6. CONTACT US */}
      {route === '/contact' && (
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-700 leading-relaxed">
          <header className="border-b border-slate-200 pb-6">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Support &amp; Legal Inquiries</span>
              <span aria-hidden="true">·</span>
              <span>Direct Submission Form</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Contact Us
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Have a question about an audit result, need technical support, or wish to submit a privacy or legal inquiry? Use the form below or reach out via our configured contact address.
            </p>
          </header>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-slate-900">Configured Contact Email: </span>
              <span className="font-mono text-slate-700">{contactEmail}</span>
            </div>
            <span className="text-slate-500">
              {configStatus?.contactEmailConfigured
                ? 'Configured in server environment'
                : 'Server Queue Mode (Set CONTACT_EMAIL in .env for email routing)'}
            </span>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Your Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g., Ayesha Khan"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={contactEmailInput}
                  onChange={(e) => setContactEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-category" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Inquiry Category <span className="text-red-600">*</span>
                </label>
                <select
                  id="contact-category"
                  value={contactCategory}
                  onChange={(e) => setContactCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                >
                  <option value="Technical Support">Technical Support</option>
                  <option value="Incorrect Audit Results">Incorrect Audit Results</option>
                  <option value="Privacy Requests">Privacy Requests</option>
                  <option value="Business Inquiries">Business Inquiries</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Subject <span className="text-red-600">*</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="Brief summary of your inquiry"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Message <span className="text-red-600">*</span>
              </label>
              <textarea
                id="contact-message"
                rows={5}
                required
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Please provide relevant details (such as the focus keyword, target country, or specific issue you encountered)..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            {submitResult && (
              <div
                className={`p-4 rounded-lg border text-xs flex items-start gap-2.5 ${
                  submitResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {submitResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {submitResult.success ? 'Inquiry Logged on Application Server' : 'Submission Error'}
                  </p>
                  <p>{submitResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}
              </button>
            </div>
          </form>
        </article>
      )}
    </div>
  );
};

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { runDeterministicArticleAudit } from './src/server/deterministicAudit.ts';
import {
  createGeminiClient,
  generateComprehensiveAuditReport,
  generateFullImprovedArticle,
  rewriteArticleSection,
  runGroundedFactAndPolicyCheck,
} from './src/server/geminiAuditService.ts';
import { fetchAndParsePublishedPage } from './src/server/pageFetcher.ts';
import { discoverSerpCompetitors, retrieveCompetitorPages } from './src/server/serpService.ts';
import { runCompetitorSimilarityAnalysis } from './src/server/similarityService.ts';
import { AnalysisStageEvent, AuditInput, PublishedPageData } from './src/types/audit.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ContactSubmissionRecord {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

const contactSubmissions: ContactSubmissionRecord[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Honest Configuration & Provider Status Endpoint
  app.get('/api/config-status', (_req, res) => {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
    const hasSerpApiKey = Boolean(process.env.SERPAPI_API_KEY?.trim());
    const hasGoogleCse = Boolean(process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim());
    const contactEmail = process.env.CONTACT_EMAIL?.trim() || null;
    const operatorName = process.env.OPERATOR_NAME?.trim() || null;
    const operatorJurisdiction = process.env.OPERATOR_JURISDICTION?.trim() || null;

    res.json({
      hasGeminiKey,
      serpProviderMode: hasSerpApiKey
        ? 'SerpApi (Country Organic SERP 1–20)'
        : hasGoogleCse
        ? 'Google Custom Search JSON API'
        : 'Google Search Grounding Discovery (No third-party SERP API key configured)',
      hasDedicatedSerpProvider: hasSerpApiKey || hasGoogleCse,
      contactEmailConfigured: Boolean(contactEmail),
      contactEmailPlaceholder: contactEmail || '[Configuration Required: Set CONTACT_EMAIL in environment]',
      operatorNamePlaceholder: operatorName || '[Configuration Required: Set OPERATOR_NAME]',
      operatorJurisdictionPlaceholder: operatorJurisdiction || '[Configuration Required: Set OPERATOR_JURISDICTION]',
      lastLegalUpdateDate: 'October 12, 2026',
    });
  });

  // 2. Main Streaming Audit Pipeline Endpoint (NDJSON stream of real execution stages)
  app.post('/api/audit/stream', async (req, res) => {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (payload: { type: 'stage'; data: AnalysisStageEvent } | { type: 'result'; data: any } | { type: 'error'; message: string }) => {
      res.write(JSON.stringify(payload) + '\n');
    };

    const emitStage = (
      stage: AnalysisStageEvent['stage'],
      status: AnalysisStageEvent['status'],
      message: string
    ) => {
      sendEvent({
        type: 'stage',
        data: {
          stage,
          status,
          message,
          timestamp: new Date().toISOString(),
        },
      });
    };

    try {
      const body = req.body as Partial<AuditInput>;
      const articleTitle = (body.articleTitle || '').trim();
      const focusKeyword = (body.focusKeyword || '').trim();
      const targetCountry = (body.targetCountry || 'United States').trim();
      const articleContent = (body.articleContent || '').trim();
      const articleUrl = (body.articleUrl || '').trim();
      const language = (body.language || 'Auto-Detect').trim();
      const contentType = (body.contentType || 'Informational Article').trim();

      emitStage('validating', 'running', 'Validating article inputs, character length, and language configuration...');

      if (!articleTitle || !focusKeyword || !articleContent) {
        sendEvent({
          type: 'error',
          message: 'Article Title, Focus Keyword, and Article Content are required fields.',
        });
        res.end();
        return;
      }

      if (articleContent.split(/\s+/).filter(Boolean).length < 15) {
        sendEvent({
          type: 'error',
          message: 'Please provide at least 15 words of article content so a meaningful SEO and writing quality audit can be performed.',
        });
        res.end();
        return;
      }

      const ai = createGeminiClient();
      emitStage('validating', 'completed', 'Input validation complete.');

      const input: AuditInput = {
        articleTitle,
        focusKeyword,
        targetCountry,
        articleContent,
        articleUrl: articleUrl || undefined,
        language,
        contentType,
      };

      // Optional Stage: Fetch Published URL ONLY if supplied
      let publishedPage: PublishedPageData | undefined;
      if (articleUrl) {
        emitStage(
          'fetching_published_url',
          'running',
          `Fetching and inspecting live HTML, metadata, headings, and schema at ${articleUrl}...`
        );
        publishedPage = await fetchAndParsePublishedPage(articleUrl, focusKeyword);
        emitStage(
          'fetching_published_url',
          'completed',
          publishedPage.fetchedSuccessfully
            ? `Fetched live page (${publishedPage.wordCount} words, ${publishedPage.headings.length} HTML headings).`
            : `Live URL could not be fully fetched (${publishedPage.errorReason}); continuing audit on pasted article content.`
        );
      }

      // Stage: SERP Research
      emitStage(
        'serp_research',
        'running',
        `Researching Google Search results for "${focusKeyword}" in ${targetCountry}...`
      );
      const serpDiscovery = await discoverSerpCompetitors(focusKeyword, targetCountry, language, ai);
      emitStage(
        'serp_research',
        'completed',
        `Discovered ${serpDiscovery.candidates.length} organic search result(s) via ${serpDiscovery.providerUsed}.`
      );

      // Stage: Fetching Competitor Pages
      let competitors: any[] = [];
      if (serpDiscovery.candidates.length > 0) {
        emitStage(
          'fetching_competitors',
          'running',
          `Fetching up to ${Math.min(serpDiscovery.candidates.length, 12)} competitor pages (respecting robots.txt and SSRF protections)...`
        );
        competitors = await retrieveCompetitorPages(serpDiscovery.candidates, focusKeyword);
        const fetchedCount = competitors.filter((c) => c.fetchStatus === 'fetched').length;
        emitStage(
          'fetching_competitors',
          'completed',
          `Retrieved full content from ${fetchedCount} accessible competitor page(s) (${competitors.length - fetchedCount} blocked or JS-gated).`
        );
      }

      // Stage: Deterministic On-Page & Structure Extraction
      emitStage(
        'deterministic_audit',
        'running',
        'Running deterministic on-page checks (heading hierarchy extraction, keyword placement, links, media)...'
      );
      const deterministicResult = runDeterministicArticleAudit(
        articleTitle,
        focusKeyword,
        articleContent,
        language,
        publishedPage
      );
      emitStage(
        'deterministic_audit',
        'completed',
        `Parsed ${deterministicResult.wordCount} words, ${deterministicResult.headings.length} headings, and ${deterministicResult.links.length} links.`
      );

      // Stage: Similarity & Plagiarism Analysis
      emitStage(
        'similarity_analysis',
        'running',
        'Comparing submitted sentences and headings against retrieved competitor corpus (n-gram shingle & token overlap)...'
      );
      const similarityReport = runCompetitorSimilarityAnalysis(
        deterministicResult.sentences,
        deterministicResult.headings,
        competitors,
        focusKeyword
      );
      emitStage(
        'similarity_analysis',
        'completed',
        `Completed similarity analysis against ${similarityReport.competitorsSuccessfullyAnalyzed} accessible competitor source(s).`
      );

      // Stage: AI Deep Evaluation & Grounded Fact Checking
      emitStage(
        'ai_deep_evaluation',
        'running',
        'Verifying factual claims via Google Search grounding and running deep SEO, heading hierarchy, and editorial quality analysis...'
      );
      const factGrounding = await runGroundedFactAndPolicyCheck(ai, input, deterministicResult.cleanPlainText);

      const finalReport = await generateComprehensiveAuditReport(
        ai,
        input,
        deterministicResult,
        publishedPage,
        {
          providerUsed: serpDiscovery.providerUsed,
          providerDisclosure: serpDiscovery.providerDisclosure,
          competitors,
        },
        similarityReport,
        factGrounding
      );
      emitStage('ai_deep_evaluation', 'completed', 'Completed editorial, heading hierarchy, and Google guidelines evaluation.');

      // Stage: Scoring & Report Compilation
      emitStage('scoring_and_report', 'running', 'Normalizing diagnostic scorecards and compiling actionable report...');
      emitStage('scoring_and_report', 'completed', 'Audit report ready.');

      sendEvent({ type: 'result', data: finalReport });
      res.end();
    } catch (err: any) {
      console.error('Audit pipeline error:', err);
      sendEvent({
        type: 'error',
        message: err?.message || 'An unexpected error occurred during the SEO audit pipeline.',
      });
      res.end();
    }
  });

  // 3. Section Rewrite Endpoint
  app.post('/api/rewrite-section', async (req, res) => {
    try {
      const { articleTitle, focusKeyword, targetCountry, selectedPassage, instruction } = req.body || {};
      if (!selectedPassage || !selectedPassage.trim()) {
        res.status(400).json({ error: 'Please provide a passage to rewrite.' });
        return;
      }
      const ai = createGeminiClient();
      const result = await rewriteArticleSection(ai, {
        articleTitle: articleTitle || 'Untitled Article',
        focusKeyword: focusKeyword || '',
        targetCountry: targetCountry || 'United States',
        selectedPassage,
        instruction: instruction || 'Improve clarity, depth, and natural flow while preserving verified facts.',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to rewrite section.' });
    }
  });

  // 4. Generate Improved Article Endpoint
  app.post('/api/generate-improved-article', async (req, res) => {
    try {
      const { input, proposedOutline, keyFixes } = req.body || {};
      if (!input?.articleContent) {
        res.status(400).json({ error: 'Missing original article input.' });
        return;
      }
      const ai = createGeminiClient();
      const result = await generateFullImprovedArticle(ai, {
        input,
        proposedOutline: Array.isArray(proposedOutline) ? proposedOutline : [],
        keyFixes: Array.isArray(keyFixes) ? keyFixes : [],
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate improved article.' });
    }
  });

  // 5. Contact Form Submission Endpoint
  app.post('/api/contact', (req, res) => {
    const { name, email, category, subject, message } = req.body || {};
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Name, email, subject, and message are all required.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.',
      });
      return;
    }

    const record: ContactSubmissionRecord = {
      id: `msg_${Date.now().toString(36)}`,
      submittedAt: new Date().toISOString(),
      name: name.trim(),
      email: email.trim(),
      category: category || 'Technical Support',
      subject: subject.trim(),
      message: message.trim(),
    };

    contactSubmissions.push(record);
    const configuredRecipient = process.env.CONTACT_EMAIL?.trim();

    res.json({
      success: true,
      submissionId: record.id,
      submittedAt: record.submittedAt,
      deliveryMode: configuredRecipient ? 'configured_recipient' : 'server_logged_pending_smtp',
      deliveryNotice: configuredRecipient
        ? `Inquiry #${record.id} recorded on the application server for configured contact address (${configuredRecipient}). Note: Connect an outbound SMTP/email transport service in production to dispatch external emails automatically.`
        : `Inquiry #${record.id} has been validated and logged in the application server queue. Configuration Requirement: External email delivery (CONTACT_EMAIL and outbound SMTP provider) is not yet configured in environment variables, so no external email was dispatched.`,
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SEO Article Intelligence server running on http://localhost:${PORT}`);
  });
}

startServer();

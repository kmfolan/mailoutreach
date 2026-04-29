import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "db.json");

const reportStatuses = ["Researching", "Drafted", "Reviewing", "Ready to Send", "Live"];

const baseDb = {
  profile: {
    productName: "MailOutreach",
    supportEmail: "ops@mailoutreach.app"
  },
  requests: [],
  reports: [],
  activity: []
};

function ensureDataFile() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(baseDb, null, 2));
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadDb() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...baseDb,
      ...parsed,
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : []
    };
  } catch {
    fs.writeFileSync(dbPath, JSON.stringify(baseDb, null, 2));
    return structuredClone(baseDb);
  }
}

const db = loadDb();

function persistDb() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function toList(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function extractMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function stripTags(text) {
  return text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

async function fetchPageSnapshot(url) {
  if (!url) {
    return {
      url: "",
      reachable: false,
      status: "missing",
      title: "",
      description: "",
      h1: "",
      bodySample: "",
      callToActionSignals: [],
      trustSignals: [],
      notes: ["No URL was provided for this source."]
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MailOutreach-AuditBot/1.0"
      },
      signal: controller.signal
    });

    const html = await response.text();
    const limitedHtml = html.slice(0, 120000);
    const cleanedBody = stripTags(limitedHtml).replace(/\s+/g, " ").trim();
    const title = extractMatch(limitedHtml, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = extractMatch(limitedHtml, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
    const h1 = extractMatch(limitedHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

    const lowerHtml = limitedHtml.toLowerCase();
    const ctaKeywords = ["book", "demo", "schedule", "contact", "consult", "get started", "call"];
    const trustKeywords = ["testimonial", "case study", "review", "clients", "results", "portfolio"];
    const callToActionSignals = ctaKeywords.filter(keyword => lowerHtml.includes(keyword));
    const trustSignals = trustKeywords.filter(keyword => lowerHtml.includes(keyword));

    return {
      url,
      reachable: response.ok,
      status: `${response.status}`,
      title,
      description,
      h1,
      bodySample: cleanedBody.slice(0, 500),
      callToActionSignals,
      trustSignals,
      notes: response.ok ? [] : [`Source returned status ${response.status}.`]
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      status: "error",
      title: "",
      description: "",
      h1: "",
      bodySample: "",
      callToActionSignals: [],
      trustSignals: [],
      notes: [`Could not fetch source: ${error.name === "AbortError" ? "request timed out" : error.message}`]
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDefaultChecklist(auditMode) {
  const shared = [
    "Confirm the target company and location match the campaign brief",
    "Review the website snapshot and validate the top conversion issue",
    "Approve the final outreach sequence before export"
  ];

  const modeSpecific = {
    Agency: [
      "Check the homepage CTA and service clarity",
      "Note one trust or proof element that is missing"
    ],
    SEO: [
      "Review title/meta coverage and search positioning basics",
      "Capture the highest-value organic visibility gap"
    ],
    Social: [
      "Review visible posting or profile signals from provided sources",
      "Note whether social proof supports the offer"
    ],
    Mixed: [
      "Prioritize which channel issue matters most for the report",
      "Make sure the report recommendation matches the CTA"
    ]
  };

  return [...shared, ...(modeSpecific[auditMode] || modeSpecific.Mixed)].map(label => ({
    id: createId("task"),
    label,
    completed: false,
    completedAt: null
  }));
}

function buildIntentSignals(sourceSnapshots, painPoints) {
  const lowerPainPoints = painPoints.map(item => item.toLowerCase());
  const signals = [];

  for (const source of sourceSnapshots) {
    const body = `${source.title} ${source.description} ${source.bodySample}`.toLowerCase();
    const matchedPain = lowerPainPoints.find(item => item && body.includes(item));
    if (matchedPain) {
      signals.push(`The source at ${source.url} appears to mention or imply "${matchedPain}".`);
    }

    if (source.callToActionSignals.length === 0) {
      signals.push(`The source at ${source.url} does not show an obvious CTA signal from the quick scan.`);
    }
  }

  return Array.from(new Set(signals)).slice(0, 4);
}

function buildFindings(input, websiteSnapshot, sourceSnapshots) {
  const findings = [];
  const cta = input.cta;
  const painPoints = input.painPoints;
  const requirements = input.reportRequirements;

  if (!websiteSnapshot.reachable) {
    findings.push({
      title: "Website access needs manual review",
      severity: "High",
      evidence: websiteSnapshot.notes[0] || "The main website could not be fetched during the quick scan.",
      recommendation: "Verify the correct website URL and manually inspect the live site before sending outreach."
    });
  } else {
    if (!websiteSnapshot.description) {
      findings.push({
        title: "Missing or weak meta description",
        severity: "Medium",
        evidence: "The quick scan did not detect a usable meta description on the homepage.",
        recommendation: "Add a clearer meta description that ties the offer to the outcome the client wants."
      });
    }

    if (websiteSnapshot.callToActionSignals.length === 0) {
      findings.push({
        title: "Homepage CTA is not obvious from the quick scan",
        severity: "High",
        evidence: "The homepage content did not surface clear CTA language like book, contact, demo, or get started.",
        recommendation: `Lead the report with a CTA clarity recommendation tied directly to "${cta}".`
      });
    }

    if (websiteSnapshot.trustSignals.length === 0) {
      findings.push({
        title: "Proof elements look thin",
        severity: "Medium",
        evidence: "The scan did not find obvious trust markers like testimonials, case studies, or client proof.",
        recommendation: "Recommend adding one proof block near the main CTA to improve conversion confidence."
      });
    }
  }

  for (const painPoint of painPoints.slice(0, 3)) {
    findings.push({
      title: `Pain point focus: ${painPoint}`,
      severity: "Opportunity",
      evidence: `This campaign specifically wants to surface issues around "${painPoint}".`,
      recommendation: `Build at least one section of the report around how fixing "${painPoint}" supports "${cta}".`
    });
  }

  if (requirements.length > 0) {
    findings.push({
      title: "Custom reporting scope captured",
      severity: "Info",
      evidence: `The report needs to stay flexible for this client and include ${requirements.length} custom requirement areas.`,
      recommendation: "Use the custom report sections below as the final structure for delivery."
    });
  }

  return findings.slice(0, 8);
}

function buildCustomSections(input, websiteSnapshot, sourceSnapshots) {
  const baseEvidence = [
    websiteSnapshot.title ? `Homepage title: ${websiteSnapshot.title}` : "Homepage title was not available from the quick scan.",
    websiteSnapshot.h1 ? `Primary headline: ${websiteSnapshot.h1}` : "Primary homepage headline could not be confirmed.",
    sourceSnapshots.length > 0
      ? `Additional reviewed sources: ${sourceSnapshots.map(source => source.url).join(", ")}`
      : "No additional public source URLs were provided for this report."
  ];

  return input.reportRequirements.length > 0
    ? input.reportRequirements.map(requirement => ({
        title: requirement,
        bullets: [
          `Assess how ${requirement.toLowerCase()} affects the goal of "${input.cta}".`,
          `Tie findings back to ${input.companyName}'s market in ${input.location}.`,
          ...baseEvidence
        ].slice(0, 4)
      }))
    : [
        {
          title: "Website structure and offer clarity",
          bullets: [
            `Review whether the homepage structure quickly supports the CTA "${input.cta}".`,
            "Identify whether proof, offer, and next-step elements are easy to find.",
            ...baseEvidence.slice(0, 2)
          ]
        }
      ];
}

function buildExecutiveSummary(input, websiteSnapshot, sourceSnapshots, intentSignals) {
  const sourceCount = 1 + sourceSnapshots.length;
  const websiteLine = websiteSnapshot.reachable
    ? `The website scan captured live homepage content from ${input.websiteUrl}.`
    : "The primary website could not be fully fetched, so this report should be treated as a partial automated draft.";

  const intentLine = intentSignals.length > 0
    ? `Signal review surfaced ${intentSignals.length} angle${intentSignals.length === 1 ? "" : "s"} that can support personalized outreach.`
    : "No strong public intent signal was found from the provided sources, so the outreach should lead with problem awareness rather than urgency.";

  return [
    `${input.companyName} in ${input.location} was reviewed against the CTA "${input.cta}".`,
    websiteLine,
    `${sourceCount} source${sourceCount === 1 ? " was" : "s were"} considered for this draft.`,
    intentLine
  ].join(" ");
}

function buildSequence(input, findings, intentSignals) {
  const topFinding = findings[0]?.title || "one clear growth blocker";
  const topPain = input.painPoints[0] || "conversion gaps";
  const intentReference = intentSignals[0] || `I noticed a few likely issues related to ${topPain}.`;

  return [
    {
      step: 1,
      subject: `${input.companyName}: quick idea around ${topPain}`,
      body: `Hi ${input.companyName} team,\n\nI took a quick look at your public web presence in ${input.location}. ${intentReference}\n\nThe biggest immediate gap I noticed was ${topFinding.toLowerCase()}. I put together a short report showing what I would change first and how it ties back to ${input.cta}.\n\nWorth sending it over?`
    },
    {
      step: 2,
      subject: `A few notes on ${input.companyName}'s funnel`,
      body: `Following up because I mapped a few friction points around ${topPain}.\n\nThe report is not generic. I focused it around your current CTA, your location, and the specific issues that would likely slow response or conversion.\n\nIf helpful, I can send the breakdown and the top fixes in plain English.`
    },
    {
      step: 3,
      subject: `Should I close this out?`,
      body: `Last note from me.\n\nI drafted a client-specific report for ${input.companyName} that covers the main issues, what likely needs work, and the fastest recommendations to support ${input.cta}.\n\nIf now is not a priority, no worries. If it is, I can send the report over and you can decide if it is useful.`
    }
  ];
}

function normalizeReport(report) {
  const checklist = Array.isArray(report.checklist) ? report.checklist : [];
  const normalizedChecklist = checklist.map(item => ({
    id: item.id || createId("task"),
    label: item.label || "Checklist item",
    completed: Boolean(item.completed),
    completedAt: item.completedAt || null
  }));
  const checklistCompleted = normalizedChecklist.filter(item => item.completed).length;

  return {
    ...report,
    status: reportStatuses.includes(report.status) ? report.status : "Drafted",
    checklist: normalizedChecklist,
    checklistCompleted,
    checklistTotal: normalizedChecklist.length,
    progressPercent: normalizedChecklist.length > 0 ? Math.round((checklistCompleted / normalizedChecklist.length) * 100) : 0
  };
}

function logActivity(title, body, createdAt = new Date().toISOString()) {
  db.activity.unshift({
    id: createId("activity"),
    createdAt,
    title,
    body
  });
}

function findReport(reportId) {
  return db.reports.find(report => report.id === reportId) || null;
}

function findRequestByReport(reportId) {
  return db.requests.find(request => request.reportId === reportId) || null;
}

function syncStoredRecords() {
  db.reports = db.reports.map(normalizeReport);
  db.requests = db.requests.map(request => ({
    ...request,
    reportId: request.reportId || null,
    status: request.status || "Drafted"
  }));
  persistDb();
}

syncStoredRecords();

async function buildReportRecord(payload) {
  const input = {
    companyName: payload.companyName,
    websiteUrl: normalizeUrl(payload.websiteUrl),
    location: payload.location,
    cta: payload.cta,
    auditMode: payload.auditMode,
    painPoints: toList(payload.painPoints),
    reportRequirements: toList(payload.reportRequirements),
    sourceUrls: toList(payload.sourceUrls).map(normalizeUrl),
    notes: payload.notes || ""
  };

  const websiteSnapshot = await fetchPageSnapshot(input.websiteUrl);
  const sourceSnapshots = [];
  for (const url of input.sourceUrls.slice(0, 4)) {
    sourceSnapshots.push(await fetchPageSnapshot(url));
  }

  const intentSignals = buildIntentSignals(sourceSnapshots, input.painPoints);
  const findings = buildFindings(input, websiteSnapshot, sourceSnapshots);
  const customSections = buildCustomSections(input, websiteSnapshot, sourceSnapshots);
  const executiveSummary = buildExecutiveSummary(input, websiteSnapshot, sourceSnapshots, intentSignals);
  const outreachSequence = buildSequence(input, findings, intentSignals);

  return normalizeReport({
    id: createId("report"),
    createdAt: new Date().toISOString(),
    companyName: input.companyName,
    websiteUrl: input.websiteUrl,
    location: input.location,
    cta: input.cta,
    auditMode: input.auditMode,
    painPoints: input.painPoints,
    reportRequirements: input.reportRequirements,
    sourceUrls: input.sourceUrls,
    notes: input.notes,
    websiteSnapshot,
    sourceSnapshots,
    intentSignals,
    executiveSummary,
    findings,
    customSections,
    outreachSequence,
    status: "Drafted",
    checklist: buildDefaultChecklist(input.auditMode)
  });
}

function summarizeDashboard() {
  const latestReport = db.reports[0] || null;
  const readyToSend = db.reports.filter(report => report.status === "Ready to Send" || report.status === "Live").length;

  return latestReport
    ? {
        activeReports: db.reports.length,
        readyToSend,
        latestCompany: latestReport.companyName,
        latestLocation: latestReport.location,
        sourceCoverage: 1 + (latestReport.sourceSnapshots?.length || 0)
      }
    : {
        activeReports: 0,
        readyToSend: 0,
        latestCompany: null,
        latestLocation: null,
        sourceCoverage: 0
      };
}

export function getHealth() {
  return {
    ok: true,
    service: "mailoutreach-server",
    updatedAt: new Date().toISOString()
  };
}

export function getDashboard() {
  const latestReport = db.reports[0] || null;

  return {
    profile: db.profile,
    summary: summarizeDashboard(),
    latestReport,
    recentRequests: db.requests.slice(0, 8),
    activity: db.activity.slice(0, 10),
    reportHistory: db.reports.slice(0, 12),
    availableStatuses: reportStatuses
  };
}

export function getPlanById(reportId) {
  return findReport(reportId);
}

export async function submitSetupRequest(payload) {
  const report = await buildReportRecord(payload);
  const request = {
    id: createId("request"),
    reportId: report.id,
    createdAt: report.createdAt,
    companyName: report.companyName,
    websiteUrl: report.websiteUrl,
    location: report.location,
    status: report.status
  };

  db.requests.unshift(request);
  db.reports.unshift(report);
  logActivity("New audit report drafted", `${report.companyName} was analyzed for a ${report.auditMode.toLowerCase()} outreach report.`, report.createdAt);
  logActivity("3-email sequence generated", `${formatDate(new Date(report.createdAt))}: outreach copy prepared for ${report.companyName}.`, report.createdAt);
  persistDb();
  return { request, plan: report };
}

export function updatePlanStatus(reportId, nextStatus) {
  if (!reportStatuses.includes(nextStatus)) {
    throw new Error("Invalid report status");
  }

  const report = findReport(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  report.status = nextStatus;

  const request = findRequestByReport(reportId);
  if (request) {
    request.status = nextStatus;
  }

  logActivity("Report status updated", `${report.companyName} moved to ${nextStatus}.`);
  persistDb();
  return normalizeReport(report);
}

export function updateChecklistItem(reportId, itemId, completed) {
  const report = findReport(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  const item = report.checklist.find(entry => entry.id === itemId);
  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.completed = Boolean(completed);
  item.completedAt = item.completed ? new Date().toISOString() : null;
  report.checklistCompleted = report.checklist.filter(entry => entry.completed).length;
  report.progressPercent = report.checklist.length > 0 ? Math.round((report.checklistCompleted / report.checklist.length) * 100) : 0;

  logActivity(item.completed ? "Report checklist completed" : "Report checklist reopened", `${report.companyName}: ${item.label}`);
  persistDb();
  return normalizeReport(report);
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "db.json");

const planStatuses = ["Planned", "Purchasing", "DNS setup", "Warmup", "Live"];

const baseDb = {
  profile: {
    productName: "Outbound Forge",
    supportEmail: "ops@outboundforge.app"
  },
  requests: [],
  plans: [],
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
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPlanStatusLabel(progress) {
  const clamped = clamp(progress, 0, planStatuses.length - 1);
  return planStatuses[clamped];
}

function buildWarmupPlan(mailboxes, dailyPerMailbox) {
  const steps = [
    { week: "Week 1", sendPerMailbox: clamp(Math.round(dailyPerMailbox * 0.25), 12, dailyPerMailbox) },
    { week: "Week 2", sendPerMailbox: clamp(Math.round(dailyPerMailbox * 0.45), 18, dailyPerMailbox) },
    { week: "Week 3", sendPerMailbox: clamp(Math.round(dailyPerMailbox * 0.7), 24, dailyPerMailbox) },
    { week: "Week 4", sendPerMailbox: dailyPerMailbox }
  ];

  return steps.map(step => ({
    ...step,
    totalDailyVolume: step.sendPerMailbox * mailboxes
  }));
}

function buildChecklist(domainCount, mailboxCount) {
  return [
    `Buy or connect ${domainCount} sending domains`,
    `Create ${mailboxCount} Google or Microsoft mailboxes`,
    "Apply SPF, DKIM, and DMARC records",
    "Connect inboxes to your sequencer",
    "Warm inboxes before full campaign launch"
  ];
}

function normalizeChecklist(items) {
  return (items || []).map(item => {
    if (typeof item === "string") {
      return {
        id: createId("task"),
        label: item,
        completed: false,
        completedAt: null
      };
    }

    return {
      id: item.id || createId("task"),
      label: item.label || item.title || "Checklist item",
      completed: Boolean(item.completed),
      completedAt: item.completedAt || null
    };
  });
}

function buildRecommendations(teamType, totalDailyCapacity) {
  const teamSpecific = {
    "Lead gen agency": "Segment infrastructure by client and keep one workspace per client cluster.",
    "SaaS sales team": "Align mailbox assignment to SDR pods so ownership stays clear.",
    "Founder-led outbound": "Keep the first stack lean and avoid overbuying domains before reply quality is proven.",
    "Recruiting team": "Separate recruiter outreach from nurture traffic to protect domain reputation."
  };

  const capacityAdvice =
    totalDailyCapacity > 2500
      ? "This is a higher-volume setup, so add deliverability monitoring before scaling beyond the first warmup cycle."
      : "This is a moderate-volume setup, so the main risk is inconsistency rather than overcapacity.";

  return [
    teamSpecific[teamType] || "Keep domain ownership and mailbox purpose clearly documented.",
    capacityAdvice,
    "Review DNS authentication before connecting inboxes to any sequencer."
  ];
}

function buildRequestStatus(planStatus) {
  return planStatus === "Live" ? "Live" : `${planStatus} in progress`;
}

function normalizePlan(plan) {
  const checklist = normalizeChecklist(plan.checklist);
  const status = planStatuses.includes(plan.status) ? plan.status : "Planned";
  const stageIndex = planStatuses.indexOf(status);
  const progress = stageIndex === -1 ? 0 : stageIndex;
  const checklistCompleted = checklist.filter(item => item.completed).length;
  const progressPercent = checklist.length > 0 ? Math.round((checklistCompleted / checklist.length) * 100) : 0;

  return {
    ...plan,
    status,
    progress,
    checklist,
    checklistCompleted,
    checklistTotal: checklist.length,
    progressPercent
  };
}

function createPlan(payload) {
  const contactsPerMonth = Number(payload.contactsPerMonth);
  const sendingDays = Number(payload.sendingDays);
  const dailyPerMailbox = Number(payload.dailyPerMailbox);
  const mailboxesPerDomain = Number(payload.mailboxesPerDomain);

  const dailyTarget = Math.ceil(contactsPerMonth / sendingDays);
  const recommendedMailboxes = Math.max(1, Math.ceil(dailyTarget / dailyPerMailbox));
  const recommendedDomains = Math.max(1, Math.ceil(recommendedMailboxes / mailboxesPerDomain));
  const roundedMailboxCount = recommendedDomains * mailboxesPerDomain;
  const totalDailyCapacity = roundedMailboxCount * dailyPerMailbox;
  const monthlyMailboxCost = roundedMailboxCount * 2.5;
  const monthlyDomainCost = recommendedDomains * 12;
  const rampWeeks = totalDailyCapacity > 2500 ? 4 : 3;

  return normalizePlan({
    id: createId("plan"),
    createdAt: new Date().toISOString(),
    companyName: payload.companyName,
    ownerName: payload.ownerName,
    email: payload.email,
    teamType: payload.teamType,
    platform: payload.platform,
    notes: payload.notes,
    contactsPerMonth,
    sendingDays,
    dailyPerMailbox,
    mailboxesPerDomain,
    dailyTarget,
    recommendedDomains,
    recommendedMailboxes: roundedMailboxCount,
    totalDailyCapacity,
    monthlyMailboxCost,
    monthlyDomainCost,
    estimatedMonthlyInfraCost: monthlyMailboxCost + monthlyDomainCost,
    rampWeeks,
    status: "Planned",
    checklist: buildChecklist(recommendedDomains, roundedMailboxCount),
    warmupPlan: buildWarmupPlan(roundedMailboxCount, dailyPerMailbox),
    recommendations: buildRecommendations(payload.teamType, totalDailyCapacity)
  });
}

function logActivity(title, body, createdAt = new Date().toISOString()) {
  db.activity.unshift({
    id: createId("activity"),
    createdAt,
    title,
    body
  });
}

function findPlan(planId) {
  return db.plans.find(plan => plan.id === planId) || null;
}

function findRequestByPlan(planId) {
  return db.requests.find(request => request.planId === planId) || null;
}

function syncStoredRecords() {
  db.plans = db.plans.map(normalizePlan);
  db.requests = db.requests.map(request => {
    const linkedPlan = request.planId ? findPlan(request.planId) : null;
    return {
      ...request,
      planId: request.planId || null,
      status: request.status || (linkedPlan ? buildRequestStatus(linkedPlan.status) : "Plan generated")
    };
  });
  persistDb();
}

function seedInitialPlan() {
  if (db.plans.length > 0) {
    syncStoredRecords();
    return;
  }

  const plan = createPlan({
    ownerName: "Alex Carter",
    companyName: "Northlane Growth",
    email: "alex@northlanegrowth.com",
    teamType: "Lead gen agency",
    platform: "Google Workspace",
    contactsPerMonth: 30000,
    sendingDays: 22,
    dailyPerMailbox: 35,
    mailboxesPerDomain: 4,
    notes: "Need a reliable setup for multiple client campaigns."
  });

  db.requests.push({
    id: createId("request"),
    planId: plan.id,
    createdAt: plan.createdAt,
    ownerName: plan.ownerName,
    companyName: plan.companyName,
    email: plan.email,
    status: buildRequestStatus(plan.status)
  });
  db.plans.unshift(plan);
  logActivity("Starter workspace created", `${plan.recommendedDomains} domains and ${plan.recommendedMailboxes} mailboxes recommended for ${plan.companyName}.`, plan.createdAt);
  logActivity("Warmup schedule drafted", `Ramp plan spans ${plan.rampWeeks} weeks before full daily volume.`, plan.createdAt);
  persistDb();
}

seedInitialPlan();

function summarizeDashboard() {
  const latestPlan = db.plans[0] || null;
  const totalMonthlyInfraCost = db.plans.reduce((sum, plan) => sum + plan.estimatedMonthlyInfraCost, 0);
  const livePlans = db.plans.filter(plan => plan.status === "Live").length;

  return latestPlan
    ? {
        activePlans: db.plans.length,
        livePlans,
        latestCompany: latestPlan.companyName,
        totalDailyCapacity: latestPlan.totalDailyCapacity,
        mailboxCost: latestPlan.monthlyMailboxCost,
        totalMonthlyInfraCost
      }
    : {
        activePlans: 0,
        livePlans: 0,
        latestCompany: null,
        totalDailyCapacity: 0,
        mailboxCost: 0,
        totalMonthlyInfraCost: 0
      };
}

export function getHealth() {
  return {
    ok: true,
    service: "outbound-forge-server",
    updatedAt: new Date().toISOString()
  };
}

export function getDashboard() {
  const latestPlan = db.plans[0] || null;

  return {
    profile: db.profile,
    summary: summarizeDashboard(),
    latestPlan,
    recentRequests: db.requests.slice(0, 6),
    activity: db.activity.slice(0, 10),
    planHistory: db.plans.slice(0, 12),
    availableStatuses: planStatuses
  };
}

export function getPlanById(planId) {
  return findPlan(planId);
}

export function submitSetupRequest(payload) {
  const plan = createPlan(payload);
  const request = {
    id: createId("request"),
    planId: plan.id,
    createdAt: new Date().toISOString(),
    ownerName: payload.ownerName,
    companyName: payload.companyName,
    email: payload.email,
    status: buildRequestStatus(plan.status)
  };

  db.requests.unshift(request);
  db.plans.unshift(plan);
  logActivity("New infrastructure plan generated", `${plan.companyName} now has a recommended stack of ${plan.recommendedDomains} domains and ${plan.recommendedMailboxes} mailboxes.`, request.createdAt);
  logActivity("Checklist ready for ops handoff", `${formatDate(new Date(request.createdAt))}: authentication, warmup, and sequencer connection tasks prepared.`, request.createdAt);

  persistDb();
  return { request, plan };
}

export function updatePlanStatus(planId, nextStatus) {
  if (!planStatuses.includes(nextStatus)) {
    throw new Error("Invalid plan status");
  }

  const plan = findPlan(planId);
  if (!plan) {
    throw new Error("Plan not found");
  }

  plan.status = nextStatus;
  plan.progress = planStatuses.indexOf(nextStatus);

  const request = findRequestByPlan(planId);
  if (request) {
    request.status = buildRequestStatus(nextStatus);
  }

  logActivity("Plan status updated", `${plan.companyName} moved to ${nextStatus}.`);
  persistDb();
  return plan;
}

export function updateChecklistItem(planId, itemId, completed) {
  const plan = findPlan(planId);
  if (!plan) {
    throw new Error("Plan not found");
  }

  const item = plan.checklist.find(entry => entry.id === itemId);
  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.completed = Boolean(completed);
  item.completedAt = item.completed ? new Date().toISOString() : null;

  const checklistCompleted = plan.checklist.filter(entry => entry.completed).length;
  plan.checklistCompleted = checklistCompleted;
  plan.progressPercent = plan.checklist.length > 0 ? Math.round((checklistCompleted / plan.checklist.length) * 100) : 0;

  logActivity(
    item.completed ? "Checklist item completed" : "Checklist item reopened",
    `${plan.companyName}: ${item.label}`
  );

  persistDb();
  return plan;
}

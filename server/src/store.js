import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "db.json");

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

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

  return {
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
    checklist: buildChecklist(recommendedDomains, roundedMailboxCount),
    warmupPlan: buildWarmupPlan(roundedMailboxCount, dailyPerMailbox),
    recommendations: buildRecommendations(payload.teamType, totalDailyCapacity)
  };
}

function seedInitialPlan() {
  if (db.plans.length > 0) {
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
    createdAt: plan.createdAt,
    ownerName: plan.ownerName,
    companyName: plan.companyName,
    email: plan.email,
    status: "Plan generated"
  });
  db.plans.unshift(plan);
  db.activity.unshift(
    {
      id: createId("activity"),
      createdAt: plan.createdAt,
      title: "Starter workspace created",
      body: `${plan.recommendedDomains} domains and ${plan.recommendedMailboxes} mailboxes recommended for ${plan.companyName}.`
    },
    {
      id: createId("activity"),
      createdAt: plan.createdAt,
      title: "Warmup schedule drafted",
      body: `Ramp plan spans ${plan.rampWeeks} weeks before full daily volume.`
    }
  );
  persistDb();
}

seedInitialPlan();

export function getHealth() {
  return {
    ok: true,
    service: "outbound-forge-server",
    updatedAt: new Date().toISOString()
  };
}

export function getDashboard() {
  const latestPlan = db.plans[0] || null;
  const totalMonthlyInfraCost = db.plans.reduce((sum, plan) => sum + plan.estimatedMonthlyInfraCost, 0);

  return {
    profile: db.profile,
    summary: latestPlan
      ? {
          activePlans: db.plans.length,
          latestCompany: latestPlan.companyName,
          totalDailyCapacity: latestPlan.totalDailyCapacity,
          mailboxCost: latestPlan.monthlyMailboxCost,
          totalMonthlyInfraCost
        }
      : {
          activePlans: 0,
          latestCompany: null,
          totalDailyCapacity: 0,
          mailboxCost: 0,
          totalMonthlyInfraCost: 0
        },
    latestPlan,
    recentRequests: db.requests.slice(0, 6),
    activity: db.activity.slice(0, 6),
    planHistory: db.plans.slice(0, 12)
  };
}

export function submitSetupRequest(payload) {
  const request = {
    id: createId("request"),
    createdAt: new Date().toISOString(),
    ownerName: payload.ownerName,
    companyName: payload.companyName,
    email: payload.email,
    status: "Plan generated"
  };

  const plan = createPlan(payload);

  db.requests.unshift(request);
  db.plans.unshift(plan);
  db.activity.unshift(
    {
      id: createId("activity"),
      createdAt: request.createdAt,
      title: "New infrastructure plan generated",
      body: `${plan.companyName} now has a recommended stack of ${plan.recommendedDomains} domains and ${plan.recommendedMailboxes} mailboxes.`
    },
    {
      id: createId("activity"),
      createdAt: request.createdAt,
      title: "Checklist ready for ops handoff",
      body: `${formatDate(new Date(request.createdAt))}: authentication, warmup, and sequencer connection tasks prepared.`
    }
  );

  persistDb();
  return { request, plan };
}

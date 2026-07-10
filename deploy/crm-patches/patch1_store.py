#!/usr/bin/env python3
"""Patch store.js: add CRM arrays to baseDb/loadDb + append CRM functions"""
import re

path = "/opt/mailoutreach-ai/server/src/store.js"
with open(path, "r") as f:
    src = f.read()

# 1. Patch baseDb
src = src.replace(
    '  requests: [],\n  reports: [],\n  runs: [],\n  activity: []\n};',
    '  requests: [],\n  reports: [],\n  runs: [],\n  activity: [],\n  leads: [],\n  meetings: [],\n  crmActivity: []\n};'
)

# 2. Patch loadDb
src = src.replace(
    '      requests: Array.isArray(parsed.requests) ? parsed.requests : [],\n      reports: Array.isArray(parsed.reports) ? parsed.reports : [],\n      runs: Array.isArray(parsed.runs) ? parsed.runs : [],\n      activity: Array.isArray(parsed.activity) ? parsed.activity : []',
    '      requests: Array.isArray(parsed.requests) ? parsed.requests : [],\n      reports: Array.isArray(parsed.reports) ? parsed.reports : [],\n      runs: Array.isArray(parsed.runs) ? parsed.runs : [],\n      activity: Array.isArray(parsed.activity) ? parsed.activity : [],\n      leads: Array.isArray(parsed.leads) ? parsed.leads : [],\n      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],\n      crmActivity: Array.isArray(parsed.crmActivity) ? parsed.crmActivity : []'
)

# 3. Append CRM functions at end
crm_code = r'''
// ── CRM ───────────────────────────────────────────────────────────────────────

const CRM_STAGES = ["Upcoming", "Meeting", "Held", "Proposal", "Won", "Lost"];

function ensureCrm() {
  if (!Array.isArray(db.leads)) db.leads = [];
  if (!Array.isArray(db.meetings)) db.meetings = [];
  if (!Array.isArray(db.crmActivity)) db.crmActivity = [];
}

function pushCrmActivity(entry) {
  ensureCrm();
  db.crmActivity.push({ id: createId("crmact"), ...entry, createdAt: new Date().toISOString() });
  if (db.crmActivity.length > 300) db.crmActivity = db.crmActivity.slice(-300);
}

export function getCrmDashboard() {
  ensureCrm();
  const leads = db.leads;
  const meetings = db.meetings;
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => l.stage !== "Won" && l.stage !== "Lost").length;
  const totalMeetings = meetings.length;
  const wonMeetings = meetings.filter(m => m.outcome === "Won").length;
  const upcomingMeetings = meetings.filter(m => m.outcome === "Upcoming").length;
  const wonValue = meetings.filter(m => m.outcome === "Won").reduce((s, m) => s + (m.value || 0), 0);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const quietLeads = leads.filter(l => {
    if (l.stage === "Won" || l.stage === "Lost") return false;
    return new Date(l.lastActivity || l.createdAt).getTime() < sevenDaysAgo;
  }).slice(0, 8);
  const rightNow = Date.now();
  const sevenDaysAhead = rightNow + 7 * 24 * 60 * 60 * 1000;
  const comingUp = meetings.filter(m => {
    if (m.outcome !== "Upcoming") return false;
    const at = new Date(m.scheduledAt || 0).getTime();
    return at >= rightNow && at <= sevenDaysAhead;
  }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 5);
  const needsYou = leads.filter(l => {
    if (l.stage === "Won" || l.stage === "Lost") return false;
    return (l.activities || []).some(a => a.type === "reply" || a.type === "email");
  }).slice(0, 5);
  return { stats: { totalLeads, activeLeads, totalMeetings, wonMeetings, upcomingMeetings, wonValue }, quietLeads, comingUp, needsYou, recentActivity: [...db.crmActivity].reverse().slice(0, 20) };
}

export function getLeads({ search = "", stage = "", showLost = false } = {}) {
  ensureCrm();
  let leads = [...db.leads];
  if (!showLost) leads = leads.filter(l => l.stage !== "Lost");
  if (stage) leads = leads.filter(l => l.stage === stage);
  if (search) {
    const q = search.toLowerCase();
    leads = leads.filter(l => (l.name || "").toLowerCase().includes(q) || (l.company || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q));
  }
  return leads.reverse();
}

export function getLeadById(id) {
  ensureCrm();
  return db.leads.find(l => l.id === id) || null;
}

export function createLead(payload) {
  ensureCrm();
  const lead = { id: createId("lead"), name: String(payload.name || "").trim(), email: String(payload.email || "").trim(), company: String(payload.company || "").trim(), role: String(payload.role || "").trim(), websiteUrl: String(payload.websiteUrl || "").trim(), campaignName: String(payload.campaignName || "").trim(), reportId: payload.reportId || null, stage: "Upcoming", lastActivity: new Date().toISOString(), createdAt: new Date().toISOString(), activities: [], notes: String(payload.notes || "").trim() };
  db.leads.push(lead);
  pushCrmActivity({ leadId: lead.id, leadName: lead.name, type: "created", body: `Lead added: ${lead.company || lead.name}` });
  persistDb();
  return lead;
}

export function createLeadFromReport(reportId) {
  const report = findReport(reportId);
  if (!report) throw new Error("Report not found");
  ensureCrm();
  const existing = db.leads.find(l => l.reportId === reportId);
  if (existing) return existing;
  return createLead({ name: report.contactName || "", email: (report.enrichedEmails || [])[0] || "", company: report.companyName || "", websiteUrl: report.websiteUrl || "", campaignName: report.discoveredFromQuery || "", reportId, notes: "" });
}

export function updateLead(id, updates) {
  ensureCrm();
  const idx = db.leads.findIndex(l => l.id === id);
  if (idx === -1) throw new Error("Lead not found");
  const prev = { ...db.leads[idx] };
  const allowed = ["name", "email", "company", "role", "websiteUrl", "campaignName", "stage", "notes"];
  for (const key of allowed) { if (updates[key] !== undefined) db.leads[idx][key] = updates[key]; }
  db.leads[idx].lastActivity = new Date().toISOString();
  if (updates.stage && updates.stage !== prev.stage) {
    if (!CRM_STAGES.includes(updates.stage)) throw new Error("Invalid stage");
    pushCrmActivity({ leadId: id, leadName: db.leads[idx].name, type: "stage_change", body: `Stage: ${prev.stage} → ${updates.stage}` });
  }
  persistDb();
  return db.leads[idx];
}

export function logLeadActivity(id, type, body) {
  ensureCrm();
  const idx = db.leads.findIndex(l => l.id === id);
  if (idx === -1) throw new Error("Lead not found");
  if (!Array.isArray(db.leads[idx].activities)) db.leads[idx].activities = [];
  const entry = { id: createId("crmact"), type, body, createdAt: new Date().toISOString() };
  db.leads[idx].activities.push(entry);
  db.leads[idx].lastActivity = new Date().toISOString();
  pushCrmActivity({ leadId: id, leadName: db.leads[idx].name, type, body });
  persistDb();
  return db.leads[idx];
}

export function getMeetings({ outcome = "" } = {}) {
  ensureCrm();
  let meetings = [...db.meetings];
  if (outcome) meetings = meetings.filter(m => m.outcome === outcome);
  return meetings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createMeeting(payload) {
  ensureCrm();
  const meeting = { id: createId("meeting"), leadId: String(payload.leadId || ""), leadName: String(payload.leadName || ""), company: String(payload.company || ""), scheduledAt: payload.scheduledAt || new Date().toISOString(), outcome: "Upcoming", value: Number(payload.value) || 0, notes: String(payload.notes || ""), createdAt: new Date().toISOString() };
  db.meetings.push(meeting);
  if (meeting.leadId) {
    const leadIdx = db.leads.findIndex(l => l.id === meeting.leadId);
    if (leadIdx !== -1) {
      if (!Array.isArray(db.leads[leadIdx].activities)) db.leads[leadIdx].activities = [];
      db.leads[leadIdx].activities.push({ id: createId("crmact"), type: "meeting_booked", body: `Meeting booked: ${new Date(meeting.scheduledAt).toLocaleDateString()}`, createdAt: new Date().toISOString() });
      db.leads[leadIdx].lastActivity = new Date().toISOString();
      if (db.leads[leadIdx].stage === "Upcoming") db.leads[leadIdx].stage = "Meeting";
    }
  }
  pushCrmActivity({ leadId: meeting.leadId, leadName: meeting.leadName, type: "meeting_booked", body: `Meeting booked with ${meeting.company || meeting.leadName}` });
  persistDb();
  return meeting;
}

export function updateMeeting(id, updates) {
  ensureCrm();
  const idx = db.meetings.findIndex(m => m.id === id);
  if (idx === -1) throw new Error("Meeting not found");
  const prev = { ...db.meetings[idx] };
  const allowed = ["outcome", "value", "notes", "scheduledAt"];
  for (const key of allowed) { if (updates[key] !== undefined) db.meetings[idx][key] = updates[key]; }
  if (updates.outcome && updates.outcome !== prev.outcome) {
    const leadIdx = db.leads.findIndex(l => l.id === db.meetings[idx].leadId);
    if (leadIdx !== -1) {
      if (!Array.isArray(db.leads[leadIdx].activities)) db.leads[leadIdx].activities = [];
      const vStr = updates.value ? ` ($${Number(updates.value).toLocaleString()})` : "";
      db.leads[leadIdx].activities.push({ id: createId("crmact"), type: updates.outcome.toLowerCase().replace(/[^a-z0-9]+/g, "_"), body: `Meeting: ${updates.outcome}${vStr}`, createdAt: new Date().toISOString() });
      db.leads[leadIdx].lastActivity = new Date().toISOString();
      if (updates.outcome === "Won") db.leads[leadIdx].stage = "Won";
      else if (updates.outcome === "Held" && db.leads[leadIdx].stage === "Meeting") db.leads[leadIdx].stage = "Held";
    }
    pushCrmActivity({ leadId: db.meetings[idx].leadId, leadName: db.meetings[idx].leadName, type: updates.outcome.toLowerCase().replace(/[^a-z0-9]+/g, "_"), body: `Meeting marked ${updates.outcome}${updates.value ? ` ($${Number(updates.value).toLocaleString()})` : ""} — ${db.meetings[idx].company || db.meetings[idx].leadName}` });
  }
  persistDb();
  return db.meetings[idx];
}
'''

if "// ── CRM ──" not in src:
    src = src.rstrip() + "\n" + crm_code

with open(path, "w") as f:
    f.write(src)

print("store.js patched OK")

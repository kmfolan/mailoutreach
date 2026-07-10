#!/usr/bin/env python3
"""Patch index.js: add CRM imports + CRM API routes"""

path = "/opt/mailoutreach-ai/server/src/index.js"
with open(path, "r") as f:
    src = f.read()

# 1. Add CRM imports
old_import = '  getAuditPage\n} from "./store.js";'
new_import = '''  getAuditPage,
  getCrmDashboard,
  getLeads,
  getLeadById,
  createLead,
  createLeadFromReport,
  updateLead,
  logLeadActivity,
  getMeetings,
  createMeeting,
  updateMeeting
} from "./store.js";'''

src = src.replace(old_import, new_import)

# 2. Add CRM routes before the admin settings block
crm_routes = '''  // ── CRM routes ────────────────────────────────────────────────────────────

  if (req.method === "GET" && pathname === "/api/crm/dashboard") {
    sendJson(res, 200, { ok: true, ...getCrmDashboard() });
    return;
  }

  if (pathname === "/api/crm/leads") {
    if (req.method === "GET") {
      const search = requestUrl.searchParams.get("search") || "";
      const stage = requestUrl.searchParams.get("stage") || "";
      const showLost = requestUrl.searchParams.get("showLost") === "true";
      sendJson(res, 200, { ok: true, leads: getLeads({ search, stage, showLost }) });
      return;
    }
    if (req.method === "POST") {
      try {
        const payload = await collectJsonBody(req);
        const lead = createLead(payload);
        sendJson(res, 201, { ok: true, lead });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }
  }

  if (req.method === "POST" && pathname.startsWith("/api/crm/leads/from-report/")) {
    const segments = getPathSegments(pathname);
    const reportId = segments[4];
    try {
      const lead = createLeadFromReport(reportId);
      sendJson(res, 201, { ok: true, lead });
    } catch (error) {
      sendJson(res, error.message === "Report not found" ? 404 : 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/crm/leads/") && pathname.endsWith("/activity")) {
    try {
      const segments = getPathSegments(pathname);
      const leadId = segments[3];
      const payload = await collectJsonBody(req);
      const lead = logLeadActivity(leadId, payload.type || "note", payload.body || "");
      sendJson(res, 201, { ok: true, lead });
    } catch (error) {
      sendJson(res, error.message === "Lead not found" ? 404 : 400, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname.startsWith("/api/crm/leads/") && !pathname.includes("/from-report/")) {
    const segments = getPathSegments(pathname);
    const leadId = segments[3];
    if (req.method === "GET") {
      const lead = getLeadById(leadId);
      if (!lead) { sendJson(res, 404, { ok: false, error: "Lead not found" }); return; }
      sendJson(res, 200, { ok: true, lead });
      return;
    }
    if (req.method === "PATCH") {
      try {
        const payload = await collectJsonBody(req);
        const lead = updateLead(leadId, payload);
        sendJson(res, 200, { ok: true, lead });
      } catch (error) {
        sendJson(res, error.message === "Lead not found" ? 404 : 400, { ok: false, error: error.message });
      }
      return;
    }
  }

  if (pathname === "/api/crm/meetings") {
    if (req.method === "GET") {
      const outcome = requestUrl.searchParams.get("outcome") || "";
      sendJson(res, 200, { ok: true, meetings: getMeetings({ outcome }) });
      return;
    }
    if (req.method === "POST") {
      try {
        const payload = await collectJsonBody(req);
        const meeting = createMeeting(payload);
        sendJson(res, 201, { ok: true, meeting });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return;
    }
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/crm/meetings/")) {
    try {
      const segments = getPathSegments(pathname);
      const meetingId = segments[3];
      const payload = await collectJsonBody(req);
      const meeting = updateMeeting(meetingId, payload);
      sendJson(res, 200, { ok: true, meeting });
    } catch (error) {
      sendJson(res, error.message === "Meeting not found" ? 404 : 400, { ok: false, error: error.message });
    }
    return;
  }

  '''

marker = "  const ADMIN_SETTING_KEYS = ["
if "getCrmDashboard" not in src:
    src = src.replace(marker, crm_routes + marker)

with open(path, "w") as f:
    f.write(src)

print("index.js patched OK")

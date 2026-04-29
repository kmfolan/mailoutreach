const form = document.getElementById("setup-form");
const formStatus = document.getElementById("form-status");
const summaryCards = document.getElementById("summary-cards");
const planMetrics = document.getElementById("plan-metrics");
const planSummary = document.getElementById("plan-summary");
const checklistList = document.getElementById("checklist-list");
const findingsGrid = document.getElementById("recommendations-list");
const sourceGrid = document.getElementById("warmup-grid");
const sequenceList = document.getElementById("recent-requests");
const activityFeed = document.getElementById("activity-feed");
const planHistory = document.getElementById("plan-history");
const logoutButton = document.getElementById("logout-button");
const resetDraftButton = document.getElementById("reset-draft-button");
const copyPlanButton = document.getElementById("copy-plan-button");
const copyStatus = document.getElementById("copy-status");
const planStatusSelect = document.getElementById("plan-status-select");
const planStatusMessage = document.getElementById("plan-status-message");

const formDraftKey = "mailoutreach-form-draft";
let latestReport = null;
let availableStatuses = ["Researching", "Drafted", "Reviewing", "Ready to Send", "Live"];

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (response.status === 401) {
    window.location.href = "/";
    throw new Error("Authentication required");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function getFormPayload() {
  const formData = new FormData(form);
  return {
    companyName: formData.get("companyName")?.toString().trim(),
    websiteUrl: formData.get("websiteUrl")?.toString().trim(),
    location: formData.get("location")?.toString().trim(),
    cta: formData.get("cta")?.toString().trim(),
    auditMode: formData.get("auditMode")?.toString().trim(),
    painPoints: formData.get("painPoints")?.toString().trim(),
    sourceUrls: formData.get("sourceUrls")?.toString().trim(),
    reportRequirements: formData.get("reportRequirements")?.toString().trim(),
    notes: formData.get("notes")?.toString().trim() || ""
  };
}

function readDraft() {
  try {
    const raw = localStorage.getItem(formDraftKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  localStorage.setItem(formDraftKey, JSON.stringify(getFormPayload()));
}

function restoreDraft() {
  const draft = readDraft();
  if (!draft) {
    return;
  }

  for (const [key, value] of Object.entries(draft)) {
    const field = form.elements.namedItem(key);
    if (field && value !== undefined && value !== null) {
      field.value = String(value);
    }
  }

  formStatus.textContent = "Restored saved draft from this browser.";
  formStatus.className = "status-text info";
}

function syncStatusSelect(status) {
  planStatusSelect.innerHTML = availableStatuses
    .map(option => `<option value="${option}" ${option === status ? "selected" : ""}>${option}</option>`)
    .join("");
  planStatusSelect.disabled = !latestReport;
}

function renderSummary(summary) {
  summaryCards.innerHTML = `
    <article class="stat-card">
      <span class="label">Active reports</span>
      <strong>${summary.activeReports || 0}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Ready to send</span>
      <strong>${summary.readyToSend || 0}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Latest company</span>
      <strong>${summary.latestCompany || "None yet"}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Source coverage</span>
      <strong>${summary.sourceCoverage || 0}</strong>
    </article>
  `;
}

function renderChecklist(report) {
  if (!report || !report.checklist || report.checklist.length === 0) {
    checklistList.innerHTML = `<li class="empty-state">Checklist items appear after the first generated report.</li>`;
    return;
  }

  checklistList.innerHTML = report.checklist
    .map(item => `
      <li class="checklist-item ${item.completed ? "is-complete" : ""}">
        <label class="checklist-toggle">
          <input type="checkbox" data-checklist-id="${item.id}" ${item.completed ? "checked" : ""}>
          <span>${item.label}</span>
        </label>
      </li>
    `)
    .join("");
}

function renderFindings(report) {
  if (!report) {
    findingsGrid.innerHTML = `<article class="empty-state">Findings, custom sections, and intent signals will appear here.</article>`;
    return;
  }

  const findingsMarkup = (report.findings || [])
    .map(item => `
      <article class="insight-card">
        <div class="history-card-top">
          <strong>${item.title}</strong>
          <span class="status-pill status-${String(item.severity || "info").toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${item.severity}</span>
        </div>
        <p>${item.evidence}</p>
        <p><strong>Recommendation:</strong> ${item.recommendation}</p>
      </article>
    `)
    .join("");

  const sectionMarkup = (report.customSections || [])
    .map(section => `
      <article class="insight-card">
        <strong>${section.title}</strong>
        <ul class="stack-list compact-list">
          ${(section.bullets || []).map(item => `<li>${item}</li>`).join("")}
        </ul>
      </article>
    `)
    .join("");

  const intentMarkup = (report.intentSignals || []).length > 0
    ? `
      <article class="insight-card insight-card-wide">
        <strong>Intent signals</strong>
        <ul class="stack-list compact-list">
          ${report.intentSignals.map(item => `<li>${item}</li>`).join("")}
        </ul>
      </article>
    `
    : `
      <article class="insight-card insight-card-wide">
        <strong>Intent signals</strong>
        <p>No strong public intent signal was detected from the provided source set.</p>
      </article>
    `;

  findingsGrid.innerHTML = findingsMarkup + sectionMarkup + intentMarkup;
}

function renderSources(report) {
  if (!report) {
    sourceGrid.innerHTML = `<article class="empty-state">Source snapshots appear here after the first report run.</article>`;
    return;
  }

  const cards = [report.websiteSnapshot, ...(report.sourceSnapshots || [])]
    .filter(Boolean)
    .map(source => `
      <article class="warmup-card source-card">
        <span class="label">${source.url || "Source"}</span>
        <strong>${source.title || source.h1 || "No title captured"}</strong>
        <p>${source.description || source.notes?.[0] || "No meta description captured."}</p>
        <p>Status: ${source.reachable ? "reachable" : source.status || "unknown"}</p>
      </article>
    `)
    .join("");

  sourceGrid.innerHTML = cards || `<article class="empty-state">No sources were available to render.</article>`;
}

function renderSequence(report) {
  sequenceList.innerHTML = report && (report.outreachSequence || []).length > 0
    ? report.outreachSequence
        .map(item => `
          <article class="timeline-item">
            <strong>Email ${item.step}: ${item.subject}</strong>
            <p>${item.body.replace(/\n/g, "<br>")}</p>
          </article>
        `)
        .join("")
    : `<article class="empty-state">The 3-email outreach sequence will appear here.</article>`;
}

function renderActivity(items) {
  activityFeed.innerHTML = items.length > 0
    ? items
        .map(item => `
          <article class="timeline-item">
            <strong>${item.title}</strong>
            <time datetime="${item.createdAt}">${new Date(item.createdAt).toLocaleString()}</time>
            <p>${item.body}</p>
          </article>
        `)
        .join("")
    : `<article class="empty-state">No activity yet. Generate a report to populate this feed.</article>`;
}

function renderHistory(items) {
  planHistory.innerHTML = items.length > 0
    ? items
        .map(item => `
          <article class="history-card ${latestReport && latestReport.id === item.id ? "is-active" : ""}">
            <div class="history-card-top">
              <strong>${item.companyName}</strong>
              <span class="status-pill status-${item.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${item.status}</span>
            </div>
            <p>${item.location || "No location captured"}</p>
            <p>${item.auditMode || "Mixed"} report for CTA: ${item.cta || "n/a"}</p>
            <p>${(item.findings || []).length} findings, ${(item.customSections || []).length} custom sections</p>
            <button class="button button-ghost history-load-button" type="button" data-plan-id="${item.id}">Open report</button>
          </article>
        `)
        .join("")
    : `<article class="empty-state">Saved reports will appear here.</article>`;
}

function renderReport(report) {
  latestReport = report;

  if (!report) {
    planMetrics.innerHTML = `
      <article class="metric-card"><span class="label">Findings</span><strong>0</strong></article>
      <article class="metric-card"><span class="label">Custom sections</span><strong>0</strong></article>
      <article class="metric-card"><span class="label">Reviewed sources</span><strong>0</strong></article>
      <article class="metric-card"><span class="label">Sequence steps</span><strong>0</strong></article>
    `;
    planSummary.innerHTML = "<p>No report generated yet.</p>";
    syncStatusSelect("Drafted");
    renderChecklist(null);
    renderFindings(null);
    renderSources(null);
    renderSequence(null);
    planStatusMessage.textContent = "Generate a report before changing workflow stage.";
    planStatusMessage.className = "status-text";
    return;
  }

  syncStatusSelect(report.status);

  planMetrics.innerHTML = `
    <article class="metric-card">
      <span class="label">Findings</span>
      <strong>${(report.findings || []).length}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Custom sections</span>
      <strong>${(report.customSections || []).length}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Reviewed sources</span>
      <strong>${1 + (report.sourceSnapshots || []).length}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Sequence steps</span>
      <strong>${(report.outreachSequence || []).length}</strong>
    </article>
  `;

  planSummary.innerHTML = `
    <div class="summary-topline">
      <span class="status-pill status-${report.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${report.status}</span>
      <span class="progress-copy">${report.checklistCompleted || 0} / ${report.checklistTotal || 0} tasks complete</span>
    </div>
    <p>${report.executiveSummary}</p>
    <p><strong>CTA:</strong> ${report.cta}</p>
    <p><strong>Pain points:</strong> ${(report.painPoints || []).join(", ") || "None listed"}</p>
    <div class="progress-track" aria-hidden="true">
      <span class="progress-bar" style="width:${report.progressPercent || 0}%"></span>
    </div>
  `;

  renderChecklist(report);
  renderFindings(report);
  renderSources(report);
  renderSequence(report);
  planStatusMessage.textContent = `Managing report for ${report.companyName}.`;
  planStatusMessage.className = "status-text info";
}

async function loadReport(reportId) {
  const response = await requestJson(`/api/plans/${reportId}`);
  renderReport(response.plan);
}

async function loadDashboard() {
  await requestJson("/api/auth/session");
  const dashboard = await requestJson("/api/dashboard");
  availableStatuses = dashboard.availableStatuses || availableStatuses;
  renderSummary(dashboard.summary);
  renderReport(dashboard.latestReport);
  renderActivity(dashboard.activity);
  renderHistory(dashboard.reportHistory || []);
}

async function refreshDashboardAndKeepReport(reportId) {
  await loadDashboard();
  if (reportId) {
    await loadReport(reportId);
    const dashboard = await requestJson("/api/dashboard");
    renderActivity(dashboard.activity);
    renderHistory(dashboard.reportHistory || []);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  formStatus.textContent = "Generating report and outreach sequence...";
  formStatus.className = "status-text";

  try {
    const result = await requestJson("/api/setup-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(getFormPayload())
    });

    saveDraft();
    formStatus.textContent = "Report draft created and sequence generated.";
    formStatus.className = "status-text success";
    await loadDashboard();
    if (result.plan?.id) {
      await loadReport(result.plan.id);
      const dashboard = await requestJson("/api/dashboard");
      renderActivity(dashboard.activity);
      renderHistory(dashboard.reportHistory || []);
    }
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.className = "status-text error";
  }
}

function buildExportText() {
  if (!latestReport) {
    return "";
  }

  return [
    `MailOutreach report for ${latestReport.companyName}`,
    "",
    `Website: ${latestReport.websiteUrl}`,
    `Location: ${latestReport.location}`,
    `CTA: ${latestReport.cta}`,
    `Audit mode: ${latestReport.auditMode}`,
    `Status: ${latestReport.status}`,
    "",
    "Executive summary:",
    latestReport.executiveSummary,
    "",
    "Findings:",
    ...(latestReport.findings || []).map(item => `- ${item.title}: ${item.recommendation}`),
    "",
    "Custom report sections:",
    ...(latestReport.customSections || []).map(section => `- ${section.title}: ${(section.bullets || []).join(" | ")}`),
    "",
    "3-email sequence:",
    ...(latestReport.outreachSequence || []).map(item => `Email ${item.step} - ${item.subject}\n${item.body}`)
  ].join("\n");
}

async function handleCopyPlan() {
  if (!latestReport) {
    copyStatus.textContent = "Generate a report before copying.";
    copyStatus.className = "status-text error";
    return;
  }

  try {
    await navigator.clipboard.writeText(buildExportText());
    copyStatus.textContent = "Report and outreach sequence copied.";
    copyStatus.className = "status-text success";
  } catch {
    copyStatus.textContent = "Clipboard copy failed in this browser.";
    copyStatus.className = "status-text error";
  }
}

function handleResetDraft() {
  localStorage.removeItem(formDraftKey);
  form.reset();
  copyStatus.textContent = "Nothing copied yet.";
  copyStatus.className = "status-text";
  formStatus.textContent = "Draft cleared. Default values restored.";
  formStatus.className = "status-text info";
}

async function handleLogout() {
  try {
    await requestJson("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    window.location.href = "/";
  }
}

async function handleStatusChange() {
  if (!latestReport) {
    return;
  }

  planStatusMessage.textContent = "Saving workflow stage...";
  planStatusMessage.className = "status-text";

  try {
    const result = await requestJson(`/api/plans/${latestReport.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: planStatusSelect.value })
    });

    renderReport(result.plan);
    await refreshDashboardAndKeepReport(result.plan.id);
    planStatusMessage.textContent = `Workflow stage updated to ${result.plan.status}.`;
    planStatusMessage.className = "status-text success";
  } catch (error) {
    planStatusMessage.textContent = error.message;
    planStatusMessage.className = "status-text error";
  }
}

async function handleChecklistToggle(event) {
  const checkbox = event.target.closest("input[type='checkbox'][data-checklist-id]");
  if (!checkbox || !latestReport) {
    return;
  }

  const previousChecked = !checkbox.checked;
  try {
    const result = await requestJson(`/api/plans/${latestReport.id}/checklist/${checkbox.dataset.checklistId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: checkbox.checked })
    });

    renderReport(result.plan);
    await refreshDashboardAndKeepReport(result.plan.id);
  } catch (error) {
    checkbox.checked = previousChecked;
    planStatusMessage.textContent = error.message;
    planStatusMessage.className = "status-text error";
  }
}

async function handleHistoryClick(event) {
  const button = event.target.closest("[data-plan-id]");
  if (!button) {
    return;
  }

  try {
    await loadReport(button.dataset.planId);
    const dashboard = await requestJson("/api/dashboard");
    renderHistory(dashboard.reportHistory || []);
    planStatusMessage.textContent = `Loaded ${latestReport.companyName}.`;
    planStatusMessage.className = "status-text info";
  } catch (error) {
    planStatusMessage.textContent = error.message;
    planStatusMessage.className = "status-text error";
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

form.addEventListener("submit", handleSubmit);
form.addEventListener("input", saveDraft);
logoutButton.addEventListener("click", handleLogout);
resetDraftButton.addEventListener("click", handleResetDraft);
copyPlanButton.addEventListener("click", handleCopyPlan);
planStatusSelect.addEventListener("change", handleStatusChange);
checklistList.addEventListener("change", handleChecklistToggle);
planHistory.addEventListener("click", handleHistoryClick);

restoreDraft();
loadDashboard().catch(error => {
  formStatus.textContent = `Unable to load dashboard: ${error.message}`;
  formStatus.className = "status-text error";
});

registerServiceWorker();

const form = document.getElementById("setup-form");
const formStatus = document.getElementById("form-status");
const summaryCards = document.getElementById("summary-cards");
const planMetrics = document.getElementById("plan-metrics");
const planSummary = document.getElementById("plan-summary");
const checklistList = document.getElementById("checklist-list");
const recommendationsList = document.getElementById("recommendations-list");
const warmupGrid = document.getElementById("warmup-grid");
const recentRequests = document.getElementById("recent-requests");
const activityFeed = document.getElementById("activity-feed");
const planHistory = document.getElementById("plan-history");
const logoutButton = document.getElementById("logout-button");
const resetDraftButton = document.getElementById("reset-draft-button");
const copyPlanButton = document.getElementById("copy-plan-button");
const copyStatus = document.getElementById("copy-status");
const planStatusSelect = document.getElementById("plan-status-select");
const planStatusMessage = document.getElementById("plan-status-message");

const formDraftKey = "outbound-forge-form-draft";
let latestPlan = null;
let availableStatuses = ["Planned", "Purchasing", "DNS setup", "Warmup", "Live"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

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
    ownerName: formData.get("ownerName")?.toString().trim(),
    companyName: formData.get("companyName")?.toString().trim(),
    email: formData.get("email")?.toString().trim(),
    teamType: formData.get("teamType")?.toString().trim(),
    platform: formData.get("platform")?.toString().trim(),
    contactsPerMonth: Number(formData.get("contactsPerMonth")),
    sendingDays: Number(formData.get("sendingDays")),
    dailyPerMailbox: Number(formData.get("dailyPerMailbox")),
    mailboxesPerDomain: Number(formData.get("mailboxesPerDomain")),
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

function renderSummary(summary) {
  summaryCards.innerHTML = `
    <article class="stat-card">
      <span class="label">Active plans</span>
      <strong>${formatNumber(summary.activePlans)}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Live plans</span>
      <strong>${formatNumber(summary.livePlans || 0)}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Latest company</span>
      <strong>${summary.latestCompany || "None yet"}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Portfolio infra cost</span>
      <strong>${formatCurrency(summary.totalMonthlyInfraCost)}</strong>
    </article>
  `;
}

function syncStatusSelect(status) {
  planStatusSelect.innerHTML = availableStatuses
    .map(option => `<option value="${option}" ${option === status ? "selected" : ""}>${option}</option>`)
    .join("");
  planStatusSelect.disabled = !latestPlan;
}

function renderChecklist(plan) {
  if (!plan || !plan.checklist || plan.checklist.length === 0) {
    checklistList.innerHTML = `<li class="empty-state">Execution checklist appears after the first generated plan.</li>`;
    return;
  }

  checklistList.innerHTML = plan.checklist
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

function renderRecommendations(plan) {
  recommendationsList.innerHTML = plan && (plan.recommendations || []).length > 0
    ? plan.recommendations.map(item => `<li>${item}</li>`).join("")
    : `<li class="empty-state">Operator recommendations appear after the first generated plan.</li>`;
}

function renderWarmup(plan) {
  warmupGrid.innerHTML = plan && (plan.warmupPlan || []).length > 0
    ? plan.warmupPlan
        .map(item => `
          <article class="warmup-card">
            <span class="label">${item.week}</span>
            <strong>${formatNumber(item.sendPerMailbox)}</strong>
            <p>emails per mailbox / day</p>
            <p>Total safe volume: ${formatNumber(item.totalDailyVolume)} / day</p>
          </article>
        `)
        .join("")
    : `<article class="empty-state">Warmup recommendations will appear here.</article>`;
}

function renderPlan(plan) {
  latestPlan = plan;

  if (!plan) {
    planMetrics.innerHTML = "";
    planSummary.innerHTML = "<p>No plan generated yet.</p>";
    renderChecklist(null);
    renderRecommendations(null);
    renderWarmup(null);
    syncStatusSelect("Planned");
    planStatusMessage.textContent = "Generate a plan before changing rollout status.";
    planStatusMessage.className = "status-text";
    return;
  }

  syncStatusSelect(plan.status);

  planMetrics.innerHTML = `
    <article class="metric-card">
      <span class="label">Domains</span>
      <strong>${formatNumber(plan.recommendedDomains)}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Mailboxes</span>
      <strong>${formatNumber(plan.recommendedMailboxes)}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Daily capacity</span>
      <strong>${formatNumber(plan.totalDailyCapacity)}</strong>
    </article>
    <article class="metric-card">
      <span class="label">Infra cost</span>
      <strong>${formatCurrency(plan.estimatedMonthlyInfraCost)}</strong>
    </article>
  `;

  planSummary.innerHTML = `
    <div class="summary-topline">
      <span class="status-pill status-${plan.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${plan.status}</span>
      <span class="progress-copy">${plan.checklistCompleted || 0} / ${plan.checklistTotal || 0} tasks complete</span>
    </div>
    <p>
      ${plan.companyName} should start with <strong>${plan.recommendedDomains} domains</strong>,
      <strong>${plan.recommendedMailboxes} mailboxes</strong>, and a warmup ramp of
      <strong>${plan.rampWeeks} weeks</strong>.
    </p>
    <p>
      Stack assumption: <strong>${plan.platform}</strong>, <strong>${plan.dailyPerMailbox}</strong> emails per mailbox per day,
      and <strong>${plan.mailboxesPerDomain}</strong> mailboxes per domain.
    </p>
    <div class="progress-track" aria-hidden="true">
      <span class="progress-bar" style="width:${plan.progressPercent || 0}%"></span>
    </div>
  `;

  renderChecklist(plan);
  renderRecommendations(plan);
  renderWarmup(plan);
  planStatusMessage.textContent = `Managing rollout for ${plan.companyName}.`;
  planStatusMessage.className = "status-text info";
}

function renderRecentRequests(items) {
  recentRequests.innerHTML = items.length > 0
    ? items
        .map(item => `
          <article class="timeline-item">
            <strong>${item.companyName}</strong>
            <p>${item.ownerName} - ${item.email}</p>
            <p>${item.status}</p>
          </article>
        `)
        .join("")
    : `<article class="empty-state">No setup requests saved yet.</article>`;
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
    : `<article class="empty-state">No activity yet. Generate a plan to populate this feed.</article>`;
}

function renderPlanHistory(items) {
  planHistory.innerHTML = items.length > 0
    ? items
        .map(item => `
          <article class="history-card ${latestPlan && latestPlan.id === item.id ? "is-active" : ""}">
            <div class="history-card-top">
              <strong>${item.companyName}</strong>
              <span class="status-pill status-${item.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${item.status}</span>
            </div>
            <p>${new Date(item.createdAt).toLocaleString()}</p>
            <p>${formatNumber(item.recommendedDomains)} domains - ${formatNumber(item.recommendedMailboxes)} mailboxes</p>
            <p>${formatNumber(item.totalDailyCapacity)} daily capacity - ${formatCurrency(item.estimatedMonthlyInfraCost)} / month</p>
            <p>${item.checklistCompleted || 0} / ${item.checklistTotal || 0} rollout tasks complete</p>
            <button class="button button-ghost history-load-button" type="button" data-plan-id="${item.id}">Open plan</button>
          </article>
        `)
        .join("")
    : `<article class="empty-state">Plan history will populate after the first generated request.</article>`;
}

async function loadPlan(planId) {
  const response = await requestJson(`/api/plans/${planId}`);
  renderPlan(response.plan);
}

async function loadDashboard() {
  await requestJson("/api/auth/session");
  const dashboard = await requestJson("/api/dashboard");
  availableStatuses = dashboard.availableStatuses || availableStatuses;
  renderSummary(dashboard.summary);
  renderPlan(dashboard.latestPlan);
  renderRecentRequests(dashboard.recentRequests);
  renderActivity(dashboard.activity);
  renderPlanHistory(dashboard.planHistory || []);
}

async function refreshDashboardAndKeepPlan(planId) {
  await loadDashboard();
  if (planId) {
    await loadPlan(planId);
    const dashboard = await requestJson("/api/dashboard");
    renderRecentRequests(dashboard.recentRequests);
    renderActivity(dashboard.activity);
    renderPlanHistory(dashboard.planHistory || []);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  formStatus.textContent = "Generating plan...";
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
    formStatus.textContent = "Plan generated and workspace updated.";
    formStatus.className = "status-text success";
    await loadDashboard();
    if (result.plan?.id) {
      await loadPlan(result.plan.id);
      const dashboard = await requestJson("/api/dashboard");
      renderRecentRequests(dashboard.recentRequests);
      renderActivity(dashboard.activity);
      renderPlanHistory(dashboard.planHistory || []);
    }
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.className = "status-text error";
  }
}

function buildPlanExportText() {
  if (!latestPlan) {
    return "";
  }

  const checklist = (latestPlan.checklist || [])
    .map(item => `- [${item.completed ? "x" : " "}] ${item.label}`)
    .join("\n");
  const recommendations = (latestPlan.recommendations || []).map(item => `- ${item}`).join("\n");
  const warmup = (latestPlan.warmupPlan || [])
    .map(item => `${item.week}: ${formatNumber(item.sendPerMailbox)} per mailbox/day, ${formatNumber(item.totalDailyVolume)} total/day`)
    .join("\n");

  return [
    `Outbound Forge Plan for ${latestPlan.companyName}`,
    "",
    `Owner: ${latestPlan.ownerName}`,
    `Platform: ${latestPlan.platform}`,
    `Status: ${latestPlan.status}`,
    `Recommended domains: ${latestPlan.recommendedDomains}`,
    `Recommended mailboxes: ${latestPlan.recommendedMailboxes}`,
    `Daily capacity: ${formatNumber(latestPlan.totalDailyCapacity)}`,
    `Estimated monthly infra cost: ${formatCurrency(latestPlan.estimatedMonthlyInfraCost)}`,
    "",
    "Recommendations:",
    recommendations || "- None",
    "",
    "Checklist:",
    checklist || "- None",
    "",
    "Warmup ramp:",
    warmup || "- None"
  ].join("\n");
}

async function handleCopyPlan() {
  if (!latestPlan) {
    copyStatus.textContent = "Generate a plan before copying.";
    copyStatus.className = "status-text error";
    return;
  }

  try {
    await navigator.clipboard.writeText(buildPlanExportText());
    copyStatus.textContent = "Plan summary copied to clipboard.";
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
  if (!latestPlan) {
    return;
  }

  planStatusMessage.textContent = "Saving rollout stage...";
  planStatusMessage.className = "status-text";

  try {
    const result = await requestJson(`/api/plans/${latestPlan.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: planStatusSelect.value })
    });

    renderPlan(result.plan);
    await refreshDashboardAndKeepPlan(result.plan.id);
    planStatusMessage.textContent = `Status updated to ${result.plan.status}.`;
    planStatusMessage.className = "status-text success";
  } catch (error) {
    planStatusMessage.textContent = error.message;
    planStatusMessage.className = "status-text error";
  }
}

async function handleChecklistToggle(event) {
  const checkbox = event.target.closest("input[type='checkbox'][data-checklist-id]");
  if (!checkbox || !latestPlan) {
    return;
  }

  const previousChecked = !checkbox.checked;
  try {
    const result = await requestJson(`/api/plans/${latestPlan.id}/checklist/${checkbox.dataset.checklistId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: checkbox.checked })
    });

    renderPlan(result.plan);
    await refreshDashboardAndKeepPlan(result.plan.id);
  } catch (error) {
    checkbox.checked = previousChecked;
    planStatusMessage.textContent = error.message;
    planStatusMessage.className = "status-text error";
  }
}

async function handlePlanHistoryClick(event) {
  const button = event.target.closest("[data-plan-id]");
  if (!button) {
    return;
  }

  try {
    await loadPlan(button.dataset.planId);
    const dashboard = await requestJson("/api/dashboard");
    renderPlanHistory(dashboard.planHistory || []);
    planStatusMessage.textContent = `Loaded ${latestPlan.companyName}.`;
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
planHistory.addEventListener("click", handlePlanHistoryClick);

restoreDraft();
loadDashboard().catch(error => {
  formStatus.textContent = `Unable to load dashboard: ${error.message}`;
  formStatus.className = "status-text error";
});

registerServiceWorker();

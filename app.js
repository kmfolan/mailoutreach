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

const formDraftKey = "outbound-forge-form-draft";
let latestPlan = null;

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
      <span class="label">Latest company</span>
      <strong>${summary.latestCompany || "None yet"}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Daily capacity</span>
      <strong>${formatNumber(summary.totalDailyCapacity)}</strong>
    </article>
    <article class="stat-card">
      <span class="label">Portfolio infra cost</span>
      <strong>${formatCurrency(summary.totalMonthlyInfraCost)}</strong>
    </article>
  `;
}

function renderPlan(plan) {
  latestPlan = plan;

  if (!plan) {
    planMetrics.innerHTML = "";
    planSummary.innerHTML = "<p>No plan generated yet.</p>";
    checklistList.innerHTML = `<li class="empty-state">Execution checklist appears after the first generated plan.</li>`;
    recommendationsList.innerHTML = `<li class="empty-state">Operator recommendations appear after the first generated plan.</li>`;
    warmupGrid.innerHTML = "";
    return;
  }

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
    <p>
      ${plan.companyName} should start with <strong>${plan.recommendedDomains} domains</strong>,
      <strong>${plan.recommendedMailboxes} mailboxes</strong>, and a warmup ramp of
      <strong>${plan.rampWeeks} weeks</strong>. This supports roughly
      <strong>${formatNumber(plan.contactsPerMonth)}</strong> contacts per month across
      <strong>${plan.sendingDays}</strong> sending days.
    </p>
    <p>
      Stack assumption: <strong>${plan.platform}</strong>, <strong>${plan.dailyPerMailbox}</strong> emails per mailbox per day,
      and <strong>${plan.mailboxesPerDomain}</strong> mailboxes per domain.
    </p>
  `;

  checklistList.innerHTML = (plan.checklist || []).length > 0
    ? plan.checklist.map(item => `<li>${item}</li>`).join("")
    : `<li class="empty-state">No checklist was returned.</li>`;

  recommendationsList.innerHTML = (plan.recommendations || []).length > 0
    ? plan.recommendations.map(item => `<li>${item}</li>`).join("")
    : `<li class="empty-state">No operator recommendations were returned.</li>`;

  warmupGrid.innerHTML = (plan.warmupPlan || [])
    .map(item => `
      <article class="warmup-card">
        <span class="label">${item.week}</span>
        <strong>${formatNumber(item.sendPerMailbox)}</strong>
        <p>emails per mailbox / day</p>
        <p>Total safe volume: ${formatNumber(item.totalDailyVolume)} / day</p>
      </article>
    `)
    .join("");
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
          <article class="history-card">
            <strong>${item.companyName}</strong>
            <p>${new Date(item.createdAt).toLocaleString()}</p>
            <p>${formatNumber(item.recommendedDomains)} domains - ${formatNumber(item.recommendedMailboxes)} mailboxes</p>
            <p>${formatNumber(item.totalDailyCapacity)} daily capacity - ${formatCurrency(item.estimatedMonthlyInfraCost)} / month</p>
          </article>
        `)
        .join("")
    : `<article class="empty-state">Plan history will populate after the first generated request.</article>`;
}

async function loadDashboard() {
  await requestJson("/api/auth/session");
  const dashboard = await requestJson("/api/dashboard");
  renderSummary(dashboard.summary);
  renderPlan(dashboard.latestPlan);
  renderRecentRequests(dashboard.recentRequests);
  renderActivity(dashboard.activity);
  renderPlanHistory(dashboard.planHistory || []);
}

async function handleSubmit(event) {
  event.preventDefault();
  formStatus.textContent = "Generating plan...";
  formStatus.className = "status-text";

  try {
    await requestJson("/api/setup-request", {
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
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.className = "status-text error";
  }
}

function buildPlanExportText() {
  if (!latestPlan) {
    return "";
  }

  const checklist = (latestPlan.checklist || []).map(item => `- ${item}`).join("\n");
  const recommendations = (latestPlan.recommendations || []).map(item => `- ${item}`).join("\n");
  const warmup = (latestPlan.warmupPlan || [])
    .map(item => `${item.week}: ${formatNumber(item.sendPerMailbox)} per mailbox/day, ${formatNumber(item.totalDailyVolume)} total/day`)
    .join("\n");

  return [
    `Outbound Forge Plan for ${latestPlan.companyName}`,
    "",
    `Owner: ${latestPlan.ownerName}`,
    `Platform: ${latestPlan.platform}`,
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

restoreDraft();
loadDashboard().catch(error => {
  formStatus.textContent = `Unable to load dashboard: ${error.message}`;
  formStatus.className = "status-text error";
});

registerServiceWorker();

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
  if (!plan) {
    planMetrics.innerHTML = "";
    planSummary.innerHTML = "<p>No plan generated yet.</p>";
    checklistList.innerHTML = "";
    recommendationsList.innerHTML = "";
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

  checklistList.innerHTML = plan.checklist
    .map(item => `<li>${item}</li>`)
    .join("");

  recommendationsList.innerHTML = (plan.recommendations || [])
    .map(item => `<li>${item}</li>`)
    .join("");

  warmupGrid.innerHTML = plan.warmupPlan
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
  recentRequests.innerHTML = items
    .map(item => `
      <article class="timeline-item">
        <strong>${item.companyName}</strong>
        <p>${item.ownerName} · ${item.email}</p>
        <p>${item.status}</p>
      </article>
    `)
    .join("");
}

function renderActivity(items) {
  activityFeed.innerHTML = items
    .map(item => `
      <article class="timeline-item">
        <strong>${item.title}</strong>
        <time datetime="${item.createdAt}">${new Date(item.createdAt).toLocaleString()}</time>
        <p>${item.body}</p>
      </article>
    `)
    .join("");
}

function renderPlanHistory(items) {
  planHistory.innerHTML = items
    .map(item => `
      <article class="history-card">
        <strong>${item.companyName}</strong>
        <p>${new Date(item.createdAt).toLocaleString()}</p>
        <p>${formatNumber(item.recommendedDomains)} domains · ${formatNumber(item.recommendedMailboxes)} mailboxes</p>
        <p>${formatNumber(item.totalDailyCapacity)} daily capacity · ${formatCurrency(item.estimatedMonthlyInfraCost)} / month</p>
      </article>
    `)
    .join("");
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

    formStatus.textContent = "Plan generated and workspace updated.";
    formStatus.className = "status-text success";
    await loadDashboard();
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.className = "status-text error";
  }
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
logoutButton.addEventListener("click", handleLogout);

loadDashboard().catch(error => {
  formStatus.textContent = `Unable to load dashboard: ${error.message}`;
  formStatus.className = "status-text error";
});

registerServiceWorker();

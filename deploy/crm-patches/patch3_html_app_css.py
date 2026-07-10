#!/usr/bin/env python3
"""Patch index.html: add CRM nav link and Add-to-CRM button"""

path = "/opt/mailoutreach-ai/index.html"
with open(path, "r") as f:
    src = f.read()

# 1. Add CRM nav link
src = src.replace(
    '<a href="#history">History</a>\n        <a href="#admin">Admin</a>',
    '<a href="#history">History</a>\n        <a href="#crm" id="crm-nav-link">CRM</a>\n        <a href="#admin">Admin</a>'
)

# 2. Add "Add to CRM" button after "Copy report + sequence"
src = src.replace(
    '<button class="button button-ghost" type="button" id="copy-plan-button">Copy report + sequence</button>\n            <p id="copy-status"',
    '<button class="button button-ghost" type="button" id="copy-plan-button">Copy report + sequence</button>\n            <button class="button button-ghost" type="button" id="add-to-crm-button" style="display:none">Add to CRM</button>\n            <p id="copy-status"'
)

# 3. Insert CRM section + modals before the admin section
crm_html = '''      <!-- ── CRM ───────────────────────────────────────────────────────── -->
      <section id="crm" class="crm-section">
        <div class="crm-header">
          <div>
            <p class="eyebrow">Pipeline</p>
            <h2 style="max-width:none">CRM</h2>
          </div>
          <div class="crm-subnav">
            <button class="crm-tab is-active" data-crm-tab="home">Home</button>
            <button class="crm-tab" data-crm-tab="leads">Leads <span id="crm-lead-count" class="crm-badge">0</span></button>
            <button class="crm-tab" data-crm-tab="meetings">Meetings</button>
          </div>
          <button class="button button-ghost" id="crm-add-lead-btn" style="white-space:nowrap">+ Add lead</button>
        </div>
        <div class="crm-view is-active" id="crm-home-view">
          <div class="crm-stats-row" id="crm-home-stats"></div>
          <div class="crm-two-col">
            <div class="panel"><h3 class="crm-panel-title">Coming up <span class="crm-badge-muted">next 7 days</span></h3><div id="crm-coming-up" class="crm-item-list"></div></div>
            <div class="panel"><h3 class="crm-panel-title">What needs you now</h3><div id="crm-needs-you" class="crm-item-list"></div></div>
          </div>
          <div class="crm-two-col">
            <div class="panel"><h3 class="crm-panel-title">Weekly check-in <span class="crm-badge-muted crm-badge-warn">quiet 7+ days</span></h3><div id="crm-quiet-leads" class="crm-item-list"></div></div>
            <div class="panel"><h3 class="crm-panel-title">What\'s new</h3><div id="crm-activity-feed" class="crm-item-list"></div></div>
          </div>
        </div>
        <div class="crm-view" id="crm-leads-view">
          <div class="crm-controls">
            <input type="search" id="crm-search" class="crm-search" placeholder="Search leads&hellip;">
            <select id="crm-stage-filter" class="crm-select">
              <option value="">All stages</option>
              <option>Upcoming</option><option>Meeting</option><option>Held</option><option>Proposal</option><option>Won</option>
            </select>
            <label class="crm-lost-toggle"><input type="checkbox" id="crm-show-lost"> Show lost</label>
            <div class="crm-view-toggle">
              <button class="crm-view-btn is-active" data-crm-view="list" title="List">&#9776;</button>
              <button class="crm-view-btn" data-crm-view="board" title="Board">&#9783;</button>
            </div>
          </div>
          <div id="crm-leads-list" class="crm-leads-list"></div>
          <div id="crm-leads-board" class="crm-board" style="display:none"></div>
        </div>
        <div class="crm-view" id="crm-meetings-view">
          <div class="crm-stats-row" id="crm-meeting-stats"></div>
          <div class="crm-filter-tabs" id="crm-meeting-filters">
            <button class="crm-filter-tab is-active" data-outcome="">All</button>
            <button class="crm-filter-tab" data-outcome="Upcoming">Upcoming</button>
            <button class="crm-filter-tab" data-outcome="Held">Completed</button>
            <button class="crm-filter-tab" data-outcome="Won">Won</button>
            <button class="crm-filter-tab" data-outcome="Lost">Lost</button>
            <button class="crm-filter-tab" data-outcome="No-show">No-show</button>
          </div>
          <div id="crm-meetings-list" class="crm-meetings-list"></div>
          <button class="button button-ghost" id="crm-add-meeting-btn" style="margin-top:12px">+ Schedule meeting</button>
        </div>
      </section>

      <!-- Lead detail modal -->
      <div id="lead-modal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
        <div class="modal-card lead-modal-card">
          <div class="lead-modal-header">
            <div><h2 id="lead-modal-title">Lead</h2><p id="lead-modal-meta" class="label"></p></div>
            <button class="button button-ghost" id="lead-modal-close" style="flex-shrink:0">Close</button>
          </div>
          <div class="crm-pipeline-bar" id="lead-pipeline-bar"></div>
          <div class="lead-modal-tabs">
            <button class="lead-tab is-active" data-lead-tab="overview">Overview</button>
            <button class="lead-tab" data-lead-tab="activity">Activity</button>
            <button class="lead-tab" data-lead-tab="notes">Notes</button>
          </div>
          <div class="lead-tab-panel is-active" id="lead-tab-overview">
            <div class="lead-contact-grid" id="lead-contact-info"></div>
            <div class="crm-log-actions">
              <p class="label" style="margin-bottom:4px">Log activity</p>
              <div class="crm-action-row">
                <button class="button button-ghost crm-log-btn" data-type="meeting_held">Meeting held</button>
                <button class="button button-ghost crm-log-btn" data-type="no_show">No-show</button>
                <button class="button button-ghost crm-log-btn" data-type="rescheduled">Rescheduled</button>
                <button class="button button-ghost crm-log-btn" data-type="email">Email</button>
                <button class="button button-ghost crm-log-btn" data-type="reply">Reply received</button>
                <button class="button button-ghost crm-log-btn" data-type="note">Note</button>
              </div>
            </div>
            <div class="crm-stage-changer">
              <label>Move stage
                <select id="lead-stage-select" class="crm-select">
                  <option>Upcoming</option><option>Meeting</option><option>Held</option><option>Proposal</option><option>Won</option><option>Lost</option>
                </select>
              </label>
              <button class="button button-ghost" id="lead-stage-save">Save stage</button>
            </div>
            <p id="lead-modal-status" class="status-text"></p>
          </div>
          <div class="lead-tab-panel" id="lead-tab-activity">
            <div id="lead-activity-list" class="crm-item-list"></div>
          </div>
          <div class="lead-tab-panel" id="lead-tab-notes">
            <textarea id="lead-notes-input" class="crm-textarea" rows="6" placeholder="Add notes about this lead&hellip;"></textarea>
            <button class="button button-ghost" id="lead-notes-save">Save notes</button>
            <p id="lead-notes-status" class="status-text"></p>
          </div>
        </div>
      </div>

      <!-- Add lead modal -->
      <div id="add-lead-modal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true">
        <div class="modal-card">
          <h2>Add lead</h2>
          <form id="add-lead-form" class="setup-form">
            <div class="form-grid">
              <label>Contact name <input name="name" type="text" placeholder="First name"></label>
              <label>Email <input name="email" type="email" placeholder="contact@company.com"></label>
              <label>Company <input name="company" type="text" required placeholder="Acme Inc."></label>
              <label>Role <input name="role" type="text" placeholder="Owner"></label>
              <label class="field-wide">Website <input name="websiteUrl" type="text" placeholder="https://acme.com"></label>
              <label class="field-wide">Campaign / source <input name="campaignName" type="text" placeholder="Miami agencies Q3"></label>
            </div>
            <div class="form-actions">
              <button class="button button-primary" type="submit">Add lead</button>
              <button class="button button-ghost" type="button" id="add-lead-cancel">Cancel</button>
            </div>
            <p id="add-lead-status" class="status-text"></p>
          </form>
        </div>
      </div>

      <!-- Add meeting modal -->
      <div id="add-meeting-modal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true">
        <div class="modal-card">
          <h2>Schedule meeting</h2>
          <form id="add-meeting-form" class="setup-form">
            <div class="form-grid">
              <label class="field-wide">Lead name / company <input name="company" type="text" required placeholder="Acme Inc."></label>
              <label class="field-wide">Date &amp; time <input name="scheduledAt" type="datetime-local" required></label>
              <label>Deal value ($) <input name="value" type="number" min="0" placeholder="0"></label>
              <label class="field-wide">Notes <textarea name="notes" rows="3" placeholder="Agenda, context&hellip;"></textarea></label>
            </div>
            <div class="form-actions">
              <button class="button button-primary" type="submit">Save meeting</button>
              <button class="button button-ghost" type="button" id="add-meeting-cancel">Cancel</button>
            </div>
            <p id="add-meeting-status" class="status-text"></p>
          </form>
        </div>
      </div>

      <!-- Log activity modal -->
      <div id="log-activity-modal" class="modal-overlay" style="display:none" role="dialog" aria-modal="true">
        <div class="modal-card">
          <h2 id="log-activity-title">Log activity</h2>
          <form id="log-activity-form" class="setup-form">
            <label class="field-wide">Notes / detail
              <textarea name="body" rows="4" placeholder="What happened?"></textarea>
            </label>
            <div class="form-actions">
              <button class="button button-primary" type="submit">Save</button>
              <button class="button button-ghost" type="button" id="log-activity-cancel">Cancel</button>
            </div>
            <p id="log-activity-status" class="status-text"></p>
          </form>
        </div>
      </div>

'''

marker = '      <section class="history-layout" id="admin"'
if 'id="crm"' not in src:
    src = src.replace(marker, crm_html + marker)

with open(path, "w") as f:
    f.write(src)

print("index.html patched OK")

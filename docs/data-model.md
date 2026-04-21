# Outbound Forge Data Model

## Current MVP Entities

### UserProfile

- `productName`
- `supportEmail`

### SetupRequest

- `id`
- `createdAt`
- `ownerName`
- `companyName`
- `email`
- `status`

### InfrastructurePlan

- `id`
- `createdAt`
- `ownerName`
- `companyName`
- `email`
- `teamType`
- `platform`
- `notes`
- `contactsPerMonth`
- `sendingDays`
- `dailyPerMailbox`
- `mailboxesPerDomain`
- `dailyTarget`
- `recommendedDomains`
- `recommendedMailboxes`
- `totalDailyCapacity`
- `monthlyMailboxCost`
- `monthlyDomainCost`
- `estimatedMonthlyInfraCost`
- `rampWeeks`

### ChecklistItem

- stored as strings on the plan

### WarmupStep

- `week`
- `sendPerMailbox`
- `totalDailyVolume`

### ActivityEvent

- `id`
- `createdAt`
- `title`
- `body`

## Current Storage

The MVP currently stores these records in:

- `server/data/db.json`

## Future Production Entities

When the app grows beyond planning and local persistence, add:

- `users`
- `sessions`
- `organizations`
- `workspaces`
- `domains`
- `mailboxes`
- `dns_records`
- `provisioning_jobs`
- `audit_logs`

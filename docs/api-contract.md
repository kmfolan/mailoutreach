# Outbound Forge API Contract

## Current Endpoints

### `GET /api/health`

Returns server health metadata.

### `POST /api/auth/login`

Authenticates a user and sets a session cookie.

Request body:

```json
{
  "username": "admin@example.com",
  "password": "replace-with-a-strong-password"
}
```

### `POST /api/auth/logout`

Clears the active session cookie.

### `GET /api/auth/session`

Returns whether the current browser session is authenticated.

### `GET /api/dashboard`

Returns:

- profile
- summary
- latest plan
- recent requests
- recent activity
- plan history

### `POST /api/setup-request`

Generates and stores a new infrastructure plan.

Request body:

```json
{
  "ownerName": "Kevin Atlas",
  "companyName": "Atlas Studios",
  "email": "owner@example.com",
  "teamType": "Founder-led outbound",
  "platform": "Google Workspace",
  "contactsPerMonth": 18000,
  "sendingDays": 20,
  "dailyPerMailbox": 30,
  "mailboxesPerDomain": 3,
  "notes": "Need a lean founder-led setup."
}
```

## Likely Next Endpoints

- `GET /api/plans/:id`
- `PATCH /api/plans/:id`
- `GET /api/requests`
- `GET /api/activity`

## Future Integration Endpoints

If the product moves into real provisioning:

- `POST /api/domains/connect`
- `POST /api/mailboxes/provision`
- `POST /api/dns/sync`
- `POST /api/provisioning/run`

# TIL - Route Reference

This document lists every HTTP route in the application. All routes except `/login`, `/logout`, and `/static/*` require an authenticated session (cookie).

---

## Pages (Full HTML with Layout)

### `GET /login`
- **Renders**: `Login` view inside `Layout` (no `authed` prop)
- **Service**: `AuthService.login()` (on POST only)
- **Auth**: Not required (public)
- **Notes**: Login page with optional error message.

### `GET /`
- **Renders**: `ModuleList` view inside `Layout` (`authed`)
- **Service**: `ChallengesService.list()`
- **Auth**: Required
- **Notes**: Module list page showing all modules, challenges, solved status, and points.

### `GET /challenges/:id`
- **Renders**: `ChallengePage` view inside `Layout` (`authed`)
- **Service**: `ChallengesService.getChallenge(id)`
- **Auth**: Required
- **Notes**: Challenge detail page with briefing, links, sandbox controls, flag form, and "View answer" button. Returns 404 with `NotFound` view if challenge not found. Returns 200 with `ChallengePage broken={...}` if challenge is broken.

---

## HTMX Fragments (No Layout)

### `GET /challenges/:id/answer`
- **Renders**: `Answer` view (fragment only)
- **Service**: `ChallengesService.getGuide(id)`
- **Auth**: Required
- **Response**: Always HTTP 200
- **Notes**: Returns the guide Markdown inside `<div class="answer">`. Outcomes:
  - `ok` → rendered guide
  - `noGuide` → "No guide for this challenge"
  - `broken` / `notFound` → "This challenge can't be checked"
- **Progress**: Never modified by this route.

### `POST /challenges/:id/flag`
- **Renders**: `FlagResult` view (fragment only)
- **Service**: `FlagsService.submit(id, submittedFlag)`
- **Auth**: Required
- **Response**: Always HTTP 200 (htmx does not swap 4xx responses)
- **Notes**: Compares submitted flag (format `TIL{...}`) with challenge flag. Returns result fragment with success/error message. First correct solve records progress (points = tier). Resubmitting a solved challenge returns "Already solved".

### `POST /sandbox/start`
- **Renders**: `Sandbox` view (fragment only)
- **Service**: `SandboxService.start(challengeId)`
- **Auth**: Required
- **Body**: `challenge` (string, challenge id)
- **Notes**: Creates a new session container from the challenge's image and files. Stops any existing session first (one session at a time).

### `POST /sandbox/stop`
- **Renders**: `Sandbox` view (fragment only)
- **Service**: `SandboxService.stop()`
- **Auth**: Required
- **Notes**: Removes the current session container.

### `POST /sandbox/reset`
- **Renders**: `Sandbox` view (fragment only)
- **Service**: `SandboxService.reset(challengeId)`
- **Auth**: Required
- **Body**: `challenge` (string, challenge id)
- **Notes**: Destroys and recreates the session container from pristine challenge files. Button on the page has `hx-confirm="Discard your changes?"`.

### `GET /sandbox/status`
- **Renders**: `Sandbox` view (fragment only)
- **Service**: `SandboxService.status(challengeId)`
- **Auth**: Required
- **Query**: `challenge` (string, optional challenge id for `thisChallenge` flag)
- **Notes**: Polls sandbox status (triggered via `hx-trigger="load"` on the challenge page). Returns running/stopped state and whether it matches the current challenge.

---

## Static Assets

### `GET /static/*`
- **Serves**: Files from `api/public/` (htmx.min.js, CSS, etc.)
- **Auth**: Not required
- **Notes**: Served via `serveStatic` middleware.

---

## Debug / JSON

### `GET /api/progress`
- **Returns**: JSON array of all progress rows from SQLite
- **Auth**: Required
- **Notes**: Debug endpoint. Each row: `{ challenge_id, points, solved_at }`.

---

## Auth Actions

### `POST /login`
- **Action**: Validates password, sets session cookie on success
- **Service**: `AuthService.login(clientIp, password)`
- **Auth**: Not required (public)
- **Body**: `password` (string)
- **Response**: 302 redirect to `/` on success; re-renders login page with error on failure.
- **Rate limit**: 5 attempts per IP per server start; 6th returns "Too many attempts".

### `POST /logout`
- **Action**: Clears session cookie
- **Auth**: Required (but safe to call without)
- **Response**: 302 redirect to `/login`

---

## Planned Routes (Not Yet Implemented)

### `GET /ws` (planned)
- **Type**: WebSocket
- **Service**: Terminal bridge to running sandbox container (`docker exec -it`)
- **Auth**: Required
- **Notes**: Will attach to the running session container and bridge stdin/stdout/resize to the browser via xterm.js.

### `POST /content/sync` (planned)
- **Renders**: HTMX fragment showing git pull result and any validation errors
- **Service**: Content sync (git pull on content checkout)
- **Auth**: Required
- **Notes**: "Sync" button on the module list page. Requires git in the container (production only).

---

## Auth Middleware Behavior

All routes except `/login`, `/logout`, and `/static/*` are protected by a middleware that:
1. Checks for a valid session cookie
2. If missing and request has `HX-Request` header → returns 401 with `HX-Redirect: /login`
3. If missing and no `HX-Request` → 302 redirect to `/login`
4. If valid → continues to route handler
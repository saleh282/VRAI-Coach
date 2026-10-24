# VRAI Coach API Endpoints

This document lists routes currently mounted by `backend/server.js`. It describes the code as it is today; planned behavior and known gaps are called out separately.

## Base URL

```text
http://localhost:5000
```

All API routes are versioned under `/api/v1`. JSON requests should use `Content-Type: application/json`. For protected endpoints, send:

```http
Authorization: Bearer <accessToken>
```

## Health and root

| Method | Endpoint  | Auth | Purpose                                                                              |
| ------ | --------- | ---- | ------------------------------------------------------------------------------------ |
| `GET`  | `/`       | None | Confirms the backend process is responding.                                          |
| `GET`  | `/health` | None | Reports server and MongoDB readiness; returns `200` when connected, otherwise `503`. |

## Authentication

### Register

`POST /api/v1/auth/register` — public.

Request:

```json
{
  "name": "Saleh Mohamed",
  "email": "saleh@example.com",
  "password": "example-password"
}
```

Success: `201 Created`, returning the public user fields (`id`, `name`, `email`, `role`) without an access token. The client should call Login after registration. The role is assigned by the backend; public registration must not be used to create a rater/admin account.

### Login

`POST /api/v1/auth/login` — public.

Request:

```json
{
  "email": "saleh@example.com",
  "password": "example-password"
}
```

Success: `200 OK`, returning `data.accessToken` and the public user fields.

### Get current user

`GET /api/v1/auth/me` — requires a valid Bearer token.

Returns the signed-in user's public profile.

## Sessions

### List my sessions

`GET /api/v1/sessions/me` — requires a valid Bearer token with the `user` role.

No request body. The backend gets the owner from the token and returns only that user's sessions, newest first. Each item includes `sessionId`, category, difficulty, status, timestamps, and `resultStatus` (`pending` or `ready`) based on whether a submitted AI evaluation exists.

### Get one of my sessions and its result

`GET /api/v1/sessions/:sessionId` — requires a valid Bearer token with the `user` role.

No request body. The session must belong to the signed-in user. The response includes session details and either the submitted AI result (`scores`, `overallScore`, feedback, and rubric/model metadata) or `{ "status": "pending" }` if there is no submitted AI result yet. Human rater evaluations are not returned by this user endpoint. A missing or non-owned session returns `404`.

### Create a session

`POST /api/v1/sessions` — requires a valid Bearer token.

Request:

```json
{
  "category": "tech",
  "difficulty": "medium"
}
```

Success: `201 Created`, returning `data.sessionId`, initial `pending` status, and session metadata.

### Upload session audio and motion

`POST /api/v1/sessions/:sessionId/upload` — requires a valid Bearer token and ownership of the session.

Body type: `multipart/form-data`. Both fields are required and each accepts one file:

| Field       | Required extension | Saved filename |
| ----------- | ------------------ | -------------- |
| `audio`     | `.wav`             | `audio.wav`    |
| `motionLog` | `.json`            | `motion.json`  |

The motion file must parse as valid JSON. Each file is limited to 150 MB. In Postman, use **Body → form-data**, change both fields to **File**, and do not manually set the multipart `Content-Type` header.

Files are currently saved locally at:

```text
backend/uploads/sessions/<sessionId>/
```

MongoDB stores only the relative references (`audioRef`, `motionRef`) and session metadata, not the media bytes. On success the session is marked `completed` and the endpoint returns `200 OK` with its ID, status, completion time, and file references. Local disk storage is for development only; a separate AI service cannot read it unless it shares access to that machine/folder. No AI file-download or handoff endpoint is implemented yet.

## Rater

All `/api/v1/rater` routes require a valid Bearer token with the `rater` role. AI evaluations/scores are not selected for the rater responses.

### List sessions

`GET /api/v1/rater/sessions` — rater only.

Optional query parameter: `status=unreviewed` or `status=completed`.

The current implementation returns session records and a `hasHumanEvaluation` flag. `unreviewed` filters to completed sessions without a submitted human evaluation. **There is no per-rater assignment endpoint/model yet**, so this is not an assigned queue.

### Get one session

`GET /api/v1/rater/sessions/:sessionId` — rater only.

Returns a completed session's metadata, media references, and `hasHumanEvaluation`; it does not provide a file download/stream URL. AI scores are not included.

### Submit a human evaluation

`POST /api/v1/rater/sessions/:sessionId/evaluation` — rater only; completed sessions only.

Request:

```json
{
  "communication": 80,
  "clarity": 85,
  "confidence": 75,
  "contentQuality": 90,
  "evidenceNote": "The answer was structured and supported by an example."
}
```

All four scores must be numbers from `0` to `100`; `evidenceNote` is required. Success: `201 Created`, returning the saved human evaluation and calculated overall score.

**Current limitation:** duplicate protection is session-wide, rather than one evaluation per rater per session. Therefore the current implementation does not yet support multiple raters independently rating the same session. Assignment and per-rater duplicate rules need follow-up work.

## AI service integration

### Submit an AI evaluation

`POST /api/v1/ai/sessions/:sessionId/evaluation` — trusted AI service only.

Authenticate with the shared secret in `x-api-key`. Configure the same `AI_SERVICE_API_KEY` value securely in the backend and AI service; do not commit or send the secret in ordinary chat. This endpoint does not use a user's JWT.

Request:

```json
{
  "modelVersion": "interview-model-1.0",
  "rubricVersion": "1.0.0",
  "scores": {
    "communication": 80,
    "clarity": 85,
    "confidence": 75,
    "contentQuality": 90
  },
  "feedback": "The response was clear and supported by an example."
}
```

`modelVersion` and all four numeric score fields are required; scores must be from `0` to `100`. `rubricVersion` defaults to `1.0.0`, and `feedback` is optional. The referenced session must exist and be `completed`. The backend calculates `overallScore` from the rubric weights; callers must not send an overall score.

Success: `201 Created`, returning the saved AI evaluation ID, session ID, versions, scores, calculated overall score, feedback, and submission time. Re-submitting the same session/model/rubric version returns `409 Conflict`. A missing or invalid service key returns `401`; if the backend key is not configured, the endpoint returns `503`.

After a successful submission, the user's `GET /api/v1/sessions/:sessionId` endpoint can return this result to the owning user.

## Admin

All `/api/v1/admin` routes require a valid Bearer token with the `admin` role. Passwords and password hashes are never returned. At least one initial admin must be provisioned securely outside public registration before these endpoints can be used.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/users` | List users with safe profile fields and role. |
| `GET` | `/api/v1/admin/users/:userId` | View one user's safe profile fields and role. |
| `PATCH` | `/api/v1/admin/users/:userId/role` | Change a user's role. JSON body: `{ "role": "rater" }`; allowed values are `user`, `rater`, `admin`. |
| `GET` | `/api/v1/admin/sessions` | List sessions with owner summary. Supports `status`, `limit` (max 100), and `offset` query parameters. |
| `GET` | `/api/v1/admin/sessions/:sessionId` | View session details, file references, submitted AI evaluations, and submitted human evaluations with rater profile. |
| `GET` | `/api/v1/admin/raters` | List rater profiles and count of submitted evaluations. |
| `GET` | `/api/v1/admin/raters/:raterId` | View one rater's safe profile and submitted human evaluations. |

Session assignments are intentionally not included in the current scope. Admin session details include AI and human scores; rater endpoints do not include AI scores.

## Not implemented

- Session media retrieval/download for raters or the AI service.
- Per-rater session assignment and multiple independent human ratings per session.
- Cloud/object storage such as S3.

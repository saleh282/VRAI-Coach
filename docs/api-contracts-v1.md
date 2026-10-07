# API Contracts v1

## Status and conventions

This document is the first contract between the VR/mobile client, backend, AI
evaluation service, and internal rater tool. It defines behavior for
implementation. Authentication routes are implemented; the other routes remain
contract-only until their implementation sprint.

- Public and rater endpoints use `/api/v1`.
- Private service-to-service endpoints use `/internal/v1`.
- Requests and responses use JSON unless media upload is explicitly introduced.
- Dates use ISO 8601 UTC strings.
- IDs are represented as strings.
- Scores use the inclusive 0-100 scale.
- Protected endpoints use `Authorization: Bearer <token>`.

## Standard response shapes

Successful single-resource response:

```json
{
  "data": {}
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

Expected status codes include `200`, `201`, `400`, `401`, `403`, `404`, `409`,
and `500`.

## Authentication

### Register a user

`POST /api/v1/auth/register`

```json
{
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "password": "user-provided password"
}
```

Returns `201` with the user and access token. Public registration always creates
the `USER` role; rater and admin roles cannot be selected by the requester.

Success response:

```json
{
  "data": {
    "accessToken": "<JWT>",
    "user": {
      "id": "<user-id>",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "role": "user"
    }
  }
}
```

Passwords must contain at least 8 characters. Duplicate email returns `409`.

### Sign in

`POST /api/v1/auth/login`

```json
{
  "email": "ahmed@example.com",
  "password": "user-provided password"
}
```

Returns `200` with the user and access token.

Invalid email or password returns `401` with the same generic message, so the
response does not reveal whether an account exists.

### Get the current user

`GET /api/v1/auth/me`

Requires `Authorization: Bearer <accessToken>`. Returns the current user's
`id`, `name`, `email`, and `role`, without password data. Missing, invalid, or
expired tokens return `401`.

### Token rules

- Access tokens expire after one hour by default (`JWT_EXPIRES_IN=1h`).
- The signing key is read from `JWT_SECRET` and must remain server-side.
- Flutter stores the access token in secure device storage and sends it using
  the Bearer authorization header on protected requests.
- This MVP does not issue refresh tokens; the user signs in again after expiry.
- Public registration can only create the `user` role. Rater/admin roles are
  assigned through a trusted administrative process.

## Interview sessions (VR/mobile to backend)

### Create a session

`POST /api/v1/sessions`

```json
{
  "sessionType": "INTERVIEW",
  "category": "SOFT_SKILLS",
  "difficulty": "MEDIUM"
}
```

Returns `201` with a session in `PENDING` status. The authenticated user is the
owner; `userId` must not be accepted from the client.

### Start a session

`POST /api/v1/sessions/{sessionId}/start`

Returns `200` and moves `PENDING` to `IN_PROGRESS`. Repeating the operation is
idempotent. A completed session cannot be restarted.

### Complete a session

`POST /api/v1/sessions/{sessionId}/complete`

```json
{
  "transcriptRef": "storage reference",
  "audioRef": "storage reference or null",
  "videoRef": "storage reference or null"
}
```

Returns `200` and moves `IN_PROGRESS` to `COMPLETED`. The contract uses storage
references, not public permanent URLs. The exact upload flow remains an open
decision.

### Read a session

`GET /api/v1/sessions/{sessionId}`

Users may read their own sessions. Raters use the dedicated rater endpoints so
blindness and field filtering are enforced.

## AI evaluation (AI service to backend)

### Submit an AI evaluation

`POST /internal/v1/sessions/{sessionId}/ai-evaluations`

Authentication: private service credential.

```json
{
  "modelVersion": "interview-evaluator-1.0.0",
  "rubricVersion": "1.0.0",
  "scores": {
    "communication": 82,
    "clarity": 88,
    "confidence": 75,
    "contentQuality": 80
  },
  "feedback": "Structured answer with some hesitation."
}
```

The backend validates every score and calculates `overallScore`. Returns `201`.
Duplicate submission for the same session, model version, and rubric version
returns `409` unless an explicit idempotency mechanism identifies the same
request.

This endpoint never accepts an AI-provided human-comparison result.

## Human rater tool

All routes require the `RATER` role unless stated otherwise.

### List tasks

`GET /api/v1/rater/tasks?status=AVAILABLE&page=1&limit=20`

Returns task metadata such as session ID, category, difficulty, media readiness,
and assignment status. It must not return AI evaluation fields.

### Claim a task

`POST /api/v1/rater/tasks/{taskId}/claim`

Atomically assigns an available task to the authenticated rater. Returns `409`
if another rater has already claimed it.

### Open rating material

`GET /api/v1/rater/tasks/{taskId}`

Returns:

```json
{
  "data": {
    "taskId": "task id",
    "session": {
      "id": "session id",
      "category": "SOFT_SKILLS",
      "difficulty": "MEDIUM",
      "transcriptRef": "authorized temporary reference",
      "audioRef": null,
      "videoRef": null
    },
    "rubric": {
      "version": "1.0.0",
      "criteria": []
    },
    "draft": null
  }
}
```

Before submission, this response must not contain AI scores, AI feedback,
model version, overall AI score, or comparison flags.

### Save a draft

`PUT /api/v1/rater/tasks/{taskId}/draft`

```json
{
  "rubricVersion": "1.0.0",
  "scores": {
    "communication": 85,
    "clarity": 84,
    "confidence": 72,
    "contentQuality": 82
  },
  "feedback": "Optional user-facing feedback draft",
  "evidenceNote": "The answer was structured but included repeated hesitation."
}
```

Returns `200`. Drafts are editable and are excluded from validation metrics.

### Submit a human evaluation

`POST /api/v1/rater/tasks/{taskId}/submit`

The request body uses the same fields as the draft endpoint. All criteria and an
evidence note are required. The backend calculates `overallScore`, stores the
authenticated rater ID, marks the task submitted, and returns `201`.

Submission is idempotent for an identical request. A conflicting second
submission returns `409`. Normal raters cannot edit a submitted evaluation.

### View a comparison after submission

`GET /api/v1/rater/tasks/{taskId}/comparison`

The assigned rater can call this only after human submission. Returns `404` when
a matching AI evaluation is not available and `409` if the human evaluation is
still a draft.

```json
{
  "data": {
    "sessionId": "session id",
    "rubricVersion": "1.0.0",
    "modelVersion": "interview-evaluator-1.0.0",
    "criteria": {
      "communication": {
        "ai": 82,
        "human": 85,
        "signedDifference": -3,
        "absoluteDifference": 3
      }
    },
    "overall": {
      "ai": 81.6,
      "human": 81.4,
      "signedDifference": 0.2,
      "absoluteDifference": 0.2
    }
  }
}
```

## Validation reporting

### Model validation summary

`GET /api/v1/admin/model-validation?modelVersion=interview-evaluator-1.0.0&rubricVersion=1.0.0`

Requires the `ADMIN` or `VALIDATION_LEAD` role. Returns only submitted comparable
pairs and includes sample size, MAE, bias, within-5 rate, within-10 rate, and
criterion/category/difficulty breakdowns.

Different model or rubric versions must not be combined unless the response
explicitly provides separate groups.

## State and permission rules

| Action | Required condition |
| --- | --- |
| Start session | Owner and status `PENDING` |
| Complete session | Owner and status `IN_PROGRESS` |
| AI submission | Completed session and authorized AI service |
| Claim task | Rater role and task `AVAILABLE` |
| Read rating material | Assigned rater or authorized admin |
| Submit human rating | Assigned rater and matching rubric |
| Read comparison | Human evaluation already submitted |
| Read aggregate report | Admin or validation lead |

## Contract decisions still required

- Media upload and protected playback mechanism
- Token lifetime and refresh-token behavior
- Whether every completed session or a sampled subset creates a rater task
- Acceptance thresholds and minimum validation sample size
- Whether a second rater is assigned to a configured percentage of sessions

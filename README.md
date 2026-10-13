# VRAI Coach

VRAI Coach is an interview-training platform built around VR interview sessions. The backend manages user accounts and sessions, stores session metadata in MongoDB, and is intended to connect the VR client, AI evaluator, mobile app, and internal human-rater workflow.

The human rater evaluates a session independently. AI scores must remain hidden from the rater until the human evaluation has been submitted. Human ratings are used to validate the AI model; they are not currently the score shown to the user.

## Project status

### Implemented in this repository

- Express backend connected to MongoDB using Mongoose.
- JWT authentication with bcrypt password hashing.
- User, Session, and Evaluation Mongoose models.
- `POST /api/v1/sessions` to create an authenticated interview session and return its ID.
- `POST /api/v1/sessions/:sessionId/upload` to upload the session audio and motion JSON.
- Health-check endpoint and model tests.

### Planned, not implemented yet

- Cloud media storage (uploads currently use local development storage).
- Session start, completion, list, and detail endpoints.
- AI evaluation ingestion and rater-task APIs/UI.
- Flutter app, VR client, and AI inference service.

The API documents describe intended contracts as well as implemented routes. Check the status notes in each section before integrating.

## Product flow

```text
User signs in through the mobile app
        -> backend returns a JWT access token
        -> backend creates a session and returns sessionId
        -> VR records audio and motion, then uploads both to the backend
        -> AI evaluates the session (planned)
        -> a human rater independently evaluates the same session (planned)
        -> backend compares submitted AI and human evaluations (planned)
```

## Technology

- Node.js (20.19 or newer recommended)
- Express 5
- MongoDB Atlas or a MongoDB server
- Mongoose
- JWT (`jsonwebtoken`) and bcrypt

## Run the backend locally

1. Install Node.js and make sure MongoDB Atlas or another MongoDB server is available.
2. From the project root, copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit `.env` and set your MongoDB connection string and a private JWT secret. Keep `.env` out of GitHub; do not share the secret.

   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/vrai-coach?retryWrites=true&w=majority
   JWT_SECRET=<long-random-secret>
   JWT_EXPIRES_IN=1h
   ```

4. Install backend dependencies and start the server:

   ```powershell
   cd backend
   npm install
   npm start
   ```

The backend loads `.env` from the project root. When it starts successfully, it logs the MongoDB connection and the port.

Check the server and database health at:

```text
GET http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Implemented API

Base URL for local development: `http://localhost:5000`

### Register

`POST /api/v1/auth/register`

```json
{
  "name": "Saleh Mohamed",
  "email": "saleh@example.com",
  "password": "example-password"
}
```

Returns `201` with `data.accessToken` and the public user object. Passwords must be at least 8 characters. Public registration always assigns the `user` role; clients cannot choose a role.

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "saleh@example.com",
  "password": "example-password"
}
```

Returns `200` with `data.accessToken` and the public user object. The token expires after one hour by default.

### Get the current user

`GET /api/v1/auth/me`

Requires the access token in the `Authorization` header:

```http
Authorization: Bearer <accessToken>
```

### Create an interview session

`POST /api/v1/sessions`

Requires `Authorization: Bearer <accessToken>` and a JSON body:

```json
{
  "category": "tech",
  "difficulty": "medium"
}
```

Allowed categories: `tech`, `soft_skills`. Allowed difficulties: `easy`, `medium`, `hard`.

Returns `201` with a MongoDB-generated `sessionId` and the initial `pending` status. The backend takes the session owner from the authenticated token; do not send `userId` in the request body.

Example response:

```json
{
  "data": {
    "sessionId": "<session-id>",
    "status": "pending",
    "sessionType": "interview",
    "category": "tech",
    "difficulty": "medium",
    "createdAt": "<ISO-8601 timestamp>"
  }
}
```

### Upload session audio and motion

`POST /api/v1/sessions/:sessionId/upload`

Requires `Authorization: Bearer <accessToken>`. Send `multipart/form-data` with exactly these file fields:

| Field | File type | Stored name |
| --- | --- | --- |
| `audio` | `.wav` | `audio.wav` |
| `motionLog` | valid `.json` | `motion.json` |

The session must belong to the authenticated user and must not already have uploaded media. The server stores files locally under `backend/uploads/sessions/<sessionId>/`, saves their relative references in MongoDB, and marks the session `completed`. Do not manually set the multipart `Content-Type` header in Postman; it adds the required boundary automatically. Local storage is for development only; cloud/object storage is still needed for deployment.

Example success response (`200`):

```json
{
  "data": {
    "sessionId": "<session-id>",
    "status": "completed",
    "completedAt": "<ISO-8601 timestamp>",
    "files": {
      "audio": "sessions/<session-id>/audio.wav",
      "motionLog": "sessions/<session-id>/motion.json"
    }
  }
}
```
## Human Rater Evaluation

### Rater workflow
The backend includes a human-rater evaluation workflow for completed interview sessions.

Human raters can:
- Retrieve completed interview sessions.
- Retrieve sessions that have not yet received a submitted human evaluation.
- Submit an evaluation for a completed session.

Each human evaluation uses the same four criteria as the AI evaluation rubric:

- `communication`: 0–100
- `clarity`: 0–100
- `confidence`: 0–100
- `contentQuality`: 0–100

The backend calculates the overall score automatically using the following weights:

- Communication: 30%
- Clarity: 25%
- Confidence: 20%
- Content Quality: 25%

Human evaluations are stored separately from AI evaluations and require an `evidenceNote` when submitted.

AI-generated scores and AI-generated feedback are not exposed to the human rater during the human evaluation process.

Human evaluations are used to support validation of the AI evaluation model.

### Rater Testing

The human-rater workflow was tested using Postman, including:

- Retrieving completed sessions.
- Retrieving unevaluated sessions.
- Submitting a valid human evaluation.
- Verifying the automatic overall-score calculation.
- Validating required rubric scores.
- Validating the `0–100` score range.
- Validating the required `evidenceNote`.
- Verifying that submitted evaluations are stored as `HUMAN`.
- Verifying that AI scores and feedback are hidden from the rater.
- Verifying that duplicate submitted human evaluations are rejected.

## Testing

Run the backend model tests from the `backend` folder:

```powershell
npm test
```

Optional database setup/check scripts are also available:

```powershell
npm run db:init
npm run test:connection
npm run test:db
```

These scripts use the same root `.env` file as the server.

## Session data model

The `sessions` collection stores the authenticated `userId`, session type, category, difficulty, status, timestamps, and references to artifacts. Current media reference fields are `audioRef` and `motionRef`; `transcriptRef` is optional. These are storage references, not the media files themselves.

Current local media layout (audio and motion only):

```text
sessions/<sessionId>/
├── audio.wav
└── motion.json
```

The local upload endpoint is implemented. Cloud storage and the exact motion-data schema/synchronization contract still need to be agreed with the AI and VR teams. MongoDB stores file references and session metadata, not the media bytes.

## Database models

- `User` (`users` collection): name, email, password hash, and role (`user`, `rater`, or `admin`).
- `Session` (`sessions` collection): session owner, type, category, difficulty, status, timestamps, and media references.
- `Evaluation` (`evaluations` collection): AI or human evaluation linked to a session.

The current Evaluation model and rubric use four criteria scored from 0 to 100: communication, clarity, confidence, and content quality. The final rater rubric must match the AI rubric before validation endpoints are built.

## Documentation

- [API contracts v1](docs/api-contracts-v1.md)
- [Rater validation design](docs/rater-validation-design.md)
- [Scoring rubric v1](docs/scoring-rubric-v1.md)

## Security notes

- Keep `JWT_SECRET` and `MONGO_URI` private in the root `.env` file.
- Never commit `.env` or paste secrets into chat/issues.
- Use HTTPS outside local development.
- Protected routes require a valid, unexpired Bearer token.
- The rater workflow must not expose AI scores before a human rating is submitted.

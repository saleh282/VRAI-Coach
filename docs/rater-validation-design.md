# Internal Rater Validation Design v1

## Goal

The internal rater tool creates human ground-truth evaluations that can be
compared with AI evaluations. Its purpose is to measure and improve model
quality. It is not an HR hiring tool and the human score is not currently part
of the user's final product score.

## Actors

- **User:** completes an interview.
- **AI evaluator:** produces one evaluation for a completed session.
- **Human rater:** independently evaluates the same material.
- **Validation lead/admin:** reviews disagreements and model-level reports.

## Blind workflow

1. A user completes an interview session.
2. The session media and transcript become available for evaluation.
3. The AI service submits scores, feedback, model version, and rubric version.
4. The backend creates a rater task for an eligible human rater.
5. The rater opens the interview material without seeing AI scores or feedback.
6. The rater saves a draft or submits criterion scores and evidence notes.
7. Submission locks the human evaluation for normal editing.
8. Only after submission may the tool show the AI-versus-human comparison.
9. Aggregated reports compare a model version across many rated sessions.

Blind rating is a product requirement. The rater-task API must not include AI
scores, AI feedback, comparison values, or hints derived from them before human
submission.

## Proposed screens

### 1. Task queue

- Assigned and available sessions
- Interview category and difficulty
- Media/transcript readiness
- Task status: `available`, `assigned`, `in_progress`, or `submitted`
- No AI result fields

### 2. Rating workspace

- Audio/video playback and transcript
- Interview questions and answers
- Rubric definitions and score anchors
- Score input for each criterion
- Required evidence note
- Save draft and submit actions
- No AI result fields before submission

### 3. Submitted comparison

- AI and human score for each criterion
- Signed and absolute difference
- Overall difference
- Model version and rubric version
- Flag for manual review when the tolerance is exceeded

### 4. Validation report

- Number of comparable sessions
- Mean absolute error (MAE), overall and per criterion
- Percentage within 5 and within 10 points
- Mean signed error to detect consistently high or low AI scoring
- Correlation as a secondary trend metric
- Breakdown by category, difficulty, model version, and rubric version

## Data design

### Evaluation

Both AI and human records use the same score structure.

```json
{
  "sessionId": "ObjectId",
  "evaluatorType": "AI | HUMAN",
  "raterId": "ObjectId | null",
  "modelVersion": "string | null",
  "rubricVersion": "1.0.0",
  "status": "DRAFT | SUBMITTED",
  "scores": {
    "communication": 0,
    "clarity": 0,
    "confidence": 0,
    "contentQuality": 0
  },
  "overallScore": 0,
  "feedback": "string",
  "evidenceNote": "string",
  "submittedAt": "date | null"
}
```

Rules:

- AI evaluations require `modelVersion` and may not have `raterId`.
- Human evaluations require `raterId` and may not have `modelVersion`.
- Every score is between 0 and 100.
- AI and human evaluations are comparable only when their `rubricVersion`
  values match.
- Version 1 allows one submitted AI evaluation and one submitted human
  evaluation per session. Re-evaluation should create a new versioned record,
  not silently overwrite evidence.

### Rater assignment

```json
{
  "sessionId": "ObjectId",
  "raterId": "ObjectId | null",
  "status": "AVAILABLE | ASSIGNED | IN_PROGRESS | SUBMITTED",
  "assignedAt": "date | null",
  "submittedAt": "date | null"
}
```

This prevents two raters from accidentally claiming the same version-1 task.
Later experiments may deliberately assign multiple raters to measure human
agreement.

## Comparison calculations

For each criterion:

```text
signedDifference = aiScore - humanScore
absoluteDifference = abs(aiScore - humanScore)
```

Across a validation set:

```text
MAE = sum(absoluteDifference) / numberOfComparableScores
withinToleranceRate = count(absoluteDifference <= tolerance) / total
bias = sum(signedDifference) / numberOfComparableScores
```

- Low MAE means the scores are close on average.
- Positive bias means the AI tends to score higher than humans.
- Negative bias means the AI tends to score lower than humans.
- Correlation alone is not enough: scores can correlate while remaining
  consistently too high or too low.

Initial tolerances for reporting are 5 and 10 points. These are reporting bands,
not final proof of model acceptance. A validation lead must define the release
threshold after a representative dataset is available.

## Quality safeguards

- Train raters on the rubric and provide calibration examples.
- Randomly double-rate a subset of sessions to measure human agreement.
- Keep session assignment independent from the AI score.
- Audit who rated or changed a record and when.
- Never compare different rubric versions as if they were identical.
- Report sample size with every metric.
- Break down results to detect weak categories hidden by a good overall average.

## Privacy and access

Interview recordings and transcripts may contain personal data. Raters should
only access assigned sessions. Media URLs should be short-lived, actions should
be audited, and exports should be restricted to authorized validation leads.

## MVP acceptance criteria

The first usable internal rater tool is accepted when:

- A user with the `rater` role can list available and assigned tasks.
- Claiming a task is atomic, so two raters cannot accidentally claim it.
- The rating workspace shows the interview material and rubric version.
- No AI score, feedback, model version, comparison, or derived hint is returned
  before the human evaluation is submitted.
- A rater can save an incomplete draft.
- Submission requires all four scores and an evidence note.
- The backend, not the browser, calculates the weighted overall score.
- A submitted evaluation is locked from normal rater edits.
- The comparison becomes available only after human submission.
- Validation reports keep every model version and rubric version separated.
- Access to interview material and every submission is auditable.

## Implementation boundary

Sprint 1 produces the workflow, screen specification, shared rubric, data shape,
API contract, and acceptance criteria. Building the dashboard UI and endpoints
is implementation work for a later sprint.

## Sprint 1 design output

Sprint 1 finishes the design portion when:

- The shared rubric is agreed upon.
- Blind-rating behavior is accepted as a requirement.
- API contracts are reviewed by backend, AI, VR/mobile, and rater-tool owners.
- Open decisions below have named owners.

## Open decisions

- Which interview artifacts will be available first: transcript, audio, video,
  or all three?
- What sample size and acceptance thresholds are required before calling a model
  version good enough?
- Who can unlock or correct a submitted human evaluation?
- Which sessions are sampled for human rating: all sessions or a representative
  subset?
- What percentage should receive a second independent human rating?

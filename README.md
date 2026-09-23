# VRAI-Coach

VRAI-Coach is an interview-training platform. A user completes an interview in
VR, an AI model evaluates the performance, and an internal human rater evaluates
the same interview using the same rubric. The human rating is used as ground
truth to validate the AI model; it is not currently part of the score shown to
the user.

## Current scope

The repository currently contains the first backend foundation:

- Express server and MongoDB connection
- Initial User, Session, and Evaluation models
- Local database smoke-test script
- Initial Docker configuration
- Version 1 API contract and rater-validation design

The mobile application, VR client, AI inference service, rater dashboard, and
documented APIs are not implemented yet.

## Product flow

```text
User interview -> session recording/transcript -> AI evaluation
                                             \-> blind human evaluation

AI evaluation + human evaluation -> comparison metrics -> model validation
```

The rater must not see the AI scores before submitting the human evaluation.

## Design documents

- [API contracts v1](docs/api-contracts-v1.md)
- [Rater validation design](docs/rater-validation-design.md)
- [Scoring rubric v1](docs/scoring-rubric-v1.md)

## Current backend

The backend entry point is `backend/server.js`. Its only HTTP endpoint at this
stage is `GET /`, used to confirm that the server is running.

The planned public API will use the `/api/v1` prefix. Service-to-service routes
will use `/internal/v1` and must not be exposed publicly.


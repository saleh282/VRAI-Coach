# Human Evaluation Update

## Behavior
- A rater can submit one HUMAN evaluation per session and rubric version.
- A different rater can independently evaluate the same session.
- The rater session list/detail reports `hasHumanEvaluation` for the authenticated rater only.
- Admin CSV export: `GET /api/v1/admin/evaluations/export.csv` (admin Bearer token required).

## Existing MongoDB index migration

The previous index `unique_submitted_human_evaluation` enforced uniqueness by session and rubric across all raters. Drop that old index once in the `evaluations` collection so the new schema index can be created:

```javascript
use <your_database_name>
db.evaluations.dropIndex("unique_submitted_human_evaluation")
```

Then restart the backend. Ensure Mongoose index creation is enabled in the environment, or create the replacement index manually:

```javascript
db.evaluations.createIndex(
  { sessionId: 1, raterId: 1, rubricVersion: 1 },
  {
    unique: true,
    partialFilterExpression: { evaluatorType: "HUMAN", status: "SUBMITTED" },
    name: "unique_submitted_human_evaluation_per_rater"
  }
)
```

Do this against the correct database only. Check `db.evaluations.getIndexes()` before and after migration. The code test suite passed after these changes; a live MongoDB migration and Postman end-to-end tests still need to be run in your environment.

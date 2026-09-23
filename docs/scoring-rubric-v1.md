# Scoring Rubric v1

## Purpose

The AI evaluator and every human rater must use exactly the same rubric. Without
a shared rubric, a difference between two scores cannot tell us whether the AI
is inaccurate or the evaluators simply interpreted the criteria differently.

Version 1 uses a 0-100 scale for every criterion and for the overall score.

## Criteria

| Criterion | What is measured | Weight |
| --- | --- | ---: |
| Communication | Ability to express an answer effectively and stay relevant | 30% |
| Clarity | Structure, understandable wording, and logical progression | 25% |
| Confidence | Delivery, decisiveness, and appropriate certainty | 20% |
| Content quality | Correctness, completeness, and strength of the answer | 25% |

The criteria are a starting point. Technical interviews may later introduce a
specialized rubric version, but results from different rubric versions must not
be mixed in the same validation report.

## Score anchors

Raters should use these anchors instead of relying on an undefined personal
meaning of a number.

| Range | Meaning |
| --- | --- |
| 0-39 | Major problems; the criterion is mostly not demonstrated |
| 40-59 | Below expectations; important problems are present |
| 60-74 | Acceptable; meets the basic expectation with some weaknesses |
| 75-89 | Strong; clear performance with minor weaknesses |
| 90-100 | Excellent; consistently demonstrates the criterion |

## Overall score

```text
overallScore =
  communication * 0.30 +
  clarity       * 0.25 +
  confidence    * 0.20 +
  contentQuality* 0.25
```

The backend should calculate the overall score. Clients send the criterion
scores but must not be trusted to calculate the final value.

## Required evidence

Each submitted human rating must contain a short evidence note. The note should
refer to observable interview behavior rather than a general impression. This
helps review disagreements and improve the model or rubric later.

## Versioning

Every evaluation stores `rubricVersion`. Version 1 is identified as `1.0.0`.
Changing criteria, weights, or anchor meanings requires a new version.


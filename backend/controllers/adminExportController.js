const fs = require("fs/promises");
const path = require("path");
const Evaluation = require("../models/evaluationModel");

// Escape values for CSV output
const csvCell = (value) => {
  if (value === null || value === undefined) return '""';

  const text =
    value instanceof Date ? value.toISOString() : String(value);

  return `"${text.replace(/"/g, '""')}"`;
};

// Shared helper to build the CSV content
const buildHumanEvaluationsCsv = async () => {
  const evaluations = await Evaluation.find({
    evaluatorType: "HUMAN",
    status: "SUBMITTED",
  })
    .select(
      "sessionId raterId rubricVersion scores overallScore evidenceNote submittedAt"
    )
    .populate("raterId", "name")
    .populate("sessionId", "category difficulty status")
    .sort({ submittedAt: -1 })
    .lean();

  const headers = [
    "evaluationId",
    "sessionId",
    "sessionCategory",
    "sessionDifficulty",
    "raterId",
    "raterName",
    "communication",
    "clarity",
    "confidence",
    "contentQuality",
    "overallScore",
    "rubricVersion",
    "evidenceNote",
    "submittedAt",
  ];

  const rows = evaluations.map((evaluation) => [
    evaluation._id,
    evaluation.sessionId?._id,
    evaluation.sessionId?.category,
    evaluation.sessionId?.difficulty,
    evaluation.raterId?._id,
    evaluation.raterId?.name,
    evaluation.scores?.communication,
    evaluation.scores?.clarity,
    evaluation.scores?.confidence,
    evaluation.scores?.contentQuality,
    evaluation.overallScore,
    evaluation.rubricVersion,
    evaluation.evidenceNote,
    evaluation.submittedAt,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  return `\uFEFF${csv}`;
};

// GET /api/v1/admin/evaluations/export.csv
// Existing export: return CSV in the HTTP response
const exportHumanEvaluationsCsv = async (req, res, next) => {
  try {
    const csv = await buildHumanEvaluationsCsv();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vrai-human-evaluations.csv"'
    );

    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

// GET /api/v1/admin/evaluations/download.csv
// Save a copy inside backend/exports and send it for download
const downloadHumanEvaluationsCsv = async (req, res, next) => {
  try {
    const csv = await buildHumanEvaluationsCsv();

    const exportsDirectory = path.join(__dirname, "..", "exports");

    // Create exports folder if it doesn't exist
    await fs.mkdir(exportsDirectory, { recursive: true });

    // Use a unique filename to avoid overwriting previous exports
    const fileName = `human-evaluations-${Date.now()}.csv`;
    const filePath = path.join(exportsDirectory, fileName);

    // Save CSV to the project folder
    await fs.writeFile(filePath, csv, "utf8");

    // Send the saved file as a download
    return res.download(filePath, fileName, (error) => {
      if (error && !res.headersSent) {
        return next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  exportHumanEvaluationsCsv,
  downloadHumanEvaluationsCsv,
};

const express = require("express");
const {
  listUsers,
  getUserDetails,
  changeUserRole,
  listSessions,
  getSessionReport,
  listRaters,
  getRaterDetails,
} = require("../controllers/adminController");
const {
  exportHumanEvaluationsCsv,
  downloadHumanEvaluationsCsv,
} = require("../controllers/adminExportController");
const { requireAuth, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Every admin operation requires an authenticated admin account.
router.use(requireAuth, allowRoles("admin"));

router.get("/users", listUsers);
router.get("/users/:userId", getUserDetails);
router.patch("/users/:userId/role", changeUserRole);
router.get("/sessions", listSessions);
router.get("/sessions/:sessionId", getSessionReport);
router.get("/raters", listRaters);
router.get("/raters/:raterId", getRaterDetails);
router.get("/evaluations/export.csv", exportHumanEvaluationsCsv);
router.get("/evaluations/download.csv", downloadHumanEvaluationsCsv);

module.exports = router;

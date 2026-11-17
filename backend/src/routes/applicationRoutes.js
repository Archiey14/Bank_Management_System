const express = require("express");
const {
  createApplication,
  myApplications,
  listApplications,
  approveApplication,
  rejectApplication,
} = require("../controllers/applicationController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", createApplication);
router.get("/mine", myApplications);
router.get("/", authorizeRoles("staff", "admin"), listApplications);
router.patch("/:id/approve", authorizeRoles("staff", "admin"), approveApplication);
router.patch("/:id/reject", authorizeRoles("staff", "admin"), rejectApplication);

module.exports = router;

const express = require("express");
const { getSummary } = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/summary", getSummary);

module.exports = router;

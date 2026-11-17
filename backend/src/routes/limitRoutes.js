const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const { getDailyLimits } = require("../utils/limits");

const router = express.Router();

router.use(authMiddleware);

// GET /api/limits - today's withdrawal and transfer usage against the daily
// limits (they reset at 00:00 IST) plus the per-deposit maximum.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.status(200).json({ limits: await getDailyLimits(req.user._id) });
  })
);

module.exports = router;

const express = require("express");
const { listTransactions } = require("../controllers/transactionController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listTransactions);

module.exports = router;

const express = require("express");
const {
  listBeneficiaries,
  createBeneficiary,
  deleteBeneficiary,
} = require("../controllers/beneficiaryController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", listBeneficiaries);
router.post("/", createBeneficiary);
router.delete("/:id", deleteBeneficiary);

module.exports = router;

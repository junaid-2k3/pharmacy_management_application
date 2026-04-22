const express = require("express");
const medicinesRouter = require("./medicines");
const purchasesRouter = require("./purchases");
const salesRouter = require("./sales");
const reportsRouter = require("./reports");

const router = express.Router();

router.use("/medicines", medicinesRouter);
router.use("/purchases", purchasesRouter);
router.use("/sales", salesRouter);
router.use("/reports", reportsRouter);

module.exports = router;

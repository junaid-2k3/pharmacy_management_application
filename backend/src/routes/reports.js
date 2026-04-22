const express = require("express");
const db = require("../db/connection");
const asyncHandler = require("../middleware/asyncHandler");
const HttpError = require("../utils/httpError");
const { toDateOnly } = require("../utils/date");

const router = express.Router();

router.get(
  "/low-stock",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT
           m.medicine_id,
           m.name,
           m.generic_name,
           m.reorder_level,
           COALESCE(SUM(CASE WHEN pi.expiry_date >= date('now') THEN pi.remaining_quantity ELSE 0 END), 0) AS stock_quantity
         FROM medicines m
         LEFT JOIN purchase_items pi ON pi.medicine_id = m.medicine_id
         WHERE m.is_archived = 0
         GROUP BY m.medicine_id
         HAVING stock_quantity <= m.reorder_level
         ORDER BY stock_quantity ASC, m.name ASC`
      )
      .all();

    res.json({ count: rows.length, items: rows });
  })
);

router.get(
  "/expiry-alerts",
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT
           m.medicine_id,
           m.name,
           pi.purchase_item_id,
           pi.batch_number,
           pi.expiry_date,
           pi.remaining_quantity,
           CASE
             WHEN pi.expiry_date < date('now') THEN 'expired'
             WHEN pi.expiry_date <= date('now', '+30 day') THEN 'expiring_soon'
             ELSE 'ok'
           END AS status
         FROM purchase_items pi
         JOIN medicines m ON m.medicine_id = pi.medicine_id
         WHERE m.is_archived = 0
           AND pi.remaining_quantity > 0
           AND pi.expiry_date <= date('now', '+30 day')
         ORDER BY pi.expiry_date ASC, m.name ASC`
      )
      .all();

    const expired = rows.filter((row) => row.status === "expired");
    const expiringSoon = rows.filter((row) => row.status === "expiring_soon");

    res.json({
      expired_count: expired.length,
      expiring_soon_count: expiringSoon.length,
      expired,
      expiring_soon: expiringSoon,
    });
  })
);

router.get(
  "/sales-summary",
  asyncHandler(async (req, res) => {
    const startDate = toDateOnly(req.query.start_date);
    const endDate = toDateOnly(req.query.end_date);

    if (!startDate || !endDate) {
      throw new HttpError(400, "start_date and end_date are required (YYYY-MM-DD).");
    }

    const overview = db
      .prepare(
        `SELECT
           COALESCE(SUM(total_amount), 0) AS total_revenue,
           COUNT(*) AS number_of_bills
         FROM sales
         WHERE sale_date BETWEEN ? AND ?`
      )
      .get(startDate, endDate);

    const medicineBreakdown = db
      .prepare(
        `SELECT
           si.medicine_id,
           m.name AS medicine_name,
           SUM(si.quantity) AS total_quantity_sold,
           SUM(si.subtotal) AS total_value
         FROM sale_items si
         JOIN sales s ON s.sale_id = si.sale_id
         JOIN medicines m ON m.medicine_id = si.medicine_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY si.medicine_id, m.name
         ORDER BY total_value DESC`
      )
      .all(startDate, endDate);

    res.json({
      start_date: startDate,
      end_date: endDate,
      total_revenue: Number(overview.total_revenue || 0),
      number_of_bills: overview.number_of_bills || 0,
      by_medicine: medicineBreakdown,
    });
  })
);

router.get(
  "/purchase-history",
  asyncHandler(async (req, res) => {
    const startDate = toDateOnly(req.query.start_date);
    const endDate = toDateOnly(req.query.end_date);

    if (!startDate || !endDate) {
      throw new HttpError(400, "start_date and end_date are required (YYYY-MM-DD).");
    }

    const purchases = db
      .prepare(
        `SELECT
           purchase_id,
           supplier_name,
           purchase_date,
           invoice_reference,
           remarks,
           total_amount,
           created_at
         FROM purchases
         WHERE purchase_date BETWEEN ? AND ?
         ORDER BY purchase_date DESC, purchase_id DESC`
      )
      .all(startDate, endDate);

    const lineStmt = db.prepare(
      `SELECT
         pi.purchase_item_id,
         pi.medicine_id,
         m.name AS medicine_name,
         pi.batch_number,
         pi.expiry_date,
         pi.quantity,
         pi.remaining_quantity,
         pi.unit_cost,
         pi.subtotal
       FROM purchase_items pi
       JOIN medicines m ON m.medicine_id = pi.medicine_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.purchase_item_id ASC`
    );

    res.json(
      purchases.map((purchase) => ({
        ...purchase,
        line_items: lineStmt.all(purchase.purchase_id),
      }))
    );
  })
);

module.exports = router;

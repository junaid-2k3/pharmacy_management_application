const express = require("express");
const db = require("../db/connection");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const medicineWithStockSelect = `
  SELECT
    m.medicine_id,
    m.name,
    m.generic_name,
    m.category,
    m.unit,
    m.manufacturer,
    m.purchase_price,
    m.sale_price,
    m.reorder_level,
    m.is_archived,
    m.created_at,
    m.updated_at,
    COALESCE((
      SELECT SUM(pi.remaining_quantity)
      FROM purchase_items pi
      WHERE pi.medicine_id = m.medicine_id
        AND pi.expiry_date >= date('now')
    ), 0) AS stock_quantity
  FROM medicines m
`;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const rows = db
      .prepare(
        `${medicineWithStockSelect}
         WHERE (? = 1 OR m.is_archived = 0)
         ORDER BY m.name ASC`
      )
      .all(includeArchived ? 1 : 0);

    res.json(rows);
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 1) {
      return res.json([]);
    }

    const rows = db
      .prepare(
        `${medicineWithStockSelect}
         WHERE m.is_archived = 0
           AND (m.name LIKE @q OR m.generic_name LIKE @q)
         ORDER BY m.name ASC
         LIMIT 25`
      )
      .all({ q: `%${q}%` });

    res.json(rows);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      name,
      generic_name,
      category,
      unit,
      manufacturer,
      purchase_price,
      sale_price,
      reorder_level,
    } = req.body;

    if (
      !name ||
      !generic_name ||
      !category ||
      !unit ||
      !manufacturer ||
      purchase_price === undefined ||
      sale_price === undefined ||
      reorder_level === undefined
    ) {
      throw new HttpError(400, "All medicine fields are required.");
    }

    const pPrice = Number(purchase_price);
    const sPrice = Number(sale_price);
    const reorder = Number(reorder_level);

    if (Number.isNaN(pPrice) || Number.isNaN(sPrice) || Number.isNaN(reorder)) {
      throw new HttpError(400, "Invalid numeric value for price or reorder level.");
    }

    if (pPrice < 0 || sPrice < 0 || reorder < 0) {
      throw new HttpError(400, "Prices and reorder level must be non-negative.");
    }

    const info = db
      .prepare(
        `INSERT INTO medicines
           (name, generic_name, category, unit, manufacturer, purchase_price, sale_price, reorder_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name.trim(), generic_name.trim(), category.trim(), unit.trim(), manufacturer.trim(), pPrice, sPrice, reorder);

    const created = db
      .prepare(`${medicineWithStockSelect} WHERE m.medicine_id = ?`)
      .get(info.lastInsertRowid);

    res.status(201).json(created);
  })
);

router.put(
  "/:medicineId",
  asyncHandler(async (req, res) => {
    const medicineId = Number(req.params.medicineId);
    if (Number.isNaN(medicineId)) {
      throw new HttpError(400, "Invalid medicine id.");
    }

    const existing = db.prepare("SELECT * FROM medicines WHERE medicine_id = ?").get(medicineId);
    if (!existing) {
      throw new HttpError(404, "Medicine not found.");
    }

    const {
      name = existing.name,
      generic_name = existing.generic_name,
      category = existing.category,
      unit = existing.unit,
      manufacturer = existing.manufacturer,
      purchase_price = existing.purchase_price,
      sale_price = existing.sale_price,
      reorder_level = existing.reorder_level,
    } = req.body;

    const pPrice = Number(purchase_price);
    const sPrice = Number(sale_price);
    const reorder = Number(reorder_level);

    if (
      !name ||
      !generic_name ||
      !category ||
      !unit ||
      !manufacturer ||
      Number.isNaN(pPrice) ||
      Number.isNaN(sPrice) ||
      Number.isNaN(reorder)
    ) {
      throw new HttpError(400, "Invalid medicine payload.");
    }

    if (pPrice < 0 || sPrice < 0 || reorder < 0) {
      throw new HttpError(400, "Prices and reorder level must be non-negative.");
    }

    db.prepare(
      `UPDATE medicines
       SET name = ?,
           generic_name = ?,
           category = ?,
           unit = ?,
           manufacturer = ?,
           purchase_price = ?,
           sale_price = ?,
           reorder_level = ?,
           updated_at = datetime('now')
       WHERE medicine_id = ?`
    ).run(name.trim(), generic_name.trim(), category.trim(), unit.trim(), manufacturer.trim(), pPrice, sPrice, reorder, medicineId);

    const updated = db
      .prepare(`${medicineWithStockSelect} WHERE m.medicine_id = ?`)
      .get(medicineId);

    res.json(updated);
  })
);

router.patch(
  "/:medicineId/archive",
  asyncHandler(async (req, res) => {
    const medicineId = Number(req.params.medicineId);
    if (Number.isNaN(medicineId)) {
      throw new HttpError(400, "Invalid medicine id.");
    }

    const info = db
      .prepare(
        `UPDATE medicines
         SET is_archived = 1,
             updated_at = datetime('now')
         WHERE medicine_id = ? AND is_archived = 0`
      )
      .run(medicineId);

    if (info.changes === 0) {
      throw new HttpError(404, "Medicine not found or already archived.");
    }

    const archived = db
      .prepare(`${medicineWithStockSelect} WHERE m.medicine_id = ?`)
      .get(medicineId);

    res.json(archived);
  })
);

module.exports = router;

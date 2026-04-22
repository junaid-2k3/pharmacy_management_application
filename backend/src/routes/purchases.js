const express = require("express");
const db = require("../db/connection");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../middleware/asyncHandler");
const { toDateOnly } = require("../utils/date");

const router = express.Router();

function validateLine(line) {
  if (
    !line ||
    line.medicine_id === undefined ||
    !line.batch_number ||
    !line.expiry_date ||
    line.quantity === undefined ||
    line.unit_cost === undefined
  ) {
    throw new HttpError(400, "Each purchase line needs medicine_id, batch_number, expiry_date, quantity, and unit_cost.");
  }

  const medicineId = Number(line.medicine_id);
  const quantity = Number(line.quantity);
  const unitCost = Number(line.unit_cost);
  const expiryDate = toDateOnly(line.expiry_date);

  if (Number.isNaN(medicineId) || Number.isNaN(quantity) || Number.isNaN(unitCost)) {
    throw new HttpError(400, "Invalid numeric values in purchase lines.");
  }

  if (!expiryDate) {
    throw new HttpError(400, "Invalid expiry date in purchase lines.");
  }

  if (quantity <= 0 || unitCost < 0) {
    throw new HttpError(400, "Quantity must be > 0 and unit_cost must be non-negative.");
  }

  const today = toDateOnly();
  if (expiryDate <= today) {
    throw new HttpError(400, "Purchase item expiry date must be in the future.");
  }

  return {
    medicineId,
    batchNumber: String(line.batch_number).trim(),
    expiryDate,
    quantity,
    unitCost,
    subtotal: Number((quantity * unitCost).toFixed(2)),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const purchases = db
      .prepare(
        `SELECT purchase_id, supplier_name, purchase_date, invoice_reference, remarks, total_amount, created_at
         FROM purchases
         ORDER BY purchase_date DESC, purchase_id DESC`
      )
      .all();

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

    const data = purchases.map((purchase) => ({
      ...purchase,
      line_items: lineStmt.all(purchase.purchase_id),
    }));

    res.json(data);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { purchase_date, supplier_name, invoice_reference, remarks, line_items } = req.body;

    if (!supplier_name || !Array.isArray(line_items) || line_items.length === 0) {
      throw new HttpError(400, "supplier_name and at least one line item are required.");
    }

    const purchaseDate = toDateOnly(purchase_date);
    if (!purchaseDate) {
      throw new HttpError(400, "Invalid purchase date.");
    }

    const normalizedLines = line_items.map(validateLine);

    const existingMedicines = db
      .prepare(
        `SELECT medicine_id, is_archived
         FROM medicines
         WHERE medicine_id IN (${normalizedLines.map(() => "?").join(",")})`
      )
      .all(...normalizedLines.map((line) => line.medicineId));

    if (existingMedicines.length !== normalizedLines.length) {
      throw new HttpError(400, "One or more medicines do not exist.");
    }

    const archived = existingMedicines.find((medicine) => medicine.is_archived === 1);
    if (archived) {
      throw new HttpError(400, "Archived medicines cannot be purchased.");
    }

    const totalAmount = Number(
      normalizedLines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2)
    );

    const createPurchase = db.transaction(() => {
      const purchaseInfo = db
        .prepare(
          `INSERT INTO purchases (supplier_name, purchase_date, invoice_reference, remarks, total_amount)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          String(supplier_name).trim(),
          purchaseDate,
          invoice_reference ? String(invoice_reference).trim() : null,
          remarks ? String(remarks).trim() : null,
          totalAmount
        );

      const insertLine = db.prepare(
        `INSERT INTO purchase_items
           (purchase_id, medicine_id, batch_number, expiry_date, quantity, remaining_quantity, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const line of normalizedLines) {
        insertLine.run(
          purchaseInfo.lastInsertRowid,
          line.medicineId,
          line.batchNumber,
          line.expiryDate,
          line.quantity,
          line.quantity,
          line.unitCost,
          line.subtotal
        );
      }

      return purchaseInfo.lastInsertRowid;
    });

    const purchaseId = createPurchase();

    const created = db
      .prepare(
        `SELECT purchase_id, supplier_name, purchase_date, invoice_reference, remarks, total_amount, created_at
         FROM purchases
         WHERE purchase_id = ?`
      )
      .get(purchaseId);

    const lineItems = db
      .prepare(
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
      )
      .all(purchaseId);

    res.status(201).json({ ...created, line_items: lineItems });
  })
);

module.exports = router;

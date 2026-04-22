const express = require("express");
const db = require("../db/connection");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../middleware/asyncHandler");
const { toDateOnly } = require("../utils/date");

const router = express.Router();

function generateInvoiceNo(saleDate) {
  const dayToken = saleDate.replace(/-/g, "");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sales
       WHERE sale_date = ?`
    )
    .get(saleDate);

  const seq = String((row.count || 0) + 1).padStart(4, "0");
  return `INV-${dayToken}-${seq}`;
}

function normalizeSaleLine(line) {
  if (!line || line.medicine_id === undefined || line.quantity === undefined) {
    throw new HttpError(400, "Each sale line requires medicine_id and quantity.");
  }

  const medicineId = Number(line.medicine_id);
  const quantity = Number(line.quantity);

  if (Number.isNaN(medicineId) || Number.isNaN(quantity) || quantity <= 0) {
    throw new HttpError(400, "Invalid medicine_id or quantity in sale lines.");
  }

  return { medicineId, quantity };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sales = db
      .prepare(
        `SELECT sale_id, invoice_no, sale_date, customer_name, reference, payment_method, total_amount, created_at
         FROM sales
         ORDER BY sale_date DESC, sale_id DESC`
      )
      .all();

    const lineStmt = db.prepare(
      `SELECT
         si.sale_item_id,
         si.medicine_id,
         m.name AS medicine_name,
         si.purchase_item_id,
         si.batch_number,
         si.expiry_date,
         si.quantity,
         si.unit_price,
         si.subtotal
       FROM sale_items si
       JOIN medicines m ON m.medicine_id = si.medicine_id
       WHERE si.sale_id = ?
       ORDER BY si.sale_item_id ASC`
    );

    const data = sales.map((sale) => ({
      ...sale,
      line_items: lineStmt.all(sale.sale_id),
    }));

    res.json(data);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { sale_date, customer_name, reference, line_items } = req.body;

    if (!Array.isArray(line_items) || line_items.length === 0) {
      throw new HttpError(400, "At least one sale line item is required.");
    }

    const saleDate = toDateOnly(sale_date);
    if (!saleDate) {
      throw new HttpError(400, "Invalid sale date.");
    }

    const normalizedLines = line_items.map(normalizeSaleLine);

    const medicineIds = [...new Set(normalizedLines.map((line) => line.medicineId))];
    const medicines = db
      .prepare(
        `SELECT medicine_id, name, sale_price, is_archived
         FROM medicines
         WHERE medicine_id IN (${medicineIds.map(() => "?").join(",")})`
      )
      .all(...medicineIds);

    if (medicines.length !== medicineIds.length) {
      throw new HttpError(400, "One or more medicines do not exist.");
    }

    const medicineMap = new Map(medicines.map((m) => [m.medicine_id, m]));

    for (const line of normalizedLines) {
      const medicine = medicineMap.get(line.medicineId);
      if (medicine.is_archived === 1) {
        throw new HttpError(400, `Archived medicine cannot be sold: ${medicine.name}`);
      }
    }

    const createSale = db.transaction(() => {
      const invoiceNo = generateInvoiceNo(saleDate);
      const saleInfo = db
        .prepare(
          `INSERT INTO sales (invoice_no, sale_date, customer_name, reference, payment_method, total_amount)
           VALUES (?, ?, ?, ?, 'cash', 0)`
        )
        .run(
          invoiceNo,
          saleDate,
          customer_name ? String(customer_name).trim() : null,
          reference ? String(reference).trim() : null
        );

      const saleId = saleInfo.lastInsertRowid;
      const insertSaleItem = db.prepare(
        `INSERT INTO sale_items
           (sale_id, medicine_id, purchase_item_id, batch_number, expiry_date, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const decrementBatch = db.prepare(
        `UPDATE purchase_items
         SET remaining_quantity = remaining_quantity - ?
         WHERE purchase_item_id = ? AND remaining_quantity >= ?`
      );

      let totalAmount = 0;

      for (const line of normalizedLines) {
        const medicine = medicineMap.get(line.medicineId);
        let qtyToFulfill = line.quantity;

        const eligibleBatches = db
          .prepare(
            `SELECT purchase_item_id, batch_number, expiry_date, remaining_quantity
             FROM purchase_items
             WHERE medicine_id = ?
               AND remaining_quantity > 0
               AND expiry_date > date('now')
             ORDER BY expiry_date ASC, purchase_item_id ASC`
          )
          .all(line.medicineId);

        if (eligibleBatches.length === 0) {
          throw new HttpError(400, `No non-expired stock available for ${medicine.name}.`);
        }

        const totalAvailable = eligibleBatches.reduce(
          (sum, batch) => sum + batch.remaining_quantity,
          0
        );

        if (totalAvailable < qtyToFulfill) {
          throw new HttpError(400, `Insufficient stock for ${medicine.name}. Requested ${qtyToFulfill}, available ${totalAvailable}.`);
        }

        for (const batch of eligibleBatches) {
          if (qtyToFulfill <= 0) {
            break;
          }

          const useQty = Math.min(qtyToFulfill, batch.remaining_quantity);
          const lineSubtotal = Number((useQty * Number(medicine.sale_price)).toFixed(2));

          const result = decrementBatch.run(useQty, batch.purchase_item_id, useQty);
          if (result.changes === 0) {
            throw new HttpError(409, "Stock changed while processing sale. Please retry.");
          }

          insertSaleItem.run(
            saleId,
            line.medicineId,
            batch.purchase_item_id,
            batch.batch_number,
            batch.expiry_date,
            useQty,
            medicine.sale_price,
            lineSubtotal
          );

          totalAmount += lineSubtotal;
          qtyToFulfill -= useQty;
        }
      }

      db.prepare("UPDATE sales SET total_amount = ? WHERE sale_id = ?").run(
        Number(totalAmount.toFixed(2)),
        saleId
      );

      return saleId;
    });

    const saleId = createSale();

    const sale = db
      .prepare(
        `SELECT sale_id, invoice_no, sale_date, customer_name, reference, payment_method, total_amount, created_at
         FROM sales WHERE sale_id = ?`
      )
      .get(saleId);

    const lineItems = db
      .prepare(
        `SELECT
           si.sale_item_id,
           si.medicine_id,
           m.name AS medicine_name,
           si.purchase_item_id,
           si.batch_number,
           si.expiry_date,
           si.quantity,
           si.unit_price,
           si.subtotal
         FROM sale_items si
         JOIN medicines m ON m.medicine_id = si.medicine_id
         WHERE si.sale_id = ?
         ORDER BY si.sale_item_id ASC`
      )
      .all(saleId);

    res.status(201).json({ ...sale, line_items: lineItems });
  })
);

router.get(
  "/:saleId/receipt",
  asyncHandler(async (req, res) => {
    const saleId = Number(req.params.saleId);
    if (Number.isNaN(saleId)) {
      throw new HttpError(400, "Invalid sale id.");
    }

    const sale = db
      .prepare(
        `SELECT sale_id, invoice_no, sale_date, customer_name, reference, payment_method, total_amount, created_at
         FROM sales
         WHERE sale_id = ?`
      )
      .get(saleId);

    if (!sale) {
      throw new HttpError(404, "Sale not found.");
    }

    const lineItems = db
      .prepare(
        `SELECT
           si.sale_item_id,
           si.medicine_id,
           m.name AS medicine_name,
           si.batch_number,
           si.expiry_date,
           si.quantity,
           si.unit_price,
           si.subtotal
         FROM sale_items si
         JOIN medicines m ON m.medicine_id = si.medicine_id
         WHERE si.sale_id = ?
         ORDER BY si.sale_item_id ASC`
      )
      .all(saleId);

    res.json({
      ...sale,
      line_items: lineItems,
      pharmacy_name: "Waseela Pharmacy",
      generated_at: new Date().toISOString(),
    });
  })
);

module.exports = router;

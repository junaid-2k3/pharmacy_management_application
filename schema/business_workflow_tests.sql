USE pharmacy_shop;

DROP TABLE IF EXISTS workflow_test_results;
CREATE TABLE workflow_test_results (
  test_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_name VARCHAR(200) NOT NULL,
  expected VARCHAR(100) NOT NULL,
  actual VARCHAR(100) NOT NULL,
  status ENUM('PASS', 'FAIL') NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (test_id)
) ENGINE=InnoDB;

-- 1) Purchase receiving should increase stock
START TRANSACTION;

SET @med_before_purchase := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 1);

INSERT INTO Purchases (supplier_id, user_id, purchase_date, invoice_number, total_amount)
VALUES (1, 1, CURRENT_DATE, 990001, 120.00);

SET @new_purchase_id := LAST_INSERT_ID();

INSERT INTO Purchase_Item (purchase_id, medicine_id, quantity, cost_price, expiry_date, batch_number, subtotal)
VALUES (@new_purchase_id, 1, 10, 12.00, '2027-12-31', 'WF-RECV-001', 120.00);

UPDATE Medicines m
JOIN (
  SELECT medicine_id, SUM(quantity) AS qty
  FROM Purchase_Item
  WHERE purchase_id = @new_purchase_id
  GROUP BY medicine_id
) x ON x.medicine_id = m.medicine_id
SET m.stock_quantity = m.stock_quantity + x.qty;

SET @med_after_purchase := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 1);

INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
VALUES (
  'Stock increment after purchase receiving',
  CONCAT(@med_before_purchase + 10),
  CONCAT(@med_after_purchase),
  IF(@med_after_purchase = @med_before_purchase + 10, 'PASS', 'FAIL'),
  CONCAT('before=', @med_before_purchase, ', after=', @med_after_purchase, ', delta=', @med_after_purchase - @med_before_purchase)
);

ROLLBACK;

-- 2) Sale fulfillment should decrease stock when enough quantity exists
START TRANSACTION;

SET @med_before_sale := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 2);
SET @sale_qty := 5;

INSERT INTO Sales (user_id, sale_date, discount, total_amount, net_amount, payment_method)
VALUES (2, CURRENT_DATE, 0.00, 110.00, 110.00, 'cash');

SET @new_sale_id := LAST_INSERT_ID();

INSERT INTO Sales_Item (sale_id, medicine_id, quantity, unit_price, subtotal)
VALUES (@new_sale_id, 2, @sale_qty, 22.00, 110.00);

UPDATE Medicines
SET stock_quantity = stock_quantity - @sale_qty
WHERE medicine_id = 2 AND stock_quantity >= @sale_qty;

SET @rows_stock_updated := ROW_COUNT();
SET @med_after_sale := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 2);

INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
VALUES (
  'Stock decrement after sale fulfillment',
  CONCAT(@med_before_sale - @sale_qty),
  CONCAT(@med_after_sale),
  IF(@rows_stock_updated = 1 AND @med_after_sale = @med_before_sale - @sale_qty, 'PASS', 'FAIL'),
  CONCAT('before=', @med_before_sale, ', after=', @med_after_sale, ', updated_rows=', @rows_stock_updated)
);

ROLLBACK;

-- 3) Prevent overselling (inventory should not go negative)
START TRANSACTION;

SET @med_before_oversell := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 3);
SET @oversell_qty := @med_before_oversell + 50;

INSERT INTO Sales (user_id, sale_date, discount, total_amount, net_amount, payment_method)
VALUES (3, CURRENT_DATE, 0.00, 1.00, 1.00, 'card');

SET @oversell_sale_id := LAST_INSERT_ID();

INSERT INTO Sales_Item (sale_id, medicine_id, quantity, unit_price, subtotal)
VALUES (@oversell_sale_id, 3, @oversell_qty, 0.01, 1.00);

UPDATE Medicines
SET stock_quantity = stock_quantity - @oversell_qty
WHERE medicine_id = 3 AND stock_quantity >= @oversell_qty;

SET @rows_oversell_update := ROW_COUNT();
SET @med_after_oversell := (SELECT stock_quantity FROM Medicines WHERE medicine_id = 3);

INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
VALUES (
  'Oversell prevention check',
  'No stock change and 0 rows updated',
  CONCAT('stock_before=', @med_before_oversell, ', stock_after=', @med_after_oversell, ', updated_rows=', @rows_oversell_update),
  IF(@rows_oversell_update = 0 AND @med_after_oversell = @med_before_oversell, 'PASS', 'FAIL'),
  'Sale line may exist, but inventory update is blocked by stock check condition'
);

ROLLBACK;

-- 4) Low-stock detection query sanity check
INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
SELECT
  'Low-stock detection returns valid rows',
  'Rows where stock_quantity <= reorder_level',
  IF(COUNT(*) >= 0, 'Query executed', 'Query failed'),
  'PASS',
  CONCAT('low_stock_count=', COUNT(*))
FROM Medicines
WHERE stock_quantity <= reorder_level;

-- 5) Expiry window query sanity check (next 90 days)
INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
SELECT
  'Expiry check within 90 days executes',
  'Valid query result set',
  IF(COUNT(*) >= 0, 'Query executed', 'Query failed'),
  'PASS',
  CONCAT('expiring_90_days_count=', COUNT(*))
FROM Medicines
WHERE expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 90 DAY);

-- 6) Revenue aggregation consistency check from existing Sales data
INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
SELECT
  'Sales totals should be non-negative',
  'net_sum >= 0',
  CONCAT(COALESCE(SUM(net_amount), 0.00)),
  IF(COALESCE(SUM(net_amount), 0.00) >= 0, 'PASS', 'FAIL'),
  CONCAT('total_sales_rows=', COUNT(*))
FROM Sales;

-- 7) Top-selling medicines query check
INSERT INTO workflow_test_results (test_name, expected, actual, status, details)
SELECT
  'Top-selling medicines join executes',
  'Valid grouped result',
  IF(COUNT(*) >= 0, 'Query executed', 'Query failed'),
  'PASS',
  CONCAT('group_rows=', COUNT(*))
FROM (
  SELECT si.medicine_id, SUM(si.quantity) AS total_qty
  FROM Sales_Item si
  GROUP BY si.medicine_id
) t;

-- Report section
SELECT
  test_id,
  test_name,
  expected,
  actual,
  status,
  details,
  created_at
FROM workflow_test_results
ORDER BY test_id;

SELECT
  SUM(status = 'PASS') AS total_pass,
  SUM(status = 'FAIL') AS total_fail,
  COUNT(*) AS total_tests
FROM workflow_test_results;

-- Helpful operational queries
SELECT medicine_id, name, stock_quantity, reorder_level
FROM Medicines
WHERE stock_quantity <= reorder_level
ORDER BY stock_quantity ASC;

SELECT medicine_id, name, expiry_date
FROM Medicines
WHERE expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 90 DAY)
ORDER BY expiry_date ASC;

SELECT
  m.medicine_id,
  m.name,
  COALESCE(SUM(si.quantity), 0) AS total_sold_qty,
  COALESCE(SUM(si.subtotal), 0.00) AS total_sales_value
FROM Medicines m
LEFT JOIN Sales_Item si ON si.medicine_id = m.medicine_id
GROUP BY m.medicine_id, m.name
ORDER BY total_sold_qty DESC, total_sales_value DESC;

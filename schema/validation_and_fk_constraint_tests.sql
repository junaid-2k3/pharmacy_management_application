USE pharmacy_shop;

DROP TABLE IF EXISTS validation_results;
CREATE TABLE validation_results (
  test_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_name VARCHAR(200) NOT NULL,
  expected ENUM('PASS', 'FAIL') NOT NULL,
  actual ENUM('PASS', 'FAIL') NOT NULL,
  status ENUM('PASS', 'FAIL') NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (test_id)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS run_expect_success;
DROP PROCEDURE IF EXISTS run_expect_failure;

DELIMITER $$
CREATE PROCEDURE run_expect_success(IN p_test_name VARCHAR(200), IN p_sql TEXT)
BEGIN
  DECLARE v_had_error BOOLEAN DEFAULT FALSE;
  DECLARE v_prepared BOOLEAN DEFAULT FALSE;
  DECLARE v_details TEXT DEFAULT NULL;

  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    SET v_had_error = TRUE;
    GET DIAGNOSTICS CONDITION 1 @v_sqlstate = RETURNED_SQLSTATE, @v_errno = MYSQL_ERRNO, @v_msg = MESSAGE_TEXT;
    SET v_details = CONCAT('SQLSTATE=', COALESCE(@v_sqlstate, ''), ', ERRNO=', COALESCE(@v_errno, ''), ', MSG=', COALESCE(@v_msg, ''));
  END;

  START TRANSACTION;
  SET @stmt = p_sql;
  PREPARE test_stmt FROM @stmt;
  SET v_prepared = TRUE;
  EXECUTE test_stmt;

  IF v_prepared THEN
    DEALLOCATE PREPARE test_stmt;
  END IF;

  INSERT INTO validation_results (test_name, expected, actual, status, details)
  VALUES (
    p_test_name,
    'PASS',
    IF(v_had_error, 'FAIL', 'PASS'),
    IF(v_had_error, 'FAIL', 'PASS'),
    v_details
  );

  ROLLBACK;
END$$

CREATE PROCEDURE run_expect_failure(IN p_test_name VARCHAR(200), IN p_sql TEXT)
BEGIN
  DECLARE v_had_error BOOLEAN DEFAULT FALSE;
  DECLARE v_prepared BOOLEAN DEFAULT FALSE;
  DECLARE v_details TEXT DEFAULT NULL;

  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
  BEGIN
    SET v_had_error = TRUE;
    GET DIAGNOSTICS CONDITION 1 @v_sqlstate = RETURNED_SQLSTATE, @v_errno = MYSQL_ERRNO, @v_msg = MESSAGE_TEXT;
    SET v_details = CONCAT('SQLSTATE=', COALESCE(@v_sqlstate, ''), ', ERRNO=', COALESCE(@v_errno, ''), ', MSG=', COALESCE(@v_msg, ''));
  END;

  START TRANSACTION;
  SET @stmt = p_sql;
  PREPARE test_stmt FROM @stmt;
  SET v_prepared = TRUE;
  EXECUTE test_stmt;

  IF v_prepared THEN
    DEALLOCATE PREPARE test_stmt;
  END IF;

  INSERT INTO validation_results (test_name, expected, actual, status, details)
  VALUES (
    p_test_name,
    'FAIL',
    IF(v_had_error, 'FAIL', 'PASS'),
    IF(v_had_error, 'PASS', 'FAIL'),
    v_details
  );

  ROLLBACK;
END$$
DELIMITER ;

-- Successful behavior tests
CALL run_expect_success(
  'Valid medicine insert',
  "INSERT INTO Medicines (name, category, manufacturer, unit_price, stock_quantity, expiry_date, reorder_level) VALUES ('TestMed', 'TestCat', 'TestMfg', 10.00, 5, '2027-01-01', 1)"
);

CALL run_expect_success(
  'Valid purchase insert',
  "INSERT INTO Purchases (supplier_id, user_id, purchase_date, invoice_number, total_amount) VALUES (1, 1, '2026-03-20', 999001, 50.00)"
);

CALL run_expect_success(
  'Valid sale insert',
  "INSERT INTO Sales (user_id, sale_date, discount, total_amount, net_amount, payment_method) VALUES (2, '2026-03-20', 5.00, 100.00, 95.00, 'cash')"
);

-- Constraint and FK failure tests
CALL run_expect_failure(
  'Duplicate supplier email must fail',
  "INSERT INTO Suppliers (name, contact_number, email, is_active) VALUES ('Dup Supplier', '+92-300-9999999', 'contact@medisupply.pk', TRUE)"
);

CALL run_expect_failure(
  'Duplicate user email must fail',
  "INSERT INTO Users (name, role, phone, email, password) VALUES ('Dup User', 'cashier', '+92-311-9999999', 'ali@pharmacy.local', 'x')"
);

CALL run_expect_failure(
  'Negative medicine unit_price must fail',
  "INSERT INTO Medicines (name, category, manufacturer, unit_price, stock_quantity, expiry_date, reorder_level) VALUES ('BadMed', 'BadCat', 'BadMfg', -1.00, 10, '2027-01-01', 1)"
);

CALL run_expect_failure(
  'Negative stock quantity must fail',
  "INSERT INTO Medicines (name, category, manufacturer, unit_price, stock_quantity, expiry_date, reorder_level) VALUES ('BadStock', 'BadCat', 'BadMfg', 5.00, -2, '2027-01-01', 1)"
);

CALL run_expect_failure(
  'Purchase with invalid supplier FK must fail',
  "INSERT INTO Purchases (supplier_id, user_id, purchase_date, invoice_number, total_amount) VALUES (99999, 1, '2026-03-20', 999002, 10.00)"
);

CALL run_expect_failure(
  'Purchase with invalid user FK must fail',
  "INSERT INTO Purchases (supplier_id, user_id, purchase_date, invoice_number, total_amount) VALUES (1, 99999, '2026-03-20', 999003, 10.00)"
);

CALL run_expect_failure(
  'Duplicate purchase invoice_number must fail',
  "INSERT INTO Purchases (supplier_id, user_id, purchase_date, invoice_number, total_amount) VALUES (1, 1, '2026-03-20', 1001, 300.00)"
);

CALL run_expect_failure(
  'Purchase item with quantity 0 must fail',
  "INSERT INTO Purchase_Item (purchase_id, medicine_id, quantity, cost_price, expiry_date, batch_number, subtotal) VALUES (1, 1, 0, 2.00, '2027-01-01', 'BAD-BATCH-0', 0.00)"
);

CALL run_expect_failure(
  'Sales item with invalid medicine FK must fail',
  "INSERT INTO Sales_Item (sale_id, medicine_id, quantity, unit_price, subtotal) VALUES (1, 99999, 1, 5.00, 5.00)"
);

CALL run_expect_failure(
  'Sales item with quantity 0 must fail',
  "INSERT INTO Sales_Item (sale_id, medicine_id, quantity, unit_price, subtotal) VALUES (1, 1, 0, 5.00, 0.00)"
);

CALL run_expect_failure(
  'Deleting referenced medicine must fail (RESTRICT)',
  "DELETE FROM Medicines WHERE medicine_id = 1"
);

CALL run_expect_failure(
  'Deleting referenced user must fail (RESTRICT)',
  "DELETE FROM Users WHERE user_id = 2"
);

-- Cascade behavior tests with manual assertions
START TRANSACTION;
SET @before_sale_items = (SELECT COUNT(*) FROM Sales_Item WHERE sale_id = 2);
DELETE FROM Sales WHERE sale_id = 2;
SET @after_sale_items = (SELECT COUNT(*) FROM Sales_Item WHERE sale_id = 2);
INSERT INTO validation_results (test_name, expected, actual, status, details)
VALUES (
  'Deleting sale should cascade delete sales_item',
  'PASS',
  IF(@before_sale_items > 0 AND @after_sale_items = 0, 'PASS', 'FAIL'),
  IF(@before_sale_items > 0 AND @after_sale_items = 0, 'PASS', 'FAIL'),
  CONCAT('before=', @before_sale_items, ', after=', @after_sale_items)
);
ROLLBACK;

START TRANSACTION;
SET @before_purchase_items = (SELECT COUNT(*) FROM Purchase_Item WHERE purchase_id = 2);
DELETE FROM Purchases WHERE purchase_id = 2;
SET @after_purchase_items = (SELECT COUNT(*) FROM Purchase_Item WHERE purchase_id = 2);
INSERT INTO validation_results (test_name, expected, actual, status, details)
VALUES (
  'Deleting purchase should cascade delete purchase_item',
  'PASS',
  IF(@before_purchase_items > 0 AND @after_purchase_items = 0, 'PASS', 'FAIL'),
  IF(@before_purchase_items > 0 AND @after_purchase_items = 0, 'PASS', 'FAIL'),
  CONCAT('before=', @before_purchase_items, ', after=', @after_purchase_items)
);
ROLLBACK;

-- Functional query checks
INSERT INTO validation_results (test_name, expected, actual, status, details)
SELECT
  'Functional join check: sales with user names',
  'PASS',
  IF(COUNT(*) > 0, 'PASS', 'FAIL'),
  IF(COUNT(*) > 0, 'PASS', 'FAIL'),
  CONCAT('rows=', COUNT(*))
FROM Sales s
JOIN Users u ON u.user_id = s.user_id;

INSERT INTO validation_results (test_name, expected, actual, status, details)
SELECT
  'Functional join check: purchase lines with medicine names',
  'PASS',
  IF(COUNT(*) > 0, 'PASS', 'FAIL'),
  IF(COUNT(*) > 0, 'PASS', 'FAIL'),
  CONCAT('rows=', COUNT(*))
FROM Purchase_Item pi
JOIN Purchases p ON p.purchase_id = pi.purchase_id
JOIN Medicines m ON m.medicine_id = pi.medicine_id;

-- Final report
SELECT
  test_id,
  test_name,
  expected,
  actual,
  status,
  details,
  created_at
FROM validation_results
ORDER BY test_id;

SELECT
  SUM(status = 'PASS') AS total_pass,
  SUM(status = 'FAIL') AS total_fail,
  COUNT(*) AS total_tests
FROM validation_results;

-- Optional cleanup
DROP PROCEDURE IF EXISTS run_expect_success;
DROP PROCEDURE IF EXISTS run_expect_failure;

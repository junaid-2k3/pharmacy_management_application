USE pharmacy_shop;

-- Idempotent sample master data
INSERT INTO Suppliers (supplier_id, name, contact_number, email, is_active)
VALUES
  (1, 'MediSupply Distributors', '+92-300-1111111', 'contact@medisupply.pk', TRUE),
  (2, 'HealthCore Pharma', '+92-300-2222222', 'sales@healthcore.pk', TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  contact_number = VALUES(contact_number),
  email = VALUES(email),
  is_active = VALUES(is_active);

INSERT INTO Users (user_id, name, role, phone, email, password)
VALUES
  (1, 'Ayesha Khan', 'admin', '+92-311-1111111', 'ayesha@pharmacy.local', '$2y$10$adminhashplaceholder'),
  (2, 'Ali Raza', 'pharmacist', '+92-311-2222222', 'ali@pharmacy.local', '$2y$10$pharmacisthashplaceholder'),
  (3, 'Sara Noor', 'cashier', '+92-311-3333333', 'sara@pharmacy.local', '$2y$10$cashierhashplaceholder')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  phone = VALUES(phone),
  email = VALUES(email),
  password = VALUES(password);

INSERT INTO Medicines (
  medicine_id,
  name,
  category,
  manufacturer,
  unit_price,
  stock_quantity,
  expiry_date,
  reorder_level
)
VALUES
  (1, 'Paracetamol 500mg', 'Analgesic', 'ABC Pharma', 8.50, 300, '2027-10-31', 50),
  (2, 'Amoxicillin 250mg', 'Antibiotic', 'NovaMed', 22.00, 180, '2027-06-30', 40),
  (3, 'Cetirizine 10mg', 'Antihistamine', 'HealWell', 12.75, 220, '2028-01-31', 35),
  (4, 'Omeprazole 20mg', 'Gastro', 'Zenith Labs', 19.25, 160, '2027-12-31', 30),
  (5, 'Vitamin C 500mg', 'Supplement', 'NutraLife', 15.00, 260, '2028-03-31', 45)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  manufacturer = VALUES(manufacturer),
  unit_price = VALUES(unit_price),
  stock_quantity = VALUES(stock_quantity),
  expiry_date = VALUES(expiry_date),
  reorder_level = VALUES(reorder_level);

-- Purchases and items
INSERT INTO Purchases (
  purchase_id,
  supplier_id,
  user_id,
  purchase_date,
  invoice_number,
  total_amount
)
VALUES
  (1, 1, 1, '2026-03-01', 1001, 6140.00),
  (2, 2, 2, '2026-03-05', 1002, 3440.00)
ON DUPLICATE KEY UPDATE
  supplier_id = VALUES(supplier_id),
  user_id = VALUES(user_id),
  purchase_date = VALUES(purchase_date),
  invoice_number = VALUES(invoice_number),
  total_amount = VALUES(total_amount);

INSERT INTO Purchase_Item (
  purchase_item_id,
  purchase_id,
  medicine_id,
  quantity,
  cost_price,
  expiry_date,
  batch_number,
  subtotal
)
VALUES
  (1, 1, 1, 200, 7.20, '2027-10-31', 'BATCH-PAR-001', 1440.00),
  (2, 1, 2, 150, 18.00, '2027-06-30', 'BATCH-AMX-001', 2700.00),
  (3, 1, 3, 160, 10.00, '2028-01-31', 'BATCH-CET-001', 1600.00),
  (4, 2, 4, 120, 15.00, '2027-12-31', 'BATCH-OME-001', 1800.00),
  (5, 2, 5, 200, 8.20, '2028-03-31', 'BATCH-VIT-001', 1640.00)
ON DUPLICATE KEY UPDATE
  purchase_id = VALUES(purchase_id),
  medicine_id = VALUES(medicine_id),
  quantity = VALUES(quantity),
  cost_price = VALUES(cost_price),
  expiry_date = VALUES(expiry_date),
  batch_number = VALUES(batch_number),
  subtotal = VALUES(subtotal);

-- Sales and items
INSERT INTO Sales (
  sale_id,
  user_id,
  sale_date,
  discount,
  total_amount,
  net_amount,
  payment_method
)
VALUES
  (1, 2, '2026-03-10', 30.00, 450.00, 420.00, 'cash'),
  (2, 3, '2026-03-11', 0.00, 298.00, 298.00, 'card')
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  sale_date = VALUES(sale_date),
  discount = VALUES(discount),
  total_amount = VALUES(total_amount),
  net_amount = VALUES(net_amount),
  payment_method = VALUES(payment_method);

INSERT INTO Sales_Item (
  sale_item_id,
  sale_id,
  medicine_id,
  quantity,
  unit_price,
  subtotal
)
VALUES
  (1, 1, 1, 20, 8.50, 170.00),
  (2, 1, 3, 10, 12.75, 127.50),
  (3, 1, 4, 8, 19.25, 154.00),
  (4, 2, 2, 6, 22.00, 132.00),
  (5, 2, 5, 11, 15.00, 166.00)
ON DUPLICATE KEY UPDATE
  sale_id = VALUES(sale_id),
  medicine_id = VALUES(medicine_id),
  quantity = VALUES(quantity),
  unit_price = VALUES(unit_price),
  subtotal = VALUES(subtotal);

-- Optional visibility checks
SELECT 'Suppliers count' AS metric, COUNT(*) AS value FROM Suppliers
UNION ALL
SELECT 'Users count', COUNT(*) FROM Users
UNION ALL
SELECT 'Medicines count', COUNT(*) FROM Medicines
UNION ALL
SELECT 'Purchases count', COUNT(*) FROM Purchases
UNION ALL
SELECT 'Purchase_Item count', COUNT(*) FROM Purchase_Item
UNION ALL
SELECT 'Sales count', COUNT(*) FROM Sales
UNION ALL
SELECT 'Sales_Item count', COUNT(*) FROM Sales_Item;

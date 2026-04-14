CREATE DATABASE IF NOT EXISTS pharmacy_shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pharmacy_shop;

CREATE TABLE IF NOT EXISTS Suppliers (
  supplier_id INT UNSIGNED AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  contact_number VARCHAR(25) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (supplier_id),
  UNIQUE KEY uq_suppliers_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Users (
  user_id INT UNSIGNED AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Medicines (
  medicine_id INT UNSIGNED AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  reorder_level INT NOT NULL DEFAULT 0,
  PRIMARY KEY (medicine_id),
  CONSTRAINT chk_medicines_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT chk_medicines_stock_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT chk_medicines_reorder_non_negative CHECK (reorder_level >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Purchases (
  purchase_id INT UNSIGNED AUTO_INCREMENT,
  supplier_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  purchase_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  invoice_number INT UNSIGNED NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (purchase_id),
  UNIQUE KEY uq_purchases_invoice_number (invoice_number),
  KEY idx_purchases_supplier_id (supplier_id),
  KEY idx_purchases_user_id (user_id),
  CONSTRAINT chk_purchases_total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT fk_purchases_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES Suppliers (supplier_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_user
    FOREIGN KEY (user_id)
    REFERENCES Users (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Purchase_Item (
  purchase_item_id INT UNSIGNED AUTO_INCREMENT,
  purchase_id INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL,
  expiry_date DATE NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (purchase_item_id),
  KEY idx_purchase_item_purchase_id (purchase_id),
  KEY idx_purchase_item_medicine_id (medicine_id),
  UNIQUE KEY uq_purchase_item_line (purchase_id, medicine_id, batch_number),
  CONSTRAINT chk_purchase_item_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_purchase_item_cost_price_non_negative CHECK (cost_price >= 0),
  CONSTRAINT chk_purchase_item_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT fk_purchase_item_purchase
    FOREIGN KEY (purchase_id)
    REFERENCES Purchases (purchase_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_purchase_item_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES Medicines (medicine_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Sales (
  sale_id INT UNSIGNED AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  sale_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  PRIMARY KEY (sale_id),
  KEY idx_sales_user_id (user_id),
  CONSTRAINT chk_sales_discount_non_negative CHECK (discount >= 0),
  CONSTRAINT chk_sales_total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT chk_sales_net_amount_non_negative CHECK (net_amount >= 0),
  CONSTRAINT chk_sales_net_not_exceed_total CHECK (net_amount <= total_amount),
  CONSTRAINT fk_sales_user
    FOREIGN KEY (user_id)
    REFERENCES Users (user_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Sales_Item (
  sale_item_id INT UNSIGNED AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (sale_item_id),
  KEY idx_sales_item_sale_id (sale_id),
  KEY idx_sales_item_medicine_id (medicine_id),
  UNIQUE KEY uq_sales_item_line (sale_id, medicine_id),
  CONSTRAINT chk_sales_item_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_sales_item_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT chk_sales_item_subtotal_non_negative CHECK (subtotal >= 0),
  CONSTRAINT fk_sales_item_sale
    FOREIGN KEY (sale_id)
    REFERENCES Sales (sale_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_sales_item_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES Medicines (medicine_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

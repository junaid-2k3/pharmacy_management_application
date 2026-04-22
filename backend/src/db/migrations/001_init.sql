CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  purchase_price REAL NOT NULL CHECK (purchase_price >= 0),
  sale_price REAL NOT NULL CHECK (sale_price >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id INTEGER PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  invoice_reference TEXT,
  remarks TEXT,
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_item_id INTEGER PRIMARY KEY,
  purchase_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  UNIQUE (purchase_id, medicine_id, batch_number)
);

CREATE TABLE IF NOT EXISTS sales (
  sale_id INTEGER PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  sale_date TEXT NOT NULL,
  customer_name TEXT,
  reference TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method = 'cash'),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  sale_item_id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  purchase_item_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE RESTRICT,
  FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(purchase_item_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_low_stock ON medicines(is_archived, reorder_level);
CREATE INDEX IF NOT EXISTS idx_purchase_items_expiry ON purchase_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_medicine ON purchase_items(medicine_id, expiry_date, remaining_quantity);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);

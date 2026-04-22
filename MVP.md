# WASEELA — MVP Specification
### Electron + SQLite | v1.0

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | HTML + CSS + JavaScript |
| Logic | Node.js (main process) |
| Database | SQLite (via `better-sqlite3`) |
| Communication | Electron IPC (`ipcMain` / `ipcRenderer`) |
| Print | Electron `BrowserWindow.webContents.print()` |

---

## What Is and Is Not in MVP

| Module | Status | Reason |
|---|---|---|
| Medicine Management | ✅ Included (trimmed) | Core catalogue — nothing works without it |
| Supplier Management | ❌ Excluded | Deferred by owner decision |
| Inventory & Purchase | ✅ Included (trimmed) | Stock must come in somehow |
| Sales & Billing | ✅ Included (full) | Primary daily-use feature, highest value |
| Reporting & Alerts | ✅ Included (trimmed) | Low-stock + expiry alerts are operationally critical |

---

## Module 1 — Medicine Management

**Keep in MVP:**

- Add a new medicine with: name, generic name, category, unit, manufacturer, reorder level, purchase price, sale price.
- Edit medicine details including price changes.
- View medicine list with current stock level (aggregated across batches).
- Flag / highlight medicines below their reorder level.
- Archive (soft-delete) a discontinued medicine — preserve all historical sale and purchase records.
- Basic search by name or generic name.

**Cut from MVP:**

| Feature | Why Cut |
|---|---|
| Category management UI (add/edit categories) | Hardcode 5–6 categories in a seed file; manage via DB directly for now |
| Manufacturer management UI | Same — seed a list, add more later |
| Barcode / scan support | Significant extra scope; add in v1.1 |
| Medicine photo upload | Not operationally critical |
| Bulk import via CSV | Useful but not day-one essential |

---

## Module 2 — Inventory & Purchase

> Supplier module is excluded. Purchase entries will be recorded without a linked supplier — a plain text field `supplier_name` is sufficient for MVP traceability.

**Keep in MVP:**

- Create a purchase entry with: date, supplier name (free text), optional invoice/reference number, and remarks.
- Add multiple line items per entry: medicine, batch number, expiry date, quantity, unit cost.
- On confirmation, increment stock levels atomically — the entire purchase rolls back if any line fails.
- View purchase history (list of all purchases with their line items).
- Prevent adding a line item for an archived medicine.

**Cut from MVP:**

| Feature | Why Cut |
|---|---|
| Supplier linked FK / supplier history | Supplier module is deferred |
| Edit a posted purchase entry | Complex — requires stock reversal logic. Mark as v1.1 |
| Return / credit note against a purchase | Out of MVP scope |
| Payment tracking (paid / unpaid) | Supplier module dependency |

---

## Module 3 — Sales & Billing

> This is the highest-priority module. Deliver it complete.

**Keep in MVP (full feature set):**

- Create a new sale with: date (auto-filled, editable), optional customer name, optional reference.
- Search medicines by name or generic name and add to the bill.
- Per line item: medicine name, batch (auto-selected, FEFO — first expiry first out), quantity, unit price, subtotal.
- Auto-calculate grand total.
- On confirmation, deduct quantities from stock atomically — entire sale rolls back if any item fails.
- Hard block: prevent sale if stock is zero or the selected batch is expired.
- On completion, render a printable bill (Electron print dialog).
- View sales history — list of all bills with expandable line items.

**Cut from MVP:**

| Feature | Why Cut |
|---|---|
| Customer account / credit management | Requires a customer module not yet designed |
| Discount per item or bill-level discount | Add in v1.1 once pricing logic is stable |
| Multiple payment methods (cash + card split) | Track cash only in MVP |
| Return / refund flow | Complex stock re-entry logic; defer to v1.1 |
| SMS or email receipt | External service dependency |

---

## Module 4 — Reporting & Alerts

**Keep in MVP:**

- **Low-Stock Alert:** On app launch and on the dashboard, show a list of medicines at or below their reorder level. Badge count in the sidebar.
- **Expiry Alert:** On app launch and on the dashboard, show medicines expiring within 30 days or already expired. Separate expired vs. expiring-soon rows.
- **Daily Sales Summary:** For any selected date range — total revenue, number of bills, and a breakdown by medicine (quantity sold, total value).
- **Purchase History Report:** Filter by date range. Shows purchase entries with line items.

**Cut from MVP:**

| Feature | Why Cut |
|---|---|
| Supplier-wise purchase report | Supplier module is deferred |
| Profit margin report | Requires consistent cost-price history tracking; add in v1.1 |
| Export to PDF or Excel | Add in v1.1 |
| Charts / graphs | Not operationally blocking |
| Scheduled alert notifications | OS-level notifications add scope; badge + dashboard is enough |

---

## IPC Channel Map

Each renderer action maps to a named IPC channel. All DB access happens in the main process only.

```
medicine:get-all
medicine:search
medicine:add
medicine:update
medicine:archive

purchase:get-all
purchase:add          ← uses DB transaction internally

sale:get-all
sale:create           ← uses DB transaction internally

report:low-stock
report:expiry-alerts
report:sales-summary
report:purchase-history
```

---

## SQLite Migration from MySQL

Since the original schema was designed in MySQL, note the following conversion points:

| MySQL | SQLite equivalent |
|---|---|
| `AUTO_INCREMENT` | `INTEGER PRIMARY KEY` (auto-increments) |
| `TINYINT(1)` for booleans | `INTEGER` (0 / 1) |
| `DATETIME` / `TIMESTAMP` | `TEXT` stored as ISO-8601 (`YYYY-MM-DD HH:MM:SS`) |
| `ENUM(...)` | `TEXT` with a `CHECK` constraint |
| Foreign key enforcement | Must run `PRAGMA foreign_keys = ON;` on every connection |
| Stored procedures | Replace with Node.js logic in the main process |
| `NOW()` | `datetime('now')` |

Run all schema creation and seeding inside an `onReady` block in `main.js` using `better-sqlite3`'s synchronous API. Use `.transaction()` for all multi-step writes (purchases, sales).

---

## Suggested Build Order

Build in this order so each step produces something testable end-to-end:

```
1. Project scaffold        Electron shell, IPC skeleton, SQLite connection
2. Medicine Management     Add, list, search, archive
3. Purchase Entry          Add purchase, stock increments, history view
4. Sales & Billing         Create bill, stock deducts, print receipt
5. Dashboard + Alerts      Low-stock badge, expiry list, sales summary
```

---

## Out of Scope for v1.0 (Full List)

- Supplier module (contacts, credit limits, payment tracking)
- Customer accounts and credit management
- Barcode scanning
- Discounts and promotional pricing
- Returns and refunds (sales or purchase)
- Multi-branch / multi-godown support
- User roles and permissions
- Audit log / activity trail
- CSV/Excel import and export
- Charts and graphical reports
- Cloud sync or backup
- External notifications (SMS, email)

---

*WASEELA MVP — Waseela Pharmacy, Rawalpindi*
*Schema: SQLite via `better-sqlite3` | Runtime: Electron*

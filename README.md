# Pharmacy Management System - Database Project

This repository contains the database design, SQL schema, sample data, and SQL test scripts for a **Pharmacy Management System (PMS)**.

The project digitizes core pharmacy operations such as inventory tracking, supplier management, purchase entry, sales billing, and reporting support.

## Project Summary

Based on the project overview document, the system is designed to:

- Reduce manual inventory errors with database-driven stock management.
- Prevent losses from expired/near-expiry medicines.
- Support faster multi-item billing workflows.
- Maintain supplier and purchase traceability.
- Enable operational insights through stock and sales-focused reporting.

## Scope

### In scope

- Medicine master data management
- Supplier management
- Purchase recording with batch and expiry tracking
- Sales billing with stock deduction
- Low-stock and expiry checks
- Daily sales-oriented reporting queries
- Transaction-safe operations

### Out of scope (for v1.0 database project)

- Loyalty program
- E-commerce storefront
- Prescription/doctor linkage
- Multi-branch inventory
- Mobile app

## Repository Structure

- `ERD/`
  - `ERD-project.drawio`
  - `4_ERD_Relational_Design.docx`
- `project_documents/`
  - `1_Project_Overview.docx`
  - `2_PRD.docx`
  - `3_Database_Design.docx`
- `schema/`
  - `pharmacy_schema.sql` - Creates database and all core tables/constraints
  - `sample_insert_data.sql` - Inserts idempotent sample data
  - `validation_and_fk_constraint_tests.sql` - Constraint, FK, cascade, and validation tests
  - `business_workflow_tests.sql` - Purchase/sales workflow behavior tests
  - `test.sql` - Quick table inspection queries

## Database Design Highlights

The schema is built for MySQL/InnoDB and includes:

- Core entities: `Suppliers`, `Users`, `Medicines`, `Purchases`, `Purchase_Item`, `Sales`, `Sales_Item`
- Referential integrity via foreign keys
- Business validation using `CHECK` constraints (price, quantity, totals, etc.)
- Transaction-friendly structure for purchase and sale flows
- Cascade behavior where appropriate (line-item cleanup)
- Restrictive deletes on critical master data to protect history

## Prerequisites

- MySQL 8.0+
- A user account with privileges to create databases, tables, procedures, and run DML/DDL

## How to Run

From the repository root, execute scripts in this order:

```bash
mysql -u <username> -p < schema/pharmacy_schema.sql
mysql -u <username> -p < schema/sample_insert_data.sql
mysql -u <username> -p < schema/validation_and_fk_constraint_tests.sql
mysql -u <username> -p < schema/business_workflow_tests.sql
mysql -u <username> -p < schema/test.sql
```

## Test Scripts

### `schema/validation_and_fk_constraint_tests.sql`

Validates:

- successful inserts for valid records
- failures for duplicate keys and invalid FK references
- `CHECK` constraint enforcement
- cascade and restrict behavior
- basic functional join checks

Outputs a result table with `PASS/FAIL` status summary.

### `schema/business_workflow_tests.sql`

Validates:

- stock increase after purchase receiving
- stock decrease after sale fulfillment
- oversell prevention logic
- low-stock and expiry query sanity checks
- revenue and top-selling aggregation checks

Outputs workflow test results and summary counts.

## Notes

- Test scripts use transactions (`START TRANSACTION` + `ROLLBACK`) for safe repeatability.
- Sample data inserts are idempotent (`ON DUPLICATE KEY UPDATE`) to support re-runs.
- This repository currently focuses on the **data layer**. Frontend/backend implementation can be built on top of this schema.

## Web App Implementation (April 2026)

The repository now includes a working **Node.js + Express + SQLite + Vanilla JS** MVP implementation.

### Added Structure

- `backend/src/`
  - `server.js` - Express app bootstrap + static frontend hosting
  - `db/` - SQLite connection, migration runner, and SQL migrations
  - `routes/` - API modules for medicines, purchases, sales, and reports
  - `middleware/` - async/error handlers
- `frontend/`
  - `index.html` - app shell and navigation
  - `assets/css/styles.css` - design token based styling
  - `assets/js/app.js` - page logic and API integration
- `data/`
  - `pharmacy.db` (generated at runtime)

### API Coverage

- Medicine management: add/list/search/update/archive
- Purchase entry: transactional create with line items and stock intake
- Sales: transactional create with FEFO batch consumption and cash-only enforcement
- Reporting: low-stock, expiry alerts, sales summary, purchase history
- Receipt payload endpoint for print flow

### Run the Full App

```bash
npm install
npm run init-db
npm start
```

Then open:

```text
http://localhost:3000
```

### Environment

Copy `.env.example` to `.env` and adjust as needed:

```bash
PORT=3000
DB_PATH=./data/pharmacy.db
```

### Notes About Scope Alignment

- MVP rules from `MVP.md` are enforced where they conflict with `design.md`.
- Implemented as a web architecture (`Express REST + SQLite`) per confirmed decision.
- Supplier module, discounts, multi-payment, stock adjustment, and auth/roles remain out of scope for v1.

## Version

- Document baseline: March 2026
- Repository scope: Database layer for PMS v1.0

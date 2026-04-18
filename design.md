# WASEELA — Pharmacy Management System
## Design Document v1.0

---

## 1. Overview

WASEELA is a pharmacy POS and inventory management system. This document defines the redesign direction — moving from the current legacy desktop UI to a modern, clean web-based interface while preserving all existing workflows.

---

## 2. Design Philosophy

**Theme:** Clinical Clarity  
**Tone:** Professional, clean, high-density but breathable  
**Audience:** Pharmacy staff, cashiers, store managers  
**Core Principle:** Every action should take fewer clicks than before. Data should be readable at a glance.

---

## 3. Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#0A6E6E` | Main accent, buttons, active nav |
| `--primary-light` | `#E0F4F4` | Hover states, subtle highlights |
| `--surface` | `#F8FAFB` | Page background |
| `--card` | `#FFFFFF` | Cards, panels, forms |
| `--border` | `#E2E8F0` | Dividers, input borders |
| `--text-primary` | `#1A202C` | Headlines, labels |
| `--text-secondary` | `#64748B` | Subtitles, placeholders |
| `--danger` | `#E53E3E` | Errors, low stock alerts |
| `--warning` | `#D97706` | Expiry warnings |
| `--success` | `#2F855A` | Confirmations, receipts posted |

---

## 4. Typography

- **Display / Headings:** `DM Sans` — geometric, readable at all sizes  
- **Body / Tables:** `IBM Plex Sans` — monospace-adjacent, great for numbers  
- **Numbers / Prices:** `JetBrains Mono` — aligned, scannable financial figures

---

## 5. Module Map

### 5.1 Dashboard
- KPI cards: Today's Sales, Purchase Amount, Low Stock Items, Expiring Soon
- Quick-action bar: New Sale, New Purchase, Stock Adjustment
- Recent transactions table

### 5.2 Cash Sale (POS)
- **Header:** Invoice No (auto), Date, Customer, Godown, SalePrice type
- **Line Items Table:**
  - Alias/Item search with autocomplete
  - Pack Qty, Qty, Pack Price, Unit Price
  - Disc%, Disc Value, Total, VAT Inc Tax
- **Footer:** Subtotal, Discount, GST, Grand Total
- Quick-Pay buttons: Cash / Credit

### 5.3 Pack Purchase
- **Header:** Invoice No, Supplier (autocomplete), Date, Godown, Tax Category, NTN
- **Line Items Table:**
  - Item search, Batch, Expiry, Qty, Bonus
  - P.Price, Disc%, Total (Excl Tax), GST%, GST Value, Total Inc Tax
  - SalePrice, Margin%, Net Rate, Manufacturer
- Footer: Totals, Adv Income Tax, Grand Total

### 5.4 Item Management (Item Form)
- **Identity:** Code, Alias, Name
- **Pricing:** Purchase Price, Retail Price, Sales Price, Avg Price
  - Live margin/markup display
- **Attributes:** Packing size, Category, Class, Manufacturer
- **Flags:** Narcotics, Lock Price, Allow Decimal Qty, Active
- **Suppliers tab:** Priority, Rate, Disc%, Qty, Bonus, Days

### 5.5 Stock Adjustment
- Godown selector, Date, Remarks
- Line items: Item Alias, Item Name, Stock In Hand, Stock On Shelf, Adjustment delta

### 5.6 Item List
- Searchable, sortable data grid
- Columns: Name, Stock, Purchase Price, Sale Price, Manufacturer, Packs, Location
- Highlight rows: low stock (red), expiring soon (amber)
- Inline quick-edit for price

---

## 6. Layout Structure

```
┌─────────────────────────────────────────────────┐
│  SIDEBAR NAV (collapsed/expanded)               │
│  ┌───────┐  ┌─────────────────────────────────┐ │
│  │ Logo  │  │  Page Header + Action Buttons   │ │
│  │ Nav   │  ├─────────────────────────────────┤ │
│  │ Items │  │  Main Content Area              │ │
│  │       │  │  (Forms / Tables / Dashboard)   │ │
│  │       │  │                                 │ │
│  │       │  ├─────────────────────────────────┤ │
│  │       │  │  Footer Totals / Status Bar     │ │
│  └───────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 7. Key UX Improvements Over Current System

| Current Issue | Proposed Solution |
|---------------|-------------------|
| No visual hierarchy in item list | Color-coded rows for stock status & expiry |
| Form fields with no validation feedback | Inline error states with helpful messages |
| "PLEASE SELECT" manufacturer default | Manufacturer search with autocomplete |
| Small, hard-to-read prices | Monospace numeric font, right-aligned columns |
| No dashboard overview | KPI card dashboard on login |
| Item search requires exact match | Fuzzy search across name, alias, manufacturer |
| No keyboard shortcut indicators | F-key labels on action buttons (e.g., F2 = Save) |

---

## 8. Component Library

- **DataGrid:** Sortable, filterable, sticky header, highlight-on-hover
- **AutocompleteInput:** Debounced search, keyboard navigation
- **PriceField:** Right-aligned, JetBrains Mono, formats on blur
- **StatusBadge:** `In Stock`, `Low Stock`, `Out of Stock`, `Expiring Soon`
- **ActionBar:** Save (F10), Delete, Print, New — consistent across all forms
- **TabPanel:** Used in Item Form for Details / Suppliers / History

---

## 9. Responsive Targets

| Breakpoint | Target Device |
|------------|---------------|
| 1280px+ | Primary desktop use (POS counter) |
| 1024px | Secondary workstation |
| 768px | Tablet (stock management on floor) |

---

## 10. Accessibility

- WCAG 2.1 AA contrast ratios minimum
- All inputs have visible labels (no placeholder-only labels)
- Focus ring visible at all times
- Keyboard-navigable forms with logical tab order
- Error messages linked to inputs via `aria-describedby`

---

*Version 1.0 — Waseela Pharmacy, Rawalpindi*

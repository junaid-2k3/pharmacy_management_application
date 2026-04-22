const API_BASE = "/api";

const navItems = [
  { key: "dashboard", label: "Dashboard" },
  { key: "medicines", label: "Medicines" },
  { key: "purchases", label: "Purchases" },
  { key: "sales", label: "Sales" },
  { key: "reports", label: "Reports" },
  { key: "history", label: "History" },
];

const state = {
  page: "dashboard",
  medicines: [],
  purchaseDraftLines: [],
  saleDraftLines: [],
};

const navEl = document.getElementById("nav");
const pageTitleEl = document.getElementById("pageTitle");
const appContentEl = document.getElementById("appContent");
const alertsBarEl = document.getElementById("alertsBar");
const refreshBtn = document.getElementById("refreshBtn");

function money(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

function toast(message) {
  const template = document.getElementById("toastTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2200);
}

function renderNav() {
  navEl.innerHTML = navItems
    .map(
      (item) =>
        `<button data-page="${item.key}" class="${state.page === item.key ? "active" : ""}">${item.label}</button>`
    )
    .join("");

  navEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.page = btn.dataset.page;
      render();
    });
  });
}

async function loadMedicines() {
  state.medicines = await api("/medicines");
}

async function renderAlertsBar() {
  const [lowStock, expiry] = await Promise.all([
    api("/reports/low-stock"),
    api("/reports/expiry-alerts"),
  ]);

  alertsBarEl.innerHTML = `
    <div class="alert-chip danger">Low Stock: <strong>${lowStock.count}</strong></div>
    <div class="alert-chip">Expiry Alerts: <strong>${expiry.expired_count + expiry.expiring_soon_count}</strong></div>
  `;
}

function medicineOptions() {
  return state.medicines
    .filter((m) => m.is_archived === 0)
    .map((m) => `<option value="${m.medicine_id}">${escapeHtml(m.name)} (${escapeHtml(m.generic_name)})</option>`)
    .join("");
}

async function renderDashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [summary, lowStock, expiry, medicines] = await Promise.all([
    api(`/reports/sales-summary?start_date=${today}&end_date=${today}`),
    api("/reports/low-stock"),
    api("/reports/expiry-alerts"),
    api("/medicines"),
  ]);

  appContentEl.innerHTML = `
    <div class="grid-4">
      <div class="kpi"><div class="label">Today's Sales</div><div class="value">${money(summary.total_revenue)}</div></div>
      <div class="kpi"><div class="label">Bills Today</div><div class="value">${summary.number_of_bills}</div></div>
      <div class="kpi"><div class="label">Low Stock Items</div><div class="value">${lowStock.count}</div></div>
      <div class="kpi"><div class="label">Expiring Soon + Expired</div><div class="value">${expiry.expired_count + expiry.expiring_soon_count}</div></div>
    </div>

    <div class="card">
      <h3 class="section-title">Medicine Snapshot</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic</th>
              <th>Category</th>
              <th class="num">Stock</th>
              <th class="num">Reorder</th>
            </tr>
          </thead>
          <tbody>
            ${medicines
              .slice(0, 12)
              .map(
                (m) => `
                  <tr class="${m.stock_quantity <= m.reorder_level ? "low-stock" : ""}">
                    <td>${escapeHtml(m.name)}</td>
                    <td>${escapeHtml(m.generic_name)}</td>
                    <td>${escapeHtml(m.category)}</td>
                    <td class="num">${m.stock_quantity}</td>
                    <td class="num">${m.reorder_level}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function attachMedicineFormHandlers() {
  const form = document.getElementById("medicineForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    payload.purchase_price = Number(payload.purchase_price);
    payload.sale_price = Number(payload.sale_price);
    payload.reorder_level = Number(payload.reorder_level);

    try {
      await api("/medicines", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      toast("Medicine added");
      await loadMedicines();
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  document.querySelectorAll("[data-archive-medicine]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/medicines/${btn.dataset.archiveMedicine}/archive`, { method: "PATCH" });
        toast("Medicine archived");
        await loadMedicines();
        render();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

async function renderMedicinesPage() {
  await loadMedicines();
  appContentEl.innerHTML = `
    <div class="card">
      <h3 class="section-title">Add Medicine</h3>
      <form id="medicineForm" class="form-grid" aria-describedby="medicineFormDesc">
        <label>Name<input name="name" required /></label>
        <label>Generic Name<input name="generic_name" required /></label>
        <label>Category<input name="category" required /></label>
        <label>Unit<input name="unit" required placeholder="tablet/ml" /></label>
        <label>Manufacturer<input name="manufacturer" required /></label>
        <label>Purchase Price<input name="purchase_price" type="number" min="0" step="0.01" required /></label>
        <label>Sale Price<input name="sale_price" type="number" min="0" step="0.01" required /></label>
        <label>Reorder Level<input name="reorder_level" type="number" min="0" required /></label>
        <div class="inline-actions"><button class="btn btn-primary" type="submit">Save Medicine</button></div>
      </form>
      <p id="medicineFormDesc" class="hidden">All medicine fields are mandatory.</p>
    </div>

    <div class="card">
      <h3 class="section-title">Medicine List</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Generic</th>
              <th>Unit</th>
              <th class="num">Stock</th>
              <th class="num">Sale Price</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${state.medicines
              .map(
                (m) => `
                  <tr class="${m.stock_quantity <= m.reorder_level && m.is_archived === 0 ? "low-stock" : ""}">
                    <td>${escapeHtml(m.name)}</td>
                    <td>${escapeHtml(m.generic_name)}</td>
                    <td>${escapeHtml(m.unit)}</td>
                    <td class="num">${m.stock_quantity}</td>
                    <td class="num">${money(m.sale_price)}</td>
                    <td>${m.is_archived ? "Archived" : "Active"}</td>
                    <td>
                      ${m.is_archived ? "-" : `<button class="btn btn-danger" data-archive-medicine="${m.medicine_id}">Archive</button>`}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  attachMedicineFormHandlers();
}

function renderPurchaseDraftLines() {
  return state.purchaseDraftLines
    .map(
      (line, index) => `
        <tr>
          <td>${escapeHtml(line.medicine_name)}</td>
          <td>${escapeHtml(line.batch_number)}</td>
          <td>${escapeHtml(line.expiry_date)}</td>
          <td class="num">${line.quantity}</td>
          <td class="num">${money(line.unit_cost)}</td>
          <td class="num">${money(line.subtotal)}</td>
          <td><button class="btn btn-danger" data-remove-purchase-line="${index}">Remove</button></td>
        </tr>
      `
    )
    .join("");
}

function attachPurchaseHandlers() {
  const lineForm = document.getElementById("purchaseLineForm");
  const purchaseForm = document.getElementById("purchaseForm");

  lineForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(lineForm);
    const medicineId = Number(fd.get("medicine_id"));
    const medicine = state.medicines.find((m) => m.medicine_id === medicineId);

    const line = {
      medicine_id: medicineId,
      medicine_name: medicine ? medicine.name : "Unknown",
      batch_number: String(fd.get("batch_number") || "").trim(),
      expiry_date: fd.get("expiry_date"),
      quantity: Number(fd.get("quantity")),
      unit_cost: Number(fd.get("unit_cost")),
    };

    line.subtotal = Number((line.quantity * line.unit_cost).toFixed(2));

    if (!line.medicine_id || !line.batch_number || !line.expiry_date || line.quantity <= 0 || line.unit_cost < 0) {
      toast("Complete valid line item fields.");
      return;
    }

    state.purchaseDraftLines.push(line);
    lineForm.reset();
    render();
  });

  purchaseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.purchaseDraftLines.length === 0) {
      toast("Add at least one purchase line.");
      return;
    }

    const fd = new FormData(purchaseForm);
    const payload = {
      purchase_date: fd.get("purchase_date"),
      supplier_name: fd.get("supplier_name"),
      invoice_reference: fd.get("invoice_reference"),
      remarks: fd.get("remarks"),
      line_items: state.purchaseDraftLines.map((line) => ({
        medicine_id: line.medicine_id,
        batch_number: line.batch_number,
        expiry_date: line.expiry_date,
        quantity: line.quantity,
        unit_cost: line.unit_cost,
      })),
    };

    try {
      await api("/purchases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.purchaseDraftLines = [];
      purchaseForm.reset();
      toast("Purchase created");
      await loadMedicines();
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  document.querySelectorAll("[data-remove-purchase-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.removePurchaseLine);
      state.purchaseDraftLines.splice(index, 1);
      render();
    });
  });
}

async function renderPurchasesPage() {
  await loadMedicines();
  const total = state.purchaseDraftLines.reduce((sum, line) => sum + line.subtotal, 0);

  appContentEl.innerHTML = `
    <div class="card">
      <h3 class="section-title">New Purchase Entry</h3>
      <form id="purchaseForm" class="form-grid-3">
        <label>Date<input name="purchase_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></label>
        <label>Supplier Name<input name="supplier_name" required /></label>
        <label>Invoice/Reference<input name="invoice_reference" /></label>
        <label style="grid-column: 1 / -1">Remarks<textarea name="remarks"></textarea></label>
        <div class="inline-actions"><button class="btn btn-primary" type="submit">Post Purchase</button></div>
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">Add Purchase Line</h3>
      <form id="purchaseLineForm" class="form-grid">
        <label>Medicine
          <select name="medicine_id" required>
            <option value="">Select medicine</option>
            ${medicineOptions()}
          </select>
        </label>
        <label>Batch Number<input name="batch_number" required /></label>
        <label>Expiry Date<input type="date" name="expiry_date" required /></label>
        <label>Quantity<input name="quantity" type="number" min="1" required /></label>
        <label>Unit Cost<input name="unit_cost" type="number" step="0.01" min="0" required /></label>
        <div class="inline-actions"><button class="btn btn-light" type="submit">Add Line</button></div>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Subtotal</th><th>Action</th></tr>
          </thead>
          <tbody>${renderPurchaseDraftLines()}</tbody>
        </table>
      </div>
      <div class="inline-actions"><strong>Total: ${money(total)}</strong></div>
    </div>
  `;

  attachPurchaseHandlers();
}

function renderSaleDraftLines() {
  return state.saleDraftLines
    .map(
      (line, index) => `
      <tr>
        <td>${escapeHtml(line.medicine_name)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${money(line.unit_price)}</td>
        <td class="num">${money(line.subtotal)}</td>
        <td><button class="btn btn-danger" data-remove-sale-line="${index}">Remove</button></td>
      </tr>
    `
    )
    .join("");
}

function attachSalesHandlers() {
  const lineForm = document.getElementById("saleLineForm");
  const saleForm = document.getElementById("saleForm");

  lineForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(lineForm);
    const medicineId = Number(fd.get("medicine_id"));
    const quantity = Number(fd.get("quantity"));
    const medicine = state.medicines.find((m) => m.medicine_id === medicineId);

    if (!medicine || quantity <= 0) {
      toast("Select valid medicine and quantity.");
      return;
    }

    state.saleDraftLines.push({
      medicine_id: medicineId,
      medicine_name: medicine.name,
      quantity,
      unit_price: Number(medicine.sale_price),
      subtotal: Number((quantity * Number(medicine.sale_price)).toFixed(2)),
    });

    lineForm.reset();
    render();
  });

  saleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.saleDraftLines.length === 0) {
      toast("Add at least one sale line.");
      return;
    }

    const fd = new FormData(saleForm);
    const payload = {
      sale_date: fd.get("sale_date"),
      customer_name: fd.get("customer_name"),
      reference: fd.get("reference"),
      line_items: state.saleDraftLines.map((line) => ({
        medicine_id: line.medicine_id,
        quantity: line.quantity,
      })),
    };

    try {
      const createdSale = await api("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.saleDraftLines = [];
      saleForm.reset();
      toast(`Sale created: ${createdSale.invoice_no}`);
      await loadMedicines();
      render();
    } catch (error) {
      toast(error.message);
    }
  });

  document.querySelectorAll("[data-remove-sale-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.removeSaleLine);
      state.saleDraftLines.splice(index, 1);
      render();
    });
  });
}

async function renderSalesPage() {
  await loadMedicines();
  const total = state.saleDraftLines.reduce((sum, line) => sum + line.subtotal, 0);

  appContentEl.innerHTML = `
    <div class="card">
      <h3 class="section-title">New Sale</h3>
      <form id="saleForm" class="form-grid-3">
        <label>Date<input name="sale_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></label>
        <label>Customer Name (optional)<input name="customer_name" /></label>
        <label>Reference (optional)<input name="reference" /></label>
        <div class="inline-actions"><button class="btn btn-primary" type="submit">Confirm Sale</button></div>
      </form>
    </div>

    <div class="card">
      <h3 class="section-title">Add Sale Line</h3>
      <form id="saleLineForm" class="form-grid">
        <label>Medicine
          <select name="medicine_id" required>
            <option value="">Select medicine</option>
            ${medicineOptions()}
          </select>
        </label>
        <label>Quantity<input name="quantity" type="number" min="1" required /></label>
        <div class="inline-actions"><button class="btn btn-light" type="submit">Add Line</button></div>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Medicine</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Subtotal</th><th>Action</th></tr>
          </thead>
          <tbody>${renderSaleDraftLines()}</tbody>
        </table>
      </div>
      <div class="inline-actions"><strong>Grand Total: ${money(total)}</strong></div>
    </div>
  `;

  attachSalesHandlers();
}

async function renderReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  appContentEl.innerHTML = `
    <div class="card">
      <h3 class="section-title">Reports</h3>
      <form id="reportFilterForm" class="form-grid-3">
        <label>Start Date<input type="date" name="start_date" value="${today}" required /></label>
        <label>End Date<input type="date" name="end_date" value="${today}" required /></label>
        <div class="inline-actions"><button type="submit" class="btn btn-primary">Run Reports</button></div>
      </form>
      <div id="reportOutput"></div>
    </div>
  `;

  document.getElementById("reportFilterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const startDate = fd.get("start_date");
    const endDate = fd.get("end_date");

    try {
      const [salesSummary, purchaseHistory] = await Promise.all([
        api(`/reports/sales-summary?start_date=${startDate}&end_date=${endDate}`),
        api(`/reports/purchase-history?start_date=${startDate}&end_date=${endDate}`),
      ]);

      const output = document.getElementById("reportOutput");
      output.innerHTML = `
        <div class="card" style="margin-top: 12px;">
          <h4 class="section-title">Sales Summary</h4>
          <p>Total Revenue: <strong>${money(salesSummary.total_revenue)}</strong></p>
          <p>Number of Bills: <strong>${salesSummary.number_of_bills}</strong></p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Medicine</th><th class="num">Qty Sold</th><th class="num">Total Value</th></tr></thead>
              <tbody>
                ${salesSummary.by_medicine
                  .map(
                    (row) => `<tr><td>${escapeHtml(row.medicine_name)}</td><td class="num">${row.total_quantity_sold}</td><td class="num">${money(row.total_value)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="margin-top: 12px;">
          <h4 class="section-title">Purchase History (${purchaseHistory.length})</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Supplier</th><th>Date</th><th class="num">Total</th></tr></thead>
              <tbody>
                ${purchaseHistory
                  .map(
                    (p) => `<tr><td>${p.purchase_id}</td><td>${escapeHtml(p.supplier_name)}</td><td>${p.purchase_date}</td><td class="num">${money(p.total_amount)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      toast(error.message);
    }
  });
}

async function renderHistoryPage() {
  const [sales, purchases] = await Promise.all([api("/sales"), api("/purchases")]);

  appContentEl.innerHTML = `
    <div class="card">
      <h3 class="section-title">Sales History</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="num">Total</th><th>Receipt</th></tr></thead>
          <tbody>
            ${sales
              .map(
                (s) => `
                  <tr>
                    <td>${escapeHtml(s.invoice_no)}</td>
                    <td>${s.sale_date}</td>
                    <td>${escapeHtml(s.customer_name || "-")}</td>
                    <td class="num">${money(s.total_amount)}</td>
                    <td><button class="btn btn-light" data-print-sale="${s.sale_id}">Print</button></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Purchase History</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Date</th><th>Supplier</th><th class="num">Total</th><th>Lines</th></tr></thead>
          <tbody>
            ${purchases
              .map(
                (p) => `
                  <tr>
                    <td>${p.purchase_id}</td>
                    <td>${p.purchase_date}</td>
                    <td>${escapeHtml(p.supplier_name)}</td>
                    <td class="num">${money(p.total_amount)}</td>
                    <td>${p.line_items.length}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-print-sale]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const receipt = await api(`/sales/${btn.dataset.printSale}/receipt`);
        const lines = receipt.line_items
          .map(
            (line) =>
              `<tr><td>${escapeHtml(line.medicine_name)}</td><td>${line.quantity}</td><td>${money(line.unit_price)}</td><td>${money(line.subtotal)}</td></tr>`
          )
          .join("");

        const html = `
          <html>
            <head><title>${receipt.invoice_no}</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>${escapeHtml(receipt.pharmacy_name)}</h2>
              <p>Invoice: ${escapeHtml(receipt.invoice_no)}</p>
              <p>Date: ${receipt.sale_date}</p>
              <table border="1" cellpadding="6" cellspacing="0" width="100%">
                <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>${lines}</tbody>
              </table>
              <h3 style="text-align:right;">Grand Total: ${money(receipt.total_amount)}</h3>
            </body>
          </html>
        `;

        const printWindow = window.open("", "_blank", "width=800,height=600");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

async function renderPage() {
  if (state.page === "dashboard") {
    await renderDashboardPage();
    return;
  }
  if (state.page === "medicines") {
    await renderMedicinesPage();
    return;
  }
  if (state.page === "purchases") {
    await renderPurchasesPage();
    return;
  }
  if (state.page === "sales") {
    await renderSalesPage();
    return;
  }
  if (state.page === "reports") {
    await renderReportsPage();
    return;
  }
  await renderHistoryPage();
}

async function render() {
  const item = navItems.find((n) => n.key === state.page);
  pageTitleEl.textContent = item ? item.label : "WASEELA";
  renderNav();

  try {
    await renderAlertsBar();
    await renderPage();
  } catch (error) {
    appContentEl.innerHTML = `<div class="card"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
  }
}

refreshBtn.addEventListener("click", () => render());

render();

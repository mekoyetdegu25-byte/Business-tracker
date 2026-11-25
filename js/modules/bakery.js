// js/modules/bakery.js
// ═══════════════════════════════════════════════════════════
// 🍞 HaniTech — Bakery Module
// ═══════════════════════════════════════════════════════════
import { db, auth } from '../firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast, state } from '../core.js';

// ─── ውስጣዊ ሁኔታ ───
const B = {
  items: [], sales: [], purchases: [], expenses: [],
  categories: [], branches: [],
  cart: [], paymentType: 'cash',
  reportPeriod: 'daily', reportBranch: 'all',
  expenseFilter: 'recent',
  itemsPage: 1, itemsPerPage: 10, editingItemId: null,
  loaded: { items: false, sales: false, purchases: false, expenses: false },
};

const DEFAULT_CATEGORIES = ['ዳቦ', 'ኬክ', 'ብስኩት', 'መጠጥ', 'ሌላ'];

// ═══════════════════════════════════════════════════════
// 🧩 NAVIGATION
// ═══════════════════════════════════════════════════════
const navItems = [
  { id: 'home',      icon: '🏠', label: 'Home',     default: true },
  { id: 'newSale',   icon: '🛒', label: 'New Sale' },
  { id: 'quickSale', icon: '⚡', label: 'Quick' },
  { id: 'items',     icon: '🍞', label: 'Items' },
  { id: 'reports',   icon: '📊', label: 'Reports' },
  { id: 'more',      icon: '⚙️', label: 'More' },
];

const moreItems = [
  { id: 'items',     icon: '🍞', label: 'Items (Stock)' },
  { id: 'newSale',   icon: '🛒', label: 'New Sale' },
  { id: 'quickSale', icon: '⚡', label: 'Quick Sale' },
  { id: 'purchases', icon: '📥', label: 'Purchases' },
  { id: 'expenses',  icon: '💸', label: 'Expenses' },
  { id: 'reports',   icon: '📊', label: 'Reports' },
  { id: 'settings',  icon: '⚙️', label: 'Settings' },
];

// ═══════════════════════════════════════════════════════
// 🖼️ PANEL HTML
// ═══════════════════════════════════════════════════════
const panelsHTML = {

  home: `
    <div class="card">
      <div class="card-title">📅 Today's Summary</div>
      <div class="stat-grid">
        <div class="summary-box green">
          <div class="label">Sales</div>
          <div class="value" id="homeSales">0.00</div>
        </div>
        <div class="summary-box red">
          <div class="label">Expenses</div>
          <div class="value" id="homeExpenses">0.00</div>
        </div>
        <div class="summary-box blue">
          <div class="label">Profit</div>
          <div class="value" id="homeProfit">0.00</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">⚡ Quick Actions</div>
      <div class="quick-actions-grid">
        <div class="quick-action" onclick="switchPage('newSale')">
          <div class="qa-icon">🛒</div><div class="qa-label">New Sale</div>
        </div>
        <div class="quick-action" onclick="switchPage('quickSale')">
          <div class="qa-icon">⚡</div><div class="qa-label">Quick Sale</div>
        </div>
        <div class="quick-action" onclick="switchPage('items')">
          <div class="qa-icon">🍞</div><div class="qa-label">Items (Stock)</div>
        </div>
        <div class="quick-action" onclick="switchPage('purchases')">
          <div class="qa-icon">📥</div><div class="qa-label">Purchases</div>
        </div>
        <div class="quick-action" onclick="switchPage('expenses')">
          <div class="qa-icon">💸</div><div class="qa-label">Expenses</div>
        </div>
        <div class="quick-action" onclick="switchPage('reports')">
          <div class="qa-icon">📊</div><div class="qa-label">Reports</div>
        </div>
      </div>
    </div>
  `,

  more: `
    <div class="card">
      <div class="card-title">⚙️ More</div>
      <div class="more-menu-list">
        ${moreItems.map(m => `
          <div class="menu-header" onclick="switchPage('${m.id}')" data-tab="${m.id}">
            <div class="m-left"><i>${m.icon}</i> <span>${esc(m.label)}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `,

  items: `
    <div class="card">
      <div class="card-title">
        <span>🍞 Bakery Items</span>
        <button class="btn btn-primary btn-sm" onclick="openAddItemModal()">➕ Add Item</button>
      </div>
      <input type="text" id="itemsSearchInput" placeholder="🔍 Search item..." oninput="renderItems()">
      <div id="itemsList" style="margin-top:12px;"></div>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-top:12px;">
        <div class="summary-box blue">
          <div class="label">Total Quantity</div>
          <div class="value" id="itemsTotalQty">0</div>
        </div>
        <div class="summary-box yellow">
          <div class="label">Stock Value (ETB)</div>
          <div class="value" id="itemsTotalValue">0.00</div>
        </div>
      </div>
      <div class="pagination-controls">
        <button id="itemsPrev" onclick="itemsPage(-1)">← Prev</button>
        <span id="itemsPageInfo" style="font-size:12px;color:var(--text-muted);padding:0 8px;">Page 1 of 1</span>
        <button id="itemsNext" onclick="itemsPage(1)">Next →</button>
      </div>
    </div>
  `,

  newSale: `
    <div class="card">
      <div class="card-title">🛒 New Sale</div>
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div class="form-group">
              <label class="field-label">🏢 Branch *</label>
              <select id="saleBranch"></select>
            </div>
            <div class="form-group">
              <label class="field-label">📅 Date *</label>
              <input type="date" id="saleDate" value="${todayStr()}">
            </div>
          </div>
          <div class="pos-cart-items" id="saleCartItems">
            <div class="empty-state"><div class="emoji">🛒</div><p>ምርት አልተመረጠም</p></div>
          </div>
          <div class="pos-cart-footer">
            <label class="field-label">💳 Payment Type</label>
            <div class="payment-type-selector">
              <button class="payment-type-btn active" data-pay="cash" onclick="setPaymentType('cash', this)">💵 Cash</button>
              <button class="payment-type-btn" data-pay="transfer" onclick="setPaymentType('transfer', this)">🏦 Transfer</button>
            </div>
            <div class="summary-box blue" style="margin:12px 0 0;">
              <div class="label">Total</div>
              <div class="value" id="saleTotal">0.00 ETB</div>
            </div>
            <div class="form-group" style="margin-top:12px;">
              <label class="field-label">💰 Paid Amount</label>
              <input type="number" id="salePaid" value="0" min="0" step="0.01" oninput="renderSaleTotal()">
            </div>
            <div class="summary-box red" style="margin:0;">
              <div class="label">📝 Unpaid</div>
              <div class="value" id="saleUnpaid">0.00 ETB</div>
            </div>
            <button class="btn btn-success" onclick="completeSale(event)">💸 Complete Sale</button>
            <button class="btn btn-outline" onclick="clearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header">
            <input type="text" id="saleSearch" placeholder="🔍 ምርት ፈልግ..." oninput="renderSaleProducts()">
          </div>
          <div class="pos-products-grid" id="saleProducts"></div>
        </div>
      </div>
    </div>
  `,

  quickSale: `
    <div class="card">
      <div class="card-title">⚡ Quick Sale (Direct Income)</div>
      <div class="empty-state" style="padding:0 0 16px;">
        <p>💡 ያለ ምርት ምርጫ በቀጥታ ጠቅላላ ገቢ ለመመዝገብ።</p>
      </div>
      <div class="form-group">
        <label class="field-label">📅 Date</label>
        <input type="date" id="qsDate" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label class="field-label">📁 Category</label>
        <select id="qsCategory"></select>
      </div>
      <div class="form-group">
        <label class="field-label">🏢 Branch</label>
        <select id="qsBranch"></select>
      </div>
      <div class="form-group">
        <label class="field-label">💰 Amount (ETB)</label>
        <input type="number" id="qsAmount" min="0" step="0.01" placeholder="0.00">
      </div>
      <button class="btn btn-success" onclick="saveQuickSale()">+ Add Income</button>
    </div>
  `,

  purchases: `
    <div class="card">
      <div class="card-title">📥 Purchases (Stock In)</div>
      <div class="form-group">
        <label class="field-label">🍞 Item *</label>
        <select id="purItem"></select>
      </div>
      <div class="form-group">
        <label class="field-label">📅 Date *</label>
        <input type="date" id="purDate" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label class="field-label">📦 Quantity Added *</label>
        <input type="number" id="purQty" min="1" step="1" placeholder="0">
      </div>
      <div class="form-group">
        <label class="field-label">💰 Cost per Item (ETB)</label>
        <input type="number" id="purCost" min="0" step="0.01" placeholder="0.00">
      </div>
      <button class="btn btn-primary" onclick="savePurchase()">💾 Save Purchase</button>
    </div>
    <div class="card">
      <div class="card-title">📋 Recent Purchases</div>
      <div id="purchasesList"></div>
    </div>
  `,

  expenses: `
    <div class="card">
      <div class="card-title">➕ Add Expense</div>
      <div class="form-group">
        <label class="field-label">🏢 Branch *</label>
        <select id="expBranch"></select>
      </div>
      <div class="form-group">
        <label class="field-label">📁 Category *</label>
        <select id="expCategory"></select>
      </div>
      <div class="form-group">
        <label class="field-label">💰 Amount (ETB) *</label>
        <input type="number" id="expAmount" min="0" step="0.01" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="field-label">📅 Date *</label>
        <input type="date" id="expDate" value="${todayStr()}">
      </div>
      <div class="form-group">
        <label class="field-label">📝 Note</label>
        <textarea id="expNote" rows="2" placeholder="..."></textarea>
      </div>
      <button class="btn btn-danger" onclick="saveExpense()">💾 Save Expense</button>
    </div>
    <div class="card">
      <div class="card-title">📋 Recent Expenses</div>
      <div class="date-filter-chips">
        <button class="date-chip active" data-f="recent" onclick="setExpenseFilter('recent', this)">Recent</button>
        <button class="date-chip" data-f="date" onclick="setExpenseFilter('date', this)">Date</button>
        <button class="date-chip" data-f="month" onclick="setExpenseFilter('month', this)">Month</button>
        <button class="date-chip" data-f="all" onclick="setExpenseFilter('all', this)">All</button>
      </div>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr;">
        <div class="summary-box yellow">
          <div class="label">This Month</div>
          <div class="value" id="expMonthTotal">0.00</div>
        </div>
        <div class="summary-box red">
          <div class="label">All Time</div>
          <div class="value" id="expAllTotal">0.00</div>
        </div>
      </div>
      <div id="expensesList"></div>
    </div>
  `,

  reports: `
    <div class="card">
      <div class="card-title">📊 Reports</div>
      <div class="report-type-tabs">
        <button class="report-type-tab active" data-p="daily" onclick="setReportPeriod('daily', this)">📅 Daily</button>
        <button class="report-type-tab" data-p="monthly" onclick="setReportPeriod('monthly', this)">📆 Monthly</button>
        <button class="report-type-tab" data-p="yearly" onclick="setReportPeriod('yearly', this)">📊 Yearly</button>
      </div>
      <div style="text-align:center;font-weight:700;color:var(--text-muted);margin-bottom:12px;" id="repPeriodLabel">Daily (${todayStr()})</div>
      <div class="form-group">
        <label class="field-label">🏢 Branch Filter</label>
        <select id="repBranch" onchange="setReportBranch(this.value)"></select>
      </div>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr;">
        <div class="summary-box green">
          <div class="label">Revenue</div>
          <div class="value" id="repRevenue">0.00</div>
        </div>
        <div class="summary-box red">
          <div class="label">Expenses</div>
          <div class="value" id="repExpenses">0.00</div>
        </div>
        <div class="summary-box blue">
          <div class="label">Profit</div>
          <div class="value" id="repProfit">0.00</div>
        </div>
        <div class="summary-box yellow">
          <div class="label">Unpaid</div>
          <div class="value" id="repUnpaid">0.00</div>
        </div>
      </div>
      <div class="payment-breakdown">
        <div class="payment-breakdown-item cash">
          <div class="label">💵 Cash</div>
          <div class="value" id="repCash">0.00 ETB</div>
        </div>
        <div class="payment-breakdown-item transfer">
          <div class="label">🏦 Transfer</div>
          <div class="value" id="repTransfer">0.00 ETB</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🏆 Top Selling Items</div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left;background:var(--bg);">
              <th style="padding:10px 8px;">#</th>
              <th style="padding:10px 8px;">Item</th>
              <th style="padding:10px 8px;">Qty</th>
              <th style="padding:10px 8px;">Revenue</th>
            </tr>
          </thead>
          <tbody id="repTopItems"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-outline" onclick="exportCSV()">📥 CSV</button>
        <button class="btn btn-outline" onclick="printReport()">🖨️ Print</button>
      </div>
    </div>
  `,

  settings: `
    <div class="card">
      <div class="card-title">🏢 Business Info</div>
      <div class="form-group">
        <label class="field-label">🏢 Business Name</label>
        <input type="text" id="setName" placeholder="Business Name">
      </div>
      <div class="form-group">
        <label class="field-label">📞 Phone</label>
        <input type="text" id="setPhone" placeholder="09...">
      </div>
      <div class="form-group">
        <label class="field-label">📦 Low Stock Threshold</label>
        <input type="number" id="setLowStock" min="1" step="1" value="10">
      </div>
      <button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button>
    </div>
    <div class="card">
      <div class="card-title">
        <span>🏢 Branches <span class="role-badge">PRO</span></span>
        <button class="btn btn-primary btn-sm" onclick="addBranch()">➕ Add</button>
      </div>
      <div id="branchesList"></div>
    </div>
    <div class="card">
      <div class="card-title">🎨 Theme</div>
      <div class="payment-type-selector">
        <button class="payment-type-btn" data-theme="light" onclick="setTheme('light', this)">☀️ Light</button>
        <button class="payment-type-btn" data-theme="dark" onclick="setTheme('dark', this)">🌙 Dark</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">🚪 Account</div>
      <button class="btn btn-outline" onclick="logout()">Sign Out</button>
    </div>
  `,
};

// ═══════════════════════════════════════════════════════
// 🚀 INIT
// ═══════════════════════════════════════════════════════
async function init(appState) {
  const host = document.getElementById('modulePanels');

  // ገጾች ሁለት ጊዜ እንዳይጫኑ
  if (host && !host.querySelector('.panel')) {
    host.innerHTML = Object.keys(panelsHTML)
      .map(id => `<div class="panel" id="${id}">${panelsHTML[id]}</div>`)
      .join('');
  }

  buildSidebar();
  buildMobileNav();
  await ensureBranchSelects();
  await ensureCategorySelects();

  switchPage('home');

  // አሁን ያለውን theme ማሳየት
  const isDark = document.body.classList.contains('dark-mode');
  document.querySelector(`.payment-type-btn[data-theme="${isDark ? 'dark' : 'light'}"]`)?.classList.add('active');

  await refreshHome();
}

function buildSidebar() {
  const sidebar = document.getElementById('sidebarNav');
  if (!sidebar) return;
  const seen = new Set(), all = [];
  [...navItems, ...moreItems].forEach(i => {
    if (!seen.has(i.id)) { seen.add(i.id); all.push(i); }
  });
  sidebar.innerHTML = all.map(item => `
    <div class="menu-header ${item.default ? 'active' : ''}"
         data-tab="${item.id}" onclick="switchPage('${item.id}', this)">
      <div class="m-left"><i>${item.icon}</i> <span>${esc(item.label)}</span></div>
    </div>
  `).join('');
}

function buildMobileNav() {
  const nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  nav.innerHTML = navItems.map(item => `
    <button class="mobile-nav-item ${item.default ? 'active' : ''}"
            data-tab="${item.id}" onclick="mobileNavClick('${item.id}', this)">
      <span class="nav-icon">${item.icon}</span><span>${esc(item.label)}</span>
    </button>
  `).join('');
}

// ═══════════════════════════════════════════════════════
// 📊 DATA LOADERS
// ═══════════════════════════════════════════════════════
function col(name) { return collection(db, 'tenants', state.tenantId, name); }

async function loadItems(force) {
  if (B.loaded.items && !force) return B.items;
  const snap = await getDocs(query(col('items'), orderBy('name')));
  B.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  B.loaded.items = true; return B.items;
}
async function loadSales(force) {
  if (B.loaded.sales && !force) return B.sales;
  const snap = await getDocs(query(col('sales'), orderBy('date', 'desc')));
  B.sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  B.loaded.sales = true; return B.sales;
}
async function loadPurchases(force) {
  if (B.loaded.purchases && !force) return B.purchases;
  const snap = await getDocs(query(col('purchases'), orderBy('date', 'desc')));
  B.purchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  B.loaded.purchases = true; return B.purchases;
}
async function loadExpenses(force) {
  if (B.loaded.expenses && !force) return B.expenses;
  const snap = await getDocs(query(col('expenses'), orderBy('date', 'desc')));
  B.expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  B.loaded.expenses = true; return B.expenses;
}

async function ensureBranchSelects() {
  B.branches = (state.tenantData?.branches?.length)
    ? state.tenantData.branches
    : [{ id: 'main', name: 'Main' }];

  const opts = B.branches
    .map(b => `<option value="${esc(b.id || b.name)}">${esc(b.name)}</option>`).join('');

  ['saleBranch', 'qsBranch', 'expBranch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const rep = document.getElementById('repBranch');
  if (rep) rep.innerHTML = '<option value="all">📊 All Branches</option>' + opts;
}

async function ensureCategorySelects() {
  B.categories = (state.tenantData?.categories?.length)
    ? state.tenantData.categories : DEFAULT_CATEGORIES;
  const opts = B.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  ['qsCategory', 'expCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ═══════════════════════════════════════════════════════
// 🏠 HOME
// ═══════════════════════════════════════════════════════
async function refreshHome() {
  const today = todayStr();
  await Promise.all([loadSales(true), loadExpenses(true)]);

  const sTotal = B.sales.filter(s => s.date === today)
    .reduce((a, s) => a + (Number(s.total) || 0), 0);
  const eTotal = B.expenses.filter(e => e.date === today)
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);

  setText('homeSales', money(sTotal));
  setText('homeExpenses', money(eTotal));
  setText('homeProfit', money(sTotal - eTotal));
}

// ═══════════════════════════════════════════════════════
// 🍞 ITEMS
// ═══════════════════════════════════════════════════════
async function renderItems() {
  await loadItems(true);
  const list = document.getElementById('itemsList');
  if (!list) return;

  const q = (document.getElementById('itemsSearchInput')?.value || '').toLowerCase();
  const filtered = B.items.filter(i =>
    !q || (i.name || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q));

  const totalQty = B.items.reduce((a, i) => a + (Number(i.stock) || 0), 0);
  const totalVal = B.items.reduce((a, i) => a + (Number(i.stock) || 0) * (Number(i.price) || 0), 0);
  setText('itemsTotalQty', totalQty.toLocaleString('en-US'));
  setText('itemsTotalValue', money(totalVal));

  const totalPages = Math.max(1, Math.ceil(filtered.length / B.itemsPerPage));
  if (B.itemsPage > totalPages) B.itemsPage = totalPages;
  const start = (B.itemsPage - 1) * B.itemsPerPage;
  const pageItems = filtered.slice(start, start + B.itemsPerPage);

  setText('itemsPageInfo', `${filtered.length} total | Page ${B.itemsPage} of ${totalPages}`);
  const prev = document.getElementById('itemsPrev'), next = document.getElementById('itemsNext');
  if (prev) prev.disabled = B.itemsPage <= 1;
  if (next) next.disabled = B.itemsPage >= totalPages;

  if (!pageItems.length) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">🍞</div><p>እቃ አልተገኘም</p></div>`;
    return;
  }

  const byCat = {};
  pageItems.forEach(i => {
    const c = i.category || 'ሌላ';
    (byCat[c] = byCat[c] || []).push(i);
  });

  list.innerHTML = Object.keys(byCat).map((cat, idx) => {
    const items = byCat[cat];
    const catQty = items.reduce((a, i) => a + (Number(i.stock) || 0), 0);
    return `
      <div class="category-collapsible ${idx === 0 ? 'open' : ''}">
        <div class="category-header" onclick="toggleCategory(this)">
          <div class="category-header-left">
            <span class="category-arrow">▶</span>
            <span class="category-name">📁 ${esc(cat)}</span>
            <span class="category-count">${items.length}</span>
          </div>
          <span class="category-total">${catQty} qty</span>
        </div>
        <div class="category-body">
          ${items.map(itemRowHTML).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function itemRowHTML(i) {
  const low = Number(i.stock) <= (state.lowStockThreshold || 10);
  return `
    <div class="item-row">
      <div class="item-row-name">
        🍞 ${esc(i.name)}
        <div style="font-size:11px;color:var(--text-muted);">
          ${low ? '⚠️' : '✅'} Stock: ${Number(i.stock) || 0}
        </div>
      </div>
      <div class="item-row-price">${money(i.price)} ETB</div>
      <button class="btn btn-outline btn-sm" onclick="editItem('${escJs(i.id)}')">✏️</button>
      <button class="btn btn-outline btn-sm" onclick="deleteItem('${escJs(i.id)}')">🗑️</button>
    </div>
  `;
}

function itemsPage(delta) {
  B.itemsPage = Math.max(1, (B.itemsPage || 1) + delta);
  renderItems();
}

function toggleCategory(el) { el.parentElement.classList.toggle('open'); }

// ─── Add/Edit Item Modal ───
function openAddItemModal(item = null) {
  B.editingItemId = item?.id || null;
  let modal = document.getElementById('addItemModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addItemModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="addItemTitle">➕ Add Item</h3>
          <button class="modal-close" onclick="closeAddItemModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="field-label">🏢 Branch *</label>
            <select id="newItemBranch"></select>
          </div>
          <div class="form-group">
            <label class="field-label">📁 Category *</label>
            <select id="newItemCategory"></select>
          </div>
          <div class="form-group">
            <label class="field-label">🍞 Item Name *</label>
            <input type="text" id="newItemName" placeholder="...">
          </div>
          <div class="form-group">
            <label class="field-label">💰 Price (ETB) *</label>
            <input type="number" id="newItemPrice" min="0" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="field-label">📦 Initial Stock (Qty) *</label>
            <input type="number" id="newItemStock" min="0" step="1" placeholder="0">
          </div>
          <button class="btn btn-primary" onclick="saveItem()">💾 Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('newItemBranch').innerHTML =
      B.branches.map(b => `<option value="${esc(b.id || b.name)}">${esc(b.name)}</option>`).join('');
    document.getElementById('newItemCategory').innerHTML =
      B.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }

  document.getElementById('addItemTitle').textContent = item ? '✏️ Edit Item' : '➕ Add Item';
  document.getElementById('newItemName').value = item?.name || '';
  document.getElementById('newItemPrice').value = item?.price ?? '';
  document.getElementById('newItemStock').value = item?.stock ?? '';
  if (item?.category) document.getElementById('newItemCategory').value = item.category;

  modal.classList.add('open');
}

function closeAddItemModal() {
  document.getElementById('addItemModal')?.classList.remove('open');
  B.editingItemId = null;
}

async function saveItem() {
  const name = document.getElementById('newItemName').value.trim();
  const price = Number(document.getElementById('newItemPrice').value) || 0;
  const stock = Number(document.getElementById('newItemStock').value) || 0;
  const category = document.getElementById('newItemCategory').value;
  const branch = document.getElementById('newItemBranch').value;

  if (!name) return showToast('የእቃ ስም ያስፈልጋል', 'error');
  if (price <= 0) return showToast('ትክክለኛ ዋጋ አስገባ', 'error');

  try {
    if (B.editingItemId) {
      await updateDoc(doc(db, 'tenants', state.tenantId, 'items', B.editingItemId),
        { name, price, stock, category, branch, updatedAt: serverTimestamp() });
      showToast('እቃ ተስተካክሏል ✏️');
    } else {
      await addDoc(col('items'), {
        name, price, stock, category, branch,
        createdBy: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });
      showToast('እቃ ተጨምሯል ✅');
    }
    closeAddItemModal();
    await renderItems();
    await refreshSaleProducts();
  } catch (e) {
    showToast('ስህተት: ' + e.message, 'error');
  }
}

function editItem(id) {
  const item = B.items.find(i => i.id === id);
  if (item) openAddItemModal(item);
}

async function deleteItem(id) {
  if (!confirm('ይህን እቃ ማጥፋት ትፈልጋለህ?')) return;
  try {
    await deleteDoc(doc(db, 'tenants', state.tenantId, 'items', id));
    showToast('ተጠፍቷል 🗑️');
    await renderItems();
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════
// 🛒 NEW SALE
// ═══════════════════════════════════════════════════════
async function refreshSaleProducts() {
  await loadItems();
  renderSaleProducts();
}

function renderSaleProducts() {
  const host = document.getElementById('saleProducts');
  if (!host) return;
  const q = (document.getElementById('saleSearch')?.value || '').toLowerCase();
  const filtered = B.items.filter(i =>
    !q || (i.name || '').toLowerCase().includes(q));

  if (!filtered.length) {
    host.innerHTML = `<div class="empty-state"><div class="emoji">🍞</div><p>ምርት አልተገኘም</p></div>`;
    return;
  }

  host.innerHTML = filtered.map(i => `
    <div class="product-card" onclick="addToCart('${escJs(i.id)}')">
      <div class="p-name">${esc(i.name)}</div>
      <div class="p-stock" style="font-size:11px;color:var(--text-muted);">Stock: ${Number(i.stock) || 0}</div>
      <div class="p-price">${money(i.price)} ETB</div>
    </div>
  `).join('');
}

function addToCart(itemId) {
  const item = B.items.find(i => i.id === itemId);
  if (!item) return;
  const existing = B.cart.find(c => c.itemId === itemId);

  if (existing) {
    if (existing.qty + 1 > (Number(item.stock) || 0))
      return showToast('ክምችት አልበቃም', 'warning');
    existing.qty++;
  } else {
    if ((Number(item.stock) || 0) < 1) return showToast('ክምችት አልበቃም', 'warning');
    B.cart.push({ itemId, name: item.name, price: Number(item.price) || 0, qty: 1 });
  }
  renderCart();
}

function changeCartQty(itemId, delta) {
  const line = B.cart.find(c => c.itemId === itemId);
  if (!line) return;
  const max = Number(B.items.find(i => i.id === itemId)?.stock) || 0;
  line.qty += delta;
  if (line.qty <= 0) B.cart = B.cart.filter(c => c.itemId !== itemId);
  else if (line.qty > max) { line.qty = max; showToast('ከክምችት በላይ አይቻልም', 'warning'); }
  renderCart();
}

function removeFromCart(itemId) {
  B.cart = B.cart.filter(c => c.itemId !== itemId);
  renderCart();
}

function renderCart() {
  const host = document.getElementById('saleCartItems');
  if (!host) return;

  if (!B.cart.length) {
    host.innerHTML = `<div class="empty-state"><div class="emoji">🛒</div><p>ምርት አልተመረጠም</p></div>`;
    renderSaleTotal(); return;
  }

  host.innerHTML = B.cart.map(c => `
    <div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${esc(c.name)}</div>
        <div class="ci-price">${money(c.price)} ETB</div>
      </div>
      <div class="ci-qty">
        <button onclick="changeCartQty('${escJs(c.itemId)}', -1)">−</button>
        <span>${c.qty}</span>
        <button onclick="changeCartQty('${escJs(c.itemId)}', 1)">+</button>
      </div>
      <div class="ci-total">${money(c.price * c.qty)}</div>
      <span class="ci-del" onclick="removeFromCart('${escJs(c.itemId)}')">×</span>
    </div>
  `).join('');
  renderSaleTotal();
}

function setPaymentType(type, btn) {
  B.paymentType = type;
  document.querySelectorAll('.payment-type-btn[data-pay]').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
}

function cartTotal() { return B.cart.reduce((a, c) => a + c.price * c.qty, 0); }

function renderSaleTotal() {
  const total = cartTotal();
  const paid = Number(document.getElementById('salePaid')?.value) || 0;
  setText('saleTotal', `${money(total)} ETB`);
  setText('saleUnpaid', `${money(Math.max(0, total - paid))} ETB`);
}

function clearCart() {
  B.cart = [];
  const p = document.getElementById('salePaid');
  if (p) p.value = '0';
  renderCart();
}

async function completeSale(event) {
  if (!B.cart.length) return showToast('ጋሪ ባዶ ነው', 'warning');

  const total = cartTotal();
  const paid = Number(document.getElementById('salePaid')?.value) || 0;
  const date = document.getElementById('saleDate')?.value || todayStr();
  const branch = document.getElementById('saleBranch')?.value || 'main';

  if (paid > total) return showToast('የተከፈለው ከጠቅላላ በላይ ነው', 'error');

  const btn = event?.target;
  if (btn) btn.disabled = true;

  try {
    const batch = writeBatch(db);
    batch.set(doc(col('sales')), {
      date, branch,
      items: B.cart.map(c => ({ itemId: c.itemId, name: c.name, price: c.price, qty: c.qty })),
      total, paid, unpaid: Math.max(0, total - paid),
      paymentType: B.paymentType, type: 'sale',
      soldBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });
    B.cart.forEach(c => {
      batch.update(doc(db, 'tenants', state.tenantId, 'items', c.itemId),
        { stock: increment(-c.qty) });
    });
    await batch.commit();

    showToast('ሽያጭ ተመዝግቧል ✅');
    clearCart();
    await loadItems(true);
    await renderItemsIfVisible();
    await refreshHome();
  } catch (e) {
    showToast('ስህተት: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════
// ⚡ QUICK SALE
// ═══════════════════════════════════════════════════════
async function saveQuickSale() {
  const amount = Number(document.getElementById('qsAmount')?.value) || 0;
  const date = document.getElementById('qsDate')?.value || todayStr();
  const category = document.getElementById('qsCategory')?.value || 'ሌላ';
  const branch = document.getElementById('qsBranch')?.value || 'main';

  if (amount <= 0) return showToast('ትክክለኛ መጠን አስገባ', 'error');

  try {
    await addDoc(col('sales'), {
      date, branch, category, items: [],
      total: amount, paid: amount, unpaid: 0,
      paymentType: 'cash', type: 'quick',
      soldBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });
    document.getElementById('qsAmount').value = '';
    showToast('ገቢ ተመዝግቧል ✅');
    await refreshHome();
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════
// 📥 PURCHASES
// ═══════════════════════════════════════════════════════
async function refreshPurchaseSelect() {
  await loadItems();
  const sel = document.getElementById('purItem');
  if (!sel) return;
  sel.innerHTML = B.items.length
    ? B.items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')
    : '<option value="">— እቃ የለም —</option>';
}

async function savePurchase() {
  const itemId = document.getElementById('purItem')?.value;
  const qty = Number(document.getElementById('purQty')?.value) || 0;
  const cost = Number(document.getElementById('purCost')?.value) || 0;
  const date = document.getElementById('purDate')?.value || todayStr();

  if (!itemId) return showToast('እቃ ምረጥ', 'error');
  if (qty <= 0) return showToast('ትክክለኛ ብዛት አስገባ', 'error');

  const item = B.items.find(i => i.id === itemId);

  try {
    const batch = writeBatch(db);
    batch.set(doc(col('purchases')), {
      date, itemId, itemName: item?.name || '',
      qty, cost: cost * qty, unitCost: cost,
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'tenants', state.tenantId, 'items', itemId),
      { stock: increment(qty) });
    await batch.commit();

    showToast('ግዢ ተመዝግቧል ✅');
    document.getElementById('purQty').value = '';
    document.getElementById('purCost').value = '';
    await loadItems(true);
    await loadPurchases(true);
    await renderPurchases();
    await refreshHome();
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function renderPurchases() {
  await loadPurchases(true);
  const host = document.getElementById('purchasesList');
  if (!host) return;
  const recent = B.purchases.slice(0, 15);
  host.innerHTML = recent.length
    ? recent.map(p => `
        <div class="item-row">
          <div class="item-row-name">
            📥 ${esc(p.itemName || '—')}
            <div style="font-size:11px;color:var(--text-muted);">${esc(p.date)} • ${p.qty} qty</div>
          </div>
          <div class="item-row-price">${money(p.cost)} ETB</div>
        </div>`).join('')
    : `<div class="empty-state"><div class="emoji">📥</div><p>ግዢ አልተመዘገበም</p></div>`;
}

// ═══════════════════════════════════════════════════════
// 💸 EXPENSES
// ═══════════════════════════════════════════════════════
async function saveExpense() {
  const amount = Number(document.getElementById('expAmount')?.value) || 0;
  const date = document.getElementById('expDate')?.value || todayStr();
  const branch = document.getElementById('expBranch')?.value || 'main';
  const category = document.getElementById('expCategory')?.value || 'ሌላ';
  const note = document.getElementById('expNote')?.value.trim() || '';

  if (amount <= 0) return showToast('ትክክለኛ መጠን አስገባ', 'error');

  try {
    await addDoc(col('expenses'), {
      amount, date, branch, category, note,
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    showToast('ወጪ ተመዝግቧል ✅');
    await loadExpenses(true);
    await renderExpenses();
    await refreshHome();
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

function setExpenseFilter(f, btn) {
  B.expenseFilter = f;
  document.querySelectorAll('.date-chip[data-f]').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  renderExpenses();
}

async function renderExpenses() {
  await loadExpenses(true);
  const host = document.getElementById('expensesList');
  if (!host) return;

  const today = todayStr(), month = thisMonthStr();
  let list = B.expenses;
  if (B.expenseFilter === 'recent') list = B.expenses.slice(0, 15);
  else if (B.expenseFilter === 'date') list = B.expenses.filter(e => e.date === today);
  else if (B.expenseFilter === 'month') list = B.expenses.filter(e => (e.date || '').startsWith(month));

  const monthTotal = B.expenses.filter(e => (e.date || '').startsWith(month))
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const allTotal = B.expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  setText('expMonthTotal', money(monthTotal));
  setText('expAllTotal', money(allTotal));

  host.innerHTML = list.length
    ? list.map(e => `
        <div class="item-row">
          <div class="item-row-name">
            📁 ${esc(e.category || '—')}
            <div style="font-size:11px;color:var(--text-muted);">${esc(e.date)}${e.note ? ' • ' + esc(e.note) : ''}</div>
          </div>
          <div class="item-row-price" style="color:var(--danger);">${money(e.amount)} ETB</div>
        </div>`).join('')
    : `<div class="empty-state"><div class="emoji">💸</div><p>ወጪ አልተመዘገበም</p></div>`;
}

// ═══════════════════════════════════════════════════════
// 📊 REPORTS
// ═══════════════════════════════════════════════════════
function setReportPeriod(p, btn) {
  B.reportPeriod = p;
  document.querySelectorAll('.report-type-tab[data-p]').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  refreshReports();
}

function setReportBranch(v) { B.reportBranch = v; refreshReports(); }

function periodMatch(dateStr) {
  if (!dateStr) return false;
  if (B.reportPeriod === 'daily') return dateStr === todayStr();
  if (B.reportPeriod === 'monthly') return dateStr.startsWith(thisMonthStr());
  return dateStr.startsWith(thisYearStr());
}

function branchMatch(rec) {
  return B.reportBranch === 'all' || rec.branch === B.reportBranch;
}

async function refreshReports() {
  await Promise.all([loadSales(true), loadExpenses(true)]);

  // ርዕስ
  const label = B.reportPeriod === 'daily' ? `Daily (${todayStr()})`
    : B.reportPeriod === 'monthly' ? `Monthly (${thisMonthStr()})`
    : `Yearly (${thisYearStr()})`;
  setText('repPeriodLabel', label);

  const sales = B.sales.filter(s => periodMatch(s.date) && branchMatch(s));
  const exps = B.expenses.filter(e => periodMatch(e.date) && branchMatch(e));

  const revenue = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
  const expense = exps.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const unpaid = sales.reduce((a, s) => a + (Number(s.unpaid) || 0), 0);
  const cash = sales.filter(s => s.paymentType === 'cash')
    .reduce((a, s) => a + (Number(s.total) || 0), 0);
  const transfer = sales.filter(s => s.paymentType === 'transfer')
    .reduce((a, s) => a + (Number(s.total) || 0), 0);

  setText('repRevenue', money(revenue));
  setText('repExpenses', money(expense));
  setText('repProfit', money(revenue - expense));
  setText('repUnpaid', money(unpaid));
  setText('repCash', `${money(cash)} ETB`);
  setText('repTransfer', `${money(transfer)} ETB`);

  const map = {};
  sales.forEach(s => (s.items || []).forEach(it => {
    const key = it.itemId || it.name;
    if (!map[key]) map[key] = { name: it.name, qty: 0, revenue: 0 };
    map[key].qty += Number(it.qty) || 0;
    map[key].revenue += (Number(it.qty) || 0) * (Number(it.price) || 0);
  }));

  const top = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const tbody = document.getElementById('repTopItems');
  if (tbody) {
    tbody.innerHTML = top.length
      ? top.map((t, i) => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;">${i + 1}</td>
            <td style="padding:8px;">${esc(t.name)}</td>
            <td style="padding:8px;">${t.qty}</td>
            <td style="padding:8px;">${money(t.revenue)}</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text-muted);">መረጃ የለም</td></tr>`;
  }
}

function exportCSV() {
  const rows = [['#', 'Item', 'Qty', 'Revenue']];
  document.querySelectorAll('#repTopItems tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
    if (cells.length) rows.push(cells);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${B.reportPeriod}_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV ተዘጋጅቷል 📥');
}

function printReport() { window.print(); }

// ═══════════════════════════════════════════════════════
// ⚙️ SETTINGS
// ═══════════════════════════════════════════════════════
async function renderSettings() {
  const t = state.tenantData || {};
  const n = document.getElementById('setName');
  const p = document.getElementById('setPhone');
  const l = document.getElementById('setLowStock');
  if (n) n.value = t.name || '';
  if (p) p.value = t.phone || '';
  if (l) l.value = t.lowStockThreshold || 10;

  const host = document.getElementById('branchesList');
  if (host) {
    host.innerHTML = B.branches.length
      ? B.branches.map(b => `
          <div class="item-row">
            <div class="item-row-name">🏢 ${esc(b.name)}</div>
            ${B.branches.length > 1
              ? `<button class="btn btn-outline btn-sm" onclick="deleteBranch('${escJs(b.id || b.name)}')">🗑️</button>` : ''}
          </div>`).join('')
      : `<div class="empty-state"><p>ቅርንጫፍ የለም</p></div>`;
  }
}

async function saveSettings() {
  const name = document.getElementById('setName')?.value.trim() || '';
  const phone = document.getElementById('setPhone')?.value.trim() || '';
  const lowStockThreshold = Number(document.getElementById('setLowStock')?.value) || 10;

  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { name, phone, lowStockThreshold });
    state.tenantData = { ...(state.tenantData || {}), name, phone, lowStockThreshold };
    state.lowStockThreshold = lowStockThreshold;
    const hdr = document.getElementById('hdrBusinessName');
    if (hdr && name) hdr.textContent = name;
    showToast('ቅንብሮች ተቀምጠዋል ✅');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function addBranch() {
  const name = prompt('የቅርንጫፍ ስም:');
  if (!name) return;
  const branches = [...(state.tenantData?.branches || [])];
  branches.push({ id: 'br_' + Date.now(), name: name.trim() });
  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { branches });
    state.tenantData = { ...(state.tenantData || {}), branches };
    B.branches = branches;
    await ensureBranchSelects();
    await renderSettings();
    showToast('ቅርንጫፍ ተጨምሯል ✅');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function deleteBranch(id) {
  if (!confirm('ቅርንጫፍ ማጥፋት ትፈልጋለህ?')) return;
  const branches = (state.tenantData?.branches || []).filter(b => (b.id || b.name) !== id);
  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { branches });
    state.tenantData = { ...(state.tenantData || {}), branches };
    B.branches = branches;
    await ensureBranchSelects();
    await renderSettings();
    showToast('ተጠፍቷል 🗑️');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function setTheme(mode, btn) {
  document.querySelectorAll('.payment-type-btn[data-theme]')
    .forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');

  if (mode === 'dark') document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');

  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: mode === 'dark' });
  } catch (e) { console.error('theme save failed', e); }
}

// ═══════════════════════════════════════════════════════
// 🧭 PAGE HOOK
// ═══════════════════════════════════════════════════════
async function onPageChange(panelId) {
  try {
    switch (panelId) {
      case 'home':      await refreshHome(); break;
      case 'more':      break;
      case 'items':     await renderItems(); break;
      case 'newSale':   await refreshSaleProducts(); await renderCart(); break;
      case 'quickSale': await ensureCategorySelects(); await ensureBranchSelects(); break;
      case 'purchases': await refreshPurchaseSelect(); await renderPurchases(); break;
      case 'expenses':  await ensureCategorySelects(); await ensureBranchSelects(); await renderExpenses(); break;
      case 'reports':   await ensureBranchSelects();
                        document.querySelectorAll('.report-type-tab[data-p]')
                          .forEach(b => b.classList.toggle('active', b.dataset.p === B.reportPeriod));
                        await refreshReports(); break;
      case 'settings':  await renderSettings(); break;
    }
  } catch (e) {
    console.error('[bakery]', e);
    showToast('ስህተት: ' + e.message, 'error');
  }
}

async function renderItemsIfVisible() {
  if (document.getElementById('items')?.classList.contains('active')) await renderItems();
  if (document.getElementById('newSale')?.classList.contains('active')) await refreshSaleProducts();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function cleanup() {
  B.cart = []; B.items = []; B.sales = []; B.purchases = []; B.expenses = [];
  B.loaded = { items: false, sales: false, purchases: false, expenses: false };
}

// ═══════════════════════════════════════════════════════
// 📦 EXPORT
// ═══════════════════════════════════════════════════════
export const BakeryModule = {
  name: 'Bakery',
  icon: '🍞',
  navItems,
  panels: [],        // ← ገጾች በ init() ይጫናሉ (core.js እንደገና እንዳይጭን)
  init,
  onPageChange,
  cleanup,
};

// ─── globals ───
Object.assign(window, {
  openAddItemModal, closeAddItemModal, saveItem, deleteItem, editItem, toggleCategory, itemsPage,
  addToCart, changeCartQty, removeFromCart, setPaymentType, renderSaleTotal,
  clearCart, completeSale, saveQuickSale, savePurchase, saveExpense,
  setExpenseFilter, setReportPeriod, setReportBranch, exportCSV, printReport,
  saveSettings, addBranch, deleteBranch, setTheme,
});

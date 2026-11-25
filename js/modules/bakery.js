// js/modules/bakery.js
import { db, auth } from '../firebase.js';
import { 
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, where, orderBy, serverTimestamp, getDoc, increment, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { showToast, esc, money, todayStr, thisMonthStr, thisYearStr, state } from '../core.js';

// ═══════════════════════════════════════════
// 🏗️ MODULE DEFINITION
// ═══════════════════════════════════════════
export const BakeryModule = {
  id: 'bakery',
  name: 'Bakery / ቤት ስራ',
  icon: '🥖',
  navItems: [
    { id: 'bk-home', icon: '🏠', label: 'Home', default: true },
    { id: 'bk-items', icon: '📦', label: 'Items' },
    { id: 'bk-sales', icon: '🛒', label: 'New Sale' },
    { id: 'bk-quick-sale', icon: '💵', label: 'Quick Sale' },
    { id: 'bk-purchases', icon: '📥', label: 'Purchases' },
    { id: 'bk-expenses', icon: '💸', label: 'Expenses' },
    { id: 'bk-reports', icon: '📊', label: 'Reports' },
    { id: 'bk-settings', icon: '⚙️', label: 'Settings' }
  ],
  panels: [],
  
  // Temporary state for UI interactions
  _state: {
    items: [],
    cart: [],
    branches: [],
    settings: {},
    currentReportFilter: 'daily'
  },

  init: async function(appState) {
    this._state.tenantId = appState.tenantId;
    this._state.businessType = appState.businessType;
    this._state.role = appState.role;
    
    // Build HTML panels dynamically
    this.panels = this.buildPanels();
    
    // Load initial data
    await this.loadSettings();
    await this.loadItems();
    await this.loadDashboardStats();
  },

  onPageChange: function(panelId) {
    if (panelId === 'bk-home') this.loadDashboardStats();
    if (panelId === 'bk-items') this.renderItems();
    if (panelId === 'bk-sales') this.renderSalesUI();
    if (panelId === 'bk-purchases') this.renderPurchasesUI();
    if (panelId === 'bk-expenses') this.renderExpensesUI();
    if (panelId === 'bk-reports') this.renderReportsUI();
    if (panelId === 'bk-settings') this.renderSettingsUI();
  },

  cleanup: function() {
    this._state.cart = [];
  },

  // ═══════════════════════════════════════════
  // 🎨 UI BUILDING
  // ═══════════════════════════════════════════
  buildPanels: function() {
    return [
      { id: 'bk-home', html: this.getHomeHTML() },
      { id: 'bk-items', html: this.getItemsHTML() },
      { id: 'bk-sales', html: this.getSalesHTML() },
      { id: 'bk-quick-sale', html: this.getQuickSaleHTML() },
      { id: 'bk-purchases', html: this.getPurchasesHTML() },
      { id: 'bk-expenses', html: this.getExpensesHTML() },
      { id: 'bk-reports', html: this.getReportsHTML() },
      { id: 'bk-settings', html: this.getSettingsHTML() }
    ];
  },

  getHomeHTML: function() {
    return `
      <div class="panel-header"><h2>Dashboard</h2></div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-label">Today's Sales</span><span class="stat-value" id="bk-stat-sales">0.00 ETB</span></div>
        <div class="stat-card"><span class="stat-label">Today's Expenses</span><span class="stat-value text-danger" id="bk-stat-expenses">0.00 ETB</span></div>
        <div class="stat-card"><span class="stat-label">Today's Profit</span><span class="stat-value text-success" id="bk-stat-profit">0.00 ETB</span></div>
      </div>
      <h3 class="section-title">Quick Actions</h3>
      <div class="quick-actions-grid">
        <button class="qa-btn" onclick="switchPage('bk-sales', null)"><span>🛒</span>New Sale</button>
        <button class="qa-btn" onclick="switchPage('bk-quick-sale', null)"><span>💵</span>Quick Sale</button>
        <button class="qa-btn" onclick="switchPage('bk-items', null)"><span>📦</span>Items</button>
        <button class="qa-btn" onclick="switchPage('bk-purchases', null)"><span>📥</span>Purchases</button>
        <button class="qa-btn" onclick="switchPage('bk-expenses', null)"><span>💸</span>Expenses</button>
        <button class="qa-btn" onclick="switchPage('bk-reports', null)"><span>📊</span>Reports</button>
      </div>
    `;
  },

  getItemsHTML: function() {
    return `
      <div class="panel-header flex-between">
        <h2>Items (Stock)</h2>
        <button class="btn btn-primary" onclick="BakeryModule.openAddItemModal()">+ Add Item</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-label">Total Quantity</span><span class="stat-value" id="bk-total-qty">0</span></div>
        <div class="stat-card"><span class="stat-label">Stock Value</span><span class="stat-value" id="bk-stock-value">0.00 ETB</span></div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Item</th><th>Category</th><th>Price (ETB)</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody id="bk-items-tbody"></tbody>
        </table>
      </div>
      <!-- Add Item Modal Placeholder -->
      <div id="bk-add-item-modal" class="modal-overlay hidden">
        <div class="modal-content">
          <h3>Add New Item</h3>
          <form id="bk-add-item-form" onsubmit="BakeryModule.saveNewItem(event)">
            <div class="form-group"><label>Branch*</label><select id="bk-item-branch" required></select></div>
            <div class="form-group"><label>Category*</label><input type="text" id="bk-item-category" required placeholder="e.g. Bread, Cake"></div>
            <div class="form-group"><label>Item Name*</label><input type="text" id="bk-item-name" required></div>
            <div class="form-group"><label>Price (ETB)*</label><input type="number" step="0.01" id="bk-item-price" required></div>
            <div class="form-group"><label>Initial Stock (Qty)*</label><input type="number" id="bk-item-stock" required></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('bk-add-item-modal').classList.add('hidden')">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Item</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  getSalesHTML: function() {
    return `
      <div class="panel-header"><h2>New Sale (Itemized)</h2></div>
      <div class="form-row">
        <div class="form-group"><label>Branch*</label><select id="bk-sale-branch" required></select></div>
        <div class="form-group"><label>Date*</label><input type="date" id="bk-sale-date" required></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Add Item</label>
          <select id="bk-sale-item-select"></select>
        </div>
        <div class="form-group">
          <label>Qty</label>
          <input type="number" id="bk-sale-qty" value="1" min="1">
        </div>
        <div class="form-group" style="display:flex; align-items:flex-end;">
          <button class="btn btn-secondary" onclick="BakeryModule.addToCart()">Add to Cart</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th>Action</th></tr></thead>
          <tbody id="bk-cart-tbody"></tbody>
        </table>
      </div>
      <div class="cart-summary">
        <div class="summary-row"><span>Total:</span><span id="bk-cart-total">0.00 ETB</span></div>
        <div class="form-row">
          <div class="form-group"><label>Payment Type</label><select id="bk-sale-payment"><option value="cash">Cash</option><option value="transfer">Transfer</option></select></div>
          <div class="form-group"><label>Paid Amount (ETB)</label><input type="number" step="0.01" id="bk-sale-paid" oninput="BakeryModule.updateUnpaidBalance()"></div>
        </div>
        <div class="summary-row text-danger"><span>Unpaid Balance:</span><span id="bk-cart-unpaid">0.00 ETB</span></div>
      </div>
      <div class="flex-between" style="margin-top: 1rem;">
        <button class="btn btn-secondary" onclick="BakeryModule.clearCart()">Clear</button>
        <button class="btn btn-primary" onclick="BakeryModule.completeSale()">Complete Sale</button>
      </div>
    `;
  },

  getQuickSaleHTML: function() {
    return `
      <div class="panel-header"><h2>Quick Sale (Direct Income)</h2></div>
      <form id="bk-quick-sale-form" onsubmit="BakeryModule.saveQuickSale(event)">
        <div class="form-group"><label>Date*</label><input type="date" id="bk-qs-date" value="${todayStr()}" required></div>
        <div class="form-group"><label>Category*</label><input type="text" id="bk-qs-category" required placeholder="e.g. Bread Sales"></div>
        <div class="form-group"><label>Branch*</label><select id="bk-qs-branch" required></select></div>
        <div class="form-group"><label>Amount (ETB)*</label><input type="number" step="0.01" id="bk-qs-amount" required></div>
        <button type="submit" class="btn btn-primary">+ Add Income</button>
      </form>
    `;
  },

  getPurchasesHTML: function() {
    return `
      <div class="panel-header"><h2>Purchases (Stock In)</h2></div>
      <form id="bk-purchase-form" onsubmit="BakeryModule.savePurchase(event)">
        <div class="form-group"><label>Item*</label><select id="bk-purch-item" required></select></div>
        <div class="form-group"><label>Date*</label><input type="date" id="bk-purch-date" value="${todayStr()}" required></div>
        <div class="form-group"><label>Quantity Added*</label><input type="number" id="bk-purch-qty" required></div>
        <div class="form-group"><label>Cost per Item (ETB)*</label><input type="number" step="0.01" id="bk-purch-cost" required></div>
        <button type="submit" class="btn btn-primary">Save Purchase</button>
      </form>
      <h3 class="section-title">Recent Purchases</h3>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Total Cost</th></tr></thead>
          <tbody id="bk-purchases-tbody"></tbody>
        </table>
      </div>
    `;
  },

  getExpensesHTML: function() {
    return `
      <div class="panel-header"><h2>Expenses</h2></div>
      <form id="bk-expense-form" onsubmit="BakeryModule.saveExpense(event)">
        <div class="form-row">
          <div class="form-group"><label>Branch*</label><select id="bk-exp-branch" required></select></div>
          <div class="form-group"><label>Category*</label><input type="text" id="bk-exp-category" required placeholder="e.g. Flour, Rent"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Amount (ETB)*</label><input type="number" step="0.01" id="bk-exp-amount" required></div>
          <div class="form-group"><label>Date*</label><input type="date" id="bk-exp-date" value="${todayStr()}" required></div>
        </div>
        <div class="form-group"><label>Note</label><input type="text" id="bk-exp-note"></div>
        <button type="submit" class="btn btn-primary">Save Expense</button>
      </form>
      <div class="stats-grid" style="margin-top: 1rem;">
        <div class="stat-card"><span class="stat-label">This Month</span><span class="stat-value" id="bk-exp-month">0.00 ETB</span></div>
        <div class="stat-card"><span class="stat-label">All Time</span><span class="stat-value" id="bk-exp-all">0.00 ETB</span></div>
      </div>
      <div class="panel-header flex-between" style="margin-top: 1rem;">
        <h3>Recent Expenses</h3>
        <select id="bk-exp-filter" onchange="BakeryModule.loadExpenses(this.value)">
          <option value="recent">Recent</option>
          <option value="date">Specific Date</option>
          <option value="month">This Month</option>
          <option value="all">All</option>
        </select>
      </div>
      <div id="bk-exp-date-filter-container" class="hidden" style="margin-bottom: 1rem;">
         <input type="date" id="bk-exp-filter-date" onchange="BakeryModule.loadExpenses('date')">
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Branch</th><th>Category</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody id="bk-expenses-tbody"></tbody>
        </table>
      </div>
    `;
  },

  getReportsHTML: function() {
    return `
      <div class="panel-header"><h2>Reports</h2></div>
      <div class="form-row">
        <div class="form-group">
          <label>Timeframe</label>
          <select id="bk-report-timeframe" onchange="BakeryModule.loadReportData()">
            <option value="daily">Daily (Today)</option>
            <option value="monthly">Monthly (This Month)</option>
            <option value="yearly">Yearly (This Year)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Branch Filter</label>
          <select id="bk-report-branch" onchange="BakeryModule.loadReportData()">
            <option value="all">All Branches</option>
          </select>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-label">Revenue</span><span class="stat-value" id="bk-rep-revenue">0.00</span></div>
        <div class="stat-card"><span class="stat-label">Expenses</span><span class="stat-value text-danger" id="bk-rep-expenses">0.00</span></div>
        <div class="stat-card"><span class="stat-label">Profit</span><span class="stat-value text-success" id="bk-rep-profit">0.00</span></div>
        <div class="stat-card"><span class="stat-label">Unpaid</span><span class="stat-value" id="bk-rep-unpaid">0.00</span></div>
        <div class="stat-card"><span class="stat-label">Cash</span><span class="stat-value" id="bk-rep-cash">0.00</span></div>
        <div class="stat-card"><span class="stat-label">Transfer</span><span class="stat-value" id="bk-rep-transfer">0.00</span></div>
      </div>
      <h3 class="section-title">Top Selling Items</h3>
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
          <tbody id="bk-rep-top-items"></tbody>
        </table>
      </div>
      <div class="flex-between" style="margin-top: 1rem;">
        <button class="btn btn-secondary" onclick="BakeryModule.exportReportCSV()">Export CSV</button>
        <button class="btn btn-secondary" onclick="window.print()">Print</button>
      </div>
    `;
  },

  getSettingsHTML: function() {
    return `
      <div class="panel-header"><h2>Settings</h2></div>
      <form id="bk-settings-form" onsubmit="BakeryModule.saveSettings(event)">
        <div class="form-group"><label>Business Name</label><input type="text" id="bk-set-name"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="bk-set-phone"></div>
        <div class="form-group"><label>Low Stock Threshold</label><input type="number" id="bk-set-threshold" value="10"></div>
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
      
      <h3 class="section-title" style="margin-top: 2rem;">Branches Management</h3>
      <div class="form-row">
        <input type="text" id="bk-new-branch" placeholder="New Branch Name">
        <button class="btn btn-secondary" onclick="BakeryModule.addBranch()">+ Add Branch</button>
      </div>
      <ul id="bk-branches-list" class="list-group"></ul>
    `;
  },

  // ═══════════════════════════════════════════
  // 🔄 DATA FETCHING & RENDERING
  // ═══════════════════════════════════════════
  
  loadSettings: async function() {
    try {
      const docRef = doc(db, 'tenants', this._state.tenantId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        this._state.settings = data;
        this._state.branches = data.branches || ['Main Branch'];
        this._state.threshold = data.lowStockThreshold || 10;
        this.populateBranchesDropdowns();
      }
    } catch (e) { console.error("Error loading settings:", e); }
  },

  loadItems: async function() {
    try {
      const q = query(collection(db, 'items'), where('tenantId', '==', this._state.tenantId));
      const snapshot = await getDocs(q);
      this._state.items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error("Error loading items:", e); }
  },

  populateBranchesDropdowns: function() {
    const branchOptions = this._state.branches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    ['bk-item-branch', 'bk-sale-branch', 'bk-qs-branch', 'bk-exp-branch'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = branchOptions;
    });
    const repBranch = document.getElementById('bk-report-branch');
    if (repBranch) repBranch.innerHTML = `<option value="all">All Branches</option>${branchOptions}`;
  },

  renderItems: async function() {
    await this.loadItems();
    const tbody = document.getElementById('bk-items-tbody');
    if (!tbody) return;
    
    let totalQty = 0, totalVal = 0;
    tbody.innerHTML = this._state.items.map(item => {
      totalQty += item.stock || 0;
      totalVal += (item.stock || 0) * (item.price || 0);
      const isLow = item.stock <= this._state.threshold;
      return `
        <tr>
          <td>${esc(item.name)} ${isLow ? '<span class="badge badge-danger">Low Stock</span>' : ''}</td>
          <td>${esc(item.category)}</td>
          <td>${money(item.price)}</td>
          <td>${item.stock || 0}</td>
          <td><button class="btn btn-sm btn-secondary" onclick="BakeryModule.deleteItem('${item.id}')">Delete</button></td>
        </tr>
      `;
    }).join('');
    
    document.getElementById('bk-total-qty').textContent = totalQty;
    document.getElementById('bk-stock-value').textContent = money(totalVal) + ' ETB';
  },

  renderSalesUI: function() {
    const select = document.getElementById('bk-sale-item-select');
    if (!select) return;
    select.innerHTML = this._state.items.map(i => `<option value="${i.id}">${esc(i.name)} - ${money(i.price)} ETB (Stock: ${i.stock})</option>`).join('');
    this.renderCart();
    document.getElementById('bk-sale-date').value = todayStr();
  },

  renderCart: function() {
    const tbody = document.getElementById('bk-cart-tbody');
    let total = 0;
    tbody.innerHTML = this._state.cart.map((item, index) => {
      const lineTotal = item.price * item.qty;
      total += lineTotal;
      return `
        <tr>
          <td>${esc(item.name)}</td>
          <td>${money(item.price)}</td>
          <td>${item.qty}</td>
          <td>${money(lineTotal)}</td>
          <td><button class="btn btn-sm btn-danger" onclick="BakeryModule.removeFromCart(${index})">Remove</button></td>
        </tr>
      `;
    }).join('');
    document.getElementById('bk-cart-total').textContent = money(total) + ' ETB';
    this.updateUnpaidBalance();
  },

  updateUnpaidBalance: function() {
    const total = this._state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const paid = parseFloat(document.getElementById('bk-sale-paid').value) || 0;
    const unpaid = Math.max(0, total - paid);
    document.getElementById('bk-cart-unpaid').textContent = money(unpaid) + ' ETB';
  },

  renderPurchasesUI: async function() {
    const select = document.getElementById('bk-purch-item');
    if (!select) return;
    select.innerHTML = this._state.items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
    
    // Load recent purchases
    const q = query(collection(db, 'purchases'), where('tenantId', '==', this._state.tenantId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const tbody = document.getElementById('bk-purchases-tbody');
    tbody.innerHTML = snapshot.docs.slice(0, 10).map(d => {
      const p = d.data();
      return `<tr><td>${p.date}</td><td>${esc(p.itemName)}</td><td>${p.qty}</td><td>${money(p.qty * p.cost)} ETB</td></tr>`;
    }).join('');
  },

  renderExpensesUI: async function() {
    await this.loadExpenses('recent');
    await this.updateExpenseSummaries();
  },

  loadExpenses: async function(filterType) {
    const dateFilter = document.getElementById('bk-exp-date-filter-container');
    if (filterType === 'date') {
      dateFilter.classList.remove('hidden');
      const specificDate = document.getElementById('bk-exp-filter-date').value;
      if (!specificDate) return; // wait for date selection
      this._fetchExpenses('date', specificDate);
    } else {
      dateFilter.classList.add('hidden');
      this._fetchExpenses(filterType);
    }
  },

  _fetchExpenses: async function(type, val) {
    let q = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId), orderBy('date', 'desc'));
    if (type === 'date') q = query(q, where('date', '==', val));
    else if (type === 'month') q = query(q, where('date', '>=', thisMonthStr() + '-01'));
    
    if (type === 'recent') q = query(q, orderBy('date', 'desc')); // Limit on client side
    
    const snap = await getDocs(q);
    const tbody = document.getElementById('bk-expenses-tbody');
    let docs = snap.docs;
    if (type === 'recent') docs = docs.slice(0, 10);
    
    tbody.innerHTML = docs.map(d => {
      const e = d.data();
      return `<tr><td>${e.date}</td><td>${esc(e.branch)}</td><td>${esc(e.category)}</td><td>${money(e.amount)} ETB</td><td>${esc(e.note || '')}</td></tr>`;
    }).join('');
  },

  updateExpenseSummaries: async function() {
    const qAll = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId));
    const snapAll = await getDocs(qAll);
    let allTotal = 0, monthTotal = 0;
    const currentMonth = thisMonthStr();
    snapAll.forEach(d => {
      const exp = d.data();
      allTotal += exp.amount;
      if (exp.date.startsWith(currentMonth)) monthTotal += exp.amount;
    });
    document.getElementById('bk-exp-month').textContent = money(monthTotal) + ' ETB';
    document.getElementById('bk-exp-all').textContent = money(allTotal) + ' ETB';
  },

  renderReportsUI: function() {
    this.loadReportData();
  },

  renderSettingsUI: function() {
    document.getElementById('bk-set-name').value = this._state.settings.name || '';
    document.getElementById('bk-set-phone').value = this._state.settings.phone || '';
    document.getElementById('bk-set-threshold').value = this._state.threshold;
    this.renderBranchesList();
  },

  renderBranchesList: function() {
    const list = document.getElementById('bk-branches-list');
    if (!list) return;
    list.innerHTML = this._state.branches.map(b => `<li class="list-group-item">${esc(b)}</li>`).join('');
  },

  loadDashboardStats: async function() {
    const today = todayStr();
    // Sales
    const qSales = query(collection(db, 'sales'), where('tenantId', '==', this._state.tenantId), where('date', '==', today));
    const snapSales = await getDocs(qSales);
    let totalSales = 0;
    snapSales.forEach(d => { totalSales += d.data().total || 0; });

    // Expenses
    const qExp = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId), where('date', '==', today));
    const snapExp = await getDocs(qExp);
    let totalExp = 0;
    snapExp.forEach(d => { totalExp += d.data().amount || 0; });

    document.getElementById('bk-stat-sales').textContent = money(totalSales) + ' ETB';
    document.getElementById('bk-stat-expenses').textContent = money(totalExp) + ' ETB';
    document.getElementById('bk-stat-profit').textContent = money(totalSales - totalExp) + ' ETB';
  },

  // ═══════════════════════════════════════════
  // 💾 CRUD OPERATIONS
  // ═══════════════════════════════════════════

  openAddItemModal: function() {
    document.getElementById('bk-add-item-form').reset();
    document.getElementById('bk-add-item-modal').classList.remove('hidden');
  },

  saveNewItem: async function(e) {
    e.preventDefault();
    const newItem = {
      tenantId: this._state.tenantId,
      branch: document.getElementById('bk-item-branch').value,
      category: document.getElementById('bk-item-category').value,
      name: document.getElementById('bk-item-name').value,
      price: parseFloat(document.getElementById('bk-item-price').value),
      stock: parseInt(document.getElementById('bk-item-stock').value),
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'items'), newItem);
      showToast('Item saved successfully');
      document.getElementById('bk-add-item-modal').classList.add('hidden');
      this.renderItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  deleteItem: async function(id) {
    if(!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'items', id));
      showToast('Item deleted');
      this.renderItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  addToCart: function() {
    const itemId = document.getElementById('bk-sale-item-select').value;
    const qty = parseInt(document.getElementById('bk-sale-qty').value);
    const item = this._state.items.find(i => i.id === itemId);
    if (!item || qty <= 0) return;
    if (item.stock < qty) return showToast('Not enough stock!', 'error');

    const existing = this._state.cart.find(c => c.id === itemId);
    if (existing) existing.qty += qty;
    else this._state.cart.push({ id: item.id, name: item.name, price: item.price, qty: qty });
    
    this.renderCart();
  },

  removeFromCart: function(index) {
    this._state.cart.splice(index, 1);
    this.renderCart();
  },

  clearCart: function() {
    this._state.cart = [];
    this.renderCart();
  },

  completeSale: async function() {
    if (this._state.cart.length === 0) return showToast('Cart is empty', 'error');
    const total = this._state.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const paid = parseFloat(document.getElementById('bk-sale-paid').value) || 0;
    
    const saleData = {
      tenantId: this._state.tenantId,
      date: document.getElementById('bk-sale-date').value,
      branch: document.getElementById('bk-sale-branch').value,
      paymentType: document.getElementById('bk-sale-payment').value,
      items: this._state.cart,
      total: total,
      paid: paid,
      unpaid: total - paid,
      createdAt: serverTimestamp()
    };

    try {
      // 1. Save Sale
      await addDoc(collection(db, 'sales'), saleData);
      
      // 2. Deduct Stock
      for (let item of this._state.cart) {
        const itemRef = doc(db, 'items', item.id);
        await updateDoc(itemRef, { stock: increment(-item.qty) });
      }
      
      showToast('Sale completed successfully');
      this.clearCart();
      document.getElementById('bk-sale-paid').value = '';
      await this.loadItems(); // Refresh local items stock
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveQuickSale: async function(e) {
    e.preventDefault();
    const saleData = {
      tenantId: this._state.tenantId,
      date: document.getElementById('bk-qs-date').value,
      category: document.getElementById('bk-qs-category').value,
      branch: document.getElementById('bk-qs-branch').value,
      total: parseFloat(document.getElementById('bk-qs-amount').value),
      isQuick: true,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'sales'), saleData);
      showToast('Income added successfully');
      e.target.reset();
      document.getElementById('bk-qs-date').value = todayStr();
    } catch (err) { showToast(err.message, 'error'); }
  },

  savePurchase: async function(e) {
    e.preventDefault();
    const itemId = document.getElementById('bk-purch-item').value;
    const qty = parseInt(document.getElementById('bk-purch-qty').value);
    const cost = parseFloat(document.getElementById('bk-purch-cost').value);
    const itemName = this._state.items.find(i => i.id === itemId)?.name || 'Unknown';
    
    try {
      await addDoc(collection(db, 'purchases'), {
        tenantId: this._state.tenantId,
        itemId, itemName, qty, cost,
        date: document.getElementById('bk-purch-date').value,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'items', itemId), { stock: increment(qty) });
      showToast('Purchase recorded and stock updated');
      e.target.reset();
      document.getElementById('bk-purch-date').value = todayStr();
      this.renderPurchasesUI();
      await this.loadItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveExpense: async function(e) {
    e.preventDefault();
    const expData = {
      tenantId: this._state.tenantId,
      branch: document.getElementById('bk-exp-branch').value,
      category: document.getElementById('bk-exp-category').value,
      amount: parseFloat(document.getElementById('bk-exp-amount').value),
      date: document.getElementById('bk-exp-date').value,
      note: document.getElementById('bk-exp-note').value,
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'expenses'), expData);
      showToast('Expense saved');
      e.target.reset();
      document.getElementById('bk-exp-date').value = todayStr();
      this.renderExpensesUI();
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveSettings: async function(e) {
    e.preventDefault();
    const name = document.getElementById('bk-set-name').value;
    const phone = document.getElementById('bk-set-phone').value;
    const threshold = parseInt(document.getElementById('bk-set-threshold').value);
    
    try {
      await updateDoc(doc(db, 'tenants', this._state.tenantId), {
        name, phone, lowStockThreshold: threshold
      });
      this._state.settings.name = name;
      this._state.settings.phone = phone;
      this._state.threshold = threshold;
      showToast('Settings saved');
      document.getElementById('hdrBusinessName').textContent = name;
    } catch (err) { showToast(err.message, 'error'); }
  },

  addBranch: async function() {
    const input = document.getElementById('bk-new-branch');
    const branchName = input.value.trim();
    if (!branchName) return;
    
    const newBranches = [...this._state.branches, branchName];
    try {
      await updateDoc(doc(db, 'tenants', this._state.tenantId), { branches: newBranches });
      this._state.branches = newBranches;
      this.populateBranchesDropdowns();
      this.renderBranchesList();
      input.value = '';
      showToast('Branch added');
    } catch (err) { showToast(err.message, 'error'); }
  },

  // ═══════════════════════════════════════════
  // 📊 REPORTING LOGIC
  // ═══════════════════════════════════════════
  loadReportData: async function() {
    const timeframe = document.getElementById('bk-report-timeframe').value;
    const branch = document.getElementById('bk-report-branch').value;
    
    let dateCondition = '';
    if (timeframe === 'daily') dateCondition = todayStr();
    else if (timeframe === 'monthly') dateCondition = thisMonthStr();
    else if (timeframe === 'yearly') dateCondition = thisYearStr();

    // Fetch Sales
    let qSales = query(collection(db, 'sales'), where('tenantId', '==', this._state.tenantId));
    if (branch !== 'all') qSales = query(qSales, where('branch', '==', branch));
    // Note: For optimal performance, date filtering should be done via Firestore queries (using >= and <=)
    // But since dates are strings (YYYY-MM-DD), we filter in JS for simplicity in this snippet.
    
    const snapSales = await getDocs(qSales);
    const allSales = snapSales.docs.map(d => d.data()).filter(s => s.date.startsWith(dateCondition));

    // Fetch Expenses
    let qExp = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId));
    if (branch !== 'all') qExp = query(qExp, where('branch', '==', branch));
    const snapExp = await getDocs(qExp);
    const allExp = snapExp.docs.map(d => d.data()).filter(e => e.date.startsWith(dateCondition));

    // Calculations
    let revenue = 0, unpaid = 0, cash = 0, transfer = 0;
    const itemSales = {}; // { itemName: { qty, revenue } }

    allSales.forEach(s => {
      revenue += s.total || 0;
      unpaid += s.unpaid || 0;
      if (s.paymentType === 'cash') cash += s.total || 0;
      else if (s.paymentType === 'transfer') transfer += s.total || 0;
      
      if (s.items) {
        s.items.forEach(it => {
          if (!itemSales[it.name]) itemSales[it.name] = { qty: 0, rev: 0 };
          itemSales[it.name].qty += it.qty;
          itemSales[it.name].rev += (it.price * it.qty);
        });
      }
    });

    let expenses = 0;
    allExp.forEach(e => { expenses += e.amount || 0; });

    document.getElementById('bk-rep-revenue').textContent = money(revenue) + ' ETB';
    document.getElementById('bk-rep-expenses').textContent = money(expenses) + ' ETB';
    document.getElementById('bk-rep-profit').textContent = money(revenue - expenses) + ' ETB';
    document.getElementById('bk-rep-unpaid').textContent = money(unpaid) + ' ETB';
    document.getElementById('bk-rep-cash').textContent = money(cash) + ' ETB';
    document.getElementById('bk-rep-transfer').textContent = money(transfer) + ' ETB';

    // Top Items
    const sortedItems = Object.entries(itemSales).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
    document.getElementById('bk-rep-top-items').innerHTML = sortedItems.map(([name, data], idx) => `
      <tr><td>${idx + 1}</td><td>${esc(name)}</td><td>${data.qty}</td><td>${money(data.rev)} ETB</td></tr>
    `).join('');

    // Store data for CSV export
    this._state.reportData = { timeframe, branch, revenue, expenses, profit: revenue - expenses, unpaid, cash, transfer, sortedItems };
  },

  exportReportCSV: function() {
    if (!this._state.reportData) return showToast('No data to export', 'warning');
    const d = this._state.reportData;
    
    let csv = "Metric,Value (ETB)\n";
    csv += `Revenue,${d.revenue}\nExpenses,${d.expenses}\nProfit,${d.profit}\nUnpaid,${d.unpaid}\nCash,${d.cash}\nTransfer,${d.transfer}\n\n`;
    csv += "Top Selling Items\n#,Item,Qty,Revenue\n";
    d.sortedItems.forEach(([name, data], i) => {
      csv += `${i+1},${name},${data.qty},${data.rev}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${d.timeframe}_${Date.now()}.csv`;
    link.click();
  }
};

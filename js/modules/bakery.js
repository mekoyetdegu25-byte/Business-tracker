// js/modules/bakery.js
import { db, auth } from '../firebase.js';
import { 
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, 
  query, where, orderBy, serverTimestamp, getDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { showToast, esc, money, todayStr, thisMonthStr, thisYearStr, state } from '../core.js';

// ═══════════════════════════════════════════
// 🏗️ BAKERY MODULE DEFINITION
// ═══════════════════════════════════════════
export const BakeryModule = {
  id: 'bakery',
  name: 'Bakery Manager',
  icon: '🍞',
  
  // Local state to manage UI before syncing with Firestore
  _state: {
    items: [],
    branches: [],
    settings: {},
    cart: [],
    threshold: 10,
    reportData: null,
    currentPanel: 'home'
  },

  // Main initialization called by core.js
  init: async function(appState) {
    this._state.tenantId = appState.tenantId;
    this._state.userEmail = appState.user?.email || 'user@email.com';
    this._state.role = appState.role || 'owner';
    
    // Load initial data from Firestore
    await this.loadSettings();
    await this.loadItems();
    
    // Build the interface
    this.buildInterface();
    
    // Default to Home view
    this.navigateTo('home');
  },

  cleanup: function() {
    this._state.cart = [];
    this._state.reportData = null;
  },

  // ═══════════════════════════════════════════
  // 🎨 UI CONSTRUCTION (Strictly matching requirements)
  // ═══════════════════════════════════════════
  buildInterface: function() {
    // 1. Build Top Header & Navigation
    const headerHTML = `
      <div class="app-header" style="display:flex; flex-direction:column; gap:8px; padding: 10px; background: var(--surface-color);">
        <!-- Brand Header -->
        <div class="brand-bar" style="display:flex; justify-content:space-between; align-items:center;">
          <div class="brand" style="font-weight:bold; font-size:1.2rem; color: var(--primary-color);">
            🍞 HaniTech <span style="font-size:0.9rem; color: var(--text-muted); font-weight:normal;">| Bakery Manager</span>
          </div>
        </div>
        
        <!-- User/Business Bar -->
        <div class="user-bar" style="display:flex; align-items:center; gap:12px; font-size:0.85rem; overflow-x:auto; white-space:nowrap; padding-bottom:5px; border-bottom: 1px solid var(--border-color);">
          <div class="avatar" style="background: var(--primary-color); color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">U</div>
          <div><strong>Bakery Business</strong> (${esc(this._state.userEmail)})</div>
          <select id="hdr-branch-select" class="form-control" style="width:auto; padding:2px 8px; border-radius:4px;">
            <option value="all">Home ▼</option>
          </select>
          <span class="badge" style="background:var(--warning-bg); color:var(--warning-text); padding:2px 8px; border-radius:12px;">👑 Owner</span>
          <button class="btn-icon" onclick="window.logout()" title="Sign Out" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">🚪</button>
        </div>

        <!-- Main Navigation Tabs -->
        <div class="main-nav" style="display:flex; gap:8px; overflow-x:auto; padding-top:5px;">
          <button class="nav-tab active" onclick="BakeryModule.navigateTo('home', this)" data-nav="home">🏠 Home</button>
          <button class="nav-tab" onclick="BakeryModule.navigateTo('new-sale', this)" data-nav="new-sale">🛒 New Sale</button>
          <button class="nav-tab" onclick="BakeryModule.navigateTo('quick-sale', this)" data-nav="quick-sale">⚡ Quick</button>
          <button class="nav-tab" onclick="BakeryModule.navigateTo('items', this)" data-nav="items">🍞 Items</button>
          <button class="nav-tab" onclick="BakeryModule.navigateTo('reports', this)" data-nav="reports">📊 Reports</button>
          <div class="dropdown" style="position:relative;">
            <button class="nav-tab" onclick="document.getElementById('more-menu').classList.toggle('show')">⚙ More ▼</button>
            <div id="more-menu" class="dropdown-menu" style="display:none; position:absolute; top:100%; right:0; background:var(--surface-color); border:1px solid var(--border-color); border-radius:6px; z-index:10; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <button class="dropdown-item" onclick="BakeryModule.navigateTo('purchases')" style="display:block; width:100%; text-align:left; padding:8px 16px; border:none; background:none;">📥 Purchases</button>
              <button class="dropdown-item" onclick="BakeryModule.navigateTo('expenses')" style="display:block; width:100%; text-align:left; padding:8px 16px; border:none; background:none;">💸 Expenses</button>
              <button class="dropdown-item" onclick="BakeryModule.navigateTo('settings')" style="display:block; width:100%; text-align:left; padding:8px 16px; border:none; background:none;">⚙ Settings</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 2. Build All Views (Panels)
    const viewsHTML = `
      <div id="bk-views-container" style="padding: 15px;">
        ${this.getHomeView()}
        ${this.getItemsView()}
        ${this.getNewSaleView()}
        ${this.getQuickSaleView()}
        ${this.getPurchasesView()}
        ${this.getExpensesView()}
        ${this.getReportsView()}
        ${this.getSettingsView()}
      </div>
    `;

    // Inject into the main app container (provided by core.js)
    const appContainer = document.getElementById('modulePanels');
    if (appContainer) {
      appContainer.innerHTML = headerHTML + viewsHTML;
    }

    // Add event listener to close the 'More' dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const moreMenu = document.getElementById('more-menu');
      if (moreMenu && !e.target.closest('.dropdown')) {
        moreMenu.style.display = 'none';
      }
    });
  },

  // ═══════════════════════════════════════════
  // 📱 VIEW TEMPLATES (Strict Layout)
  // ═══════════════════════════════════════════

  getHomeView: function() {
    return `
      <div id="view-home" class="bk-view hidden">
        <h3 class="section-title">📅 Today's Summary</h3>
        <div class="stats-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:20px;">
          <div class="stat-card" style="padding:15px; background:var(--surface-color); border-radius:8px; text-align:center;">
            <div style="font-size:0.8rem; color:var(--text-muted);">Sales</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--success-text);" id="bk-dash-sales">0.00</div>
          </div>
          <div class="stat-card" style="padding:15px; background:var(--surface-color); border-radius:8px; text-align:center;">
            <div style="font-size:0.8rem; color:var(--text-muted);">Expenses</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--danger-text);" id="bk-dash-expenses">0.00</div>
          </div>
          <div class="stat-card" style="padding:15px; background:var(--surface-color); border-radius:8px; text-align:center;">
            <div style="font-size:0.8rem; color:var(--text-muted);">Profit</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--primary-color);" id="bk-dash-profit">0.00</div>
          </div>
        </div>

        <h3 class="section-title">⚡ Quick Actions</h3>
        <div class="quick-actions-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;">
          <button class="qa-btn" onclick="BakeryModule.navigateTo('new-sale')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">🛒 New Sale</button>
          <button class="qa-btn" onclick="BakeryModule.navigateTo('quick-sale')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">⚡ Quick Sale</button>
          <button class="qa-btn" onclick="BakeryModule.navigateTo('items')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">🍞 Items (Stock)</button>
          <button class="qa-btn" onclick="BakeryModule.navigateTo('purchases')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">📥 Purchases</button>
          <button class="qa-btn" onclick="BakeryModule.navigateTo('expenses')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">💸 Expenses</button>
          <button class="qa-btn" onclick="BakeryModule.navigateTo('reports')" style="padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-color); cursor:pointer;">📊 Reports</button>
        </div>
      </div>
    `;
  },

  getItemsView: function() {
    return `
      <div id="view-items" class="bk-view hidden">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h3 class="section-title" style="margin:0;">🍞 Bakery Items</h3>
          <button class="btn btn-primary" onclick="document.getElementById('modal-add-item').style.display='flex'">➕ Add Item</button>
        </div>
        
        <div class="stats-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
          <div class="stat-card" style="padding:15px; background:var(--surface-color); border-radius:8px;">
            <div style="font-size:0.8rem; color:var(--text-muted);">Total Quantity</div>
            <div style="font-size:1.2rem; font-weight:bold;" id="bk-item-total-qty">0</div>
          </div>
          <div class="stat-card" style="padding:15px; background:var(--surface-color); border-radius:8px;">
            <div style="font-size:0.8rem; color:var(--text-muted);">Stock Value (ETB)</div>
            <div style="font-size:1.2rem; font-weight:bold;" id="bk-item-total-val">0.00</div>
          </div>
        </div>

        <div class="table-responsive" style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding:10px;">Item</th><th style="padding:10px;">Category</th><th style="padding:10px;">Price (ETB)</th><th style="padding:10px;">Stock</th><th style="padding:10px;">Actions</th>
            </tr></thead>
            <tbody id="bk-items-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- Add Item Modal -->
      <div id="modal-add-item" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:100; align-items:center; justify-content:center;">
        <div class="modal-content" style="background:var(--surface-color); padding:20px; border-radius:8px; width:90%; max-width:400px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <h3 style="margin:0;">➕ Add Item</h3>
            <button onclick="document.getElementById('modal-add-item').style.display='none'" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">×</button>
          </div>
          <form id="form-add-item" onsubmit="BakeryModule.saveNewItem(event)">
            <div class="form-group" style="margin-bottom:10px;"><label>🏢 Branch *</label><select id="ai-branch" class="form-control" style="width:100%;" required></select></div>
            <div class="form-group" style="margin-bottom:10px;"><label>📁 Category *</label><input type="text" id="ai-category" class="form-control" style="width:100%;" required placeholder="e.g. Bread"></div>
            <div class="form-group" style="margin-bottom:10px;"><label>🍞 Item Name *</label><input type="text" id="ai-name" class="form-control" style="width:100%;" required></div>
            <div class="form-group" style="margin-bottom:10px;"><label>💰 Price (ETB) *</label><input type="number" step="0.01" id="ai-price" class="form-control" style="width:100%;" required></div>
            <div class="form-group" style="margin-bottom:15px;"><label>📦 Initial Stock (Qty) *</label><input type="number" id="ai-stock" class="form-control" style="width:100%;" required></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">💾 Save</button>
          </form>
        </div>
      </div>
    `;
  },

  getNewSaleView: function() {
    return `
      <div id="view-new-sale" class="bk-view hidden">
        <h3 class="section-title">🛒 New Sale</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
          <div class="form-group"><label>🏢 Branch *</label><select id="ns-branch" class="form-control" style="width:100%;"></select></div>
          <div class="form-group"><label>📅 Date *</label><input type="date" id="ns-date" class="form-control" style="width:100%;" value="${todayStr()}"></div>
        </div>

        <div style="background:var(--surface-color); padding:10px; border-radius:8px; margin-bottom:15px;">
          <div style="display:flex; gap:10px; align-items:flex-end;">
            <div style="flex:1;"><label>Select Item</label><select id="ns-item-select" class="form-control" style="width:100%;"></select></div>
            <div style="width:80px;"><label>Qty</label><input type="number" id="ns-item-qty" class="form-control" value="1" min="1" style="width:100%;"></div>
            <button class="btn btn-secondary" onclick="BakeryModule.addToCart()">Add</button>
          </div>
        </div>

        <div class="table-responsive" style="overflow-x:auto; margin-bottom:15px;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding:10px;">Item</th><th style="padding:10px;">Price</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Total</th><th style="padding:10px;">Action</th>
            </tr></thead>
            <tbody id="ns-cart-tbody"></tbody>
          </table>
        </div>

        <div style="background:var(--surface-color); padding:15px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:10px;">
            <span>Total:</span><span id="ns-total">0.00 ETB</span>
          </div>
          
          <div class="form-group" style="margin-bottom:10px;">
            <label>💳 Payment Type</label>
            <div style="display:flex; gap:10px;">
              <label><input type="radio" name="ns-payment" value="cash" checked> 💵 Cash</label>
              <label><input type="radio" name="ns-payment" value="transfer"> 🏦 Transfer</label>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:10px;">
            <label>💰 Paid Amount</label>
            <input type="number" step="0.01" id="ns-paid" class="form-control" style="width:100%;" oninput="BakeryModule.updateUnpaid()">
          </div>

          <div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--danger-text); margin-bottom:15px;">
            <span>📝 Unpaid:</span><span id="ns-unpaid">0.00 ETB</span>
          </div>

          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary" style="flex:1;" onclick="BakeryModule.completeSale()">💸 Complete Sale</button>
            <button class="btn btn-secondary" onclick="BakeryModule.clearCart()">🗑 Clear</button>
          </div>
        </div>
      </div>
    `;
  },

  getQuickSaleView: function() {
    return `
      <div id="view-quick-sale" class="bk-view hidden">
        <h3 class="section-title">⚡ Quick Sale (Direct Income)</h3>
        <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:15px;">💡 ያለ ምርት ምርጫ በቀጥታ ጠቅላላ ገቢ ለመመዝገብ።</p>
        
        <form id="form-quick-sale" onsubmit="BakeryModule.saveQuickSale(event)" style="background:var(--surface-color); padding:15px; border-radius:8px;">
          <div class="form-group" style="margin-bottom:10px;"><label>📅 Date</label><input type="date" id="qs-date" class="form-control" style="width:100%;" value="${todayStr()}" required></div>
          <div class="form-group" style="margin-bottom:10px;"><label>📁 Category</label><input type="text" id="qs-category" class="form-control" style="width:100%;" placeholder="e.g. Direct Bread Sale" required></div>
          <div class="form-group" style="margin-bottom:10px;"><label>🏢 Branch</label><select id="qs-branch" class="form-control" style="width:100%;"></select></div>
          <div class="form-group" style="margin-bottom:15px;"><label>💰 Amount (ETB)</label><input type="number" step="0.01" id="qs-amount" class="form-control" style="width:100%;" required></div>
          <button type="submit" class="btn btn-primary" style="width:100%;">+ Add Income</button>
        </form>
      </div>
    `;
  },

  getPurchasesView: function() {
    return `
      <div id="view-purchases" class="bk-view hidden">
        <h3 class="section-title">📥 Purchases (Stock In)</h3>
        
        <form id="form-purchase" onsubmit="BakeryModule.savePurchase(event)" style="background:var(--surface-color); padding:15px; border-radius:8px; margin-bottom:15px;">
          <div class="form-group" style="margin-bottom:10px;"><label>🍞 Item *</label><select id="p-item" class="form-control" style="width:100%;" required></select></div>
          <div class="form-group" style="margin-bottom:10px;"><label>📅 Date *</label><input type="date" id="p-date" class="form-control" style="width:100%;" value="${todayStr()}" required></div>
          <div class="form-group" style="margin-bottom:10px;"><label>📦 Quantity Added *</label><input type="number" id="p-qty" class="form-control" style="width:100%;" required></div>
          <div class="form-group" style="margin-bottom:15px;"><label>💰 Cost per Item (ETB) *</label><input type="number" step="0.01" id="p-cost" class="form-control" style="width:100%;" required></div>
          <button type="submit" class="btn btn-primary" style="width:100%;">💾 Save Purchase</button>
        </form>

        <h4 class="section-title">📋 Recent Purchases</h4>
        <div class="table-responsive" style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding:10px;">Date</th><th style="padding:10px;">Item</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Total Cost</th>
            </tr></thead>
            <tbody id="purchases-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  },

  getExpensesView: function() {
    return `
      <div id="view-expenses" class="bk-view hidden">
        <h3 class="section-title">💸 Expenses</h3>
        
        <h4 class="section-title">➕ Add Expense</h4>
        <form id="form-expense" onsubmit="BakeryModule.saveExpense(event)" style="background:var(--surface-color); padding:15px; border-radius:8px; margin-bottom:15px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div class="form-group"><label>🏢 Branch *</label><select id="e-branch" class="form-control" style="width:100%;" required></select></div>
            <div class="form-group"><label>📁 Category *</label><input type="text" id="e-category" class="form-control" style="width:100%;" required></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div class="form-group"><label>💰 Amount (ETB) *</label><input type="number" step="0.01" id="e-amount" class="form-control" style="width:100%;" required></div>
            <div class="form-group"><label>📅 Date *</label><input type="date" id="e-date" class="form-control" style="width:100%;" value="${todayStr()}" required></div>
          </div>
          <div class="form-group" style="margin-bottom:15px;"><label>📝 Note</label><input type="text" id="e-note" class="form-control" style="width:100%;"></div>
          <button type="submit" class="btn btn-primary" style="width:100%;">💾 Save Expense</button>
        </form>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h4 class="section-title" style="margin:0;">📋 Recent Expenses</h4>
          <div style="display:flex; gap:5px;">
            <button class="btn btn-sm btn-outline" onclick="BakeryModule.loadExpenses('recent')">Recent</button>
            <button class="btn btn-sm btn-outline" onclick="BakeryModule.loadExpenses('date')">Date</button>
            <button class="btn btn-sm btn-outline" onclick="BakeryModule.loadExpenses('month')">Month</button>
            <button class="btn btn-sm btn-outline" onclick="BakeryModule.loadExpenses('all')">All</button>
          </div>
        </div>

        <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px; text-align:center;">
            <div style="font-size:0.8rem; color:var(--text-muted);">This Month</div>
            <div style="font-weight:bold;" id="exp-sum-month">0.00</div>
          </div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px; text-align:center;">
            <div style="font-size:0.8rem; color:var(--text-muted);">All Time</div>
            <div style="font-weight:bold;" id="exp-sum-all">0.00</div>
          </div>
        </div>

        <div class="table-responsive" style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding:10px;">Date</th><th style="padding:10px;">Branch</th><th style="padding:10px;">Category</th><th style="padding:10px;">Amount</th>
            </tr></thead>
            <tbody id="expenses-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
  },

  getReportsView: function() {
    return `
      <div id="view-reports" class="bk-view hidden">
        <h3 class="section-title">📊 Reports</h3>
        
        <div style="display:flex; gap:10px; margin-bottom:15px;">
          <button class="btn btn-primary" onclick="BakeryModule.loadReportData('daily')">📅 Daily</button>
          <button class="btn btn-secondary" onclick="BakeryModule.loadReportData('monthly')">📆 Monthly</button>
          <button class="btn btn-secondary" onclick="BakeryModule.loadReportData('yearly')">📊 Yearly</button>
        </div>

        <div class="form-group" style="margin-bottom:15px;">
          <label>🏢 Branch Filter</label>
          <select id="rep-branch" class="form-control" style="width:100%;" onchange="BakeryModule.loadReportData()">
            <option value="all">📊 All Branches</option>
          </select>
        </div>

        <div class="stats-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:15px;">
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">Revenue</div><div style="font-weight:bold;" id="rep-revenue">0.00</div></div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">Expenses</div><div style="font-weight:bold; color:var(--danger-text);" id="rep-expenses">0.00</div></div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">Profit</div><div style="font-weight:bold; color:var(--success-text);" id="rep-profit">0.00</div></div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">Unpaid</div><div style="font-weight:bold;" id="rep-unpaid">0.00</div></div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">💵 Cash</div><div style="font-weight:bold;" id="rep-cash">0.00</div></div>
          <div class="stat-card" style="padding:10px; background:var(--surface-color); border-radius:8px;"><div style="font-size:0.8rem;">🏦 Transfer</div><div style="font-weight:bold;" id="rep-transfer">0.00</div></div>
        </div>

        <h4 class="section-title">🏆 Top Selling Items</h4>
        <div class="table-responsive" style="overflow-x:auto; margin-bottom:15px;">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border-color); text-align:left;">
              <th style="padding:10px;">#</th><th style="padding:10px;">Item</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Revenue</th>
            </tr></thead>
            <tbody id="rep-top-items"></tbody>
          </table>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" style="flex:1;" onclick="BakeryModule.exportReportCSV()">📥 CSV</button>
          <button class="btn btn-secondary" style="flex:1;" onclick="window.print()">🖨 Print</button>
        </div>
      </div>
    `;
  },

  getSettingsView: function() {
    return `
      <div id="view-settings" class="bk-view hidden">
        <h3 class="section-title">⚙ Settings</h3>
        
        <div style="background:var(--surface-color); padding:15px; border-radius:8px; margin-bottom:15px;">
          <form id="form-settings" onsubmit="BakeryModule.saveSettings(event)">
            <div class="form-group" style="margin-bottom:10px;"><label>🏢 Business Name</label><input type="text" id="set-name" class="form-control" style="width:100%;"></div>
            <div class="form-group" style="margin-bottom:10px;"><label>📞 Phone</label><input type="text" id="set-phone" class="form-control" style="width:100%;"></div>
            <div class="form-group" style="margin-bottom:15px;"><label>📦 Low Stock Threshold</label><input type="number" id="set-threshold" class="form-control" style="width:100%;" value="10"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">💾 Save Settings</button>
          </form>
        </div>

        <div style="background:var(--surface-color); padding:15px; border-radius:8px; margin-bottom:15px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0;">🏢 Branches PRO</h4>
            <button class="btn btn-sm btn-secondary" onclick="BakeryModule.addBranch()">➕ Add</button>
          </div>
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <input type="text" id="new-branch-name" class="form-control" style="flex:1;" placeholder="Branch Name">
          </div>
          <ul id="branches-list" style="list-style:none; padding:0; margin:0;"></ul>
        </div>

        <div style="background:var(--surface-color); padding:15px; border-radius:8px; margin-bottom:15px;">
          <h4 style="margin:0 0 10px 0;">🎨 Theme</h4>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" style="flex:1;" onclick="document.body.classList.remove('dark-mode')">☀ Light</button>
            <button class="btn btn-secondary" style="flex:1;" onclick="document.body.classList.add('dark-mode')">🌙 Dark</button>
          </div>
        </div>

        <div style="background:var(--surface-color); padding:15px; border-radius:8px;">
          <h4 style="margin:0 0 10px 0;">🚪 Account</h4>
          <button class="btn btn-danger" style="width:100%;" onclick="window.logout()">Sign Out</button>
        </div>
      </div>
    `;
  },

  // ═══════════════════════════════════════════
  // 🧭 NAVIGATION & ROUTING
  // ═══════════════════════════════════════════
  navigateTo: function(panelId, btnEl = null) {
    // 1. Hide all views
    document.querySelectorAll('.bk-view').forEach(v => v.classList.add('hidden'));
    
    // 2. Show target view
    const targetView = document.getElementById(`view-${panelId}`);
    if (targetView) targetView.classList.remove('hidden');

    // 3. Update nav tab styling
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    else {
      const match = document.querySelector(`.nav-tab[data-nav="${panelId}"]`);
      if (match) match.classList.add('active');
    }

    // Close 'More' dropdown if it's open
    const moreMenu = document.getElementById('more-menu');
    if (moreMenu) moreMenu.style.display = 'none';

    // 4. Load specific data based on view
    this._state.currentPanel = panelId;
    switch(panelId) {
      case 'home': this.loadDashboardStats(); break;
      case 'items': this.renderItems(); break;
      case 'new-sale': this.renderSalesUI(); break;
      case 'purchases': this.renderPurchasesUI(); break;
      case 'expenses': this.renderExpensesUI(); break;
      case 'reports': this.loadReportData(); break;
      case 'settings': this.renderSettingsUI(); break;
    }
  },

  // ═══════════════════════════════════════════
  // 💾 FIRESTORE & DATA LOGIC
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
        this.populateBranches();
      } else {
        // Default branch if none exists
        this._state.branches = ['Main Branch'];
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

  populateBranches: function() {
    const options = this._state.branches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    
    // Header branch dropdown
    const hdr = document.getElementById('hdr-branch-select');
    if (hdr) hdr.innerHTML = `<option value="all">Home ▼</option>` + options;

    // Form dropdowns
    ['ai-branch', 'ns-branch', 'qs-branch', 'p-branch', 'e-branch'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = options;
    });

    // Report filter
    const rep = document.getElementById('rep-branch');
    if (rep) rep.innerHTML = `<option value="all">📊 All Branches</option>` + options;
  },

  loadDashboardStats: async function() {
    const today = todayStr();
    try {
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

      document.getElementById('bk-dash-sales').textContent = money(totalSales);
      document.getElementById('bk-dash-expenses').textContent = money(totalExp);
      document.getElementById('bk-dash-profit').textContent = money(totalSales - totalExp);
    } catch(e) { console.error(e); }
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
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:10px;">${esc(item.name)} ${isLow ? '<span style="font-size:0.7rem; color:white; background:var(--danger-text); padding:2px 5px; border-radius:4px;">Low</span>' : ''}</td>
          <td style="padding:10px;">${esc(item.category)}</td>
          <td style="padding:10px;">${money(item.price)}</td>
          <td style="padding:10px;">${item.stock}</td>
          <td style="padding:10px;"><button class="btn btn-sm btn-danger" onclick="BakeryModule.deleteItem('${item.id}')">Delete</button></td>
        </tr>
      `;
    }).join('');

    document.getElementById('bk-item-total-qty').textContent = totalQty;
    document.getElementById('bk-item-total-val').textContent = money(totalVal);
  },

  renderSalesUI: function() {
    const select = document.getElementById('ns-item-select');
    if (!select) return;
    select.innerHTML = this._state.items.map(i => `<option value="${i.id}">${esc(i.name)} - ${money(i.price)} ETB (Stock: ${i.stock})</option>`).join('');
    this.renderCart();
  },

  renderCart: function() {
    const tbody = document.getElementById('ns-cart-tbody');
    if (!tbody) return;
    let total = 0;
    tbody.innerHTML = this._state.cart.map((item, index) => {
      const lineTotal = item.price * item.qty;
      total += lineTotal;
      return `
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:10px;">${esc(item.name)}</td>
          <td style="padding:10px;">${money(item.price)}</td>
          <td style="padding:10px;">${item.qty}</td>
          <td style="padding:10px;">${money(lineTotal)}</td>
          <td style="padding:10px;"><button class="btn btn-sm btn-danger" onclick="BakeryModule.removeFromCart(${index})">Remove</button></td>
        </tr>
      `;
    }).join('');
    document.getElementById('ns-total').textContent = money(total) + ' ETB';
    this.updateUnpaid();
  },

  updateUnpaid: function() {
    const total = this._state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const paid = parseFloat(document.getElementById('ns-paid').value) || 0;
    document.getElementById('ns-unpaid').textContent = money(Math.max(0, total - paid)) + ' ETB';
  },

  renderPurchasesUI: async function() {
    const select = document.getElementById('p-item');
    if (select) select.innerHTML = this._state.items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');

    const q = query(collection(db, 'purchases'), where('tenantId', '==', this._state.tenantId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const tbody = document.getElementById('purchases-tbody');
    if (!tbody) return;
    tbody.innerHTML = snapshot.docs.slice(0, 10).map(d => {
      const p = d.data();
      return `<tr style="border-bottom:1px solid var(--border-color);"><td style="padding:10px;">${p.date}</td><td style="padding:10px;">${esc(p.itemName)}</td><td style="padding:10px;">${p.qty}</td><td style="padding:10px;">${money(p.qty * p.cost)} ETB</td></tr>`;
    }).join('');
  },

  renderExpensesUI: async function() {
    await this.loadExpenses('recent');
    await this.updateExpenseSummaries();
  },

  loadExpenses: async function(filterType) {
    let q = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId), orderBy('date', 'desc'));
    
    // Filter logic
    if (filterType === 'date') {
      const d = prompt("Enter Date (YYYY-MM-DD):", todayStr());
      if (!d) return;
      q = query(q, where('date', '==', d));
    } else if (filterType === 'month') {
      q = query(q, where('date', '>=', thisMonthStr() + '-01'));
    }

    const snap = await getDocs(q);
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;
    
    let docs = snap.docs;
    if (filterType === 'recent') docs = docs.slice(0, 10);
    
    tbody.innerHTML = docs.map(d => {
      const e = d.data();
      return `<tr style="border-bottom:1px solid var(--border-color);"><td style="padding:10px;">${e.date}</td><td style="padding:10px;">${esc(e.branch)}</td><td style="padding:10px;">${esc(e.category)}</td><td style="padding:10px;">${money(e.amount)} ETB</td></tr>`;
    }).join('');
  },

  updateExpenseSummaries: async function() {
    const qAll = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId));
    const snap = await getDocs(qAll);
    let all = 0, month = 0;
    const cm = thisMonthStr();
    snap.forEach(d => {
      const e = d.data();
      all += e.amount || 0;
      if (e.date.startsWith(cm)) month += e.amount || 0;
    });
    document.getElementById('exp-sum-month').textContent = money(month);
    document.getElementById('exp-sum-all').textContent = money(all);
  },

  renderSettingsUI: function() {
    document.getElementById('set-name').value = this._state.settings.name || '';
    document.getElementById('set-phone').value = this._state.settings.phone || '';
    document.getElementById('set-threshold').value = this._state.threshold;
    
    const list = document.getElementById('branches-list');
    if (list) {
      list.innerHTML = this._state.branches.map(b => `<li style="padding:5px; border-bottom:1px solid var(--border-color);">${esc(b)}</li>`).join('');
    }
  },

  // ═══════════════════════════════════════════
  // ⚡ ACTIONS & CRUD
  // ═══════════════════════════════════════════

  saveNewItem: async function(e) {
    e.preventDefault();
    const newItem = {
      tenantId: this._state.tenantId,
      branch: document.getElementById('ai-branch').value,
      category: document.getElementById('ai-category').value,
      name: document.getElementById('ai-name').value,
      price: parseFloat(document.getElementById('ai-price').value),
      stock: parseInt(document.getElementById('ai-stock').value),
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, 'items'), newItem);
      showToast('Item saved successfully');
      document.getElementById('modal-add-item').style.display = 'none';
      document.getElementById('form-add-item').reset();
      this.renderItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  deleteItem: async function(id) {
    if(!confirm('Delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'items', id));
      showToast('Item deleted');
      this.renderItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  addToCart: function() {
    const itemId = document.getElementById('ns-item-select').value;
    const qty = parseInt(document.getElementById('ns-item-qty').value);
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
    document.getElementById('ns-paid').value = '';
    this.updateUnpaid();
  },

  completeSale: async function() {
    if (this._state.cart.length === 0) return showToast('Cart is empty', 'error');
    const total = this._state.cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const paid = parseFloat(document.getElementById('ns-paid').value) || 0;
    const paymentType = document.querySelector('input[name="ns-payment"]:checked').value;

    const saleData = {
      tenantId: this._state.tenantId,
      date: document.getElementById('ns-date').value,
      branch: document.getElementById('ns-branch').value,
      paymentType: paymentType,
      items: this._state.cart,
      total: total,
      paid: paid,
      unpaid: total - paid,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'sales'), saleData);
      for (let item of this._state.cart) {
        await updateDoc(doc(db, 'items', item.id), { stock: increment(-item.qty) });
      }
      showToast('Sale completed!');
      this.clearCart();
      await this.loadItems();
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveQuickSale: async function(e) {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'sales'), {
        tenantId: this._state.tenantId,
        date: document.getElementById('qs-date').value,
        category: document.getElementById('qs-category').value,
        branch: document.getElementById('qs-branch').value,
        total: parseFloat(document.getElementById('qs-amount').value),
        isQuick: true,
        createdAt: serverTimestamp()
      });
      showToast('Income recorded!');
      e.target.reset();
      document.getElementById('qs-date').value = todayStr();
    } catch (err) { showToast(err.message, 'error'); }
  },

  savePurchase: async function(e) {
    e.preventDefault();
    const itemId = document.getElementById('p-item').value;
    const qty = parseInt(document.getElementById('p-qty').value);
    const cost = parseFloat(document.getElementById('p-cost').value);
    const itemName = this._state.items.find(i => i.id === itemId)?.name || 'Unknown';

    try {
      await addDoc(collection(db, 'purchases'), {
        tenantId: this._state.tenantId,
        itemId, itemName, qty, cost,
        date: document.getElementById('p-date').value,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'items', itemId), { stock: increment(qty) });
      showToast('Purchase recorded!');
      e.target.reset();
      document.getElementById('p-date').value = todayStr();
      await this.loadItems();
      this.renderPurchasesUI();
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveExpense: async function(e) {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), {
        tenantId: this._state.tenantId,
        branch: document.getElementById('e-branch').value,
        category: document.getElementById('e-category').value,
        amount: parseFloat(document.getElementById('e-amount').value),
        date: document.getElementById('e-date').value,
        note: document.getElementById('e-note').value,
        createdAt: serverTimestamp()
      });
      showToast('Expense saved!');
      e.target.reset();
      document.getElementById('e-date').value = todayStr();
      this.renderExpensesUI();
    } catch (err) { showToast(err.message, 'error'); }
  },

  saveSettings: async function(e) {
    e.preventDefault();
    try {
      const name = document.getElementById('set-name').value;
      const phone = document.getElementById('set-phone').value;
      const threshold = parseInt(document.getElementById('set-threshold').value);
      
      await updateDoc(doc(db, 'tenants', this._state.tenantId), {
        name, phone, lowStockThreshold: threshold
      });
      
      this._state.settings.name = name;
      this._state.settings.phone = phone;
      this._state.threshold = threshold;
      showToast('Settings saved!');
      document.getElementById('hdrBusinessName').textContent = name;
    } catch (err) { showToast(err.message, 'error'); }
  },

  addBranch: async function() {
    const input = document.getElementById('new-branch-name');
    const name = input.value.trim();
    if (!name) return;
    const newBranches = [...this._state.branches, name];
    try {
      await updateDoc(doc(db, 'tenants', this._state.tenantId), { branches: newBranches });
      this._state.branches = newBranches;
      this.populateBranches();
      this.renderSettingsUI();
      input.value = '';
      showToast('Branch added!');
    } catch (err) { showToast(err.message, 'error'); }
  },

  // ═══════════════════════════════════════════
  // 📊 REPORTING
  // ═══════════════════════════════════════════
  loadReportData: async function(timeframe = 'daily') {
    // Update button styles based on timeframe
    document.querySelectorAll('.btn-secondary, .btn-primary').forEach(b => {
      if (b.textContent.includes('📅 Daily') || b.textContent.includes('📆 Monthly') || b.textContent.includes('📊 Yearly')) {
        b.className = 'btn btn-secondary';
      }
    });
    if (timeframe === 'daily') document.querySelector('button[onclick*="daily"]').className = 'btn btn-primary';
    if (timeframe === 'monthly') document.querySelector('button[onclick*="monthly"]').className = 'btn btn-primary';
    if (timeframe === 'yearly') document.querySelector('button[onclick*="yearly"]').className = 'btn btn-primary';

    const branch = document.getElementById('rep-branch').value;
    let dateFilter = '';
    if (timeframe === 'daily') dateFilter = todayStr();
    else if (timeframe === 'monthly') dateFilter = thisMonthStr();
    else if (timeframe === 'yearly') dateFilter = thisYearStr();

    // Fetch Sales
    let qSales = query(collection(db, 'sales'), where('tenantId', '==', this._state.tenantId));
    if (branch !== 'all') qSales = query(qSales, where('branch', '==', branch));
    const snapSales = await getDocs(qSales);
    const allSales = snapSales.docs.map(d => d.data()).filter(s => s.date.startsWith(dateFilter));

    // Fetch Expenses
    let qExp = query(collection(db, 'expenses'), where('tenantId', '==', this._state.tenantId));
    if (branch !== 'all') qExp = query(qExp, where('branch', '==', branch));
    const snapExp = await getDocs(qExp);
    const allExp = snapExp.docs.map(d => d.data()).filter(e => e.date.startsWith(dateFilter));

    // Calculate Metrics
    let rev = 0, unpaid = 0, cash = 0, transfer = 0;
    const itemMap = {};

    allSales.forEach(s => {
      rev += s.total || 0;
      unpaid += s.unpaid || 0;
      if (s.paymentType === 'cash') cash += s.total || 0;
      if (s.paymentType === 'transfer') transfer += s.total || 0;
      
      if (s.items) {
        s.items.forEach(it => {
          if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, rev: 0 };
          itemMap[it.name].qty += it.qty;
          itemMap[it.name].rev += (it.price * it.qty);
        });
      }
    });

    let exp = 0;
    allExp.forEach(e => { exp += e.amount || 0; });

    // Update UI
    document.getElementById('rep-revenue').textContent = money(rev) + ' ETB';
    document.getElementById('rep-expenses').textContent = money(exp) + ' ETB';
    document.getElementById('rep-profit').textContent = money(rev - exp) + ' ETB';
    document.getElementById('rep-unpaid').textContent = money(unpaid) + ' ETB';
    document.getElementById('rep-cash').textContent = money(cash) + ' ETB';
    document.getElementById('rep-transfer').textContent = money(transfer) + ' ETB';

    // Top Items
    const sorted = Object.entries(itemMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
    document.getElementById('rep-top-items').innerHTML = sorted.map(([name, data], idx) => `
      <tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:10px;">${idx + 1}</td>
        <td style="padding:10px;">${esc(name)}</td>
        <td style="padding:10px;">${data.qty}</td>
        <td style="padding:10px;">${money(data.rev)}</td>
      </tr>
    `).join('');

    // Save for CSV
    this._state.reportData = { timeframe, branch, rev, exp, profit: rev - exp, unpaid, cash, transfer, sorted };
  },

  exportReportCSV: function() {
    if (!this._state.reportData) return showToast('No data to export', 'warning');
    const d = this._state.reportData;
    
    let csv = "Metric,Value (ETB)\n";
    csv += `Revenue,${d.rev}\nExpenses,${d.exp}\nProfit,${d.profit}\nUnpaid,${d.unpaid}\nCash,${d.cash}\nTransfer,${d.transfer}\n\n`;
    csv += "Top Selling Items\n#,Item,Qty,Revenue\n";
    d.sorted.forEach(([name, data], i) => {
      csv += `${i+1},${name},${data.qty},${data.rev}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${d.timeframe}_${Date.now()}.csv`;
    link.click();
  }
};

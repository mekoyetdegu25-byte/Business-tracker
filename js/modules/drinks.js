// js/modules/drinks.js
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allItems = [];
let allSales = [];
let allExpenses = [];
let allPurchases = [];
let allCustomers = [];
let cart = [];
let editingItemId = null;
let editingCustomerName = null;
let currentCustomerName = null;

let servicePage = 1, customersPage = 1;
let servicePerPage = 10, customersPerPage = 10;
let openCategories = new Set();
let expenseDateFilter = 'recent';
let reportType = 'daily';

let unsubBranches = null, unsubItems = null, unsubSales = null, unsubExpenses = null, unsubPurchases = null, unsubCustomers = null;

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const DrinksModule = {
  name: 'Drinks',
  icon: '🍾',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel1', label: 'Drinks', icon: '🍾' },
    { id: 'panel2', label: 'Sales', icon: '🛒' },
    { id: 'panelCustomers', label: 'Customers', icon: '👥' },
    { id: 'panel8', label: 'More', icon: '⚙️' },
    // ከዚህ በታች ያሉት በሞባይል ማውጫ ላይ አይታዩም (slice(0, 5))
    { id: 'panelPurchases', label: 'Purchases', icon: '📥' },
    { id: 'panelQuickSale', label: 'Quick Sale', icon: '⚡' },
    { id: 'panel4', label: 'Expenses', icon: '💸' },
    { id: 'panel6', label: 'Reports', icon: '📊' },
    { id: 'panelLowStock', label: 'Low Stock', icon: '⚠️' }
  ],
  panels: [
    { id: 'panelMobileHome', html: `
      <div class="mobile-summary-card">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 16px; opacity: 0.9;">📅 Today's Summary</div>
        <div class="mobile-summary-row">
          <div class="mobile-summary-item"><div class="lbl">Sales</div><div class="val green" id="mobTodaySales">0.00</div></div>
          <div class="mobile-summary-item"><div class="lbl">Expenses</div><div class="val red" id="mobTodayExpenses">0.00</div></div>
          <div class="mobile-summary-item"><div class="lbl">Profit</div><div class="val blue" id="mobTodayProfit">0.00</div></div>
        </div>
      </div>
      <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 16px;">⚡ Quick Actions</h3>
      <div class="qa-grid">
        <div class="qa-card" onclick="switchPage('panel2', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">🛒</div><div class="qa-title">New Sale</div></div>
        <div class="qa-card" onclick="switchPage('panel1', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">🍾</div><div class="qa-title">Drinks</div></div>
        <div class="qa-card" onclick="switchPage('panelPurchases', null)"><div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">📥</div><div class="qa-title">Purchases</div></div>
        <div class="qa-card" onclick="switchPage('panelCustomers', null)"><div class="qa-icon" style="background:rgba(16,185,129,0.1); color:var(--success);">👥</div><div class="qa-title">Customers</div></div>
        <div class="qa-card" onclick="switchPage('panelQuickSale', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">⚡</div><div class="qa-title">Quick Sale</div></div>
        <div class="qa-card" onclick="switchPage('panel4', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div><div class="qa-title">Expenses</div></div>
        <div class="qa-card" onclick="switchPage('panelLowStock', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">⚠️</div><div class="qa-title">Low Stock <br><span id="qaStockCount" style="font-size:14px; color:var(--danger); font-weight:800;">0</span></div></div>
        <div class="qa-card" onclick="switchPage('panel6', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📊</div><div class="qa-title">Reports</div></div>
      </div>
    `},
    { id: 'panelLowStock', html: `
      <div class="card">
        <div class="card-title"><span style="color:var(--danger);">⚠️ Low Stock Alerts</span></div>
        <div class="filter-bar"><input type="text" id="searchLowStock" placeholder="🔍 Search drink..." oninput="window.renderLowStockList()"></div>
        <div id="lowStockListContainer" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>
    `},
    { id: 'panel1', html: `
      <div id="stockAlertBanner" style="display:none; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:var(--danger); padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:13px; font-weight:600;">⚠️ <span id="stockAlertText"></span></div>
      <div class="card">
        <div class="card-title"><span>🍾 Drinks</span><button class="btn btn-primary btn-sm" onclick="window.openItemModal()">➕ Add Drink</button></div>
        <div class="filter-bar">
          <input type="text" id="searchService" placeholder="🔍 Search drink..." oninput="window.servicePage=1; window.renderServiceList()">
          <select id="drinksBranchFilter" onchange="window.filterDrinksByBranch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select>
        </div>
        <div id="serviceListContainer"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px;">
          <div class="summary-box blue" style="margin-bottom:0;"><div class="label">Total Crates</div><div class="value" id="totalStockQty" style="font-size:20px;">0</div></div>
          <div class="summary-box green" style="margin-bottom:0;"><div class="label">Stock Value</div><div class="value" id="totalStockValue" style="font-size:20px;">0.00</div></div>
        </div>
        <div class="pagination-controls" id="servicePagination"></div>
      </div>
    `},
    { id: 'panel2', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="saleBranch" style="margin-bottom:8px;"></select></div>
            <label class="field-label" style="margin-top:0;">📅 Date *</label><input type="date" id="saleDate" style="margin-bottom:8px;">
            <label class="field-label">💳 Payment Type</label>
            <select id="salePaymentType" style="margin-bottom:8px;" onchange="window.toggleCreditFields()"><option value="cash">💵 Cash</option><option value="transfer">🏦 Transfer</option><option value="credit">📝 Credit</option></select>
            <div id="creditFields" style="display:none; margin-bottom:12px; padding:10px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:8px;">
              <label class="field-label">🏪 Customer Name</label>
              <input list="saleCustomerList" id="sellCreditCustomer" placeholder="Type customer name..." style="margin-bottom:8px;"><datalist id="saleCustomerList"></datalist>
              <label class="field-label">💰 Paid Amount (Partial)</label><input type="number" id="sellCreditPaid" placeholder="0.00" oninput="window.updateUnpaidDisplay()">
            </div>
          </div>
          <div class="pos-cart-items" id="cartList"></div>
          <div class="pos-cart-footer">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span style="font-size:14px; font-weight:700;">Total:</span><span id="cartTotal" style="font-size:20px; font-weight:800; color:var(--primary);">0.00 ETB</span></div>
            <label class="field-label" style="margin-top:0;">💰 Paid Amount</label><input type="number" id="salePaid" placeholder="0.00" step="any" oninput="window.updateUnpaidDisplay()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.completeSale()">💸 Complete Sale</button>
            <button class="btn btn-outline" onclick="window.clearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header"><input type="text" id="searchProduct" placeholder="🔍 Search drink..." oninput="window.renderPOSProducts()" style="padding:12px 16px;"></div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},
    { id: 'panelPurchases', html: `
      <div class="card">
        <div class="card-title"><span>📥 Purchases (Stock In)</span></div>
        <div style="background:var(--bg); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border);">
          <div id="purchaseBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="purchaseBranch"></select></div>
          <label class="field-label" style="margin-top:0;">🍾 Drink *</label><select id="purchaseItem"></select>
          <label class="field-label">📅 Date *</label><input type="date" id="purchaseDate">
          <label class="field-label">📦 Quantity Added (Crates) *</label><input type="number" id="purchaseQty" placeholder="10">
          <label class="field-label">💰 Cost per Crate (ETB)</label><input type="number" id="purchaseCost" placeholder="1200.00" step="any">
          <button class="btn btn-success" onclick="window.savePurchase()" style="margin-top:16px;">💾 Save Purchase</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Purchases</h4>
        <div id="purchasesList"></div>
      </div>
    `},
    { id: 'panelCustomers', html: `
      <div class="card">
        <div class="card-title"><span>👥 Customers</span></div>
        <div class="filter-bar">
          <input type="text" id="searchCustomers" placeholder="🔍 Search customer..." oninput="window.customersPage=1; window.renderCustomersList()">
          <select id="customerBranchFilter" onchange="window.filterCustomersByBranch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select>
        </div>
        <div id="customersListContainer"></div>
        <div class="pagination-controls" id="customersPagination"></div>
      </div>
    `},
    { id: 'panelQuickSale', html: `
      <div class="card">
        <div class="card-title"><span>⚡ Quick Sale (Direct Income)</span></div>
        <div style="background:rgba(59,130,246,0.08); color:var(--info); padding:12px; border-radius:8px; margin-bottom:16px; font-size:13px;">💡 ያለ ምርት ምርጫ በቀጥታ ጠቅላላ ገቢ ለመመዝገብ።</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div>
            <label class="field-label">📅 Date</label><input type="date" id="quickDate">
            <label class="field-label" style="margin-top:12px;">📁 Category</label>
            <input list="quickCatList" id="quickCategory" placeholder="e.g. ቢራ ሽያጭ">
            <datalist id="quickCatList"><option value="ቢራ ሽያጭ"><option value="ሶዳ ሽያጭ"><option value="ውሃ ሽያጭ"><option value="ሌላ ሽያጭ"></datalist>
            <div id="quickBranchSection" style="display:none; margin-top:12px;"><label class="field-label">🏢 Branch</label><select id="quickBranch"></select></div>
          </div>
          <div>
            <label class="field-label">💰 Amount (ETB)</label><input type="number" id="quickAmount" placeholder="0.00" step="any">
            <button class="btn btn-success" style="width:auto; padding:12px 32px; float:right; margin-top:16px;" onclick="window.addQuickSale()">+ Add Income</button><div style="clear:both;"></div>
          </div>
        </div>
      </div>
    `},
    { id: 'panel4', html: `
      <div class="card">
        <div class="card-title"><span>💸 Expenses</span></div>
        <div style="background:var(--bg); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border);">
          <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">➕ Add Expense</h4>
          <div id="expBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="expBranch"></select></div>
          <label class="field-label" style="margin-top:0;">📁 Category *</label>
          <input list="expenseCategoryList" id="expCategory" placeholder="e.g. 🏠 Rent">
          <datalist id="expenseCategoryList"><option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water"><option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport"><option value="⛽ Fuel"></datalist>
          <label class="field-label">💰 Amount (ETB) *</label><input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label><input type="date" id="expDate">
          <label class="field-label">📝 Note</label><input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.addExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar"><input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="window.renderExpenses()"></div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.setExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;"><input type="date" id="expenseFilterDate" oninput="window.renderExpenses()"><input type="month" id="expenseFilterMonth" oninput="window.renderExpenses()" style="display:none;"></div>
        <div id="expenseList"></div>
      </div>
    `},
    { id: 'panel6', html: `
      <div class="card">
        <div class="card-title"><span>📊 Reports</span></div>
        <div class="report-type-tabs">
          <button class="report-type-tab active" onclick="window.setReportType('daily', this)">📅 Daily</button>
          <button class="report-type-tab" onclick="window.setReportType('monthly', this)">📆 Monthly</button>
          <button class="report-type-tab" onclick="window.setReportType('yearly', this)">📊 Yearly</button>
        </div>
        <div id="reportHeader" style="text-align:center; font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Daily</div>
        <div id="reportDateContainer" style="margin-bottom:16px;">
          <input type="date" id="reportDate" oninput="window.renderReports()">
          <input type="month" id="reportMonth" oninput="window.renderReports()" style="display:none;">
          <input type="number" id="reportYear" placeholder="2026" min="2000" max="2100" oninput="if(this.value.length >= 4) window.renderReports()" style="display:none;">
        </div>
        <div id="reportBranchSection" style="display:none; margin-bottom:16px;"><label class="field-label" style="margin-top:0;">🏢 Branch Filter</label><select id="reportBranch" onchange="window.renderReports()"><option value="all">📊 All Branches</option></select></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="summary-box green" style="margin-bottom:0;"><div class="label">Revenue</div><div class="value" id="repRevenue" style="font-size:20px;">0.00</div></div>
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">Expenses</div><div class="value" id="repExpenses" style="font-size:20px;">0.00</div></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div class="summary-box blue" style="margin-bottom:0;"><div class="label">Profit</div><div class="value" id="repProfit" style="font-size:20px;">0.00</div></div>
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">Unpaid (Credit)</div><div class="value" id="repUnpaid" style="font-size:20px;">0.00</div></div>
        </div>
        <div class="payment-breakdown">
          <div class="payment-breakdown-item cash"><div class="label">💵 Cash</div><div class="value" id="repCash">0.00</div></div>
          <div class="payment-breakdown-item transfer"><div class="label">🏦 Transfer</div><div class="value" id="repTransfer">0.00</div></div>
          <div class="payment-breakdown-item credit"><div class="label">📝 Credit</div><div class="value" id="repCredit">0.00</div></div>
        </div>
        <div class="card" style="margin-top:16px; border: 1px solid var(--primary);">
          <div class="card-title"><span>🏆 Top Selling Items</span></div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:separate; border-spacing:0;">
              <thead><tr style="background:var(--bg);"><th style="padding:10px; text-align:left; border-bottom:1px solid var(--border);">#</th><th style="padding:10px; text-align:left; border-bottom:1px solid var(--border);">Item</th><th style="padding:10px; text-align:left; border-bottom:1px solid var(--border);">Qty</th><th style="padding:10px; text-align:left; border-bottom:1px solid var(--border);">Revenue</th></tr></thead>
              <tbody id="topSellingBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `},
    { id: 'panel8', html: `
      <div class="card">
        <div class="card-title"><span>⚙️ Settings</span></div>
        <label class="field-label" style="margin-top:0;">🏢 Business Name</label><input type="text" id="settingBizName" placeholder="Business name">
        <label class="field-label">📞 Phone</label><input type="text" id="settingBizPhone" placeholder="+251...">
        <label class="field-label">⚠️ Low Stock Alert (Crates)</label><input type="number" id="settingLowStock" placeholder="10" value="10">
        <button class="btn btn-primary" onclick="window.saveSettings()">💾 Save Settings</button>
      </div>
      <div class="card" id="branchSettingsCard" style="display:none;">
        <div class="card-title"><span>🏢 Branches <span class="role-badge" style="background:var(--success); border-color:var(--success); margin-left:6px;">PRO</span></span></div>
        <div id="branchAddSection" style="display:flex; gap:10px; margin-bottom:16px;"><input type="text" id="newBranchName" placeholder="New branch name..." style="margin:0;"><button class="btn btn-primary" onclick="window.addBranch()" style="width:auto; margin-top:0; padding:0 16px;">➕ Add</button></div>
        <div id="branchesList" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
      </div>
      <div class="card">
        <div class="card-title"><span>🎨 Theme</span></div>
        <div style="display:flex; gap:10px;"><button class="btn btn-outline" onclick="window.toggleDarkMode(false)" style="margin-top:0;">☀️ Light</button><button class="btn btn-outline" onclick="window.toggleDarkMode(true)" style="margin-top:0;">🌙 Dark</button></div>
      </div>
      <div class="card">
        <div class="card-title"><span>🚪 Account</span></div>
        <button class="btn btn-danger" onclick="window.logout()">Sign Out</button>
      </div>
    `}
  ],

  // ═══════════════════════════════════════════
  // 🚀 INIT
  // ═══════════════════════════════════════════
  init: async (appState) => {
    // Global functions ማዘጋጀት
    window.renderLowStockList = renderLowStockList;
    window.renderServiceList = renderServiceList;
    window.renderPOSProducts = renderPOSProducts;
    window.toggleCreditFields = toggleCreditFields;
    window.updateUnpaidDisplay = updateUnpaidDisplay;
    window.addToCart = addToCart;
    window.updateCartQty = updateCartQty;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.completeSale = completeSale;
    window.openItemModal = openItemModal;
    window.closeItemModal = closeItemModal;
    window.saveItem = saveItem;
    window.deleteItem = deleteItem;
    window.toggleServiceCategory = toggleServiceCategory;
    window.filterDrinksByBranch = filterDrinksByBranch;
    window.filterCustomersByBranch = filterCustomersByBranch;
    window.savePurchase = savePurchase;
    window.renderCustomersList = renderCustomersList;
    window.showCustomerProfile = showCustomerProfile;
    window.addQuickSale = addQuickSale;
    window.addExpense = addExpense;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.renderExpenses = renderExpenses;
    window.setReportType = setReportType;
    window.renderReports = renderReports;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;

    // State ማስተካከል
    window.servicePage = servicePage;
    window.customersPage = customersPage;

    // Default Dates
    const today = todayStr();
    if (document.getElementById('saleDate')) document.getElementById('saleDate').value = today;
    if (document.getElementById('purchaseDate')) document.getElementById('purchaseDate').value = today;
    if (document.getElementById('expDate')) document.getElementById('expDate').value = today;
    if (document.getElementById('reportDate')) document.getElementById('reportDate').value = today;
    if (document.getElementById('reportMonth')) document.getElementById('reportMonth').value = thisMonthStr();
    if (document.getElementById('reportYear')) document.getElementById('reportYear').value = thisYearStr();
    if (document.getElementById('expenseFilterDate')) document.getElementById('expenseFilterDate').value = today;
    if (document.getElementById('expenseFilterMonth')) document.getElementById('expenseFilterMonth').value = thisMonthStr();
    if (document.getElementById('settingLowStock')) document.getElementById('settingLowStock').value = appState.lowStockThreshold;

    await loadAllData(appState);
  },

  onPageChange: (panelId) => {
    if (panelId === 'panel1') renderServiceList();
    if (panelId === 'panel2') renderPOSProducts();
    if (panelId === 'panelCustomers') renderCustomersList();
    if (panelId === 'panel4') renderExpenses();
    if (panelId === 'panel6') renderReports();
    if (panelId === 'panelMobileHome') updateMobileHome();
    if (panelId === 'panelLowStock') renderLowStockList();
  },

  cleanup: () => {
    if (unsubBranches) unsubBranches();
    if (unsubItems) unsubItems();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    if (unsubPurchases) unsubPurchases();
    if (unsubCustomers) unsubCustomers();
    const fnNames = ['renderLowStockList','renderServiceList','renderPOSProducts','toggleCreditFields','updateUnpaidDisplay','addToCart','updateCartQty','removeFromCart','clearCart','completeSale','openItemModal','closeItemModal','saveItem','deleteItem','toggleServiceCategory','filterDrinksByBranch','filterCustomersByBranch','savePurchase','renderCustomersList','showCustomerProfile','addQuickSale','addExpense','setExpenseDateFilter','renderExpenses','setReportType','renderReports','saveSettings','addBranch','deleteBranch'];
    fnNames.forEach(fn => delete window[fn]);
  }
};

// ═══════════════════════════════════════════
// 📥 DATA LOADING
// ═══════════════════════════════════════════
async function loadAllData(appState) {
  if (!appState.tenantId) return;

  unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', appState.tenantId)), snap => {
    allBranches = []; snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
    renderBranchSettings(appState);
    updateBranchDropdowns(appState);
  });
  unsubItems = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', appState.tenantId)), snap => {
    allItems = []; snap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
    renderServiceList(); renderPOSProducts(); populatePurchaseItems();
  });
  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', appState.tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderReports(); updateMobileHome(); renderCustomersList();
  });
  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', appState.tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses(); renderReports(); updateMobileHome();
  });
  unsubPurchases = onSnapshot(query(collection(db, 'purchases'), where('tenantId', '==', appState.tenantId)), snap => {
    allPurchases = []; snap.forEach(d => allPurchases.push({ id: d.id, ...d.data() }));
    allPurchases.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPurchases();
  });
  unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('tenantId', '==', appState.tenantId)), snap => {
    allCustomers = []; snap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));
    renderCustomersList(); updateCustomerDatalist();
  });
}

// ═══════════════════════════════════════════
// 🧠 HELPER FUNCTIONS
// ═══════════════════════════════════════════
function updateMobileHome() {
  const today = todayStr();
  const todaySales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const todayProfit = todaySales - todayExpenses;
  const el1 = document.getElementById('mobTodaySales'); if (el1) el1.textContent = money(todaySales);
  const el2 = document.getElementById('mobTodayExpenses'); if (el2) el2.textContent = money(todayExpenses);
  const el3 = document.getElementById('mobTodayProfit'); if (el3) el3.textContent = money(todayProfit);
  const lowStockItems = allItems.filter(i => (i.crates || 0) <= state.lowStockThreshold);
  const stockCountEl = document.getElementById('qaStockCount'); if (stockCountEl) stockCountEl.textContent = lowStockItems.length;
}

function renderLowStockList() {
  const el = document.getElementById('lowStockListContainer');
  if (!el) return;
  const search = (document.getElementById('searchLowStock')?.value || '').toLowerCase();
  let lowItems = allItems.filter(i => (i.crates || 0) <= state.lowStockThreshold);
  if (search) lowItems = lowItems.filter(i => (i.name || '').toLowerCase().includes(search));
  if (lowItems.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--success);"><div style="font-size:48px; margin-bottom:12px;">🎉</div><div style="font-weight:600;">ሁሉም ክምችት በቂ ነው!</div></div>';
    return;
  }
  el.innerHTML = lowItems.map(i => `
    <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); padding:16px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div style="flex:1; min-width:0;"><div style="font-weight:700; font-size:15px; color:var(--text-main);">🍾 ${esc(i.name)} ${i.variant ? `(${esc(i.variant)})` : ''}</div><div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Category: ${esc(i.category || '-')}</div></div>
      <div style="text-align:right; flex-shrink:0;"><div style="font-weight:800; font-size:16px; color:var(--danger);">${i.crates || 0} crates</div><button onclick="switchPage('panelPurchases', null)" style="font-size:12px; background:var(--primary); color:#fff; border:none; padding:6px 16px; border-radius:6px; margin-top:8px; cursor:pointer; font-weight:700;">+ Buy</button></div>
    </div>
  `).join('');
}

function updateCustomerDatalist() {
  const dl = document.getElementById('saleCustomerList');
  if (dl) dl.innerHTML = allCustomers.map(c => `<option value="${esc(c.name)}">`).join('');
}

function renderBranchSettings(appState) {
  const card = document.getElementById('branchSettingsCard');
  if (!card) return;
  if (appState.plan !== 'pro') { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const list = document.getElementById('branchesList');
  if (!list) return;
  if (allBranches.length === 0) { list.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">ምንም ቅርንጫፍ የለም</p>'; return; }
  list.innerHTML = allBranches.map(b => `
    <div style="display:flex; align-items:center; gap:8px; background:var(--bg); padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
      <span style="font-weight:600; font-size:13px;">🏢 ${esc(b.name)}</span>
      ${b.name === 'Main' ? '' : `<button onclick="window.deleteBranch('${b.id}', '${escJs(b.name)}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:14px; padding:0;">×</button>`}
    </div>
  `).join('');
}

function updateBranchDropdowns(appState) {
  const hasBranches = appState.plan === 'pro' && allBranches.length > 0;
  const options = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
  const sections = ['posBranchSection', 'expBranchSection', 'itemBranchSection', 'quickBranchSection', 'purchaseBranchSection'];
  sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = hasBranches ? 'block' : 'none'; });
  const selects = ['saleBranch', 'expBranch', 'itemBranch', 'quickBranch', 'purchaseBranch'];
  selects.forEach(id => { const el = document.getElementById(id); if (el && hasBranches) el.innerHTML = options; });
  ['reportBranch', 'drinksBranchFilter', 'customerBranchFilter'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) { sel.style.display = hasBranches ? 'block' : 'none'; if (hasBranches) { const currentVal = sel.value; sel.innerHTML = '<option value="all">📊 All Branches</option>' + options; if (currentVal) sel.value = currentVal; } }
  });
}

async function addBranch() {
  const appState = state;
  if (appState.plan !== 'pro') return showToast('Pro plan ብቻ!', 'error');
  const name = document.getElementById('newBranchName').value.trim();
  if (!name) return showToast('የቅርንጫፍ ስም ያስፈልጋል', 'error');
  if (allBranches.find(b => b.name.toLowerCase() === name.toLowerCase())) return showToast('ይህ ቅርንጫፍ አስቀድሞ አለ', 'error');
  try { await addDoc(collection(db, 'branches'), { tenantId: appState.tenantId, name, createdAt: serverTimestamp() }); document.getElementById('newBranchName').value = ''; showToast('✅ ቅርንጫፍ ተጨምሯል'); } catch(e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteBranch(id, name) {
  if (name === 'Main') return showToast('Main ማጥፋት አይቻልም', 'error');
  if (!confirm(`"${name}" ቅርንጫፍን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'branches', id)); showToast('✅ ተጠፍቷል'); } catch(e) { showToast('❌ ስህተት', 'error'); }
}

function filterDrinksByBranch() { window.servicePage = 1; renderServiceList(); }
function filterCustomersByBranch() { window.customersPage = 1; renderCustomersList(); }

// ═══════════════════════════════════════════
// 🍾 DRINKS MANAGEMENT
// ═══════════════════════════════════════════
function openItemModal(id = null) {
  editingItemId = id;
  if (id) {
    const i = allItems.find(x => x.id === id);
    if (!i) return;
    document.getElementById('itemModalTitle').textContent = '✏️ Edit Drink';
    document.getElementById('itemCategory').value = i.category || '';
    document.getElementById('itemName').value = i.name || '';
    document.getElementById('itemVariant').value = i.variant || '';
    document.getElementById('itemUnitsPerCrate').value = i.unitsPerCrate || 24;
    document.getElementById('itemPrice').value = i.price || '';
    document.getElementById('itemCratePrice').value = i.cratePrice || '';
    document.getElementById('itemStock').value = i.crates || 0;
    if (state.plan === 'pro' && i.branch) document.getElementById('itemBranch').value = i.branch;
    document.getElementById('saveItemBtn').textContent = '💾 Update';
  } else {
    document.getElementById('itemModalTitle').textContent = '➕ Add Drink';
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemVariant').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemUnitsPerCrate').value = '24';
    document.getElementById('itemStock').value = '';
    document.getElementById('saveItemBtn').textContent = '💾 Save';
  }
  document.getElementById('itemModal').classList.add('open');
}

function closeItemModal() { document.getElementById('itemModal').classList.remove('open'); editingItemId = null; }

async function saveItem() {
  const appState = state;
  const category = document.getElementById('itemCategory').value.trim();
  const name = document.getElementById('itemName').value.trim();
  const variant = document.getElementById('itemVariant').value.trim();
  const unitsPerCrate = parseInt(document.getElementById('itemUnitsPerCrate').value) || 24;
  const price = parseFloat(document.getElementById('itemPrice').value);
  const cratePrice = parseFloat(document.getElementById('itemCratePrice').value);
  const stock = parseInt(document.getElementById('itemStock').value) || 0;
  const branch = appState.plan === 'pro' ? document.getElementById('itemBranch').value : 'Main';
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Drink Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('የቁራጭ ዋጋ ያስፈልጋል', 'error');
  if (isNaN(cratePrice) || cratePrice <= 0) return showToast('የካርቶን ዋጋ ያስፈልጋል', 'error');
  try {
    const data = { category, name, variant, price, cratePrice, unitsPerCrate, crates: stock, branch };
    if (editingItemId) { await updateDoc(doc(db, 'products', editingItemId), data); showToast('✅ ተሻሽሏል'); }
    else { data.tenantId = appState.tenantId; data.createdAt = serverTimestamp(); await addDoc(collection(db, 'products'), data); showToast('✅ ተጨምሯል'); }
    closeItemModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteItem(id) {
  if (!confirm('መጠጡን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

function toggleServiceCategory(catName) {
  if (openCategories.has('drink_' + catName)) openCategories.delete('drink_' + catName);
  else openCategories.add('drink_' + catName);
  renderServiceList();
}

function renderServiceList() {
  const container = document.getElementById('serviceListContainer');
  if (!container) return;
  const lowStockItems = allItems.filter(i => (i.crates || 0) <= state.lowStockThreshold);
  const alertBanner = document.getElementById('stockAlertBanner');
  const alertText = document.getElementById('stockAlertText');
  if (lowStockItems.length > 0 && alertBanner && alertText) {
    alertBanner.style.display = 'block';
    alertText.textContent = `${lowStockItems.length} መጠጦች ክምችታቸው አናሳ ነው! (ከ ${state.lowStockThreshold} ካርቶን በታች)`;
  } else if (alertBanner) { alertBanner.style.display = 'none'; }

  const search = (document.getElementById('searchService')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('drinksBranchFilter')?.value || 'all') : 'all';
  let filtered = allItems;
  if (branchFilter !== 'all') filtered = filtered.filter(i => i.branch === branchFilter);
  if (search) filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(search) || (i.category || '').toLowerCase().includes(search) || (i.variant || '').toLowerCase().includes(search));
  const totalCrates = filtered.reduce((s, x) => s + (x.crates || 0), 0);
  const totalVal = filtered.reduce((s, x) => s + ((x.crates || 0) * (x.price || 0) * (x.unitsPerCrate || 24)), 0);
  if (document.getElementById('totalStockQty')) document.getElementById('totalStockQty').textContent = totalCrates;
  if (document.getElementById('totalStockValue')) document.getElementById('totalStockValue').textContent = money(totalVal);
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:48px; margin-bottom:12px;">🍾</div><div style="font-weight:600;">ምንም መጠጥ የለም</div></div>`;
    renderPagination('servicePagination', 0, window.servicePage, servicePerPage, (p) => { window.servicePage = p; renderServiceList(); }, (pp) => { servicePerPage = pp; window.servicePage = 1; renderServiceList(); });
    return;
  }
  const totalPages = Math.ceil(filtered.length / servicePerPage);
  if (window.servicePage > totalPages) window.servicePage = totalPages;
  const start = (window.servicePage - 1) * servicePerPage;
  const paginated = filtered.slice(start, start + servicePerPage);
  const grouped = {};
  paginated.forEach(i => { const cat = i.category || 'Other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(i); });
  container.innerHTML = Object.keys(grouped).sort().map(cat => {
    const items = grouped[cat].sort((a,b) => a.name.localeCompare(b.name));
    const isOpen = openCategories.has('drink_' + cat) || (search && search.length > 0);
    return `<div class="category-collapsible ${isOpen ? 'open' : ''}"><div class="category-header" onclick="window.toggleServiceCategory('${escJs(cat)}')"><div class="category-header-left"><span class="category-arrow">▶</span><span class="category-name">📁 ${esc(cat)}</span><span class="category-count">${items.length}</span></div></div><div class="category-body">${items.map(i => {
      const isLow = (i.crates || 0) <= state.lowStockThreshold;
      return `<div class="item-row"><div class="item-row-name">🍾 ${esc(i.name)} ${i.variant ? `<span style="font-size:11px; color:var(--primary); background:rgba(26,54,93,0.1); padding:2px 6px; border-radius:4px; margin-left:4px;">${esc(i.variant)}</span>` : ''}<div style="font-size:11px; color:${isLow ? 'var(--danger)' : 'var(--success)'}; font-weight:700; margin-top:2px;">${isLow ? '⚠️' : '✅'} Stock: ${i.crates || 0} crates (${(i.crates || 0) * (i.unitsPerCrate || 24)} pcs)</div></div><div class="item-row-price" style="text-align:right;">${money(i.cratePrice)} ETB <small style="font-size:11px; opacity:0.7;">/crate</small><br>${money(i.price)} ETB <small style="font-size:11px; opacity:0.7;">/piece</small></div><div style="display:flex; gap:4px;"><button class="action-btn btn-edit" onclick="window.openItemModal('${i.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button><button class="action-btn btn-delete" onclick="window.deleteItem('${i.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button></div></div>`;
    }).join('')}</div></div>`;
  }).join('');
  renderPagination('servicePagination', filtered.length, window.servicePage, servicePerPage, (p) => { window.servicePage = p; renderServiceList(); }, (pp) => { servicePerPage = pp; window.servicePage = 1; renderServiceList(); });
}

// ═══════════════════════════════════════════
// 📥 PURCHASES
// ═══════════════════════════════════════════
function populatePurchaseItems() {
  const sel = document.getElementById('purchaseItem');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Drink --</option>' + allItems.map(s => `<option value="${s.id}">${esc(s.name)} (Stock: ${s.crates || 0} crates)</option>`).join('');
}

async function savePurchase() {
  const appState = state;
  const itemId = document.getElementById('purchaseItem').value;
  const date = document.getElementById('purchaseDate').value;
  const qty = parseInt(document.getElementById('purchaseQty').value);
  const cost = parseFloat(document.getElementById('purchaseCost').value) || 0;
  const branch = appState.plan === 'pro' ? document.getElementById('purchaseBranch').value : 'Main';
  if (!itemId) return showToast('መጠጥ ምረጥ', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(qty) || qty <= 0) return showToast('ትክክል ያለው ብዛት ያስፈልጋል', 'error');
  const item = allItems.find(x => x.id === itemId);
  if (!item) return;
  try {
    await addDoc(collection(db, 'purchases'), { tenantId: appState.tenantId, itemId, itemName: item.name, date, qty, cost, totalCost: qty * cost, branch, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'products', itemId), { crates: increment(qty) });
    showToast('✅ Purchase ተመዝግቧል');
    document.getElementById('purchaseQty').value = '';
    document.getElementById('purchaseCost').value = '';
  } catch(e) { showToast('❌ ስህተት', 'error'); }
}

function renderPurchases() {
  const el = document.getElementById('purchasesList');
  if (!el) return;
  if (allPurchases.length === 0) { el.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">ምንም ግዢ የለም</div>'; return; }
  el.innerHTML = allPurchases.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);">
      <div><div style="font-weight:600; font-size:13px; color:var(--text-main);">📦 ${esc(p.itemName)}</div><div style="font-size:11.5px; color:var(--text-muted);">📅 ${esc(p.date)} • Qty: +${p.qty} crates ${p.branch && state.plan === 'pro' ? `• 🏢 ${esc(p.branch)}` : ''}</div></div>
      <div style="font-weight:800; color:var(--primary);">${money(p.totalCost)} ETB</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
// 🛒 POS
// ═══════════════════════════════════════════
function toggleCreditFields() {
  const method = document.getElementById('salePaymentType').value;
  document.getElementById('creditFields').style.display = method === 'credit' ? 'block' : 'none';
}

function renderPOSProducts() {
  const listEl = document.getElementById('sellProductList');
  if (!listEl) return;
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let filtered = allItems.filter(s => (s.crates || 0) > 0);
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search) || (s.variant || '').toLowerCase().includes(search));
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">ምንም መጠጥ የለም (ወይም ስቶክ አልቋል)</div>';
    return;
  }
  listEl.innerHTML = filtered.sort((a,b) => a.name.localeCompare(b.name)).map(s => `
    <div class="product-card" style="padding:10px;">
      <div><div class="p-name" style="margin-bottom:6px;">🍾 ${esc(s.name)} ${s.variant ? `<span style="font-size:10px; background:var(--bg); padding:1px 4px; border-radius:4px; border:1px solid var(--border); color:var(--text-muted);">${esc(s.variant)}</span>` : ''}</div><div style="font-size:11px; color:var(--text-muted);">Stock: ${s.crates || 0} crates</div></div>
      <div style="display:flex; gap:6px; margin-top:8px;">
        <button onclick="event.stopPropagation(); window.addToCart('${s.id}', 'piece')" style="flex:1; padding:6px; border:none; border-radius:6px; background:var(--bg); border:1px solid var(--border); cursor:pointer; font-size:11px; font-weight:700;">🍾 Piece<br>${money(s.price)}</button>
        <button onclick="event.stopPropagation(); window.addToCart('${s.id}', 'crate')" style="flex:1; padding:6px; border:none; border-radius:6px; background:rgba(26,54,93,0.1); color:var(--primary); border:1px solid rgba(26,54,93,0.2); cursor:pointer; font-size:11px; font-weight:700;">📦 Crate<br>${money(s.cratePrice)}</button>
      </div>
    </div>
  `).join('');
}

function addToCart(id, sellType = 'piece') {
  const s = allItems.find(x => x.id === id);
  if (!s) return;
  const isCrate = sellType === 'crate';
  const price = isCrate ? s.cratePrice : s.price;
  const cartId = id + '_' + sellType;
  const existing = cart.find(c => c.cartId === cartId);
  if (existing) { existing.qty++; }
  else {
    const displayName = s.name + (s.variant ? ` (${s.variant})` : '') + (isCrate ? ' [Crate]' : ' [Piece]');
    cart.push({ cartId, id, name: displayName, price: price, qty: 1, sellType, unitsPerCrate: s.unitsPerCrate || 24 });
  }
  renderCart();
}

function updateCartQty(i, delta) {
  const item = cart[i]; if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(i, 1); renderCart(); return; }
  item.qty = newQty;
  renderCart();
}

function removeFromCart(i) { cart.splice(i, 1); renderCart(); }
function clearCart() { cart = []; renderCart(); }

function renderCart() {
  const el = document.getElementById('cartList'); if (!el) return;
  if (cart.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px 0;">🛒 Cart is empty</div>';
    document.getElementById('cartTotal').textContent = '0.00 ETB';
    updateUnpaidDisplay();
    return;
  }
  let total = 0;
  el.innerHTML = cart.map((c, i) => {
    total += c.price * c.qty;
    return `<div class="cart-item">
      <div class="ci-info"><div class="ci-name">${esc(c.name)}</div><div class="ci-price">${money(c.price)} ETB</div></div>
      <div class="ci-qty"><button onclick="window.updateCartQty(${i}, -1)">−</button><span>${c.qty}</span><button onclick="window.updateCartQty(${i}, 1)">+</button></div>
      <div class="ci-total">${money(c.price * c.qty)}</div>
      <div class="ci-del" onclick="window.removeFromCart(${i})">✕</div>
    </div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = money(total) + ' ETB';
  updateUnpaidDisplay();
}

function updateUnpaidDisplay() {
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  let paid = parseFloat(document.getElementById('salePaid')?.value) || 0;
  const method = document.getElementById('salePaymentType').value;
  if (method === 'credit') {
    const creditPaid = parseFloat(document.getElementById('sellCreditPaid')?.value) || 0;
    if (creditPaid > 0) paid = creditPaid;
  }
  const unpaid = Math.max(0, total - paid);
  const el = document.getElementById('unpaidDisplay');
  if (el) el.textContent = `📝 Unpaid: ${money(unpaid)} ETB`;
}

async function completeSale() {
  const appState = state;
  const date = document.getElementById('saleDate').value;
  const paymentType = document.getElementById('salePaymentType').value;
  const branch = appState.plan === 'pro' ? document.getElementById('saleBranch').value : 'Main';
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  let paid = parseFloat(document.getElementById('salePaid').value) || 0;
  let customer = '';
  if (paymentType === 'credit') {
    customer = document.getElementById('sellCreditCustomer').value.trim();
    if (!customer) return showToast('የደንበኛ ስም አስፈልጋል (Credit)', 'error');
    const creditPaid = parseFloat(document.getElementById('sellCreditPaid').value) || 0;
    if (creditPaid > 0) paid = creditPaid;
  }
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');
  try {
    if (customer && !allCustomers.find(c => c.name === customer)) {
      await setDoc(doc(db, 'customers', appState.tenantId + '_' + customer), { name: customer, tenantId: appState.tenantId, createdAt: serverTimestamp() }, { merge: true });
    }
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty, sellType: c.sellType }));
    await addDoc(collection(db, 'sales'), { tenantId: appState.tenantId, date, items, total, paidAmount: paid, unpaidAmount: total - paid, paymentType, customer, branch, createdAt: serverTimestamp() });
    for (const c of cart) {
      const item = allItems.find(x => x.id === c.id);
      if (item) {
        if (c.sellType === 'crate') { await updateDoc(doc(db, 'products', c.id), { crates: increment(-c.qty) }); }
        else { const unitsPerCrate = item.unitsPerCrate || 24; const cratesDeducted = c.qty / unitsPerCrate; await updateDoc(doc(db, 'products', c.id), { crates: increment(-cratesDeducted) }); }
      }
    }
    showToast('✅ Sale ተመዝግቧል');
    cart = []; renderCart();
    document.getElementById('salePaid').value = '';
    document.getElementById('sellCreditCustomer').value = '';
    document.getElementById('sellCreditPaid').value = '';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 👥 CUSTOMERS & CREDIT
// ═══════════════════════════════════════════
function getCustomerStats(name) {
  const sales = allSales.filter(s => s.customer === name);
  const totalPaid = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);
  const totalDebt = sales.reduce((s, x) => s + (x.unpaidAmount || 0), 0);
  return { sales, totalPaid, totalDebt, orderCount: sales.length };
}

function renderCustomersList() {
  const el = document.getElementById('customersListContainer');
  if (!el) return;
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('customerBranchFilter')?.value || 'all') : 'all';
  const map = {};
  allCustomers.forEach(c => { map[c.name] = { name: c.name, phone: c.phone || '', id: c.id }; });
  allSales.forEach(s => { if (!s.customer) return; if (!map[s.customer]) map[s.customer] = { name: s.customer, phone: '', id: null }; });
  let list = Object.values(map);
  if (branchFilter !== 'all') { list = list.filter(c => { const cSales = allSales.filter(s => s.customer === c.name); return cSales.some(s => s.branch === branchFilter); }); }
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  if (list.length === 0) { el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">👥 ምንም ደንበኛ የለም</div>'; return; }
  list.sort((a, b) => { const sA = getCustomerStats(a.name); const sB = getCustomerStats(b.name); return sB.totalDebt - sA.totalDebt; });
  const totalPages = Math.ceil(list.length / customersPerPage);
  if (window.customersPage > totalPages) window.customersPage = totalPages;
  const start = (window.customersPage - 1) * customersPerPage;
  const paginated = list.slice(start, start + customersPerPage);
  el.innerHTML = paginated.map(c => {
    const stats = getCustomerStats(c.name);
    return `<div class="customer-card" onclick="window.showCustomerProfile('${escJs(c.name)}')"><div class="customer-row"><div class="customer-info"><div class="customer-name">👤 ${esc(c.name)}</div><div class="customer-meta">🛒 ${stats.orderCount} sales | 💰 ${money(stats.totalPaid)} paid</div></div>${stats.totalDebt > 0.01 ? `<div class="customer-debt-badge">⚠️ ${money(stats.totalDebt)}</div>` : '<div style="color:var(--success); font-size:20px;">✓</div>'}</div></div>`;
  }).join('');
  renderPagination('customersPagination', list.length, window.customersPage, customersPerPage, (page) => { window.customersPage = page; renderCustomersList(); }, (perPage) => { customersPerPage = perPage; window.customersPage = 1; renderCustomersList(); });
}

function showCustomerProfile(name) {
  currentCustomerName = name;
  const stats = getCustomerStats(name);
  const custData = allCustomers.find(c => c.name === name) || {};
  const ordersHtml = stats.sales.length === 0
    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ሽያጭ የለም</p>'
    : [...stats.sales].sort((a,b) => new Date(b.date) - new Date(a.date)).map(o => {
      const unpaid = (o.unpaidAmount || 0);
      return `<div class="history-item"><div class="history-row"><span class="history-date">📅 ${esc(o.date)}</span><span class="history-amount" style="color:var(--primary);">${money(o.total)} ETB</span></div><div class="history-items">${(o.items || []).map(i => `${esc(i.name)} x${i.qty}`).join(', ')}</div><div class="history-badge"><span style="color:var(--success); font-weight:600;">✅ Paid: ${money(o.paidAmount || 0)}</span>${unpaid > 0.01 ? ` | <span style="color:var(--danger); font-weight:600;">⚠️ Debt: ${money(unpaid)}</span>` : ''}</div></div>`;
    }).join('');
  document.getElementById('customerProfileBody').innerHTML = `
    <div class="profile-header"><div class="profile-avatar">👤</div><div class="profile-name">${esc(name)}</div></div>
    <div class="profile-stats"><div class="profile-stat"><div class="label">Sales</div><div class="value">${stats.orderCount}</div></div><div class="profile-stat paid"><div class="label">Paid</div><div class="value">${money(stats.totalPaid)}</div></div><div class="profile-stat debt"><div class="label">Debt</div><div class="value">${money(stats.totalDebt)}</div></div></div>
    ${stats.totalDebt > 0.01 ? `<div class="payment-form"><h4>💰 Record Payment</h4><label class="field-label" style="margin-top:0;">Amount (ETB) *</label><input type="number" id="paymentAmount" placeholder="0.00" step="any" max="${stats.totalDebt}"><label class="field-label">Date</label><input type="date" id="paymentDate" value="${todayStr()}"><button class="btn btn-success" onclick="window.recordPayment('${escJs(name)}')" style="margin-top:12px;">💾 Record Payment</button></div>` : ''}
    <div class="history-section"><h4>📜 Sales History</h4>${ordersHtml}</div>
  `;
  document.getElementById('customerProfileModal').classList.add('open');
}

function recordPayment(name) {
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  const stats = getCustomerStats(name);
  if (amount > stats.totalDebt) return showToast('ከዕዳ መጠን መብለጥ አይችልም', 'error');
  let remaining = amount;
  const unpaidOrders = [...stats.sales].filter(o => (o.unpaidAmount || 0) > 0.01).sort((a, b) => new Date(a.date) - new Date(b.date));
  (async () => {
    try {
      for (const order of unpaidOrders) {
        if (remaining <= 0) break;
        const toPay = Math.min(remaining, order.unpaidAmount);
        await updateDoc(doc(db, 'sales', order.id), { paidAmount: (order.paidAmount || 0) + toPay, unpaidAmount: order.unpaidAmount - toPay });
        remaining -= toPay;
      }
      await addDoc(collection(db, 'payments'), { tenantId: state.tenantId, customer: name, amount, date, createdAt: serverTimestamp() });
      showToast(`✅ ${money(amount)} ETB ተከፍሏል`);
      document.getElementById('customerProfileModal').classList.remove('open');
      setTimeout(() => showCustomerProfile(name), 300);
    } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
  })();
}

// ═══════════════════════════════════════════
// ⚡ QUICK SALE
// ═══════════════════════════════════════════
async function addQuickSale() {
  const appState = state;
  const date = document.getElementById('quickDate').value;
  const amount = parseFloat(document.getElementById('quickAmount').value);
  const category = document.getElementById('quickCategory').value.trim() || 'Quick Sale';
  const branch = appState.plan === 'pro' ? document.getElementById('quickBranch').value : 'Main';
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው መጠን ያስፈልጋል', 'error');
  try {
    await addDoc(collection(db, 'sales'), { tenantId: appState.tenantId, date, items: [{ name: category, qty: 1, price: amount, total: amount }], total: amount, paidAmount: amount, unpaidAmount: 0, paymentType: 'cash', branch, createdAt: serverTimestamp(), isQuickSale: true });
    showToast('✅ Quick Sale ተመዝግቧል');
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickCategory').value = '';
    document.getElementById('quickDate').value = todayStr();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 💸 EXPENSES
// ═══════════════════════════════════════════
async function addExpense() {
  const appState = state;
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  const branch = appState.plan === 'pro' ? document.getElementById('expBranch').value : 'Main';
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  try {
    await addDoc(collection(db, 'expenses'), { tenantId: appState.tenantId, category, amount, date, note, branch, createdAt: serverTimestamp() });
    document.getElementById('expCategory').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    document.getElementById('expDate').value = todayStr();
    showToast('✅ ወጪ ተመዝግቧል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

function setExpenseDateFilter(filter, btn) {
  expenseDateFilter = filter;
  document.querySelectorAll('#panel4 .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const picker = document.getElementById('expenseDatePicker');
  const dateInput = document.getElementById('expenseFilterDate');
  const monthInput = document.getElementById('expenseFilterMonth');
  if (filter === 'date') { picker.style.display = 'block'; dateInput.style.display = 'block'; monthInput.style.display = 'none'; }
  else if (filter === 'month') { picker.style.display = 'block'; dateInput.style.display = 'none'; monthInput.style.display = 'block'; }
  else { picker.style.display = 'none'; }
  renderExpenses();
}

function renderExpenses() {
  const el = document.getElementById('expenseList');
  if (!el) return;
  let filtered = allExpenses;
  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  if (search) filtered = filtered.filter(e => (e.category || '').toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search));
  const currentMonth = thisMonthStr();
  if (expenseDateFilter === 'date') { const d = document.getElementById('expenseFilterDate').value; filtered = filtered.filter(e => e.date === d); }
  else if (expenseDateFilter === 'month') { const m = document.getElementById('expenseFilterMonth').value; filtered = filtered.filter(e => e.date && e.date.startsWith(m)); }
  else if (expenseDateFilter === 'recent') { filtered = filtered.slice(0, 20); }
  filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (filtered.length === 0) { el.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ወጪ የለም</div>'; }
  else { el.innerHTML = filtered.map(e => `<div class="item-row"><div class="item-row-name">${esc(e.category)}<div style="font-size:11px; color:var(--text-muted);">${e.date} ${e.note ? '• ' + esc(e.note) : ''}</div></div><div class="item-row-price" style="color:var(--danger);">${money(e.amount)} ETB</div></div>`).join(''); }
  const monthTotal = allExpenses.filter(e => e.date && e.date.startsWith(currentMonth)).reduce((s, e) => s + e.amount, 0);
  const allTotal = allExpenses.reduce((s, e) => s + e.amount, 0);
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(monthTotal);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allTotal);
}

// ═══════════════════════════════════════════
// 📊 REPORTS
// ═══════════════════════════════════════════
function setReportType(type, btn) {
  reportType = type;
  document.querySelectorAll('.report-type-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const dateInput = document.getElementById('reportDate');
  const monthInput = document.getElementById('reportMonth');
  const yearInput = document.getElementById('reportYear');
  const header = document.getElementById('reportHeader');
  if (type === 'daily') { dateInput.style.display = 'block'; monthInput.style.display = 'none'; yearInput.style.display = 'none'; header.textContent = 'Daily'; }
  else if (type === 'monthly') { dateInput.style.display = 'none'; monthInput.style.display = 'block'; yearInput.style.display = 'none'; header.textContent = 'Monthly'; }
  else { dateInput.style.display = 'none'; monthInput.style.display = 'none'; yearInput.style.display = 'block'; header.textContent = 'Yearly'; }
  renderReports();
}

function renderReports() {
  const appState = state;
  if (!document.getElementById('repRevenue')) return;
  let filterDate = '';
  if (reportType === 'daily') filterDate = document.getElementById('reportDate').value;
  else if (reportType === 'monthly') filterDate = document.getElementById('reportMonth').value;
  else filterDate = document.getElementById('reportYear').value;
  const headerEl = document.getElementById('reportHeader');
  if (headerEl) headerEl.textContent = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} (${filterDate})`;
  let branchFilter = 'all';
  if (appState.plan === 'pro' && document.getElementById('reportBranch')) branchFilter = document.getElementById('reportBranch').value;
  let filteredSales = allSales.filter(s => { if (reportType === 'daily') return s.date === filterDate; return s.date && s.date.startsWith(filterDate); });
  let filteredExpenses = allExpenses.filter(e => { if (reportType === 'daily') return e.date === filterDate; return e.date && e.date.startsWith(filterDate); });
  if (branchFilter !== 'all') { filteredSales = filteredSales.filter(s => s.branch === branchFilter); filteredExpenses = filteredExpenses.filter(e => e.branch === branchFilter); }
  const totalPaid = filteredSales.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const totalUnpaid = filteredSales.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const cashSales = filteredSales.filter(s => s.paymentType === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferSales = filteredSales.filter(s => s.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const creditSales = filteredSales.filter(s => s.paymentType === 'credit').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const profit = totalPaid - totalExpenses;
  document.getElementById('repRevenue').textContent = money(totalPaid);
  document.getElementById('repExpenses').textContent = money(totalExpenses);
  document.getElementById('repProfit').textContent = money(profit);
  document.getElementById('repUnpaid').textContent = money(totalUnpaid);
  document.getElementById('repCash').textContent = money(cashSales);
  document.getElementById('repTransfer').textContent = money(transferSales);
  document.getElementById('repCredit').textContent = money(creditSales);
  const itemSales = {};
  filteredSales.forEach(s => { (s.items || []).forEach(it => { if (!itemSales[it.name]) itemSales[it.name] = { name: it.name, qty: 0, revenue: 0 }; itemSales[it.name].qty += it.qty || 0; itemSales[it.name].revenue += it.total || (it.price * it.qty) || 0; }); });
  const topItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const tbody = document.getElementById('topSellingBody');
  if (tbody) { if (topItems.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ሽያጭ የለም</td></tr>'; else tbody.innerHTML = topItems.map((it, i) => `<tr><td style="padding:10px; border-bottom:1px solid var(--border);">${i + 1}</td><td style="padding:10px; border-bottom:1px solid var(--border); font-weight:600;">${esc(it.name)}</td><td style="padding:10px; border-bottom:1px solid var(--border);">${it.qty}</td><td style="padding:10px; border-bottom:1px solid var(--border); font-weight:700; color:var(--success);">${money(it.revenue)}</td></tr>`).join(''); }
}

// ═══════════════════════════════════════════
// ⚙️ SETTINGS
// ═══════════════════════════════════════════
async function saveSettings() {
  const appState = state;
  const name = document.getElementById('settingBizName').value.trim();
  const phone = document.getElementById('settingBizPhone').value.trim();
  const lowStock = parseInt(document.getElementById('settingLowStock').value) || 10;
  try {
    await updateDoc(doc(db, 'tenants', appState.tenantId), { name, phone, lowStockThreshold: lowStock });
    showToast('✅ Settings ተቀምጧል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 🔢 PAGINATION
// ═══════════════════════════════════════════
function renderPagination(containerId, totalItems, currentPage, perPage, onPageChange, onPerPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  el.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;"><span style="font-size:12px; color:var(--text-muted);">Show</span><select onchange="(${onPerPageChange.toString()})(parseInt(this.value))" style="width:auto; padding:4px 8px; font-size:12px; border-radius:6px;">${[10, 25, 50].map(n => `<option value="${n}" ${n === perPage ? 'selected' : ''}>${n}</option>`).join('')}</select><span style="font-size:12px; color:var(--text-muted);">| ${totalItems} total | Page ${currentPage} of ${totalPages}</span><button onclick="(${onPageChange.toString()})(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); cursor:pointer;">← Prev</button><button onclick="(${onPageChange.toString()})(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} style="padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); cursor:pointer;">Next →</button></div>`;
}

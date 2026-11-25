// js/modules/bakery.js
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allServices = [];
let allSales = [];
let allExpenses = [];
let allPurchases = [];
let cart = [];
let editingServiceId = null;
let servicePage = 1, expensesPage = 1;
let servicePerPage = 10, expensesPerPage = 10;
let expenseDateFilter = 'recent';
let reportType = 'daily';
let unsubBranches = null, unsubServices = null, unsubSales = null, unsubExpenses = null, unsubPurchases = null;
let openCategories = new Set();

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const BakeryModule = {
  name: 'Bakery',
  icon: '🍞',
    navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel2', label: 'New Sale', icon: '🛒' },
    { id: 'panelQuickSale', label: 'Quick', icon: '⚡' },
    { id: 'panel1', label: 'Items', icon: '🍞' },
    { id: 'panel6', label: 'Reports', icon: '📊' },
    { id: 'panel8', label: 'Settings', icon: '⚙️' },
    { id: 'panelPurchases', label: 'Purchases', icon: '📥' },
    { id: 'panel4', label: 'Expenses', icon: '💸' }
  ],
  panels: [
    { id: 'panelMobileHome', html: `
      <div class="mobile-summary-card">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 16px; opacity: 0.9;">📅 Today's Summary</div>
        <div class="mobile-summary-row">
          <div class="mobile-summary-item">
            <div class="lbl">Sales</div>
            <div class="val green" id="mobTodaySales">0.00</div>
          </div>
          <div class="mobile-summary-item">
            <div class="lbl">Expenses</div>
            <div class="val red" id="mobTodayExpenses">0.00</div>
          </div>
          <div class="mobile-summary-item">
            <div class="lbl">Profit</div>
            <div class="val blue" id="mobTodayProfit">0.00</div>
          </div>
        </div>
      </div>
      <h3 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-bottom: 16px;">⚡ Quick Actions</h3>
      <div class="qa-grid">
        <div class="qa-card" onclick="switchPage('panel2', null)">
          <div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">🛒</div>
          <div class="qa-title">New Sale</div>
        </div>
        <div class="qa-card" onclick="switchPage('panelQuickSale', null)">
          <div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">⚡</div>
          <div class="qa-title">Quick Sale</div>
        </div>
        <div class="qa-card" onclick="switchPage('panel1', null)">
          <div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">🍞</div>
          <div class="qa-title">Items (Stock)</div>
        </div>
        <div class="qa-card" onclick="switchPage('panelPurchases', null)">
          <div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">📥</div>
          <div class="qa-title">Purchases</div>
        </div>
        <div class="qa-card" onclick="switchPage('panel4', null)">
          <div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div>
          <div class="qa-title">Expenses</div>
        </div>
        <div class="qa-card" onclick="switchPage('panel6', null)">
          <div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📊</div>
          <div class="qa-title">Reports</div>
        </div>
      </div>
    `},
    { id: 'panel1', html: `
      <div class="card">
        <div class="card-title">
          <span>🍞 Bakery Items</span>
          <button class="btn btn-primary btn-sm" onclick="openServiceModal()">➕ Add Item</button>
        </div>
        <div class="filter-bar">
          <input type="text" id="searchService" placeholder="🔍 Search item..." oninput="servicePage=1; window.renderServiceList()">
        </div>
        <div id="serviceListContainer"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px;">
          <div class="summary-box blue" style="margin-bottom:0;">
            <div class="label">Total Quantity</div>
            <div class="value" id="totalStockQty" style="font-size:20px;">0</div>
          </div>
          <div class="summary-box green" style="margin-bottom:0;">
            <div class="label">Stock Value (ETB)</div>
            <div class="value" id="totalStockValue" style="font-size:20px;">0.00</div>
          </div>
        </div>
        <div class="pagination-controls" id="servicePagination"></div>
      </div>
    `},
    { id: 'panel2', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;">
              <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
              <select id="orderBranch" style="margin-bottom:8px;"></select>
            </div>
            <label class="field-label" style="margin-top:0;">📅 Date *</label>
            <input type="date" id="orderDate" style="margin-bottom:8px;">
            <label class="field-label">💳 Payment Type</label>
            <select id="orderPaymentType" style="margin-bottom:8px;">
              <option value="cash">💵 Cash</option>
              <option value="transfer">🏦 Transfer</option>
            </select>
          </div>
          <div class="pos-cart-items" id="cartList"></div>
          <div class="pos-cart-footer">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-size:14px; font-weight:700;">Total:</span>
              <span id="cartTotal" style="font-size:20px; font-weight:800; color:var(--primary);">0.00 ETB</span>
            </div>
            <label class="field-label" style="margin-top:0;">💰 Paid Amount</label>
            <input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.updateUnpaidDisplay()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.completeOrder()">💸 Complete Sale</button>
            <button class="btn btn-outline" onclick="window.clearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header">
            <input type="text" id="searchProduct" placeholder="🔍 Search item..." oninput="window.renderPOSProducts()" style="padding:12px 16px;">
          </div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},
    { id: 'panelQuickSale', html: `
      <div class="card">
        <div class="card-title"><span>⚡ Quick Sale (Direct Income)</span></div>
        <div style="background:rgba(59,130,246,0.08); color:var(--info); padding:12px; border-radius:8px; margin-bottom:16px; font-size:13px;">
          💡 ያለ ምርት ምርጫ በቀጥታ ጠቅላላ ገቢ ለመመዝገብ።
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <div>
            <label class="field-label">📅 Date</label>
            <input type="date" id="quickDate">
            <label class="field-label" style="margin-top:12px;">📁 Category</label>
            <input list="quickCatList" id="quickCategory" placeholder="e.g. ዳቦ ሽያጭ">
            <datalist id="quickCatList">
              <option value="ዳቦ ሽያጭ">
              <option value="ኬክ ሽያጭ">
              <option value="ብስኩት ሽያጭ">
              <option value="ሌላ ሽያጭ">
            </datalist>
            <div id="quickBranchSection" style="display:none; margin-top:12px;">
              <label class="field-label">🏢 Branch</label>
              <select id="quickBranch"></select>
            </div>
          </div>
          <div>
            <label class="field-label">💰 Amount (ETB)</label>
            <input type="number" id="quickAmount" placeholder="0.00" step="any">
            <button class="btn btn-success" style="width:auto; padding:12px 32px; float:right; margin-top:16px;" onclick="window.addQuickSale()">+ Add Income</button>
            <div style="clear:both;"></div>
          </div>
        </div>
      </div>
    `},
    { id: 'panelPurchases', html: `
      <div class="card">
        <div class="card-title"><span>📥 Purchases (Stock In)</span></div>
        <div style="background:var(--bg); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border);">
          <label class="field-label" style="margin-top:0;">🍞 Item *</label>
          <select id="purchaseItem"></select>
          <label class="field-label">📅 Date *</label>
          <input type="date" id="purchaseDate">
          <label class="field-label">📦 Quantity Added *</label>
          <input type="number" id="purchaseQty" placeholder="50">
          <label class="field-label">💰 Cost per Item (ETB)</label>
          <input type="number" id="purchaseCost" placeholder="15.00" step="any">
          <button class="btn btn-success" onclick="window.savePurchase()" style="margin-top:16px;">💾 Save Purchase</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Purchases</h4>
        <div id="purchasesList"></div>
      </div>
    `},
    { id: 'panel4', html: `
      <div class="card">
        <div class="card-title"><span>💸 Expenses</span></div>
        <div style="background:var(--bg); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border);">
          <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">➕ Add Expense</h4>
          <div id="expBranchSection" style="display:none; margin-bottom:12px;">
            <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
            <select id="expBranch"></select>
          </div>
          <label class="field-label" style="margin-top:0;">📁 Category *</label>
          <input list="expenseCategoryList" id="expCategory" placeholder="e.g. 🏠 Rent">
          <datalist id="expenseCategoryList">
            <option value="🏠 Rent">
            <option value="⚡ Electricity">
            <option value="💧 Water">
            <option value="🌐 Internet">
            <option value="👥 Salary">
            <option value="🚚 Transport">
            <option value="🌾 Flour">
          </datalist>
          <label class="field-label">💰 Amount (ETB) *</label>
          <input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label>
          <input type="date" id="expDate">
          <label class="field-label">📝 Note</label>
          <input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.addExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar">
          <input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="expensesPage=1; window.renderExpenses()">
        </div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.setExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;">
          <input type="date" id="expenseFilterDate" oninput="window.changeExpenseDate()">
          <input type="month" id="expenseFilterMonth" oninput="window.changeExpenseDate()" style="display:none;">
        </div>
        <div id="expenseList"></div>
        <div class="pagination-controls" id="expensesPagination"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px;">
          <div class="summary-box red" style="margin-bottom:0;">
            <div class="label">This Month</div>
            <div class="value" id="expMonthTotal" style="font-size:20px;">0.00</div>
          </div>
          <div class="summary-box red" style="margin-bottom:0;">
            <div class="label">All Time</div>
            <div class="value" id="expAllTotal" style="font-size:20px;">0.00</div>
          </div>
        </div>
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
        <div id="reportBranchSection" style="display:none; margin-bottom:16px;">
          <label class="field-label" style="margin-top:0;">🏢 Branch Filter</label>
          <select id="reportBranch" onchange="window.renderReports()"><option value="all">📊 All Branches</option></select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div class="summary-box green" style="margin-bottom:0;"><div class="label">Revenue</div><div class="value" id="repRevenue" style="font-size:20px;">0.00</div></div>
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">Expenses</div><div class="value" id="repExpenses" style="font-size:20px;">0.00</div></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div class="summary-box blue" style="margin-bottom:0;"><div class="label">Profit</div><div class="value" id="repProfit" style="font-size:20px;">0.00</div></div>
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">Unpaid</div><div class="value" id="repUnpaid" style="font-size:20px;">0.00</div></div>
        </div>
        <div class="payment-breakdown">
          <div class="payment-breakdown-item cash"><div class="label">💵 Cash</div><div class="value" id="repCash">0.00</div></div>
          <div class="payment-breakdown-item transfer"><div class="label">🏦 Transfer</div><div class="value" id="repTransfer">0.00</div></div>
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
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-outline" onclick="window.exportReportCSV()" style="margin-top:0;">📥 CSV</button>
          <button class="btn btn-outline" onclick="window.printReport()" style="margin-top:0;">🖨️ Print</button>
        </div>
      </div>
    `},
    { id: 'panel8', html: `
      <div class="card">
        <div class="card-title"><span>⚙️ Settings</span></div>
        <label class="field-label" style="margin-top:0;">🏢 Business Name</label>
        <input type="text" id="settingBizName" placeholder="Business name">
        <label class="field-label">📞 Phone</label>
        <input type="text" id="settingBizPhone" placeholder="+251...">
        <label class="field-label">📦 Low Stock Threshold</label>
        <input type="number" id="settingLowStock" placeholder="10" value="10">
        <button class="btn btn-primary" onclick="window.saveSettings()">💾 Save Settings</button>
      </div>
      <div class="card" id="branchSettingsCard" style="display:none;">
        <div class="card-title"><span>🏢 Branches <span class="role-badge" style="background:var(--success); border-color:var(--success); margin-left:6px;">PRO</span></span></div>
        <div id="branchAddSection" style="display:flex; gap:10px; margin-bottom:16px;">
          <input type="text" id="newBranchName" placeholder="New branch name..." style="margin:0;">
          <button class="btn btn-primary" onclick="window.addBranch()" style="width:auto; margin-top:0; padding:0 16px;">➕ Add</button>
        </div>
        <div id="branchesList" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
      </div>
      <div class="card">
        <div class="card-title"><span>🎨 Theme</span></div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline" onclick="window.toggleDarkMode(false)" style="margin-top:0;">☀️ Light</button>
          <button class="btn btn-outline" onclick="window.toggleDarkMode(true)" style="margin-top:0;">🌙 Dark</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span>🚪 Account</span></div>
        <button class="btn btn-danger" onclick="window.logout()">Sign Out</button>
      </div>
    `}
  ],
  
  // ═══════════════════════════════════════════
  // 🚀 INIT (አንድ ጊዜ ሲጫን የሚሰራ)
  // ═══════════════════════════════════════════
  init: async (appState) => {
    // Global functions ማዘጋጀት (ለ HTML onclick)
    window.renderServiceList = renderServiceList;
    window.renderPOSProducts = renderPOSProducts;
    window.updateUnpaidDisplay = updateUnpaidDisplay;
    window.renderExpenses = renderExpenses;
    window.changeExpenseDate = changeExpenseDate;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.setReportType = setReportType;
    window.renderReports = renderReports;
    window.openServiceModal = openServiceModal;
    window.closeServiceModal = closeServiceModal;
    window.saveService = saveService;
    window.deleteService = deleteService;
    window.toggleCategory = toggleCategory;
    window.addToCart = addToCart;
    window.updateCartQty = updateCartQty;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.completeOrder = completeOrder;
    window.addQuickSale = addQuickSale;
    window.savePurchase = savePurchase;
    window.addExpense = addExpense;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;
    window.exportReportCSV = exportReportCSV;
    window.printReport = printReport;
    
    // Default Dates
    const today = todayStr();
    if (document.getElementById('orderDate')) document.getElementById('orderDate').value = today;
    if (document.getElementById('expDate')) document.getElementById('expDate').value = today;
    if (document.getElementById('quickDate')) document.getElementById('quickDate').value = today;
    if (document.getElementById('purchaseDate')) document.getElementById('purchaseDate').value = today;
    if (document.getElementById('reportDate')) document.getElementById('reportDate').value = today;
    if (document.getElementById('reportMonth')) document.getElementById('reportMonth').value = thisMonthStr();
    if (document.getElementById('reportYear')) document.getElementById('reportYear').value = thisYearStr();
    if (document.getElementById('expenseFilterDate')) document.getElementById('expenseFilterDate').value = today;
    if (document.getElementById('expenseFilterMonth')) document.getElementById('expenseFilterMonth').value = thisMonthStr();
    if (document.getElementById('settingLowStock')) document.getElementById('settingLowStock').value = appState.lowStockThreshold;

    await loadAllData(appState);
  },

  // ═══════════════════════════════════════════
  // 🔄 ON PAGE CHANGE (ገጽ ሲቀየር)
  // ═══════════════════════════════════════════
  onPageChange: (panelId) => {
    if (panelId === 'panel1') renderServiceList();
    if (panelId === 'panel2') renderPOSProducts();
    if (panelId === 'panel6') renderReports();
    if (panelId === 'panelMobileHome') updateMobileHome();
  },

  // ═══════════════════════════════════════════
  // 🧹 CLEANUP (ሲወጣ)
  // ═══════════════════════════════════════════
  cleanup: () => {
    if (unsubBranches) unsubBranches();
    if (unsubServices) unsubServices();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    if (unsubPurchases) unsubPurchases();
    // Global functions ማጽዳት
    delete window.renderServiceList;
    delete window.renderPOSProducts;
    delete window.updateUnpaidDisplay;
    delete window.renderExpenses;
    delete window.changeExpenseDate;
    delete window.setExpenseDateFilter;
    delete window.setReportType;
    delete window.renderReports;
    delete window.openServiceModal;
    delete window.closeServiceModal;
    delete window.saveService;
    delete window.deleteService;
    delete window.toggleCategory;
    delete window.addToCart;
    delete window.updateCartQty;
    delete window.removeFromCart;
    delete window.clearCart;
    delete window.completeOrder;
    delete window.addQuickSale;
    delete window.savePurchase;
    delete window.addExpense;
    delete window.saveSettings;
    delete window.addBranch;
    delete window.deleteBranch;
    delete window.exportReportCSV;
    delete window.printReport;
  }
};

// ═══════════════════════════════════════════
// 📥 DATA LOADING (Firestore Listeners)
// ═══════════════════════════════════════════
async function loadAllData(appState) {
  if (!appState.tenantId) return;

  unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', appState.tenantId)), snap => {
    allBranches = []; snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
    renderBranchSettings(appState);
    updateBranchDropdowns(appState);
  });

  unsubServices = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', appState.tenantId)), snap => {
    allServices = []; snap.forEach(d => allServices.push({ id: d.id, ...d.data() }));
    allServices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderServiceList();
    renderPOSProducts();
    updateServiceCategories();
  });

  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', appState.tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderReports();
    updateMobileHome();
  });

  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', appState.tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses();
    renderReports();
    updateMobileHome();
  });

  unsubPurchases = onSnapshot(query(collection(db, 'purchases'), where('tenantId', '==', appState.tenantId)), snap => {
    allPurchases = []; snap.forEach(d => allPurchases.push({ id: d.id, ...d.data() }));
    allPurchases.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPurchases();
    populatePurchaseItems();
  });
}

// ═══════════════════════════════════════════
// 🧠 HELPER FUNCTIONS (Local to Module)
// ═══════════════════════════════════════════
function updateMobileHome() {
  const today = todayStr();
  const todaySales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const todayProfit = todaySales - todayExpenses;
  const el1 = document.getElementById('mobTodaySales');
  const el2 = document.getElementById('mobTodayExpenses');
  const el3 = document.getElementById('mobTodayProfit');
  if (el1) el1.textContent = money(todaySales);
  if (el2) el2.textContent = money(todayExpenses);
  if (el3) el3.textContent = money(todayProfit);
}

function updateServiceCategories() {
  const cats = [...new Set(allServices.map(s => s.category).filter(Boolean))];
  const dl = document.getElementById('serviceCategoryList');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
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
  
  const posSec = document.getElementById('posBranchSection');
  const posSel = document.getElementById('orderBranch');
  if (posSec) posSec.style.display = hasBranches ? 'block' : 'none';
  if (hasBranches && posSel) posSel.innerHTML = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');

  const srvSec = document.getElementById('serviceBranchSection');
  const srvSel = document.getElementById('serviceBranch');
  if (srvSec) srvSec.style.display = hasBranches ? 'block' : 'none';
  if (hasBranches && srvSel) srvSel.innerHTML = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');

  const expSec = document.getElementById('expBranchSection');
  const expSel = document.getElementById('expBranch');
  if (expSec) expSec.style.display = hasBranches ? 'block' : 'none';
  if (hasBranches && expSel) expSel.innerHTML = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');

  const repSec = document.getElementById('reportBranchSection');
  const repSel = document.getElementById('reportBranch');
  if (repSec) repSec.style.display = hasBranches ? 'block' : 'none';
  if (hasBranches && repSel) {
    const currentVal = repSel.value;
    repSel.innerHTML = '<option value="all">📊 All Branches</option>' + allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
    if (currentVal) repSel.value = currentVal;
  }

  const quickSec = document.getElementById('quickBranchSection');
  const quickSel = document.getElementById('quickBranch');
  if (quickSec) quickSec.style.display = hasBranches ? 'block' : 'none';
  if (hasBranches && quickSel) quickSel.innerHTML = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
}

async function addBranch() {
  const appState = state;
  if (appState.plan !== 'pro') return showToast('Pro plan ብቻ!', 'error');
  const name = document.getElementById('newBranchName').value.trim();
  if (!name) return showToast('የቅርንጫፍ ስም ያስፈልጋል', 'error');
  if (allBranches.find(b => b.name.toLowerCase() === name.toLowerCase())) return showToast('ይህ ቅርንጫፍ አስቀድሞ አለ', 'error');
  try {
    await addDoc(collection(db, 'branches'), { tenantId: appState.tenantId, name: name, createdAt: serverTimestamp() });
    document.getElementById('newBranchName').value = '';
    showToast('✅ ቅርንጫፍ ተጨምሯል');
  } catch(e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteBranch(id, name) {
  if (name === 'Main') return showToast('Main ማጥፋት አይቻልም', 'error');
  if (!confirm(`"${name}" ቅርንጫፍን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'branches', id)); showToast('✅ ተጠፍቷል'); } catch(e) { showToast('❌ ስህተት', 'error'); }
}

// ═══════════════════════════════════════════
// 🍞 ITEMS (Stock Management)
// ═══════════════════════════════════════════
function openServiceModal(id = null) {
  editingServiceId = id;
  updateServiceCategories();
  if (id) {
    const s = allServices.find(x => x.id === id);
    if (!s) return;
    document.getElementById('serviceModalTitle').textContent = '✏️ Edit Item';
    document.getElementById('serviceCategory').value = s.category || '';
    document.getElementById('serviceName').value = s.name || '';
    document.getElementById('servicePrice').value = s.price || '';
    document.getElementById('serviceStock').value = s.quantity || 0;
    document.getElementById('saveServiceBtn').textContent = '💾 Update';
  } else {
    document.getElementById('serviceModalTitle').textContent = '➕ Add Item';
    document.getElementById('serviceCategory').value = '';
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
    document.getElementById('serviceStock').value = '';
    document.getElementById('saveServiceBtn').textContent = '💾 Save';
  }
  document.getElementById('serviceModal').classList.add('open');
}

function closeServiceModal() {
  document.getElementById('serviceModal').classList.remove('open');
  editingServiceId = null;
}

async function saveService() {
  const appState = state;
  const category = document.getElementById('serviceCategory').value.trim();
  const name = document.getElementById('serviceName').value.trim();
  const price = parseFloat(document.getElementById('servicePrice').value);
  const stock = parseInt(document.getElementById('serviceStock').value) || 0;
  const branch = appState.plan === 'pro' ? document.getElementById('serviceBranch').value : 'Main';

  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Item Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');

  try {
    if (editingServiceId) {
      await updateDoc(doc(db, 'products', editingServiceId), { category, name, price, quantity: stock, branch });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), { tenantId: appState.tenantId, category, name, price, quantity: stock, branch, createdAt: serverTimestamp() });
      showToast('✅ ተጨምሯል');
    }
    closeServiceModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteService(id) {
  const s = allServices.find(x => x.id === id);
  if (!confirm(`"${s?.name}" ን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

function toggleCategory(catName) {
  if (openCategories.has(catName)) openCategories.delete(catName);
  else openCategories.add(catName);
  renderServiceList();
}

function renderServiceList() {
  const container = document.getElementById('serviceListContainer');
  if (!container) return;
  const search = (document.getElementById('searchService')?.value || '').toLowerCase();
  let filtered = allServices;
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search));
  
  const totalQty = allServices.reduce((s, x) => s + (x.quantity || 0), 0);
  const totalVal = allServices.reduce((s, x) => s + ((x.quantity || 0) * (x.price || 0)), 0);
  if (document.getElementById('totalStockQty')) document.getElementById('totalStockQty').textContent = totalQty;
  if (document.getElementById('totalStockValue')) document.getElementById('totalStockValue').textContent = money(totalVal);
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:48px; margin-bottom:12px;">🍞</div><div style="font-weight:600;">ምንም ዕቃ የለም</div></div>`;
    renderPagination('servicePagination', 0, servicePage, servicePerPage, (page) => { servicePage = page; renderServiceList(); }, (perPage) => { servicePerPage = perPage; servicePage = 1; renderServiceList(); });
    return;
  }
  
  const totalPages = Math.ceil(filtered.length / servicePerPage);
  if (servicePage > totalPages) servicePage = totalPages;
  const start = (servicePage - 1) * servicePerPage;
  const paginated = filtered.slice(start, start + servicePerPage);
  
  const grouped = {};
  paginated.forEach(s => {
    const cat = s.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });
  
  container.innerHTML = Object.keys(grouped).sort().map(cat => {
    const items = grouped[cat].sort((a,b) => a.name.localeCompare(b.name));
    const isOpen = openCategories.has(cat) || (search && search.length > 0);
    return `
      <div class="category-collapsible ${isOpen ? 'open' : ''}">
        <div class="category-header" onclick="window.toggleCategory('${escJs(cat)}')">
          <div class="category-header-left"><span class="category-arrow">▶</span><span class="category-name">📁 ${esc(cat)}</span><span class="category-count">${items.length}</span></div>
        </div>
        <div class="category-body">
          ${items.map(s => {
            const isLow = (s.quantity || 0) <= state.lowStockThreshold;
            return `
            <div class="item-row">
              <div class="item-row-name">🍞 ${esc(s.name)}<div style="font-size:11px; color:${isLow ? 'var(--danger)' : 'var(--success)'}; font-weight:700; margin-top:2px;">${isLow ? '⚠️' : '✅'} Stock: ${s.quantity || 0}</div></div>
              <div class="item-row-price">${money(s.price)} ETB</div>
              <div style="display:flex; gap:4px;">
                <button class="action-btn btn-edit" onclick="event.stopPropagation(); window.openServiceModal('${s.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteService('${s.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  
  renderPagination('servicePagination', filtered.length, servicePage, servicePerPage, (page) => { servicePage = page; renderServiceList(); }, (perPage) => { servicePerPage = perPage; servicePage = 1; renderServiceList(); });
}

// ═══════════════════════════════════════════
// 🛒 POS
// ═══════════════════════════════════════════
function renderPOSProducts() {
  const listEl = document.getElementById('sellProductList');
  if (!listEl) return;
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let filtered = allServices.filter(s => (s.quantity || 0) > 0);
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search));
  
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">ምንም ዕቃ የለም (ወይም ስቶክ አልቋል)</div>';
    return;
  }
  
  listEl.innerHTML = filtered.sort((a,b) => a.name.localeCompare(b.name)).map(s => `
    <div class="product-card" onclick="window.addToCart('${s.id}')">
      <div><div class="p-name">${esc(s.name)}</div><div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Stock: ${s.quantity || 0}</div></div>
      <div class="p-price">${money(s.price)} ETB</div>
    </div>
  `).join('');
}

function addToCart(id) {
  const s = allServices.find(x => x.id === id);
  if (!s) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    if (existing.qty + 1 > s.quantity) return showToast('በቂ ስቶክ የለም', 'error');
    existing.qty++;
  } else {
    cart.push({ id, name: s.name, price: s.price, qty: 1, maxQty: s.quantity });
  }
  renderCart();
}

function updateCartQty(i, delta) {
  const item = cart[i];
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(i, 1); renderCart(); return; }
  if (newQty > item.maxQty) return showToast('በቂ ስቶክ የለም', 'error');
  item.qty = newQty;
  renderCart();
}

function removeFromCart(i) { cart.splice(i, 1); renderCart(); }
function clearCart() { cart = []; renderCart(); }

function renderCart() {
  const el = document.getElementById('cartList');
  if (!el) return;
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
  const paid = parseFloat(document.getElementById('orderPaid')?.value) || 0;
  const unpaid = Math.max(0, total - paid);
  const el = document.getElementById('unpaidDisplay');
  if (el) el.textContent = `📝 Unpaid: ${money(unpaid)} ETB`;
}

async function completeOrder() {
  const appState = state;
  const orderDate = document.getElementById('orderDate').value;
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  const branch = appState.plan === 'pro' ? document.getElementById('orderBranch').value : 'Main';

  if (!orderDate) return showToast('ቀን ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');

  try {
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    await addDoc(collection(db, 'sales'), { tenantId: appState.tenantId, date: orderDate, items, total, paidAmount: paid, unpaidAmount: total - paid, paymentType, branch, createdAt: serverTimestamp() });
    for (const c of cart) { await updateDoc(doc(db, 'products', c.id), { quantity: increment(-c.qty) }); }
    showToast('✅ Sale ተመዝግቧል');
    cart = []; renderCart();
    document.getElementById('orderPaid').value = '';
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('orderPaymentType').value = 'cash';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
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
    await addDoc(collection(db, 'sales'), {
      tenantId: appState.tenantId, date, items: [{ name: category, qty: 1, price: amount, total: amount }], total: amount, paidAmount: amount, unpaidAmount: 0, paymentType: 'cash', branch, createdAt: serverTimestamp(), isQuickSale: true
    });
    showToast('✅ Quick Sale ተመዝግቧል');
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickCategory').value = '';
    document.getElementById('quickDate').value = todayStr();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 📥 PURCHASES
// ═══════════════════════════════════════════
function populatePurchaseItems() {
  const sel = document.getElementById('purchaseItem');
  if (!sel) return;
  sel.innerHTML = allServices.map(s => `<option value="${s.id}">${esc(s.name)} (Stock: ${s.quantity || 0})</option>`).join('');
}

function renderPurchases() {
  const el = document.getElementById('purchasesList');
  if (!el) return;
  if (allPurchases.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ግዢ የለም</div>';
    return;
  }
  el.innerHTML = allPurchases.slice(0, 10).map(p => `
    <div class="item-row">
      <div class="item-row-name">📦 ${esc(p.itemName || 'Item')} <div style="font-size:11px; color:var(--text-muted);">${p.date} • Qty: ${p.quantity} • ${money(p.cost)} ETB</div></div>
      <div class="item-row-price">${money(p.totalCost)} ETB</div>
    </div>
  `).join('');
}

async function savePurchase() {
  const appState = state;
  const itemId = document.getElementById('purchaseItem').value;
  const date = document.getElementById('purchaseDate').value;
  const qty = parseInt(document.getElementById('purchaseQty').value);
  const cost = parseFloat(document.getElementById('purchaseCost').value) || 0;

  if (!itemId) return showToast('ዕቃ ይምረጡ', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(qty) || qty <= 0) return showToast('ትክክል ያለው ብዛት ያስፈልጋል', 'error');

  const item = allServices.find(s => s.id === itemId);
  if (!item) return;

  try {
    await addDoc(collection(db, 'purchases'), {
      tenantId: appState.tenantId, itemId, itemName: item.name, date, quantity: qty, cost, totalCost: qty * cost, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'products', itemId), { quantity: increment(qty) });
    showToast('✅ ግዢ ተመዝግቧል');
    document.getElementById('purchaseQty').value = '';
    document.getElementById('purchaseCost').value = '';
    document.getElementById('purchaseDate').value = todayStr();
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

function changeExpenseDate() { expensesPage = 1; renderExpenses(); }

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
  expensesPage = 1;
  renderExpenses();
}

function renderExpenses() {
  const el = document.getElementById('expenseList');
  if (!el) return;

  let filtered = allExpenses;
  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  if (search) filtered = filtered.filter(e => (e.category || '').toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search));

  const today = todayStr();
  const currentMonth = thisMonthStr();
  if (expenseDateFilter === 'date') {
    const d = document.getElementById('expenseFilterDate').value;
    filtered = filtered.filter(e => e.date === d);
  } else if (expenseDateFilter === 'month') {
    const m = document.getElementById('expenseFilterMonth').value;
    filtered = filtered.filter(e => e.date && e.date.startsWith(m));
  } else if (expenseDateFilter === 'recent') {
    filtered = filtered.slice(0, 20);
  }

  filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const totalPages = Math.ceil(filtered.length / expensesPerPage);
  if (expensesPage > totalPages) expensesPage = totalPages || 1;
  const start = (expensesPage - 1) * expensesPerPage;
  const paginated = filtered.slice(start, start + expensesPerPage);

  if (paginated.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ወጪ የለም</div>';
  } else {
    el.innerHTML = paginated.map(e => `
      <div class="item-row">
        <div class="item-row-name">${esc(e.category)}<div style="font-size:11px; color:var(--text-muted);">${e.date} ${e.note ? '• ' + esc(e.note) : ''}</div></div>
        <div class="item-row-price" style="color:var(--danger);">${money(e.amount)} ETB</div>
      </div>
    `).join('');
  }

  const monthTotal = allExpenses.filter(e => e.date && e.date.startsWith(currentMonth)).reduce((s, e) => s + e.amount, 0);
  const allTotal = allExpenses.reduce((s, e) => s + e.amount, 0);
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(monthTotal);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allTotal);

  renderPagination('expensesPagination', filtered.length, expensesPage, expensesPerPage, (page) => { expensesPage = page; renderExpenses(); }, (perPage) => { expensesPerPage = perPage; expensesPage = 1; renderExpenses(); });
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
  let headerText = '';
  if (reportType === 'daily') { filterDate = document.getElementById('reportDate').value; headerText = `Daily (${filterDate})`; }
  else if (reportType === 'monthly') { filterDate = document.getElementById('reportMonth').value; headerText = `Monthly (${filterDate})`; }
  else { filterDate = document.getElementById('reportYear').value; headerText = `Yearly (${filterDate})`; }
  const headerEl = document.getElementById('reportHeader');
  if (headerEl) headerEl.textContent = headerText;

  let branchFilter = 'all';
  if (appState.plan === 'pro' && document.getElementById('reportBranch')) branchFilter = document.getElementById('reportBranch').value;

  let filteredSales = allSales.filter(s => {
    if (reportType === 'daily') return s.date === filterDate;
    if (reportType === 'monthly') return s.date && s.date.startsWith(filterDate);
    return s.date && s.date.startsWith(filterDate);
  });
  let filteredExpenses = allExpenses.filter(e => {
    if (reportType === 'daily') return e.date === filterDate;
    if (reportType === 'monthly') return e.date && e.date.startsWith(filterDate);
    return e.date && e.date.startsWith(filterDate);
  });

  if (branchFilter !== 'all') {
    filteredSales = filteredSales.filter(s => s.branch === branchFilter);
    filteredExpenses = filteredExpenses.filter(e => e.branch === branchFilter);
  }

  const totalRevenue = filteredSales.reduce((s, o) => s + (o.total || 0), 0);
  const totalPaid = filteredSales.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const totalUnpaid = filteredSales.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const cashSales = filteredSales.filter(s => s.paymentType === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferSales = filteredSales.filter(s => s.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const profit = totalPaid - totalExpenses;

  document.getElementById('repRevenue').textContent = money(totalPaid);
  document.getElementById('repExpenses').textContent = money(totalExpenses);
  document.getElementById('repProfit').textContent = money(profit);
  document.getElementById('repUnpaid').textContent = money(totalUnpaid);
  document.getElementById('repCash').textContent = money(cashSales);
  document.getElementById('repTransfer').textContent = money(transferSales);

  const itemSales = {};
  filteredSales.forEach(s => {
    (s.items || []).forEach(it => {
      if (!itemSales[it.name]) itemSales[it.name] = { name: it.name, qty: 0, revenue: 0 };
      itemSales[it.name].qty += it.qty || 0;
      itemSales[it.name].revenue += it.total || (it.price * it.qty) || 0;
    });
  });
  const topItems = Object.values(itemSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const tbody = document.getElementById('topSellingBody');
  if (tbody) {
    if (topItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ሽያጭ የለም</td></tr>';
    } else {
      tbody.innerHTML = topItems.map((it, i) => `
        <tr>
          <td style="padding:10px; border-bottom:1px solid var(--border);">${i + 1}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border); font-weight:600;">${esc(it.name)}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border);">${it.qty}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border); font-weight:700; color:var(--success);">${money(it.revenue)}</td>
        </tr>
      `).join('');
    }
  }
}

function exportReportCSV() {
  let csv = 'Report Type,Date Range,Revenue,Expenses,Profit,Unpaid\n';
  csv += `${reportType},...`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `report_${todayStr()}.csv`; a.click();
  showToast('✅ CSV ወርዷል');
}

function printReport() {
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Report</title></head><body>');
  printWindow.document.write('<h1>Business Report</h1>');
  printWindow.document.write('<p>Date: ' + todayStr() + '</p>');
  printWindow.document.write('<p>Revenue: ' + document.getElementById('repRevenue').textContent + '</p>');
  printWindow.document.write('<p>Expenses: ' + document.getElementById('repExpenses').textContent + '</p>');
  printWindow.document.write('<p>Profit: ' + document.getElementById('repProfit').textContent + '</p>');
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
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
// 🔢 PAGINATION (Helper)
// ═══════════════════════════════════════════
function renderPagination(containerId, totalItems, currentPage, perPage, onPageChange, onPerPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalItems === 0) { el.innerHTML = ''; return; }

  let html = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
    <span style="font-size:12px; color:var(--text-muted);">Show</span>
    <select onchange="(${onPerPageChange.toString()})(parseInt(this.value))" style="width:auto; padding:4px 8px; font-size:12px; border-radius:6px;">
      ${[10, 25, 50].map(n => `<option value="${n}" ${n === perPage ? 'selected' : ''}>${n}</option>`).join('')}
    </select>
    <span style="font-size:12px; color:var(--text-muted);">| ${totalItems} total | Page ${currentPage} of ${totalPages}</span>
    <button onclick="(${onPageChange.toString()})(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); cursor:pointer;">← Prev</button>
    <button onclick="(${onPageChange.toString()})(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} style="padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); cursor:pointer;">Next →</button>
  </div>`;
  el.innerHTML = html;
}

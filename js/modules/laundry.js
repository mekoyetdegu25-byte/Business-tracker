// js/modules/laundry.js
import { db } from '../firebase.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allServices = [];
let allSales = [];
let allExpenses = [];
let allCustomers = [];
let cart = [];
let editingServiceId = null;
let editingCustomerName = null;
let currentCustomerName = null;

let servicePage = 1, ordersPage = 1, customersPage = 1, expensesPage = 1;
let servicePerPage = 10, ordersPerPage = 10, customersPerPage = 10, expensesPerPage = 10;

let orderDateFilter = 'recent';
let orderStatusFilter = 'all';
let expenseDateFilter = 'recent';
let reportType = 'daily';
let openCategories = new Set();

let unsubBranches = null, unsubServices = null, unsubSales = null, unsubExpenses = null, unsubCustomers = null;

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const LaundryModule = {
  name: 'Laundry',
  icon: '🧺',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel2', label: 'New Order', icon: '🧺' },
    { id: 'panel3', label: 'Orders', icon: '📜' },
    { id: 'panelCustomers', label: 'Customers', icon: '👥' },
    { id: 'panel1', label: 'Price List', icon: '🏷️' },
    { id: 'panel6', label: 'Reports', icon: '📊' },
    { id: 'panel8', label: 'Settings', icon: '⚙️' },
    { id: 'panel4', label: 'Expenses', icon: '💸' } // ከ6 በኋላ ስለሆነ በሞባይል አይታይም
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
        <div class="qa-card" onclick="switchPage('panel2', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">🧺</div><div class="qa-title">New Order</div></div>
        <div class="qa-card" onclick="switchPage('panel1', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">🏷️</div><div class="qa-title">Price List</div></div>
        <div class="qa-card" onclick="switchPage('panel3', null)"><div class="qa-icon" style="background:rgba(16,185,129,0.1); color:var(--success);">📜</div><div class="qa-title">Orders</div></div>
        <div class="qa-card" onclick="switchPage('panelCustomers', null)"><div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">👥</div><div class="qa-title">Customers</div></div>
        <div class="qa-card" onclick="switchPage('panel4', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div><div class="qa-title">Expenses</div></div>
        <div class="qa-card" onclick="switchPage('panel6', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📊</div><div class="qa-title">Reports</div></div>
      </div>
    `},
    { id: 'panel1', html: `
      <div class="card">
        <div class="card-title"><span>🏷️ Price List</span><button class="btn btn-primary btn-sm" onclick="window.openServiceModal()">➕ Add Service</button></div>
        <div class="filter-bar"><input type="text" id="searchService" placeholder="🔍 Search service..." oninput="window.servicePage=1; window.renderServiceList()"></div>
        <div id="serviceListContainer"></div>
        <div class="pagination-controls" id="servicePagination"></div>
      </div>
    `},
    { id: 'panel2', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="orderBranch" style="margin-bottom:8px;"></select></div>
            <label class="field-label" style="margin-top:0;">👤 Customer *</label>
            <input type="text" id="orderCustomer" placeholder="Customer name" list="customerList" style="margin-bottom:8px;">
            <datalist id="customerList"></datalist>
            <label class="field-label">📞 Phone</label>
            <input type="text" id="orderPhone" placeholder="+251..." style="margin-bottom:8px;">
            <label class="field-label">📅 Pickup Date *</label>
            <input type="date" id="orderPickup" style="margin-bottom:8px;">
            <label class="field-label">💳 Payment Type</label>
            <select id="orderPaymentType" style="margin-bottom:8px;"><option value="cash">💵 Cash</option><option value="transfer">🏦 Transfer</option></select>
          </div>
          <div class="pos-cart-items" id="cartList"></div>
          <div class="pos-cart-footer">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span style="font-size:14px; font-weight:700;">Total:</span><span id="cartTotal" style="font-size:20px; font-weight:800; color:var(--primary);">0.00 ETB</span></div>
            <label class="field-label" style="margin-top:0;">💰 Paid Amount</label>
            <input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.updateUnpaidDisplay()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.completeOrder()">💸 Complete Order</button>
            <button class="btn btn-outline" onclick="window.clearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header"><input type="text" id="searchProduct" placeholder="🔍 Search service..." oninput="window.renderPOSProducts()" style="padding:12px 16px;"></div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},
    { id: 'panel3', html: `
      <div class="card">
        <div class="card-title"><span>📜 Orders</span></div>
        <div class="filter-bar"><input type="text" id="searchOrders" placeholder="🔍 Search customer..." oninput="window.ordersPage=1; window.renderOrders()"><select id="orderBranchFilter" onchange="window.filterOrdersByBranch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select></div>
        <div class="date-filter-chips" id="orderDateChips">
          <button class="date-chip active" onclick="window.setOrderDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('all', this)">All</button>
        </div>
        <div id="orderDatePicker" style="display:none; margin-bottom:12px;"><input type="date" id="orderFilterDate" onchange="window.ordersPage=1; window.renderOrders()"><input type="month" id="orderFilterMonth" onchange="window.ordersPage=1; window.renderOrders()" style="display:none;"></div>
        <div class="status-tabs">
          <button class="status-tab active" onclick="window.setOrderStatusFilter('all', this)">All</button>
          <button class="status-tab" onclick="window.setOrderStatusFilter('processing', this)">🟡 Processing</button>
          <button class="status-tab" onclick="window.setOrderStatusFilter('delivered', this)">🟢 Delivered</button>
        </div>
        <div id="ordersList"></div>
        <div class="pagination-controls" id="ordersPagination"></div>
      </div>
    `},
    { id: 'panelCustomers', html: `
      <div class="card">
        <div class="card-title"><span>👥 Customers</span></div>
        <div class="filter-bar"><input type="text" id="searchCustomers" placeholder="🔍 Search customer..." oninput="window.customersPage=1; window.renderCustomersList()"><select id="customerBranchFilter" onchange="window.filterCustomersByBranch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select></div>
        <div id="customersListContainer"></div>
        <div class="pagination-controls" id="customersPagination"></div>
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
          <datalist id="expenseCategoryList"><option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water"><option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport"><option value="📱 Phone"><option value="🔧 Maintenance"><option value="🧴 Detergent"></datalist>
          <label class="field-label">💰 Amount (ETB) *</label><input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label><input type="date" id="expDate">
          <label class="field-label">📝 Note</label><input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.addExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar"><input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="window.expensesPage=1; window.renderExpenses()"></div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.setExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;"><input type="date" id="expenseFilterDate" oninput="window.changeExpenseDate()"><input type="month" id="expenseFilterMonth" oninput="window.changeExpenseDate()" style="display:none;"></div>
        <div id="expenseList"></div>
        <div class="pagination-controls" id="expensesPagination"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px;">
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">This Month</div><div class="value" id="expMonthTotal" style="font-size:20px;">0.00</div></div>
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">All Time</div><div class="value" id="expAllTotal" style="font-size:20px;">0.00</div></div>
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
        <div id="reportDateContainer" style="margin-bottom:16px;"><input type="date" id="reportDate" oninput="window.renderReports()"><input type="month" id="reportMonth" oninput="window.renderReports()" style="display:none;"><input type="number" id="reportYear" placeholder="2026" min="2000" max="2100" oninput="if(this.value.length >= 4) window.renderReports()" style="display:none;"></div>
        <div id="reportBranchSection" style="display:none; margin-bottom:16px;"><label class="field-label" style="margin-top:0;">🏢 Branch Filter</label><select id="reportBranch" onchange="window.renderReports()"><option value="all">📊 All Branches</option></select></div>
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
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-outline" onclick="window.exportReportCSV()" style="margin-top:0;">📥 CSV</button>
          <button class="btn btn-outline" onclick="window.printReport()" style="margin-top:0;">🖨️ Print</button>
        </div>
      </div>
    `},
    { id: 'panel8', html: `
      <div class="card">
        <div class="card-title"><span>⚙️ Settings</span></div>
        <label class="field-label" style="margin-top:0;">🏢 Business Name</label><input type="text" id="settingBizName" placeholder="Business name">
        <label class="field-label">📞 Phone</label><input type="text" id="settingBizPhone" placeholder="+251...">
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
  // 🚀 INIT (አንድ ጊዜ ሲጫን የሚሰራ)
  // ═══════════════════════════════════════════
  init: async (appState) => {
    // Global functions ማዘጋጀት
    window.renderServiceList = renderServiceList;
    window.renderPOSProducts = renderPOSProducts;
    window.updateUnpaidDisplay = updateUnpaidDisplay;
    window.renderOrders = renderOrders;
    window.renderCustomersList = renderCustomersList;
    window.renderExpenses = renderExpenses;
    window.changeExpenseDate = changeExpenseDate;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.setOrderDateFilter = setOrderDateFilter;
    window.setOrderStatusFilter = setOrderStatusFilter;
    window.filterOrdersByBranch = filterOrdersByBranch;
    window.filterCustomersByBranch = filterCustomersByBranch;
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
    window.markDelivered = markDelivered;
    window.markProcessing = markProcessing;
    window.showCustomerProfile = showCustomerProfile;
    window.closeCustomerProfile = closeCustomerProfile;
    window.setPaymentType = setPaymentType;
    window.recordPayment = recordPayment;
    window.editCustomer = editCustomer;
    window.saveEditedCustomer = saveEditedCustomer;
    window.deleteCustomer = deleteCustomer;
    window.addExpense = addExpense;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;
    window.exportReportCSV = exportReportCSV;
    window.printReport = printReport;

    // State ማስተካከል (ከ core የመጣውን መጠቀም)
    window.servicePage = servicePage;
    window.ordersPage = ordersPage;
    window.customersPage = customersPage;
    window.expensesPage = expensesPage;

    // Default Dates
    const today = todayStr();
    if (document.getElementById('orderPickup')) document.getElementById('orderPickup').value = today;
    if (document.getElementById('expDate')) document.getElementById('expDate').value = today;
    if (document.getElementById('reportDate')) document.getElementById('reportDate').value = today;
    if (document.getElementById('reportMonth')) document.getElementById('reportMonth').value = thisMonthStr();
    if (document.getElementById('reportYear')) document.getElementById('reportYear').value = thisYearStr();
    if (document.getElementById('orderFilterDate')) document.getElementById('orderFilterDate').value = today;
    if (document.getElementById('orderFilterMonth')) document.getElementById('orderFilterMonth').value = thisMonthStr();
    if (document.getElementById('expenseFilterDate')) document.getElementById('expenseFilterDate').value = today;
    if (document.getElementById('expenseFilterMonth')) document.getElementById('expenseFilterMonth').value = thisMonthStr();

    await loadAllData(appState);
  },

  onPageChange: (panelId) => {
    if (panelId === 'panel1') renderServiceList();
    if (panelId === 'panel2') renderPOSProducts();
    if (panelId === 'panel3') renderOrders();
    if (panelId === 'panelCustomers') renderCustomersList();
    if (panelId === 'panel4') renderExpenses();
    if (panelId === 'panel6') renderReports();
    if (panelId === 'panelMobileHome') updateMobileHome();
  },

  cleanup: () => {
    if (unsubBranches) unsubBranches();
    if (unsubServices) unsubServices();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    if (unsubCustomers) unsubCustomers();
    // Global functions ማጽዳት
    const fnNames = ['renderServiceList','renderPOSProducts','updateUnpaidDisplay','renderOrders','renderCustomersList','renderExpenses','changeExpenseDate','setExpenseDateFilter','setOrderDateFilter','setOrderStatusFilter','filterOrdersByBranch','filterCustomersByBranch','setReportType','renderReports','openServiceModal','closeServiceModal','saveService','deleteService','toggleCategory','addToCart','updateCartQty','removeFromCart','clearCart','completeOrder','markDelivered','markProcessing','showCustomerProfile','closeCustomerProfile','setPaymentType','recordPayment','editCustomer','saveEditedCustomer','deleteCustomer','addExpense','saveSettings','addBranch','deleteBranch','exportReportCSV','printReport'];
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
  unsubServices = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', appState.tenantId)), snap => {
    allServices = []; snap.forEach(d => allServices.push({ id: d.id, ...d.data() }));
    allServices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderServiceList(); renderPOSProducts(); updateServiceCategories();
  });
  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', appState.tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderOrders(); renderCustomersList(); renderReports(); updateMobileHome(); updateCustomerDatalist();
  });
  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', appState.tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses(); renderReports(); updateMobileHome();
  });
  unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('tenantId', '==', appState.tenantId)), snap => {
    allCustomers = []; snap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));
    renderCustomersList(); updateCustomerDatalist();
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

function updateCustomerDatalist() {
  const dl = document.getElementById('customerList');
  if (dl) dl.innerHTML = allCustomers.map(c => `<option value="${esc(c.name)}">`).join('');
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
  
  const sections = ['posBranchSection', 'serviceBranchSection', 'expBranchSection', 'reportBranchSection'];
  const selects = ['orderBranch', 'serviceBranch', 'expBranch', 'reportBranch'];
  
  sections.forEach((sec, i) => {
    const el = document.getElementById(sec);
    if (el) el.style.display = hasBranches ? 'block' : 'none';
  });

  selects.forEach((selId, i) => {
    const sel = document.getElementById(selId);
    if (sel && hasBranches) {
      const currentVal = sel.value;
      const isAllOption = selId === 'reportBranch' || selId === 'orderBranchFilter' || selId === 'customerBranchFilter';
      sel.innerHTML = (isAllOption ? '<option value="all">📊 All Branches</option>' : '') + allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
      if (currentVal) sel.value = currentVal;
    }
  });

  const filters = ['orderBranchFilter', 'customerBranchFilter'];
  filters.forEach(fId => {
    const el = document.getElementById(fId);
    if (el) el.style.display = hasBranches ? 'block' : 'none';
  });
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
// 🏷️ SERVICES
// ═══════════════════════════════════════════
function openServiceModal(id = null) {
  editingServiceId = id;
  updateServiceCategories();
  if (id) {
    const s = allServices.find(x => x.id === id);
    if (!s) return;
    document.getElementById('serviceModalTitle').textContent = '✏️ Edit Service';
    document.getElementById('serviceCategory').value = s.category || '';
    document.getElementById('serviceName').value = s.name || '';
    document.getElementById('servicePrice').value = s.price || '';
    document.getElementById('saveServiceBtn').textContent = '💾 Update';
  } else {
    document.getElementById('serviceModalTitle').textContent = '➕ Add Service';
    document.getElementById('serviceCategory').value = '';
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
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
  const branch = appState.plan === 'pro' ? document.getElementById('serviceBranch').value : 'Main';
  
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Service Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  
  try {
    if (editingServiceId) {
      await updateDoc(doc(db, 'products', editingServiceId), { category, name, price, branch });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), { tenantId: appState.tenantId, category, name, price, branch, serviceType: 'laundry', createdAt: serverTimestamp() });
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
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:48px; margin-bottom:12px;">🏷️</div><div style="font-weight:600;">ምንም አገልግሎት የለም</div></div>`;
    renderPagination('servicePagination', 0, window.servicePage, servicePerPage, (page) => { window.servicePage = page; renderServiceList(); }, (perPage) => { servicePerPage = perPage; window.servicePage = 1; renderServiceList(); });
    return;
  }
  
  const totalPages = Math.ceil(filtered.length / servicePerPage);
  if (window.servicePage > totalPages) window.servicePage = totalPages;
  const start = (window.servicePage - 1) * servicePerPage;
  const paginated = filtered.slice(start, start + servicePerPage);
  
  const grouped = {};
  paginated.forEach(s => {
    const cat = s.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });
  
  container.innerHTML = Object.keys(grouped).sort().map(cat => {
    const items = grouped[cat].sort((a,b) => a.name.localeCompare(b.name));
    const catTotal = items.reduce((s, x) => s + (x.price || 0), 0);
    const isOpen = openCategories.has(cat) || (search && search.length > 0);
    return `
      <div class="category-collapsible ${isOpen ? 'open' : ''}">
        <div class="category-header" onclick="window.toggleCategory('${escJs(cat)}')">
          <div class="category-header-left"><span class="category-arrow">▶</span><span class="category-name">📁 ${esc(cat)}</span><span class="category-count">${items.length}</span></div>
          <span class="category-total">${money(catTotal)} ETB</span>
        </div>
        <div class="category-body">
          ${items.map(s => `
            <div class="item-row">
              <div class="item-row-name">🏷️ ${esc(s.name)}</div>
              <div class="item-row-price">${money(s.price)} ETB</div>
              <div style="display:flex; gap:4px;">
                <button class="action-btn btn-edit" onclick="event.stopPropagation(); window.openServiceModal('${s.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteService('${s.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');
  
  renderPagination('servicePagination', filtered.length, window.servicePage, servicePerPage, (page) => { window.servicePage = page; renderServiceList(); }, (perPage) => { servicePerPage = perPage; window.servicePage = 1; renderServiceList(); });
}

// ═══════════════════════════════════════════
// 🧺 POS
// ═══════════════════════════════════════════
function renderPOSProducts() {
  const listEl = document.getElementById('sellProductList');
  if (!listEl) return;
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let filtered = allServices;
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search));
  
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">ምንም አገልግሎት የለም</div>';
    return;
  }
  
  listEl.innerHTML = filtered.sort((a,b) => a.name.localeCompare(b.name)).map(s => `
    <div class="product-card" onclick="window.addToCart('${s.id}')">
      <div><div class="p-name">${esc(s.name)}</div><div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${esc(s.category || '')}</div></div>
      <div class="p-price">${money(s.price)} ETB</div>
    </div>
  `).join('');
}

function addToCart(id) {
  const s = allServices.find(x => x.id === id);
  if (!s) return;
  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name: s.name, price: s.price, qty: 1 });
  renderCart();
}

function updateCartQty(i, delta) {
  const item = cart[i];
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(i, 1); renderCart(); return; }
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
  const customer = document.getElementById('orderCustomer').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const pickup = document.getElementById('orderPickup').value;
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  const branch = appState.plan === 'pro' ? document.getElementById('orderBranch').value : 'Main';
  
  if (!customer) return showToast('የደንበኛ ስም ያስፈልጋል', 'error');
  if (!pickup) return showToast('Pickup Date ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');
  
  try {
    if (!allCustomers.find(c => c.name === customer)) {
      await setDoc(doc(db, 'customers', appState.tenantId + '_' + customer), { name: customer, phone, tenantId: appState.tenantId, createdAt: serverTimestamp() }, { merge: true });
    }
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    await addDoc(collection(db, 'sales'), {
      tenantId: appState.tenantId, customer, customerPhone: phone, pickupDate: pickup, date: todayStr(), items, total, paidAmount: paid, unpaidAmount: total - paid, paymentType, branch, status: 'processing', createdAt: serverTimestamp()
    });
    showToast('✅ Order ተመዝግቧል');
    cart = []; renderCart();
    document.getElementById('orderCustomer').value = '';
    document.getElementById('orderPhone').value = '';
    document.getElementById('orderPaid').value = '';
    document.getElementById('orderPickup').value = todayStr();
    document.getElementById('orderPaymentType').value = 'cash';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 📜 ORDERS
// ═══════════════════════════════════════════
function setOrderDateFilter(filter, btn) {
  orderDateFilter = filter;
  document.querySelectorAll('#orderDateChips .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const picker = document.getElementById('orderDatePicker');
  const dateInput = document.getElementById('orderFilterDate');
  const monthInput = document.getElementById('orderFilterMonth');
  if (filter === 'date') { picker.style.display = 'block'; dateInput.style.display = 'block'; monthInput.style.display = 'none'; }
  else if (filter === 'month') { picker.style.display = 'block'; dateInput.style.display = 'none'; monthInput.style.display = 'block'; }
  else { picker.style.display = 'none'; }
  window.ordersPage = 1;
  renderOrders();
}

function setOrderStatusFilter(filter, btn) {
  orderStatusFilter = filter;
  document.querySelectorAll('#panel3 .status-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  window.ordersPage = 1;
  renderOrders();
}

function filterOrdersByBranch() { window.ordersPage = 1; renderOrders(); }
function filterCustomersByBranch() { window.customersPage = 1; renderCustomersList(); }

function renderOrders() {
  const el = document.getElementById('ordersList');
  if (!el) return;
  const appState = state;
  const search = (document.getElementById('searchOrders')?.value || '').toLowerCase();
  let filtered = [...allSales];
  
  const branchFilter = appState.plan === 'pro' ? (document.getElementById('orderBranchFilter')?.value || 'all') : 'all';
  if (branchFilter !== 'all') filtered = filtered.filter(o => o.branch === branchFilter);
  
  if (orderDateFilter === 'recent') {
    const today = todayStr();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    filtered = filtered.filter(o => o.date === today || o.date === yesterdayStr);
  } else if (orderDateFilter === 'date') {
    const d = document.getElementById('orderFilterDate').value;
    if (d) filtered = filtered.filter(o => o.date === d);
  } else if (orderDateFilter === 'month') {
    const m = document.getElementById('orderFilterMonth').value;
    if (m) filtered = filtered.filter(o => (o.date || '').startsWith(m));
  }
  
  if (orderStatusFilter !== 'all') filtered = filtered.filter(o => o.status === orderStatusFilter);
  if (search) filtered = filtered.filter(o => (o.customer || '').toLowerCase().includes(search));
  
  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">📜 ምንም Order የለም</div>';
    renderPagination('ordersPagination', 0, window.ordersPage, ordersPerPage, (page) => { window.ordersPage = page; renderOrders(); }, (perPage) => { ordersPerPage = perPage; window.ordersPage = 1; renderOrders(); });
    return;
  }
  
  const totalPages = Math.ceil(filtered.length / ordersPerPage);
  if (window.ordersPage > totalPages) window.ordersPage = totalPages;
  const start = (window.ordersPage - 1) * ordersPerPage;
  const paginated = filtered.slice(start, start + ordersPerPage);
  
  el.innerHTML = paginated.map(o => {
    const statusBadge = o.status === 'delivered' ? '<span class="status-badge status-delivered">🟢 Delivered</span>' : '<span class="status-badge status-processing">🟡 Processing</span>';
    const itemsList = (o.items || []).map(i => `${esc(i.name)} × ${i.qty} = ${money(i.total)} ETB`).join('<br>');
    const unpaid = (o.unpaidAmount || 0);
    const statusAction = o.status === 'processing' ? `<button class="status-btn status-btn-mark" onclick="window.markDelivered('${o.id}')">✅ Mark Delivered</button>` : `<button class="status-btn status-btn-undo" onclick="window.markProcessing('${o.id}')">↩️ Undo</button>`;
    return `<div class="order-card">
      <div class="order-card-header">
        <div><div class="order-card-customer">👤 ${esc(o.customer || '-')}</div><div class="order-card-phone">📞 ${esc(o.customerPhone || '-')}</div>${o.branch ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🏢 ${esc(o.branch)}</div>` : ''}</div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">${statusBadge}<div class="order-card-pickup">📅 ${esc(o.pickupDate || '-')}</div></div>
      </div>
      <div class="order-card-items">${itemsList}</div>
      <div class="order-card-footer">
        <div><span class="order-card-total">Total: ${money(o.total)} ETB</span><div style="margin-top:4px;"><span class="order-card-paid">✅ Paid: ${money(o.paidAmount || 0)}</span><span style="font-size:11px; color:var(--text-muted); margin-left:8px;">${o.paymentType === 'transfer' ? '🏦 Transfer' : '💵 Cash'}</span>${unpaid > 0.01 ? `<br><span class="order-card-unpaid">⚠️ Unpaid: ${money(unpaid)}</span>` : ''}</div></div>
        ${statusAction}
      </div>
    </div>`;
  }).join('');
  
  renderPagination('ordersPagination', filtered.length, window.ordersPage, ordersPerPage, (page) => { window.ordersPage = page; renderOrders(); }, (perPage) => { ordersPerPage = perPage; window.ordersPage = 1; renderOrders(); });
}

async function markDelivered(id) {
  try { await updateDoc(doc(db, 'sales', id), { status: 'delivered', deliveredAt: serverTimestamp() }); showToast('✅ Delivered'); }
  catch (e) { showToast('❌ ስህተት', 'error'); }
}

async function markProcessing(id) {
  try { await updateDoc(doc(db, 'sales', id), { status: 'processing' }); showToast('↩️ ወደ Processing'); }
  catch (e) { showToast('❌ ስህተት', 'error'); }
}

// ═══════════════════════════════════════════
// 👥 CUSTOMERS
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
  const appState = state;
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();
  
  const branchFilter = appState.plan === 'pro' ? (document.getElementById('customerBranchFilter')?.value || 'all') : 'all';
  
  const map = {};
  allCustomers.forEach(c => { map[c.name] = { name: c.name, phone: c.phone || '', id: c.id }; });
  allSales.forEach(s => {
    if (!s.customer) return;
    if (!map[s.customer]) map[s.customer] = { name: s.customer, phone: s.customerPhone || '', id: null };
  });
  
  let list = Object.values(map);
  
  if (branchFilter !== 'all') {
    list = list.filter(c => {
      const cSales = allSales.filter(s => s.customer === c.name);
      return cSales.some(s => s.branch === branchFilter);
    });
  }
  
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">👥 ምንም ደንበኛ የለም</div>';
    renderPagination('customersPagination', 0, window.customersPage, customersPerPage, (page) => { window.customersPage = page; renderCustomersList(); }, (perPage) => { customersPerPage = perPage; window.customersPage = 1; renderCustomersList(); });
    return;
  }
  
  list.sort((a, b) => { const sA = getCustomerStats(a.name); const sB = getCustomerStats(b.name); return sB.totalDebt - sA.totalDebt; });
  
  const totalPages = Math.ceil(list.length / customersPerPage);
  if (window.customersPage > totalPages) window.customersPage = totalPages;
  const start = (window.customersPage - 1) * customersPerPage;
  const paginated = list.slice(start, start + customersPerPage);
  
  el.innerHTML = paginated.map(c => {
    const stats = getCustomerStats(c.name);
    return `<div class="customer-card" onclick="window.showCustomerProfile('${escJs(c.name)}')">
      <div class="customer-row">
        <div class="customer-info">
          <div class="customer-name">👤 ${esc(c.name)}</div>
          <div class="customer-meta">📞 ${esc(c.phone || '-')} | 🧺 ${stats.orderCount} orders | 💰 ${money(stats.totalPaid)} paid ${c.branch && appState.plan === 'pro' ? `<br>🏢 ${esc(c.branch)}` : ''}</div>
        </div>
        ${stats.totalDebt > 0.01 ? `<div class="customer-debt-badge">⚠️ ${money(stats.totalDebt)}</div>` : '<div style="color:var(--success); font-size:20px;">✓</div>'}
      </div>
    </div>`;
  }).join('');
  
  renderPagination('customersPagination', list.length, window.customersPage, customersPerPage, (page) => { window.customersPage = page; renderCustomersList(); }, (perPage) => { customersPerPage = perPage; window.customersPage = 1; renderCustomersList(); });
}

function showCustomerProfile(name) {
  currentCustomerName = name;
  const stats = getCustomerStats(name);
  const custData = allCustomers.find(c => c.name === name) || {};
  
  const ordersHtml = stats.sales.length === 0
    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">ምንም order የለም</p>'
    : [...stats.sales].sort((a,b) => new Date(b.date) - new Date(a.date)).map(o => {
      const unpaid = (o.unpaidAmount || 0);
      return `<div class="history-item">
        <div class="history-row"><span class="history-date">📅 ${esc(o.date)}</span><span class="history-amount" style="color:var(--primary);">${money(o.total)} ETB</span></div>
        <div class="history-items">${(o.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(' • ')}</div>
        <div class="history-badge"><span style="color:var(--success); font-weight:600;">✅ Paid: ${money(o.paidAmount || 0)}</span>${unpaid > 0.01 ? ` | <span style="color:var(--danger); font-weight:600;">⚠️ Debt: ${money(unpaid)}</span>` : ''}</div>
      </div>`;
    }).join('');
  
  document.getElementById('customerProfileBody').innerHTML = `
    <div class="profile-header"><div class="profile-avatar">👤</div><div class="profile-name">${esc(name)}</div><div class="profile-phone">📞 ${esc(custData.phone || '-')}</div></div>
    <div class="profile-stats">
      <div class="profile-stat"><div class="label">Orders</div><div class="value">${stats.orderCount}</div></div>
      <div class="profile-stat paid"><div class="label">Paid</div><div class="value">${money(stats.totalPaid)}</div></div>
      <div class="profile-stat debt"><div class="label">Debt</div><div class="value">${money(stats.totalDebt)}</div></div>
    </div>
    ${stats.totalDebt > 0.01 ? `
      <div class="payment-form">
        <h4>💰 Record Payment</h4>
        <label class="field-label" style="margin-top:0;">💳 Payment Type</label>
        <div class="payment-type-selector">
          <button type="button" class="payment-type-btn active" id="payTypeCash" onclick="window.setPaymentType('cash')">💵 Cash</button>
          <button type="button" class="payment-type-btn" id="payTypeTransfer" onclick="window.setPaymentType('transfer')">🏦 Transfer</button>
        </div>
        <input type="hidden" id="paymentType" value="cash">
        <label class="field-label">Amount (ETB) *</label>
        <input type="number" id="paymentAmount" placeholder="0.00" step="any" max="${stats.totalDebt}">
        <label class="field-label">Date</label>
        <input type="date" id="paymentDate" value="${todayStr()}">
        <button class="btn btn-success" onclick="window.recordPayment('${escJs(name)}')" style="margin-top:12px;">💾 Record Payment</button>
      </div>
    ` : ''}
    <div class="history-section"><h4>📜 Order History</h4>${ordersHtml}</div>
    <div style="display:flex; gap:8px; margin-top:16px;">
      <button class="btn btn-outline" onclick="window.editCustomer('${escJs(name)}')" style="margin-top:0;">✏️ Edit</button>
      <button class="btn btn-danger" onclick="window.deleteCustomer('${escJs(name)}')" style="margin-top:0;">🗑️ Delete</button>
    </div>
  `;
  
  document.getElementById('customerProfileModal').classList.add('open');
}

function closeCustomerProfile() {
  document.getElementById('customerProfileModal').classList.remove('open');
  currentCustomerName = null;
}

function setPaymentType(type) {
  document.getElementById('paymentType').value = type;
  document.getElementById('payTypeCash').classList.toggle('active', type === 'cash');
  document.getElementById('payTypeTransfer').classList.toggle('active', type === 'transfer');
}

async function recordPayment(name) {
  const appState = state;
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  const paymentType = document.getElementById('paymentType').value;
  
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  
  const stats = getCustomerStats(name);
  if (amount > stats.totalDebt) return showToast('ከዕዳ መጠን መብለጥ አይችልም', 'error');
  
  try {
    let remaining = amount;
    const unpaidOrders = [...stats.sales].filter(o => (o.unpaidAmount || 0) > 0.01).sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const order of unpaidOrders) {
      if (remaining <= 0) break;
      const toPay = Math.min(remaining, order.unpaidAmount);
      await updateDoc(doc(db, 'sales', order.id), { paidAmount: (order.paidAmount || 0) + toPay, unpaidAmount: order.unpaidAmount - toPay });
      remaining -= toPay;
    }
    await addDoc(collection(db, 'payments'), { tenantId: appState.tenantId, customer: name, amount, date, paymentType, createdAt: serverTimestamp() });
    showToast(`✅ ${money(amount)} ETB ተከፍሏል`);
    document.getElementById('customerProfileModal').classList.remove('open');
    setTimeout(() => showCustomerProfile(name), 300);
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

function editCustomer(name) {
  const cust = allCustomers.find(c => c.name === name) || { name, phone: '' };
  editingCustomerName = name;
  document.getElementById('editCustName').value = cust.name;
  document.getElementById('editCustPhone').value = cust.phone || '';
  document.getElementById('customerProfileModal').classList.remove('open');
  document.getElementById('editCustomerModal').classList.add('open');
}

async function saveEditedCustomer() {
  const appState = state;
  const name = document.getElementById('editCustName').value.trim();
  const phone = document.getElementById('editCustPhone').value.trim();
  if (!name) return showToast('ስም ያስፈልጋል', 'error');
  
  try {
    if (editingCustomerName) {
      await setDoc(doc(db, 'customers', appState.tenantId + '_' + name), { name, phone, tenantId: appState.tenantId, updatedAt: serverTimestamp() }, { merge: true });
      if (editingCustomerName !== name) {
        const orders = allSales.filter(s => s.customer === editingCustomerName);
        for (const o of orders) await updateDoc(doc(db, 'sales', o.id), { customer: name, customerPhone: phone });
      } else {
        const orders = allSales.filter(s => s.customer === name);
        for (const o of orders) if (o.customerPhone !== phone) await updateDoc(doc(db, 'sales', o.id), { customerPhone: phone });
      }
    }
    showToast('✅ Customer ተሻሽሏል');
    document.getElementById('editCustomerModal').classList.remove('open');
    editingCustomerName = null;
    renderCustomersList();
  } catch(e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteCustomer(name) {
  if (!confirm(`"${name}" ደንበኛን ማጥፋት? (ይህ ትዕዛዞቹን አያጠፋም)`)) return;
  try {
    const custDoc = allCustomers.find(c => c.name === name);
    if (custDoc?.id) await deleteDoc(doc(db, 'customers', custDoc.id));
    showToast('✅ Customer ተጠፍቷል');
    document.getElementById('customerProfileModal').classList.remove('open');
    renderCustomersList();
  } catch(e) { showToast('❌ ስህተት', 'error'); }
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

function changeExpenseDate() { window.expensesPage = 1; renderExpenses(); }

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
  window.expensesPage = 1;
  renderExpenses();
}

function renderExpenses() {
  const el = document.getElementById('expenseList');
  if (!el) return;
  let filtered = allExpenses;
  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  if (search) filtered = filtered.filter(e => (e.category || '').toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search));
  
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
  if (window.expensesPage > totalPages) window.expensesPage = totalPages || 1;
  const start = (window.expensesPage - 1) * expensesPerPage;
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
  
  renderPagination('expensesPagination', filtered.length, window.expensesPage, expensesPerPage, (page) => { window.expensesPage = page; renderExpenses(); }, (perPage) => { expensesPerPage = perPage; window.expensesPage = 1; renderExpenses(); });
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
  
  try {
    await updateDoc(doc(db, 'tenants', appState.tenantId), { name, phone });
    showToast('✅ Settings ተቀምጧል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 🔢 PAGINATION
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

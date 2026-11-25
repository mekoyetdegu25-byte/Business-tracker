// js/modules/salon.js
import { db } from '../firebase.js';
import { collection, addDoc, query, where, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allServices = [];
let allSales = [];
let allExpenses = [];
let allPayments = [];
let allCustomers = [];
let cart = [];

let editingServiceId = null;
let editingCustomerName = null;
let currentCustomerName = null;

let servicePage = 1, ordersPage = 1, customersPage = 1, expensesPage = 1;
let servicePerPage = 10, ordersPerPage = 10, customersPerPage = 10, expensesPerPage = 10;

let openCategories = new Set();
let orderDateFilter = 'recent';
let expenseDateFilter = 'recent';
let reportType = 'daily';

let unsubBranches = null, unsubServices = null, unsubSales = null, unsubExpenses = null, unsubPayments = null, unsubCustomers = null;

const SERVICE_MODAL_ID = 'salonServiceModal';
const PROFILE_MODAL_ID = 'customerProfileModal';
const EDIT_CUSTOMER_MODAL_ID = 'editCustomerModal';

const SALON_MODALS_HTML = `
<div class="modal-overlay" id="${SERVICE_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="salonServiceModalTitle">➕ Add Service</h3>
      <button class="modal-close" onclick="window.closeSalonServiceModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="salonSvcBranchSection" style="display:none;">
        <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
        <select id="salonSvcBranch"></select>
      </div>
      <label class="field-label" style="margin-top:0;">📁 Category *</label>
      <input list="salonCategoryList" id="salonSvcCategory" placeholder="e.g. Haircut, Beauty, Nails, Beard">
      <datalist id="salonCategoryList">
        <option value="Haircut & Styling">
        <option value="Barber & Beard">
        <option value="Makeup & Facial">
        <option value="Manicure & Pedicure">
        <option value="Braiding & Treatment">
      </datalist>
      <label class="field-label">💇 Service Name *</label>
      <input type="text" id="salonSvcName" placeholder="e.g. Fade Haircut / ሜካፕ / ጥፍር">
      <label class="field-label">👨‍🎨 Default Stylist / Barber</label>
      <input type="text" id="salonSvcStylist" placeholder="e.g. Dawit / Selam">
      <label class="field-label">💰 Price (ETB) *</label>
      <input type="number" id="salonSvcPrice" placeholder="0.00" step="any">
      <button class="btn btn-success" onclick="window.saveSalonService()" id="saveSalonSvcBtn">💾 Save</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="${PROFILE_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3>👤 Customer Profile</h3>
      <button class="modal-close" onclick="window.closeCustomerProfile()">×</button>
    </div>
    <div class="modal-body" id="customerProfileBody"></div>
  </div>
</div>

<div class="modal-overlay" id="${EDIT_CUSTOMER_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3>✏️ Edit Customer</h3>
      <button class="modal-close" onclick="window.closeEditCustomerModal()">×</button>
    </div>
    <div class="modal-body">
      <label class="field-label" style="margin-top:0;">👤 Customer Name *</label>
      <input type="text" id="editCustName" placeholder="Customer name">
      <label class="field-label">📞 Phone</label>
      <input type="text" id="editCustPhone" placeholder="+251...">
      <button class="btn btn-success" onclick="window.saveEditedCustomer()">💾 Save Changes</button>
    </div>
  </div>
</div>
`;

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const SalonModule = {
  name: 'Salon & Beauty',
  icon: '💇‍♀️',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel2', label: 'Sell', icon: '✂️' },
    { id: 'panel3', label: 'Sales', icon: '📜' },
    { id: 'panelCustomers', label: 'Customers', icon: '👥' },
    { id: 'panel8', label: 'More', icon: '⚙️' },
    // ከዚህ በታች ያሉት በሞባይል ማውጫ ላይ አይታዩም (slice(0, 5))
    { id: 'panel1', label: 'Services', icon: '💇‍♀️' },
    { id: 'panel4', label: 'Expenses', icon: '💸' },
    { id: 'panel6', label: 'Reports', icon: '📊' }
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
        <div class="qa-card" onclick="switchPage('panel2', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">✂️</div><div class="qa-title">New Service Sale</div></div>
        <div class="qa-card" onclick="switchPage('panel1', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">💇‍♀️</div><div class="qa-title">Services</div></div>
        <div class="qa-card" onclick="switchPage('panel3', null)"><div class="qa-icon" style="background:rgba(16,185,129,0.1); color:var(--success);">📜</div><div class="qa-title">Sales</div></div>
        <div class="qa-card" onclick="switchPage('panelCustomers', null)"><div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">👥</div><div class="qa-title">Customers</div></div>
        <div class="qa-card" onclick="switchPage('panel4', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div><div class="qa-title">Expenses</div></div>
        <div class="qa-card" onclick="switchPage('panel6', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📊</div><div class="qa-title">Reports</div></div>
      </div>
    `},
    { id: 'panel1', html: `
      <div class="card">
        <div class="card-title"><span>💇‍♀️ Salon & Beauty Services</span><button class="btn btn-primary btn-sm" onclick="window.openSalonServiceModal()">➕ Add Service</button></div>
        <div class="filter-bar"><input type="text" id="searchSalonService" placeholder="🔍 Search service, stylist, category..." oninput="window.slServiceSearch()"></div>
        <div id="salonServiceListContainer"></div>
        <div class="pagination-controls" id="salonServicePagination"></div>
      </div>
    `},
    { id: 'panel2', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="orderBranch" style="margin-bottom:8px;"></select></div>
            <label class="field-label" style="margin-top:0;">👤 Customer *</label>
            <input type="text" id="orderCustomer" placeholder="Customer name (or Walk-in)" list="customerList" style="margin-bottom:8px;"><datalist id="customerList"></datalist>
            <label class="field-label">📞 Phone</label><input type="text" id="orderPhone" placeholder="+251..." style="margin-bottom:8px;">
            <label class="field-label">👨‍🎨 Stylist / Barber</label><input type="text" id="orderStylist" placeholder="e.g. Dawit / Selam" style="margin-bottom:8px;">
            <label class="field-label">📅 Date *</label><input type="date" id="orderDate" style="margin-bottom:8px;">
            <label class="field-label">💳 Payment Type</label><select id="orderPaymentType" style="margin-bottom:8px;"><option value="cash">💵 Cash</option><option value="transfer">🏦 Transfer</option></select>
          </div>
          <div class="pos-cart-items" id="cartList"></div>
          <div class="pos-cart-footer">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span style="font-size:14px; font-weight:700;">Total:</span><span id="cartTotal" style="font-size:20px; font-weight:800; color:var(--primary);">0.00 ETB</span></div>
            <label class="field-label" style="margin-top:0;">💰 Paid Amount</label><input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.updateUnpaidDisplay()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.completeOrder()">💸 Complete Sale</button>
            <button class="btn btn-outline" onclick="window.clearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header"><input type="text" id="searchProduct" placeholder="🔍 Search service or stylist..." oninput="window.renderPOSProducts()" style="padding:12px 16px;"></div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},
    { id: 'panel3', html: `
      <div class="card">
        <div class="card-title"><span>📜 Sales History</span></div>
        <div class="filter-bar"><input type="text" id="searchOrders" placeholder="🔍 Search customer or stylist..." oninput="window.slOrdersSearch()"><select id="orderBranchFilter" onchange="window.slOrdersSearch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select></div>
        <div class="date-filter-chips" id="orderDateChips">
          <button class="date-chip active" onclick="window.setOrderDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('all', this)">All</button>
        </div>
        <div id="orderDatePicker" style="display:none; margin-bottom:12px;"><input type="date" id="orderFilterDate" onchange="window.slOrdersSearch()"><input type="month" id="orderFilterMonth" onchange="window.slOrdersSearch()" style="display:none;"></div>
        <div id="ordersList"></div>
        <div class="pagination-controls" id="ordersPagination"></div>
      </div>
    `},
    { id: 'panelCustomers', html: `
      <div class="card">
        <div class="card-title"><span>👥 Customers</span></div>
        <div class="filter-bar"><input type="text" id="searchCustomers" placeholder="🔍 Search customer..." oninput="window.slCustomersSearch()"><select id="customerBranchFilter" onchange="window.slCustomersSearch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select></div>
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
          <input list="expenseCategoryList" id="expCategory" placeholder="e.g. 🏠 Rent, 🧴 Salon Supplies">
          <datalist id="expenseCategoryList"><option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water"><option value="🧴 Salon Supplies"><option value="👥 Salary"><option value="📱 Phone"></datalist>
          <label class="field-label">💰 Amount (ETB) *</label><input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label><input type="date" id="expDate">
          <label class="field-label">📝 Note</label><input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.addExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar"><input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="window.slExpensesSearch()"></div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.setExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;"><input type="date" id="expenseFilterDate" oninput="window.slExpensesSearch()"><input type="month" id="expenseFilterMonth" oninput="window.slExpensesSearch()" style="display:none;"></div>
        <div id="expenseList"></div>
        <div class="pagination-controls" id="expensesPagination"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px;">
          <div class="summary-box red" style="margin-bottom:0;"><div class="label">Filtered / Today</div><div class="value" id="expMonthTotal" style="font-size:20px;">0.00</div></div>
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
  // 🚀 INIT
  // ═══════════════════════════════════════════
  init: async (appState) => {
    const modalHost = document.getElementById('globalModalContainer');
    if (modalHost) {
      if (
        !document.getElementById(SERVICE_MODAL_ID) ||
        !document.getElementById(PROFILE_MODAL_ID) ||
        !document.getElementById(EDIT_CUSTOMER_MODAL_ID)
      ) {
        modalHost.insertAdjacentHTML('beforeend', SALON_MODALS_HTML);
      }
    }

    window.openSalonServiceModal = openSalonServiceModal;
    window.closeSalonServiceModal = closeSalonServiceModal;
    window.saveSalonService = saveSalonService;
    window.deleteSalonService = deleteSalonService;
    window.toggleCategory = toggleCategory;
    window.renderSalonServiceList = renderSalonServiceList;

    window.renderPOSProducts = renderPOSProducts;
    window.addToCart = addToCart;
    window.updateCartQty = updateCartQty;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.updateUnpaidDisplay = updateUnpaidDisplay;
    window.completeOrder = completeOrder;

    window.setOrderDateFilter = setOrderDateFilter;
    window.renderOrders = renderOrders;

    window.renderCustomersList = renderCustomersList;
    window.showCustomerProfile = showCustomerProfile;
    window.closeCustomerProfile = closeCustomerProfile;
    window.setPaymentType = setPaymentType;
    window.recordPayment = recordPayment;
    window.editCustomer = editCustomer;
    window.closeEditCustomerModal = closeEditCustomerModal;
    window.saveEditedCustomer = saveEditedCustomer;
    window.deleteCustomer = deleteCustomer;

    window.addExpense = addExpense;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.renderExpenses = renderExpenses;
    window.deleteExpense = deleteExpense;

    window.setReportType = setReportType;
    window.renderReports = renderReports;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;

    window.slServiceSearch = () => { servicePage = 1; renderSalonServiceList(); };
    window.slOrdersSearch = () => { ordersPage = 1; renderOrders(); };
    window.slCustomersSearch = () => { customersPage = 1; renderCustomersList(); };
    window.slExpensesSearch = () => { expensesPage = 1; renderExpenses(); };

    const today = todayStr();
    if (document.getElementById('orderDate')) document.getElementById('orderDate').value = today;
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
    if (panelId === 'panel1') renderSalonServiceList();
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
    if (unsubPayments) unsubPayments();
    if (unsubCustomers) unsubCustomers();
    unsubBranches = unsubServices = unsubSales = unsubExpenses = unsubPayments = unsubCustomers = null;

    document.getElementById(SERVICE_MODAL_ID)?.remove();
    document.getElementById(PROFILE_MODAL_ID)?.remove();
    document.getElementById(EDIT_CUSTOMER_MODAL_ID)?.remove();

    allBranches = []; allServices = []; allSales = []; allExpenses = []; allPayments = []; allCustomers = []; cart = [];
    editingServiceId = null; editingCustomerName = null; currentCustomerName = null;
    servicePage = 1; ordersPage = 1; customersPage = 1; expensesPage = 1;
    openCategories = new Set(); orderDateFilter = 'recent'; expenseDateFilter = 'recent'; reportType = 'daily';

    const fnNames = [
      'openSalonServiceModal', 'closeSalonServiceModal', 'saveSalonService', 'deleteSalonService',
      'toggleCategory', 'renderSalonServiceList', 'renderPOSProducts', 'addToCart', 'updateCartQty',
      'removeFromCart', 'clearCart', 'updateUnpaidDisplay', 'completeOrder', 'setOrderDateFilter',
      'renderOrders', 'renderCustomersList', 'showCustomerProfile', 'closeCustomerProfile',
      'setPaymentType', 'recordPayment', 'editCustomer', 'closeEditCustomerModal',
      'saveEditedCustomer', 'deleteCustomer', 'addExpense', 'setExpenseDateFilter',
      'renderExpenses', 'deleteExpense', 'setReportType', 'renderReports', 'saveSettings',
      'addBranch', 'deleteBranch', 'slServiceSearch', 'slOrdersSearch', 'slCustomersSearch',
      'slExpensesSearch'
    ];
    fnNames.forEach(fn => delete window[fn]);
  }
};

// ═══════════════════════════════════════════
// 📥 DATA LOADING
// ═══════════════════════════════════════════
async function loadAllData(appState) {
  const tenantId = appState?.tenantId || state.tenantId;
  if (!tenantId) return;

  unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', tenantId)), snap => {
    allBranches = []; snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
    renderBranchSettings();
    updateBranchDropdowns();
  });
  unsubServices = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', tenantId)), snap => {
    allServices = []; snap.forEach(d => allServices.push({ id: d.id, ...d.data() }));
    allServices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderSalonServiceList(); renderPOSProducts(); updateSalonCategories();
  });
  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderOrders(); renderCustomersList(); renderReports(); updateMobileHome();
  });
  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses(); renderReports(); updateMobileHome();
  });
  unsubPayments = onSnapshot(query(collection(db, 'payments'), where('tenantId', '==', tenantId)), snap => {
    allPayments = []; snap.forEach(d => allPayments.push({ id: d.id, ...d.data() }));
    renderReports(); updateMobileHome();
  });
  unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('tenantId', '==', tenantId)), snap => {
    allCustomers = []; snap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));
    renderCustomersList(); updateCustomerDatalist();
  });
}

// ═══════════════════════════════════════════
// 🧠 HELPERS & BRANCHES
// ═══════════════════════════════════════════
function updateMobileHome() {
  const today = todayStr();
  const orderSales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const extraPayments = allPayments.filter(p => p.date === today).reduce((s, p) => s + (p.amount || 0), 0);
  const todaySales = orderSales + extraPayments;
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + (e.amount || 0), 0);
  const todayProfit = todaySales - todayExpenses;
  const el1 = document.getElementById('mobTodaySales'); if (el1) el1.textContent = money(todaySales);
  const el2 = document.getElementById('mobTodayExpenses'); if (el2) el2.textContent = money(todayExpenses);
  const el3 = document.getElementById('mobTodayProfit'); if (el3) el3.textContent = money(todayProfit);
}

function updateCustomerDatalist() {
  const dl = document.getElementById('customerList');
  if (dl) dl.innerHTML = allCustomers.map(c => `<option value="${esc(c.name)}">`).join('');
}

function updateSalonCategories() {
  const cats = [...new Set(allServices.map(s => s.category).filter(Boolean))];
  const dl = document.getElementById('salonCategoryList');
  if (dl && cats.length > 0) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

function renderBranchSettings() {
  const card = document.getElementById('branchSettingsCard');
  if (!card) return;
  if (state.plan !== 'pro') { card.style.display = 'none'; return; }
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

function updateBranchDropdowns() {
  const hasBranches = state.plan === 'pro' && allBranches.length > 0;
  const options = allBranches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
  const sections = ['posBranchSection', 'salonSvcBranchSection', 'expBranchSection', 'reportBranchSection', 'orderBranchFilter', 'customerBranchFilter'];
  sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = hasBranches ? 'block' : 'none'; });
  const selects = ['orderBranch', 'salonSvcBranch', 'expBranch', 'reportBranch', 'orderBranchFilter', 'customerBranchFilter'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el && hasBranches) {
      const currentVal = el.value;
      const isAllOption = id === 'reportBranch' || id === 'orderBranchFilter' || id === 'customerBranchFilter';
      el.innerHTML = (isAllOption ? '<option value="all">📊 All Branches</option>' : '') + options;
      if (currentVal) el.value = currentVal;
    }
  });
}

async function addBranch() {
  if (state.plan !== 'pro') return showToast('Pro plan ብቻ!', 'error');
  const name = document.getElementById('newBranchName').value.trim();
  if (!name) return showToast('የቅርንጫፍ ስም ያስፈልጋል', 'error');
  if (allBranches.find(b => b.name.toLowerCase() === name.toLowerCase())) return showToast('ይህ ቅርንጫፍ አስቀድሞ አለ', 'error');
  try {
    await addDoc(collection(db, 'branches'), { tenantId: state.tenantId, name, createdAt: serverTimestamp() });
    document.getElementById('newBranchName').value = '';
    showToast('✅ ቅርንጫፍ ተጨምሯል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteBranch(id, name) {
  if (name === 'Main') return showToast('Main ማጥፋት አይቻልም', 'error');
  if (!confirm(`"${name}" ቅርንጫፍን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'branches', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

// ═══════════════════════════════════════════
// 💇‍♀️ SERVICES
// ═══════════════════════════════════════════
function openSalonServiceModal(id = null) {
  editingServiceId = id;
  updateSalonCategories();
  if (id) {
    const s = allServices.find(x => x.id === id);
    if (!s) return;
    document.getElementById('salonServiceModalTitle').textContent = '✏️ Edit Service';
    document.getElementById('salonSvcCategory').value = s.category || '';
    document.getElementById('salonSvcName').value = s.name || '';
    document.getElementById('salonSvcStylist').value = s.stylist || '';
    document.getElementById('salonSvcPrice').value = s.price || '';
    if (state.plan === 'pro' && s.branch && document.getElementById('salonSvcBranch')) {
      document.getElementById('salonSvcBranch').value = s.branch;
    }
    document.getElementById('saveSalonSvcBtn').textContent = '💾 Update';
  } else {
    document.getElementById('salonServiceModalTitle').textContent = '➕ Add Service';
    document.getElementById('salonSvcCategory').value = '';
    document.getElementById('salonSvcName').value = '';
    document.getElementById('salonSvcStylist').value = '';
    document.getElementById('salonSvcPrice').value = '';
    document.getElementById('saveSalonSvcBtn').textContent = '💾 Save';
  }
  document.getElementById(SERVICE_MODAL_ID)?.classList.add('open');
}

function closeSalonServiceModal() {
  document.getElementById(SERVICE_MODAL_ID)?.classList.remove('open');
  editingServiceId = null;
}

async function saveSalonService() {
  const category = document.getElementById('salonSvcCategory').value.trim();
  const name = document.getElementById('salonSvcName').value.trim();
  const stylist = document.getElementById('salonSvcStylist').value.trim();
  const price = parseFloat(document.getElementById('salonSvcPrice').value);
  const branch = state.plan === 'pro' ? (document.getElementById('salonSvcBranch')?.value || 'Main') : 'Main';

  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('የአገልግሎት ስም ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');

  try {
    if (editingServiceId) {
      await updateDoc(doc(db, 'products', editingServiceId), { category, name, stylist, price, branch });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), { tenantId: state.tenantId, category, name, stylist, price, branch, serviceType: 'salon', createdAt: serverTimestamp() });
      showToast('✅ አገልግሎት ተጨምሯል');
    }
    closeSalonServiceModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteSalonService(id) {
  const s = allServices.find(x => x.id === id);
  if (!confirm(`"${s?.name}" ን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

function toggleCategory(catName) {
  if (openCategories.has(catName)) openCategories.delete(catName);
  else openCategories.add(catName);
  renderSalonServiceList();
}

function renderSalonServiceList() {
  const container = document.getElementById('salonServiceListContainer');
  if (!container) return;
  const search = (document.getElementById('searchSalonService')?.value || '').toLowerCase();
  let filtered = allServices;
  if (search) {
    filtered = filtered.filter(s =>
      (s.name || '').toLowerCase().includes(search) ||
      (s.category || '').toLowerCase().includes(search) ||
      (s.stylist || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:48px; margin-bottom:12px;">💇‍♀️</div><div style="font-weight:600;">ምንም አገልግሎት የለም</div></div>`;
    renderPagination('salonServicePagination', 0, servicePage, servicePerPage, (p) => { servicePage = p; renderSalonServiceList(); }, (pp) => { servicePerPage = pp; servicePage = 1; renderSalonServiceList(); });
    return;
  }

  const totalPages = Math.ceil(filtered.length / servicePerPage);
  if (servicePage > totalPages) servicePage = totalPages;
  const start = (servicePage - 1) * servicePerPage;
  const paginated = filtered.slice(start, start + servicePerPage);

  const grouped = {};
  paginated.forEach(s => { const cat = s.category || 'Other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(s); });

  container.innerHTML = Object.keys(grouped).sort().map(cat => {
    const items = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
    const isOpen = openCategories.has(cat) || (search && search.length > 0);
    return `<div class="category-collapsible ${isOpen ? 'open' : ''}"><div class="category-header" onclick="window.toggleCategory('${escJs(cat)}')"><div class="category-header-left"><span class="category-arrow">▶</span><span class="category-name">📁 ${esc(cat)}</span><span class="category-count">${items.length}</span></div></div><div class="category-body">${items.map(s => `<div class="item-row"><div class="item-row-name">✂️ ${esc(s.name)} ${s.stylist ? `<small style="font-size:11px; color:var(--text-muted);">• 👨‍🎨 ${esc(s.stylist)}</small>` : ''}</div><div class="item-row-price">${money(s.price)} ETB</div><div style="display:flex; gap:4px;"><button class="action-btn btn-edit" onclick="event.stopPropagation(); window.openSalonServiceModal('${s.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button><button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteSalonService('${s.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button></div></div>`).join('')}</div></div>`;
  }).join('');

  renderPagination('salonServicePagination', filtered.length, servicePage, servicePerPage, (p) => { servicePage = p; renderSalonServiceList(); }, (pp) => { servicePerPage = pp; servicePage = 1; renderSalonServiceList(); });
}

// ═══════════════════════════════════════════
// 🛒 POS / SELL
// ═══════════════════════════════════════════
function renderPOSProducts() {
  const listEl = document.getElementById('sellProductList');
  if (!listEl) return;
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let filtered = allServices;
  if (search) {
    filtered = filtered.filter(s =>
      (s.name || '').toLowerCase().includes(search) ||
      (s.category || '').toLowerCase().includes(search) ||
      (s.stylist || '').toLowerCase().includes(search)
    );
  }
  if (filtered.length === 0) { listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">ምንም አገልግሎት የለም</div>'; return; }

  listEl.innerHTML = filtered.sort((a, b) => a.name.localeCompare(b.name)).map(s => `
    <div class="product-card" onclick="window.addToCart('${s.id}')">
      <div><div class="p-name">${esc(s.name)}</div><div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${esc(s.category || '')}${s.stylist ? ` • 👨‍🎨 ${esc(s.stylist)}` : ''}</div></div>
      <div class="p-price">${money(s.price)}</div>
    </div>
  `).join('');
}

function addToCart(id) {
  const s = allServices.find(x => x.id === id);
  if (!s) return;
  if (s.stylist && document.getElementById('orderStylist') && !document.getElementById('orderStylist').value.trim()) {
    document.getElementById('orderStylist').value = s.stylist;
  }
  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name: s.name, price: s.price, qty: 1 });
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
    return `<div class="cart-item"><div class="ci-info"><div class="ci-name">${esc(c.name)}</div><div class="ci-price">${money(c.price)}</div></div><div class="ci-qty"><button onclick="window.updateCartQty(${i}, -1)">−</button><span>${c.qty}</span><button onclick="window.updateCartQty(${i}, 1)">+</button></div><div class="ci-total">${money(c.price * c.qty)}</div><div class="ci-del" onclick="window.removeFromCart(${i})">✕</div></div>`;
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
  const customer = document.getElementById('orderCustomer').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const stylist = document.getElementById('orderStylist')?.value.trim() || '';
  const orderDate = document.getElementById('orderDate').value;
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  const branch = state.plan === 'pro' ? (document.getElementById('orderBranch')?.value || 'Main') : 'Main';

  if (!customer) return showToast('የደንበኛ ስም ያስፈልጋል', 'error');
  if (!orderDate) return showToast('ቀን ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');

  try {
    if (!allCustomers.find(c => c.name === customer)) {
      await setDoc(doc(db, 'customers', state.tenantId + '_' + customer), { name: customer, phone, tenantId: state.tenantId, createdAt: serverTimestamp() }, { merge: true });
    }
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    await addDoc(collection(db, 'sales'), { tenantId: state.tenantId, customer, customerPhone: phone, stylist, date: orderDate, items, total, paidAmount: paid, unpaidAmount: total - paid, paymentType, branch, status: 'completed', createdAt: serverTimestamp() });
    showToast('✅ ሽያጭ ተመዝግቧል');
    cart = []; renderCart();
    document.getElementById('orderCustomer').value = '';
    document.getElementById('orderPhone').value = '';
    if (document.getElementById('orderStylist')) document.getElementById('orderStylist').value = '';
    document.getElementById('orderPaid').value = '';
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('orderPaymentType').value = 'cash';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 📜 SALES HISTORY
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
  ordersPage = 1;
  renderOrders();
}

function renderOrders() {
  const el = document.getElementById('ordersList');
  if (!el) return;
  const search = (document.getElementById('searchOrders')?.value || '').toLowerCase();
  let filtered = [...allSales];
  const branchFilter = state.plan === 'pro' ? (document.getElementById('orderBranchFilter')?.value || 'all') : 'all';
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
  if (search) {
    filtered = filtered.filter(o =>
      (o.customer || '').toLowerCase().includes(search) ||
      (o.stylist || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">📜 ምንም ሽያጭ የለም</div>';
    renderPagination('ordersPagination', 0, ordersPage, ordersPerPage, (p) => { ordersPage = p; renderOrders(); }, (pp) => { ordersPerPage = pp; ordersPage = 1; renderOrders(); });
    return;
  }

  const totalPages = Math.ceil(filtered.length / ordersPerPage);
  if (ordersPage > totalPages) ordersPage = totalPages;
  const start = (ordersPage - 1) * ordersPerPage;
  const paginated = filtered.slice(start, start + ordersPerPage);

  el.innerHTML = paginated.map(o => {
    const itemsList = (o.items || []).map(i => `${esc(i.name)} × ${i.qty} = ${money(i.total)} ETB`).join('<br>');
    const unpaid = (o.unpaidAmount || 0);
    return `<div class="order-card" style="border-left: 4px solid var(--primary);">
      <div class="order-card-header">
        <div><div class="order-card-customer">👤 ${esc(o.customer || '-')}</div><div class="order-card-phone">📞 ${esc(o.customerPhone || '-')}${o.stylist ? ` • 👨‍🎨 ${esc(o.stylist)}` : ''}</div>${o.branch ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🏢 ${esc(o.branch)}</div>` : ''}</div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;"><div class="order-card-pickup">📅 ${esc(o.date || '-')}</div></div>
      </div>
      <div class="order-card-items">${itemsList}</div>
      <div class="order-card-footer">
        <div><span class="order-card-total">Total: ${money(o.total)} ETB</span><div style="margin-top:4px;"><span class="order-card-paid">✅ Paid: ${money(o.paidAmount || 0)}</span><span style="font-size:11px; color:var(--text-muted); margin-left:8px;">${o.paymentType === 'transfer' ? '🏦 Transfer' : '💵 Cash'}</span>${unpaid > 0.01 ? `<br><span class="order-card-unpaid">⚠️ Unpaid: ${money(unpaid)}</span>` : ''}</div></div>
      </div>
    </div>`;
  }).join('');

  renderPagination('ordersPagination', filtered.length, ordersPage, ordersPerPage, (p) => { ordersPage = p; renderOrders(); }, (pp) => { ordersPerPage = pp; ordersPage = 1; renderOrders(); });
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
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('customerBranchFilter')?.value || 'all') : 'all';
  const map = {};
  allCustomers.forEach(c => { map[c.name] = { name: c.name, phone: c.phone || '', id: c.id }; });
  allSales.forEach(s => { if (!s.customer) return; if (!map[s.customer]) map[s.customer] = { name: s.customer, phone: s.customerPhone || '', id: null }; });
  let list = Object.values(map);
  if (branchFilter !== 'all') { list = list.filter(c => allSales.some(s => s.customer === c.name && s.branch === branchFilter)); }
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  if (list.length === 0) { el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">👥 ምንም ደንበኛ የለም</div>'; return; }

  list.sort((a, b) => getCustomerStats(b.name).totalDebt - getCustomerStats(a.name).totalDebt);
  const totalPages = Math.ceil(list.length / customersPerPage);
  if (customersPage > totalPages) customersPage = totalPages;
  const start = (customersPage - 1) * customersPerPage;
  const paginated = list.slice(start, start + customersPerPage);

  el.innerHTML = paginated.map(c => {
    const stats = getCustomerStats(c.name);
    return `<div class="customer-card" onclick="window.showCustomerProfile('${escJs(c.name)}')"><div class="customer-row"><div class="customer-info"><div class="customer-name">👤 ${esc(c.name)}</div><div class="customer-meta">📞 ${esc(c.phone || '-')} | ✂️ ${stats.orderCount} visits | 💰 ${money(stats.totalPaid)} paid</div></div>${stats.totalDebt > 0.01 ? `<div class="customer-debt-badge">⚠️ ${money(stats.totalDebt)}</div>` : '<div style="color:var(--success); font-size:20px;">✓</div>'}</div></div>`;
  }).join('');

  renderPagination('customersPagination', list.length, customersPage, customersPerPage, (p) => { customersPage = p; renderCustomersList(); }, (pp) => { customersPerPage = pp; customersPage = 1; renderCustomersList(); });
}

function showCustomerProfile(name) {
  currentCustomerName = name;
  const stats = getCustomerStats(name);
  const custData = allCustomers.find(c => c.name === name) || {};
  const ordersHtml = stats.sales.length === 0
    ? '<p style="text-align:center; color:var(--text-muted); padding:20px;">ምንም ታሪክ የለም</p>'
    : [...stats.sales].sort((a, b) => new Date(b.date) - new Date(a.date)).map(o => {
      const unpaid = (o.unpaidAmount || 0);
      return `<div class="history-item"><div class="history-row"><span class="history-date">📅 ${esc(o.date)}</span><span class="history-amount" style="color:var(--primary);">${money(o.total)} ETB</span></div><div class="history-items">${(o.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(' • ')}${o.stylist ? ` • 👨‍🎨 ${esc(o.stylist)}` : ''}</div><div class="history-badge"><span style="color:var(--success); font-weight:600;">✅ Paid: ${money(o.paidAmount || 0)}</span>${unpaid > 0.01 ? ` | <span style="color:var(--danger); font-weight:600;">⚠️ Debt: ${money(unpaid)}</span>` : ''}</div></div>`;
    }).join('');

  const bodyEl = document.getElementById('customerProfileBody');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="profile-header"><div class="profile-avatar">👤</div><div class="profile-name">${esc(name)}</div><div class="profile-phone">📞 ${esc(custData.phone || '-')}</div></div>
      <div class="profile-stats"><div class="profile-stat"><div class="label">Visits</div><div class="value">${stats.orderCount}</div></div><div class="profile-stat paid"><div class="label">Paid</div><div class="value">${money(stats.totalPaid)}</div></div><div class="profile-stat debt"><div class="label">Debt</div><div class="value">${money(stats.totalDebt)}</div></div></div>
      ${stats.totalDebt > 0.01 ? `
        <div class="payment-form">
          <h4>💰 Record Payment</h4>
          <label class="field-label" style="margin-top:0;">💳 Payment Type</label>
          <div class="payment-type-selector"><button type="button" class="payment-type-btn active" id="payTypeCash" onclick="window.setPaymentType('cash')">💵 Cash</button><button type="button" class="payment-type-btn" id="payTypeTransfer" onclick="window.setPaymentType('transfer')">🏦 Transfer</button></div>
          <input type="hidden" id="paymentType" value="cash">
          <label class="field-label">Amount (ETB) *</label>
          <input type="number" id="paymentAmount" placeholder="0.00" step="any" max="${stats.totalDebt}">
          <label class="field-label">Date</label>
          <input type="date" id="paymentDate" value="${todayStr()}">
          <button class="btn btn-success" onclick="window.recordPayment('${escJs(name)}')" style="margin-top:12px;">💾 Record Payment</button>
        </div>
      ` : ''}
      <div class="history-section"><h4>📜 Service History</h4>${ordersHtml}</div>
      <div style="display:flex; gap:8px; margin-top:16px;"><button class="btn btn-outline" onclick="window.editCustomer('${escJs(name)}')" style="margin-top:0;">✏️ Edit</button><button class="btn btn-danger" onclick="window.deleteCustomer('${escJs(name)}')" style="margin-top:0;">🗑️ Delete</button></div>
    `;
  }
  document.getElementById(PROFILE_MODAL_ID)?.classList.add('open');
}

function closeCustomerProfile() {
  document.getElementById(PROFILE_MODAL_ID)?.classList.remove('open');
  currentCustomerName = null;
}

function setPaymentType(type) {
  document.getElementById('paymentType').value = type;
  document.getElementById('payTypeCash').classList.toggle('active', type === 'cash');
  document.getElementById('payTypeTransfer').classList.toggle('active', type === 'transfer');
}

function recordPayment(name) {
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  const paymentType = document.getElementById('paymentType').value;
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  const stats = getCustomerStats(name);
  if (amount > stats.totalDebt) return showToast('ከዕዳ መጠን መብለጥ አይችልም', 'error');

  (async () => {
    try {
      let remaining = amount;
      const unpaidOrders = [...stats.sales].filter(o => (o.unpaidAmount || 0) > 0.01).sort((a, b) => new Date(a.date) - new Date(b.date));
      for (const order of unpaidOrders) {
        if (remaining <= 0) break;
        const toPay = Math.min(remaining, order.unpaidAmount);
        await updateDoc(doc(db, 'sales', order.id), { paidAmount: (order.paidAmount || 0) + toPay, unpaidAmount: order.unpaidAmount - toPay });
        remaining -= toPay;
      }
      await addDoc(collection(db, 'payments'), { tenantId: state.tenantId, customer: name, amount, date, paymentType, createdAt: serverTimestamp() });
      showToast(`✅ ${money(amount)} ETB ተከፍሏል`);
      closeCustomerProfile();
      setTimeout(() => showCustomerProfile(name), 300);
    } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
  })();
}

function editCustomer(name) {
  const cust = allCustomers.find(c => c.name === name) || { name, phone: '' };
  editingCustomerName = name;
  document.getElementById('editCustName').value = cust.name;
  document.getElementById('editCustPhone').value = cust.phone || '';
  closeCustomerProfile();
  document.getElementById(EDIT_CUSTOMER_MODAL_ID)?.classList.add('open');
}

function closeEditCustomerModal() {
  document.getElementById(EDIT_CUSTOMER_MODAL_ID)?.classList.remove('open');
  editingCustomerName = null;
}

async function saveEditedCustomer() {
  const name = document.getElementById('editCustName').value.trim();
  const phone = document.getElementById('editCustPhone').value.trim();
  if (!name) return showToast('ስም ያስፈልጋል', 'error');
  try {
    if (editingCustomerName) {
      await setDoc(doc(db, 'customers', state.tenantId + '_' + name), { name, phone, tenantId: state.tenantId, updatedAt: serverTimestamp() }, { merge: true });
      if (editingCustomerName !== name) {
        const orders = allSales.filter(s => s.customer === editingCustomerName);
        for (const o of orders) await updateDoc(doc(db, 'sales', o.id), { customer: name, customerPhone: phone });
      } else {
        const orders = allSales.filter(s => s.customer === name);
        for (const o of orders) if (o.customerPhone !== phone) await updateDoc(doc(db, 'sales', o.id), { customerPhone: phone });
      }
    }
    showToast('✅ ተሻሽሏል');
    closeEditCustomerModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function deleteCustomer(name) {
  if (!confirm(`"${name}" ን ማጥፋት? (Sales አይጠፉም)`)) return;
  try {
    await deleteDoc(doc(db, 'customers', state.tenantId + '_' + name));
    showToast('✅ ተጠፍቷል');
    closeCustomerProfile();
  } catch (e) { showToast('❌ ስህተት', 'error'); }
}

// ═══════════════════════════════════════════
// 💸 EXPENSES & 📊 REPORTS & ⚙️ SETTINGS
// ═══════════════════════════════════════════
async function addExpense() {
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  const branch = state.plan === 'pro' ? (document.getElementById('expBranch')?.value || 'Main') : 'Main';
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  try {
    await addDoc(collection(db, 'expenses'), { tenantId: state.tenantId, category, amount, date, note, branch, createdAt: serverTimestamp() });
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
  expensesPage = 1;
  renderExpenses();
}

async function deleteExpense(id) {
  if (!confirm('ወጪውን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'expenses', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

function renderExpenses() {
  const el = document.getElementById('expenseList');
  if (!el) return;
  const search = (document.getElementById('searchExpense')?.value || '').toLowerCase();
  let filtered = [...allExpenses];
  if (expenseDateFilter === 'recent') {
    const today = todayStr();
    filtered = filtered.filter(e => e.date === today);
  } else if (expenseDateFilter === 'date') {
    const d = document.getElementById('expenseFilterDate').value;
    if (d) filtered = filtered.filter(e => e.date === d);
  } else if (expenseDateFilter === 'month') {
    const m = document.getElementById('expenseFilterMonth').value;
    if (m) filtered = filtered.filter(e => (e.date || '').startsWith(m));
  }
  if (search) filtered = filtered.filter(e => (e.category || '').toLowerCase().includes(search) || (e.note || '').toLowerCase().includes(search));
  filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const filteredTotal = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const allTotal = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(filteredTotal);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allTotal);

  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">💸 ምንም ወጪ የለም</div>';
    renderPagination('expensesPagination', 0, expensesPage, expensesPerPage, (p) => { expensesPage = p; renderExpenses(); }, (pp) => { expensesPerPage = pp; expensesPage = 1; renderExpenses(); });
    return;
  }

  const totalPages = Math.ceil(filtered.length / expensesPerPage);
  if (expensesPage > totalPages) expensesPage = totalPages;
  const start = (expensesPage - 1) * expensesPerPage;
  const paginated = filtered.slice(start, start + expensesPerPage);

  el.innerHTML = paginated.map(e => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); gap:12px;"><div style="flex:1; min-width:0;"><div style="font-weight:600; font-size:13px; color:var(--text-main);">${esc(e.category)}</div><div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">📅 ${esc(e.date)}${e.note ? ' • 📝 ' + esc(e.note) : ''}${e.branch && state.plan === 'pro' ? ` • 🏢 ${esc(e.branch)}` : ''}</div></div><div style="font-weight:800; font-size:14px; color:var(--danger); white-space:nowrap;">${money(e.amount)} ETB</div><button onclick="window.deleteExpense('${e.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button></div>`).join('');

  renderPagination('expensesPagination', filtered.length, expensesPage, expensesPerPage, (p) => { expensesPage = p; renderExpenses(); }, (pp) => { expensesPerPage = pp; expensesPage = 1; renderExpenses(); });
}

function setReportType(type, btn) {
  reportType = type;
  document.querySelectorAll('.report-type-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const dateInput = document.getElementById('reportDate');
  const monthInput = document.getElementById('reportMonth');
  const yearInput = document.getElementById('reportYear');
  if (type === 'daily') { dateInput.style.display = 'block'; monthInput.style.display = 'none'; yearInput.style.display = 'none'; }
  else if (type === 'monthly') { dateInput.style.display = 'none'; monthInput.style.display = 'block'; yearInput.style.display = 'none'; }
  else { dateInput.style.display = 'none'; monthInput.style.display = 'none'; yearInput.style.display = 'block'; }
  renderReports();
}

function renderReports() {
  if (!document.getElementById('repRevenue')) return;
  let prefix = todayStr(); let label = 'Daily';
  if (reportType === 'daily') { prefix = document.getElementById('reportDate').value || todayStr(); label = `Daily (${prefix})`; }
  else if (reportType === 'monthly') { prefix = document.getElementById('reportMonth').value || thisMonthStr(); label = `Monthly (${prefix})`; }
  else { prefix = document.getElementById('reportYear').value || thisYearStr(); label = `Yearly (${prefix})`; }

  const branchFilter = state.plan === 'pro' ? (document.getElementById('reportBranch')?.value || 'all') : 'all';
  let periodSales = allSales.filter(o => (o.date || '').startsWith(prefix));
  let periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  if (branchFilter !== 'all') { periodSales = periodSales.filter(o => o.branch === branchFilter); periodExpenses = periodExpenses.filter(e => e.branch === branchFilter); }

  const revenue = periodSales.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const unpaid = periodSales.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const profit = revenue - expenses;
  const cashTotal = periodSales.filter(o => (o.paymentType || 'cash') === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferTotal = periodSales.filter(o => o.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);

  document.getElementById('repRevenue').textContent = money(revenue);
  document.getElementById('repExpenses').textContent = money(expenses);
  document.getElementById('repProfit').textContent = money(profit);
  document.getElementById('repUnpaid').textContent = money(unpaid);
  document.getElementById('repCash').textContent = money(cashTotal) + ' ETB';
  document.getElementById('repTransfer').textContent = money(transferTotal) + ' ETB';
  document.getElementById('reportHeader').textContent = label;
}

async function saveSettings() {
  const name = document.getElementById('settingBizName').value.trim();
  const phone = document.getElementById('settingBizPhone').value.trim();
  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { name, phone });
    const hdr = document.getElementById('hdrBusinessName');
    if (hdr && name) hdr.textContent = name;
    showToast('✅ ተቀምጧል');
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

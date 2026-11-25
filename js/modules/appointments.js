// js/modules/appointments.js
import { db } from '../firebase.js';
import { collection, addDoc, query, where, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allAppointments = [];
let allOrders = [];
let allExpenses = [];
let allPayments = [];
let allCustomers = [];

let apptPage = 1, ordersPage = 1, customersPage = 1, expensesPage = 1;
let apptPerPage = 10, ordersPerPage = 10, customersPerPage = 10, expensesPerPage = 10;

let apptStatusFilter = 'all';
let orderDateFilter = 'recent';
let expenseDateFilter = 'recent';
let reportType = 'daily';

let editingApptId = null;
let editingOrderId = null;
let currentCustomerName = null;

let unsubBranches = null, unsubAppts = null, unsubOrders = null, unsubExpenses = null, unsubPayments = null, unsubCustomers = null;

const APPT_MODAL_ID = 'appointmentModal';
const ORDER_MODAL_ID = 'orderModal';
const PROFILE_MODAL_ID = 'customerProfileModal';

const APPOINTMENTS_MODALS_HTML = `
<div class="modal-overlay" id="${APPT_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="apptModalTitle">📅 New Appointment</h3>
      <button class="modal-close" onclick="window.closeApptModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="apptBranchSection" style="display:none;">
        <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
        <select id="apptBranch"></select>
      </div>
      <label class="field-label" style="margin-top:0;">👤 Customer Name *</label>
      <input type="text" id="apptCustomer" list="apptCustomerList" placeholder="Customer name">
      <datalist id="apptCustomerList"></datalist>
      <label class="field-label">📞 Phone</label>
      <input type="text" id="apptPhone" placeholder="+251...">
      <label class="field-label">📅 Appointment Date *</label>
      <input type="date" id="apptDate">
      <label class="field-label">⏰ Time</label>
      <input type="time" id="apptTime">
      <label class="field-label">🏷️ Appointment Type / Service *</label>
      <input list="apptTypeList" id="apptType" placeholder="e.g. ልኬት, መረከብ, ምክክር">
      <datalist id="apptTypeList">
        <option value="ልኬት">
        <option value="መረከብ">
        <option value="ምክክር">
        <option value="ጥገና">
      </datalist>
      <label class="field-label">📌 Status</label>
      <select id="apptStatus">
        <option value="scheduled">🕒 Scheduled</option>
        <option value="completed">✅ Completed</option>
        <option value="cancelled">❌ Cancelled</option>
      </select>
      <label class="field-label">📝 Note</label>
      <input type="text" id="apptNote" placeholder="Additional details...">
      <button class="btn btn-primary" onclick="window.saveAppointment()" id="saveApptBtn">💾 Save Appointment</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="${ORDER_MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="orderModalTitle">📦 New Order</h3>
      <button class="modal-close" onclick="window.closeOrderModal()">×</button>
    </div>
    <div class="modal-body">
      <div id="orderBranchSection" style="display:none;">
        <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
        <select id="orderBranch"></select>
      </div>
      <label class="field-label" style="margin-top:0;">👤 Customer Name *</label>
      <input type="text" id="orderCustomer" list="apptCustomerList" placeholder="Customer name">
      <label class="field-label">📞 Phone</label>
      <input type="text" id="orderPhone" placeholder="+251...">
      <label class="field-label">📦 Order Item / Description *</label>
      <input type="text" id="orderTitle" placeholder="e.g. የተሰራ ልብስ / ጫማ ትዕዛዝ">
      <label class="field-label">🔢 Quantity</label>
      <input type="number" id="orderQty" placeholder="1" value="1" min="1" step="any">
      <label class="field-label">📅 Order Date *</label>
      <input type="date" id="orderDate">
      <label class="field-label">💰 Total Amount (ETB) *</label>
      <input type="number" id="orderTotal" placeholder="0.00" step="any" oninput="window.updateOrderUnpaid()">
      <label class="field-label">💵 Paid Amount (ETB)</label>
      <input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.updateOrderUnpaid()">
      <div style="font-size:13px; color:var(--danger); font-weight:700; margin-top:8px;" id="orderUnpaidPreview">📝 Unpaid: 0.00 ETB</div>
      <label class="field-label">💳 Payment Type</label>
      <select id="orderPaymentType">
        <option value="cash">💵 Cash</option>
        <option value="transfer">🏦 Transfer</option>
        <option value="credit">📝 Credit</option>
      </select>
      <label class="field-label">📌 Order Status</label>
      <select id="orderStatus">
        <option value="pending">⏳ Pending</option>
        <option value="ready">📦 Ready</option>
        <option value="delivered">✅ Delivered</option>
      </select>
      <label class="field-label">📝 Note</label>
      <input type="text" id="orderNote" placeholder="Delivery / custom instructions...">
      <button class="btn btn-success" onclick="window.saveOrder()" id="saveOrderBtn">💾 Save Order</button>
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
`;

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const AppointmentsModule = {
  name: 'Appointments',
  icon: '📅',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panelAppointments', label: 'Appointments', icon: '📅' },
    { id: 'panelOrders', label: 'Orders', icon: '📦' },
    { id: 'panelCustomers', label: 'Customers', icon: '👥' },
    { id: 'panel8', label: 'More', icon: '⚙️' },
    // ከዚህ በታች ያሉት በሞባይል ማውጫ ላይ አይታዩም (slice(0, 5))
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
        <div class="qa-card" onclick="switchPage('panelAppointments', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📅</div><div class="qa-title">Appointments</div></div>
        <div class="qa-card" onclick="switchPage('panelOrders', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">📦</div><div class="qa-title">Orders</div></div>
        <div class="qa-card" onclick="switchPage('panelCustomers', null)"><div class="qa-icon" style="background:rgba(16,185,129,0.1); color:var(--success);">👥</div><div class="qa-title">Customers</div></div>
        <div class="qa-card" onclick="switchPage('panel4', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div><div class="qa-title">Expenses</div></div>
        <div class="qa-card" onclick="switchPage('panel6', null)"><div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">📊</div><div class="qa-title">Reports</div></div>
      </div>
    `},
    { id: 'panelAppointments', html: `
      <div class="card">
        <div class="card-title"><span>📅 Appointments</span><button class="btn btn-primary btn-sm" onclick="window.openApptModal()">➕ New Appointment</button></div>
        <div class="filter-bar">
          <input type="text" id="searchAppointments" placeholder="🔍 Search customer or type..." oninput="window.apApptSearch()">
          <select id="apptBranchFilter" onchange="window.apApptSearch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select>
        </div>
        <div class="date-filter-chips" id="apptStatusChips">
          <button class="date-chip active" onclick="window.setApptStatusFilter('all', this)">All</button>
          <button class="date-chip" onclick="window.setApptStatusFilter('scheduled', this)">Scheduled</button>
          <button class="date-chip" onclick="window.setApptStatusFilter('completed', this)">Completed</button>
          <button class="date-chip" onclick="window.setApptStatusFilter('cancelled', this)">Cancelled</button>
        </div>
        <div id="appointmentsListContainer"></div>
        <div class="pagination-controls" id="appointmentsPagination"></div>
      </div>
    `},
    { id: 'panelOrders', html: `
      <div class="card">
        <div class="card-title"><span>📦 Orders</span><button class="btn btn-success btn-sm" onclick="window.openOrderModal()">➕ New Order</button></div>
        <div class="filter-bar">
          <input type="text" id="searchOrders" placeholder="🔍 Search customer or order..." oninput="window.apOrdersSearch()">
          <select id="orderBranchFilter" onchange="window.apOrdersSearch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select>
        </div>
        <div class="date-filter-chips" id="orderDateChips">
          <button class="date-chip active" onclick="window.setOrderDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setOrderDateFilter('all', this)">All</button>
        </div>
        <div id="orderDatePicker" style="display:none; margin-bottom:12px;">
          <input type="date" id="orderFilterDate" onchange="window.apOrdersSearch()">
          <input type="month" id="orderFilterMonth" onchange="window.apOrdersSearch()" style="display:none;">
        </div>
        <div id="ordersListContainer"></div>
        <div class="pagination-controls" id="ordersPagination"></div>
      </div>
    `},
    { id: 'panelCustomers', html: `
      <div class="card">
        <div class="card-title"><span>👥 Customers</span></div>
        <div class="filter-bar">
          <input type="text" id="searchCustomers" placeholder="🔍 Search customer..." oninput="window.apCustomersSearch()">
          <select id="customerBranchFilter" onchange="window.apCustomersSearch()" style="display:none; width:auto;"><option value="all">📊 All Branches</option></select>
        </div>
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
          <datalist id="expenseCategoryList"><option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water"><option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport"><option value="📱 Phone"></datalist>
          <label class="field-label">💰 Amount (ETB) *</label><input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label><input type="date" id="expDate">
          <label class="field-label">📝 Note</label><input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.addExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar"><input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="window.apExpensesSearch()"></div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.setExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.setExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;">
          <input type="date" id="expenseFilterDate" oninput="window.apExpensesSearch()">
          <input type="month" id="expenseFilterMonth" oninput="window.apExpensesSearch()" style="display:none;">
        </div>
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
        !document.getElementById(APPT_MODAL_ID) ||
        !document.getElementById(ORDER_MODAL_ID) ||
        !document.getElementById(PROFILE_MODAL_ID)
      ) {
        modalHost.insertAdjacentHTML('beforeend', APPOINTMENTS_MODALS_HTML);
      }
    }

    window.openApptModal = openApptModal;
    window.closeApptModal = closeApptModal;
    window.saveAppointment = saveAppointment;
    window.deleteAppointment = deleteAppointment;
    window.updateApptStatus = updateApptStatus;
    window.setApptStatusFilter = setApptStatusFilter;
    window.renderAppointments = renderAppointments;

    window.openOrderModal = openOrderModal;
    window.closeOrderModal = closeOrderModal;
    window.saveOrder = saveOrder;
    window.deleteOrder = deleteOrder;
    window.updateOrderStatus = updateOrderStatus;
    window.updateOrderUnpaid = updateOrderUnpaid;
    window.setOrderDateFilter = setOrderDateFilter;
    window.renderOrders = renderOrders;

    window.renderCustomersList = renderCustomersList;
    window.showCustomerProfile = showCustomerProfile;
    window.closeCustomerProfile = closeCustomerProfile;
    window.recordPayment = recordPayment;

    window.addExpense = addExpense;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.renderExpenses = renderExpenses;
    window.deleteExpense = deleteExpense;

    window.setReportType = setReportType;
    window.renderReports = renderReports;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;

    window.apApptSearch = () => { apptPage = 1; renderAppointments(); };
    window.apOrdersSearch = () => { ordersPage = 1; renderOrders(); };
    window.apCustomersSearch = () => { customersPage = 1; renderCustomersList(); };
    window.apExpensesSearch = () => { expensesPage = 1; renderExpenses(); };

    const today = todayStr();
    if (document.getElementById('apptDate')) document.getElementById('apptDate').value = today;
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
    if (panelId === 'panelAppointments') renderAppointments();
    if (panelId === 'panelOrders') renderOrders();
    if (panelId === 'panelCustomers') renderCustomersList();
    if (panelId === 'panel4') renderExpenses();
    if (panelId === 'panel6') renderReports();
    if (panelId === 'panelMobileHome') updateMobileHome();
  },

  cleanup: () => {
    if (unsubBranches) unsubBranches();
    if (unsubAppts) unsubAppts();
    if (unsubOrders) unsubOrders();
    if (unsubExpenses) unsubExpenses();
    if (unsubPayments) unsubPayments();
    if (unsubCustomers) unsubCustomers();
    unsubBranches = unsubAppts = unsubOrders = unsubExpenses = unsubPayments = unsubCustomers = null;

    document.getElementById(APPT_MODAL_ID)?.remove();
    document.getElementById(ORDER_MODAL_ID)?.remove();
    document.getElementById(PROFILE_MODAL_ID)?.remove();

    allBranches = []; allAppointments = []; allOrders = []; allExpenses = []; allPayments = []; allCustomers = [];
    apptPage = 1; ordersPage = 1; customersPage = 1; expensesPage = 1;
    apptStatusFilter = 'all'; orderDateFilter = 'recent'; expenseDateFilter = 'recent'; reportType = 'daily';
    editingApptId = null; editingOrderId = null; currentCustomerName = null;

    const fnNames = [
      'openApptModal', 'closeApptModal', 'saveAppointment', 'deleteAppointment', 'updateApptStatus',
      'setApptStatusFilter', 'renderAppointments', 'openOrderModal', 'closeOrderModal', 'saveOrder',
      'deleteOrder', 'updateOrderStatus', 'updateOrderUnpaid', 'setOrderDateFilter', 'renderOrders',
      'renderCustomersList', 'showCustomerProfile', 'closeCustomerProfile', 'recordPayment',
      'addExpense', 'setExpenseDateFilter', 'renderExpenses', 'deleteExpense', 'setReportType',
      'renderReports', 'saveSettings', 'addBranch', 'deleteBranch', 'apApptSearch', 'apOrdersSearch',
      'apCustomersSearch', 'apExpensesSearch'
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
  unsubAppts = onSnapshot(query(collection(db, 'appointments'), where('tenantId', '==', tenantId)), snap => {
    allAppointments = []; snap.forEach(d => allAppointments.push({ id: d.id, ...d.data() }));
    allAppointments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderAppointments(); renderCustomersList();
  });
  unsubOrders = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', tenantId)), snap => {
    allOrders = []; snap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
    allOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
  const orderSales = allOrders.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const extraPayments = allPayments.filter(p => p.date === today).reduce((s, p) => s + (p.amount || 0), 0);
  const todaySales = orderSales + extraPayments;
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + (e.amount || 0), 0);
  const todayProfit = todaySales - todayExpenses;
  const el1 = document.getElementById('mobTodaySales'); if (el1) el1.textContent = money(todaySales);
  const el2 = document.getElementById('mobTodayExpenses'); if (el2) el2.textContent = money(todayExpenses);
  const el3 = document.getElementById('mobTodayProfit'); if (el3) el3.textContent = money(todayProfit);
}

function updateCustomerDatalist() {
  const dl = document.getElementById('apptCustomerList');
  if (dl) dl.innerHTML = allCustomers.map(c => `<option value="${esc(c.name)}">`).join('');
}

async function ensureCustomer(name, phone = '') {
  const cleanName = (name || '').trim();
  if (!cleanName || !state.tenantId) return;
  const existing = allCustomers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
  if (!existing) {
    await setDoc(doc(db, 'customers', state.tenantId + '_' + cleanName), {
      name: cleanName,
      phone: (phone || '').trim(),
      tenantId: state.tenantId,
      createdAt: serverTimestamp()
    }, { merge: true });
  } else if (phone && !existing.phone) {
    await updateDoc(doc(db, 'customers', existing.id), { phone: phone.trim() });
  }
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
  const sections = ['apptBranchSection', 'orderBranchSection', 'expBranchSection', 'reportBranchSection', 'apptBranchFilter', 'orderBranchFilter', 'customerBranchFilter'];
  sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = hasBranches ? 'block' : 'none'; });
  const selects = ['apptBranch', 'orderBranch', 'expBranch', 'reportBranch', 'apptBranchFilter', 'orderBranchFilter', 'customerBranchFilter'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el && hasBranches) {
      const currentVal = el.value;
      const isAll = id.includes('Filter') || id === 'reportBranch';
      el.innerHTML = (isAll ? '<option value="all">📊 All Branches</option>' : '') + options;
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
// 📅 APPOINTMENTS
// ═══════════════════════════════════════════
function openApptModal(id = null) {
  editingApptId = id;
  if (id) {
    const a = allAppointments.find(x => x.id === id);
    if (!a) return;
    document.getElementById('apptModalTitle').textContent = '✏️ Edit Appointment';
    document.getElementById('apptCustomer').value = a.customer || '';
    document.getElementById('apptPhone').value = a.phone || '';
    document.getElementById('apptDate').value = a.date || todayStr();
    document.getElementById('apptTime').value = a.time || '';
    document.getElementById('apptType').value = a.type || '';
    document.getElementById('apptStatus').value = a.status || 'scheduled';
    document.getElementById('apptNote').value = a.note || '';
    if (state.plan === 'pro' && a.branch && document.getElementById('apptBranch')) {
      document.getElementById('apptBranch').value = a.branch;
    }
    document.getElementById('saveApptBtn').textContent = '💾 Update Appointment';
  } else {
    document.getElementById('apptModalTitle').textContent = '📅 New Appointment';
    document.getElementById('apptCustomer').value = '';
    document.getElementById('apptPhone').value = '';
    document.getElementById('apptDate').value = todayStr();
    document.getElementById('apptTime').value = '';
    document.getElementById('apptType').value = '';
    document.getElementById('apptStatus').value = 'scheduled';
    document.getElementById('apptNote').value = '';
    document.getElementById('saveApptBtn').textContent = '💾 Save Appointment';
  }
  document.getElementById(APPT_MODAL_ID)?.classList.add('open');
}

function closeApptModal() {
  document.getElementById(APPT_MODAL_ID)?.classList.remove('open');
  editingApptId = null;
}

async function saveAppointment() {
  const customer = document.getElementById('apptCustomer').value.trim();
  const phone = document.getElementById('apptPhone').value.trim();
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  const type = document.getElementById('apptType').value.trim();
  const status = document.getElementById('apptStatus').value;
  const note = document.getElementById('apptNote').value.trim();
  const branch = state.plan === 'pro' ? (document.getElementById('apptBranch')?.value || 'Main') : 'Main';

  if (!customer) return showToast('የደንበኛ ስም ያስፈልጋል', 'error');
  if (!date) return showToast('የቀጠሮ ቀን ያስፈልጋል', 'error');
  if (!type) return showToast('የቀጠሮ ዓይነት ያስፈልጋል', 'error');

  try {
    await ensureCustomer(customer, phone);
    const payload = { customer, phone, date, time, type, status, note, branch };
    if (editingApptId) {
      await updateDoc(doc(db, 'appointments', editingApptId), payload);
      showToast('✅ ቀጠሮ ተሻሽሏል');
    } else {
      payload.tenantId = state.tenantId;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'appointments'), payload);
      showToast('✅ ቀጠሮ ተመዝግቧል');
    }
    closeApptModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function updateApptStatus(id, status) {
  try {
    await updateDoc(doc(db, 'appointments', id), { status });
    showToast('✅ ሁኔታ ተቀይሯል');
  } catch (e) { showToast('❌ ስህተት', 'error'); }
}

async function deleteAppointment(id) {
  if (!confirm('ቀጠሮውን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'appointments', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

function setApptStatusFilter(status, btn) {
  apptStatusFilter = status;
  document.querySelectorAll('#apptStatusChips .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  apptPage = 1;
  renderAppointments();
}

function getApptBadge(status) {
  if (status === 'completed') return '<span style="background:rgba(16,185,129,0.12); color:var(--success); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">✅ Completed</span>';
  if (status === 'cancelled') return '<span style="background:rgba(239,68,68,0.12); color:var(--danger); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">❌ Cancelled</span>';
  return '<span style="background:rgba(59,130,246,0.12); color:var(--info); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">🕒 Scheduled</span>';
}

function renderAppointments() {
  const el = document.getElementById('appointmentsListContainer');
  if (!el) return;
  const search = (document.getElementById('searchAppointments')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('apptBranchFilter')?.value || 'all') : 'all';

  let filtered = [...allAppointments];
  if (branchFilter !== 'all') filtered = filtered.filter(a => a.branch === branchFilter);
  if (apptStatusFilter !== 'all') filtered = filtered.filter(a => (a.status || 'scheduled') === apptStatusFilter);
  if (search) {
    filtered = filtered.filter(a =>
      (a.customer || '').toLowerCase().includes(search) ||
      (a.phone || '').toLowerCase().includes(search) ||
      (a.type || '').toLowerCase().includes(search) ||
      (a.note || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:44px; margin-bottom:10px;">📅</div><div style="font-weight:600;">ምንም ቀጠሮ የለም</div></div>';
    renderPagination('appointmentsPagination', 0, apptPage, apptPerPage, (p) => { apptPage = p; renderAppointments(); }, (pp) => { apptPerPage = pp; apptPage = 1; renderAppointments(); });
    return;
  }

  const totalPages = Math.ceil(filtered.length / apptPerPage);
  if (apptPage > totalPages) apptPage = totalPages;
  const start = (apptPage - 1) * apptPerPage;
  const paginated = filtered.slice(start, start + apptPerPage);

  el.innerHTML = paginated.map(a => `
    <div class="order-card" style="border-left: 4px solid var(--info);">
      <div class="order-card-header">
        <div>
          <div class="order-card-customer">👤 ${esc(a.customer || '-')}</div>
          <div class="order-card-phone">📞 ${esc(a.phone || '-')} • 🏷️ ${esc(a.type || '-')}</div>
          ${a.branch && state.plan === 'pro' ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🏢 ${esc(a.branch)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div class="order-card-pickup">📅 ${esc(a.date || '-')} ${a.time ? `• ⏰ ${esc(a.time)}` : ''}</div>
          <div style="margin-top:6px;">${getApptBadge(a.status || 'scheduled')}</div>
        </div>
      </div>
      ${a.note ? `<div class="order-card-items">📝 ${esc(a.note)}</div>` : ''}
      <div class="order-card-footer" style="gap:8px; flex-wrap:wrap;">
        <select onchange="window.updateApptStatus('${a.id}', this.value)" style="width:auto; padding:5px 8px; font-size:12px; border-radius:6px;">
          <option value="scheduled" ${(a.status || 'scheduled') === 'scheduled' ? 'selected' : ''}>🕒 Scheduled</option>
          <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
          <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
        </select>
        <div style="display:flex; gap:6px;">
          <button onclick="window.openApptModal('${a.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:5px 10px; border-radius:6px; border:none; cursor:pointer; font-size:12px;">✏️ Edit</button>
          <button onclick="window.deleteAppointment('${a.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:5px 10px; border-radius:6px; border:none; cursor:pointer; font-size:12px;">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  renderPagination('appointmentsPagination', filtered.length, apptPage, apptPerPage, (p) => { apptPage = p; renderAppointments(); }, (pp) => { apptPerPage = pp; apptPage = 1; renderAppointments(); });
}

// ═══════════════════════════════════════════
// 📦 ORDERS
// ═══════════════════════════════════════════
function openOrderModal(id = null) {
  editingOrderId = id;
  if (id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const firstItem = (o.items && o.items[0]) || {};
    document.getElementById('orderModalTitle').textContent = '✏️ Edit Order';
    document.getElementById('orderCustomer').value = o.customer || '';
    document.getElementById('orderPhone').value = o.customerPhone || '';
    document.getElementById('orderTitle').value = o.orderTitle || firstItem.name || '';
    document.getElementById('orderQty').value = o.orderQty || firstItem.qty || 1;
    document.getElementById('orderDate').value = o.date || todayStr();
    document.getElementById('orderTotal').value = o.total ?? 0;
    document.getElementById('orderPaid').value = o.paidAmount ?? 0;
    document.getElementById('orderPaymentType').value = o.paymentType || 'cash';
    document.getElementById('orderStatus').value = o.orderStatus || 'pending';
    document.getElementById('orderNote').value = o.note || '';
    if (state.plan === 'pro' && o.branch && document.getElementById('orderBranch')) {
      document.getElementById('orderBranch').value = o.branch;
    }
    document.getElementById('saveOrderBtn').textContent = '💾 Update Order';
  } else {
    document.getElementById('orderModalTitle').textContent = '📦 New Order';
    document.getElementById('orderCustomer').value = '';
    document.getElementById('orderPhone').value = '';
    document.getElementById('orderTitle').value = '';
    document.getElementById('orderQty').value = '1';
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('orderTotal').value = '';
    document.getElementById('orderPaid').value = '';
    document.getElementById('orderPaymentType').value = 'cash';
    document.getElementById('orderStatus').value = 'pending';
    document.getElementById('orderNote').value = '';
    document.getElementById('saveOrderBtn').textContent = '💾 Save Order';
  }
  updateOrderUnpaid();
  document.getElementById(ORDER_MODAL_ID)?.classList.add('open');
}

function closeOrderModal() {
  document.getElementById(ORDER_MODAL_ID)?.classList.remove('open');
  editingOrderId = null;
}

function updateOrderUnpaid() {
  const total = parseFloat(document.getElementById('orderTotal')?.value) || 0;
  const paid = parseFloat(document.getElementById('orderPaid')?.value) || 0;
  const unpaid = Math.max(0, total - paid);
  const el = document.getElementById('orderUnpaidPreview');
  if (el) el.textContent = `📝 Unpaid: ${money(unpaid)} ETB`;
}

async function saveOrder() {
  const customer = document.getElementById('orderCustomer').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const title = document.getElementById('orderTitle').value.trim();
  const qty = parseFloat(document.getElementById('orderQty').value) || 1;
  const date = document.getElementById('orderDate').value;
  const total = parseFloat(document.getElementById('orderTotal').value);
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  const orderStatus = document.getElementById('orderStatus').value;
  const note = document.getElementById('orderNote').value.trim();
  const branch = state.plan === 'pro' ? (document.getElementById('orderBranch')?.value || 'Main') : 'Main';

  if (!customer) return showToast('የደንበኛ ስም ያስፈልጋል', 'error');
  if (!title) return showToast('የትዕዛዝ ዝርዝር ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(total) || total <= 0) return showToast('ትክክል ያለው ጠቅላላ ዋጋ ያስፈልጋል', 'error');
  if (paid < 0 || paid > total) return showToast('የተከፈለው ዋጋ ከ 0 እስከ ጠቅላላ መሆን አለበት', 'error');

  try {
    await ensureCustomer(customer, phone);
    const unitPrice = qty > 0 ? total / qty : total;
    const items = [{ name: title, qty, price: unitPrice, total }];
    const payload = {
      customer,
      customerPhone: phone,
      orderTitle: title,
      orderQty: qty,
      date,
      items,
      total,
      paidAmount: paid,
      unpaidAmount: Math.max(0, total - paid),
      paymentType,
      orderStatus,
      note,
      branch,
      moduleType: 'appointments_orders'
    };

    if (editingOrderId) {
      await updateDoc(doc(db, 'sales', editingOrderId), payload);
      showToast('✅ Order ተሻሽሏል');
    } else {
      payload.tenantId = state.tenantId;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, 'sales'), payload);
      showToast('✅ Order ተመዝግቧል');
    }
    closeOrderModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
}

async function updateOrderStatus(id, orderStatus) {
  try {
    await updateDoc(doc(db, 'sales', id), { orderStatus });
    showToast('✅ የትዕዛዝ ሁኔታ ተቀይሯል');
  } catch (e) { showToast('❌ ስህተት', 'error'); }
}

async function deleteOrder(id) {
  if (!confirm('ትዕዛዙን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'sales', id)); showToast('✅ ተጠፍቷል'); } catch (e) { showToast('❌ ስህተት', 'error'); }
}

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

function getOrderBadge(status) {
  if (status === 'delivered') return '<span style="background:rgba(16,185,129,0.12); color:var(--success); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">✅ Delivered</span>';
  if (status === 'ready') return '<span style="background:rgba(59,130,246,0.12); color:var(--info); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">📦 Ready</span>';
  return '<span style="background:rgba(245,158,11,0.12); color:var(--warning); padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700;">⏳ Pending</span>';
}

function renderOrders() {
  const el = document.getElementById('ordersListContainer');
  if (!el) return;
  const search = (document.getElementById('searchOrders')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('orderBranchFilter')?.value || 'all') : 'all';

  let filtered = [...allOrders];
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
      (o.orderTitle || '').toLowerCase().includes(search) ||
      (o.items || []).some(i => (i.name || '').toLowerCase().includes(search))
    );
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:44px; margin-bottom:10px;">📦</div><div style="font-weight:600;">ምንም ትዕዛዝ የለም</div></div>';
    renderPagination('ordersPagination', 0, ordersPage, ordersPerPage, (p) => { ordersPage = p; renderOrders(); }, (pp) => { ordersPerPage = pp; ordersPage = 1; renderOrders(); });
    return;
  }

  const totalPages = Math.ceil(filtered.length / ordersPerPage);
  if (ordersPage > totalPages) ordersPage = totalPages;
  const start = (ordersPage - 1) * ordersPerPage;
  const paginated = filtered.slice(start, start + ordersPerPage);

  el.innerHTML = paginated.map(o => {
    const itemsText = (o.items || []).map(i => `${esc(i.name)} × ${i.qty} (${money(i.total)} ETB)`).join(', ');
    const unpaid = o.unpaidAmount || 0;
    const status = o.orderStatus || 'pending';
    return `
      <div class="order-card" style="border-left: 4px solid var(--primary);">
        <div class="order-card-header">
          <div>
            <div class="order-card-customer">👤 ${esc(o.customer || '-')}</div>
            <div class="order-card-phone">📞 ${esc(o.customerPhone || '-')}</div>
            ${o.branch && state.plan === 'pro' ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">🏢 ${esc(o.branch)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div class="order-card-pickup">📅 ${esc(o.date || '-')}</div>
            <div style="margin-top:6px;">${getOrderBadge(status)}</div>
          </div>
        </div>
        <div class="order-card-items">📦 ${itemsText || esc(o.orderTitle || '-')}${o.note ? `<br><span style="color:var(--text-muted); font-size:12px;">📝 ${esc(o.note)}</span>` : ''}</div>
        <div class="order-card-footer" style="gap:8px; flex-wrap:wrap;">
          <div>
            <span class="order-card-total">Total: ${money(o.total)} ETB</span>
            <div style="margin-top:4px;">
              <span class="order-card-paid">✅ Paid: ${money(o.paidAmount || 0)}</span>
              ${unpaid > 0.01 ? `<span class="order-card-unpaid" style="margin-left:8px;">⚠️ Unpaid: ${money(unpaid)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <select onchange="window.updateOrderStatus('${o.id}', this.value)" style="width:auto; padding:5px 8px; font-size:12px; border-radius:6px;">
              <option value="pending" ${status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
              <option value="ready" ${status === 'ready' ? 'selected' : ''}>📦 Ready</option>
              <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>✅ Delivered</option>
            </select>
            <button onclick="window.openOrderModal('${o.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:5px 10px; border-radius:6px; border:none; cursor:pointer; font-size:12px;">✏️</button>
            <button onclick="window.deleteOrder('${o.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:5px 10px; border-radius:6px; border:none; cursor:pointer; font-size:12px;">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  renderPagination('ordersPagination', filtered.length, ordersPage, ordersPerPage, (p) => { ordersPage = p; renderOrders(); }, (pp) => { ordersPerPage = pp; ordersPage = 1; renderOrders(); });
}

// ═══════════════════════════════════════════
// 👥 CUSTOMERS & CREDIT
// ═══════════════════════════════════════════
function getCustomerStats(name) {
  const orders = allOrders.filter(o => o.customer === name);
  const appts = allAppointments.filter(a => a.customer === name);
  const totalPaid = orders.reduce((s, x) => s + (x.paidAmount || 0), 0);
  const totalDebt = orders.reduce((s, x) => s + (x.unpaidAmount || 0), 0);
  return { orders, appts, totalPaid, totalDebt, orderCount: orders.length, apptCount: appts.length };
}

function renderCustomersList() {
  const el = document.getElementById('customersListContainer');
  if (!el) return;
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();
  const branchFilter = state.plan === 'pro' ? (document.getElementById('customerBranchFilter')?.value || 'all') : 'all';

  const map = {};
  allCustomers.forEach(c => { map[c.name] = { name: c.name, phone: c.phone || '' }; });
  allOrders.forEach(o => { if (!o.customer) return; if (!map[o.customer]) map[o.customer] = { name: o.customer, phone: o.customerPhone || '' }; });
  allAppointments.forEach(a => { if (!a.customer) return; if (!map[a.customer]) map[a.customer] = { name: a.customer, phone: a.phone || '' }; });

  let list = Object.values(map);
  if (branchFilter !== 'all') {
    list = list.filter(c =>
      allOrders.some(o => o.customer === c.name && o.branch === branchFilter) ||
      allAppointments.some(a => a.customer === c.name && a.branch === branchFilter)
    );
  }
  if (search) {
    list = list.filter(c => c.name.toLowerCase().includes(search) || (c.phone || '').toLowerCase().includes(search));
  }

  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">👥 ምንም ደንበኛ የለም</div>';
    return;
  }

  list.sort((a, b) => getCustomerStats(b.name).totalDebt - getCustomerStats(a.name).totalDebt);
  const totalPages = Math.ceil(list.length / customersPerPage);
  if (customersPage > totalPages) customersPage = totalPages;
  const start = (customersPage - 1) * customersPerPage;
  const paginated = list.slice(start, start + customersPerPage);

  el.innerHTML = paginated.map(c => {
    const stats = getCustomerStats(c.name);
    return `
      <div class="customer-card" onclick="window.showCustomerProfile('${escJs(c.name)}')">
        <div class="customer-row">
          <div class="customer-info">
            <div class="customer-name">👤 ${esc(c.name)}</div>
            <div class="customer-meta">📞 ${esc(c.phone || '-')} | 📅 ${stats.apptCount} appts | 📦 ${stats.orderCount} orders | 💰 ${money(stats.totalPaid)} paid</div>
          </div>
          ${stats.totalDebt > 0.01 ? `<div class="customer-debt-badge">⚠️ ${money(stats.totalDebt)}</div>` : '<div style="color:var(--success); font-size:20px;">✓</div>'}
        </div>
      </div>
    `;
  }).join('');

  renderPagination('customersPagination', list.length, customersPage, customersPerPage, (p) => { customersPage = p; renderCustomersList(); }, (pp) => { customersPerPage = pp; customersPage = 1; renderCustomersList(); });
}

function showCustomerProfile(name) {
  currentCustomerName = name;
  const stats = getCustomerStats(name);
  const custData = allCustomers.find(c => c.name === name) || {};

  const apptsHtml = stats.appts.length === 0
    ? '<p style="text-align:center; color:var(--text-muted); padding:12px;">ምንም ቀጠሮ የለም</p>'
    : [...stats.appts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(a => `
      <div class="history-item">
        <div class="history-row"><span class="history-date">📅 ${esc(a.date)} ${a.time ? `• ⏰ ${esc(a.time)}` : ''}</span><span>${getApptBadge(a.status || 'scheduled')}</span></div>
        <div class="history-items">🏷️ ${esc(a.type || '-')} ${a.note ? `• ${esc(a.note)}` : ''}</div>
      </div>
    `).join('');

  const ordersHtml = stats.orders.length === 0
    ? '<p style="text-align:center; color:var(--text-muted); padding:12px;">ምንም ትዕዛዝ የለም</p>'
    : [...stats.orders].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(o => {
      const unpaid = o.unpaidAmount || 0;
      return `
        <div class="history-item">
          <div class="history-row"><span class="history-date">📅 ${esc(o.date)}</span><span class="history-amount" style="color:var(--primary);">${money(o.total)} ETB</span></div>
          <div class="history-items">${esc(o.orderTitle || (o.items || []).map(i => `${i.name} × ${i.qty}`).join(', ') || '-')}</div>
          <div class="history-badge"><span style="color:var(--success); font-weight:600;">✅ Paid: ${money(o.paidAmount || 0)}</span>${unpaid > 0.01 ? ` | <span style="color:var(--danger); font-weight:600;">⚠️ Debt: ${money(unpaid)}</span>` : ''}</div>
        </div>
      `;
    }).join('');

  const bodyEl = document.getElementById('customerProfileBody');
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">👤</div>
        <div class="profile-name">${esc(name)}</div>
        <div class="profile-phone">📞 ${esc(custData.phone || '-')}</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="label">Orders</div><div class="value">${stats.orderCount}</div></div>
        <div class="profile-stat paid"><div class="label">Paid</div><div class="value">${money(stats.totalPaid)}</div></div>
        <div class="profile-stat debt"><div class="label">Debt</div><div class="value">${money(stats.totalDebt)}</div></div>
      </div>
      ${stats.totalDebt > 0.01 ? `
        <div class="payment-form">
          <h4>💰 Record Payment</h4>
          <label class="field-label" style="margin-top:0;">Amount (ETB) *</label>
          <input type="number" id="paymentAmount" placeholder="0.00" step="any" max="${stats.totalDebt}">
          <label class="field-label">Date</label>
          <input type="date" id="paymentDate" value="${todayStr()}">
          <button class="btn btn-success" onclick="window.recordPayment('${escJs(name)}')" style="margin-top:12px;">💾 Record Payment</button>
        </div>
      ` : ''}
      <div class="history-section"><h4>📅 Appointments (${stats.apptCount})</h4>${apptsHtml}</div>
      <div class="history-section" style="margin-top:16px;"><h4>📦 Orders (${stats.orderCount})</h4>${ordersHtml}</div>
    `;
  }
  document.getElementById(PROFILE_MODAL_ID)?.classList.add('open');
}

function closeCustomerProfile() {
  document.getElementById(PROFILE_MODAL_ID)?.classList.remove('open');
  currentCustomerName = null;
}

function recordPayment(name) {
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  const stats = getCustomerStats(name);
  if (amount > stats.totalDebt) return showToast('ከዕዳ መጠን መብለጥ አይችልም', 'error');

  (async () => {
    try {
      let remaining = amount;
      const unpaidOrders = [...stats.orders].filter(o => (o.unpaidAmount || 0) > 0.01).sort((a, b) => new Date(a.date) - new Date(b.date));
      for (const order of unpaidOrders) {
        if (remaining <= 0) break;
        const toPay = Math.min(remaining, order.unpaidAmount);
        await updateDoc(doc(db, 'sales', order.id), {
          paidAmount: (order.paidAmount || 0) + toPay,
          unpaidAmount: Math.max(0, order.unpaidAmount - toPay)
        });
        remaining -= toPay;
      }
      await addDoc(collection(db, 'payments'), {
        tenantId: state.tenantId,
        customer: name,
        amount,
        date,
        createdAt: serverTimestamp()
      });
      showToast(`✅ ${money(amount)} ETB ተከፍሏል`);
      closeCustomerProfile();
      setTimeout(() => showCustomerProfile(name), 250);
    } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
  })();
}

// ═══════════════════════════════════════════
// 💸 EXPENSES
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

  el.innerHTML = paginated.map(e => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); gap:12px;">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:13px; color:var(--text-main);">${esc(e.category)}</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">📅 ${esc(e.date)}${e.note ? ' • 📝 ' + esc(e.note) : ''}${e.branch && state.plan === 'pro' ? ` • 🏢 ${esc(e.branch)}` : ''}</div>
      </div>
      <div style="font-weight:800; font-size:14px; color:var(--danger); white-space:nowrap;">${money(e.amount)} ETB</div>
      <button onclick="window.deleteExpense('${e.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
    </div>
  `).join('');

  renderPagination('expensesPagination', filtered.length, expensesPage, expensesPerPage, (p) => { expensesPage = p; renderExpenses(); }, (pp) => { expensesPerPage = pp; expensesPage = 1; renderExpenses(); });
}

// ═══════════════════════════════════════════
// 📊 REPORTS & SETTINGS
// ═══════════════════════════════════════════
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
  let prefix = todayStr();
  let label = 'Daily';
  if (reportType === 'daily') { prefix = document.getElementById('reportDate').value || todayStr(); label = `Daily (${prefix})`; }
  else if (reportType === 'monthly') { prefix = document.getElementById('reportMonth').value || thisMonthStr(); label = `Monthly (${prefix})`; }
  else { prefix = document.getElementById('reportYear').value || thisYearStr(); label = `Yearly (${prefix})`; }

  const branchFilter = state.plan === 'pro' ? (document.getElementById('reportBranch')?.value || 'all') : 'all';
  let periodOrders = allOrders.filter(o => (o.date || '').startsWith(prefix));
  let periodPayments = allPayments.filter(p => (p.date || '').startsWith(prefix));
  let periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  if (branchFilter !== 'all') {
    periodOrders = periodOrders.filter(o => o.branch === branchFilter);
    periodExpenses = periodExpenses.filter(e => e.branch === branchFilter);
  }

  const orderPaid = periodOrders.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const extraPaid = branchFilter === 'all' ? periodPayments.reduce((s, p) => s + (p.amount || 0), 0) : 0;
  const revenue = orderPaid + extraPaid;
  const expenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const unpaid = periodOrders.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const profit = revenue - expenses;
  const cashTotal = periodOrders.filter(o => (o.paymentType || 'cash') === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferTotal = periodOrders.filter(o => o.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);

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

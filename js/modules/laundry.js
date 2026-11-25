// js/modules/laundry.js
import { db } from '../firebase.js';
import { 
  collection, addDoc, query, where, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast, state } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 GLOBAL STATE (የላውንድሪ ዳታ)
// ═══════════════════════════════════════════
let allServices = [];
let allSales = [];
let allExpenses = [];
let allCustomers = [];
let allBranches = [];
let cart = [];
let editingServiceId = null;
let editingCustomerName = null;
let currentCustomerName = null;

// Pagination & Filters
let servicePage = 1, ordersPage = 1, customersPage = 1, expensesPage = 1;
const PER_PAGE_OPTIONS = [10, 25, 50];
let servicePerPage = 10, ordersPerPage = 10, customersPerPage = 10, expensesPerPage = 10;
let orderDateFilter = 'recent';
let orderStatusFilter = 'all';
let expenseDateFilter = 'recent';
let reportType = 'daily';

let unsubServices = null, unsubSales = null, unsubExpenses = null, unsubCustomers = null, unsubBranches = null;

// ═══════════════════════════════════════════
// 📦 MODULE DEFINITION
// ═══════════════════════════════════════════
export const LaundryModule = {
  icon: '🧺',
  name: 'Laundry',
  themeColor: '#3b82f6', // Laundry Blue

  navItems: [
    { id: 'laundry-dashboard', label: 'Home',       icon: '🏠', default: true },
    { id: 'laundry-price',     label: 'Price List', icon: '🏷️' },
    { id: 'laundry-new',       label: 'New Order',  icon: '🧺' },
    { id: 'laundry-orders',    label: 'Orders',     icon: '📜' },
    { id: 'laundry-customers', label: 'Customers',  icon: '👥' },
    { id: 'laundry-expenses',  label: 'Expenses',   icon: '💸' },
    { id: 'laundry-reports',   label: 'Reports',    icon: '📊' },
    { id: 'laundry-settings',  label: 'Settings',   icon: '⚙️' }
  ],

  panels: [
    // 1. DASHBOARD
    { id: 'laundry-dashboard', html: `
      <div class="card">
        <div class="card-title"><span>📅 Today's Summary</span></div>
        <div id="laundryTodaySummary" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;"></div>
      </div>
      <div class="card">
        <div class="card-title"><span>⚡ Quick Actions</span></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" style="width:auto; padding:10px 20px;" onclick="switchPage('laundry-new', null)">🧺 New Order</button>
          <button class="btn btn-outline" style="width:auto; padding:10px 20px;" onclick="switchPage('laundry-orders', null)">📜 Orders</button>
          <button class="btn btn-outline" style="width:auto; padding:10px 20px;" onclick="switchPage('laundry-customers', null)">👥 Customers</button>
        </div>
      </div>
    `},

    // 2. PRICE LIST
    { id: 'laundry-price', html: `
      <div class="card">
        <div class="card-title">
          <span>🏷️ Price List</span>
          <button class="btn btn-primary btn-sm" onclick="window.__laundryOpenServiceModal()">➕ Add Service</button>
        </div>
        <div class="filter-bar">
          <input type="text" id="searchService" placeholder="🔍 Search service..." oninput="servicePage=1; window.__laundryRenderServices()">
        </div>
        <div id="serviceListContainer"></div>
        <div class="pagination-controls" id="servicePagination"></div>
      </div>
    `},

    // 3. NEW ORDER (POS)
    { id: 'laundry-new', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;">
              <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
              <select id="orderBranch" style="margin-bottom:8px;"></select>
            </div>
            <label class="field-label" style="margin-top:0;">👤 Customer *</label>
            <input type="text" id="orderCustomer" placeholder="Customer name" list="customerList" style="margin-bottom:8px;">
            <datalist id="customerList"></datalist>
            <label class="field-label">📞 Phone</label>
            <input type="text" id="orderPhone" placeholder="+251..." style="margin-bottom:8px;">
            <label class="field-label">📅 Pickup Date *</label>
            <input type="date" id="orderPickup" style="margin-bottom:8px;">
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
            <input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.__laundryUpdateUnpaid()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.__laundryCompleteOrder()">💸 Complete Order</button>
            <button class="btn btn-outline" onclick="window.__laundryClearCart()">🗑️ Clear</button>
          </div>
        </div>
        <div class="pos-products">
          <div class="pos-products-header">
            <input type="text" id="searchProduct" placeholder="🔍 Search service..." oninput="window.__laundryRenderPOS()" style="padding:12px 16px;">
          </div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},

    // 4. ORDERS
    { id: 'laundry-orders', html: `
      <div class="card">
        <div class="card-title"><span>📜 Orders</span></div>
        <div class="filter-bar">
          <input type="text" id="searchOrders" placeholder="🔍 Search customer..." oninput="ordersPage=1; window.__laundryRenderOrders()">
          <select id="orderBranchFilter" onchange="window.__laundryRenderOrders()" style="display:none; width:auto;">
            <option value="all">📊 All Branches</option>
          </select>
        </div>
        <div class="date-filter-chips" id="orderDateChips">
          <button class="date-chip active" onclick="window.__laundrySetOrderDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.__laundrySetOrderDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.__laundrySetOrderDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.__laundrySetOrderDateFilter('all', this)">All</button>
        </div>
        <div id="orderDatePicker" style="display:none; margin-bottom:12px;">
          <input type="date" id="orderFilterDate" onchange="ordersPage=1; window.__laundryRenderOrders()">
          <input type="month" id="orderFilterMonth" onchange="ordersPage=1; window.__laundryRenderOrders()" style="display:none;">
        </div>
        <div class="status-tabs">
          <button class="status-tab active" onclick="window.__laundrySetOrderStatusFilter('all', this)">All</button>
          <button class="status-tab" onclick="window.__laundrySetOrderStatusFilter('processing', this)">🟡 Processing</button>
          <button class="status-tab" onclick="window.__laundrySetOrderStatusFilter('delivered', this)">🟢 Delivered</button>
        </div>
        <div id="ordersList"></div>
        <div class="pagination-controls" id="ordersPagination"></div>
      </div>
    `},

    // 5. CUSTOMERS
    { id: 'laundry-customers', html: `
      <div class="card">
        <div class="card-title"><span>👥 Customers</span></div>
        <div class="filter-bar">
          <input type="text" id="searchCustomers" placeholder="🔍 Search customer..." oninput="customersPage=1; window.__laundryRenderCustomers()">
          <select id="customerBranchFilter" onchange="window.__laundryRenderCustomers()" style="display:none; width:auto;">
            <option value="all">📊 All Branches</option>
          </select>
        </div>
        <div id="customersListContainer"></div>
        <div class="pagination-controls" id="customersPagination"></div>
      </div>
    `},

    // 6. EXPENSES
    { id: 'laundry-expenses', html: `
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
            <option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water">
            <option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport">
            <option value="📱 Phone"><option value="🔧 Maintenance"><option value="🧴 Detergent">
          </datalist>
          <label class="field-label">💰 Amount (ETB) *</label>
          <input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label>
          <input type="date" id="expDate">
          <label class="field-label">📝 Note</label>
          <input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.__laundryAddExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div class="filter-bar">
          <input type="text" id="searchExpense" placeholder="🔍 Search..." oninput="expensesPage=1; window.__laundryRenderExpenses()">
        </div>
        <div class="date-filter-chips">
          <button class="date-chip active" onclick="window.__laundrySetExpenseDateFilter('recent', this)">Recent</button>
          <button class="date-chip" onclick="window.__laundrySetExpenseDateFilter('date', this)">Date</button>
          <button class="date-chip" onclick="window.__laundrySetExpenseDateFilter('month', this)">Month</button>
          <button class="date-chip" onclick="window.__laundrySetExpenseDateFilter('all', this)">All</button>
        </div>
        <div id="expenseDatePicker" style="display:none; margin-bottom:12px;">
          <input type="date" id="expenseFilterDate" onchange="window.__laundryRenderExpenses()">
          <input type="month" id="expenseFilterMonth" onchange="window.__laundryRenderExpenses()" style="display:none;">
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

    // 7. REPORTS
    { id: 'laundry-reports', html: `
      <div class="card">
        <div class="card-title"><span>📊 Reports</span></div>
        <div class="report-type-tabs">
          <button class="report-type-tab active" onclick="window.__laundrySetReportType('daily', this)">📅 Daily</button>
          <button class="report-type-tab" onclick="window.__laundrySetReportType('monthly', this)">📆 Monthly</button>
          <button class="report-type-tab" onclick="window.__laundrySetReportType('yearly', this)">📊 Yearly</button>
        </div>
        <div id="reportHeader" style="text-align:center; font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Daily</div>
        <div id="reportDateContainer" style="margin-bottom:16px;">
          <input type="date" id="reportDate" onchange="window.__laundryRenderReports()">
          <input type="month" id="reportMonth" onchange="window.__laundryRenderReports()" style="display:none;">
          <input type="number" id="reportYear" placeholder="2026" min="2000" max="2100" onchange="window.__laundryRenderReports()" style="display:none;">
        </div>
        <div id="reportBranchSection" style="display:none; margin-bottom:16px;">
          <label class="field-label" style="margin-top:0;">🏢 Branch Filter</label>
          <select id="reportBranch" onchange="window.__laundryRenderReports()">
            <option value="all">📊 All Branches</option>
          </select>
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
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="btn btn-outline" onclick="window.__laundryExportCSV()" style="margin-top:0;">📥 CSV</button>
          <button class="btn btn-outline" onclick="window.__laundryPrintReport()" style="margin-top:0;">🖨️ Print</button>
        </div>
      </div>
    `},

    // 8. SETTINGS
    { id: 'laundry-settings', html: `
      <div class="card">
        <div class="card-title"><span>⚙️ Settings</span></div>
        <label class="field-label" style="margin-top:0;">🏢 Business Name</label>
        <input type="text" id="settingBizName" placeholder="Business name" disabled>
        <div style="margin-top:16px;">
          <button class="btn btn-outline" onclick="window.__laundryToggleDark()" style="margin-top:0;">🎨 Change Theme Mode</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span>🚪 Account</span></div>
        <button class="btn btn-danger" onclick="logout()">Sign Out</button>
      </div>
    `}
  ],

  async init(st) {
    // Set default dates
    document.getElementById('orderPickup').value = todayStr();
    document.getElementById('expDate').value = todayStr();
    document.getElementById('reportDate').value = todayStr();
    document.getElementById('reportMonth').value = thisMonthStr();
    document.getElementById('reportYear').value = thisYearStr();
    document.getElementById('orderFilterDate').value = todayStr();
    document.getElementById('orderFilterMonth').value = thisMonthStr();
    document.getElementById('expenseFilterDate').value = todayStr();
    document.getElementById('expenseFilterMonth').value = thisMonthStr();
    document.getElementById('settingBizName').value = st.tenantData.name || '';

    // Load data
    unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', st.tenantId)), snap => {
      allBranches = []; snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
      window.__laundryUpdateBranchDropdowns();
    });

    unsubServices = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', st.tenantId)), snap => {
      allServices = []; snap.forEach(d => allServices.push({ id: d.id, ...d.data() }));
      window.__laundryRenderServices();
      window.__laundryRenderPOS();
      window.__laundryUpdateCategories();
    });

    unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', st.tenantId)), snap => {
      allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
      window.__laundryRenderOrders();
      window.__laundryRenderCustomers();
      window.__laundryRenderReports();
      window.__laundryUpdateMobileHome();
      window.__laundryUpdateCustomerDatalist();
    });

    unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', st.tenantId)), snap => {
      allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
      window.__laundryRenderExpenses();
      window.__laundryRenderReports();
      window.__laundryUpdateMobileHome();
    });

    unsubCustomers = onSnapshot(query(collection(db, 'customers'), where('tenantId', '==', st.tenantId)), snap => {
      allCustomers = []; snap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));
      window.__laundryRenderCustomers();
      window.__laundryUpdateCustomerDatalist();
    });
  },

  cleanup() {
    if (unsubServices) unsubServices();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    if (unsubCustomers) unsubCustomers();
    if (unsubBranches) unsubBranches();
  },

  onPageChange(panelId) {
    if (panelId === 'laundry-dashboard') window.__laundryRenderDashboard();
    if (panelId === 'laundry-new') window.__laundryRenderPOS();
    if (panelId === 'laundry-orders') window.__laundryRenderOrders();
    if (panelId === 'laundry-customers') window.__laundryRenderCustomers();
    if (panelId === 'laundry-reports') window.__laundryRenderReports();
  }
};

// ═══════════════════════════════════════════
// 🛠️ IMPLEMENTATION FUNCTIONS (ከኮዱ የተዘዋወሩ)
// ═══════════════════════════════════════════
// *(ማሳሰቢያ፡ እዚህ ላይ ከላይ ያለው ኮድ ውስጥ የነበሩት ሁሉም `render...`, `add...`, `save...` ተግባራት ወደ `window.__laundry...` ተቀይረው ይገባሉ)*

// ለምሳሌ፡
window.__laundryRenderDashboard = function() {
  const host = document.getElementById('laundryTodaySummary');
  if (!host) return;
  const today = todayStr();
  const todaySales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const profit = todaySales - todayExpenses;
  host.innerHTML = `
    <div class="summary-box green" style="margin-bottom:0;"><div class="label">Sales</div><div class="value">${money(todaySales)}</div></div>
    <div class="summary-box red" style="margin-bottom:0;"><div class="label">Expenses</div><div class="value">${money(todayExpenses)}</div></div>
    <div class="summary-box blue" style="margin-bottom:0;"><div class="label">Profit</div><div class="value">${money(profit)}</div></div>
  `;
};

// ═══════════════════════════════════════════
// 🛠️ RENDER & LOGIC FUNCTIONS (ክፍል 2)
// ═══════════════════════════════════════════

// 1. DASHBOARD ማሳያ
window.__laundryRenderDashboard = function() {
  const host = document.getElementById('laundryTodaySummary');
  if (!host) return;
  const today = todayStr();
  const todaySales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const profit = todaySales - todayExpenses;
  host.innerHTML = `
    <div class="summary-box green" style="margin-bottom:0;"><div class="label">Sales</div><div class="value">${money(todaySales)}</div></div>
    <div class="summary-box red" style="margin-bottom:0;"><div class="label">Expenses</div><div class="value">${money(todayExpenses)}</div></div>
    <div class="summary-box blue" style="margin-bottom:0;"><div class="label">Profit</div><div class="value">${money(profit)}</div></div>
  `;
};

// 2. PRICE LIST (SERVICES) ማሳያ
let openCategories = new Set();
window.__laundryToggleCategory = function(catName) {
  if (openCategories.has(catName)) openCategories.delete(catName);
  else openCategories.add(catName);
  window.__laundryRenderServices();
};

window.__laundryRenderServices = function() {
  const container = document.getElementById('serviceListContainer');
  if (!container) return;
  
  const search = (document.getElementById('searchService')?.value || '').toLowerCase();
  let filtered = allServices;
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search));
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
      <div style="font-size:48px; margin-bottom:12px;">🏷️</div>
      <div style="font-weight:600;">ምንም አገልግሎት የለም</div>
    </div>`;
    return;
  }
  
  const grouped = {};
  filtered.forEach(s => {
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
        <div class="category-header" onclick="window.__laundryToggleCategory('${escJs(cat)}')">
          <div class="category-header-left">
            <span class="category-arrow">▶</span>
            <span class="category-name">📁 ${esc(cat)}</span>
            <span class="category-count">${items.length}</span>
          </div>
          <span class="category-total">${money(catTotal)} ETB</span>
        </div>
        <div class="category-body">
          ${items.map(s => `
            <div class="item-row">
              <div class="item-row-name">🏷️ ${esc(s.name)}</div>
              <div class="item-row-price">${money(s.price)} ETB</div>
              <div style="display:flex; gap:4px;">
                <button class="action-btn btn-edit" onclick="event.stopPropagation(); window.__laundryOpenServiceModal('${s.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.__laundryDeleteService('${s.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
};

window.__laundryOpenServiceModal = function(id = null) {
  editingServiceId = id;
  const modalContainer = document.getElementById('globalModalContainer');
  let s = { category: '', name: '', price: '' };
  
  if (id) {
    const existing = allServices.find(x => x.id === id);
    if (existing) s = existing;
  }
  
  modalContainer.innerHTML = `
    <div class="modal-overlay open" id="laundryServiceModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${id ? '✏️ Edit Service' : '➕ Add Service'}</h3>
          <button class="modal-close" onclick="document.getElementById('laundryServiceModal').remove()">×</button>
        </div>
        <div class="modal-body">
          <label class="field-label" style="margin-top:0;">📁 Category *</label>
          <input type="text" id="modalCat" value="${esc(s.category)}" placeholder="e.g. ሸሚዝ">
          <label class="field-label">🏷️ Service Name *</label>
          <input type="text" id="modalName" value="${esc(s.name)}" placeholder="e.g. ሸሚዝ ማጠብ">
          <label class="field-label">💰 Price (ETB) *</label>
          <input type="number" id="modalPrice" value="${s.price}" placeholder="50.00" step="any">
          <button class="btn btn-success" onclick="window.__laundrySaveService('${id || ''}')" style="margin-top:16px;">💾 Save</button>
        </div>
      </div>
    </div>
  `;
};

window.__laundrySaveService = async function(id) {
  const category = document.getElementById('modalCat').value.trim();
  const name = document.getElementById('modalName').value.trim();
  const price = parseFloat(document.getElementById('modalPrice').value);
  
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Service Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  
  try {
    if (id) {
      await updateDoc(doc(db, 'products', id), { category, name, price });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), { tenantId: state.tenantId, category, name, price, createdAt: serverTimestamp() });
      showToast('✅ ተጨምሯል');
    }
    document.getElementById('laundryServiceModal').remove();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.__laundryDeleteService = async function(id) {
  if (!confirm('ይህን አገልግሎት ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('✅ ተጠፍቷል'); } 
  catch (e) { showToast('❌ ስህተት', 'error'); }
};

// 3. POS (NEW ORDER) ተግባራት
window.__laundryRenderPOS = function() {
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
    <div class="product-card" onclick="window.__laundryAddToCart('${s.id}')">
      <div>
        <div class="p-name">${esc(s.name)}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${esc(s.category || '')}</div>
      </div>
      <div class="p-price">${money(s.price)} ETB</div>
    </div>
  `).join('');
};

window.__laundryAddToCart = function(id) {
  const s = allServices.find(x => x.id === id);
  if (!s) return;
  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name: s.name, price: s.price, qty: 1 });
  window.__laundryRenderCart();
};

window.__laundryUpdateQty = function(i, delta) {
  const item = cart[i];
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(i, 1); window.__laundryRenderCart(); return; }
  item.qty = newQty;
  window.__laundryRenderCart();
};

window.__laundryRemoveFromCart = function(i) { cart.splice(i, 1); window.__laundryRenderCart(); };
window.__laundryClearCart = function() { cart = []; window.__laundryRenderCart(); };

window.__laundryRenderCart = function() {
  const el = document.getElementById('cartList');
  if (!el) return;
  if (cart.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px 0;">🛒 Cart is empty</div>';
    document.getElementById('cartTotal').textContent = '0.00 ETB';
    window.__laundryUpdateUnpaid();
    return;
  }
  let total = 0;
  el.innerHTML = cart.map((c, i) => {
    total += c.price * c.qty;
    return `<div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${esc(c.name)}</div>
        <div class="ci-price">${money(c.price)} ETB</div>
      </div>
      <div class="ci-qty">
        <button onclick="window.__laundryUpdateQty(${i}, -1)">−</button>
        <span>${c.qty}</span>
        <button onclick="window.__laundryUpdateQty(${i}, 1)">+</button>
      </div>
      <div class="ci-total">${money(c.price * c.qty)}</div>
      <div class="ci-del" onclick="window.__laundryRemoveFromCart(${i})">✕</div>
    </div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = money(total) + ' ETB';
  window.__laundryUpdateUnpaid();
};

window.__laundryUpdateUnpaid = function() {
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  const paid = parseFloat(document.getElementById('orderPaid')?.value) || 0;
  const unpaid = Math.max(0, total - paid);
  const el = document.getElementById('unpaidDisplay');
  if (el) el.textContent = `📝 Unpaid: ${money(unpaid)} ETB`;
};

window.__laundryCompleteOrder = async function() {
  const customer = document.getElementById('orderCustomer').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const pickup = document.getElementById('orderPickup').value;
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  
  if (!customer) return showToast('የደንበኛ ስም ያስፈልጋል', 'error');
  if (!pickup) return showToast('Pickup Date ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');
  
  try {
    if (!allCustomers.find(c => c.name === customer)) {
      await setDoc(doc(db, 'customers', state.tenantId + '_' + customer), {
        name: customer, phone, tenantId: state.tenantId, createdAt: serverTimestamp()
      }, { merge: true });
    }
    
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    
    await addDoc(collection(db, 'sales'), {
      tenantId: state.tenantId,
      customer, customerPhone: phone,
      pickupDate: pickup,
      date: todayStr(),
      items, total,
      paidAmount: paid,
      unpaidAmount: total - paid,
      paymentType,
      status: 'processing',
      createdAt: serverTimestamp()
    });
    
    showToast('✅ Order ተመዝግቧል');
    cart = [];
    window.__laundryRenderCart();
    document.getElementById('orderCustomer').value = '';
    document.getElementById('orderPhone').value = '';
    document.getElementById('orderPaid').value = '';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

// 4. ORDERS (ትዕዛዞች) ማሳያ እና ማስተዳደሪያ
window.__laundrySetOrderDateFilter = function(filter, btn) {
  orderDateFilter = filter;
  document.querySelectorAll('#orderDateChips .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const picker = document.getElementById('orderDatePicker');
  const dateInput = document.getElementById('orderFilterDate');
  const monthInput = document.getElementById('orderFilterMonth');
  if (filter === 'date') { picker.style.display = 'block'; dateInput.style.display = 'block'; monthInput.style.display = 'none'; }
  else if (filter === 'month') { picker.style.display = 'block'; dateInput.style.display = 'none'; monthInput.style.display = 'block'; }
  else { picker.style.display = 'none'; }
  window.__laundryRenderOrders();
};

window.__laundrySetOrderStatusFilter = function(filter, btn) {
  orderStatusFilter = filter;
  document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  window.__laundryRenderOrders();
};

window.__laundryRenderOrders = function() {
  const el = document.getElementById('ordersList');
  if (!el) return;
  const search = (document.getElementById('searchOrders')?.value || '').toLowerCase();
  let filtered = [...allSales];
  
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
    return;
  }
  
  el.innerHTML = filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(o => {
    const statusBadge = o.status === 'delivered' 
      ? '<span class="status-badge status-delivered">🟢 Delivered</span>' 
      : '<span class="status-badge status-processing">🟡 Processing</span>';
    const itemsList = (o.items || []).map(i => `${esc(i.name)} × ${i.qty} = ${money(i.total)} ETB`).join('<br>');
    const unpaid = (o.unpaidAmount || 0);
    const statusAction = o.status === 'processing' 
      ? `<button class="status-btn status-btn-mark" onclick="window.__laundryMarkDelivered('${o.id}')">✅ Mark Delivered</button>`
      : `<button class="status-btn status-btn-undo" onclick="window.__laundryMarkProcessing('${o.id}')">↩️ Undo</button>`;
    
    return `<div class="order-card">
      <div class="order-card-header">
        <div>
          <div class="order-card-customer">👤 ${esc(o.customer || '-')}</div>
          <div class="order-card-phone">📞 ${esc(o.customerPhone || '-')}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          ${statusBadge}
          <div class="order-card-pickup">📅 ${esc(o.pickupDate || '-')}</div>
        </div>
      </div>
      <div class="order-card-items">${itemsList}</div>
      <div class="order-card-footer">
        <div>
          <span class="order-card-total">Total: ${money(o.total)} ETB</span>
          <div style="margin-top:4px;">
            <span class="order-card-paid">✅ Paid: ${money(o.paidAmount || 0)}</span>
            ${unpaid > 0.01 ? `<br><span class="order-card-unpaid">⚠️ Unpaid: ${money(unpaid)}</span>` : ''}
          </div>
        </div>
        ${statusAction}
      </div>
    </div>`;
  }).join('');
};

window.__laundryMarkDelivered = async function(id) {
  try { await updateDoc(doc(db, 'sales', id), { status: 'delivered', deliveredAt: serverTimestamp() }); showToast('✅ Delivered'); } 
  catch (e) { showToast('❌ ስህተት', 'error'); }
};
window.__laundryMarkProcessing = async function(id) {
  try { await updateDoc(doc(db, 'sales', id), { status: 'processing' }); showToast('↩️ ወደ Processing'); } 
  catch (e) { showToast('❌ ስህተት', 'error'); }
};

// 5. CUSTOMERS (ደንበኞች) ማሳያ እና ዕዳ መክፈል
function __laundryGetCustomerStats(name) {
  const sales = allSales.filter(s => s.customer === name);
  const totalPaid = sales.reduce((s, x) => s + (x.paidAmount || 0), 0);
  const totalDebt = sales.reduce((s, x) => s + (x.unpaidAmount || 0), 0);
  return { sales, totalPaid, totalDebt, orderCount: sales.length };
}

window.__laundryRenderCustomers = function() {
  const el = document.getElementById('customersListContainer');
  if (!el) return;
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();
  const map = {};
  allCustomers.forEach(c => { map[c.name] = { name: c.name, phone: c.phone || '' }; });
  allSales.forEach(s => { if (s.customer && !map[s.customer]) map[s.customer] = { name: s.customer, phone: s.customerPhone || '' }; });
  let list = Object.values(map);
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search));
  
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">👥 ምንም ደንበኛ የለም</div>';
    return;
  }
  
  list.sort((a, b) => __laundryGetCustomerStats(b.name).totalDebt - __laundryGetCustomerStats(a.name).totalDebt);
  
  el.innerHTML = list.map(c => {
    const stats = __laundryGetCustomerStats(c.name);
    return `<div class="customer-card" onclick="window.__laundryShowCustomerProfile('${escJs(c.name)}')">
      <div class="customer-row">
        <div class="customer-info">
          <div class="customer-name">👤 ${esc(c.name)}</div>
          <div class="customer-meta">📞 ${esc(c.phone || '-')} | 🧺 ${stats.orderCount} orders | 💰 ${money(stats.totalPaid)} paid</div>
        </div>
        ${stats.totalDebt > 0.01 ? `<div class="customer-debt-badge">⚠️ ${money(stats.totalDebt)}</div>` : '<div style="color:var(--success); font-size:20px;">✓</div>'}
      </div>
    </div>`;
  }).join('');
};

window.__laundryShowCustomerProfile = function(name) {
  currentCustomerName = name;
  const stats = __laundryGetCustomerStats(name);
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
    
  const modalContainer = document.getElementById('globalModalContainer');
  modalContainer.innerHTML = `
    <div class="modal-overlay open" id="customerProfileModal">
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h3>👤 Customer Profile</h3>
          <button class="modal-close" onclick="document.getElementById('customerProfileModal').remove()">×</button>
        </div>
        <div class="modal-body">
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
              <label class="field-label">Amount (ETB) *</label>
              <input type="number" id="paymentAmount" placeholder="0.00" step="any" max="${stats.totalDebt}">
              <label class="field-label">Date</label>
              <input type="date" id="paymentDate" value="${todayStr()}">
              <button class="btn btn-success" onclick="window.__laundryRecordPayment('${escJs(name)}')" style="margin-top:12px;">💾 Record Payment</button>
            </div>
          ` : ''}
          <div class="history-section">
            <h4>📜 Order History</h4>
            ${ordersHtml}
          </div>
        </div>
      </div>
    </div>
  `;
};

window.__laundryRecordPayment = async function(name) {
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const date = document.getElementById('paymentDate').value;
  
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  
  const stats = __laundryGetCustomerStats(name);
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
    
    showToast(`✅ ${money(amount)} ETB ተከፍሏል`);
    document.getElementById('customerProfileModal').remove();
    setTimeout(() => window.__laundryShowCustomerProfile(name), 300);
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

// 6. EXPENSES (ወጪዎች)
window.__laundryAddExpense = async function() {
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  
  try {
    await addDoc(collection(db, 'expenses'), {
      tenantId: state.tenantId, category, amount, date, note, createdAt: serverTimestamp()
    });
    document.getElementById('expCategory').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    showToast('✅ ወጪ ተመዝግቧል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.__laundrySetExpenseDateFilter = function(filter, btn) {
  expenseDateFilter = filter;
  document.querySelectorAll('.date-filter-chips .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const picker = document.getElementById('expenseDatePicker');
  picker.style.display = (filter === 'date' || filter === 'month') ? 'block' : 'none';
  document.getElementById('expenseFilterDate').style.display = filter === 'date' ? 'block' : 'none';
  document.getElementById('expenseFilterMonth').style.display = filter === 'month' ? 'block' : 'none';
  window.__laundryRenderExpenses();
};

window.__laundryRenderExpenses = function() {
  const el = document.getElementById('expenseList');
  if (!el) return;
  let filtered = [...allExpenses];
  if (expenseDateFilter === 'recent') filtered = filtered.filter(e => e.date === todayStr());
  else if (expenseDateFilter === 'date') {
    const d = document.getElementById('expenseFilterDate').value;
    if (d) filtered = filtered.filter(e => e.date === d);
  } else if (expenseDateFilter === 'month') {
    const m = document.getElementById('expenseFilterMonth').value;
    if (m) filtered = filtered.filter(e => (e.date || '').startsWith(m));
  }
  
  const total = filtered.reduce((s, e) => s + e.amount, 0);
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(total);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allExpenses.reduce((s, e) => s + e.amount, 0));
  
  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">💸 ምንም ወጪ የለም</div>';
    return;
  }
  
  el.innerHTML = filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);">
      <div><div style="font-weight:600; font-size:13px;">${esc(e.category)}</div><div style="font-size:11.5px; color:var(--text-muted);">📅 ${esc(e.date)} ${e.note ? '• '+esc(e.note) : ''}</div></div>
      <div style="font-weight:800; color:var(--danger);">${money(e.amount)} ETB</div>
    </div>
  `).join('');
};

// 7. REPORTS (ሪፖርቶች)
window.__laundrySetReportType = function(type, btn) {
  reportType = type;
  document.querySelectorAll('.report-type-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('reportDate').style.display = type === 'daily' ? 'block' : 'none';
  document.getElementById('reportMonth').style.display = type === 'monthly' ? 'block' : 'none';
  document.getElementById('reportYear').style.display = type === 'yearly' ? 'block' : 'none';
  window.__laundryRenderReports();
};

window.__laundryRenderReports = function() {
  if (!document.getElementById('repRevenue')) return;
  
  let prefix = '';
  if (reportType === 'daily') prefix = document.getElementById('reportDate').value || todayStr();
  else if (reportType === 'monthly') prefix = document.getElementById('reportMonth').value || thisMonthStr();
  else prefix = document.getElementById('reportYear').value || thisYearStr();
  
  const periodSales = allSales.filter(o => (o.date || '').startsWith(prefix));
  const periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  
  const revenue = periodSales.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = periodSales.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const profit = revenue - expenses;
  
  const cashTotal = periodSales.filter(o => (o.paymentType || 'cash') === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferTotal = periodSales.filter(o => o.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);
  
  document.getElementById('repRevenue').textContent = money(revenue);
  document.getElementById('repExpenses').textContent = money(expenses);
  document.getElementById('repProfit').textContent = money(profit);
  document.getElementById('repUnpaid').textContent = money(unpaid);
  document.getElementById('repCash').textContent = money(cashTotal);
  document.getElementById('repTransfer').textContent = money(transferTotal);
};

// 8. SETTINGS (ቅንብሮች)
window.__laundryToggleDark = function() {
  const isDark = !document.body.classList.contains('dark-mode');
  if (isDark) document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');
  updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: isDark }).catch(() => {});
};

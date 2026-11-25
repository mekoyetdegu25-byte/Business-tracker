// js/modules/restaurant.js
import { db } from '../firebase.js';
import { collection, addDoc, query, where, serverTimestamp, doc, updateDoc, getDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let allItems = [];
let allSales = [];
let allExpenses = [];
let cart = [];
let editingItemId = null;

let servicePage = 1;
let servicePerPage = 10;
let openCategories = new Set();
let expenseDateFilter = 'recent';
let reportType = 'daily';

let unsubBranches = null, unsubItems = null, unsubSales = null, unsubExpenses = null;

const MODAL_ID = 'itemModal';
const STYLE_ID = 'restaurantExtraStyle';

const ITEM_MODAL_HTML = `
<div class="modal-overlay" id="${MODAL_ID}">
  <div class="modal-content">
    <div class="modal-header"><h3 id="itemModalTitle">➕ Add Menu Item</h3><button class="modal-close" onclick="window.closeItemModal()">×</button></div>
    <div class="modal-body">
      <div id="itemBranchSection" style="display:none;">
        <label class="field-label" style="margin-top:0;">🏢 Branch *</label>
        <select id="itemBranch"></select>
      </div>
      <label class="field-label" style="margin-top:0;">📁 Category *</label>
      <input list="itemCategoryList" id="itemCategory" placeholder="e.g. ምሳ, መጠጥ">
      <datalist id="itemCategoryList"><option value="ቁርስ"><option value="ምሳ"><option value="እራት"><option value="መጠጥ"><option value="ኬክ"></datalist>
      <label class="field-label">🍽️ Item Name *</label>
      <input type="text" id="itemName" placeholder="e.g. ጥብስ">
      <label class="field-label">🏷️ Type/Variant (Optional)</label>
      <input type="text" id="itemVariant" placeholder="e.g. ለብለብ, የበሰለ, ጥሬ">
      <label class="field-label">💰 Price (ETB) *</label>
      <input type="number" id="itemPrice" placeholder="180.00" step="any">
      <button class="btn btn-success" onclick="window.saveItem()" id="saveItemBtn">💾 Save Item</button>
    </div>
  </div>
</div>`;

// ═══════════════════════════════════════════
// 🧩 MODULE DEFINITION
// ═══════════════════════════════════════════
export const RestaurantModule = {
  name: 'Restaurant',
  icon: '🍽️',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel2', label: 'Sales', icon: '🛒' },
    { id: 'panelQuickSale', label: 'Quick', icon: '⚡' },
    { id: 'panel1', label: 'Menu', icon: '🍽️' },
    { id: 'panel8', label: 'More', icon: '⚙️' },
    // ከዚህ በታች ያሉት በሞባይል የታችኛው ማውጫ ላይ አይታዩም (slice(0, 5))
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
        <div class="qa-card" onclick="switchPage('panel2', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">🛒</div><div class="qa-title">New Sale</div></div>
        <div class="qa-card" onclick="switchPage('panel1', null)"><div class="qa-icon" style="background:rgba(139,92,246,0.1); color:#8b5cf6;">🍽️</div><div class="qa-title">Menu</div></div>
        <div class="qa-card" onclick="switchPage('panelQuickSale', null)"><div class="qa-icon" style="background:rgba(245,158,11,0.1); color:var(--warning);">⚡</div><div class="qa-title">Quick Sale</div></div>
        <div class="qa-card" onclick="switchPage('panel4', null)"><div class="qa-icon" style="background:rgba(239,68,68,0.1); color:var(--danger);">💸</div><div class="qa-title">Expenses</div></div>
        <div class="qa-card" onclick="switchPage('panel6', null)"><div class="qa-icon" style="background:rgba(59,130,246,0.1); color:var(--info);">📊</div><div class="qa-title">Reports</div></div>
      </div>
    `},
    { id: 'panel1', html: `
      <div class="card">
        <div class="card-title"><span>🍽️ Menu</span><button class="btn btn-primary btn-sm" onclick="window.openItemModal()">➕ Add Menu Item</button></div>
        <div class="filter-bar"><input type="text" id="searchService" placeholder="🔍 Search menu..." oninput="window.restServiceSearch()"></div>
        <div id="serviceListContainer"></div>
        <div class="pagination-controls" id="servicePagination"></div>
      </div>
    `},
    { id: 'panel2', html: `
      <div class="pos-layout">
        <div class="pos-cart">
          <div class="pos-cart-header">
            <div id="posBranchSection" style="display:none; margin-bottom:12px;"><label class="field-label" style="margin-top:0;">🏢 Branch *</label><select id="saleBranch" style="margin-bottom:8px;"></select></div>
            <label class="field-label" style="margin-top:0;">📅 Date *</label><input type="date" id="saleDate" style="margin-bottom:8px;">
            <label class="field-label">💳 Payment Type</label><select id="salePaymentType" style="margin-bottom:8px;"><option value="cash">💵 Cash</option><option value="transfer">🏦 Transfer</option></select>
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
          <div class="pos-products-header"><input type="text" id="searchProduct" placeholder="🔍 Search menu..." oninput="window.renderPOSProducts()" style="padding:12px 16px;"></div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
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
            <input list="quickCatList" id="quickCategory" placeholder="e.g. ምሳ ሽያጭ">
            <datalist id="quickCatList"><option value="ምሳ ሽያጭ"><option value="መጠጥ ሽያጭ"><option value="እራት ሽያጭ"><option value="ሌላ ሽያጭ"></datalist>
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
          <datalist id="expenseCategoryList"><option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water"><option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport"><option value="🥩 Meat"><option value="🥬 Vegetables"></datalist>
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
    // Global functions (inline onclick እንዲያገኛቸው)
    window.renderServiceList = renderServiceList;
    window.renderPOSProducts = renderPOSProducts;
    window.addToCart = addToCart;
    window.updateCartQty = updateCartQty;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.updateUnpaidDisplay = updateUnpaidDisplay;
    window.completeSale = completeSale;
    window.openItemModal = openItemModal;
    window.closeItemModal = closeItemModal;
    window.saveItem = saveItem;
    window.deleteItem = deleteItem;
    window.toggleServiceCategory = toggleServiceCategory;
    window.addQuickSale = addQuickSale;
    window.addExpense = addExpense;
    window.setExpenseDateFilter = setExpenseDateFilter;
    window.renderExpenses = renderExpenses;
    window.deleteExpense = deleteExpense;
    window.setReportType = setReportType;
    window.renderReports = renderReports;
    window.saveSettings = saveSettings;
    window.addBranch = addBranch;
    window.deleteBranch = deleteBranch;
    window.toggleDarkMode = toggleDarkMode;
    window.restServiceSearch = () => { servicePage = 1; renderServiceList(); };
    window.restSetServicePage = (p) => { servicePage = p; renderServiceList(); };
    window.restSetServicePerPage = (n) => { servicePerPage = n || 10; servicePage = 1; renderServiceList(); };

    // Menu Item modal ወደ global container ማስገባት
    const modalHost = document.getElementById('globalModalContainer');
    if (modalHost && !document.getElementById(MODAL_ID)) modalHost.insertAdjacentHTML('beforeend', ITEM_MODAL_HTML);

    // Home ማውጫ በዴስክቶፕ ላይ ባዶ ገጽ ስለሚያሳይ መደበቅ
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = '@media (min-width: 769px) { .menu-header[data-tab="panelMobileHome"] { display: none; } }';
      document.head.appendChild(st);
    }

    // Default Dates
    const today = todayStr();
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('saleDate', today);
    setVal('expDate', today);
    setVal('quickDate', today);
    setVal('reportDate', today);
    setVal('reportMonth', thisMonthStr());
    setVal('reportYear', thisYearStr());
    setVal('expenseFilterDate', today);
    setVal('expenseFilterMonth', thisMonthStr());

    await loadAllData(appState);

    // በዴስክቶፕ ላይ ከ Home ይልቅ Menu እንዲከፈት (core የ default ገጹን ከ init በኋላ ያሳያል)
    setTimeout(() => { if (window.innerWidth > 768 && window.switchPage) window.switchPage('panel1', null); }, 0);
  },

  onPageChange: (panelId) => {
    if (panelId === 'panel1') renderServiceList();
    if (panelId === 'panel2') renderPOSProducts();
    if (panelId === 'panelQuickSale') setVal('quickDate', todayStr());
    if (panelId === 'panel4') renderExpenses();
    if (panelId === 'panel6') renderReports();
    if (panelId === 'panel8') loadSettings();
    if (panelId === 'panelMobileHome') updateMobileHome();
  },

  cleanup: () => {
    if (unsubBranches) unsubBranches();
    if (unsubItems) unsubItems();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    unsubBranches = unsubItems = unsubSales = unsubExpenses = null;

    document.getElementById(MODAL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();

    // ሁኔታውን ማጽዳት (ሌላ ተጠቃሚ ሲገባ የድሮ ዳታ እንዳይታይ)
    allBranches = []; allItems = []; allSales = []; allExpenses = []; cart = [];
    editingItemId = null; servicePage = 1; servicePerPage = 10;
    openCategories = new Set(); expenseDateFilter = 'recent'; reportType = 'daily';

    const fnNames = ['renderServiceList','renderPOSProducts','addToCart','updateCartQty','removeFromCart','clearCart','updateUnpaidDisplay','completeSale','openItemModal','closeItemModal','saveItem','deleteItem','toggleServiceCategory','addQuickSale','addExpense','setExpenseDateFilter','renderExpenses','deleteExpense','setReportType','renderReports','saveSettings','addBranch','deleteBranch','toggleDarkMode','restServiceSearch','restSetServicePage','restSetServicePerPage'];
    fnNames.forEach(fn => delete window[fn]);
  }
};

function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

// ═══════════════════════════════════════════
// 📥 DATA LOADING
// ═══════════════════════════════════════════
async function loadAllData(appState) {
  if (!appState.tenantId) return;

  unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', appState.tenantId)), snap => {
    allBranches = []; snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
    renderBranchSettings();
    updateBranchDropdowns();
  });
  unsubItems = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', appState.tenantId)), snap => {
    allItems = []; snap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
    renderServiceList(); renderPOSProducts();
  });
  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', appState.tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderReports(); updateMobileHome();
  });
  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', appState.tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses(); renderReports(); updateMobileHome();
  });
}

// ═══════════════════════════════════════════
// 🧠 HELPER FUNCTIONS
// ═══════════════════════════════════════════
function toggleDarkMode(isDark) {
  document.body.classList.toggle('dark-mode', !!isDark);
  if (state.tenantId) updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: !!isDark }).catch(() => {});
}

function updateMobileHome() {
  const today = todayStr();
  const todaySales = allSales.filter(s => s.date === today).reduce((s, o) => s + (o.paidAmount || 0), 0);
  const todayExpenses = allExpenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
  const todayProfit = todaySales - todayExpenses;
  const el1 = document.getElementById('mobTodaySales'); if (el1) el1.textContent = money(todaySales);
  const el2 = document.getElementById('mobTodayExpenses'); if (el2) el2.textContent = money(todayExpenses);
  const el3 = document.getElementById('mobTodayProfit'); if (el3) el3.textContent = money(todayProfit);
}

// ═══════════════════════════════════════════
// 🏢 BRANCHES (PRO ONLY)
// ═══════════════════════════════════════════
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
  ['posBranchSection', 'expBranchSection', 'itemBranchSection', 'quickBranchSection', 'reportBranchSection'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = hasBranches ? 'block' : 'none';
  });
  ['saleBranch', 'expBranch', 'itemBranch', 'quickBranch'].forEach(id => {
    const el = document.getElementById(id); if (el && hasBranches) el.innerHTML = options;
  });
  const repSel = document.getElementById('reportBranch');
  if (repSel && hasBranches) {
    const currentVal = repSel.value;
    repSel.innerHTML = '<option value="all">📊 All Branches</option>' + options;
    if (currentVal) repSel.value = currentVal;
  }
}

async function addBranch() {
  if (state.plan !== 'pro') return showToast('Pro plan ብቻ!', 'error');
  const name = document.getElementById('newBranchName').value.trim();
  if (!name) return showToast('የቅርንጫፍ ስም ያስፈልጋል', 'error');
  if (allBranches.find(b => b.name.toLowerCase() === name.toLowerCase())) return showToast('ይህ ቅርንጫፍ አስቀድሞ አለ', 'error');
  try {
    await addDoc(collection(db, 'branches'), { tenantId: state.tenantId, name, createdAt: serverTimestamp() });
    document.getElementById('newBranchName').value = '';
    showToast('ቅርንጫፍ ተጨምሯል');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function deleteBranch(id, name) {
  if (name === 'Main') return showToast('Main ማጥፋት አይቻልም', 'error');
  if (!confirm(`"${name}" ቅርንጫፍን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'branches', id)); showToast('ተጠፍቷል'); } catch (e) { showToast('ስህተት', 'error'); }
}

// ═══════════════════════════════════════════
// 🍽️ MENU ITEMS
// ═══════════════════════════════════════════
function openItemModal(id = null) {
  editingItemId = id;
  if (id) {
    const i = allItems.find(x => x.id === id);
    if (!i) return;
    document.getElementById('itemModalTitle').textContent = '✏️ Edit Menu Item';
    document.getElementById('itemCategory').value = i.category || '';
    document.getElementById('itemName').value = i.name || '';
    document.getElementById('itemVariant').value = i.variant || '';
    document.getElementById('itemPrice').value = i.price || '';
    if (state.plan === 'pro' && i.branch) document.getElementById('itemBranch').value = i.branch;
    document.getElementById('saveItemBtn').textContent = '💾 Update';
  } else {
    document.getElementById('itemModalTitle').textContent = '➕ Add Menu Item';
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemVariant').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('saveItemBtn').textContent = '💾 Save';
  }
  document.getElementById(MODAL_ID).classList.add('open');
}

function closeItemModal() {
  document.getElementById(MODAL_ID)?.classList.remove('open');
  editingItemId = null;
}

async function saveItem() {
  const category = document.getElementById('itemCategory').value.trim();
  const name = document.getElementById('itemName').value.trim();
  const variant = document.getElementById('itemVariant').value.trim();
  const price = parseFloat(document.getElementById('itemPrice').value);
  const branch = state.plan === 'pro' ? (document.getElementById('itemBranch').value || 'Main') : 'Main';
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Item Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  try {
    if (editingItemId) {
      await updateDoc(doc(db, 'products', editingItemId), { category, name, variant, price, branch });
      showToast('ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), { tenantId: state.tenantId, category, name, variant, price, branch, createdAt: serverTimestamp() });
      showToast('ተጨምሯል');
    }
    closeItemModal();
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

async function deleteItem(id) {
  if (!confirm('ምግቡን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('ተጠፍቷል'); } catch (e) { showToast('ስህተት', 'error'); }
}

function toggleServiceCategory(catName) {
  const key = 'menu_' + catName;
  if (openCategories.has(key)) openCategories.delete(key); else openCategories.add(key);
  renderServiceList();
}

function renderServiceList() {
  const container = document.getElementById('serviceListContainer');
  if (!container) return;
  const search = (document.getElementById('searchService')?.value || '').toLowerCase();
  let filtered = allItems;
  if (search) filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(search) || (i.category || '').toLowerCase().includes(search) || (i.variant || '').toLowerCase().includes(search));

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><div style="font-size:48px; margin-bottom:12px;">🍽️</div><div style="font-weight:600;">ምንም ምግብ የለም</div></div>`;
    renderPagination('servicePagination', 0, 1, servicePerPage);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / servicePerPage));
  if (servicePage > totalPages) servicePage = totalPages;
  if (servicePage < 1) servicePage = 1;
  const start = (servicePage - 1) * servicePerPage;
  const paginated = filtered.slice(start, start + servicePerPage);

  const grouped = {};
  paginated.forEach(i => { const cat = i.category || 'Other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(i); });

  container.innerHTML = Object.keys(grouped).sort().map(cat => {
    const items = grouped[cat].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const isOpen = openCategories.has('menu_' + cat) || search.length > 0;
    return `<div class="category-collapsible ${isOpen ? 'open' : ''}"><div class="category-header" onclick="window.toggleServiceCategory('${escJs(cat)}')"><div class="category-header-left"><span class="category-arrow">▶</span><span class="category-name">📁 ${esc(cat)}</span><span class="category-count">${items.length}</span></div></div><div class="category-body">${items.map(i => `<div class="item-row"><div class="item-row-name">🍽️ ${esc(i.name)} ${i.variant ? `<span style="font-size:11px; color:var(--primary); background:rgba(26,54,93,0.1); padding:2px 6px; border-radius:4px; margin-left:4px;">${esc(i.variant)}</span>` : ''}</div><div class="item-row-price">${money(i.price)} ETB</div><div style="display:flex; gap:4px;"><button onclick="window.openItemModal('${i.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button><button onclick="window.deleteItem('${i.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button></div></div>`).join('')}</div></div>`;
  }).join('');

  renderPagination('servicePagination', filtered.length, servicePage, servicePerPage);
}

// ═══════════════════════════════════════════
// 🛒 POS (Menu ብቻ)
// ═══════════════════════════════════════════
function renderPOSProducts() {
  const listEl = document.getElementById('sellProductList');
  if (!listEl) return;
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  let filtered = [...allItems];
  if (search) filtered = filtered.filter(s => (s.name || '').toLowerCase().includes(search) || (s.category || '').toLowerCase().includes(search) || (s.variant || '').toLowerCase().includes(search));
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted);">ምንም ምግብ የለም</div>';
    return;
  }
  listEl.innerHTML = filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(s => `
    <div class="product-card" onclick="window.addToCart('${s.id}')">
      <div><div class="p-name">🍽️ ${esc(s.name)} ${s.variant ? `<span style="font-size:10px; background:var(--bg); padding:1px 4px; border-radius:4px; border:1px solid var(--border); color:var(--text-muted);">${esc(s.variant)}</span>` : ''}</div><div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${esc(s.category || '')}</div></div>
      <div class="p-price">${money(s.price)} ETB</div>
    </div>
  `).join('');
}

function addToCart(id) {
  const s = allItems.find(x => x.id === id);
  if (!s) return;
  const cartId = id + (s.variant ? '_' + s.variant : '');
  const existing = cart.find(c => c.cartId === cartId);
  if (existing) { existing.qty++; }
  else {
    const displayName = s.name + (s.variant ? ` (${s.variant})` : '');
    cart.push({ cartId, id, name: displayName, price: s.price, qty: 1 });
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
    return `<div class="cart-item"><div class="ci-info"><div class="ci-name">${esc(c.name)}</div><div class="ci-price">${money(c.price)} ETB</div></div><div class="ci-qty"><button onclick="window.updateCartQty(${i}, -1)">−</button><span>${c.qty}</span><button onclick="window.updateCartQty(${i}, 1)">+</button></div><div class="ci-total">${money(c.price * c.qty)}</div><div class="ci-del" onclick="window.removeFromCart(${i})">✕</div></div>`;
  }).join('');
  document.getElementById('cartTotal').textContent = money(total) + ' ETB';
  updateUnpaidDisplay();
}

function updateUnpaidDisplay() {
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  const paid = parseFloat(document.getElementById('salePaid')?.value) || 0;
  const unpaid = Math.max(0, total - paid);
  const el = document.getElementById('unpaidDisplay');
  if (el) el.textContent = `📝 Unpaid: ${money(unpaid)} ETB`;
}

async function completeSale() {
  const date = document.getElementById('saleDate').value;
  const paid = parseFloat(document.getElementById('salePaid').value) || 0;
  const paymentType = document.getElementById('salePaymentType').value;
  const branch = state.plan === 'pro' ? (document.getElementById('saleBranch').value || 'Main') : 'Main';
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');
  try {
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    await addDoc(collection(db, 'sales'), { tenantId: state.tenantId, date, items, total, paidAmount: paid, unpaidAmount: total - paid, paymentType, branch, createdAt: serverTimestamp() });
    showToast('Sale ተመዝግቧል');
    cart = []; renderCart();
    document.getElementById('salePaid').value = '';
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// ⚡ QUICK SALE
// ═══════════════════════════════════════════
async function addQuickSale() {
  const date = document.getElementById('quickDate').value;
  const category = document.getElementById('quickCategory').value.trim() || 'Quick Sale';
  const amount = parseFloat(document.getElementById('quickAmount').value);
  const branch = state.plan === 'pro' ? (document.getElementById('quickBranch').value || 'Main') : 'Main';
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው መጠን ያስፈልጋል', 'error');
  try {
    await addDoc(collection(db, 'sales'), { tenantId: state.tenantId, date, items: [{ name: category, qty: 1, price: amount, total: amount }], total: amount, paidAmount: amount, unpaidAmount: 0, paymentType: 'cash', branch, isQuickSale: true, createdAt: serverTimestamp() });
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickCategory').value = '';
    showToast('Quick Sale ተመዝግቧል');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
}

// ═══════════════════════════════════════════
// 💸 EXPENSES
// ═══════════════════════════════════════════
async function addExpense() {
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  const branch = state.plan === 'pro' ? (document.getElementById('expBranch').value || 'Main') : 'Main';
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  try {
    await addDoc(collection(db, 'expenses'), { tenantId: state.tenantId, category, amount, date, note, branch, createdAt: serverTimestamp() });
    document.getElementById('expCategory').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    document.getElementById('expDate').value = todayStr();
    showToast('ወጪ ተመዝግቧል');
  } catch (e) { showToast('ስህተት: ' + e.message, 'error'); }
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

async function deleteExpense(id) {
  if (!confirm('ወጪውን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'expenses', id)); showToast('ተጠፍቷል'); } catch (e) { showToast('ስህተት', 'error'); }
}

function renderExpenses() {
  const el = document.getElementById('expenseList'); if (!el) return;
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
  filtered.sort((a, b) => { if (a.date !== b.date) return (b.date || '').localeCompare(a.date || ''); return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0); });
  if (filtered.length === 0) { el.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">💸 ምንም ወጪ የለም</div>'; return; }
  el.innerHTML = filtered.map(e => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); gap:12px;">
      <div style="flex:1; min-width:0;"><div style="font-weight:600; font-size:13px; color:var(--text-main);">${esc(e.category)}</div><div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">📅 ${esc(e.date)}${e.note ? ' • 📝 ' + esc(e.note) : ''}${e.branch && state.plan === 'pro' ? ` • 🏢 ${esc(e.branch)}` : ''}</div></div>
      <div style="font-weight:800; font-size:14px; color:var(--danger); white-space:nowrap;">${money(e.amount)} ETB</div>
      <button onclick="window.deleteExpense('${e.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
// 📊 REPORTS
// ═══════════════════════════════════════════
function setReportType(type, btn) {
  reportType = type;
  document.querySelectorAll('#panel6 .report-type-tab').forEach(t => t.classList.remove('active'));
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
  const dateInput = document.getElementById('reportDate');
  const monthInput = document.getElementById('reportMonth');
  const yearInput = document.getElementById('reportYear');
  let prefix = todayStr(); let label = 'Daily';
  if (reportType === 'daily') { prefix = dateInput.value || todayStr(); label = `Daily (${prefix})`; }
  else if (reportType === 'monthly') { prefix = monthInput.value || thisMonthStr(); label = `Monthly (${prefix})`; }
  else { prefix = yearInput.value || thisYearStr(); label = `Yearly (${prefix})`; }

  const branchFilter = state.plan === 'pro' ? (document.getElementById('reportBranch')?.value || 'all') : 'all';
  let periodSales = allSales.filter(o => (o.date || '').startsWith(prefix));
  let periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  if (branchFilter !== 'all') {
    periodSales = periodSales.filter(o => o.branch === branchFilter);
    periodExpenses = periodExpenses.filter(e => e.branch === branchFilter);
  }

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
  document.getElementById('repCash').textContent = money(cashTotal) + ' ETB';
  document.getElementById('repTransfer').textContent = money(transferTotal) + ' ETB';
  document.getElementById('reportHeader').textContent = label;

  const topBody = document.getElementById('topSellingBody');
  if (topBody) {
    const stats = {};
    periodSales.forEach(s => { (s.items || []).forEach(i => { if (!stats[i.name]) stats[i.name] = { qty: 0, revenue: 0 }; stats[i.name].qty += i.qty; stats[i.name].revenue += i.total; }); });
    const top = Object.keys(stats).map(k => ({ name: k, ...stats[k] })).sort((a, b) => b.qty - a.qty).slice(0, 10);
    topBody.innerHTML = top.length === 0
      ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">ምንም ዳታ የለም</td></tr>'
      : top.map((x, i) => `<tr><td style="padding:10px; border-bottom:1px solid var(--border);">${i + 1}</td><td style="padding:10px; border-bottom:1px solid var(--border);">${esc(x.name)}</td><td style="padding:10px; border-bottom:1px solid var(--border); color:var(--primary); font-weight:700;">${x.qty}</td><td style="padding:10px; border-bottom:1px solid var(--border); color:var(--success); font-weight:700;">${money(x.revenue)} ETB</td></tr>`).join('');
  }
}

// ═══════════════════════════════════════════
// ⚙️ SETTINGS
// ═══════════════════════════════════════════
async function saveSettings() {
  const name = document.getElementById('settingBizName').value.trim();
  const phone = document.getElementById('settingBizPhone').value.trim();
  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), { name, phone });
    document.getElementById('hdrBusinessName').textContent = name;
    showToast('ተቀምጧል');
  } catch (e) { showToast('ስህተት', 'error'); }
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'tenants', state.tenantId));
    if (snap.exists()) {
      const d = snap.data();
      setVal('settingBizName', d.name || '');
      setVal('settingBizPhone', d.phone || '');
    }
  } catch (e) { console.warn(e); }
}

// ═══════════════════════════════════════════
// 🔢 PAGINATION
// ═══════════════════════════════════════════
function renderPagination(containerId, totalItems, currentPage, perPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const btn = 'padding:4px 10px; font-size:12px; border-radius:6px; border:1px solid var(--border); background:var(--card-bg); color:var(--text-main); cursor:pointer;';
  el.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
    <span style="font-size:12px; color:var(--text-muted);">Show</span>
    <select onchange="window.restSetServicePerPage(parseInt(this.value))" style="width:auto; padding:4px 8px; font-size:12px; border-radius:6px;">${[10, 25, 50].map(n => `<option value="${n}" ${n === perPage ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <span style="font-size:12px; color:var(--text-muted);">| ${totalItems} total | Page ${currentPage} of ${totalPages}</span>
    <button onclick="window.restSetServicePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} style="${btn}">← Prev</button>
    <button onclick="window.restSetServicePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} style="${btn}">Next →</button>
  </div>`;
}

// js/modules/bakery.js
import { db } from '../firebase.js';
import { 
  collection, getDocs, query, where, addDoc, updateDoc, doc, 
  deleteDoc, onSnapshot, serverTimestamp, increment 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { esc, escJs, money, todayStr, thisMonthStr, thisYearStr, showToast, state } from '../core.js';

// ═══════════════════════════════════════════
// 🌐 GLOBAL STATE (የባክሪ ዳታ)
// ═══════════════════════════════════════════
let allProducts = [];
let allSales = [];
let allExpenses = [];
let cart = [];
let editingProductId = null;
let unsubProducts = null, unsubSales = null, unsubExpenses = null;

// ═══════════════════════════════════════════
// 📦 MODULE DEFINITION
// ═══════════════════════════════════════════
export const BakeryModule = {
  icon: '🍞',
  name: 'Bakery',
  themeColor: '#f59e0b',

  navItems: [
    { id: 'bakery-dashboard', label: 'Home',       icon: '🏠', default: true },
    { id: 'bakery-pos',       label: 'New Sale',   icon: '🛒' },
    { id: 'bakery-items',     label: 'Items',      icon: '🍞' },
    { id: 'bakery-expenses',  label: 'Expenses',   icon: '💸' },
    { id: 'bakery-reports',   label: 'Reports',    icon: '📊' },
    { id: 'bakery-settings',  label: 'Settings',   icon: '⚙️' },
  ],

  panels: [
    // ─── 1. DASHBOARD (Home) ───
    { id: 'bakery-dashboard', html: `
      <div class="card">
        <div class="card-title"><span>📅 Today's Summary</span></div>
        <div id="bakeryTodaySummary" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;"></div>
      </div>
      <div class="card">
        <div class="card-title"><span>⚡ Quick Actions</span></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" style="width:auto; padding:10px 20px;" onclick="switchPage('bakery-pos', null)">🛒 New Sale</button>
          <button class="btn btn-outline" style="width:auto; padding:10px 20px;" onclick="switchPage('bakery-items', null)">🍞 Items</button>
        </div>
      </div>
    `},

    // ─── 2. POS (New Sale) ───
    { id: 'bakery-pos', html: `
      <div class="pos-layout">
        <!-- CART -->
        <div class="pos-cart">
          <div class="pos-cart-header">
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
            <input type="number" id="orderPaid" placeholder="0.00" step="any" oninput="window.__bakeryUpdateUnpaid()" style="margin-bottom:12px;">
            <div style="font-size:13px; color:var(--danger); font-weight:600; margin-bottom:12px;" id="unpaidDisplay">📝 Unpaid: 0.00 ETB</div>
            <button class="btn btn-success" onclick="window.__bakeryCompleteOrder()">💸 Complete Sale</button>
            <button class="btn btn-outline" onclick="window.__bakeryClearCart()">🗑️ Clear</button>
          </div>
        </div>
        
        <!-- PRODUCTS -->
        <div class="pos-products">
          <div class="pos-products-header">
            <input type="text" id="searchProduct" placeholder="🔍 Search item..." oninput="window.__bakeryRenderPOS()" style="padding:12px 16px;">
          </div>
          <div class="pos-products-grid" id="sellProductList"></div>
        </div>
      </div>
    `},

    // ─── 3. ITEMS ───
    { id: 'bakery-items', html: `
      <div class="card">
        <div class="card-title">
          <span>🍞 Bakery Items</span>
          <button class="btn btn-primary btn-sm" onclick="window.__bakeryOpenItemModal()">➕ Add Item</button>
        </div>
        <div class="filter-bar">
          <input type="text" id="searchService" placeholder="🔍 Search item..." oninput="window.__bakeryRenderItems()">
        </div>
        <div id="bakeryItemsList"></div>
        
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
      </div>
    `},

    // ─── 4. EXPENSES ───
    { id: 'bakery-expenses', html: `
      <div class="card">
        <div class="card-title"><span>💸 Expenses</span></div>
        <div style="background:var(--bg); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--border);">
          <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">➕ Add Expense</h4>
          <label class="field-label" style="margin-top:0;">📁 Category *</label>
          <input list="expenseCategoryList" id="expCategory" placeholder="e.g. 🏠 Rent">
          <datalist id="expenseCategoryList">
            <option value="🏠 Rent"><option value="⚡ Electricity"><option value="💧 Water">
            <option value="🌐 Internet"><option value="👥 Salary"><option value="🚚 Transport"><option value="🌾 Flour">
          </datalist>
          <label class="field-label">💰 Amount (ETB) *</label>
          <input type="number" id="expAmount" placeholder="0.00" step="any">
          <label class="field-label">📅 Date *</label>
          <input type="date" id="expDate">
          <label class="field-label">📝 Note</label>
          <input type="text" id="expNote" placeholder="Additional details...">
          <button class="btn btn-danger" onclick="window.__bakeryAddExpense()" style="margin-top:16px;">💾 Save Expense</button>
        </div>
        <h4 style="font-size:14px; font-weight:700; margin-bottom:12px;">📋 Recent Expenses</h4>
        <div id="bakeryExpensesList"></div>
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

    // ─── 5. REPORTS ───
    { id: 'bakery-reports', html: `
      <div class="card">
        <div class="card-title"><span>📊 Reports</span></div>
        <div class="report-type-tabs">
          <button class="report-type-tab active" onclick="window.__bakerySetReportType('daily', this)">📅 Daily</button>
          <button class="report-type-tab" onclick="window.__bakerySetReportType('monthly', this)">📆 Monthly</button>
          <button class="report-type-tab" onclick="window.__bakerySetReportType('yearly', this)">📊 Yearly</button>
        </div>
        <div id="bakeryReportDateContainer" style="margin-bottom:16px;">
          <input type="date" id="reportDate" onchange="window.__bakeryRenderReports()">
          <input type="month" id="reportMonth" onchange="window.__bakeryRenderReports()" style="display:none;">
          <input type="number" id="reportYear" placeholder="2026" min="2000" max="2100" onchange="window.__bakeryRenderReports()" style="display:none;">
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
      </div>
    `},

    // ─── 6. SETTINGS ───
    { id: 'bakery-settings', html: `
      <div class="card">
        <div class="card-title"><span>⚙️ Settings</span></div>
        <label class="field-label" style="margin-top:0;">🏢 Business Name</label>
        <input type="text" id="settingBizName" placeholder="Business name" disabled>
        <div style="margin-top:16px;">
          <button class="btn btn-outline" onclick="window.__bakeryToggleDark()" style="margin-top:0;">🎨 Change Theme Mode</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><span>🚪 Account</span></div>
        <button class="btn btn-danger" onclick="logout()">Sign Out</button>
      </div>
    `}
  ],

  // ─── INITIALIZATION ───
  async init(st) {
    // Default dates
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('expDate').value = todayStr();
    document.getElementById('reportDate').value = todayStr();
    document.getElementById('reportMonth').value = thisMonthStr();
    document.getElementById('reportYear').value = thisYearStr();
    document.getElementById('settingBizName').value = st.tenantData.name || '';

    // Data Snapshot (ሪል ታይም ዳታ)
    unsubProducts = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', st.tenantId)), snap => {
      allProducts = []; snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
      window.__bakeryRenderItems();
      window.__bakeryRenderPOS();
    });

    unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', st.tenantId)), snap => {
      allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
      window.__bakeryRenderDashboard();
      window.__bakeryRenderReports();
    });

    unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', st.tenantId)), snap => {
      allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
      window.__bakeryRenderExpenses();
      window.__bakeryRenderDashboard();
    });
  },

  cleanup() {
    if (unsubProducts) unsubProducts();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
  },

  onPageChange(panelId) {
    if (panelId === 'bakery-dashboard') window.__bakeryRenderDashboard();
    if (panelId === 'bakery-pos') window.__bakeryRenderPOS();
    if (panelId === 'bakery-reports') window.__bakeryRenderReports();
  }
};

// ═══════════════════════════════════════════
// 📊 RENDER DASHBOARD
// ═══════════════════════════════════════════
window.__bakeryRenderDashboard = function() {
  const host = document.getElementById('bakeryTodaySummary');
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

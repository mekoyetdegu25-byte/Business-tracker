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

// ═══════════════════════════════════════════
// 🛒 POS LOGIC (ሽያጭ ማድረጊያ)
// ═══════════════════════════════════════════
window.__bakeryRenderPOS = function() {
  const grid = document.getElementById('sellProductList');
  if (!grid) return;
  
  const search = (document.getElementById('searchProduct')?.value || '').toLowerCase();
  const filtered = allProducts.filter(p => (p.name || '').toLowerCase().includes(search));
  
  if (filtered.length === 0) {
    grid.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">ምንም ዕቃ አልተገኘም</div>';
    return;
  }
  
  grid.innerHTML = filtered.map(p => `
    <div class="product-card" onclick="window.__bakeryAddToCart('${p.id}')">
      <div class="p-name">${esc(p.name)}</div>
      <div class="p-price">${money(p.price)} ETB</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Stock: ${p.quantity || 0}</div>
    </div>
  `).join('');
};

window.__bakeryAddToCart = function(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;
  
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  }
  window.__bakeryRenderCart();
};

window.__bakeryRenderCart = function() {
  const list = document.getElementById('cartList');
  if (!list) return;
  
  if (cart.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">🛒 ጋሪው ባዶ ነው</div>';
    document.getElementById('cartTotal').textContent = '0.00 ETB';
    window.__bakeryUpdateUnpaid();
    return;
  }
  
  let total = 0;
  list.innerHTML = cart.map((item, index) => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    return `
      <div class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${esc(item.name)}</div>
          <div class="ci-price">${money(item.price)} x ${item.qty}</div>
        </div>
        <div class="ci-qty">
          <button onclick="window.__bakeryChangeQty(${index}, -1)">-</button>
          <span>${item.qty}</span>
          <button onclick="window.__bakeryChangeQty(${index}, 1)">+</button>
        </div>
        <div class="ci-total">${money(itemTotal)}</div>
        <div class="ci-del" onclick="window.__bakeryRemoveFromCart(${index})">×</div>
      </div>
    `;
  }).join('');
  
  document.getElementById('cartTotal').textContent = money(total) + ' ETB';
  window.__bakeryUpdateUnpaid();
};

window.__bakeryChangeQty = function(index, change) {
  cart[index].qty += change;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  window.__bakeryRenderCart();
};

window.__bakeryRemoveFromCart = function(index) {
  cart.splice(index, 1);
  window.__bakeryRenderCart();
};

window.__bakeryClearCart = function() {
  cart = [];
  document.getElementById('orderPaid').value = '';
  window.__bakeryRenderCart();
};

window.__bakeryUpdateUnpaid = function() {
  const totalText = document.getElementById('cartTotal')?.textContent || '0';
  const total = parseFloat(totalText.replace(/,/g, '')) || 0;
  const paid = parseFloat(document.getElementById('orderPaid')?.value) || 0;
  const unpaid = total - paid;
  const display = document.getElementById('unpaidDisplay');
  if (display) {
    display.textContent = `📝 Unpaid: ${money(Math.max(0, unpaid))} ETB`;
    display.style.color = unpaid > 0 ? 'var(--danger)' : 'var(--success)';
  }
};

window.__bakeryCompleteOrder = async function() {
  if (cart.length === 0) return showToast('ጋሪው ባዶ ነው!', 'error');
  
  const date = document.getElementById('orderDate').value;
  const paymentType = document.getElementById('orderPaymentType').value;
  const paidAmount = parseFloat(document.getElementById('orderPaid').value) || 0;
  const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  
  if (paidAmount > total) return showToast('የተከፈለው ገንዘብ ከጠቅላላው መብለጥ አይችልም', 'error');
  
  try {
    // 1. ሽያጭ መመዝገብ
    await addDoc(collection(db, 'sales'), {
      tenantId: state.tenantId,
      items: cart,
      total: total,
      paidAmount: paidAmount,
      unpaid: total - paidAmount,
      paymentType: paymentType,
      date: date,
      createdAt: serverTimestamp()
    });
    
    // 2. ክምችት (Stock) መቀነስ
    for (const item of cart) {
      await updateDoc(doc(db, 'products', item.id), {
        quantity: increment(-item.qty)
      });
    }
    
    showToast('✅ ሽያጩ ተመዝግቧል!');
    window.__bakeryClearCart();
  } catch (e) {
    showToast('❌ ስህተት: ' + e.message, 'error');
  }
};

// ═══════════════════════════════════════════
// 🍞 ITEMS (ክምችት ማስተዳደሪያ)
// ═══════════════════════════════════════════
window.__bakeryRenderItems = function() {
  const list = document.getElementById('bakeryItemsList');
  if (!list) return;
  
  const search = (document.getElementById('searchService')?.value || '').toLowerCase();
  const filtered = allProducts.filter(p => (p.name || '').toLowerCase().includes(search));
  
  // ጠቅላላ ክምችት ማስላት
  const totalQty = allProducts.reduce((s, p) => s + (p.quantity || 0), 0);
  const totalVal = allProducts.reduce((s, p) => s + ((p.quantity || 0) * (p.price || 0)), 0);
  if (document.getElementById('totalStockQty')) document.getElementById('totalStockQty').textContent = totalQty;
  if (document.getElementById('totalStockValue')) document.getElementById('totalStockValue').textContent = money(totalVal);
  
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">🍞</div><div>ምንም ዕቃ የለም</div></div>';
    return;
  }
  
  list.innerHTML = filtered.map(p => `
    <div class="item-row">
      <div class="item-row-name">
        ${esc(p.name)}
        <div style="font-size:11px; color:var(--text-muted); font-weight:normal;">${esc(p.category || 'General')}</div>
      </div>
      <div style="text-align:right;">
        <div class="item-row-price">${money(p.price)} ETB</div>
        <div style="font-size:12px; color:var(--text-muted);">Qty: ${p.quantity || 0}</div>
      </div>
      <div style="display:flex; gap:6px; margin-left:10px;">
        <button class="btn btn-outline btn-sm" onclick="window.__bakeryOpenItemModal('${p.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="window.__bakeryDeleteItem('${p.id}', '${escJs(p.name)}')">🗑️</button>
      </div>
    </div>
  `).join('');
};

window.__bakeryOpenItemModal = function(id = null) {
  editingProductId = id;
  let p = { category: '', name: '', price: '', quantity: '' };
  
  if (id) {
    const existing = allProducts.find(x => x.id === id);
    if (existing) p = existing;
  }
  
  const html = `
    <div class="modal-overlay open" id="itemModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${id ? '✏️ Edit Item' : '➕ Add Item'}</h3>
          <button class="modal-close" onclick="document.getElementById('itemModal').remove()">×</button>
        </div>
        <div class="modal-body">
          <label class="field-label" style="margin-top:0;">📁 Category</label>
          <input type="text" id="modalCat" value="${esc(p.category)}" placeholder="e.g. ዳቦ">
          
          <label class="field-label">🍞 Item Name *</label>
          <input type="text" id="modalName" value="${esc(p.name)}" placeholder="e.g. White Bread">
          
          <label class="field-label">💰 Price (ETB) *</label>
          <input type="number" id="modalPrice" value="${p.price}" placeholder="30.00" step="any">
          
          <label class="field-label">📦 Quantity (Stock) *</label>
          <input type="number" id="modalQty" value="${p.quantity}" placeholder="50">
          
          <button class="btn btn-success" onclick="window.__bakerySaveItem('${id || ''}')" style="margin-top:16px;">💾 Save</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('globalModalContainer').innerHTML = html;
};

window.__bakerySaveItem = async function(id) {
  const category = document.getElementById('modalCat').value.trim() || 'General';
  const name = document.getElementById('modalName').value.trim();
  const price = parseFloat(document.getElementById('modalPrice').value);
  const quantity = parseInt(document.getElementById('modalQty').value) || 0;
  
  if (!name) return showToast('ስም ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  
  try {
    if (id) {
      await updateDoc(doc(db, 'products', id), { category, name, price, quantity });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), {
        tenantId: state.tenantId, category, name, price, quantity, createdAt: serverTimestamp()
      });
      showToast('✅ ተጨምሯል');
    }
    document.getElementById('itemModal').remove();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.__bakeryDeleteItem = async function(id, name) {
  if (!confirm(`"${name}" ን ማጥፋት?`)) return;
  try {
    await deleteDoc(doc(db, 'products', id));
    showToast('✅ ተጠፍቷል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

// ═══════════════════════════════════════════
// 💸 EXPENSES (ወጪዎች)
// ═══════════════════════════════════════════
window.__bakeryRenderExpenses = function() {
  const list = document.getElementById('bakeryExpensesList');
  if (!list) return;
  
  // ጠቅላላ ወጪዎችን ማስላት
  const currentMonth = thisMonthStr();
  let monthTotal = 0, allTotal = 0;
  allExpenses.forEach(e => {
    allTotal += e.amount;
    if (e.date && e.date.startsWith(currentMonth)) monthTotal += e.amount;
  });
  
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(monthTotal);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allTotal);
  
  // ዝርዝር ማሳየት (ከአዲስ ወደ አሮጌ)
  const recent = [...allExpenses].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 20);
  
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="emoji">💸</div><div>ምንም ወጪ የለም</div></div>';
    return;
  }
  
  list.innerHTML = recent.map(e => `
    <div class="item-row">
      <div class="item-row-name">
        ${esc(e.category)}
        ${e.note ? `<div style="font-size:11px; color:var(--text-muted); font-weight:normal;">${esc(e.note)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="item-row-price" style="color:var(--danger);">- ${money(e.amount)}</div>
        <div style="font-size:11px; color:var(--text-muted);">${esc(e.date)}</div>
      </div>
      <div style="display:flex; gap:6px; margin-left:10px;">
        <button class="btn btn-danger btn-sm" onclick="window.__bakeryDeleteExpense('${e.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
};

window.__bakeryAddExpense = async function() {
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  
  if (!category) return showToast('ምድብ ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ወጪ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  
  try {
    await addDoc(collection(db, 'expenses'), {
      tenantId: state.tenantId, category, amount, date, note, createdAt: serverTimestamp()
    });
    showToast('✅ ወጪው ተመዝግቧል');
    document.getElementById('expCategory').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.__bakeryDeleteExpense = async function(id) {
  if (!confirm('ይህን ወጪ ማጥፋት?')) return;
  try {
    await deleteDoc(doc(db, 'expenses', id));
    showToast('✅ ተጠፍቷል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

// ═══════════════════════════════════════════
// 📊 REPORTS (ሪፖርቶች)
// ═══════════════════════════════════════════
let currentReportType = 'daily';

window.__bakerySetReportType = function(type, btn) {
  currentReportType = type;
  document.querySelectorAll('.report-type-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const elDate = document.getElementById('reportDate');
  const elMonth = document.getElementById('reportMonth');
  const elYear = document.getElementById('reportYear');
  
  if (!elDate) return;
  
  if (type === 'daily') {
    elDate.style.display = 'block'; elMonth.style.display = 'none'; elYear.style.display = 'none';
  } else if (type === 'monthly') {
    elDate.style.display = 'none'; elMonth.style.display = 'block'; elYear.style.display = 'none';
  } else {
    elDate.style.display = 'none'; elMonth.style.display = 'none'; elYear.style.display = 'block';
  }
  window.__bakeryRenderReports();
};

window.__bakeryRenderReports = function() {
  if (!document.getElementById('repRevenue')) return;
  
  let filterVal = '';
  if (currentReportType === 'daily') filterVal = document.getElementById('reportDate').value;
  else if (currentReportType === 'monthly') filterVal = document.getElementById('reportMonth').value;
  else filterVal = document.getElementById('reportYear').value;
  
  if (!filterVal) return;
  
  const filteredSales = allSales.filter(s => s.date && s.date.startsWith(filterVal));
  const filteredExps = allExpenses.filter(e => e.date && e.date.startsWith(filterVal));
  
  let revenue = 0, unpaid = 0, cash = 0, transfer = 0;
  
  filteredSales.forEach(s => {
    revenue += (s.paidAmount || 0);
    unpaid += (s.unpaid || 0);
    if (s.paymentType === 'cash') cash += (s.paidAmount || 0);
    if (s.paymentType === 'transfer') transfer += (s.paidAmount || 0);
  });
  
  const totalExp = filteredExps.reduce((s, e) => s + e.amount, 0);
  const profit = revenue - totalExp;
  
  document.getElementById('repRevenue').textContent = money(revenue);
  document.getElementById('repExpenses').textContent = money(totalExp);
  document.getElementById('repProfit').textContent = money(profit);
  document.getElementById('repUnpaid').textContent = money(unpaid);
  document.getElementById('repCash').textContent = money(cash);
  document.getElementById('repTransfer').textContent = money(transfer);
};

// ═══════════════════════════════════════════
// 🎨 EXTRA SETTINGS (ተጨማሪ ቅንብሮች)
// ═══════════════════════════════════════════
window.__bakeryToggleDark = function() {
  const isDark = !document.body.classList.contains('dark-mode');
  if (isDark) document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');
  updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: isDark }).catch(() => {});
};

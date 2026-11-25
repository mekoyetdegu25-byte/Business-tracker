// js/modules/bakery.js
import { db, auth } from '../firebase.js';
import { state, showToast, esc, escJs, money, todayStr, thisMonthStr, thisYearStr } from '../core.js';
import { 
  collection, addDoc, getDocs, query, where, serverTimestamp, 
  doc, updateDoc, getDoc, setDoc, deleteDoc, onSnapshot, increment 
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ═══════════════════════════════════════════
// 🌐 MODULE LOCAL STATE (የዚህ ሞጁል ብቻ)
// ═══════════════════════════════════════════
let allBranches = [];
let unsubBranches = null;

let allServices = []; 
let allSales = [];
let allExpenses = [];
let allPurchases = []; 
let unsubPurchases = null; 
let cart = [];
let editingServiceId = null;

// Pagination & Filters
let servicePage = 1, expensesPage = 1;
let servicePerPage = 10, expensesPerPage = 10;
let expenseDateFilter = 'recent';
let reportType = 'daily';
let openCategories = new Set();

let unsubServices = null, unsubSales = null, unsubExpenses = null;

// ═══════════════════════════════════════════
// 🧩 MODULE EXPORT (ለ registry.js የሚያገለግል)
// ═══════════════════════════════════════════
export const BakeryModule = {
  id: 'bakery',
  name: 'Bakery Manager',
  icon: '🍞',
  navItems: [
    { id: 'panelMobileHome', label: 'Home', icon: '🏠', default: true },
    { id: 'panel2', label: 'New Sale', icon: '🛒' },
    { id: 'panelQuickSale', label: 'Quick', icon: '⚡' },
    { id: 'panel1', label: 'Items', icon: '🍞' },
    { id: 'panel6', label: 'Reports', icon: '📊' },
    { id: 'panel8', label: 'More', icon: '⚙️' }
  ],
  panels: [], // HTML ከ index.html ስለሚመጣ ባዶ እንተወዋለን

  init: async function(appState) {
    console.log("🍞 Bakery Module Initialized");
    
    // Default dates ማስገባት
    if (document.getElementById('orderDate')) document.getElementById('orderDate').value = todayStr();
    if (document.getElementById('expDate')) document.getElementById('expDate').value = todayStr();
    if (document.getElementById('reportDate')) document.getElementById('reportDate').value = todayStr();
    if (document.getElementById('reportMonth')) document.getElementById('reportMonth').value = thisMonthStr();
    if (document.getElementById('reportYear')) document.getElementById('reportYear').value = thisYearStr();
    if (document.getElementById('expenseFilterDate')) document.getElementById('expenseFilterDate').value = todayStr();
    if (document.getElementById('expenseFilterMonth')) document.getElementById('expenseFilterMonth').value = thisMonthStr();
    if (document.getElementById('quickDate')) document.getElementById('quickDate').value = todayStr();
    if (document.getElementById('purchaseDate')) document.getElementById('purchaseDate').value = todayStr();
    if (document.getElementById('settingLowStock')) document.getElementById('settingLowStock').value = appState.lowStockThreshold;
    
    // Sidebar & Mobile Nav መገንባት (core.js ይህንን ያደርጋል ነገር ግን ለእርግጠኝነት እዚህም እናድርገው)
    buildNavigation();

    // Settings መሙላት
    if (appState.tenantData) {
      if (document.getElementById('settingBizName')) document.getElementById('settingBizName').value = appState.tenantData.name || '';
      if (document.getElementById('settingBizPhone')) document.getElementById('settingBizPhone').value = appState.tenantData.phone || '';
    }

    // Data Listeners መጀመር
    await loadAllData();
    
    // Theme መተግበር
    if (appState.tenantData?.darkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    
    // Mobile ከሆነ ወደ ሆም ገጽ መሄድ
    if (window.innerWidth <= 768) {
      window.switchPage('panelMobileHome', null);
    } else {
      window.switchPage('panel1', null);
    }
  },

  cleanup: function() {
    console.log("🍞 Bakery Module Cleaned up");
    if (unsubBranches) unsubBranches();
    if (unsubServices) unsubServices();
    if (unsubSales) unsubSales();
    if (unsubExpenses) unsubExpenses();
    if (unsubPurchases) unsubPurchases();
  }
};

// ═══════════════════════════════════════════
// 🧭 NAVIGATION BUILDER (ከHTML መዋቅር ጋር እንዲስማማ)
// ═══════════════════════════════════════════
function buildNavigation() {
  // 1. Sidebar (Desktop)
  const sidebar = document.getElementById('sidebarNav');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="menu-header active" onclick="switchPage('panel1', this)" data-tab="panel1">
        <div class="m-left"><i>🍞</i> <span>Items (Stock)</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panel2', this)" data-tab="panel2">
        <div class="m-left"><i>🛒</i> <span>New Sale</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panelQuickSale', this)" data-tab="panelQuickSale">
        <div class="m-left"><i>⚡</i> <span>Quick Sale</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panelPurchases', this)" data-tab="panelPurchases">
        <div class="m-left"><i>📥</i> <span>Purchases</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panel4', this)" data-tab="panel4">
        <div class="m-left"><i>💸</i> <span>Expenses</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panel6', this)" data-tab="panel6">
        <div class="m-left"><i>📊</i> <span>Reports</span></div>
      </div>
      <div class="menu-header" onclick="switchPage('panel8', this)" data-tab="panel8">
        <div class="m-left"><i>⚙️</i> <span>Settings</span></div>
      </div>
    `;
  }

  // 2. Mobile Bottom Nav
  const mobileNav = document.getElementById('mobileBottomNav');
  if (mobileNav) {
    mobileNav.innerHTML = `
      <button class="mobile-nav-item active" data-tab="panelMobileHome" onclick="mobileNavClick('panelMobileHome', this)">
        <span class="nav-icon">🏠</span><span>Home</span>
      </button>
      <button class="mobile-nav-item" data-tab="panel2" onclick="mobileNavClick('panel2', this)">
        <span class="nav-icon">🛒</span><span>New Sale</span>
      </button>
      <button class="mobile-nav-item" data-tab="panelQuickSale" onclick="mobileNavClick('panelQuickSale', this)">
        <span class="nav-icon">⚡</span><span>Quick</span>
      </button>
      <button class="mobile-nav-item" data-tab="panel1" onclick="mobileNavClick('panel1', this)">
        <span class="nav-icon">🍞</span><span>Items</span>
      </button>
      <button class="mobile-nav-item" data-tab="panel6" onclick="mobileNavClick('panel6', this)">
        <span class="nav-icon">📊</span><span>Reports</span>
      </button>
      <button class="mobile-nav-item" data-tab="panel8" onclick="mobileNavClick('panel8', this)">
        <span class="nav-icon">⚙️</span><span>More</span>
      </button>
    `;
  }

  // 3. Mobile Dropdown Menu
  const modernMenu = document.getElementById('modernMobileMenu');
  if (modernMenu) {
    modernMenu.innerHTML = `
      <div class="modern-menu-section">
        <div class="modern-menu-label">MENU</div>
        <div class="modern-menu-item" onclick="switchPage('panel1', null); toggleModernMenu();"><span class="icon">🍞</span> Items (Stock)</div>
        <div class="modern-menu-item" onclick="switchPage('panel2', null); toggleModernMenu();"><span class="icon">🛒</span> New Sale</div>
        <div class="modern-menu-item" onclick="switchPage('panelQuickSale', null); toggleModernMenu();"><span class="icon">⚡</span> Quick Sale</div>
        <div class="modern-menu-item" onclick="switchPage('panelPurchases', null); toggleModernMenu();"><span class="icon">📥</span> Purchases</div>
        <div class="modern-menu-item" onclick="switchPage('panel4', null); toggleModernMenu();"><span class="icon">💸</span> Expenses</div>
        <div class="modern-menu-item" onclick="switchPage('panel6', null); toggleModernMenu();"><span class="icon">📊</span> Reports</div>
        <div class="modern-menu-item" onclick="switchPage('panel8', null); toggleModernMenu();"><span class="icon">⚙️</span> Settings</div>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════
// 📥 DATA LOADING (Firestore Listeners)
// ═══════════════════════════════════════════
async function loadAllData() {
  if (!state.tenantId) return;
  
  unsubBranches = onSnapshot(query(collection(db, 'branches'), where('tenantId', '==', state.tenantId)), snap => {
    allBranches = []; 
    snap.forEach(d => allBranches.push({ id: d.id, ...d.data() }));
    renderBranchSettings();
    updateBranchDropdowns();
  });
  
  unsubServices = onSnapshot(query(collection(db, 'products'), where('tenantId', '==', state.tenantId)), snap => {
    allServices = []; snap.forEach(d => allServices.push({ id: d.id, ...d.data() }));
    allServices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderServiceList();
    renderPOSProducts();
    updateServiceCategories();
    populatePurchaseItems();
  });
  
  unsubSales = onSnapshot(query(collection(db, 'sales'), where('tenantId', '==', state.tenantId)), snap => {
    allSales = []; snap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderReports();
    updateMobileHome();
  });
  
  unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('tenantId', '==', state.tenantId)), snap => {
    allExpenses = []; snap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));
    renderExpenses();
    renderReports();
    updateMobileHome();
  });

  unsubPurchases = onSnapshot(query(collection(db, 'purchases'), where('tenantId', '==', state.tenantId)), snap => {
    allPurchases = []; snap.forEach(d => allPurchases.push({ id: d.id, ...d.data() }));
    allPurchases.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPurchases();
  });
} 

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

// ═══════════════════════════════════════════
// 🏢 BRANCHES (PRO)
// ═══════════════════════════════════════════
window.renderBranchSettings = function() {
  const card = document.getElementById('branchSettingsCard');
  if (!card) return;
  if (state.plan !== 'pro') { card.style.display = 'none'; return; }
  card.style.display = 'block';
  const list = document.getElementById('branchesList');
  if (!list) return;
  
  if (allBranches.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">ምንም ቅርንጫፍ የለም</p>';
    return;
  }
  list.innerHTML = allBranches.map(b => `
    <div style="display:flex; align-items:center; gap:8px; background:var(--bg); padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
      <span style="font-weight:600; font-size:13px;">🏢 ${esc(b.name)}</span>
      ${b.name === 'Main' ? '' : `<button onclick="deleteBranch('${b.id}', '${escJs(b.name)}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:14px; padding:0;">×</button>`}
    </div>
  `).join('');
};

window.updateBranchDropdowns = function() {
  const hasBranches = state.plan === 'pro' && allBranches.length > 0;
  
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
};

window.addBranch = async function() {
  if (state.plan !== 'pro') return showToast('Pro plan ብቻ!', 'error');
  const name = document.getElementById('newBranchName').value.trim();
  if (!name) return showToast('የቅርንጫፍ ስም ያስፈልጋል', 'error');
  if (allBranches.find(b => b.name.toLowerCase() === name.toLowerCase())) return showToast('ይህ ቅርንጫፍ አስቀድሞ አለ', 'error');
  
  try {
    await addDoc(collection(db, 'branches'), { tenantId: state.tenantId, name: name, createdAt: serverTimestamp() });
    document.getElementById('newBranchName').value = '';
    showToast('✅ ቅርንጫፍ ተጨምሯል');
  } catch(e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.deleteBranch = async function(id, name) {
  if (name === 'Main') return showToast('Main ማጥፋት አይቻልም', 'error');
  if (!confirm(`"${name}" ቅርንጫፍን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'branches', id)); showToast('✅ ተጠፍቷል'); } 
  catch(e) { showToast('❌ ስህተት', 'error'); }
};

// ═══════════════════════════════════════════
// 🍞 ITEMS (Stock Management)
// ═══════════════════════════════════════════
window.openServiceModal = function(id = null) {
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
};

window.closeServiceModal = function() {
  document.getElementById('serviceModal').classList.remove('open');
  editingServiceId = null;
};

window.saveService = async function() {
  const category = document.getElementById('serviceCategory').value.trim();
  const name = document.getElementById('serviceName').value.trim();
  const price = parseFloat(document.getElementById('servicePrice').value);
  const stock = parseInt(document.getElementById('serviceStock').value) || 0;
  const branch = state.plan === 'pro' ? document.getElementById('serviceBranch').value : 'Main';
  
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (!name) return showToast('Item Name ያስፈልጋል', 'error');
  if (isNaN(price) || price <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  
  try {
    if (editingServiceId) {
      await updateDoc(doc(db, 'products', editingServiceId), { category, name, price, quantity: stock, branch });
      showToast('✅ ተሻሽሏል');
    } else {
      await addDoc(collection(db, 'products'), {
        tenantId: state.tenantId, category, name, price, quantity: stock, branch, createdAt: serverTimestamp()
      });
      showToast('✅ ተጨምሯል');
    }
    closeServiceModal();
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.deleteService = async function(id) {
  const s = allServices.find(x => x.id === id);
  if (!confirm(`"${s?.name}" ን ማጥፋት?`)) return;
  try { await deleteDoc(doc(db, 'products', id)); showToast('✅ ተጠፍቷል'); } 
  catch (e) { showToast('❌ ስህተት', 'error'); }
};

window.toggleCategory = function(catName) {
  if (openCategories.has(catName)) openCategories.delete(catName);
  else openCategories.add(catName);
  renderServiceList();
};

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
    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
      <div style="font-size:48px; margin-bottom:12px;">🍞</div>
      <div style="font-weight:600;">ምንም ዕቃ የለም</div>
    </div>`;
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
        <div class="category-header" onclick="toggleCategory('${escJs(cat)}')">
          <div class="category-header-left">
            <span class="category-arrow">▶</span>
            <span class="category-name">📁 ${esc(cat)}</span>
            <span class="category-count">${items.length}</span>
          </div>
        </div>
        <div class="category-body">
          ${items.map(s => {
            const isLow = (s.quantity || 0) <= state.lowStockThreshold;
            return `
            <div class="item-row">
              <div class="item-row-name">
                🍞 ${esc(s.name)}
                <div style="font-size:11px; color:${isLow ? 'var(--danger)' : 'var(--success)'}; font-weight:700; margin-top:2px;">
                  ${isLow ? '⚠️' : '✅'} Stock: ${s.quantity || 0}
                </div>
              </div>
              <div class="item-row-price">${money(s.price)} ETB</div>
              <div style="display:flex; gap:4px;">
                <button class="action-btn btn-edit" onclick="event.stopPropagation(); openServiceModal('${s.id}')" style="background:rgba(59,130,246,0.1); color:var(--info); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">✏️</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteService('${s.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════
// 🛒 POS (New Sale)
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
    <div class="product-card" onclick="addToCart('${s.id}')">
      <div>
        <div class="p-name">${esc(s.name)}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Stock: ${s.quantity || 0}</div>
      </div>
      <div class="p-price">${money(s.price)} ETB</div>
    </div>
  `).join('');
}

window.addToCart = function(id) {
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
};

window.updateCartQty = function(i, delta) {
  const item = cart[i];
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) { cart.splice(i, 1); renderCart(); return; }
  if (newQty > item.maxQty) return showToast('በቂ ስቶክ የለም', 'error');
  item.qty = newQty;
  renderCart();
};

window.removeFromCart = function(i) { cart.splice(i, 1); renderCart(); };
window.clearCart = function() { cart = []; renderCart(); };

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
      <div class="ci-info">
        <div class="ci-name">${esc(c.name)}</div>
        <div class="ci-price">${money(c.price)} ETB</div>
      </div>
      <div class="ci-qty">
        <button onclick="updateCartQty(${i}, -1)">−</button>
        <span>${c.qty}</span>
        <button onclick="updateCartQty(${i}, 1)">+</button>
      </div>
      <div class="ci-total">${money(c.price * c.qty)}</div>
      <div class="ci-del" onclick="removeFromCart(${i})">✕</div>
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
window.updateUnpaidDisplay = updateUnpaidDisplay;

window.completeOrder = async function() {
  const orderDate = document.getElementById('orderDate').value;
  const paid = parseFloat(document.getElementById('orderPaid').value) || 0;
  const paymentType = document.getElementById('orderPaymentType').value;
  const branch = state.plan === 'pro' ? document.getElementById('orderBranch').value : 'Main';
  
  if (!orderDate) return showToast('ቀን ያስፈልጋል', 'error');
  if (cart.length === 0) return showToast('Cart ባዶ ነው', 'error');
  
  const total = cart.reduce((s, c) => s + (c.price * c.qty), 0);
  if (paid > total) return showToast('የተከፈለው ከጠቅላላ መብለጥ አይችልም', 'error');
  
  try {
    const items = cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, total: c.price * c.qty }));
    
    await addDoc(collection(db, 'sales'), {
      tenantId: state.tenantId, date: orderDate, items, total,
      paidAmount: paid, unpaidAmount: total - paid, paymentType, branch,
      createdAt: serverTimestamp()
    });
    
    for (const c of cart) {
      await updateDoc(doc(db, 'products', c.id), { quantity: increment(-c.qty) });
    }
    
    showToast('✅ Sale ተመዝግቧል');
    cart = [];
    renderCart();
    document.getElementById('orderPaid').value = '';
    document.getElementById('orderDate').value = todayStr();
    document.getElementById('orderPaymentType').value = 'cash';
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

// ═══════════════════════════════════════════
// ⚡ QUICK SALE
// ═══════════════════════════════════════════
window.addQuickSale = async function() {
  const date = document.getElementById('quickDate').value;
  const category = document.getElementById('quickCategory').value.trim() || 'Quick Sale';
  const amount = parseFloat(document.getElementById('quickAmount').value);
  const branch = state.plan === 'pro' ? document.getElementById('quickBranch').value : 'Main';
  
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  
  try {
    await addDoc(collection(db, 'sales'), {
      tenantId: state.tenantId, date, branch,
      items: [{ name: category, qty: 1, price: amount, total: amount }],
      total: amount, paidAmount: amount, unpaidAmount: 0,
      paymentType: 'cash', isQuickSale: true, createdAt: serverTimestamp()
    });
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickCategory').value = '';
    showToast('✅ Quick Sale ተመዝግቧል');
  } catch(e) { showToast('❌ ስህተት', 'error'); }
};

// ═══════════════════════════════════════════
// 📥 PURCHASES (Stock In)
// ═══════════════════════════════════════════
function populatePurchaseItems() {
  const sel = document.getElementById('purchaseItem');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Item --</option>' + allServices.map(s => `<option value="${s.id}">${esc(s.name)} (Stock: ${s.quantity || 0})</option>`).join('');
}

window.savePurchase = async function() {
  const itemId = document.getElementById('purchaseItem').value;
  const date = document.getElementById('purchaseDate').value;
  const qty = parseInt(document.getElementById('purchaseQty').value);
  const cost = parseFloat(document.getElementById('purchaseCost').value) || 0;
  
  if (!itemId) return showToast('ዕቃ ምረጥ', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  if (isNaN(qty) || qty <= 0) return showToast('ትክክል ያለው ብዛት ያስፈልጋል', 'error');
  
  const item = allServices.find(x => x.id === itemId);
  if (!item) return;
  
  try {
    await addDoc(collection(db, 'purchases'), {
      tenantId: state.tenantId, itemId, itemName: item.name, date, qty, cost, totalCost: qty * cost, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'products', itemId), { quantity: increment(qty) });
    showToast('✅ Purchase ተመዝግቧል');
    document.getElementById('purchaseQty').value = '';
    document.getElementById('purchaseCost').value = '';
  } catch(e) { showToast('❌ ስህተት', 'error'); }
};

function renderPurchases() {
  const el = document.getElementById('purchasesList');
  if (!el) return;
  if (allPurchases.length === 0) { el.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">ምንም ግዢ የለም</div>'; return; }
  
  el.innerHTML = allPurchases.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:600; font-size:13px; color:var(--text-main);">📦 ${esc(p.itemName)}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">📅 ${esc(p.date)} • Qty: +${p.qty}</div>
      </div>
      <div style="font-weight:800; color:var(--primary);">${money(p.totalCost)} ETB</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
// 💸 EXPENSES
// ═══════════════════════════════════════════
window.addExpense = async function() {
  const category = document.getElementById('expCategory').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date = document.getElementById('expDate').value;
  const note = document.getElementById('expNote').value.trim();
  const branch = state.plan === 'pro' ? document.getElementById('expBranch').value : 'Main';
  
  if (!category) return showToast('Category ያስፈልጋል', 'error');
  if (isNaN(amount) || amount <= 0) return showToast('ትክክል ያለው ዋጋ ያስፈልጋል', 'error');
  if (!date) return showToast('ቀን ያስፈልጋል', 'error');
  
  try {
    await addDoc(collection(db, 'expenses'), {
      tenantId: state.tenantId, category, amount, date, note, branch, createdAt: serverTimestamp()
    });
    document.getElementById('expCategory').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    document.getElementById('expDate').value = todayStr();
    showToast('✅ ወጪ ተመዝግቧል');
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.changeExpenseDate = function() {
  expensesPage = 1;
  renderExpenses();
};

window.setExpenseDateFilter = function(filter, btn) {
  expenseDateFilter = filter;
  document.querySelectorAll('#panel4 .date-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  
  const picker = document.getElementById('expenseDatePicker');
  const dateInput = document.getElementById('expenseFilterDate');
  const monthInput = document.getElementById('expenseFilterMonth');
  
  if (filter === 'date') {
    picker.style.display = 'block';
    dateInput.style.display = 'block';
    monthInput.style.display = 'none';
  } else if (filter === 'month') {
    picker.style.display = 'block';
    dateInput.style.display = 'none';
    monthInput.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
  expensesPage = 1;
  renderExpenses();
};

window.deleteExpense = async function(id) {
  if (!confirm('ወጪውን ማጥፋት?')) return;
  try { await deleteDoc(doc(db, 'expenses', id)); showToast('✅ ተጠፍቷል'); }
  catch (e) { showToast('❌ ስህተት', 'error'); }
};

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
  
  filtered.sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
  
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const allTotal = allExpenses.reduce((s, e) => s + e.amount, 0);
  
  if (document.getElementById('expMonthTotal')) document.getElementById('expMonthTotal').textContent = money(filteredTotal);
  if (document.getElementById('expAllTotal')) document.getElementById('expAllTotal').textContent = money(allTotal);
  
  if (filtered.length === 0) {
    el.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">💸 ምንም ወጪ የለም</div>';
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
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
          📅 ${esc(e.date)}${e.note ? ' • 📝 ' + esc(e.note) : ''}
          ${e.branch && state.plan === 'pro' ? ` • 🏢 ${esc(e.branch)}` : ''}
        </div>
      </div>
      <div style="font-weight:800; font-size:14px; color:var(--danger); white-space:nowrap;">${money(e.amount)} ETB</div>
      <button onclick="deleteExpense('${e.id}')" style="background:rgba(239,68,68,0.1); color:var(--danger); padding:4px 8px; border-radius:6px; border:none; cursor:pointer;">🗑️</button>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
// 📊 REPORTS
// ═══════════════════════════════════════════
window.setReportType = function(type, btn) {
  reportType = type;
  document.querySelectorAll('.report-type-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  const dateInput = document.getElementById('reportDate');
  const monthInput = document.getElementById('reportMonth');
  const yearInput = document.getElementById('reportYear');
  
  if (type === 'daily') {
    if (!dateInput.value) dateInput.value = todayStr();
    dateInput.style.display = 'block';
    monthInput.style.display = 'none';
    yearInput.style.display = 'none';
  } else if (type === 'monthly') {
    if (!monthInput.value) monthInput.value = thisMonthStr();
    dateInput.style.display = 'none';
    monthInput.style.display = 'block';
    yearInput.style.display = 'none';
  } else {
    if (!yearInput.value) yearInput.value = thisYearStr();
    dateInput.style.display = 'none';
    monthInput.style.display = 'none';
    yearInput.style.display = 'block';
  }
  renderReports();
};

window.getReportFilter = function() {
  const dateInput = document.getElementById('reportDate');
  const monthInput = document.getElementById('reportMonth');
  const yearInput = document.getElementById('reportYear');
  
  if (dateInput && dateInput.style.display !== 'none' && dateInput.offsetParent !== null) {
    const d = dateInput.value || todayStr();
    return { prefix: d, type: 'daily', label: `Daily (${d})` };
  } else if (monthInput && monthInput.style.display !== 'none' && monthInput.offsetParent !== null) {
    const m = monthInput.value || thisMonthStr();
    return { prefix: m, type: 'monthly', label: `Monthly (${m})` };
  } else if (yearInput && yearInput.style.display !== 'none' && yearInput.offsetParent !== null) {
    const y = yearInput.value || thisYearStr();
    return { prefix: y, type: 'yearly', label: `Yearly (${y})` };
  }
  return { prefix: todayStr(), type: 'daily', label: 'Daily' };
};

window.renderReports = function() {
  const filter = getReportFilter();
  const prefix = filter.prefix;
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
  
  if (document.getElementById('repRevenue')) document.getElementById('repRevenue').textContent = money(revenue);
  if (document.getElementById('repExpenses')) document.getElementById('repExpenses').textContent = money(expenses);
  if (document.getElementById('repProfit')) document.getElementById('repProfit').textContent = money(profit);
  if (document.getElementById('repUnpaid')) document.getElementById('repUnpaid').textContent = money(unpaid);
  if (document.getElementById('repCash')) document.getElementById('repCash').textContent = money(cashTotal) + ' ETB';
  if (document.getElementById('repTransfer')) document.getElementById('repTransfer').textContent = money(transferTotal) + ' ETB';
  if (document.getElementById('reportHeader')) document.getElementById('reportHeader').textContent = filter.label;
  
  const topBody = document.getElementById('topSellingBody');
  if (topBody) {
    const stats = {};
    periodSales.forEach(s => {
      (s.items || []).forEach(i => {
        if (!stats[i.name]) stats[i.name] = { qty: 0, revenue: 0 };
        stats[i.name].qty += i.qty;
        stats[i.name].revenue += i.total;
      });
    });
    
    const arr = Object.keys(stats).map(k => ({ name: k, ...stats[k] }));
    const top = arr.sort((a, b) => b.qty - a.qty).slice(0, 10);
    
    topBody.innerHTML = top.length === 0
      ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">ምንም ዳታ የለም</td></tr>'
      : top.map((x, i) => `<tr>
          <td style="padding:10px; border-bottom:1px solid var(--border);">${i + 1}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border);">${esc(x.name)}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border); color:var(--primary); font-weight:700;">${x.qty}</td>
          <td style="padding:10px; border-bottom:1px solid var(--border); color:var(--success); font-weight:700;">${money(x.revenue)} ETB</td>
        </tr>`).join('');
  }
};

// ═══════════════════════════════════════════
// 🖨️ EXPORT & PRINT
// ═══════════════════════════════════════════
window.exportReportCSV = function() {
  const { prefix, label } = getReportFilter();
  const periodSales = allSales.filter(o => (o.date || '').startsWith(prefix));
  const periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  
  if (periodSales.length === 0 && periodExpenses.length === 0) return showToast('ምንም ዳታ የለም', 'error');
  
  let csv = '\uFEFF' + label + '\n\n';
  csv += 'SALES\nDate,Items,Total,Paid,Unpaid,PaymentType\n';
  periodSales.forEach(s => {
    const items = (s.items || []).map(i => `${i.name} x${i.qty}`).join('; ');
    csv += `"${s.date}","${items}",${s.total},${s.paidAmount},${s.unpaidAmount || 0},"${s.paymentType || 'cash'}"\n`;
  });
  csv += '\nEXPENSES\nDate,Category,Amount,Note\n';
  periodExpenses.forEach(e => {
    csv += `"${e.date}","${e.category}",${e.amount},"${e.note || ''}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `report_${prefix}.csv`; a.click();
  URL.revokeObjectURL(url);
};

window.printReport = function() {
  const { prefix, label } = getReportFilter();
  const periodSales = allSales.filter(o => (o.date || '').startsWith(prefix));
  const periodExpenses = allExpenses.filter(e => (e.date || '').startsWith(prefix));
  
  const revenue = periodSales.reduce((s, o) => s + (o.paidAmount || 0), 0);
  const expenses = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const unpaid = periodSales.reduce((s, o) => s + (o.unpaidAmount || 0), 0);
  const profit = revenue - expenses;
  const cashTotal = periodSales.filter(o => (o.paymentType || 'cash') === 'cash').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const transferTotal = periodSales.filter(o => o.paymentType === 'transfer').reduce((s, o) => s + (o.paidAmount || 0), 0);
  const bizName = document.getElementById('hdrBusinessName').textContent;
  
  let html = `
    <div style="padding:20px; font-family: sans-serif;">
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="margin:0;">${esc(bizName)}</h2>
        <p style="margin:5px 0; color:#666;">${esc(label)}</p>
      </div>
      <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px;">
        <div style="text-align:center; flex:1;"><b>Revenue</b><br>${money(revenue)} ETB</div>
        <div style="text-align:center; flex:1;"><b>Expenses</b><br>${money(expenses)} ETB</div>
        <div style="text-align:center; flex:1;"><b>Profit</b><br>${money(profit)} ETB</div>
        <div style="text-align:center; flex:1;"><b>Unpaid</b><br>${money(unpaid)} ETB</div>
      </div>
      <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:12px; border-radius:8px; margin-bottom:20px;">
        <div style="text-align:center; flex:1;"><b>💵 Cash</b><br>${money(cashTotal)} ETB</div>
        <div style="text-align:center; flex:1;"><b>🏦 Transfer</b><br>${money(transferTotal)} ETB</div>
      </div>
      <h3>Sales (${periodSales.length})</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:20px;">
        <thead><tr style="background:#e2e8f0;">
          <th style="padding:6px; border:1px solid #ccc;">Date</th>
          <th style="padding:6px; border:1px solid #ccc;">Total</th>
          <th style="padding:6px; border:1px solid #ccc;">Paid</th>
          <th style="padding:6px; border:1px solid #ccc;">Unpaid</th>
          <th style="padding:6px; border:1px solid #ccc;">Payment</th>
        </tr></thead>
        <tbody>
  `;
  periodSales.forEach(s => {
    const typeIcon = s.paymentType === 'transfer' ? '🏦' : '💵';
    html += `<tr>
      <td style="padding:6px; border:1px solid #ccc;">${esc(s.date)}</td>
      <td style="padding:6px; border:1px solid #ccc;">${money(s.total)}</td>
      <td style="padding:6px; border:1px solid #ccc;">${money(s.paidAmount)}</td>
      <td style="padding:6px; border:1px solid #ccc;">${money(s.unpaidAmount || 0)}</td>
      <td style="padding:6px; border:1px solid #ccc;">${typeIcon} ${esc(s.paymentType || 'cash')}</td>
    </tr>`;
  });
  html += `</tbody></table>
      <h3>Expenses (${periodExpenses.length})</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr style="background:#e2e8f0;"><th style="padding:6px; border:1px solid #ccc;">Date</th><th style="padding:6px; border:1px solid #ccc;">Category</th><th style="padding:6px; border:1px solid #ccc;">Amount</th></tr></thead>
        <tbody>
  `;
  periodExpenses.forEach(e => {
    html += `<tr><td style="padding:6px; border:1px solid #ccc;">${esc(e.date)}</td><td style="padding:6px; border:1px solid #ccc;">${esc(e.category)}</td><td style="padding:6px; border:1px solid #ccc;">${money(e.amount)}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Report - ${esc(label)}</title></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
};

// ═══════════════════════════════════════════
// ⚙️ SETTINGS
// ═══════════════════════════════════════════
window.saveSettings = async function() {
  const name = document.getElementById('settingBizName').value.trim();
  const phone = document.getElementById('settingBizPhone').value.trim();
  const lowStock = parseInt(document.getElementById('settingLowStock').value) || 10;
  
  if (!name) return showToast('የንግድ ስም ያስፈልጋል', 'error');
  
  try {
    await updateDoc(doc(db, 'tenants', state.tenantId), {
      name, phone, lowStockThreshold: lowStock
    });
    showToast('✅ Settings ተቀምጧል');
    state.tenantData.name = name;
    state.tenantData.phone = phone;
    state.lowStockThreshold = lowStock;
    document.getElementById('hdrBusinessName').textContent = name;
  } catch (e) { showToast('❌ ስህተት: ' + e.message, 'error'); }
};

window.toggleDarkMode = async function(isDark) {
  if (isDark) document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');
  
  if (state.tenantId) {
    try {
      await updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: isDark });
      showToast('✅ Theme ተቀይሯል');
    } catch(e) { console.error(e); }
  }
};

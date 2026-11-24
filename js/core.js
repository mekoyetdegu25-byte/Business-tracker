// js/core.js
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getModule } from './registry.js';

// ═══════════════════════════════════════════
// 🌐 GLOBAL STATE (የመተግበሪያው ሁኔታ)
// ═══════════════════════════════════════════
export const state = {
  user: null,
  tenantId: null,
  tenantData: null,
  role: 'employee',
  plan: 'basic',
  businessType: null,
  module: null,
  lowStockThreshold: 10,
};

// ═══════════════════════════════════════════
// 🛠️ UTILITY FUNCTIONS (ረዳት ተግባራት)
// ═══════════════════════════════════════════
export function esc(s) { 
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); 
}
export function escJs(s) { 
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); 
}
export function money(n) { 
  return (Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}
export function todayStr() { 
  const d = new Date(); 
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); 
}
export function thisMonthStr() { 
  const d = new Date(); 
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); 
}
export function thisYearStr() { 
  return new Date().getFullYear().toString(); 
}

// መልእክት (Toast) ማሳያ
export function showToast(msg, type = 'success') {
  const host = document.getElementById('toastHost');
  const existing = host.querySelector('.toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast-notification ' + (type !== 'success' ? type : '');
  const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'info' ? 'ℹ️' : '✅';
  toast.innerHTML = `<span>${icon}</span> <span>${esc(msg)}</span>`;
  
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { 
    toast.classList.remove('show'); 
    setTimeout(() => toast.remove(), 300); 
  }, 3000);
}

// ═══════════════════════════════════════════
// 🔐 AUTH (መግቢያ እና መውጫ)
// ═══════════════════════════════════════════
window.login = async function() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  
  errEl.classList.remove('show');
  if (!email || !password) {
    errEl.textContent = '⚠️ Email እና Password ያስፈልጋሉ';
    errEl.classList.add('show'); return;
  }
  
  btn.disabled = true; 
  btn.textContent = '⏳ በመግባት ላይ...';
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    let msg = '❌ Email ወይም Password ትክክል አይደለም';
    if (err.code === 'auth/too-many-requests') msg = '❌ ብዙ ሙከራ። ቆይተህ ሞክር።';
    errEl.textContent = msg; 
    errEl.classList.add('show');
    btn.disabled = false; 
    btn.textContent = '🔓 Sign In';
  }
};

window.logout = function() {
  if (state.module?.cleanup) state.module.cleanup();
  signOut(auth);
};

window.forgotPassword = async function(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) return alert('⚠️ እባክህ መጀመሪያ Email አስገባ');
  try {
    await addDoc(collection(db, 'passwordRequests'), { 
      email, requestedAt: serverTimestamp(), status: 'pending' 
    });
    alert(`✅ ጥያቄ ተልኳል!\n\n${email}`);
  } catch (err) { alert('❌ ስህተት: ' + err.message); }
};

// ═══════════════════════════════════════════
// 🚦 AUTH STATE & TENANT LOAD
// ═══════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    await loadUserAndTenant(user);
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.remove('show');
    document.getElementById('blockScreen').classList.add('hidden');
    
    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = false; btn.textContent = '🔓 Sign In'; }
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    
    state.user = null;
    state.tenantId = null;
  }
});

async function loadUserAndTenant(user) {
  state.user = user;
  try {
    // 1. የተጠቃሚውን መረጃ መጫን
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      showToast('ተጠቃሚ መረጃ አልተገኘም', 'error');
      await signOut(auth); return;
    }
    const userData = userDoc.data();
    state.tenantId = userData.tenantId;
    state.role = (userData.role || 'employee').toLowerCase();

    // 2. የንግዱን (Tenant) መረጃ መጫን
    const tenantDoc = await getDoc(doc(db, 'tenants', state.tenantId));
    if (!tenantDoc.exists()) {
      showToast('ንግድ አልተገኘም', 'error');
      await signOut(auth); return;
    }
    const tenant = tenantDoc.data();
    state.tenantData = tenant;
    state.plan = tenant.plan || 'basic';
    state.businessType = tenant.businessType || 'retail';
    state.lowStockThreshold = tenant.lowStockThreshold || 10;

    // 3. የአካውንት ማብቂያ እና መታገድ ማረጋገጫ
    if (tenant.isSuspended) {
      return showBlockScreen('suspended', '⏸️ አካውንት ተቋርጧል', 'ይህ አካውንት በአስተዳዳሪው ተቋርጧል። እባክህ አስተዳዳሪውን አግኝ።');
    }
    if (tenant.expiryDate) {
      const exp = new Date(tenant.expiryDate); exp.setHours(0,0,0,0);
      const today = new Date(); today.setHours(0,0,0,0);
      if (exp < today) {
        return showBlockScreen('expired', '⏰ የአገልግሎት ጊዜ አልቋል', `የአገልግሎት ጊዜዎ አልቋል (${tenant.expiryDate})። እባክህ አስተዳዳሪውን አግኝ።`);
      }
    }

    // 4. ለዘርፉ የሚሆን ኮድ (Module) መጫን
    const module = getModule(state.businessType);
    if (!module) {
      return showBlockScreen('error', '❌ ኮድ አልተገኘም', `የዚህ ዘርፍ (${state.businessType}) ሶፍትዌር አልተገኘም።`);
    }
    state.module = module;

    // 5. የራስጌ መረጃዎችን ማሳየት
    document.getElementById('hdrBusinessName').textContent = tenant.name || 'Business';
    document.getElementById('hdrUserEmail').textContent = user.email;
    document.getElementById('hdrUserInitial').textContent = (user.email || 'U').charAt(0).toUpperCase();
    const roleMap = { owner: '👑 Owner', manager: '🎯 Manager', employee: '👤 Employee' };
    document.getElementById('hdrRoleBadge').textContent = roleMap[state.role] || 'User';

    // 6. ገጽታ (Theme) ማስተካከል
    document.getElementById('loginLogoIcon').textContent = module.icon || '⚡';
    document.getElementById('loginSubtitle').textContent = (module.name || 'BUSINESS').toUpperCase();
    document.body.setAttribute('data-module', state.businessType);
    
    if (tenant.darkMode) document.body.classList.add('dark-mode');

    // 7. መተግበሪያውን ማሳየት እና ዘርፉን መጫን
    document.getElementById('mainApp').classList.add('show');
    document.getElementById('blockScreen').classList.add('hidden');
    await mountModule(module);
    
    // Splash ጠፍቶ መተግበሪያው እንዲታይ
    document.getElementById('splashScreen').classList.add('fade-out');

  } catch (err) {
    console.error(err);
    showToast('ስህተት: ' + err.message, 'error');
  }
}

function showBlockScreen(type, title, message) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('show');
  document.getElementById('blockScreen').classList.remove('hidden');
  document.getElementById('blockIcon').textContent = type === 'suspended' ? '⏸️' : type === 'expired' ? '⏰' : '❌';
  document.getElementById('blockTitle').textContent = title;
  document.getElementById('blockMessage').textContent = message;
  document.getElementById('splashScreen').classList.add('fade-out');
}

// ═══════════════════════════════════════════
// 🧩 MODULE MOUNTING (የዘርፍ ኮድ መጫኛ)
// ═══════════════════════════════════════════
async function mountModule(module) {
  // 1. የጎን ማውጫ (Sidebar) ማዘጋጀት
  const sidebar = document.getElementById('sidebarNav');
  sidebar.innerHTML = (module.navItems || []).map(item => `
    <div class="menu-header ${item.default ? 'active' : ''}" 
         onclick="switchPage('${item.id}', this)" data-tab="${item.id}">
      <div class="m-left"><i>${item.icon}</i> <span>${esc(item.label)}</span></div>
    </div>
  `).join('');

  // 2. የሞባይል የታችኛው ማውጫ (Mobile Bottom Nav) ማዘጋጀት
  const mobileNav = document.getElementById('mobileBottomNav');
  const mobileItems = (module.navItems || []).slice(0, 5);
  mobileNav.innerHTML = mobileItems.map(item => `
    <button class="mobile-nav-item ${item.default ? 'active' : ''}" 
            data-tab="${item.id}" 
            onclick="mobileNavClick('${item.id}', this)">
      <span class="nav-icon">${item.icon}</span><span>${esc(item.label)}</span>
    </button>
  `).join('');

  // 3. የዘርፉን ገጾች (Panels) መጫን
  const panelHost = document.getElementById('modulePanels');
  panelHost.innerHTML = (module.panels || []).map(p => `
    <div class="panel" id="${p.id}">${p.html || ''}</div>
  `).join('');

  // 4. ዘርፉ የራሱን ስራዎች (Data load, events) እንዲጀምር ማድረግ
  if (module.init) await module.init(state);

  // 5. የመጀመሪያውን ገጽ ማሳየት
  const defaultItem = (module.navItems || []).find(i => i.default);
  if (defaultItem) switchPage(defaultItem.id, null);
}

// ═══════════════════════════════════════════
// 🧭 NAVIGATION (ገጽ መቀየሪያ)
// ═══════════════════════════════════════════
export function switchPage(panelId, btnEl) {
  // ገጾችን መደበቅ/ማሳየት
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
  
  // የጎን ማውጫ አረንጓዴ ማድረግ
  document.querySelectorAll('.menu-header').forEach(m => m.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  else {
    const match = document.querySelector(`.menu-header[data-tab="${panelId}"]`);
    if (match) match.classList.add('active');
  }
  
  // የሞባይል ማውጫ ማመሳሰል
  document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
  const mb = document.querySelector(`.mobile-nav-item[data-tab="${panelId}"]`);
  if (mb) mb.classList.add('active');
  
  // የሞባይል ራስጌ ርዕስ መቀየር
  const titleEl = document.getElementById('currentMobileTabTitle');
  if (titleEl) {
    const item = state.module?.navItems?.find(i => i.id === panelId);
    titleEl.textContent = item?.label || 'Home';
  }
  
  // ዘርፉ ገጽ ሲቀየር ማወቅ እንዲችል
  if (state.module?.onPageChange) state.module.onPageChange(panelId);
}
window.switchPage = switchPage;

export function mobileNavClick(panelId, btnEl) {
  switchPage(panelId, null);
  if (btnEl) {
    document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }
}
window.mobileNavClick = mobileNavClick;

// ═══════════════════════════════════════════
// 🎨 EXTRA GLOBAL CONTROLS
// ═══════════════════════════════════════════
window.toggleModernMenu = function() {
  document.getElementById('modernMobileMenu').classList.toggle('open');
};

window.toggleDarkModeBtn = async function() {
  const isDark = !document.body.classList.contains('dark-mode');
  if (isDark) document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');
  
  if (state.tenantId) {
    try {
      await updateDoc(doc(db, 'tenants', state.tenantId), { darkMode: isDark });
    } catch (e) { console.error("Dark mode save failed", e); }
  }
};

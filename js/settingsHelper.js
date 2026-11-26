// js/settingsHelper.js
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";
import { auth, db, firebaseConfig } from './firebase.js';
import { state, esc, escJs, showToast, todayStr, money } from './core.js';

let unsubSupport = null;
let unsubTenant = null;
let unsubEmployees = null;
let supportData = { phone: '', telegram: '', email: '' };
let employeesList = [];
let editingEmployeeId = null;

const CYCLE_DAYS = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365
};

let pricingConfig = {
  basic: { monthly: 500, quarterly: 1400, semiannual: 2700, annual: 5000 },
  pro: { monthly: 1000, quarterly: 2800, semiannual: 5400, annual: 10000 }
};

const OPEN_SECTIONS = new Set(['secSupport', 'secSub']);
const EXTRA_MOUNT_ID = 'extraSettingsSectionsMount';

const I18N = {
  am: {
    subTitle: '📅 የደንበኝነት ሁኔታ እና ክፍያ (Subscription & Billing)',
    planLabel: 'ፕላን',
    expiryLabel: 'የማብቂያ ቀን',
    daysLeftLabel: 'ቀሪ ቀናት',
    sendPayReqTitle: '💳 የክፍያ / የእድሳት ጥያቄ ይላኩ',
    payCycleLbl: 'የክፍያ ጊዜ (Billing Cycle)',
    payAmountLbl: 'የሚከፈል መጠን (ETB)',
    payMethodLbl: 'የክፍያ ዘዴ',
    payExpLbl: 'የሚታሰብ አዲስ ማብቂያ ቀን',
    payProofLbl: '📸 የክፍያ Screenshot (Proof)',
    payNoteLbl: 'የክፍያ ማጣቀሻ / ማስታወሻ',
    sendPayReqBtn: '📤 የክፍያ ጥያቄ እና Screenshot ላክ',
    langTitle: '🌐 ቋንቋ (Language)',
    langLabel: 'የመተግበሪያ ቋንቋ ይምረጡ',
    supportTitle: '🛟 የድጋፍ መረጃ (Support Info)',
    noSupport: 'የድጋፍ መረጃ አልተቀመጠም',
    empTitle: '👥 ሰራተኞች አስተዳደር (Employee Management)',
    addEmpModalTitle: '➕ Add Employee (ሰራተኛ ጨምር)',
    editEmpModalTitle: '✏️ Edit Employee Permissions',
    empEmail: '📧 Employee Email *',
    empTempPass: '🔒 Temporary Password *',
    empPerms: '🎯 Permissions (የሚፈቀዱ ገጾች)',
    createEmpBtn: '💾 Create Employee',
    updateEmpBtn: '💾 Update Permissions',
    cancelBtn: 'ሰርዝ',
    empLimitReached: (max) => `⚠️ ያለ Admin ፍቃድ ከ ${max} ሰራተኛ በላይ መጨመር አይችሉም። እባክዎ Admin ያነጋግሩ።`,
    backupTitle: '💾 ባካፕ እና ሪስቶር (Backup & Restore)',
    backupBtn: '⬇️ ባካፕ አውርድ (JSON)',
    restoreBtn: '⬆️ ሪስቶር አድርግ (JSON)',
    passTitle: '🔐 ፓስወርድ መቀየር (Change Password)',
    newPass: 'አዲስ ፓስወርድ (ቢያንስ 6 ፊደል)',
    confirmPass: 'አዲስ ፓስወርድ ያረጋግጡ',
    currPass: 'የአሁኑ ፓስወርድ (አስፈላጊ ከሆነ)',
    changePassBtn: '🔑 ፓስወርድ ቀይር',
    dangerTitle: '🚨 አደገኛ ቀጠና (Danger Zone)',
    dangerDesc: 'ይህ እርምጃ የንግዱን ሪከርዶች (sales, expenses, payments, customers, products, ወዘተ) ሙሉ በሙሉ ይሰርዛል። ተመላሽ አይደለም!',
    dangerBtn: '🗑️ ሁሉንም ዳታ ሪሴት አድርግ (Reset)'
  },
  en: {
    subTitle: '📅 Subscription & Billing',
    planLabel: 'Plan',
    expiryLabel: 'Expiry Date',
    daysLeftLabel: 'Days Remaining',
    sendPayReqTitle: '💳 Submit Payment / Renewal Request',
    payCycleLbl: 'Billing Cycle',
    payAmountLbl: 'Amount (ETB)',
    payMethodLbl: 'Payment Method',
    payExpLbl: 'Calculated New Expiry Date',
    payProofLbl: '📸 Payment Screenshot (Proof)',
    payNoteLbl: 'Reference / Note',
    sendPayReqBtn: '📤 Send Payment Request & Screenshot',
    langTitle: '🌐 Language',
    langLabel: 'Select Application Language',
    supportTitle: '🛟 Support Info',
    noSupport: 'Support info is not set yet',
    empTitle: '👥 Employee Management',
    addEmpModalTitle: '➕ Add Employee',
    editEmpModalTitle: '✏️ Edit Employee Permissions',
    empEmail: '📧 Employee Email *',
    empTempPass: '🔒 Temporary Password *',
    empPerms: '🎯 Permissions',
    createEmpBtn: '💾 Create Employee',
    updateEmpBtn: '💾 Update Permissions',
    cancelBtn: 'Cancel',
    empLimitReached: (max) => `⚠️ Cannot add more than ${max} employees without Admin approval. Please contact Admin.`,
    backupTitle: '💾 Backup & Restore',
    backupBtn: '⬇️ Download Backup (JSON)',
    restoreBtn: '⬆️ Restore Backup (JSON)',
    passTitle: '🔐 Change Password',
    newPass: 'New Password (min 6 chars)',
    confirmPass: 'Confirm New Password',
    currPass: 'Current Password (if re-auth needed)',
    changePassBtn: '🔑 Change Password',
    dangerTitle: '🚨 Danger Zone',
    dangerDesc: 'This action permanently deletes business records (sales, expenses, payments, customers, products, etc.). This cannot be undone!',
    dangerBtn: '🗑️ Reset All Business Data'
  }
};

const PHRASE_MAP = [
  ['Home', 'መነሻ'], ['Dashboard', 'ዳሽቦርድ'], ['Sell', 'ሽያጭ'], ['POS / Sell', 'ሽያጭ'],
  ['Quick Sale', 'ፈጣን ሽያጭ'], ['Sales', 'ሽያጮች'], ['Sales History', 'የሽያጭ ታሪክ'],
  ['Orders', 'ትዕዛዞች'], ['New Order', 'አዲስ ትዕዛዝ'], ['Customers', 'ደንበኞች'],
  ['Clients', 'ደንበኞች'], ['Products', 'ምርቶች'], ['Inventory', 'ክምችት'], ['Stock', 'ክምችት'],
  ['Items', 'እቃዎች'], ['Menu', 'ሜኑ'], ['Rooms', 'ክፍሎች'], ['Bookings', 'ቦታ ማስያዝ'],
  ['Guests', 'እንግዶች'], ['Services', 'አገልግሎቶች'], ['Appointments', 'ቀጠሮዎች'],
  ['Expenses', 'ወጪዎች'], ['Purchases', 'ግዢዎች'], ['Payments', 'ክፍያዎች'], ['Credit', 'ብድር'],
  ['Reports', 'ሪፖርቶች'], ['Analytics', 'ትንታኔ'], ['Settings', 'ቅንብሮች'], ['More', 'ተጨማሪ'],
  ['Business Information', 'የንግድ መረጃ'], ['Business Info', 'የንግድ መረጃ'],
  ['Business Name', 'የንግድ ስም'], ['Phone', 'ስልክ'], ['Save Settings', 'ቅንብር አስቀምጥ'],
  ['Branches', 'ቅርንጫፎች'], ['Add', 'ጨምር'], ['Save', 'አስቀምጥ'], ['Cancel', 'ሰርዝ'],
  ['Delete', 'አጥፋ'], ['Edit', 'አስተካክል'], ['Search', 'ፈልግ'], ['Total', 'ጠቅላላ'],
  ['Today', 'ዛሬ'], ['This Month', 'በዚህ ወር'], ['This Year', 'በዚህ ዓመት'], ['Profit', 'ትርፍ'],
  ['Revenue', 'ገቢ'], ['Expense', 'ወጪ'], ['Balance', 'ቀሪ'], ['Paid', 'የተከፈለ'],
  ['Unpaid', 'ያልተከፈለ'], ['Date', 'ቀን'], ['Amount', 'መጠን'], ['Price', 'ዋጋ'],
  ['Quantity', 'ብዛት'], ['Category', 'ምድብ'], ['Notes', 'ማስታወሻ'], ['Account', 'አካውንት'],
  ['Sign Out', 'ውጣ'], ['Logout', 'ውጣ'], ['Price List', 'የዋጋ ዝርዝር']
];

const enToAm = new Map(PHRASE_MAP.map(([en, am]) => [en.toLowerCase(), am]));
const amToEn = new Map(PHRASE_MAP.map(([en, am]) => [am, en]));

export function translateText(raw, targetLang) {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (targetLang === 'am') {
    const exact = enToAm.get(trimmed.toLowerCase());
    if (exact) return raw.replace(trimmed, exact);
    let out = raw;
    for (const [en, am] of PHRASE_MAP) {
      const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      out = out.replace(re, am);
    }
    return out;
  } else {
    const exact = amToEn.get(trimmed);
    if (exact) return raw.replace(trimmed, exact);
    let out = raw;
    for (const [en, am] of PHRASE_MAP) {
      if (out.includes(am)) out = out.split(am).join(en);
    }
    return out;
  }
}

export function applyFullPageLanguage(lang) {
  const targetLang = lang || getLang();
  document.documentElement.lang = targetLang;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('#' + EXTRA_MOUNT_ID)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(textNode => {
    const translated = translateText(textNode.nodeValue, targetLang);
    if (translated !== textNode.nodeValue) textNode.nodeValue = translated;
  });
}

export function getLang() {
  return state.language || state.tenantData?.language || 'am';
}

export function t(key, ...args) {
  const lang = getLang();
  const val = I18N[lang]?.[key] ?? I18N.am[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

async function fetchPricingFromFirestore() {
  try {
    const snap = await getDoc(doc(db, 'appSettings', 'pricing'));
    if (snap.exists()) {
      const d = snap.data();
      pricingConfig = {
        basic: { ...pricingConfig.basic, ...(d.basic || {}) },
        pro: { ...pricingConfig.pro, ...(d.pro || {}) }
      };
    }
  } catch (e) { console.error(e); }
}

function calcNextExpiry(cycle = 'monthly') {
  const days = CYCLE_DAYS[cycle] || 30;
  const curExp = state.tenantData?.expiryDate;
  const base = (curExp && new Date(curExp) > new Date()) ? new Date(curExp) : new Date();
  base.setHours(0,0,0,0);
  base.setDate(base.getDate() + days);
  return base.toISOString().split('T')[0];
}

function collapsibleCard(id, titleHtml, bodyHtml) {
  const isOpen = OPEN_SECTIONS.has(id);
  return `
    <div class="card" style="padding:0; overflow:hidden; margin-top:14px;">
      <button type="button" onclick="window.toggleSettingSection('${id}')"
        style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:var(--card-bg, var(--card, transparent)); color:var(--text-main, var(--text, inherit)); border:none; text-align:left; font-size:15px; font-weight:700; cursor:pointer;">
        <span>${titleHtml}</span>
        <span id="chev_${id}" style="transition:transform 0.2s; transform:rotate(${isOpen ? '90deg' : '0deg'}); font-size:13px;">▶</span>
      </button>
      <div id="body_${id}" style="display:${isOpen ? 'block' : 'none'}; padding:0 20px 20px 20px; border-top:1px solid var(--border, #e2e8f0);">
        <div style="padding-top:14px;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

function getModulePermissionItems() {
  const nav = state.module?.navItems || [];
  return nav.filter(item => item.id !== 'panel8');
}

function getDaysRemainingText(expiryDate) {
  if (!expiryDate) return '-';
  const exp = new Date(expiryDate); exp.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((exp - today) / (1000*60*60*24));
  if (diff < 0) return `🚨 Expired (${Math.abs(diff)}d ago)`;
  return `${diff} days`;
}

export function renderExtraSettingsHtml() {
  const lang = getLang();
  const isOwner = (state.role || 'employee').toLowerCase() === 'owner';
  const maxEmp = state.tenantData?.maxEmployees ?? 2;
  const permItems = getModulePermissionItems();
  const editingEmp = editingEmployeeId ? employeesList.find(e => e.id === editingEmployeeId) : null;
  const expDate = state.tenantData?.expiryDate || '-';
  const planKey = (state.tenantData?.plan || state.plan || 'basic').toLowerCase();
  const planName = planKey.toUpperCase();
  const defaultPrice = pricingConfig[planKey]?.monthly ?? 0;
  const defaultNextExp = calcNextExpiry('monthly');

  const subBody = `
    <div style="font-size:13.5px; line-height:1.85; margin-bottom:14px;">
      <div>📦 <b>${esc(t('planLabel'))}:</b> ${esc(planName)}</div>
      <div>📅 <b>${esc(t('expiryLabel'))}:</b> ${esc(expDate)}</div>
      <div>⏳ <b>${esc(t('daysLeftLabel'))}:</b> ${esc(getDaysRemainingText(state.tenantData?.expiryDate))}</div>
    </div>
    ${isOwner ? `
      <div style="background:var(--bg, #f8fafc); padding:14px; border-radius:10px; border:1px solid var(--border, #e2e8f0);">
        <div style="font-weight:700; font-size:13.5px; margin-bottom:10px;">${esc(t('sendPayReqTitle'))}</div>

        <label class="field-label" style="margin-top:0;">${esc(t('payCycleLbl'))}</label>
        <select id="subReqCycle" onchange="window.syncTenantPayReqPrice()">
          <option value="monthly">Monthly (30 days)</option>
          <option value="quarterly">Quarterly (90 days)</option>
          <option value="semiannual">Semi-Annual (180 days)</option>
          <option value="annual">Annual (365 days)</option>
        </select>

        <label class="field-label">${esc(t('payAmountLbl'))}</label>
        <input type="number" id="subReqAmount" value="${defaultPrice}" readonly style="font-weight:700;">

        <label class="field-label">${esc(t('payExpLbl'))}</label>
        <input type="date" id="subReqExpiry" value="${defaultNextExp}" readonly>

        <label class="field-label">${esc(t('payMethodLbl'))}</label>
        <select id="subReqMethod">
          <option value="Telebirr">Telebirr</option>
          <option value="CBE">CBE</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Cash">Cash</option>
        </select>

        <label class="field-label">${esc(t('payProofLbl'))}</label>
        <input type="file" id="subReqProofFile" accept="image/*">

        <label class="field-label">${esc(t('payNoteLbl'))}</label>
        <input type="text" id="subReqNote" placeholder="TXN ID or note...">

        <button type="button" class="btn btn-primary" id="subReqBtn" onclick="window.submitTenantPaymentRequest()" style="margin-top:6px;">${esc(t('sendPayReqBtn'))}</button>
      </div>
    ` : ''}
  `;

  const supportBody = `
    <div id="supportInfoContent" style="font-size:13.5px; line-height:1.9;">
      ${renderSupportDetailsHtml()}
    </div>
  `;

  const langBody = `
    <label class="field-label" style="margin-top:0;">${esc(t('langLabel'))}</label>
    <div style="display:flex; gap:10px;">
      <button type="button" class="btn ${lang === 'am' ? 'btn-primary' : 'btn-outline'}" onclick="window.setAppLanguage('am')" style="margin-top:0;">🇪🇹 አማርኛ (Amharic)</button>
      <button type="button" class="btn ${lang === 'en' ? 'btn-primary' : 'btn-outline'}" onclick="window.setAppLanguage('en')" style="margin-top:0;">🇬🇧 English</button>
    </div>
  `;

  const checkboxesHtml = permItems.map(item => {
    const checked = editingEmp
      ? (Array.isArray(editingEmp.permissions) ? editingEmp.permissions.includes(item.id) : true)
      : true;
    return `
      <label style="display:flex; align-items:center; gap:10px; padding:6px 0; cursor:pointer; font-size:14px; font-weight:500;">
        <input type="checkbox" class="emp-perm-cb" value="${esc(item.id)}" ${checked ? 'checked' : ''} style="width:18px; height:18px; margin:0; accent-color:var(--primary, #1a365d);">
        <span>${esc(translateText(item.label, lang))}</span>
      </label>
    `;
  }).join('');

  const empFormHtml = isOwner ? `
    <div style="background:var(--bg, #f8fafc); padding:16px; border-radius:12px; border:1px solid var(--border, #e2e8f0); margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <strong style="font-size:15px;">${editingEmp ? esc(t('editEmpModalTitle')) : esc(t('addEmpModalTitle'))}</strong>
        <span style="font-size:12px; font-weight:700; color:var(--text-muted, #64748b);">📊 ${employeesList.length} / ${maxEmp}</span>
      </div>

      <label class="field-label" style="margin-top:0;">${esc(t('empEmail'))}</label>
      <input type="email" id="empEmailInput" value="${esc(editingEmp?.email || '')}" ${editingEmp ? 'disabled' : ''} placeholder="employee@email.com">

      ${!editingEmp ? `
        <label class="field-label">${esc(t('empTempPass'))}</label>
        <input type="text" id="empTempPassInput" value="123456" placeholder="123456">
      ` : ''}

      <label class="field-label" style="margin-top:6px;">${esc(t('empPerms'))}</label>
      <div style="margin:6px 0 14px 0;">
        ${checkboxesHtml}
      </div>

      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-primary" id="saveEmpBtn" onclick="window.saveEmployee()" style="margin-top:0;">
          ${editingEmp ? esc(t('updateEmpBtn')) : esc(t('createEmpBtn'))}
        </button>
        ${editingEmp ? `<button type="button" class="btn btn-outline" onclick="window.cancelEditEmployee()" style="margin-top:0; width:auto;">${esc(t('cancelBtn'))}</button>` : ''}
      </div>
    </div>
  ` : `<p style="font-size:12.5px; color:var(--text-muted, #64748b); margin-bottom:10px;">Owner ብቻ ሰራተኞችን ማስተዳደር ይችላል።</p>`;

  const empListHtml = employeesList.length === 0
    ? `<p style="font-size:13px; color:var(--text-muted, #64748b); text-align:center; padding:12px;">ምንም ሰራተኛ አልተመዘገበም</p>`
    : `<div class="desktop-card-grid">` + employeesList.map(emp => {
      const allowedCount = Array.isArray(emp.permissions) ? emp.permissions.length : permItems.length;
      const isActive = emp.active !== false;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border:1px solid var(--border, #e2e8f0); border-radius:10px; background:var(--card-bg, var(--card, #fff)); gap:10px;">
          <div style="min-width:0;">
            <div style="font-weight:700; font-size:13.5px; word-break:break-word;">
              📧 ${esc(emp.email || emp.name || '-')}
              <span style="font-size:11px; color:${isActive ? '#16a34a' : '#dc2626'};">(${isActive ? 'Active' : 'Disabled'})</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted, #64748b); margin-top:2px;">🎯 ${allowedCount} / ${permItems.length} Permissions</div>
          </div>
          ${isOwner ? `
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button type="button" onclick="window.toggleEmployeeActive('${emp.id}', ${isActive})" style="background:rgba(100,116,139,0.14); color:inherit; border:none; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11px;">${isActive ? '⏸️' : '▶️'}</button>
              <button type="button" onclick="window.editEmployee('${emp.id}')" style="background:rgba(59,130,246,0.12); color:#2563eb; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:12px;">✏️</button>
              <button type="button" onclick="window.deleteEmployee('${emp.id}', '${escJs(emp.email || emp.name || '')}')" style="background:rgba(239,68,68,0.12); color:#dc2626; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:12px;">🗑️</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('') + `</div>`;

  const backupBody = `
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button type="button" class="btn btn-primary" onclick="window.downloadBackupJson()" style="margin-top:0; flex:1;">${esc(t('backupBtn'))}</button>
      <label class="btn btn-outline" style="margin-top:0; flex:1; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center;">
        ${esc(t('restoreBtn'))}
        <input type="file" id="restoreFileInput" accept="application/json,.json" onchange="window.restoreBackupJson(event)" style="display:none;">
      </label>
    </div>
  `;

  const passBody = `
    <label class="field-label" style="margin-top:0;">${esc(t('newPass'))}</label>
    <input type="password" id="newPassInput" placeholder="••••••">
    <label class="field-label">${esc(t('confirmPass'))}</label>
    <input type="password" id="confirmPassInput" placeholder="••••••">
    <label class="field-label">${esc(t('currPass'))}</label>
    <input type="password" id="currentPassInput" placeholder="Optional unless required">
    <button type="button" class="btn btn-primary" onclick="window.changeUserPassword()">${esc(t('changePassBtn'))}</button>
  `;

  const dangerBody = `
    <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.35); border-radius:8px; padding:14px;">
      <p style="font-size:12.5px; color:#dc2626; font-weight:600; margin-bottom:12px;">${esc(t('dangerDesc'))}</p>
      <button type="button" class="btn btn-danger" onclick="window.resetBusinessData()">${esc(t('dangerBtn'))}</button>
    </div>
  `;

  return `
    ${collapsibleCard('secSub', esc(t('subTitle')), subBody)}
    ${collapsibleCard('secSupport', esc(t('supportTitle')), supportBody)}
    ${collapsibleCard('secLang', esc(t('langTitle')), langBody)}
    ${collapsibleCard('secEmp', esc(t('empTitle')), empFormHtml + empListHtml)}
    ${collapsibleCard('secBackup', esc(t('backupTitle')), backupBody)}
    ${collapsibleCard('secPass', esc(t('passTitle')), passBody)}
    ${collapsibleCard('secDanger', esc(t('dangerTitle')), dangerBody)}
  `;
}

function renderSupportDetailsHtml() {
  const fromTenant = state.tenantData?.supportInfo || {};
  const phone = supportData.phone || fromTenant.phone || '';
  const telegram = supportData.telegram || fromTenant.telegram || '';
  const email = supportData.email || fromTenant.email || '';

  if (!phone && !telegram && !email) {
    return `<div style="color:var(--text-muted, #64748b);">${esc(t('noSupport'))}</div>`;
  }
  const tgClean = telegram.replace(/^@/, '');
  return `
    ${phone ? `<div>📞 <b>Phone:</b> <a href="tel:${esc(phone)}" style="color:var(--primary, #2563eb); font-weight:600;">${esc(phone)}</a></div>` : ''}
    ${telegram ? `<div>✈️ <b>Telegram:</b> <a href="https://t.me/${esc(tgClean)}" target="_blank" rel="noopener" style="color:var(--primary, #2563eb); font-weight:600;">${esc(telegram.startsWith('@') ? telegram : '@' + telegram)}</a></div>` : ''}
    ${email ? `<div>📧 <b>Email:</b> <a href="mailto:${esc(email)}" style="color:var(--primary, #2563eb); font-weight:600;">${esc(email)}</a></div>` : ''}
  `;
}

function processExistingSettingsCards() {
  const panel8 = document.getElementById('panel8');
  if (!panel8) return;

  const cards = Array.from(panel8.querySelectorAll(':scope > .card'));
  cards.forEach((card, idx) => {
    const titleEl = card.querySelector('.card-title');
    const rawTitle = (titleEl?.textContent || card.querySelector('button')?.textContent || '').toLowerCase();

    if (rawTitle.includes('theme') || card.querySelector('[onclick*="toggleDarkMode"]')) {
      card.style.display = 'none';
      return;
    }

    if (card.dataset.collapsibleBound === '1') return;
    card.dataset.collapsibleBound = '1';
    if (!titleEl) return;

    const titleHtml = titleEl.innerHTML;
    titleEl.remove();

    const bodyWrapper = document.createElement('div');
    const secKey = 'secExisting_' + idx;
    const isOpen = OPEN_SECTIONS.has(secKey);
    bodyWrapper.id = 'body_' + secKey;
    bodyWrapper.style.display = isOpen ? 'block' : 'none';
    bodyWrapper.style.padding = '0 20px 20px 20px';
    bodyWrapper.style.borderTop = '1px solid var(--border, #e2e8f0)';

    const inner = document.createElement('div');
    inner.style.paddingTop = '14px';
    while (card.firstChild) {
      inner.appendChild(card.firstChild);
    }
    bodyWrapper.appendChild(inner);

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.setAttribute('onclick', `window.toggleSettingSection('${secKey}')`);
    headerBtn.style.cssText = 'width:100%; display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:var(--card-bg, var(--card, transparent)); color:var(--text-main, var(--text, inherit)); border:none; text-align:left; font-size:15px; font-weight:700; cursor:pointer;';
    headerBtn.innerHTML = `<span>${titleHtml}</span><span id="chev_${secKey}" style="transition:transform 0.2s; transform:rotate(${isOpen ? '90deg' : '0deg'}); font-size:13px;">▶</span>`;

    card.style.padding = '0';
    card.style.overflow = 'hidden';
    card.appendChild(headerBtn);
    card.appendChild(bodyWrapper);
  });
}

export async function mountExtraSettings(appState) {
  const tenantId = appState?.tenantId || state.tenantId;
  state.language = appState?.tenantData?.language || state.language || 'am';

  await fetchPricingFromFirestore();
  processExistingSettingsCards();

  const panel8 = document.getElementById('panel8');
  if (panel8 && !document.getElementById(EXTRA_MOUNT_ID)) {
    const mountDiv = document.createElement('div');
    mountDiv.id = EXTRA_MOUNT_ID;
    mountDiv.innerHTML = renderExtraSettingsHtml();
    panel8.appendChild(mountDiv);
  } else {
    refreshExtraSettings();
  }

  window.toggleSettingSection = (secId) => {
    const body = document.getElementById('body_' + secId);
    const chev = document.getElementById('chev_' + secId);
    if (!body) return;
    const willOpen = body.style.display === 'none';
    body.style.display = willOpen ? 'block' : 'none';
    if (chev) chev.style.transform = willOpen ? 'rotate(90deg)' : 'rotate(0deg)';
    if (willOpen) OPEN_SECTIONS.add(secId);
    else OPEN_SECTIONS.delete(secId);
  };

  window.syncTenantPayReqPrice = () => {
    const cycle = document.getElementById('subReqCycle')?.value || 'monthly';
    const planKey = (state.tenantData?.plan || state.plan || 'basic').toLowerCase();
    const price = pricingConfig[planKey]?.[cycle] ?? 0;
    const amtEl = document.getElementById('subReqAmount');
    const expEl = document.getElementById('subReqExpiry');
    if (amtEl) amtEl.value = price;
    if (expEl) expEl.value = calcNextExpiry(cycle);
  };

  async function compressImageFile(file, maxWidth = 720, quality = 0.6) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) return resolve({ blob: file, dataUrl: '' });
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => resolve({ blob: blob || file, dataUrl }),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve({ blob: file, dataUrl: '' });
      img.src = ev.target.result;
    };
    reader.onerror = () => resolve({ blob: file, dataUrl: '' });
    reader.readAsDataURL(file);
  });
}

window.submitTenantPaymentRequest = async () => {
  if (!tenantId) return;
  const cycle = document.getElementById('subReqCycle')?.value || 'monthly';
  const planKey = (state.tenantData?.plan || state.plan || 'basic').toLowerCase();
  const amount = parseFloat(document.getElementById('subReqAmount')?.value) || (pricingConfig[planKey]?.[cycle] ?? 0);
  const requestedExpiryDate = document.getElementById('subReqExpiry')?.value || calcNextExpiry(cycle);
  const method = document.getElementById('subReqMethod')?.value || 'Telebirr';
  const note = document.getElementById('subReqNote')?.value.trim() || '';
  const proofFile = document.getElementById('subReqProofFile')?.files?.[0] || null;
  const btn = document.getElementById('subReqBtn');

  try {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading...'; }

    let screenshotUrl = '';
    if (proofFile) {
      const { blob, dataUrl } = await compressImageFile(proofFile);
      try {
        const storage = getStorage(auth.app);
        const safeName = `${Date.now()}_${(proofFile.name || 'proof.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '.jpg')}`;
        const storageRef = ref(storage, `paymentProofs/${tenantId}/${safeName}`);
        await Promise.race([
          (async () => {
            await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
            screenshotUrl = await getDownloadURL(storageRef);
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 8000))
        ]);
      } catch (storageErr) {
        console.warn('Storage fallback to compressed image:', storageErr);
        if (dataUrl && dataUrl.length < 750000) {
          screenshotUrl = dataUrl;
        }
      }
    }

    await addDoc(collection(db, 'billingRequests'), {
      tenantId,
      tenantName: state.tenantData?.name || tenantId,
      plan: planKey,
      cycle,
      amount,
      method,
      requestedExpiryDate,
      screenshotUrl,
      note,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    const noteEl = document.getElementById('subReqNote');
    if (noteEl) noteEl.value = '';
    const fileEl = document.getElementById('subReqProofFile');
    if (fileEl) fileEl.value = '';
    showToast('✅ የክፍያ ጥያቄ እና Screenshot ለ Admin ተልኳል');
  } catch (e) {
    console.error('Payment request error:', e);
    showToast('❌ ስህተት: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('sendPayReqBtn'); }
  }
};



  window.setAppLanguage = async (lang) => {
    state.language = lang;
    if (state.tenantData) state.tenantData.language = lang;
    if (tenantId) {
      try { await updateDoc(doc(db, 'tenants', tenantId), { language: lang }); } catch (e) {}
    }
    refreshExtraSettings();
    applyFullPageLanguage(lang);
    showToast(lang === 'am' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል' : 'Language switched to English');
  };

  window.saveEmployee = async () => {
    if ((state.role || 'employee').toLowerCase() !== 'owner') {
      return showToast('Owner ብቻ ሰራተኛ መጨመር/ማስተዳደር ይችላል', 'error');
    }
    const email = document.getElementById('empEmailInput')?.value.trim().toLowerCase();
    const tempPass = document.getElementById('empTempPassInput')?.value || '';
    const permissions = Array.from(document.querySelectorAll('.emp-perm-cb:checked')).map(cb => cb.value);
    const maxEmp = state.tenantData?.maxEmployees ?? 2;
    const btn = document.getElementById('saveEmpBtn');

    try {
      if (editingEmployeeId) {
        if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
        await updateDoc(doc(db, 'users', editingEmployeeId), { permissions });
        editingEmployeeId = null;
        showToast('✅ የሰራተኛ ፍቃድ ተሻሽሏል');
        refreshExtraSettings();
        return;
      }

      if (!email) return showToast('Employee Email ያስፈልጋል', 'error');
      if (tempPass.length < 6) return showToast('Temporary Password ቢያንስ 6 ፊደላት መሆን አለበት', 'error');
      if (employeesList.length >= maxEmp) {
        return showToast(t('empLimitReached', maxEmp), 'error');
      }

      if (btn) { btn.disabled = true; btn.textContent = '⏳ በመፍጠር ላይ...'; }

      const secondaryApp = initializeApp(firebaseConfig, 'EmpCreate-' + Date.now());
      const secAuth = getAuth(secondaryApp);
      let uid;
      try {
        const cred = await createUserWithEmailAndPassword(secAuth, email, tempPass);
        uid = cred.user.uid;
      } finally {
        await signOut(secAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }

      await setDoc(doc(db, 'users', uid), {
        email, role: 'employee', tenantId, permissions,
        active: true, isTempPassword: true, createdAt: serverTimestamp()
      });

      showToast('✅ ሰራተኛ ተፈጥሯል');
      refreshExtraSettings();
    } catch (e) {
      let msg = e.message;
      if (e.code === 'auth/email-already-in-use') msg = 'ይህ Email አስቀድሞ ተመዝግቧል';
      showToast('❌ ስህተት: ' + msg, 'error');
      if (btn) { btn.disabled = false; btn.textContent = editingEmployeeId ? t('updateEmpBtn') : t('createEmpBtn'); }
    }
  };

  window.toggleEmployeeActive = async (id, currentActive) => {
    if ((state.role || 'employee').toLowerCase() !== 'owner') return;
    try {
      await updateDoc(doc(db, 'users', id), { active: !currentActive });
      showToast(!currentActive ? '▶️ ሰራተኛ ነቅቷል' : '⏸️ ሰራተኛ ታግዷል');
    } catch (e) {
      showToast('❌ ስህተት: ' + e.message, 'error');
    }
  };

  window.editEmployee = (id) => {
    editingEmployeeId = id;
    OPEN_SECTIONS.add('secEmp');
    refreshExtraSettings();
  };

  window.cancelEditEmployee = () => {
    editingEmployeeId = null;
    refreshExtraSettings();
  };

  window.deleteEmployee = async (id, label) => {
    if ((state.role || 'employee').toLowerCase() !== 'owner') {
      return showToast('Owner ብቻ ማጥፋት ይችላል', 'error');
    }
    if (!confirm(`"${label}" ን ማጥፋት?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      if (editingEmployeeId === id) editingEmployeeId = null;
      showToast('✅ ሰራተኛ ተጠፍቷል');
    } catch (e) {
      showToast('❌ ስህተት: ' + e.message, 'error');
    }
  };

  window.downloadBackupJson = async () => {
    if (!tenantId) return;
    try {
      showToast('⏳ Backup በማዘጋጀት ላይ...', 'info');
      const cols = ['products', 'sales', 'expenses', 'payments', 'customers', 'branches'];
      const payload = {
        exportedAt: new Date().toISOString(),
        tenantId, businessType: state.businessType, data: {}
      };
      for (const colName of cols) {
        const snap = await getDocs(query(collection(db, colName), where('tenantId', '==', tenantId)));
        payload.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${tenantId}-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ Backup ወርዷል');
    } catch (e) {
      showToast('❌ Backup ስህተት: ' + e.message, 'error');
    }
  };

  window.restoreBackupJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !tenantId) return;
    if (!confirm('የተመረጠውን Backup ፋይል ወደ ሲስተሙ መመለስ ይፈልጋሉ?')) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const cols = parsed?.data || {};
      let restoredCount = 0;

      for (const [colName, rows] of Object.entries(cols)) {
        if (!Array.isArray(rows)) continue;
        for (const item of rows) {
          const copy = { ...item };
          const docId = copy.id;
          delete copy.id;
          copy.tenantId = tenantId;
          if (docId) await setDoc(doc(db, colName, docId), copy, { merge: true });
          else await addDoc(collection(db, colName), copy);
          restoredCount++;
        }
      }
      showToast(`✅ Restore ተጠናቋል (${restoredCount} records)`);
    } catch (e) {
      showToast('❌ Restore ስህተት: ' + e.message, 'error');
    }
  };

  window.changeUserPassword = async () => {
    const newPass = document.getElementById('newPassInput')?.value || '';
    const confirmPass = document.getElementById('confirmPassInput')?.value || '';
    const currPass = document.getElementById('currentPassInput')?.value || '';

    if (newPass.length < 6) return showToast('ፓስወርድ ቢያንስ 6 ፊደላት መሆን አለበት', 'error');
    if (newPass !== confirmPass) return showToast('ፓስወርዶቹ አይመሳሰሉም', 'error');
    if (!auth.currentUser) return showToast('ተጠቃሚ አልገባም', 'error');

    try {
      await updatePassword(auth.currentUser, newPass);
      document.getElementById('newPassInput').value = '';
      document.getElementById('confirmPassInput').value = '';
      document.getElementById('currentPassInput').value = '';
      showToast('✅ ፓስወርድ ተቀይሯል');
    } catch (e) {
      if (e.code === 'auth/requires-recent-login' && currPass && auth.currentUser.email) {
        try {
          const cred = EmailAuthProvider.credential(auth.currentUser.email, currPass);
          await reauthenticateWithCredential(auth.currentUser, cred);
          await updatePassword(auth.currentUser, newPass);
          document.getElementById('newPassInput').value = '';
          document.getElementById('confirmPassInput').value = '';
          document.getElementById('currentPassInput').value = '';
          showToast('✅ ፓስወርድ ተቀይሯል');
          return;
        } catch (reErr) {
          return showToast('❌ Re-auth ስህተት: ' + reErr.message, 'error');
        }
      }
      showToast('❌ ስህተት: ' + e.message, 'error');
    }
  };

  window.resetBusinessData = async () => {
    if (!tenantId) return;
    if (!confirm('🚨 ማስጠንቀቂያ: ሁሉም የንግዱ ዳታዎች (sales, expenses, payments, customers, products, ወዘተ) ሊሰረዙ ነው። መቀጠል ይፈልጋሉ?')) return;
    const typed = prompt('ለማረጋገጥ RESET ብለው ይጻፉ:');
    if (typed !== 'RESET') return showToast('ተሰርዟል (RESET አልተጻፈም)', 'warning');

    try {
      showToast('⏳ ዳታ በማጽዳት ላይ...', 'warning');
      const cols = ['products', 'sales', 'expenses', 'payments', 'customers', 'purchases', 'quickSales', 'fixedExpenses', 'creditPayments'];
      for (const colName of cols) {
        const snap = await getDocs(query(collection(db, colName), where('tenantId', '==', tenantId)));
        for (const d of snap.docs) await deleteDoc(doc(db, colName, d.id));
      }
      showToast('✅ የንግዱ ዳታ ሪሴት ተደርጓል');
    } catch (e) {
      showToast('❌ Reset ስህተት: ' + e.message, 'error');
    }
  };

  if (!unsubSupport) {
    unsubSupport = onSnapshot(doc(db, 'appSettings', 'support'), (snap) => {
      if (snap.exists()) {
        supportData = snap.data();
        const el = document.getElementById('supportInfoContent');
        if (el) el.innerHTML = renderSupportDetailsHtml();
      }
    }, () => {});
  }

  if (tenantId && !unsubTenant) {
    unsubTenant = onSnapshot(doc(db, 'tenants', tenantId), (snap) => {
      if (snap.exists()) {
        state.tenantData = snap.data();
        const el = document.getElementById('supportInfoContent');
        if (el) el.innerHTML = renderSupportDetailsHtml();
      }
    });
  }

  if (tenantId && !unsubEmployees) {
    unsubEmployees = onSnapshot(query(collection(db, 'users'), where('tenantId', '==', tenantId)), (snap) => {
      employeesList = [];
      snap.forEach(d => {
        const data = d.data();
        if ((data.role || '').toLowerCase() === 'employee') {
          employeesList.push({ id: d.id, ...data });
        }
      });
      employeesList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      refreshExtraSettings();
    });
  }

  applyFullPageLanguage(state.language);
}

export function refreshExtraSettings() {
  processExistingSettingsCards();
  const mount = document.getElementById(EXTRA_MOUNT_ID);
  if (mount) mount.innerHTML = renderExtraSettingsHtml();
  applyFullPageLanguage(getLang());
}

export function cleanupExtraSettings() {
  if (unsubSupport) { unsubSupport(); unsubSupport = null; }
  if (unsubTenant) { unsubTenant(); unsubTenant = null; }
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  document.getElementById(EXTRA_MOUNT_ID)?.remove();
  employeesList = [];
  editingEmployeeId = null;
  const fns = [
    'toggleSettingSection', 'syncTenantPayReqPrice', 'submitTenantPaymentRequest',
    'setAppLanguage', 'saveEmployee', 'toggleEmployeeActive', 'editEmployee',
    'cancelEditEmployee', 'deleteEmployee', 'downloadBackupJson', 'restoreBackupJson',
    'changeUserPassword', 'resetBusinessData'
  ];
  fns.forEach(fn => delete window[fn]);
}

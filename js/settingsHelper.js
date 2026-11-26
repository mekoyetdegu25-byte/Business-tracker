// js/settingsHelper.js
import { auth, db } from './firebase.js';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { state, esc, escJs, showToast, todayStr } from './core.js';

let unsubSupport = null;
let unsubEmployees = null;
let supportData = { phone: '', telegram: '', email: '' };
let employeesList = [];
let editingEmployeeId = null;

const OPEN_SECTIONS = new Set(['secSupport']);
const EXTRA_MOUNT_ID = 'extraSettingsSectionsMount';

const I18N = {
  am: {
    langTitle: '🌐 ቋንቋ (Language)',
    langLabel: 'የመተግበሪያ ቋንቋ ይምረጡ',
    supportTitle: '🛟 የድጋፍ መረጃ (Support Info)',
    noSupport: 'የድጋፍ መረጃ አልተቀመጠም',
    empTitle: '👥 ሰራተኞች አስተዳደር (Employee Management)',
    empName: 'የሰራተኛ ስም *',
    empPhone: 'ስልክ',
    empRole: 'ሚና (Role)',
    addEmpBtn: '➕ ሰራተኛ ጨምር',
    updateEmpBtn: '💾 ሰራተኛ አድስ',
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
    langTitle: '🌐 Language',
    langLabel: 'Select Application Language',
    supportTitle: '🛟 Support Info',
    noSupport: 'Support info is not set yet',
    empTitle: '👥 Employee Management',
    empName: 'Employee Name *',
    empPhone: 'Phone',
    empRole: 'Role',
    addEmpBtn: '➕ Add Employee',
    updateEmpBtn: '💾 Update Employee',
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

export function getLang() {
  return state.language || state.tenantData?.language || 'am';
}

export function t(key, ...args) {
  const lang = getLang();
  const val = I18N[lang]?.[key] ?? I18N.am[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
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

export function renderExtraSettingsHtml() {
  const lang = getLang();
  const isOwner = (state.role || 'employee').toLowerCase() === 'owner';
  const maxEmp = state.tenantData?.maxEmployees ?? 2;

  const supportBody = `
    <div id="supportInfoContent" style="font-size:13.5px; line-height:1.8;">
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

  const empFormHtml = isOwner ? `
    <div style="background:var(--bg, #f8fafc); padding:14px; border-radius:8px; border:1px solid var(--border, #e2e8f0); margin-bottom:14px;">
      <div style="font-size:12px; font-weight:700; color:var(--text-muted, #64748b); margin-bottom:10px;">
        📊 ${employeesList.length} / ${maxEmp} Employees
      </div>
      <label class="field-label" style="margin-top:0;">${esc(t('empName'))}</label>
      <input type="text" id="empNameInput" placeholder="Employee full name">
      <label class="field-label">${esc(t('empPhone'))}</label>
      <input type="text" id="empPhoneInput" placeholder="+251...">
      <label class="field-label">${esc(t('empRole'))}</label>
      <select id="empRoleInput">
        <option value="employee">👤 Employee</option>
        <option value="manager">🎯 Manager</option>
        <option value="cashier">🧾 Cashier</option>
      </select>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button type="button" class="btn btn-success" id="saveEmpBtn" onclick="window.saveEmployee()" style="margin-top:0;">
          ${editingEmployeeId ? esc(t('updateEmpBtn')) : esc(t('addEmpBtn'))}
        </button>
        ${editingEmployeeId ? `<button type="button" class="btn btn-outline" onclick="window.cancelEditEmployee()" style="margin-top:0; width:auto;">${esc(t('cancelBtn'))}</button>` : ''}
      </div>
    </div>
  ` : `<p style="font-size:12.5px; color:var(--text-muted, #64748b); margin-bottom:10px;">Owner ብቻ ሰራተኞችን ማስተዳደር ይችላል።</p>`;

  const empListHtml = employeesList.length === 0
    ? `<p style="font-size:13px; color:var(--text-muted, #64748b); text-align:center; padding:12px;">ምንም ሰራተኛ አልተመዘገበም</p>`
    : employeesList.map(emp => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--border, #e2e8f0); border-radius:8px; margin-bottom:8px; gap:8px;">
        <div>
          <div style="font-weight:700; font-size:13.5px;">👤 ${esc(emp.name)} <small style="font-weight:600; color:var(--text-muted, #64748b);">(${esc(emp.role || 'employee')})</small></div>
          <div style="font-size:12px; color:var(--text-muted, #64748b);">📞 ${esc(emp.phone || '-')}</div>
        </div>
        ${isOwner ? `
          <div style="display:flex; gap:6px;">
            <button type="button" onclick="window.editEmployee('${emp.id}')" style="background:rgba(59,130,246,0.12); color:#2563eb; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:12px;">✏️</button>
            <button type="button" onclick="window.deleteEmployee('${emp.id}', '${escJs(emp.name)}')" style="background:rgba(239,68,68,0.12); color:#dc2626; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:12px;">🗑️</button>
          </div>
        ` : ''}
      </div>
    `).join('');

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
    ${collapsibleCard('secSupport', esc(t('supportTitle')), supportBody)}
    ${collapsibleCard('secLang', esc(t('langTitle')), langBody)}
    ${collapsibleCard('secEmp', esc(t('empTitle')), empFormHtml + empListHtml)}
    ${collapsibleCard('secBackup', esc(t('backupTitle')), backupBody)}
    ${collapsibleCard('secPass', esc(t('passTitle')), passBody)}
    ${collapsibleCard('secDanger', esc(t('dangerTitle')), dangerBody)}
  `;
}

function renderSupportDetailsHtml() {
  const { phone, telegram, email } = supportData;
  if (!phone && !telegram && !email) {
    return `<div style="color:var(--text-muted, #64748b);">${esc(t('noSupport'))}</div>`;
  }
  const tgClean = (telegram || '').replace(/^@/, '');
  return `
    ${phone ? `<div>📞 <b>Phone:</b> <a href="tel:${esc(phone)}">${esc(phone)}</a></div>` : ''}
    ${telegram ? `<div>✈️ <b>Telegram:</b> <a href="https://t.me/${esc(tgClean)}" target="_blank" rel="noopener">${esc(telegram.startsWith('@') ? telegram : '@' + telegram)}</a></div>` : ''}
    ${email ? `<div>📧 <b>Email:</b> <a href="mailto:${esc(email)}">${esc(email)}</a></div>` : ''}
  `;
}

function makeExistingCardsCollapsible() {
  const panel8 = document.getElementById('panel8');
  if (!panel8) return;

  const cards = Array.from(panel8.querySelectorAll(':scope > .card'));
  cards.forEach((card, idx) => {
    if (card.dataset.collapsibleBound === '1') return;
    card.dataset.collapsibleBound = '1';

    const titleEl = card.querySelector('.card-title');
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

export function mountExtraSettings(appState) {
  const tenantId = appState?.tenantId || state.tenantId;
  state.language = appState?.tenantData?.language || state.tenantData?.language || 'am';

  makeExistingCardsCollapsible();

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

  window.setAppLanguage = async (lang) => {
    state.language = lang;
    if (state.tenantData) state.tenantData.language = lang;
    if (tenantId) {
      try { await updateDoc(doc(db, 'tenants', tenantId), { language: lang }); } catch (e) {}
    }
    refreshExtraSettings();
    showToast(lang === 'am' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል' : 'Language switched to English');
  };

  window.saveEmployee = async () => {
    if ((state.role || 'employee').toLowerCase() !== 'owner') {
      return showToast('Owner ብቻ ሰራተኛ መጨመር/ማስተዳደር ይችላል', 'error');
    }
    const name = document.getElementById('empNameInput')?.value.trim();
    const phone = document.getElementById('empPhoneInput')?.value.trim() || '';
    const role = document.getElementById('empRoleInput')?.value || 'employee';
    const maxEmp = state.tenantData?.maxEmployees ?? 2;

    if (!name) return showToast('የሰራተኛ ስም ያስፈልጋል', 'error');

    try {
      if (editingEmployeeId) {
        await updateDoc(doc(db, 'employees', editingEmployeeId), { name, phone, role });
        editingEmployeeId = null;
        showToast('✅ ሰራተኛ ተሻሽሏል');
      } else {
        if (employeesList.length >= maxEmp) {
          return showToast(t('empLimitReached', maxEmp), 'error');
        }
        await addDoc(collection(db, 'employees'), {
          tenantId, name, phone, role, active: true, createdAt: serverTimestamp()
        });
        showToast('✅ ሰራተኛ ተጨምሯል');
      }
      refreshExtraSettings();
    } catch (e) {
      showToast('❌ ስህተት: ' + e.message, 'error');
    }
  };

  window.editEmployee = (id) => {
    const emp = employeesList.find(x => x.id === id);
    if (!emp) return;
    editingEmployeeId = id;
    OPEN_SECTIONS.add('secEmp');
    refreshExtraSettings();
    const nameEl = document.getElementById('empNameInput');
    const phoneEl = document.getElementById('empPhoneInput');
    const roleEl = document.getElementById('empRoleInput');
    if (nameEl) nameEl.value = emp.name || '';
    if (phoneEl) phoneEl.value = emp.phone || '';
    if (roleEl) roleEl.value = emp.role || 'employee';
  };

  window.cancelEditEmployee = () => {
    editingEmployeeId = null;
    refreshExtraSettings();
  };

  window.deleteEmployee = async (id, name) => {
    if ((state.role || 'employee').toLowerCase() !== 'owner') {
      return showToast('Owner ብቻ ማጥፋት ይችላል', 'error');
    }
    if (!confirm(`"${name}" ን ማጥፋት?`)) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      if (editingEmployeeId === id) editingEmployeeId = null;
      showToast('✅ ተጠፍቷል');
    } catch (e) {
      showToast('❌ ስህተት: ' + e.message, 'error');
    }
  };

  window.downloadBackupJson = async () => {
    if (!tenantId) return;
    try {
      showToast('⏳ Backup በማዘጋጀት ላይ...', 'info');
      const cols = ['products', 'sales', 'expenses', 'payments', 'customers', 'branches', 'employees'];
      const payload = {
        exportedAt: new Date().toISOString(),
        tenantId,
        businessType: state.businessType,
        data: {}
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
          if (docId) {
            await setDoc(doc(db, colName, docId), copy, { merge: true });
          } else {
            await addDoc(collection(db, colName), copy);
          }
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
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      }
      showToast('✅ የንግዱ ዳታ ሪሴት ተደርጓል');
    } catch (e) {
      showToast('❌ Reset ስህተት: ' + e.message, 'error');
    }
  };

  if (!unsubSupport) {
    unsubSupport = onSnapshot(doc(db, 'appSettings', 'support'), (snap) => {
      supportData = snap.exists() ? snap.data() : { phone: '', telegram: '', email: '' };
      const el = document.getElementById('supportInfoContent');
      if (el) el.innerHTML = renderSupportDetailsHtml();
    });
  }

  if (tenantId && !unsubEmployees) {
    unsubEmployees = onSnapshot(query(collection(db, 'employees'), where('tenantId', '==', tenantId)), (snap) => {
      employeesList = [];
      snap.forEach(d => employeesList.push({ id: d.id, ...d.data() }));
      employeesList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      refreshExtraSettings();
    });
  }
}

export function refreshExtraSettings() {
  makeExistingCardsCollapsible();
  const mount = document.getElementById(EXTRA_MOUNT_ID);
  if (mount) mount.innerHTML = renderExtraSettingsHtml();
}

export function cleanupExtraSettings() {
  if (unsubSupport) { unsubSupport(); unsubSupport = null; }
  if (unsubEmployees) { unsubEmployees(); unsubEmployees = null; }
  document.getElementById(EXTRA_MOUNT_ID)?.remove();
  employeesList = [];
  editingEmployeeId = null;
  const fns = [
    'toggleSettingSection', 'setAppLanguage', 'saveEmployee', 'editEmployee',
    'cancelEditEmployee', 'deleteEmployee', 'downloadBackupJson', 'restoreBackupJson',
    'changeUserPassword', 'resetBusinessData'
  ];
  fns.forEach(fn => delete window[fn]);
}

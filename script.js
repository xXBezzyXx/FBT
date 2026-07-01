// Guaranteed global Settings helper
var appSettings = window.appSettings || { invoiceEmail: '' };

window.fillSettingsForm = function fillSettingsForm() {
  var emailInput = document.getElementById('settingInvoiceEmail');
  if (emailInput) {
    var settings = window.appSettings || appSettings || { invoiceEmail: '' };
    emailInput.value = settings.invoiceEmail || '';
  }
};

function fillSettingsForm() {
  return window.fillSettingsForm();
}


const LOGIN_USERNAME = 'Margaret';
const LOGIN_PASSWORD = 'Cahoon11';

function isLoggedIn() {
  return localStorage.getItem('invoiceMakerLoggedIn') === 'true';
}

function showLoginIfNeeded() {
  const loginScreen = document.getElementById('loginScreen');

  if (!isLoggedIn()) {
    if (loginScreen) loginScreen.classList.remove('hidden');
    document.body.classList.add('locked');
    return true;
  }

  if (loginScreen) loginScreen.classList.add('hidden');
  document.body.classList.remove('locked');
  return false;
}

function loginApp() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const error = document.getElementById('loginError');

  if (user === LOGIN_USERNAME && pass === LOGIN_PASSWORD) {
    localStorage.setItem('invoiceMakerLoggedIn', 'true');
    if (error) error.classList.add('hidden');
    showLoginIfNeeded();
    






loadAppData();
  } else {
    if (error) error.classList.remove('hidden');
  }
}

function logoutApp() {
  localStorage.removeItem('invoiceMakerLoggedIn');
  showLoginIfNeeded();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !isLoggedIn()) loginApp();
});



async function apiRequest(action, payload = {}) {
  if (!window.GOOGLE_SCRIPT_URL || !window.GOOGLE_SCRIPT_URL.includes('/exec')) {
    throw new Error('Missing GOOGLE_SCRIPT_URL in config.js');
  }

  const response = await fetch(window.GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('Bad response from Apps Script: ' + text.substring(0, 120));
  }

  if (!data.success) {
    throw new Error(data.error || 'Apps Script request failed');
  }

  return data.data;
}

function showLoading(message) {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div class="loadingBox" id="loadingMessage"></div>';
    document.body.appendChild(overlay);
  }

  document.getElementById('loadingMessage').innerText = message || 'Loading...';
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}



async function loadSettings() {
  try {
    showLoading('Loading settings...');
    const data = await apiRequest('getSettings');
    appSettings = data || { invoiceEmail: '' };
    window.appSettings = appSettings;
    window.appSettings = appSettings;
    fillSettingsForm();
  } catch (err) {
    alert('Could not load settings: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function saveSettings() {
  const emailInput = document.getElementById('settingInvoiceEmail');
  const invoiceEmail = emailInput ? emailInput.value.trim() : '';

  try {
    showLoading('Saving settings...');
    appSettings = await apiRequest('saveSettings', { invoiceEmail });
    window.appSettings = appSettings;
    window.appSettings = appSettings;
    fillSettingsForm();
    alert('Settings saved.');
  } catch (err) {
    alert('Could not save settings: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function viewInvoicePdfByNumber(invoiceNumber) {
  if (!invoiceNumber) {
    alert('No invoice selected.');
    return;
  }

  let popup = window.open('', '_blank');

  try {
    showLoading('Creating PDF...');
    const result = await apiRequest('generateInvoicePdf', { invoiceNumber });

    if (!result || !result.pdfUrl) {
      throw new Error('PDF URL was not returned.');
    }

    if (popup) {
      popup.location.href = result.pdfUrl;
    } else {
      window.location.href = result.pdfUrl;
    }
  } catch (err) {
    if (popup) popup.close();
    alert('Could not open PDF: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function viewCreatedInvoicePdf() {
  const invoiceNumber =
    currentCreatedInvoiceNumber ||
    (document.getElementById('createdNumber') ? document.getElementById('createdNumber').innerText : '');

  return viewInvoicePdfByNumber(invoiceNumber);
}

async function sendCreatedInvoiceEmail() {
  const invoiceNumber =
    currentCreatedInvoiceNumber ||
    (document.getElementById('createdNumber') ? document.getElementById('createdNumber').innerText : '');

  if (!invoiceNumber) {
    alert('No invoice selected.');
    return;
  }

  try {
    showLoading('Sending invoice...');
    const result = await apiRequest('sendInvoiceEmail', { invoiceNumber });
    alert('Invoice emailed to: ' + result.sentTo);
  } catch (err) {
    alert('Could not send invoice email: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function loadAppData() {
  try {
    showLoading('Loading invoices...');
    const data = await apiRequest('getAppData');

    customers = data.customers || [];
    jobTypes = data.jobTypes || [];
    invoices = data.invoices || [];
    invoiceCounter = data.nextInvoiceNumber || invoiceCounter;
    appSettings = data.settings || { invoiceEmail: '' };
    window.appSettings = appSettings;
    window.appSettings = appSettings;
    fillSettingsForm();

    renderInvoices();
    renderAllInvoices();
  } catch (err) {
    console.warn(err);
    alert('Could not connect to Google Script yet. Showing test data. Error: ' + err.message);
    renderInvoices();
    renderAllInvoices();
  } finally {
    hideLoading();
  }
}

let selectedCustomer = '';
let currentJobType = '';
let invoiceCounter = 1013;
let currentCreatedInvoiceNumber = '';
appSettings = window.appSettings || { invoiceEmail: '' };

let customers = [];
let jobTypes = ['Wash', 'Repair', 'Parts / Materials', 'Other'];

let invoices = [];

function money(value) {
  return '$' + Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateText) {
  const d = new Date(dateText + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderInvoices() {
  const grid = document.getElementById('invoiceGrid');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const recentInvoices = invoices.filter(inv => new Date(inv.date + 'T00:00:00') >= cutoff);

  if (!recentInvoices.length) {
    grid.innerHTML = `
      <div class="empty-state wide-empty">
        <div class="empty-icon">🧾</div>
        <h3>No Recent Invoices</h3>
        <p>Invoices from the last 14 days will show here.</p>
      </div>
    `;
    updateSummary();
    return;
  }

  grid.innerHTML = recentInvoices.map((inv) => {
    const index = invoices.findIndex(x => x.number === inv.number);
    return `
    <div class="invoice-card">
      <div class="invoice-number">#${inv.number}</div>
      <div class="invoice-date">${formatDate(inv.date)}</div>
      <div class="invoice-label">Total:</div>
      <div class="invoice-total">${money(inv.total)}</div>
      <div class="invoice-customer">${inv.customer}</div>
      <button class="${inv.paid ? 'paid-btn' : 'mark-btn'}" onclick="togglePaid(${index})">
        ${inv.paid ? 'Paid' : 'Mark as paid'}
      </button>
    </div>
  `;
  }).join('');

  updateSummary();
}

function renderAllInvoices() {
  const list = document.getElementById('allInvoiceList');
  const month = document.getElementById('filterMonth')?.value ?? '';
  const year = document.getElementById('filterYear')?.value ?? '';
  const exactDate = document.getElementById('filterDate')?.value ?? '';

  const filtered = invoices.filter(inv => {
    const d = new Date(inv.date + 'T00:00:00');

    if (exactDate && inv.date !== exactDate) return false;
    if (month !== '' && d.getMonth().toString() !== month) return false;
    if (year !== '' && d.getFullYear().toString() !== year) return false;

    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>No Invoices Found</h3>
        <p>Add invoices to the sheet or create one from the app.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map((inv, index) => `
    <div class="all-invoice-row clickable-invoice" onclick="viewInvoicePdfByNumber('${inv.number}')">
      <div class="all-top">
        <div>
          <div class="all-number">#${inv.number}</div>
          <div class="all-customer">${inv.customer}</div>
          <div class="all-date">${formatDate(inv.date)}</div>
          <span class="status-pill ${inv.paid ? 'status-paid' : 'status-unpaid'}">${inv.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div>
          <div class="all-total">${money(inv.total)}</div>
          <button class="pdf-btn" onclick="event.stopPropagation(); viewInvoicePdfByNumber('${inv.number}')">View PDF</button>
          <button class="${inv.paid ? 'paid-btn' : 'mark-btn'}" onclick="event.stopPropagation(); togglePaidFromAll('${inv.number}')">
            ${inv.paid ? 'Paid' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function clearFilters() {
  document.getElementById('filterMonth').value = '';
  document.getElementById('filterYear').value = '';
  document.getElementById('filterDate').value = '';
  renderAllInvoices();
}

function updateSummary() {
  const paid = invoices.filter(x => x.paid).reduce((sum, x) => sum + x.total, 0);
  const unpaid = invoices.filter(x => !x.paid).reduce((sum, x) => sum + x.total, 0);

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const lastSeven = invoices
    .filter(x => new Date(x.date + 'T00:00:00') >= sevenDaysAgo)
    .reduce((sum, x) => sum + x.total, 0);

  const thisMonth = invoices
    .filter(x => {
      const d = new Date(x.date + 'T00:00:00');
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((sum, x) => sum + x.total, 0);

  document.getElementById('totalPaid').innerText = money(paid);
  document.getElementById('totalUnpaid').innerText = '-' + money(unpaid);
  document.getElementById('lastSevenTotal').innerText = money(lastSeven);
  document.getElementById('thisMonthTotal').innerText = money(thisMonth);
}

async function togglePaid(index) {
  const inv = invoices[index];
  if (!inv) return;

  const oldStatus = inv.paid;
  inv.paid = !inv.paid;
  renderInvoices();
  renderAllInvoices();

  try {
    await apiRequest('updateInvoicePaid', { invoiceNumber: inv.number, paid: inv.paid });
  } catch (err) {
    inv.paid = oldStatus;
    renderInvoices();
    renderAllInvoices();
    alert('Could not update paid status: ' + err.message);
  }
}

async function togglePaidFromAll(invoiceNumber) {
  const inv = invoices.find(x => x.number === invoiceNumber);
  if (!inv) return;

  const oldStatus = inv.paid;
  inv.paid = !inv.paid;
  renderInvoices();
  renderAllInvoices();

  try {
    await apiRequest('updateInvoicePaid', { invoiceNumber: inv.number, paid: inv.paid });
  } catch (err) {
    inv.paid = oldStatus;
    renderInvoices();
    renderAllInvoices();
    alert('Could not update paid status: ' + err.message);
  }
}



function getDefaultRateForJobType(typeName) {
  const found = (jobTypes || []).find(j => {
    const name = typeof j === 'string' ? j : (j.name || j.jobType || '');
    return String(name).toLowerCase() === String(typeName || '').toLowerCase();
  });

  if (!found || typeof found === 'string') return 0;
  return Number(found.defaultRate || 0);
}

function getJobTypeIcon(type) {
  const text = String(type || '').toLowerCase();
  if (text.includes('wash')) return '💧';
  if (text.includes('ship')) return '🚢';
  if (text.includes('repair')) return '🔧';
  if (text.includes('pick')) return '🏗️';
  if (text.includes('part')) return '📦';
  if (text.includes('material')) return '📦';
  return '🧾';
}

function renderJobTypes() {
  const list = document.getElementById('jobTypeList');
  if (!list) return;

  const activeTypes = (jobTypes || [])
    .filter(j => String(j.active).toLowerCase() !== 'false')
    .filter(j => j.name || j.jobType || typeof j === 'string');

  if (!activeTypes.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <h3>No Job Types Found</h3>
        <p>Add job types to the JobTypes sheet.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = activeTypes.map(j => {
    const name = typeof j === 'string' ? j : (j.name || j.jobType || '');
    const description = typeof j === 'string' ? '' : (j.description || '');
    const icon = typeof j === 'string' ? getJobTypeIcon(j) : (j.icon || getJobTypeIcon(name));
    const safeName = String(name).replace(/'/g, "\\'");
    return `
      <button class="job-type-card" onclick="openForm('${safeName}')">
        <div class="job-icon">${icon}</div>
        <div>
          <div class="job-title">${name}</div>
          <div class="job-subtitle">${description || 'Create invoice work for this job type.'}</div>
        </div>
        <div class="arrow">›</div>
      </button>
    `;
  }).join('');
}

function renderCustomers() {
  const customerList = document.getElementById('customerList');

  let html = '';

  if (!customers.length) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <h3>No Customers Yet</h3>
        <p>Add customer names to the Customers sheet or use Custom / One-Off Job.</p>
      </div>
    `;
  } else {
    html += customers.map(name => `
      <button class="row-card" onclick="selectCustomer('${name.replace(/'/g, "\'")}')">
        <span>${name}</span>
        <span class="arrow">›</span>
      </button>
    `).join('');
  }

  html += `
    <button class="row-card custom-row" onclick="customCustomer()">
      <span>＋ Custom / One-Off Job</span>
    </button>
  `;

  customerList.innerHTML = html;
}

function startInvoice() {
  renderCustomers();
  showPage('customers');
}

function selectCustomer(name) {
  selectedCustomer = name;
  openForm('Repair');
}

function customCustomer() {
  const name = prompt('Customer name:');
  if (!name) return;

  selectedCustomer = name;
  openForm('Repair');
}

function openForm(type) {
  currentJobType = type || 'Repair';

  document.getElementById('formCustomer').value = selectedCustomer || 'Custom Customer';
  document.getElementById('billingCompany').value = selectedCustomer || '';
  document.getElementById('billingName').value = '';
  document.getElementById('billingAddress').value = '';
  document.getElementById('billingCity').value = '';
  document.getElementById('billingState').value = '';
  document.getElementById('billingZip').value = '';
  document.getElementById('shipField').classList.toggle('hidden', type !== 'Ship Work');

  document.getElementById('referenceNumber').value = '';
  document.getElementById('jobLocation').value = '';
  document.getElementById('workPerformed').value = '';
  document.getElementById('hours').value = 1;
  document.getElementById('rate').value = type === 'Ship Work' ? 150 : 100;
  document.getElementById('materials').value = 0;
  document.getElementById('notes').value = '';

  calculateTotal();
  showPage('invoiceForm');
  document.getElementById('pageTitle').innerText = 'Invoice Maker';
}

function calculateTotal() {
  const hours = Number(document.getElementById('hours').value || 0);
  const rate = Number(document.getElementById('rate').value || 0);
  const materials = Number(document.getElementById('materials').value || 0);
  const total = (hours * rate) + materials;

  document.getElementById('totalAmount').value = total.toFixed(2);
}

async function createInvoice() {
  const total = Number(document.getElementById('totalAmount').value || 0);
  const customer = document.getElementById('formCustomer').value || selectedCustomer || 'Custom Customer';

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const inv = {
    number: 'INV-' + invoiceCounter,
    customer,
    billingCompany: document.getElementById('billingCompany').value || customer,
    billingName: document.getElementById('billingName').value || '',
    billingAddress: document.getElementById('billingAddress').value || '',
    billingCity: document.getElementById('billingCity').value || '',
    billingState: document.getElementById('billingState').value || '',
    billingZip: document.getElementById('billingZip').value || '',
    referenceNumber: document.getElementById('referenceNumber').value || '',
    jobType: currentJobType,
    vessel: document.getElementById('vesselName') ? document.getElementById('vesselName').value : '',
    location: document.getElementById('jobLocation').value || '',
    workPerformed: document.getElementById('workPerformed').value || '',
    hours: Number(document.getElementById('hours').value || 0),
    rate: Number(document.getElementById('rate').value || 0),
    materials: Number(document.getElementById('materials').value || 0),
    total,
    paid: false,
    date: isoDate,
    notes: document.getElementById('notes').value || ''
  };

  try {
    showLoading('Saving invoice...');
    const saved = await apiRequest('saveInvoice', inv);

    invoices.unshift(saved);
    invoiceCounter++;

    currentCreatedInvoiceNumber = saved.number;
    document.getElementById('createdNumber').innerText = saved.number;
    document.getElementById('createdCustomer').innerText = saved.customer;
    document.getElementById('createdTotal').innerText = money(saved.total);
    document.getElementById('createdStatus').innerText = saved.paid ? 'Paid' : 'Unpaid';

    renderInvoices();
    renderAllInvoices();
    showPage('created');
  } catch (err) {
    alert('Could not save invoice: ' + err.message);
  } finally {
    hideLoading();
  }
}

async function markLastPaid() {
  if (invoices.length > 0) {
    const inv = invoices[0];
    const oldStatus = inv.paid;
    inv.paid = true;

    try {
      await apiRequest('updateInvoicePaid', { invoiceNumber: inv.number, paid: true });
    } catch (err) {
      inv.paid = oldStatus;
      alert('Could not update paid status: ' + err.message);
    }
  }

  renderInvoices();
  renderAllInvoices();
  showPage('dashboard');
}


function goBack() {
  const activePage = document.querySelector('.page.active');
  const activeId = activePage ? activePage.id : '';

  if (activeId === 'invoiceForm') {
    renderCustomers();
    showPage('customers');
    return;
  }

  if (activeId === 'customers') {
    showPage('dashboard');
    return;
  }

  if (activeId === 'created') {
    showPage('dashboard');
    return;
  }

  if (activeId === 'allInvoices' || activeId === 'settings') {
    showPage('dashboard');
    return;
  }

  showPage('dashboard');
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.getElementById(pageId).classList.add('active');

  const titles = {
    dashboard: 'Invoice Maker',
    allInvoices: 'All Invoices',
    customers: 'Select Customer',
    
    invoiceForm: 'Invoice Maker',
    created: 'Invoice Created',
    settings: 'Settings'
  };

  document.getElementById('pageTitle').innerText = titles[pageId] || 'Invoice Maker';

  document.getElementById('backBtn').classList.toggle('hidden', pageId === 'dashboard' || pageId === 'allInvoices' || pageId === 'settings');
  document.getElementById('topIcon').classList.toggle('hidden', pageId !== 'dashboard');

  document.getElementById('fab').style.display = pageId === 'dashboard' ? 'block' : 'none';
  document.getElementById('bottomNav').style.display =
    (pageId === 'dashboard' || pageId === 'settings' || pageId === 'allInvoices') ? 'flex' : 'none';

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  if (pageId === 'allInvoices') navItems[1].classList.add('active');
  else if (pageId === 'settings') navItems[2].classList.add('active');
  else navItems[0].classList.add('active');

  if (pageId === 'allInvoices') renderAllInvoices();
  if (pageId === 'settings') fillSettingsForm();
}











showLoginIfNeeded();
if (isLoggedIn()) loadAppData();



// ===== Multi Job / VIN / Time / Qty + Hours System =====
function escapeAttr(value){return String(value||'').replace(/"/g,'&quot;');}
function escapeHtmlText(value){return String(value||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function buildJobTypeOptions(selected) {
  return (jobTypes || ['Wash', 'Repair', 'Parts / Materials', 'Other'])
    .map(type => `<option value="${escapeAttr(type)}" ${type === selected ? 'selected' : ''}>${type}</option>`)
    .join('');
}


/* =========================================================
   TIME TO LABOR HOURS FIX
   If Start Time and End Time are entered, Labor Hours updates
   from the clock time unless the user manually overrides hours.
   ========================================================= */

function decimalHoursFromTimes(start, end) {
  if (!start || !end) return 0;

  const startParts = String(start).split(':').map(Number);
  const endParts = String(end).split(':').map(Number);

  if (startParts.length < 2 || endParts.length < 2) return 0;

  let startMinutes = (startParts[0] * 60) + startParts[1];
  let endMinutes = (endParts[0] * 60) + endParts[1];

  // Handles overnight work, example 10:40 PM to 2:40 AM.
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const diff = (endMinutes - startMinutes) / 60;
  return Math.round(diff * 100) / 100;
}

function updateJobHoursFromTime(block, forceUpdate) {
  if (!block) return;

  const startInput = block.querySelector('.start-time');
  const endInput = block.querySelector('.end-time');
  const hoursInput = block.querySelector('.job-hours');

  if (!startInput || !endInput || !hoursInput) return;

  const calculatedHours = decimalHoursFromTimes(startInput.value, endInput.value);

  if (calculatedHours <= 0) return;

  const manualOverride = hoursInput.dataset.manualOverride === 'true';

  // Force update when time fields change. Otherwise update only if user has not manually overridden.
  if (forceUpdate || !manualOverride) {
    hoursInput.value = calculatedHours;
    hoursInput.dataset.autoCalculated = 'true';
  }
}

function handleTimeChange(input) {
  const block = input.closest('.job-block');
  if (!block) return;

  updateJobHoursFromTime(block, true);
  calculateInvoiceTotal();
}

function handleHoursManualEdit(input) {
  input.dataset.manualOverride = 'true';
  calculateInvoiceTotal();
}

function prepareTimeAutoCalcFields(block) {
  if (!block) return;

  const startInput = block.querySelector('.start-time');
  const endInput = block.querySelector('.end-time');
  const hoursInput = block.querySelector('.job-hours');

  if (startInput) startInput.setAttribute('onchange', 'handleTimeChange(this)');
  if (endInput) endInput.setAttribute('onchange', 'handleTimeChange(this)');
  if (hoursInput) {
    hoursInput.setAttribute('oninput', 'handleHoursManualEdit(this)');
    hoursInput.dataset.manualOverride = 'false';
  }
}

function addJob(data={}){const list=document.getElementById('jobsList');if(!list)return;const idx=list.children.length+1;const div=document.createElement('div');div.className='job-block';div.innerHTML=`<div class="job-block-head"><span>Job / Machine ${idx}</span><button class="job-remove-btn" onclick="removeJob(this)">Remove</button></div><div class="job-block-body"><div class="field"><label>Job Type</label><select class="job-type" onchange="jobTypeChanged(this);calculateInvoiceTotal();"><option value="Wash">Wash</option><option value="Repair">Repair</option><option value="Parts">Parts / Materials</option><option value="Other">Other</option></select></div><div class="field"><label>Equipment / Machine</label><input class="equipment-name" type="text" placeholder="Excavator, loader, dozer, etc." value="${escapeAttr(data.equipment||'')}" oninput="calculateInvoiceTotal()"></div><div class="field"><label>VIN / Serial Number</label><input class="vin-number" type="text" placeholder="VIN / SN" value="${escapeAttr(data.vin||'')}" oninput="calculateInvoiceTotal()"></div><div class="two-col"><div class="field"><label>Start Time</label><input class="start-time" type="time" value="${escapeAttr(data.startTime||'')}" onchange="calculateInvoiceTotal()"></div><div class="field"><label>End Time</label><input class="end-time" type="time" value="${escapeAttr(data.endTime||'')}" onchange="calculateInvoiceTotal()"></div></div><div class="job-help">Wash jobs can be billed by equipment/quantity. Repair jobs can use both quantity and labor hours.</div><div class="two-col"><div class="field"><label>Qty / Equipment Count</label><input class="job-qty" type="number" value="${data.qty??1}" min="0" step="0.01" oninput="calculateInvoiceTotal()"></div><div class="field"><label>Qty Rate</label><input class="job-qty-rate" type="number" value="${data.qtyRate??0}" min="0" step="0.01" oninput="calculateInvoiceTotal()"></div></div><div class="two-col"><div class="field"><label>Labor Hours</label><input class="job-hours" type="number" value="${data.hours??0}" min="0" step="0.01" oninput="calculateInvoiceTotal()"></div><div class="field"><label>Hourly Rate</label><input class="job-hour-rate" type="number" value="${data.hourRate??0}" min="0" step="0.01" oninput="calculateInvoiceTotal()"></div></div><div class="field"><label>Parts / Materials</label><input class="job-materials" type="number" value="${data.materials??0}" min="0" step="0.01" oninput="calculateInvoiceTotal()"></div><div class="field"><label>Work Description</label><textarea class="job-description" placeholder="Describe wash, repairs, parts, findings, etc." oninput="calculateInvoiceTotal()">${escapeHtmlText(data.description||'')}</textarea></div><div class="job-total-pill"><span>Job Total</span><span class="job-total">$0.00</span></div></div>`;list.appendChild(div);
  prepareTimeAutoCalcFields(div);div.querySelector('.job-type').value=data.jobType||currentJobType||'Wash';jobTypeChanged(div.querySelector('.job-type'),true);calculateInvoiceTotal();}
function removeJob(btn){const b=btn.closest('.job-block');if(b)b.remove();renumberJobs();calculateInvoiceTotal();}
function renumberJobs(){document.querySelectorAll('.job-block').forEach((b,i)=>{const t=b.querySelector('.job-block-head span');if(t)t.innerText='Job / Machine '+(i+1);});}
function jobTypeChanged(sel,skip=false){const b=sel.closest('.job-block');if(!b)return;const type=sel.value,qty=b.querySelector('.job-qty'),qr=b.querySelector('.job-qty-rate'),hrs=b.querySelector('.job-hours'),hr=b.querySelector('.job-hour-rate');if(type==='Wash'){if(!qty.value||Number(qty.value)===0)qty.value=1;if(!hrs.value)hrs.value=0;if(!hr.value)hr.value=0;}if(type==='Repair'){if(!hrs.value||Number(hrs.value)===0)hrs.value=1;if(!hr.value||Number(hr.value)===0)hr.value=150;}if(!skip)calculateInvoiceTotal();}
function calculateTimeHours(start,end){if(!start||!end)return 0;const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);if(isNaN(sh)||isNaN(eh))return 0;let s=sh*60+(sm||0),e=eh*60+(em||0);if(e<s)e+=1440;return Math.round(((e-s)/60)*100)/100;}
function collectJobs(){return [...document.querySelectorAll('.job-block')].map(b=>{const start=b.querySelector('.start-time').value||'',end=b.querySelector('.end-time').value||'',timeHours=calculateTimeHours(start,end);let hours=Number(b.querySelector('.job-hours').value||0);if(timeHours>0&&hours===0){hours=timeHours;b.querySelector('.job-hours').value=hours;}const qty=Number(b.querySelector('.job-qty').value||0),qtyRate=Number(b.querySelector('.job-qty-rate').value||0),hourRate=Number(b.querySelector('.job-hour-rate').value||0),materials=Number(b.querySelector('.job-materials').value||0);return{jobType:b.querySelector('.job-type').value||'',equipment:b.querySelector('.equipment-name').value||'',vin:b.querySelector('.vin-number').value||'',startTime:start,endTime:end,timeHours,qty,qtyRate,qtyAmount:qty*qtyRate,hours,hourRate,laborAmount:hours*hourRate,materials,description:b.querySelector('.job-description').value||'',total:(qty*qtyRate)+(hours*hourRate)+materials};});}
function calculateInvoiceTotal(){let total=0;const jobs=collectJobs();jobs.forEach((j,i)=>{total+=Number(j.total||0);const el=document.querySelectorAll('.job-total')[i];if(el)el.innerText=money(j.total);});const ti=document.getElementById('totalAmount');if(ti)ti.value=total.toFixed(2);return total;}
function calculateTotal(){calculateInvoiceTotal();}
function openForm(type){currentJobType=type;document.getElementById('formCustomer').value=selectedCustomer||'Custom Customer';document.getElementById('billingCompany').value=selectedCustomer||'';document.getElementById('billingName').value='';document.getElementById('billingAddress').value='';document.getElementById('billingCity').value='';document.getElementById('billingState').value='';document.getElementById('billingZip').value='';document.getElementById('notes').value='';document.getElementById('jobsList').innerHTML='';if(type==='Washing'){addJob({jobType:'Wash',qty:1,qtyRate:0,hours:0,hourRate:0,materials:0,description:'Equipment wash'});}else{addJob({jobType:'Repair',qty:0,qtyRate:0,hours:1,hourRate:150,materials:0,description:'Repair work'});}showPage('invoiceForm');}
async function createInvoice(){const jobs=collectJobs();const total=calculateInvoiceTotal();const customer=document.getElementById('formCustomer').value||selectedCustomer||'Custom Customer';const isoDate=new Date().toISOString().slice(0,10);const inv={number:'INV-'+invoiceCounter,customer,billingCompany:document.getElementById('billingCompany').value||customer,billingName:document.getElementById('billingName').value||'',billingAddress:document.getElementById('billingAddress').value||'',billingCity:document.getElementById('billingCity').value||'',billingState:document.getElementById('billingState').value||'',billingZip:document.getElementById('billingZip').value||'',referenceNumber:jobs.map(j=>[j.equipment,j.vin?'VIN/SN: '+j.vin:''].filter(Boolean).join(' | ')).filter(Boolean).join(' / '),jobType:jobs.map(j=>j.jobType).filter(Boolean).join(' + ')||currentJobType,vessel:'',location:'',workPerformed:jobs.map(j=>{const p=[];if(j.equipment)p.push('Equipment: '+j.equipment);if(j.vin)p.push('VIN/SN: '+j.vin);if(j.startTime||j.endTime)p.push('Time: '+(j.startTime||'')+' - '+(j.endTime||''));if(j.description)p.push(j.description);return p.join('\n');}).join('\n\n'),hours:jobs.reduce((s,j)=>s+Number(j.hours||0),0),rate:jobs[0]?.hourRate||0,materials:jobs.reduce((s,j)=>s+Number(j.materials||0),0),total,paid:false,date:isoDate,notes:document.getElementById('notes').value||'',jobs};try{showLoading('Saving invoice...');const saved=await apiRequest('saveInvoice',inv);invoices.unshift(saved);invoiceCounter++;currentCreatedInvoiceNumber=saved.number;document.getElementById('createdNumber').innerText=saved.number;document.getElementById('createdCustomer').innerText=saved.customer;document.getElementById('createdTotal').innerText=money(saved.total);document.getElementById('createdStatus').innerText=saved.paid?'Paid':'Unpaid';renderInvoices();renderAllInvoices();showPage('created');}catch(err){alert('Could not save invoice: '+err.message);}finally{hideLoading();}}

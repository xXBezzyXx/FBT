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
    customerDetails = data.customerDetails || {};
    equipmentList = data.equipment || [];
    equipmentDetails = data.equipmentDetails || {};
    renderEquipmentOptions();
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
let customerDetails = {};
let equipmentList = [];
let equipmentDetails = {};

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





function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}







function getSelectedCustomerDetail() {
  const name = selectedCustomer || '';
  return customerDetails[name] || {};
}


function renderEquipmentOptions() {
  const select = document.getElementById('referenceNumber');
  if (!select) return;

  const current = select.value || '';
  select.innerHTML = '<option value="">Select equipment</option>' + (equipmentList || [])
    .map(item => `<option value="${escapeAttr(item)}">${escapeAttr(item)}</option>`)
    .join('');

  if (current) select.value = current;
}

async function addNewEquipment() {
  const equipment = prompt('Enter new equipment name:');

  if (!equipment) return;

  try {
    showLoading('Saving equipment...');
    const saved = await apiRequest('saveEquipment', { equipmentName: equipment });

    const value = saved.equipmentName || equipment;

    if (!equipmentList.includes(value)) {
      equipmentList.push(value);
    }

    renderEquipmentOptions();

    const select = document.getElementById('referenceNumber');
    if (select) select.value = value;

    if (typeof updatePreview === 'function') updatePreview();
  } catch (err) {
    alert('Could not save equipment: ' + err.message);
  } finally {
    hideLoading();
  }
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
  showPage('jobType');
}

function customCustomer() {
  const name = prompt('Customer name:');
  if (!name) return;

  selectedCustomer = name;
  showPage('jobType');
}

function openForm(type) {
  currentJobType = type;
  const selectedDetail = getSelectedCustomerDetail();

  document.getElementById('formCustomer').value = selectedCustomer || 'Custom Customer';
  document.getElementById('billingCompany').value = selectedDetail.billingCompany || selectedCustomer || '';
  document.getElementById('billingName').value = selectedDetail.contactName || selectedDetail.billingContactName || '';
  document.getElementById('billingAddress').value = selectedDetail.billingAddress || '';
  document.getElementById('billingCity').value = selectedDetail.billingCity || '';
  document.getElementById('billingState').value = selectedDetail.billingState || '';
  document.getElementById('billingZip').value = selectedDetail.billingZip || '';
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

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.getElementById(pageId).classList.add('active');

  const titles = {
    dashboard: 'Invoice Maker',
    allInvoices: 'All Invoices',
    customers: 'Select Customer',
    jobType: 'Select Job Type',
    invoiceForm: currentJobType || 'Invoice Details',
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
  if (pageId === 'invoiceForm') renderEquipmentOptions();
}

function goBack() {
  const active = document.querySelector('.page.active').id;

  if (active === 'customers') showPage('dashboard');
  else if (active === 'jobType') showPage('customers');
  else if (active === 'invoiceForm') showPage('jobType');
  else if (active === 'created') showPage('dashboard');
  else showPage('dashboard');
}









showLoginIfNeeded();
if (isLoggedIn()) loadAppData();

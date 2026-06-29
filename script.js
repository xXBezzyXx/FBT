
async function apiRequest(action, payload = {}) {
  if (!window.GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.includes('/exec')) {
    throw new Error('Missing GOOGLE_SCRIPT_URL in config.js');
  }

  const response = await fetch(GOOGLE_SCRIPT_URL, {
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

async function loadAppData() {
  try {
    showLoading('Loading invoices...');
    const data = await apiRequest('getAppData');

    customers = data.customers || [];
    invoices = data.invoices || [];
    invoiceCounter = data.nextInvoiceNumber || invoiceCounter;

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

let customers = [];

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
    <div class="all-invoice-row">
      <div class="all-top">
        <div>
          <div class="all-number">#${inv.number}</div>
          <div class="all-customer">${inv.customer}</div>
          <div class="all-date">${formatDate(inv.date)}</div>
          <span class="status-pill ${inv.paid ? 'status-paid' : 'status-unpaid'}">${inv.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div>
          <div class="all-total">${money(inv.total)}</div>
          <button class="${inv.paid ? 'paid-btn' : 'mark-btn'}" onclick="togglePaidFromAll('${inv.number}')">
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

  document.getElementById('formCustomer').value = selectedCustomer || 'Custom Customer';
  document.getElementById('shipField').classList.toggle('hidden', type !== 'Ship Work');

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
}

function goBack() {
  const active = document.querySelector('.page.active').id;

  if (active === 'customers') showPage('dashboard');
  else if (active === 'jobType') showPage('customers');
  else if (active === 'invoiceForm') showPage('jobType');
  else if (active === 'created') showPage('dashboard');
  else showPage('dashboard');
}

loadAppData();

// Invoice Maker frontend - clean multi-job version

const LOGIN_USERNAME = 'Margaret';
const LOGIN_PASSWORD = 'Cahoon11';

var selectedCustomer = '';
var currentJobType = 'Repair';
var invoiceCounter = 1013;
var currentCreatedInvoiceNumber = '';
var appSettings = { invoiceEmail: '' };
var customers = [];
var invoices = [];
var jobTypes = [];

/* -----------------------------
   LOGIN
----------------------------- */
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
  const user = document.getElementById('loginUser') ? document.getElementById('loginUser').value.trim() : '';
  const pass = document.getElementById('loginPass') ? document.getElementById('loginPass').value : '';
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

/* -----------------------------
   API / LOADING
----------------------------- */
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

  if (!data.success) throw new Error(data.error || 'Apps Script request failed');

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

  const msg = document.getElementById('loadingMessage');
  if (msg) msg.innerText = message || 'Loading...';
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

/* -----------------------------
   SETTINGS
----------------------------- */
function fillSettingsForm() {
  const emailInput = document.getElementById('settingInvoiceEmail');
  if (emailInput) emailInput.value = (appSettings && appSettings.invoiceEmail) || '';
}

async function loadSettings() {
  try {
    showLoading('Loading settings...');
    appSettings = await apiRequest('getSettings') || { invoiceEmail: '' };
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
    fillSettingsForm();
    alert('Settings saved.');
  } catch (err) {
    alert('Could not save settings: ' + err.message);
  } finally {
    hideLoading();
  }
}

/* -----------------------------
   APP DATA
----------------------------- */
async function loadAppData() {
  try {
    showLoading('Loading invoices...');
    const data = await apiRequest('getAppData');

    customers = data.customers || [];
    invoices = data.invoices || [];
    jobTypes = Array.isArray(data.jobTypes) ? data.jobTypes : [];
    invoiceCounter = data.nextInvoiceNumber || invoiceCounter;
    appSettings = data.settings || { invoiceEmail: '' };

    fillSettingsForm();
    renderInvoices();
    renderAllInvoices();
  } catch (err) {
    console.warn(err);
    alert('Could not connect to Google Script yet. Showing test data. Error: ' + err.message);
    customers = customers || [];
    invoices = invoices || [];
    renderInvoices();
    renderAllInvoices();
  } finally {
    hideLoading();
  }
}

async function testJobTypes() {
  try {
    showLoading('Testing Job Types...');
    const data = await apiRequest('getJobTypes');
    jobTypes = Array.isArray(data) ? data : [];

    alert(
      'Job Types loaded: ' + jobTypes.length + '\n\n' +
      jobTypes.map(function(j) {
        return j.name + ' | Hourly: ' + j.hourlyRate + ' | Qty: ' + j.qtyRate;
      }).join('\n')
    );
  } catch (err) {
    alert('Job Types test failed: ' + err.message);
  } finally {
    hideLoading();
  }
}

/* -----------------------------
   FORMATTERS
----------------------------- */
function money(value) {
  return '$' + Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateText) {
  if (!dateText) return '';
  const d = new Date(dateText + 'T00:00:00');
  if (isNaN(d)) return dateText;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeAttr(value) {
  return String(value || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* -----------------------------
   DASHBOARD / INVOICES
----------------------------- */
function renderInvoices() {
  const grid = document.getElementById('invoiceGrid');
  if (!grid) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const recentInvoices = invoices.filter(inv => {
    const d = new Date((inv.date || '') + 'T00:00:00');
    return !isNaN(d) && d >= cutoff;
  });

  if (!recentInvoices.length) {
    grid.innerHTML = `
      <div class="empty-state wide-empty">
        <div class="empty-icon">🧾</div>
        <h3>No Recent Invoices</h3>
        <p>Invoices from the last 14 days will show here.</p>
      </div>`;
    updateSummary();
    return;
  }

  grid.innerHTML = recentInvoices.map(inv => {
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
      </div>`;
  }).join('');

  updateSummary();
}

function renderAllInvoices() {
  const list = document.getElementById('allInvoiceList');
  if (!list) return;

  const month = document.getElementById('filterMonth')?.value ?? '';
  const year = document.getElementById('filterYear')?.value ?? '';
  const exactDate = document.getElementById('filterDate')?.value ?? '';

  const filtered = invoices.filter(inv => {
    const d = new Date((inv.date || '') + 'T00:00:00');

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
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(inv => `
    <div class="all-invoice-row clickable-invoice" onclick="viewInvoicePdfByNumber('${escapeAttr(inv.number)}')">
      <div class="all-top">
        <div>
          <div class="all-number">#${inv.number}</div>
          <div class="all-customer">${inv.customer}</div>
          <div class="all-date">${formatDate(inv.date)}</div>
          <span class="status-pill ${inv.paid ? 'status-paid' : 'status-unpaid'}">${inv.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div>
          <div class="all-total">${money(inv.total)}</div>
          <button class="pdf-btn" onclick="event.stopPropagation(); viewInvoicePdfByNumber('${escapeAttr(inv.number)}')">View PDF</button>
          <button class="${inv.paid ? 'paid-btn' : 'mark-btn'}" onclick="event.stopPropagation(); togglePaidFromAll('${escapeAttr(inv.number)}')">
            ${inv.paid ? 'Paid' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>`).join('');
}

function clearFilters() {
  const month = document.getElementById('filterMonth');
  const year = document.getElementById('filterYear');
  const date = document.getElementById('filterDate');

  if (month) month.value = '';
  if (year) year.value = '';
  if (date) date.value = '';

  renderAllInvoices();
}

function updateSummary() {
  const paid = invoices.filter(x => x.paid).reduce((sum, x) => sum + Number(x.total || 0), 0);
  const unpaid = invoices.filter(x => !x.paid).reduce((sum, x) => sum + Number(x.total || 0), 0);

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const lastSeven = invoices
    .filter(x => new Date((x.date || '') + 'T00:00:00') >= sevenDaysAgo)
    .reduce((sum, x) => sum + Number(x.total || 0), 0);

  const thisMonth = invoices
    .filter(x => {
      const d = new Date((x.date || '') + 'T00:00:00');
      return !isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    })
    .reduce((sum, x) => sum + Number(x.total || 0), 0);

  const totalPaid = document.getElementById('totalPaid');
  const totalUnpaid = document.getElementById('totalUnpaid');
  const lastSevenTotal = document.getElementById('lastSevenTotal');
  const thisMonthTotal = document.getElementById('thisMonthTotal');

  if (totalPaid) totalPaid.innerText = money(paid);
  if (totalUnpaid) totalUnpaid.innerText = '-' + money(unpaid);
  if (lastSevenTotal) lastSevenTotal.innerText = money(lastSeven);
  if (thisMonthTotal) thisMonthTotal.innerText = money(thisMonth);
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

/* -----------------------------
   CUSTOMERS
----------------------------- */
function renderCustomers() {
  const customerList = document.getElementById('customerList');
  if (!customerList) return;

  let html = '';

  if (!customers.length) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <h3>No Customers Yet</h3>
        <p>Add customer names to the Customers sheet or use Custom / One-Off Job.</p>
      </div>`;
  } else {
    html += customers.map(name => `
      <button class="row-card" onclick="selectCustomer('${String(name).replace(/'/g, "\\'")}')">
        <span>${name}</span>
        <span class="arrow">›</span>
      </button>`).join('');
  }

  html += `
    <button class="row-card custom-row" onclick="customCustomer()">
      <span>＋ Custom / One-Off Job</span>
    </button>`;

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

/* -----------------------------
   JOB TYPES / JOB BLOCKS
----------------------------- */
function buildJobTypeOptions(selected) {
  const list = Array.isArray(jobTypes) ? jobTypes : [];

  if (!list.length) {
    return '<option value="Wash">Wash</option><option value="Repair">Repair</option><option value="Parts / Materials">Parts / Materials</option><option value="Other">Other</option>';
  }

  return list.map(function(job) {
    const name = job.name || job.jobType || '';
    if (!name) return '';
    const selectedText = String(name).toLowerCase() === String(selected || '').toLowerCase() ? 'selected' : '';
    return '<option value="' + escapeAttr(name) + '" ' + selectedText + '>' + name + '</option>';
  }).join('');
}

function getJobTypeDefaults(typeName) {
  const found = (jobTypes || []).find(function(job) {
    const name = job.name || job.jobType || '';
    return String(name).toLowerCase() === String(typeName || '').toLowerCase();
  });

  if (!found) return { description: '', hourlyRate: 0, qtyRate: 0, defaultRate: 0 };

  return {
    description: found.description || '',
    hourlyRate: Number(found.hourlyRate || 0),
    qtyRate: Number(found.qtyRate || 0),
    defaultRate: Number(found.defaultRate || found.hourlyRate || found.qtyRate || 0)
  };
}

function decimalHoursFromTimes(start, end) {
  if (!start || !end) return 0;

  const startParts = String(start).split(':').map(Number);
  const endParts = String(end).split(':').map(Number);

  if (startParts.length < 2 || endParts.length < 2) return 0;

  let startMinutes = (startParts[0] * 60) + startParts[1];
  let endMinutes = (endParts[0] * 60) + endParts[1];

  if (endMinutes < startMinutes) endMinutes += 24 * 60;

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

  if (forceUpdate || !manualOverride) {
    hoursInput.value = calculatedHours;
    hoursInput.dataset.autoCalculated = 'true';
  }
}

function handleTimeChange(input) {
  const block = input.closest('.job-block');
  if (!block) return;

  const hoursInput = block.querySelector('.job-hours');
  if (hoursInput) hoursInput.dataset.manualOverride = 'false';

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

function addJob(data = {}) {
  const list = document.getElementById('jobsList');
  if (!list) return;

  const idx = list.children.length + 1;
  const div = document.createElement('div');
  div.className = 'job-block';

  const selectedType = data.jobType || currentJobType || 'Repair';

  div.innerHTML = `
    <div class="job-block-head">
      <span>Job / Machine ${idx}</span>
      <button class="job-remove-btn" onclick="removeJob(this)">Remove</button>
    </div>
    <div class="job-block-body">
      <div class="field">
        <label>Job Type</label>
        <select class="job-type" onchange="jobTypeChanged(this); calculateInvoiceTotal();">
          ${buildJobTypeOptions(selectedType)}
        </select>
      </div>

      <div class="field">
        <label>Equipment / Machine</label>
        <input class="equipment-name" type="text" placeholder="Excavator, loader, dozer, etc." value="${escapeAttr(data.equipment || '')}" oninput="calculateInvoiceTotal()">
      </div>

      <div class="field">
        <label>VIN / Serial Number</label>
        <input class="vin-number" type="text" placeholder="VIN / SN" value="${escapeAttr(data.vin || '')}" oninput="calculateInvoiceTotal()">
      </div>

      <div class="two-col">
        <div class="field">
          <label>Start Time</label>
          <input class="start-time" type="time" value="${escapeAttr(data.startTime || '')}" onchange="handleTimeChange(this)">
        </div>
        <div class="field">
          <label>End Time</label>
          <input class="end-time" type="time" value="${escapeAttr(data.endTime || '')}" onchange="handleTimeChange(this)">
        </div>
      </div>

      <div class="job-help">Wash jobs can be billed by equipment/quantity. Repair jobs can use both quantity and labor hours.</div>

      <div class="two-col">
        <div class="field">
          <label>Qty / Equipment Count</label>
          <input class="job-qty" type="number" value="${data.qty ?? 1}" min="0" step="0.01" oninput="calculateInvoiceTotal()">
        </div>
        <div class="field">
          <label>Qty Rate</label>
          <input class="job-qty-rate" type="number" value="${data.qtyRate ?? 0}" min="0" step="0.01" oninput="calculateInvoiceTotal()">
        </div>
      </div>

      <div class="two-col">
        <div class="field">
          <label>Labor Hours</label>
          <input class="job-hours" type="number" value="${data.hours ?? 0}" min="0" step="0.01" oninput="handleHoursManualEdit(this)">
        </div>
        <div class="field">
          <label>Hourly Rate</label>
          <input class="job-hour-rate" type="number" value="${data.hourRate ?? 0}" min="0" step="0.01" oninput="calculateInvoiceTotal()">
        </div>
      </div>

      <div class="field">
        <label>Parts / Materials</label>
        <input class="job-materials" type="number" value="${data.materials ?? 0}" min="0" step="0.01" oninput="calculateInvoiceTotal()">
      </div>

      <div class="field">
        <label>Work Description</label>
        <textarea class="job-description" placeholder="Describe wash, repairs, parts, findings, etc." oninput="calculateInvoiceTotal()">${escapeHtmlText(data.description || '')}</textarea>
      </div>

      <div class="job-total-pill">
        <span>Job Total</span>
        <span class="job-total">$0.00</span>
      </div>
    </div>`;

  list.appendChild(div);
  prepareTimeAutoCalcFields(div);

  const typeSelect = div.querySelector('.job-type');
  typeSelect.value = selectedType;
  jobTypeChanged(typeSelect, true);

  calculateInvoiceTotal();
}

function removeJob(btn) {
  const block = btn.closest('.job-block');
  if (block) block.remove();
  renumberJobs();
  calculateInvoiceTotal();
}

function renumberJobs() {
  document.querySelectorAll('.job-block').forEach(function(block, i) {
    const title = block.querySelector('.job-block-head span');
    if (title) title.innerText = 'Job / Machine ' + (i + 1);
  });
}

function jobTypeChanged(sel, skip = false) {
  const block = sel.closest('.job-block');
  if (!block) return;

  const type = sel.value;
  const defaults = getJobTypeDefaults(type);

  const qty = block.querySelector('.job-qty');
  const qtyRate = block.querySelector('.job-qty-rate');
  const hours = block.querySelector('.job-hours');
  const hourRate = block.querySelector('.job-hour-rate');
  const desc = block.querySelector('.job-description');

  if (defaults.description && desc && !desc.value) desc.value = defaults.description;
  if (defaults.hourlyRate && hourRate && (!hourRate.value || Number(hourRate.value) === 0)) hourRate.value = defaults.hourlyRate;
  if (defaults.qtyRate && qtyRate && (!qtyRate.value || Number(qtyRate.value) === 0)) qtyRate.value = defaults.qtyRate;

  const typeText = String(type || '').toLowerCase();

  if (typeText.includes('wash')) {
    if (qty && (!qty.value || Number(qty.value) === 0)) qty.value = 1;
    if (hours && (!hours.value || Number(hours.value) === 0)) hours.value = 0;
  } else {
    if (hours && (!hours.value || Number(hours.value) === 0)) hours.value = 1;
  }

  if (!skip) calculateInvoiceTotal();
}

function collectJobs() {
  return Array.from(document.querySelectorAll('.job-block')).map(function(block) {
    const start = block.querySelector('.start-time').value || '';
    const end = block.querySelector('.end-time').value || '';
    const timeHours = decimalHoursFromTimes(start, end);

    const hoursInput = block.querySelector('.job-hours');
    let hours = Number(hoursInput.value || 0);

    if (timeHours > 0 && hoursInput.dataset.manualOverride !== 'true') {
      hours = timeHours;
      hoursInput.value = hours;
    }

    const qty = Number(block.querySelector('.job-qty').value || 0);
    const qtyRate = Number(block.querySelector('.job-qty-rate').value || 0);
    const hourRate = Number(block.querySelector('.job-hour-rate').value || 0);
    const materials = Number(block.querySelector('.job-materials').value || 0);

    return {
      jobType: block.querySelector('.job-type').value || '',
      equipment: block.querySelector('.equipment-name').value || '',
      vin: block.querySelector('.vin-number').value || '',
      startTime: start,
      endTime: end,
      timeHours,
      qty,
      qtyRate,
      qtyAmount: qty * qtyRate,
      hours,
      hourRate,
      laborAmount: hours * hourRate,
      materials,
      description: block.querySelector('.job-description').value || '',
      total: (qty * qtyRate) + (hours * hourRate) + materials
    };
  });
}

function calculateInvoiceTotal() {
  let total = 0;
  const jobs = collectJobs();

  jobs.forEach(function(job, i) {
    total += Number(job.total || 0);
    const el = document.querySelectorAll('.job-total')[i];
    if (el) el.innerText = money(job.total);
  });

  const totalInput = document.getElementById('totalAmount');
  if (totalInput) totalInput.value = total.toFixed(2);

  return total;
}

function calculateTotal() {
  return calculateInvoiceTotal();
}

/* -----------------------------
   INVOICE FORM / CREATE
----------------------------- */
function openForm(type) {
  currentJobType = type || 'Repair';

  const formCustomer = document.getElementById('formCustomer');
  const billingCompany = document.getElementById('billingCompany');
  const billingName = document.getElementById('billingName');
  const billingAddress = document.getElementById('billingAddress');
  const billingCity = document.getElementById('billingCity');
  const billingState = document.getElementById('billingState');
  const billingZip = document.getElementById('billingZip');
  const notes = document.getElementById('notes');
  const totalAmount = document.getElementById('totalAmount');

  if (formCustomer) formCustomer.value = selectedCustomer || 'Custom Customer';
  if (billingCompany) billingCompany.value = selectedCustomer || '';
  if (billingName) billingName.value = '';
  if (billingAddress) billingAddress.value = '';
  if (billingCity) billingCity.value = '';
  if (billingState) billingState.value = '';
  if (billingZip) billingZip.value = '';
  if (notes) notes.value = '';
  if (totalAmount) totalAmount.value = '0.00';

  const jobsList = document.getElementById('jobsList');
  if (jobsList) jobsList.innerHTML = '';

  addJob({ jobType: currentJobType });

  calculateInvoiceTotal();
  showPage('invoiceForm');
  document.getElementById('pageTitle').innerText = 'Invoice Maker';
}

async function createInvoice() {
  const total = calculateInvoiceTotal();
  const customer = document.getElementById('formCustomer').value || selectedCustomer || 'Custom Customer';
  const jobs = collectJobs();

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const firstJob = jobs[0] || {};

  const inv = {
    number: 'INV-' + invoiceCounter,
    customer,
    billingCompany: document.getElementById('billingCompany').value || customer,
    billingName: document.getElementById('billingName').value || '',
    billingAddress: document.getElementById('billingAddress').value || '',
    billingCity: document.getElementById('billingCity').value || '',
    billingState: document.getElementById('billingState').value || '',
    billingZip: document.getElementById('billingZip').value || '',
    referenceNumber: firstJob.equipment || firstJob.vin || '',
    jobType: firstJob.jobType || currentJobType,
    vessel: '',
    location: '',
    workPerformed: jobs.map(j => [j.jobType, j.equipment, j.vin, j.description].filter(Boolean).join(' | ')).join('\n'),
    hours: jobs.reduce((sum, j) => sum + Number(j.hours || 0), 0),
    rate: Number(firstJob.hourRate || 0),
    materials: jobs.reduce((sum, j) => sum + Number(j.materials || 0), 0),
    total,
    paid: false,
    date: isoDate,
    notes: document.getElementById('notes').value || '',
    jobs
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
  const inv = currentCreatedInvoiceNumber
    ? invoices.find(x => x.number === currentCreatedInvoiceNumber)
    : invoices[0];

  if (!inv) {
    showPage('dashboard');
    return;
  }

  const oldStatus = inv.paid;
  inv.paid = true;

  try {
    await apiRequest('updateInvoicePaid', { invoiceNumber: inv.number, paid: true });
  } catch (err) {
    inv.paid = oldStatus;
    alert('Could not update paid status: ' + err.message);
  }

  renderInvoices();
  renderAllInvoices();
  showPage('dashboard');
}

/* -----------------------------
   PDF / EMAIL
----------------------------- */
async function viewInvoicePdfByNumber(invoiceNumber) {
  if (!invoiceNumber) {
    alert('No invoice selected.');
    return;
  }

  const popup = window.open('', '_blank');

  try {
    showLoading('Creating PDF...');
    const result = await apiRequest('generateInvoicePdf', { invoiceNumber });

    if (!result || !result.pdfUrl) throw new Error('PDF URL was not returned.');

    if (popup) popup.location.href = result.pdfUrl;
    else window.location.href = result.pdfUrl;
  } catch (err) {
    if (popup) popup.close();
    alert('Could not open PDF: ' + err.message);
  } finally {
    hideLoading();
  }
}

function viewCreatedInvoicePdf() {
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

/* -----------------------------
   NAVIGATION
----------------------------- */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));

  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  const titles = {
    dashboard: 'Invoice Maker',
    allInvoices: 'All Invoices',
    customers: 'Select Customer',
    invoiceForm: 'Invoice Maker',
    created: 'Invoice Created',
    settings: 'Settings'
  };

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.innerText = titles[pageId] || 'Invoice Maker';

  const backBtn = document.getElementById('backBtn');
  const topIcon = document.getElementById('topIcon');
  const fab = document.getElementById('fab');
  const bottomNav = document.getElementById('bottomNav');

  if (backBtn) backBtn.classList.toggle('hidden', pageId === 'dashboard' || pageId === 'allInvoices' || pageId === 'settings');
  if (topIcon) topIcon.classList.toggle('hidden', pageId !== 'dashboard');
  if (fab) fab.style.display = pageId === 'dashboard' ? 'block' : 'none';
  if (bottomNav) bottomNav.style.display = (pageId === 'dashboard' || pageId === 'settings' || pageId === 'allInvoices') ? 'flex' : 'none';

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  if (pageId === 'settings' && navItems[1]) navItems[1].classList.add('active');
  else if (navItems[0]) navItems[0].classList.add('active');

  if (pageId === 'allInvoices') renderAllInvoices();
  if (pageId === 'settings') fillSettingsForm();
}

function goBack() {
  const activePage = document.querySelector('.page.active');
  const active = activePage ? activePage.id : '';

  if (active === 'customers') {
    showPage('dashboard');
  } else if (active === 'invoiceForm') {
    renderCustomers();
    showPage('customers');
  } else if (active === 'created') {
    showPage('dashboard');
  } else {
    showPage('dashboard');
  }
}

/* -----------------------------
   STARTUP
----------------------------- */
showLoginIfNeeded();
if (isLoggedIn()) loadAppData();

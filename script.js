let selectedCustomer = '';
let currentJobType = '';
let invoiceCounter = 1013;

const customers = [
  'Emy Watson',
  'Nate O’Brien',
  'Jane Cook',
  'John Doe',
  'ABC Marine'
];

let invoices = [
  { number: 'INV-1012', customer: 'ABC Marine', total: 650, paid: false, date: '2026-06-28' },
  { number: 'INV-1011', customer: 'Port Authority', total: 1250, paid: true, date: '2026-06-24' },
  { number: 'INV-1010', customer: 'Emy Watson', total: 1332, paid: false, date: '2026-06-20' },
  { number: 'INV-1009', customer: 'Nate O’Brien', total: 844, paid: true, date: '2026-06-13' },
  { number: 'INV-1008', customer: 'Jane Cook', total: 1161, paid: true, date: '2026-05-29' },
  { number: 'INV-1007', customer: 'John Doe', total: 1589, paid: false, date: '2026-05-18' },
  { number: 'INV-1006', customer: 'ABC Marine', total: 720, paid: true, date: '2026-04-22' },
  { number: 'INV-1005', customer: 'Port Authority', total: 975, paid: false, date: '2026-04-10' },
  { number: 'INV-1004', customer: 'Emy Watson', total: 410, paid: true, date: '2025-12-12' },
  { number: 'INV-1003', customer: 'Nate O’Brien', total: 300, paid: false, date: '2025-11-05' },
  { number: 'INV-1002', customer: 'Jane Cook', total: 1120, paid: true, date: '2025-08-21' },
  { number: 'INV-1001', customer: 'John Doe', total: 540, paid: true, date: '2025-07-16' }
];

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

  grid.innerHTML = invoices.map((inv, index) => `
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
  `).join('');

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
    list.innerHTML = '<div class="settings-card"><h2>No invoices found</h2><p>Try clearing the filters.</p></div>';
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

function togglePaid(index) {
  invoices[index].paid = !invoices[index].paid;
  renderInvoices();
  renderAllInvoices();
}

function togglePaidFromAll(invoiceNumber) {
  const inv = invoices.find(x => x.number === invoiceNumber);
  if (inv) inv.paid = !inv.paid;
  renderInvoices();
  renderAllInvoices();
}

function renderCustomers() {
  const customerList = document.getElementById('customerList');

  customerList.innerHTML = customers.map(name => `
    <button class="row-card" onclick="selectCustomer('${name.replace(/'/g, "\\'")}')">
      <span>${name}</span>
      <span class="arrow">›</span>
    </button>
  `).join('') + `
    <button class="row-card custom-row" onclick="customCustomer()">
      <span>＋ Custom / One-Off Job</span>
    </button>
  `;
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

function createInvoice() {
  const total = Number(document.getElementById('totalAmount').value || 0);
  const customer = document.getElementById('formCustomer').value || selectedCustomer || 'Custom Customer';

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const inv = {
    number: 'INV-' + invoiceCounter,
    customer,
    total,
    paid: false,
    date: isoDate
  };

  invoiceCounter++;
  invoices.unshift(inv);

  document.getElementById('createdNumber').innerText = inv.number;
  document.getElementById('createdCustomer').innerText = inv.customer;
  document.getElementById('createdTotal').innerText = money(inv.total);
  document.getElementById('createdStatus').innerText = 'Unpaid';

  renderInvoices();
  renderAllInvoices();
  showPage('created');
}

function markLastPaid() {
  if (invoices.length > 0) {
    invoices[0].paid = true;
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

renderInvoices();
renderAllInvoices();

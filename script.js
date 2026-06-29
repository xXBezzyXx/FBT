let selectedCustomer = '';
let currentJobType = '';
let invoiceCounter = 1005;

const customers = [
  'Emy Watson',
  'Nate O’Brien',
  'Jane Cook',
  'John Doe',
  'ABC Marine'
];

let invoices = [
  { number: 'INV-1004', customer: 'Emy Watson', total: 1332, paid: false },
  { number: 'INV-1003', customer: 'Nate O’Brien', total: 844, paid: true },
  { number: 'INV-1002', customer: 'Jane Cook', total: 1161, paid: true },
  { number: 'INV-1001', customer: 'John Doe', total: 1589, paid: false }
];

function money(value) {
  return '$' + Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderInvoices() {
  const grid = document.getElementById('invoiceGrid');

  grid.innerHTML = invoices.map((inv, index) => `
    <div class="invoice-card">
      <div class="invoice-number">#${inv.number}</div>
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

function updateSummary() {
  const paid = invoices.filter(x => x.paid).reduce((sum, x) => sum + x.total, 0);
  const unpaid = invoices.filter(x => !x.paid).reduce((sum, x) => sum + x.total, 0);

  document.getElementById('totalPaid').innerText = money(paid);
  document.getElementById('totalUnpaid').innerText = '-' + money(unpaid);
}

function togglePaid(index) {
  invoices[index].paid = !invoices[index].paid;
  renderInvoices();
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

  const inv = {
    number: 'INV-' + invoiceCounter,
    customer,
    total,
    paid: false
  };

  invoiceCounter++;
  invoices.unshift(inv);

  document.getElementById('createdNumber').innerText = inv.number;
  document.getElementById('createdCustomer').innerText = inv.customer;
  document.getElementById('createdTotal').innerText = money(inv.total);
  document.getElementById('createdStatus').innerText = 'Unpaid';

  renderInvoices();
  showPage('created');
}

function markLastPaid() {
  if (invoices.length > 0) {
    invoices[0].paid = true;
  }

  renderInvoices();
  showPage('dashboard');
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  document.getElementById(pageId).classList.add('active');

  const titles = {
    dashboard: 'Invoice Maker',
    customers: 'Select Customer',
    jobType: 'Select Job Type',
    invoiceForm: currentJobType || 'Invoice Details',
    created: 'Invoice Created',
    settings: 'Settings'
  };

  document.getElementById('pageTitle').innerText = titles[pageId] || 'Invoice Maker';

  document.getElementById('backBtn').classList.toggle('hidden', pageId === 'dashboard');
  document.getElementById('topIcon').classList.toggle('hidden', pageId !== 'dashboard');

  document.getElementById('fab').style.display = pageId === 'dashboard' ? 'block' : 'none';
  document.getElementById('bottomNav').style.display =
    (pageId === 'dashboard' || pageId === 'settings') ? 'flex' : 'none';

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  if (pageId === 'settings') {
    navItems[1].classList.add('active');
  } else {
    navItems[0].classList.add('active');
  }
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

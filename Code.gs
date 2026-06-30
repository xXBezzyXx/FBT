// Invoice Maker Backend - Google Apps Script
// Deploy as Web App.
// Execute as: Me
// Who has access: Anyone

const SPREADSHEET_ID_OR_URL = '';
const SHEET_CUSTOMERS = 'Customers';
const SHEET_INVOICES = 'Invoices';
const SHEET_SETTINGS = 'Settings';
const SHEET_EQUIPMENT = 'Equipment';
const PDF_FOLDER_NAME = 'Invoice Maker PDFs';

function doGet(e) {
  return json_({ success: true, message: 'Invoice Maker backend is running.' });
}

function doPost(e) {
  try {
    setupSheets();

    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const payload = body.payload || {};
    let data;

    if (action === 'getAppData') {
      data = getAppData();
    } else if (action === 'saveInvoice') {
      data = saveInvoice(payload);
    } else if (action === 'updateInvoicePaid') {
      data = updateInvoicePaid(payload.invoiceNumber, payload.paid);
    } else if (action === 'generateInvoicePdf') {
      data = generateInvoicePdf(payload.invoiceNumber);
    } else if (action === 'getSettings') {
      data = getSettings();
    } else if (action === 'saveSettings') {
      data = saveSettings(payload);
    } else if (action === 'sendInvoiceEmail') {
      data = sendInvoiceEmail(payload.invoiceNumber);
    } else if (action === 'saveEquipment') {
      data = saveEquipment(payload);
    } else {
      throw new Error('Unknown action: ' + action);
    }

    return json_({ success: true, data });
  } catch (err) {
    return json_({ success: false, error: err.message });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  const id = extractSpreadsheetId_(SPREADSHEET_ID_OR_URL);
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('No spreadsheet connected. Bind this script to the Google Sheet or paste the Sheet ID into SPREADSHEET_ID_OR_URL.');
  return active;
}

function extractSpreadsheetId_(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : text;
}

function setupSheets() {
  const ss = getSpreadsheet_();

  let customers = ss.getSheetByName(SHEET_CUSTOMERS);
  if (!customers) customers = ss.insertSheet(SHEET_CUSTOMERS);
  if (customers.getLastRow() === 0) {
    customers.getRange(1, 1, 1, 9).setValues([['Customer Name', 'Billing Company', 'Contact Name', 'Email', 'Phone', 'Billing Address', 'City', 'State', 'Zip']]);
  }

  let invoices = ss.getSheetByName(SHEET_INVOICES);
  if (!invoices) invoices = ss.insertSheet(SHEET_INVOICES);

  const headers = [
    'Invoice #', 'Date', 'Customer', 'Job Type', 'Vessel', 'Location', 'Work Performed',
    'Hours', 'Rate', 'Materials', 'Total', 'Paid', 'Notes', 'Created At', 'Updated At',
    'PDF URL', 'PDF Created At', 'Billing Company', 'Billing Contact Name', 'Billing Address',
    'Billing City', 'Billing State', 'Billing Zip', 'Reference / Equipment'
  ];

  if (invoices.getLastRow() === 0) {
    invoices.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = invoices.getRange(1, 1, 1, Math.max(invoices.getLastColumn(), 1)).getValues()[0];
    headers.forEach((h, i) => {
      if (!existing[i]) invoices.getRange(1, i + 1).setValue(h);
    });
  }

  let settings = ss.getSheetByName(SHEET_SETTINGS);
  if (!settings) settings = ss.insertSheet(SHEET_SETTINGS);
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 1, 2).setValues([['Setting', 'Value']]);
    settings.getRange(2, 1, 1, 2).setValues([['Invoice Email', '']]);
  }

  
  let equipment = ss.getSheetByName(SHEET_EQUIPMENT);
  if (!equipment) equipment = ss.insertSheet(SHEET_EQUIPMENT);
  if (equipment.getLastRow() === 0) {
    equipment.getRange(1, 1, 1, 4).setValues([['Equipment Name', 'Hours', 'Rate', 'Notes']]);
  }

  customers.autoResizeColumns(1, 9);
  invoices.autoResizeColumns(1, 24);
  settings.autoResizeColumns(1, 2);
  equipment.autoResizeColumns(1, 4);
}

function getAppData() {
  setupSheets();
  return {
    customers: getCustomers(),
    customerDetails: getCustomerDetails(),
    equipment: getEquipment(),
    equipmentDetails: getEquipmentDetails(),
    invoices: getInvoices(),
    nextInvoiceNumber: getNextInvoiceNumber_(),
    settings: getSettings()
  };
}

function getCustomers() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CUSTOMERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    .map(v => String(v || '').trim())
    .filter(Boolean);
}






function getCustomerDetails() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CUSTOMERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 9)).getValues();
  const details = {};

  values.forEach(r => {
    const customerName = String(r[0] || '').trim();
    if (!customerName) return;

    details[customerName] = {
      customerName: customerName,
      billingCompany: String(r[1] || customerName).trim(),
      contactName: String(r[2] || '').trim(),
      billingContactName: String(r[2] || '').trim(),
      email: String(r[3] || '').trim(),
      phone: String(r[4] || '').trim(),
      billingAddress: String(r[5] || '').trim(),
      billingCity: String(r[6] || '').trim(),
      billingState: String(r[7] || '').trim(),
      billingZip: String(r[8] || '').trim()
    };
  });

  return details;
}










function getEquipment() {
  const details = getEquipmentDetails();
  return Object.keys(details);
}

function getEquipmentDetails() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_EQUIPMENT);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 4)).getValues();
  const details = {};

  values.forEach(r => {
    const name = String(r[0] || '').trim();
    if (!name) return;

    details[name] = {
      equipmentName: name,
      hours: Number(r[1] || 0),
      rate: Number(r[2] || 0),
      notes: String(r[3] || '').trim()
    };
  });

  return details;
}

function saveEquipment(payload) {
  setupSheets();

  const equipmentName = String(
    (payload && payload.equipmentName) ||
    (payload && payload.equipment) ||
    payload ||
    ''
  ).trim();

  if (!equipmentName) throw new Error('Equipment Name is blank.');

  const hours = Number((payload && payload.hours) || 0);
  const rate = Number((payload && payload.rate) || 0);

  const sheet = getSpreadsheet_().getSheetByName(SHEET_EQUIPMENT);
  const existing = getEquipment().map(v => v.toLowerCase());

  if (!existing.includes(equipmentName.toLowerCase())) {
    sheet.appendRow([equipmentName, hours || '', rate || '', '']);
  }

  return { equipmentName, hours, rate };
}

function getInvoices() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 24)).getValues();

  return values.filter(r => r[0]).map(r => ({
    number: String(r[0] || '').trim(),
    date: formatDate_(r[1]),
    customer: String(r[2] || ''),
    jobType: String(r[3] || ''),
    vessel: String(r[4] || ''),
    location: String(r[5] || ''),
    workPerformed: String(r[6] || ''),
    hours: Number(r[7] || 0),
    rate: Number(r[8] || 0),
    materials: Number(r[9] || 0),
    total: Number(r[10] || 0),
    paid: toBool_(r[11]),
    notes: String(r[12] || ''),
    pdfUrl: String(r[15] || ''),
    billingCompany: String(r[17] || ''),
    billingName: String(r[18] || ''),
    billingAddress: String(r[19] || ''),
    billingCity: String(r[20] || ''),
    billingState: String(r[21] || ''),
    billingZip: String(r[22] || ''),
    referenceNumber: String(r[23] || '')
  })).sort((a, b) => invoiceNum_(b.number) - invoiceNum_(a.number));
}

function saveInvoice(inv) {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);

  const saved = {
    number: inv.number || ('INV-' + getNextInvoiceNumber_()),
    date: inv.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    customer: inv.customer || '',
    jobType: inv.jobType || '',
    vessel: inv.vessel || '',
    location: inv.location || '',
    workPerformed: inv.workPerformed || '',
    hours: Number(inv.hours || 0),
    rate: Number(inv.rate || 0),
    materials: Number(inv.materials || 0),
    total: Number(inv.total || 0),
    paid: Boolean(inv.paid),
    notes: inv.notes || '',
    pdfUrl: '',
    billingCompany: inv.billingCompany || inv.customer || '',
    billingName: inv.billingName || '',
    billingAddress: inv.billingAddress || '',
    billingCity: inv.billingCity || '',
    billingState: inv.billingState || '',
    billingZip: inv.billingZip || '',
    referenceNumber: inv.referenceNumber || ''
  };

  sheet.appendRow([
    saved.number, saved.date, saved.customer, saved.jobType, saved.vessel, saved.location,
    saved.workPerformed, saved.hours, saved.rate, saved.materials, saved.total, saved.paid,
    saved.notes, new Date(), new Date(), '', '',
    saved.billingCompany, saved.billingName, saved.billingAddress, saved.billingCity,
    saved.billingState, saved.billingZip, saved.referenceNumber
  ]);

  return saved;
}

function updateInvoicePaid(invoiceNumber, paid) {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);
  const row = findInvoiceRow_(invoiceNumber);
  sheet.getRange(row, 12).setValue(Boolean(paid));
  sheet.getRange(row, 15).setValue(new Date());
  return { invoiceNumber, paid: Boolean(paid) };
}

function generateInvoicePdf(invoiceNumber) {
  setupSheets();

  const invoice = getInvoiceByNumber_(invoiceNumber);
  const existingUrl = invoice.pdfUrl;

  // Always regenerate for now so edits are reflected.
  const html = buildFbtInvoiceHtml_(invoice);

  const pdfBlob = HtmlService.createHtmlOutput(html)
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(invoice.number + ' - ' + sanitizeFileName_(invoice.customer || 'Customer') + '.pdf');

  const folder = getPdfFolder_();
  const file = folder.createFile(pdfBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const pdfUrl = file.getUrl();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);
  const row = findInvoiceRow_(invoice.number);
  sheet.getRange(row, 16).setValue(pdfUrl);
  sheet.getRange(row, 17).setValue(new Date());
  sheet.getRange(row, 15).setValue(new Date());

  return { invoiceNumber: invoice.number, pdfUrl, fileId: file.getId() };
}

function buildFbtInvoiceHtml_(invoice) {
  const labor = Number(invoice.hours || 0) * Number(invoice.rate || 0);
  const materials = Number(invoice.materials || 0);
  const grandTotal = Number(invoice.total || (labor + materials));
  const descLines = String(invoice.workPerformed || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const refText = invoice.referenceNumber || (invoice.vessel ? ('REF# ' + invoice.vessel) : '');

  let itemRows = '';

  if (refText) {
    itemRows += `<tr><td></td><td class="bold">${escapeHtml_(refText)}</td><td></td><td></td></tr>`;
  }

  if (descLines.length) {
    descLines.forEach((line, i) => {
      const isFirst = i === 0;
      itemRows += `
        <tr>
          <td class="center">${isFirst ? escapeHtml_(String(invoice.hours || '')) : ''}</td>
          <td>${escapeHtml_(line)}</td>
          <td class="money">${isFirst ? money_(invoice.rate) : ''}</td>
          <td class="money">${isFirst ? money_(labor) : ''}</td>
        </tr>`;
    });
  } else {
    itemRows += `
      <tr>
        <td class="center">${escapeHtml_(String(invoice.hours || ''))}</td>
        <td>${escapeHtml_(invoice.jobType || 'Service')}</td>
        <td class="money">${money_(invoice.rate)}</td>
        <td class="money">${money_(labor)}</td>
      </tr>`;
  }

  if (materials > 0) {
    itemRows += `
      <tr>
        <td class="center">1</td>
        <td>Materials / Extra Charges</td>
        <td class="money">${money_(materials)}</td>
        <td class="money">${money_(materials)}</td>
      </tr>`;
  }

  const billingCityStateZip = [invoice.billingCity, invoice.billingState, invoice.billingZip].filter(Boolean).join(' ');

  const terms = `Terms and Conditions: Payment will be due prior to hauling, containerization, repair, or washing of equipment via Wire Transfer, Credit Card, or Check. If funds are not paid per the Terms and Conditions, the equipment will not be released unless FBT Equipment, LLC. extends the payment terms in writing.<br>
7 days will be performed for the agreed sum of $ this sum excludes any applicable taxes. Upon payment for the above-mentioned work, the customer acknowledges and accepts all terms and conditions listed. Anything remaining on FBT Equipment LLC premises is abandoned after 30 days without explanation or 30 days has passed since bill was to be paid and appears that the item is left and considered abandoned and will Not belong too Company or Individual that left items on Permissions FBT Equipment llc.<br>
Wire Transfer Information:<br>
TD Bank<br>
595 South Sixth Street<br>
Macclenny, FL 32063<br>
Account # 7600628849<br>
Routing # 067014822`;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: letter; margin: 0.35in; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 12px; }
  .invoice { width: 100%; }
  .logo-box { border: 8px solid #000; padding: 8px; margin-bottom: 8px; }
  .logo-inner { border: 3px solid #000; padding: 8px; display: flex; align-items: center; }
  .logo-icon { width: 82px; height: 70px; background: #001cff; border: 3px solid #ddd; color: white; display: flex; align-items: center; justify-content: center; font-size: 34px; margin-right: 24px; }
  .logo-text { flex: 1; text-align: center; }
  .company-name { font-family: Georgia, serif; font-size: 42px; letter-spacing: 8px; font-weight: bold; }
  .tagline { font-size: 19px; letter-spacing: 3px; font-weight: bold; margin-top: 4px; }
  .invoice-num { text-align: right; font-family: Georgia, serif; font-size: 22px; margin: 4px 70px 0 0; line-height: 1.15; }
  .company-info { width: 48%; margin: 18px auto 34px; font-size: 14px; font-weight: bold; line-height: 1.25; }
  .warning { font-size: 20px; font-weight: bold; margin-top: 8px; }
  .bar { background: #e5e5e5; font-weight: bold; padding: 6px; display: grid; grid-template-columns: 1fr 1fr; font-size: 14px; }
  .addr { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 6px 20px; min-height: 120px; }
  .addr-grid { display: grid; grid-template-columns: 95px 1fr; row-gap: 10px; margin-top: 8px; }
  .label { font-size: 11px; }
  .value { font-size: 14px; }
  .order-title { font-size: 22px; margin: 8px 0 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 2px solid #000; padding: 5px; vertical-align: top; }
  th { background: #e5e5e5; font-size: 14px; text-align: left; }
  .qty { width: 8%; }
  .desc { width: 58%; }
  .each { width: 17%; }
  .amount { width: 17%; }
  .center { text-align: center; }
  .money { text-align: right; font-weight: bold; }
  .bold { font-weight: bold; }
  .totals-label { text-align: right; font-weight: bold; }
  .notes-head { background: #e5e5e5; border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; padding: 5px; font-weight: bold; font-size: 14px; }
  .notes-box { border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000; min-height: 175px; padding: 8px; line-height: 1.25; font-size: 12px; }
</style>
</head>
<body>
<div class="invoice">
  <div class="logo-box">
    <div class="logo-inner">
      <div class="logo-icon">▰</div>
      <div class="logo-text">
        <div class="company-name">FBT EQUIPMENT</div>
        <div class="tagline">HEAVY EQUIPMENT REPAIR &amp; CLEANING</div>
      </div>
    </div>
  </div>

  <div class="invoice-num">
    <div>Invoice ${escapeHtml_(invoice.number.replace('INV-', ''))}</div>
    <div>${escapeHtml_(invoice.date.replace(/-/g, '').slice(4))}</div>
  </div>

  <div class="company-info">
    <div>11236 Allen Acers Rd MacClenny FL<br>32063</div><br>
    <div>Florida Registration # MV74817<br>C-904-881-0448 FAX 904653-0448<br>FBTEQUIPMENTLLC@GMAIL.COM</div>
    <div class="warning">No Machine will be released<br>without Payment !!!</div>
  </div>

  <div class="bar">
    <div>Billing Address:</div>
    <div>Shipping Address:</div>
  </div>

  <div class="addr">
    <div class="addr-grid">
      <div class="label">Company:</div><div class="value">${escapeHtml_(invoice.billingCompany || invoice.customer)}</div>
      <div class="label">Name:</div><div class="value">${escapeHtml_(invoice.billingName || '')}</div>
      <div class="label">Address:</div><div class="value">${escapeHtml_(invoice.billingAddress || '')}</div>
      <div class="label">City/State/Zip</div><div class="value">${escapeHtml_(billingCityStateZip)}</div>
    </div>
    <div class="addr-grid">
      <div></div><div class="value">FBT EQUIPMENT LLC</div>
      <div class="label">Name:</div><div class="value">Margaret (904)-881-0448</div>
      <div></div><div class="value">8747 West Beaver Street</div>
      <div class="label">City/State/Zip</div><div class="value">Jacksonville, FL 32220</div>
    </div>
  </div>

  <div class="order-title">Order Information:</div>
  <table>
    <thead>
      <tr>
        <th class="qty">Qty</th>
        <th class="desc">Product Description</th>
        <th class="each">Amount Each</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr>
        <td></td><td class="bold">TAX EXEMPT</td>
        <td class="totals-label">SUBTOTAL</td>
        <td class="money">${money_(grandTotal)}</td>
      </tr>
      <tr>
        <td></td><td></td>
        <td class="totals-label">GRANDTOTAL</td>
        <td class="money">${money_(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="notes-head">Notes:</div>
  <div class="notes-box">
    ${invoice.notes ? escapeHtml_(invoice.notes).replace(/\n/g, '<br>') + '<br><br>' : ''}
    ${terms}
  </div>
</div>
</body>
</html>`;
}

function getSettings() {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_SETTINGS);
  const values = sheet.getDataRange().getValues();
  const settings = { invoiceEmail: '' };

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim().toLowerCase();
    const val = String(values[i][1] || '').trim();
    if (key === 'invoice email') settings.invoiceEmail = val;
  }
  return settings;
}

function saveSettings(payload) {
  setupSheets();
  const sheet = getSpreadsheet_().getSheetByName(SHEET_SETTINGS);
  const invoiceEmail = String(payload.invoiceEmail || '').trim();

  if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const values = sheet.getDataRange().getValues();
  let row = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === 'invoice email') row = i + 1;
  }
  if (row === -1) {
    row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1).setValue('Invoice Email');
  }
  sheet.getRange(row, 2).setValue(invoiceEmail);
  return getSettings();
}

function sendInvoiceEmail(invoiceNumber) {
  setupSheets();
  const settings = getSettings();
  if (!settings.invoiceEmail) throw new Error('No invoice email set. Go to Settings and enter an email address.');

  const pdfResult = generateInvoicePdf(invoiceNumber);
  const file = DriveApp.getFileById(pdfResult.fileId);
  const invoice = getInvoiceByNumber_(invoiceNumber);

  MailApp.sendEmail({
    to: settings.invoiceEmail,
    subject: 'Invoice ' + invoice.number + ' - ' + invoice.customer,
    body: 'Hello,\n\nAttached is invoice ' + invoice.number + '.\n\nTotal: ' + money_(invoice.total) + '\n\nThank you.',
    attachments: [file.getBlob()]
  });

  return { invoiceNumber: invoice.number, sentTo: settings.invoiceEmail, pdfUrl: pdfResult.pdfUrl };
}

function getInvoiceByNumber_(invoiceNumber) {
  const row = findInvoiceRow_(invoiceNumber);
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);
  const r = sheet.getRange(row, 1, 1, Math.max(sheet.getLastColumn(), 24)).getValues()[0];

  return {
    number: String(r[0] || '').trim(),
    date: formatDate_(r[1]),
    customer: String(r[2] || ''),
    jobType: String(r[3] || ''),
    vessel: String(r[4] || ''),
    location: String(r[5] || ''),
    workPerformed: String(r[6] || ''),
    hours: Number(r[7] || 0),
    rate: Number(r[8] || 0),
    materials: Number(r[9] || 0),
    total: Number(r[10] || 0),
    paid: toBool_(r[11]),
    notes: String(r[12] || ''),
    pdfUrl: String(r[15] || ''),
    billingCompany: String(r[17] || ''),
    billingName: String(r[18] || ''),
    billingAddress: String(r[19] || ''),
    billingCity: String(r[20] || ''),
    billingState: String(r[21] || ''),
    billingZip: String(r[22] || ''),
    referenceNumber: String(r[23] || '')
  };
}

function findInvoiceRow_(invoiceNumber) {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_INVOICES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('No invoices found.');
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = String(invoiceNumber || '').trim();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === target) return i + 2;
  }
  throw new Error('Invoice not found: ' + invoiceNumber);
}

function getNextInvoiceNumber_() {
  const invoices = getInvoices();
  let max = 1000;
  invoices.forEach(inv => {
    const n = invoiceNum_(inv.number);
    if (n > max) max = n;
  });
  return max + 1;
}

function invoiceNum_(num) {
  return Number(String(num || '').replace(/\D/g, '')) || 0;
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (!value) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value).slice(0, 10);
}

function toBool_(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'paid' || String(v).toLowerCase() === 'yes' || String(v) === '1';
}

function getPdfFolder_() {
  const folders = DriveApp.getFoldersByName(PDF_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PDF_FOLDER_NAME);
}

function sanitizeFileName_(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '').trim();
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money_(value) {
  return '$' + Number(value || 0).toFixed(2);
}

// Run this once from Apps Script after updating Code.gs/appsscript.json.
function authorizeApp() {
  setupSheets();
  getSpreadsheet_().getName();
  getPdfFolder_().getName();
  MailApp.getRemainingDailyQuota();
  return 'Authorization complete.';
}

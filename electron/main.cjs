const { app, BrowserWindow, dialog, ipcMain, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const archiver = require('archiver');
const unzipper = require('unzipper');


let mainWindow;

const ZOOM_STEP = 0.5;
const MIN_ZOOM_LEVEL = -3;
const MAX_ZOOM_LEVEL = 5;

function zoomBy(webContents, step) {
  const next = webContents.getZoomLevel() + step;
  const clamped = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, next));
  webContents.setZoomLevel(clamped);
}

function zoomReset(webContents) {
  webContents.setZoomLevel(0);
}

// --- Save helpers: wait and retry when OneDrive or Excel has the file locked ---
const backedUpThisSession = new Set();

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryWhileLocked(label, action) {
  const lockCodes = ['EBUSY', 'EPERM', 'EACCES'];
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (!error || !lockCodes.includes(error.code)) {
        throw error;
      }

      console.log(
        `[${label}] file is locked (try ${attempt} of 5). Waiting 2 seconds...`,
      );
      await sleep(2000);
    }
  }

  throw lastError;
}

function createBackupOncePerSession(workbookPath) {
  if (backedUpThisSession.has(workbookPath)) {
    return;
  }

  createBackup(workbookPath);
  backedUpThisSession.add(workbookPath);
}

const workbookSheets = [
  'Suppliers',
  'SupplierContacts',
  'Procurements',
  'ProcurementGrades',
  'PriceHistory',
  'Costings',
  'Resales',
  'Users',
  'Settings',
  'SpeciesDefinitions',
  'GradeDefinitions',
];


const workbookHeaders = {
  Suppliers: [
    'SupplierID',
    'SupplierReference',
    'SupplierName',
    'Address',
    'ABN',
    'PaymentTerms',
    'Phone',
    'Email',
    'Notes',
    'CreatedBy',
    'CreatedAt',
    'ChangedBy',
    'ChangedAt',
  ],
  SupplierContacts: [
    'ContactID',
    'SupplierID',
    'ContactName',
    'Role',
    'PhoneNumber',
    'MobileNumber',
    'Email',
    'Notes',
    'IsPrimary',
    'CreatedAt',
  ],
  Procurements: [
    'ProcurementID',
    'ProcurementRef',
    'SupplierID',
    'ContactID',
    'AgreementType',
    'AgreementDetail',
    'Plantation',
    'Species',
    'HarvestPeriodStart',
    'HarvestPeriodEnd',
    'StartDate',
    'EndDate',
    'Status',
    'AcceptanceDate',
    'AcceptanceTime',
    'AcceptanceMethod',
    'AcceptedByPerson',
    'AcceptanceNotes',
    'LogSpecFileID',
    'LogSpecFileName',
    'LogSpecFileType',
    'Notes',
    'CreatedBy',
    'CreatedDate',
    'ChangedBy',
    'ChangedDate',
  ],
  ProcurementGrades: [
    'ProcurementGradeID',
    'ProcurementRef',
    'Species',
    'ProductType',
    'GradeName',
    'OfferedPricePerTonne',
    'AgreedPricePerTonne',
    'ResalePrice',
    'AgreedTonnes',
    'DeliveredTonnes',
    'RemainingTonnes',
    'Notes',
  ],
  PriceHistory: [
    'PriceHistoryID',
    'ProcurementRef',
    'ProcurementGradeID',
    'ProductType',
    'GradeName',
    'PreviousPrice',
    'NewPrice',
    'ChangeType',
    'Reason',
    'EffectiveDateTime',
    'Notes',
    'RecordedBy',
    'RecordedDateTime',
  ],
  Costings: [
    'CostingReference',
    'CreatedAt',
    'Label',
    'DestinationCountry',
    'LocalCurrency',
    'SellingPriceUSD',
    'SellingPriceLocal',
    'SellingPriceAUD',
    'ClearanceAUD',
    'SeaFreightAUD',
    'TransportAUD',
    'FumigationAUD',
    'PackingAUD',
    'TotalCostsAUD',
    'MaxAffordableOfferAUD',
    'MaxAffordableOfferUSD',
    'TraderCommissionAUD',
    'RecommendedOfferAUD',
    'RecommendedOfferUSD',
    'AudPerUsd',
    'LocalPerUsd',
    'RateSource',
    'RateDate',
  ],
  Resales: [
    'ResaleID',
    'ProcurementRef',
    'ProcurementGradeID',
    'BuyerName',
    'SellingPricePerTonne',
    'AgreedTonnes',
    'DeliveredTonnes',
    'RemainingTonnes',
    'Notes',
    'CreatedAt',
  ],
  Users: [
    'UserID',
    'UserName',
    'DisplayName',
    'Role',
    'IsActive',
    'CreatedAt',
  ],
  Settings: [
    'SettingKey',
    'SettingValue',
    'ChangedAt',
  ],
  SpeciesDefinitions: [
    'SpeciesDefinitionID',
    'SpeciesName',
    'IsStandard',
    'Notes',
    'CreatedAt',
  ],
  GradeDefinitions: [
    'GradeDefinitionID',
    'SupplierID',
    'SupplierName',
    'SpeciesName',
    'ProductType',
    'GradeName',
    'IsStandard',
    'Notes',
    'CreatedAt',
  ],
};

const supplierHeaders = workbookHeaders.Suppliers;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'LogPro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (!input.control && !input.meta) return;

    if (input.key === '=' || input.key === '+') {
      event.preventDefault();
      zoomBy(mainWindow.webContents, ZOOM_STEP);
    } else if (input.key === '-') {
      event.preventDefault();
      zoomBy(mainWindow.webContents, -ZOOM_STEP);
    } else if (input.key === '0') {
      event.preventDefault();
      zoomReset(mainWindow.webContents);
    }
  });

  mainWindow.webContents.on('zoom-changed', (_event, zoomDirection) => {
    zoomBy(mainWindow.webContents, zoomDirection === 'in' ? ZOOM_STEP : -ZOOM_STEP);
  });

  const developmentUrl = process.env.ELECTRON_START_URL;

  if (developmentUrl) {
    mainWindow.loadURL(developmentUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function friendlyError(error, action) {
  const code = error && error.code;

  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return `LogPro could not ${action}. The workbook is probably open in Excel, or OneDrive is still syncing it. Close Excel, wait a few seconds, then try again.`;
  }

  if (code === 'ENOENT') {
    return 'LogPro could not find the workbook. It may have been moved or deleted.';
  }

  const details = error && error.message ? error.message : String(error);
  return `LogPro could not ${action}. Details: ${details}`;
}

function openWorkbookFile(workbookPath) {
  try {
    const workbook = XLSX.readFile(workbookPath);
    const missingSheets = workbookSheets.filter(
      (sheetName) => !workbook.SheetNames.includes(sheetName),
    );

    if (missingSheets.length > 0) {
      return {
        workbook: null,
        error: `This is not a LogPro workbook. Missing sheets: ${missingSheets.join(', ')}`,
      };
    }

    return { workbook, error: '' };
  } catch (error) {
    console.error('Could not read workbook:', error);
    return {
      workbook: null,
      error: friendlyError(error, 'read the workbook'),
    };
  }
}

function createBackup(workbookPath) {
  const folderPath = path.dirname(workbookPath);
  const baseName = path.basename(workbookPath, '.xlsx');
  const backupPath = path.join(folderPath, `${baseName}.backup.xlsx`);

  fs.copyFileSync(workbookPath, backupPath);
}

function createSupplierPrefix(supplierName) {
  const lettersOnly = supplierName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return `${lettersOnly}___`.slice(0, 3);
}

function getNextSupplierReference(rows, supplierName) {
  const prefix = createSupplierPrefix(supplierName);

  const usedNumbers = rows
    .map((row) => String(row.SupplierReference || ''))
    .filter((reference) => reference.startsWith(`${prefix}-`))
    .map((reference) => Number(reference.slice(4)))
    .filter((number) => Number.isInteger(number) && number > 0);

  const nextNumber =
    usedNumbers.length === 0 ? 1 : Math.max(...usedNumbers) + 1;

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function readSuppliers(workbook) {
  const worksheet = workbook.Sheets.Suppliers;

  if (!worksheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rows
    .map((row) => ({
      SupplierReference: String(row.SupplierReference || ''),
      SupplierName: String(row.SupplierName || ''),
      ABN: String(row.ABN || ''),
      Phone: String(row.Phone || ''),
      Email: String(row.Email || ''),
      Notes: String(row.Notes || ''),
      CreatedAt: String(row.CreatedAt || ''),
    }))
    .filter((row) => row.SupplierReference !== '');
}

function writeSuppliers(workbook, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: supplierHeaders,
  });

  worksheet['!cols'] = supplierHeaders.map(() => ({ wch: 24 }));
  workbook.Sheets.Suppliers = worksheet;
}

ipcMain.handle('workbook:open', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a LogPro workbook',
    buttonLabel: 'Open Workbook',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const workbookPath = result.filePaths[0];
  const { workbook, error } = openWorkbookFile(workbookPath);

  if (!workbook) {
    return { path: '', error, suppliers: [] };
  }

  return { path: workbookPath, error: '', suppliers: readSuppliers(workbook) };
});

ipcMain.handle('workbook:load', async (_event, workbookPath) => {
  const { workbook, error } = openWorkbookFile(workbookPath);

  if (!workbook) {
    return { path: '', error, suppliers: [] };
  }

  return { path: workbookPath, error: '', suppliers: readSuppliers(workbook) };
});

ipcMain.handle('workbook:readFile', async (_event, workbookPath) => {
  try {
    if (!workbookPath || !fs.existsSync(workbookPath)) {
      return { base64: '', error: 'Workbook file does not exist.' };
    }
    const buffer = fs.readFileSync(workbookPath);
    return { base64: buffer.toString('base64'), error: '' };
  } catch (error) {
    console.error('Could not read workbook file:', error);
    return { base64: '', error: friendlyError(error, 'read the workbook') };
  }
});

ipcMain.handle('workbook:writeFile', async (_event, workbookPath, base64Data) => {
  try {
    if (!workbookPath) {
      return { ok: false, error: 'No workbook path specified.' };
    }
    await retryWhileLocked('backup', () =>
      createBackupOncePerSession(workbookPath),
    );
    const buffer = Buffer.from(base64Data, 'base64');
    await retryWhileLocked('write', () => {
      fs.writeFileSync(workbookPath, buffer);
    });
    return { ok: true, error: '' };
  } catch (error) {
    console.error('Could not write workbook file:', error);
    return { ok: false, error: friendlyError(error, 'save the workbook') };
  }
});

ipcMain.handle('workbook:create', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Create a new LogPro workbook',
    defaultPath: 'logpro.xlsx',
    buttonLabel: 'Create Workbook',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  try {
    const workbook = XLSX.utils.book_new();

    for (const sheetName of workbookSheets) {
      const headers = workbookHeaders[sheetName] || [];
      const worksheet = XLSX.utils.aoa_to_sheet(headers.length > 0 ? [headers] : []);

      if (headers.length > 0) {
        worksheet['!cols'] = headers.map(() => ({ wch: 22 }));
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    XLSX.writeFile(workbook, result.filePath);

    return { path: result.filePath, error: '', suppliers: [] };
  } catch (error) {
    console.error('Could not create workbook:', error);
    return {
      path: '',
      error: friendlyError(error, 'create the workbook'),
      suppliers: [],
    };
  }
});

ipcMain.handle('supplier:save', async (_event, workbookPath, supplier) => {
  console.log('Saving supplier to:', workbookPath);

  if (!workbookPath) {
    return { suppliers: [], error: 'No workbook is open.' };
  }

  const name = String((supplier && supplier.name) || '').trim();

  if (!name) {
    return { suppliers: [], error: 'Supplier name is required.' };
  }

  const { workbook, error } = openWorkbookFile(workbookPath);

  if (!workbook) {
    return { suppliers: [], error };
  }

  try {
    const startedAt = Date.now();
    const lap = (step) =>
      console.log(`[save supplier] ${step}: ${Date.now() - startedAt} ms`);

    await retryWhileLocked('backup', () =>
      createBackupOncePerSession(workbookPath),
    );
    lap('backup done');

    const suppliers = readSuppliers(workbook);

    suppliers.push({
      SupplierReference: getNextSupplierReference(suppliers, name),
      SupplierName: name,
      ABN: String(supplier.abn || '').trim(),
      Phone: String(supplier.phone || '').trim(),
      Email: String(supplier.email || '').trim(),
      Notes: String(supplier.notes || '').trim(),
      CreatedAt: new Date().toISOString(),
    });

    writeSuppliers(workbook, suppliers);
    lap('rows prepared');

    await retryWhileLocked('write', () =>
      XLSX.writeFile(workbook, workbookPath),
    );
    lap('workbook written');

    return { suppliers, error: '' };
  } catch (saveError) {
    console.error('Could not save supplier:', saveError);
    return {
      suppliers: [],
      error: friendlyError(saveError, 'save the supplier'),
    };
  }
});

// ---------------------------------------------------------------------------
// Exchange rates. Both sources are free and need no account or key.
// 1st choice: Reserve Bank of Australia (RBA). 2nd choice: European Central Bank.
// ---------------------------------------------------------------------------
const RATE_CURRENCIES = ['USD', 'CNY', 'JPY', 'KRW'];
const RBA_URL = 'https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv';

const MONTH_NUMBERS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function withTimeout(promise, milliseconds, what) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what} took too long to answer`)),
      milliseconds,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function downloadText(url) {
  const response = await withTimeout(net.fetch(url), 15000, url);

  if (!response.ok) {
    throw new Error(`${url} answered with status ${response.status}`);
  }

  return withTimeout(response.text(), 15000, url);
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (const character of line) {
    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseRbaDate(text) {
  const clean = String(text || '').trim();

  let match = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/.exec(clean);
  if (match) {
    const month = MONTH_NUMBERS[match[2].toLowerCase()];
    let year = Number(match[3]);
    if (year < 100) {
      year += 2000;
    }
    return month === undefined ? NaN : Date.UTC(year, month, Number(match[1]));
  }

  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (match) {
    return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return NaN;
}

// Reads the RBA table. It finds each currency by the "Units" row (or the
// "Title" row) so it does not depend on the column order.
function parseRbaCsv(text) {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(splitCsvLine);

  const unitsRow = rows.find((row) => String(row[0]).toLowerCase() === 'units');
  const titleRow = rows.find((row) => String(row[0]).toLowerCase() === 'title');
  const headerLength = Math.max(
    unitsRow ? unitsRow.length : 0,
    titleRow ? titleRow.length : 0,
  );

  const columnFor = {};

  for (let column = 1; column < headerLength; column += 1) {
    const unit = unitsRow ? String(unitsRow[column] || '').toUpperCase() : '';
    const title = titleRow ? String(titleRow[column] || '') : '';
    const fromTitle = /A\$\s*1\s*=\s*([A-Z]{3})\b/.exec(title);
    const code = RATE_CURRENCIES.includes(unit)
      ? unit
      : fromTitle
        ? fromTitle[1]
        : '';

    if (RATE_CURRENCIES.includes(code) && columnFor[code] === undefined) {
      columnFor[code] = column;
    }
  }

  const missing = RATE_CURRENCIES.filter((code) => columnFor[code] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `could not find these currencies in the RBA table: ${missing.join(', ')}`,
    );
  }

  let best = null;

  for (const row of rows) {
    const time = parseRbaDate(row[0]);
    if (Number.isNaN(time)) {
      continue;
    }

    const values = {};
    let complete = true;

    for (const code of RATE_CURRENCIES) {
      const value = Number(row[columnFor[code]]);
      if (!(value > 0)) {
        complete = false;
        break;
      }
      values[code] = value;
    }

    if (complete && (best === null || time > best.time)) {
      best = { time, values };
    }
  }

  if (best === null) {
    throw new Error('no complete row of rates was found in the RBA table');
  }

  return { time: best.time, perAud: { AUD: 1, ...best.values } };
}

// Safety check: refuse numbers that are clearly wrong (for example a shifted column).
function checkRatesLookSane(perAud) {
  const limits = {
    USD: [0.2, 2],
    CNY: [2, 15],
    JPY: [30, 500],
    KRW: [400, 4000],
  };

  for (const code of RATE_CURRENCIES) {
    const value = perAud[code];
    const [low, high] = limits[code];
    if (!(value >= low && value <= high)) {
      throw new Error(`the ${code} rate (${value}) looks wrong`);
    }
  }
}

async function loadRatesFromRba() {
  const text = await downloadText(RBA_URL);
  const parsed = parseRbaCsv(text);

  return {
    sourceName:
      'Reserve Bank of Australia (RBA) - Exchange Rates F11.1, indicative daily rates',
    sourceUrl: RBA_URL,
    rateDate: new Date(parsed.time).toISOString().slice(0, 10),
    perAud: parsed.perAud,
  };
}

async function loadRatesFromEcb() {
  const url = `https://api.frankfurter.dev/v1/latest?base=AUD&symbols=${RATE_CURRENCIES.join(',')}`;
  const data = JSON.parse(await downloadText(url));
  const perAud = { AUD: 1 };

  for (const code of RATE_CURRENCIES) {
    const value = Number(data && data.rates && data.rates[code]);
    if (!(value > 0)) {
      throw new Error(`the ${code} rate was missing`);
    }
    perAud[code] = value;
  }

  return {
    sourceName: 'European Central Bank (ECB) reference rates, via frankfurter.dev',
    sourceUrl: url,
    rateDate: String((data && data.date) || ''),
    perAud,
  };
}

ipcMain.handle('rates:get', async () => {
  const sources = [
    { short: 'RBA', load: loadRatesFromRba },
    { short: 'ECB', load: loadRatesFromEcb },
  ];
  const problems = [];

  for (const source of sources) {
    try {
      const result = await source.load();
      checkRatesLookSane(result.perAud);
      console.log(`[rates] using ${source.short}, rates dated ${result.rateDate}`);
      return { ok: true, error: '', problems, ...result };
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      console.log(`[rates] ${source.short} did not work: ${reason}`);
      problems.push(`${source.short}: ${reason}`);
    }
  }

  return {
    ok: false,
    error:
      'LogPro could not get live exchange rates. Check your internet connection, or tick "Use my own exchange rates" and type them in.',
    problems,
    sourceName: '',
    sourceUrl: '',
    rateDate: '',
    perAud: null,
  };
});

// ---------------------------------------------------------------------------
// Costings (saved on the Costings sheet of the workbook)
// ---------------------------------------------------------------------------
const costingTextHeaders = [
  'CostingReference',
  'CreatedAt',
  'Label',
  'DestinationCountry',
  'LocalCurrency',
  'RateSource',
  'RateDate',
];

const costingHeaders = [
  'CostingReference',
  'CreatedAt',
  'Label',
  'DestinationCountry',
  'LocalCurrency',
  'SellingPriceUSD',
  'SellingPriceLocal',
  'SellingPriceAUD',
  'ClearanceAUD',
  'SeaFreightAUD',
  'TransportAUD',
  'FumigationAUD',
  'PackingAUD',
  'TotalCostsAUD',
  'MaxAffordableOfferAUD',
  'MaxAffordableOfferUSD',
  'TraderCommissionAUD',
  'RecommendedOfferAUD',
  'RecommendedOfferUSD',
  'AudPerUsd',
  'LocalPerUsd',
  'RateSource',
  'RateDate',
];

function normaliseCosting(row) {
  const result = {};

  for (const header of costingHeaders) {
    const value = row[header];
    result[header] = costingTextHeaders.includes(header)
      ? String(value === undefined || value === null ? '' : value).trim()
      : Number(value) || 0;
  }

  return result;
}

function readCostings(workbook) {
  const worksheet = workbook.Sheets.Costings;

  if (!worksheet) {
    return [];
  }

  return XLSX.utils
    .sheet_to_json(worksheet, { defval: '' })
    .map(normaliseCosting)
    .filter((row) => row.CostingReference !== '');
}

function writeCostings(workbook, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: costingHeaders });

  worksheet['!cols'] = costingHeaders.map(() => ({ wch: 22 }));
  workbook.Sheets.Costings = worksheet;
}

function getNextCostingReference(rows) {
  const usedNumbers = rows
    .map((row) => String(row.CostingReference || ''))
    .filter((reference) => reference.startsWith('COST-'))
    .map((reference) => Number(reference.slice(5)))
    .filter((number) => Number.isInteger(number) && number > 0);

  const nextNumber =
    usedNumbers.length === 0 ? 1 : Math.max(...usedNumbers) + 1;

  return `COST-${String(nextNumber).padStart(4, '0')}`;
}

ipcMain.handle('costing:list', async (_event, workbookPath) => {
  if (!workbookPath) {
    return { costings: [], error: 'No workbook is open.' };
  }

  const { workbook, error } = openWorkbookFile(workbookPath);

  if (!workbook) {
    return { costings: [], error };
  }

  // Newest first.
  return { costings: readCostings(workbook).reverse(), error: '' };
});

ipcMain.handle('costing:save', async (_event, workbookPath, costing) => {
  if (!workbookPath) {
    return { costings: [], error: 'No workbook is open.' };
  }

  if (!costing || typeof costing !== 'object') {
    return { costings: [], error: 'There is nothing to save.' };
  }

  const clean = normaliseCosting(costing);

  if (!clean.DestinationCountry) {
    return { costings: [], error: 'Choose a destination country first.' };
  }

  if (!(clean.AudPerUsd > 0)) {
    return {
      costings: [],
      error: 'The exchange rate is missing, so the costing was not saved.',
    };
  }

  const { workbook, error } = openWorkbookFile(workbookPath);

  if (!workbook) {
    return { costings: [], error };
  }

  try {
    const startedAt = Date.now();

    await retryWhileLocked('backup', () =>
      createBackupOncePerSession(workbookPath),
    );

    const rows = readCostings(workbook);

    clean.CostingReference = getNextCostingReference(rows);
    clean.CreatedAt = new Date().toISOString();
    clean.Label = clean.Label.slice(0, 200);
    rows.push(clean);

    writeCostings(workbook, rows);

    await retryWhileLocked('write', () =>
      XLSX.writeFile(workbook, workbookPath),
    );

    console.log(
      `[save costing] ${clean.CostingReference} written in ${Date.now() - startedAt} ms`,
    );

    return { costings: rows.reverse(), error: '' };
  } catch (saveError) {
    console.error('Could not save costing:', saveError);
    return {
      costings: [],
      error: friendlyError(saveError, 'save the costing'),
    };
  }
});

// ---------------------------------------------------------------------------
// Attachments: save, read, list (physical files in Attachments folder)
// ---------------------------------------------------------------------------

function getAttachmentsRoot(workbookPath) {
  const folder = path.dirname(workbookPath);
  return path.join(folder, 'Attachments');
}

function getSupplierAttachmentsFolder(workbookPath, supplierName) {
  const root = getAttachmentsRoot(workbookPath);
  const safeName = supplierName
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 60);
  return path.join(root, safeName);
}

ipcMain.handle(
  'attachment:saveFile',
  async (_event, workbookPath, supplierName, procurementRef, fileName, base64Data) => {
    try {
      if (!workbookPath || !supplierName || !fileName || !base64Data) {
        return {
          ok: false,
          error: 'Missing workbook path, supplier name, file name or data.',
          relativePath: '',
        };
      }

      const supplierFolder = getSupplierAttachmentsFolder(workbookPath, supplierName);
      fs.mkdirSync(supplierFolder, { recursive: true });

      const safeBase = (procurementRef || 'UNKNOWN')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 40);
      const cleanOriginal = path.basename(fileName || 'attachment')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim();
      const parsed = path.parse(cleanOriginal);
      const baseName = (parsed.name || 'attachment').slice(0, 50);
      const ext = parsed.ext || '';

      let candidateName = `${safeBase}_${cleanOriginal}`;
      let fullPath = path.join(supplierFolder, candidateName);
      let counter = 1;
      while (fs.existsSync(fullPath)) {
        candidateName = `${safeBase}_${baseName}_(${counter})${ext}`;
        fullPath = path.join(supplierFolder, candidateName);
        counter++;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      await retryWhileLocked('save attachment', () => {
        fs.writeFileSync(fullPath, buffer);
      });

      const relativePath = path.relative(path.dirname(workbookPath), fullPath);

      return { ok: true, error: '', relativePath, fileName: candidateName };
    } catch (error) {
      console.error('Could not save attachment:', error);
      return {
        ok: false,
        error: friendlyError(error, 'save the attachment file'),
        relativePath: '',
        fileName: '',
      };
    }
  },
);

ipcMain.handle(
  'attachment:readFile',
  async (_event, workbookPath, relativePath) => {
    try {
      if (!workbookPath || !relativePath) {
        return { base64: '', error: 'Missing workbook path or attachment path.' };
      }

      const fullPath = path.resolve(path.dirname(workbookPath), relativePath);

      if (!fs.existsSync(fullPath)) {
        return { base64: '', error: 'Attachment file not found.' };
      }

      const buffer = fs.readFileSync(fullPath);
      return { base64: buffer.toString('base64'), error: '' };
    } catch (error) {
      console.error('Could not read attachment:', error);
      return { base64: '', error: friendlyError(error, 'read the attachment file') };
    }
  },
);

ipcMain.handle(
  'attachment:openFile',
  async (_event, workbookPath, relativePath) => {
    try {
      if (!workbookPath || !relativePath) {
        return { ok: false, error: 'Missing workbook path or attachment path.' };
      }

      const fullPath = path.resolve(path.dirname(workbookPath), relativePath);
      if (!fs.existsSync(fullPath)) {
        return { ok: false, error: 'Attachment file not found on disk.' };
      }

      const openError = await shell.openPath(fullPath);
      if (openError) {
        return { ok: false, error: openError };
      }

      return { ok: true, error: '' };
    } catch (error) {
      console.error('Could not open attachment:', error);
      return { ok: false, error: friendlyError(error, 'open attachment file') };
    }
  },
);

ipcMain.handle(
  'attachment:listForProcurement',
  async (_event, workbookPath, supplierName, procurementRef) => {
    try {
      if (!workbookPath || !supplierName || !procurementRef) {
        return { files: [], error: 'Missing workbook path, supplier or procurement reference.' };
      }

      const supplierFolder = getSupplierAttachmentsFolder(workbookPath, supplierName);
      if (!fs.existsSync(supplierFolder)) {
        return { files: [], error: '' };
      }

      const allFiles = fs.readdirSync(supplierFolder);
      const prefix = (procurementRef || '').replace(/[^A-Za-z0-9_-]/g, '_');

      const matching = allFiles
        .filter((name) => name.startsWith(prefix + '_'))
        .map((name) => ({
          fileName: name,
          relativePath: path.relative(path.dirname(workbookPath), path.join(supplierFolder, name)),
        }));

      return { files: matching, error: '' };
    } catch (error) {
      console.error('Could not list attachments:', error);
      return { files: [], error: friendlyError(error, 'list attachment files') };
    }
  },
);
// ---------------------------------------------------------------------------
// Backup & Restore: Full ZIP snapshot of workbook + Attachments folder
// ---------------------------------------------------------------------------

function createZipArchive(sourceWorkbookPath, destinationZipPath, includeAttachments) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinationZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // 1. Current Excel workbook at root of the ZIP
    const workbookFileName = path.basename(sourceWorkbookPath);
    archive.file(sourceWorkbookPath, { name: workbookFileName });

    // 2. Attachments folder
    if (includeAttachments) {
      const attachmentsFolder = getAttachmentsRoot(sourceWorkbookPath);
      if (fs.existsSync(attachmentsFolder)) {
        archive.directory(attachmentsFolder, 'Attachments');
      }
    }

    archive.finalize();
  });
}

ipcMain.handle('backup:everything', async (_event, workbookPath) => {
  try {
    if (!workbookPath || !fs.existsSync(workbookPath)) {
      return { ok: false, error: 'Current workbook file could not be found.' };
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const defaultName = `LogPro_Backup_${dateStamp}.zip`;

    const saveRes = await dialog.showSaveDialog(mainWindow, {
      title: 'Backup Everything (Workbook & Attachments)',
      defaultPath: path.join(path.dirname(workbookPath), defaultName),
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    });

    if (saveRes.canceled || !saveRes.filePath) {
      return { ok: false, canceled: true };
    }

    await retryWhileLocked('create backup ZIP', async () => {
      await createZipArchive(workbookPath, saveRes.filePath, true);
    });

    return { ok: true, zipPath: saveRes.filePath };
  } catch (error) {
    console.error('Backup error:', error);
    return { ok: false, error: friendlyError(error, 'create the backup archive') };
  }
});

ipcMain.handle('backup:restore', async (_event, currentWorkbookPath) => {
  try {
    if (!currentWorkbookPath || !fs.existsSync(currentWorkbookPath)) {
      return { ok: false, error: 'Current workbook path is not available.' };
    }

    const openRes = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup ZIP to Restore',
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile'],
    });

    if (openRes.canceled || !openRes.filePaths || openRes.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const selectedZipPath = openRes.filePaths[0];

    // 1. Validate the selected ZIP
    const zip = await unzipper.Open.file(selectedZipPath);
    const files = zip.files;
    const xlsxEntries = files.filter(
      (f) => f.path.toLowerCase().endsWith('.xlsx') && !f.path.includes('~$') && !path.basename(f.path).startsWith('.')
    );

    if (xlsxEntries.length === 0) {
      return {
        ok: false,
        error: 'The selected backup ZIP does not contain any valid LogPro Excel (.xlsx) workbook.',
      };
    }

    if (xlsxEntries.length > 1) {
      return {
        ok: false,
        error: `The selected backup ZIP contains ${xlsxEntries.length} Excel workbooks. A valid LogPro backup archive must contain exactly one workbook.`,
      };
    }

    const targetFolder = path.dirname(currentWorkbookPath);

    // 2. Create safety backup of the existing workbook & Attachments folder
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safetyBackupPath = path.join(targetFolder, `Safety_Backup_Before_Restore_${dateStamp}.zip`);

    await retryWhileLocked('create safety backup', async () => {
      await createZipArchive(currentWorkbookPath, safetyBackupPath, true);
    });

    if (!fs.existsSync(safetyBackupPath)) {
      return { ok: false, error: 'Failed to create safety backup prior to restore. Aborting restore.' };
    }

    // 3. Clean existing local Attachments directory for full snapshot replacement
    const localAttachments = path.join(targetFolder, 'Attachments');
    if (fs.existsSync(localAttachments)) {
      try {
        fs.rmSync(localAttachments, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn('Could not clear local Attachments folder before restore:', rmErr);
      }
    }

    // 4. Extract restore archive into targetFolder
    await new Promise((resolve, reject) => {
      let settled = false;
      const onDone = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      fs.createReadStream(selectedZipPath)
        .pipe(unzipper.Extract({ path: targetFolder }))
        .on('close', onDone)
        .on('finish', onDone)
        .on('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
    });

    // 4. Determine restored workbook path
    let restoredWorkbookPath = currentWorkbookPath;
    const currentName = path.basename(currentWorkbookPath);
    const matchingEntry = xlsxEntries.find((e) => path.basename(e.path) === currentName);
    if (!matchingEntry) {
      restoredWorkbookPath = path.join(targetFolder, path.basename(xlsxEntries[0].path));
    }

    return {
      ok: true,
      restoredWorkbookPath,
      safetyBackupPath,
      restoredWorkbookName: path.basename(restoredWorkbookPath),
    };
  } catch (error) {
    console.error('Restore error:', error);
    return { ok: false, error: friendlyError(error, 'restore the backup archive') };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
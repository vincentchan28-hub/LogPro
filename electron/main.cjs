const { app, BrowserWindow, dialog, ipcMain, net } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');


let mainWindow;

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
      return action();
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
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
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

const supplierHeaders = [
  'SupplierReference',
  'SupplierName',
  'ABN',
  'Phone',
  'Email',
  'Notes',
  'CreatedAt',
];

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

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  mainWindow.loadURL(startUrl);

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
      const worksheet = XLSX.utils.aoa_to_sheet([]);

      if (sheetName === 'Suppliers') {
        XLSX.utils.sheet_add_aoa(worksheet, [supplierHeaders]);
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
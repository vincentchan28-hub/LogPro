const { contextBridge, ipcRenderer } = require('electron')

const api = {
  // Workbook basics (existing)
  openWorkbook() {
    return ipcRenderer.invoke('workbook:open')
  },

  createWorkbook() {
    return ipcRenderer.invoke('workbook:create')
  },

  loadWorkbook(workbookPath) {
    return ipcRenderer.invoke('workbook:load', workbookPath)
  },

  readWorkbookFile(workbookPath) {
    return ipcRenderer.invoke('workbook:readFile', workbookPath)
  },

  writeWorkbookFile(workbookPath, base64Data) {
    return ipcRenderer.invoke('workbook:writeFile', workbookPath, base64Data)
  },

  saveSupplier(workbookPath, supplier) {
    return ipcRenderer.invoke('supplier:save', workbookPath, supplier)
  },

  updateProcurementField(workbookPath, procurementRef, updates, legacyValue) {
    return ipcRenderer.invoke(
      'update-procurement-field',
      workbookPath,
      procurementRef,
      updates,
      legacyValue,
    )
  },

  getRates() {
    return ipcRenderer.invoke('rates:get')
  },

  listCostings(workbookPath) {
    return ipcRenderer.invoke('costing:list', workbookPath)
  },

  saveCosting(workbookPath, costing) {
    return ipcRenderer.invoke('costing:save', workbookPath, costing)
  },

  // Attachments
  saveAttachmentFile(workbookPath, supplierName, procurementRef, fileName, base64Data) {
    return ipcRenderer.invoke('attachment:saveFile', workbookPath, supplierName, procurementRef, fileName, base64Data)
  },

  readAttachmentFile(workbookPath, relativePath) {
    return ipcRenderer.invoke('attachment:readFile', workbookPath, relativePath)
  },

  listAttachmentsForProcurement(workbookPath, supplierName, procurementRef) {
    return ipcRenderer.invoke('attachment:listForProcurement', workbookPath, supplierName, procurementRef)
  },

  openAttachmentFile(workbookPath, relativePath) {
    return ipcRenderer.invoke('attachment:openFile', workbookPath, relativePath)
  },

  // Full ZIP Backup & Restore
  backupEverything(workbookPath) {
    return ipcRenderer.invoke('backup:everything', workbookPath)
  },

  // User-controlled application updates
  onUpdateStatus(callback) {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('updates:status', listener)
    return () => ipcRenderer.removeListener('updates:status', listener)
  },

  checkForUpdates() {
    return ipcRenderer.invoke('updates:check')
  },

  downloadUpdate() {
    return ipcRenderer.invoke('updates:download')
  },

  installUpdate() {
    return ipcRenderer.invoke('updates:install')
  },
}

contextBridge.exposeInMainWorld('logProDesktop', api)

console.log('[preload] logProDesktop exposed:', !!api)

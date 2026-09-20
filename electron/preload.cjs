const { contextBridge, ipcRenderer } = require('electron')

const api = {
  openWorkbook() {
    return ipcRenderer.invoke('workbook:open')
  },

  createWorkbook() {
    return ipcRenderer.invoke('workbook:create')
  },

  loadWorkbook(workbookPath) {
    return ipcRenderer.invoke('workbook:load', workbookPath)
  },

  saveSupplier(workbookPath, supplier) {
    return ipcRenderer.invoke('supplier:save', workbookPath, supplier)
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
}

contextBridge.exposeInMainWorld('logPro', api)
contextBridge.exposeInMainWorld('logProDesktop', api)

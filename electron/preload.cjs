const { contextBridge, ipcRenderer } = require('electron');

console.log('=== PRELOAD STARTING ===');

try {
  const api = {
    openWorkbook: function() {
      console.log('openWorkbook called');
      return ipcRenderer.invoke('workbook:open');
    },
    createWorkbook: function() {
      console.log('createWorkbook called');
      return ipcRenderer.invoke('workbook:create');
    },
    loadWorkbook: function(workbookPath) {
      console.log('loadWorkbook called', workbookPath);
      return ipcRenderer.invoke('workbook:load', workbookPath);
    },
    saveSupplier: function(workbookPath, supplier) {
      console.log('saveSupplier called', workbookPath);
      return ipcRenderer.invoke('supplier:save', workbookPath, supplier);
    }
  };

  console.log('About to expose logPro API');
  contextBridge.exposeInMainWorld('logPro', api);
  console.log('=== PRELOAD FINISHED ===');
} catch (error) {
  console.error('=== PRELOAD ERROR ===', error);
}
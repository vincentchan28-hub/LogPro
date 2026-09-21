# LogPro on Replit

## Run the web preview

The Replit preview runs the browser version of LogPro with:

```bash
npm run dev -- --port 5000
```

The Vite server is configured to listen on `0.0.0.0:5000` and allow Replit's proxied preview host. The Electron desktop app remains available separately through `npm run electron:dev`.

The browser version stores workbook data in browser storage. Excel file dialogs and native Electron workbook operations are only available in the desktop app.
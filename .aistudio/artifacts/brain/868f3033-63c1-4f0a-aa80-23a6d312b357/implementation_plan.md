# Implementation Plan: Stop / Complete Procurement & Expiry Management

This plan introduces lifecycle completion controls for procurements. When a procurement concludes—either via manual early stop or reaching its expiration date—it will transition to `Completed`, drop off the active ledger, and archive its final rates and completion status into the Price History system.

---

## 1. User Requirements & Workflow Architecture

Based on user requirements and clarifying choices:
1. **Manual Stop Action**: Available both in the edit toolbar (dedicated action button) and in the agreement 3-dot menu.
2. **Expired Date Range Detection**: A dedicated prompt dialog that triggers when an active agreement's date range (Harvest Period End or Agreement End Date) has passed, providing:
   - **Extend Date**: Direct date selection to extend the agreement and keep it active on the ledger.
   - **Close Off**: Conclude the procurement, mark as `Completed`, and archive to Price History.
3. **Ledger Visibility**: `Completed` procurements drop off the active procurement register and are accessible through the **Price History** page.
4. **Price History Archival**: Creates historical rate snapshot records with `ChangeType: 'Procurement Completed'`, linking the final agreed prices, delivered vs. agreed tonnage, completion reason, and timestamp.

---

## 2. Core Components & State Management

### A. Procurement Ledger Filtering (`src/components/ProcurementsTab.tsx`)
- Filter out procurements with `Status === 'Completed'` (and cancelled) from `filteredProcurements` so completed agreements drop off the active day-to-day register.
- Update register count badges and tab tallies to reflect active contracts.

### B. Manual Stop Procurement Modal & Triggers
- **Edit Toolbar**: Add a "Stop Procurement" button (styled with clear warning hierarchy, distinct from Cancel/Save).
- **3-Dot Action Menu**: Add a "Stop & Complete Agreement" menu item.
- **Stop Confirmation Dialog**:
  - Modal title: "Stop & Complete Procurement"
  - Summary of the agreement (`ProcurementRef`, Supplier, Plantation, Total Tonnes delivered vs agreed).
  - Input field for early completion reason / final notes (e.g., "Harvest finished ahead of schedule", "Quota reached").
  - Actions: "Cancel" and "Confirm Stop & Archive".
  - On confirm: Sets `Status = 'Completed'`, writes completion history records to `PriceHistory`, refreshes workbook data, and resets workspace mode cleanly with a success notice.

### C. Expiry Detection & Extension Dialog
- **Detection Logic**: Checks whether the current date exceeds either `HarvestPeriodEnd` (if specified) or `EndDate`.
- **Expiry Prompt Dialog**:
  - Displays prominent alert: "Agreement Date Range Has Expired".
  - Shows expired date and days elapsed.
  - Option 1 (**Extend Date Range**): Inline date picker for new end date. Clicking "Save & Extend" updates the end date, persists to the workbook, and keeps the procurement active in the ledger.
  - Option 2 (**Close Off**): Allows entering final notes and clicking "Close Off Agreement", marking it `Completed` and archiving to Price History.

### D. Price History Archival & Completed Agreements View (`src/components/PriceHistoryTab.tsx`)
- Enhance `PriceHistoryTab` with a dedicated "Completed Agreements" tab/filter to view all concluded procurements.
- Record `PriceHistory` entries for each grade upon procurement completion with:
  - `ChangeType`: `'Procurement Completed'`
  - `Reason`: `'Manual Stop'` or `'Date Range Expired & Closed Off'`
  - Final agreed price, delivered tonnage, notes, and completion timestamp.
- Provide a detail view of completed agreements so users can inspect past contracts, dates, final commitments, and supplier notes.

### E. Persistence Layer (`src/webLogPro.ts`)
- Ensure `completeProcurement` method updates procurement status to `Completed`, records completion timestamp, and appends completion events to the timeline and `PriceHistory` sheet.

---

## 3. Verification & Testing Plan

1. **Manual Stop Flow**:
   - Open an active procurement in edit mode.
   - Click "Stop Procurement" from toolbar or 3-dot menu.
   - Fill in completion note and confirm.
   - Verify it immediately disappears from the active ledger.
   - Navigate to Price History and verify the completed agreement and final rate entries appear with correct metadata.

2. **Expiry Prompt Flow**:
   - Open or view an agreement whose end date is past.
   - Verify the Expiry Dialog triggers with Extend and Close Off options.
   - Test "Extend Date": select a future date and verify agreement remains in the active ledger with updated end date.
   - Test "Close Off": verify status becomes `Completed` and it drops from active ledger into Price History.

3. **Compilation & Stability**:
   - Run `compile_applet` and verify no TypeScript or build errors.

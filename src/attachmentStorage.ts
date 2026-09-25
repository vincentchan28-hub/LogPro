// Saves and reads attachment files on disk via Electron.
// Files live in: WorkbookFolder/Attachments/SupplierName/PROC-Ref_originalName.ext

export type AttachmentFile = {
  fileName: string
  relativePath: string
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB

export function checkAttachmentFile(file: File): string {
  const isPdf = file.type === 'application/pdf'
  const isImage = file.type.startsWith('image/')

  if (!isPdf && !isImage) {
    return 'Please choose a PDF or an image file (for example JPG or PNG).'
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)
    return `This file is ${sizeMb} MB. The limit is 10 MB per file.`
  }

  return ''
}

export async function saveAttachment(
  workbookPath: string,
  supplierName: string,
  procurementRef: string,
  file: File,
): Promise<{ ok: true; relativePath: string; fileName: string } | { ok: false; error: string }> {
  const win = window as unknown as {
    logProDesktop?: {
      saveAttachmentFile(
        workbookPath: string,
        supplierName: string,
        procurementRef: string,
        fileName: string,
        base64Data: string,
      ): Promise<{
        success?: boolean
        ok?: boolean
        error?: string
        relativePath?: string
        fileName?: string
      }>
    }
  }

  const api = win.logProDesktop
  if (!api) {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const reader = new FileReader()

  const base64Data = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.split(',')[1] || result)
    }

    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

  const result = await api.saveAttachmentFile(
    workbookPath,
    supplierName,
    procurementRef,
    file.name,
    base64Data,
  )

  const successful = result.success === true || result.ok === true

  if (!successful) {
    return {
      ok: false,
      error: result.error || 'Failed to save attachment.',
    }
  }

  return {
    ok: true,
    relativePath: result.relativePath || '',
    fileName: result.fileName || file.name,
  }
}
): Promise<{ ok: true; relativePath: string; fileName: string } | { ok: false; error: string }> {
  const win = window as unknown as {
    logProDesktop?: {
      saveAttachmentFile(
        workbookPath: string,
        supplierName: string,
        procurementRef: string,
        fileName: string,
        base64Data: string,
      ): Promise<{ ok: boolean; error: string; relativePath: string; fileName: string }>
    }
  }

  const api = win.logProDesktop
  if (!api) {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const reader = new FileReader()
  const asBase64 = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

  const result = await api.saveAttachmentFile(workbookPath, supplierName, procurementRef, file.name, asBase64)

  if (!result.ok) {
    return { ok: false, error: result.error || 'Failed to save attachment.' }
  }

  return { ok: true, relativePath: result.relativePath, fileName: result.fileName }
}

export async function loadAttachment(
  workbookPath: string,
  relativePath: string,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; error: string }> {
const win = window as unknown as {
  logPro?: {
    saveAttachmentFile(
      workbookPath: string,
      supplierName: string,
      procurementRef: string,
      fileName: string,
      base64Data: string,
    ): Promise<{ ok: boolean; error: string; relativePath: string; fileName: string }>
  }
}

const api = win.logProDesktop
  if (!api) {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const result = await api.readAttachmentFile(workbookPath, relativePath)
  if (result.error) {
    return { ok: false, error: result.error }
  }

  const binary = atob(result.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const fileName = relativePath.split(/[\\/]/).pop() || 'attachment'

  return { ok: true, blob, fileName }
}

export async function listAttachments(
  workbookPath: string,
  supplierName: string,
  procurementRef: string,
): Promise<{ ok: true; files: AttachmentFile[] } | { ok: false; error: string }> {
  const win = window as unknown as {
    logProDesktop?: {
      listAttachmentsForProcurement(
        workbookPath: string,
        supplierName: string,
        procurementRef: string,
      ): Promise<{ files: AttachmentFile[]; error: string }>
    }
  }

  const api = win.logProDesktop
  if (!api) {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const result = await api.listAttachmentsForProcurement(workbookPath, supplierName, procurementRef)
  if (result.error) {
    return { ok: false, error: result.error }
  }

  return { ok: true, files: result.files || [] }
}
// Saves and reads attachment files on disk via Electron.
// Files live in: WorkbookFolder/Attachments/SupplierName/PROC-Ref_originalName.ext

export type AttachmentFile = {
  fileName: string
  relativePath: string
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB

export function checkAttachmentFile(file: File): string {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)

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
  if (!api || typeof api.saveAttachmentFile !== 'function') {
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

export async function loadAttachment(
  workbookPath: string,
  relativePath: string,
): Promise<{ ok: true; blob: Blob; fileName: string } | { ok: false; error: string }> {
  const win = window as unknown as {
    logProDesktop?: {
      readAttachmentFile(
        workbookPath: string,
        relativePath: string,
      ): Promise<{ base64?: string; error?: string }>
    }
  }

  const api = win.logProDesktop
  if (!api || typeof api.readAttachmentFile !== 'function') {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const result = await api.readAttachmentFile(workbookPath, relativePath)
  if (result.error || !result.base64) {
    return { ok: false, error: result.error || 'Attachment file not found.' }
  }

  const binary = atob(result.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const ext = relativePath.split('.').pop()?.toLowerCase()
  let mimeType = 'application/octet-stream'
  if (ext === 'pdf') mimeType = 'application/pdf'
  else if (ext === 'png') mimeType = 'image/png'
  else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
  else if (ext === 'webp') mimeType = 'image/webp'

  const blob = new Blob([bytes], { type: mimeType })
  const fileName = relativePath.split(/[\\/]/).pop() || 'attachment'

  return { ok: true, blob, fileName }
}

export async function openAttachmentInNewWindow(
  workbookPath: string,
  relativePath: string,
): Promise<string> {
  const win = window as unknown as {
    logProDesktop?: {
      openAttachmentFile?(
        workbookPath: string,
        relativePath: string,
      ): Promise<{ ok: boolean; error?: string }>
    }
  }

  // In Electron desktop environment, open natively with Windows default application
  if (win.logProDesktop && typeof win.logProDesktop.openAttachmentFile === 'function') {
    try {
      const res = await win.logProDesktop.openAttachmentFile(workbookPath, relativePath)
      if (res && res.ok) {
        return ''
      }
      if (res && res.error) {
        return res.error
      }
    } catch {
      // Fall through to blob window fallback
    }
  }

  const newWindow = window.open('', '_blank')

  try {
    const res = await loadAttachment(workbookPath, relativePath)
    if (!res.ok) {
      if (newWindow) newWindow.close()
      return res.error
    }

    const url = URL.createObjectURL(res.blob)
    if (newWindow) {
      newWindow.location.href = url
    } else {
      // Fallback if popup blocked
      const a = document.createElement('a')
      a.href = url
      a.download = res.fileName
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    return ''
  } catch (err: any) {
    if (newWindow) newWindow.close()
    return err?.message || 'Could not open attachment.'
  }
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
  if (!api || typeof api.listAttachmentsForProcurement !== 'function') {
    return { ok: false, error: 'Desktop API not available.' }
  }

  const result = await api.listAttachmentsForProcurement(workbookPath, supplierName, procurementRef)
  if (result.error) {
    return { ok: false, error: result.error }
  }

  return { ok: true, files: result.files || [] }
}
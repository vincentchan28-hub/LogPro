// Keeps Log Specification files (PDF or image) inside the browser.
// The files are NOT stored in the Excel workbook - only their names are.

const DATABASE_NAME = 'logpro-log-specs'
const STORE_NAME = 'files'

export const MAX_SPEC_BYTES = 10 * 1024 * 1024

export type StoredSpec = {
  blob: Blob
  name: string
  type: string
}

export function makeSpecId(): string {
  return `spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function specTypeOf(file: File): string {
  if (file.type) {
    return file.type
  }
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf'
  }
  return 'application/octet-stream'
}

// Gives back a message if the file is not allowed, or empty text if it is fine.
export function checkSpecFile(file: File): string {
  const type = specTypeOf(file)
  const isPdf = type === 'application/pdf'
  const isImage = type.startsWith('image/')

  if (!isPdf && !isImage) {
    return 'Please choose a PDF or an image file (for example JPG or PNG).'
  }

  if (file.size > MAX_SPEC_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1)
    return `This file is ${sizeMb} MB. The limit is 10 MB per file.`
  }

  return ''
}

export function fileToSpec(file: File): StoredSpec {
  const type = specTypeOf(file)
  return { blob: new Blob([file], { type }), name: file.name, type }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))

    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export async function saveSpec(id: string, spec: StoredSpec): Promise<void> {
  try {
    // Asks the browser to keep the files safe. Fine if it says no.
    await navigator.storage?.persist?.()
  } catch {
    // Carry on without it.
  }

  await runRequest('readwrite', (store) => store.put(spec, id))
}

export async function loadSpec(id: string): Promise<StoredSpec | null> {
  const result = await runRequest<StoredSpec | undefined>('readonly', (store) =>
    store.get(id),
  )
  return result ?? null
}

export async function removeSpec(id: string): Promise<void> {
  if (!id) {
    return
  }

  try {
    await runRequest('readwrite', (store) => store.delete(id))
  } catch {
    // If it cannot be removed, carry on.
  }
}

// Opens the saved file in a new browser window. Gives back a message if it fails.
export async function openSpecInNewWindow(id: string): Promise<string> {
  // The window must be opened straight away, or the browser may block it.
  const newWindow = window.open('', '_blank')

  if (!newWindow) {
    return 'Your browser blocked the new window. Please allow pop-ups for this page and try again.'
  }

  try {
    const spec = await loadSpec(id)

    if (!spec) {
      newWindow.close()
      return 'The Log Specification file could not be found in this browser. Please attach it again.'
    }

    const url = URL.createObjectURL(new Blob([spec.blob], { type: spec.type }))
    newWindow.location.href = url
    return ''
  } catch {
    newWindow.close()
    return 'The Log Specification file could not be opened.'
  }
}
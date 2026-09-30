// Saves the custom logo. On the desktop app it is stored in:
// WorkbookFolder/Attachments/assets/logo.png
// In a normal browser it is kept in browser storage instead.

const MAX_LOGO_WIDTH = 112
const MAX_LOGO_HEIGHT = 128
const MAX_LOGO_SOURCE_BYTES = 10 * 1024 * 1024
const BROWSER_LOGO_KEY = 'logpro.customLogo.'

type DesktopLogoApi = {
  saveLogoFile: (
    workbookPath: string,
    base64Data: string,
  ) => Promise<{ ok: boolean; error?: string }>
  loadLogoFile: (
    workbookPath: string,
  ) => Promise<{ base64?: string; error?: string }>
  removeLogoFile: (
    workbookPath: string,
  ) => Promise<{ ok: boolean; error?: string }>
}

function getDesktopApi(): DesktopLogoApi | null {
  const api = (window as unknown as { logProDesktop?: Partial<DesktopLogoApi> })
    .logProDesktop
  if (
    api &&
    typeof api.saveLogoFile === 'function' &&
    typeof api.loadLogoFile === 'function' &&
    typeof api.removeLogoFile === 'function'
  ) {
    return api as DesktopLogoApi
  }
  return null
}

// Shrinks the picture (keeping its shape) so it fits the logo space.
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)

      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('This image could not be read.'))
        return
      }

      const scale = Math.min(
        1,
        MAX_LOGO_WIDTH / image.naturalWidth,
        MAX_LOGO_HEIGHT / image.naturalHeight,
      )
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Your computer could not resize this image.'))
        return
      }

      context.drawImage(image, 0, 0, width, height)
      resolve(canvas.toDataURL('image/png'))
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image could not be read. Try a PNG or JPG file.'))
    }

    image.src = url
  })
}

export async function saveLogo(
  workbookPath: string,
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!workbookPath) {
    return { ok: false, error: 'No workbook is open.' }
  }

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { ok: false, error: 'Please choose a PNG, JPG, WEBP, GIF or BMP image.' }
  }

  if (file.size > MAX_LOGO_SOURCE_BYTES) {
    return { ok: false, error: 'This image is bigger than 10 MB. Please choose a smaller one.' }
  }

  let dataUrl = ''
  try {
    dataUrl = await shrinkImage(file)
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Could not resize the image.' }
  }

  const desktop = getDesktopApi()

  if (desktop) {
    try {
      const base64 = dataUrl.split(',')[1] || ''
      const result = await desktop.saveLogoFile(workbookPath, base64)
      if (!result.ok) {
        return { ok: false, error: result.error || 'Could not save the logo.' }
      }
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Could not save the logo.' }
    }
    return { ok: true, dataUrl }
  }

  try {
    window.localStorage.setItem(`${BROWSER_LOGO_KEY}${workbookPath}`, dataUrl)
  } catch {
    return { ok: false, error: 'The browser could not store the logo.' }
  }
  return { ok: true, dataUrl }
}

// Gives back the saved logo as picture text, or empty text if there is none.
export async function loadLogo(workbookPath: string): Promise<string> {
  if (!workbookPath) return ''

  const desktop = getDesktopApi()

  if (desktop) {
    try {
      const result = await desktop.loadLogoFile(workbookPath)
      return result.base64 ? `data:image/png;base64,${result.base64}` : ''
    } catch {
      return ''
    }
  }

  try {
    return window.localStorage.getItem(`${BROWSER_LOGO_KEY}${workbookPath}`) ?? ''
  } catch {
    return ''
  }
}

export async function removeLogo(
  workbookPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const desktop = getDesktopApi()

  if (desktop) {
    try {
      const result = await desktop.removeLogoFile(workbookPath)
      if (!result.ok) {
        return { ok: false, error: result.error || 'Could not remove the logo.' }
      }
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Could not remove the logo.' }
    }
    return { ok: true }
  }

  try {
    window.localStorage.removeItem(`${BROWSER_LOGO_KEY}${workbookPath}`)
  } catch {
    // Nothing to remove.
  }
  return { ok: true }
}
export interface CollageResult {
  mimeType: string
  data: string
  width: number
  height: number
  count: number
}

const DEFAULT_MAX_IMAGES = 6
const DEFAULT_MAX_SIDE = 960
const CELL_SIZE = 640

function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

function resizeIntoCell(width: number, height: number, maxSide: number): { width: number; height: number } {
  const maxOriginalSide = Math.max(width, height)
  const resizeScale = Math.min(1, maxSide / maxOriginalSide)

  const resizedWidth = Math.max(1, Math.round(width * resizeScale))
  const resizedHeight = Math.max(1, Math.round(height * resizeScale))

  const fitScale = Math.min(CELL_SIZE / resizedWidth, CELL_SIZE / resizedHeight)
  return {
    width: Math.max(1, Math.round(resizedWidth * fitScale)),
    height: Math.max(1, Math.round(resizedHeight * fitScale)),
  }
}

export async function preprocessImagesToCollage(
  files: File[],
  options?: { maxImages?: number; maxSide?: number }
): Promise<CollageResult> {
  const maxImages = options?.maxImages ?? DEFAULT_MAX_IMAGES
  const maxSide = options?.maxSide ?? DEFAULT_MAX_SIDE

  if (files.length === 0) throw new Error('画像が選択されていません。')
  if (files.length > maxImages) throw new Error(`画像は最大${maxImages}枚までです。`)

  const bitmaps = await Promise.all(files.map(loadBitmap))

  try {
    const cols = Math.ceil(Math.sqrt(bitmaps.length))
    const rows = Math.ceil(bitmaps.length / cols)

    const canvas = document.createElement('canvas')
    canvas.width = cols * CELL_SIZE
    canvas.height = rows * CELL_SIZE

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画像処理に失敗しました。')

    ctx.fillStyle = '#111215'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    bitmaps.forEach((bitmap, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const { width, height } = resizeIntoCell(bitmap.width, bitmap.height, maxSide)

      const x = col * CELL_SIZE + Math.floor((CELL_SIZE - width) / 2)
      const y = row * CELL_SIZE + Math.floor((CELL_SIZE - height) / 2)

      ctx.drawImage(bitmap, x, y, width, height)
    })

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    const data = dataUrl.replace(/^data:image\/jpeg;base64,/, '')

    return {
      mimeType: 'image/jpeg',
      data,
      width: canvas.width,
      height: canvas.height,
      count: bitmaps.length,
    }
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close())
  }
}

/**
 * Downloadable prompt card JPEG for the detail modal.
 * Compact header (left meta height-capped; right-aligned ≤3 thumbs from
 * current gallery index, wrap) → CTA bar → full prompt body.
 * Accent palette random among 5 themes.
 */

const CARD_WIDTH = 1080
const CARD_RADIUS = 22
const PAD_X = 32
const PAD_TOP = 28
const BODY_PAD_Y = 20
const PAD_BOTTOM_BODY = 28
const CTA_BAR_H = 48
const TITLE_SIZE = 30
const TITLE_LINE_GAP = 4
const BODY_SIZE = 16
const BODY_LINE_GAP = 6
const RELAY_FONT = 15
const RELAY_PAD_X = 14
const RELAY_PAD_Y = 6
const PILL_FONT = 13
const PILL_PAD_X = 10
const PILL_PAD_Y = 5
const PILL_GAP = 6
const PILL_ROW_GAP = 6
const CTA_SIZE = 14
const COVER_RADIUS = 12
const LEFT_RIGHT_GAP = 20
const THUMB_GAP = 8
const MAX_THUMBS = 3
/** Reserved right band for thumbs (left meta uses the rest). */
const RIGHT_RESERVE_RATIO = 0.48
const META_GAP = 12
const HEADER_MIN_H = 72

const FONT_STACK =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

const CTA_BEFORE = '更多提示词，请关注'
const CTA_BRAND = '图美AI'
const CTA_AFTER = '公众号自动获取'

export type PaletteName = 'purple' | 'teal' | 'coral' | 'blue' | 'amber'

type Palette = {
  name: PaletteName
  accent: string
  soft: string
  softBorder: string
  softText: string
  ctaText: string
  border: string
}

const PALETTES: Palette[] = [
  {
    name: 'purple',
    accent: '#5b4fcf',
    soft: '#eeecfb',
    softBorder: '#d4caf5',
    softText: '#4a3fbb',
    ctaText: '#3d3a6b',
    border: '#d8cef0',
  },
  {
    name: 'teal',
    accent: '#0d9488',
    soft: '#e6f7f5',
    softBorder: '#b8e6e0',
    softText: '#0f766e',
    ctaText: '#134e4a',
    border: '#c5e8e3',
  },
  {
    name: 'coral',
    accent: '#e11d48',
    soft: '#ffe4ea',
    softBorder: '#fecdd3',
    softText: '#be123c',
    ctaText: '#881337',
    border: '#f8cdd6',
  },
  {
    name: 'blue',
    accent: '#2563eb',
    soft: '#e8effe',
    softBorder: '#c7d7fd',
    softText: '#1d4ed8',
    ctaText: '#1e3a8a',
    border: '#cdd9f8',
  },
  {
    name: 'amber',
    accent: '#d97706',
    soft: '#fff3df',
    softBorder: '#fde2b0',
    softText: '#b45309',
    ctaText: '#78350f',
    border: '#f5dfb8',
  },
]

export type PromptCardOptions = {
  content: string
  replyKeyword?: string
  title?: string
  keywords?: string[]
  /**
   * Gallery image URLs. Thumbs start at imageIndex, then next, wrapping.
   * Max 3 shown, packed by aspect into the right band.
   */
  imageUrls?: string[]
  /** Currently viewed gallery index (default 0). */
  imageIndex?: number
  /** Fallback single cover when imageUrls empty. */
  coverUrl?: string
}

function pickPalette(): Palette {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)]!
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const ch of paragraph) {
      const trial = current + ch
      if (ctx.measureText(trial).width > maxWidth && current.length > 0) {
        lines.push(current)
        current = ch
      } else {
        current = trial
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

function sanitizeFilenamePart(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildFilename(replyKeyword: string): string {
  return sanitizeFilenamePart(replyKeyword) || '提示词-图美AI'
}

function uniqueNonEmpty(words: string[] | undefined): string[] {
  if (!words || words.length === 0) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    const t = w.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

type PillLayout = { text: string; width: number; height: number }
type PillRow = { pills: PillLayout[]; width: number }

function measurePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  padX: number,
  padY: number,
  maxWidth: number,
): PillLayout {
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`
  const pillH = fontSize + padY * 2
  let label = text
  let tw = ctx.measureText(label).width
  const maxInner = Math.max(24, maxWidth - padX * 2)
  if (tw > maxInner) {
    const ell = '…'
    while (label.length > 1 && ctx.measureText(label + ell).width > maxInner) {
      label = label.slice(0, -1)
    }
    label = label + ell
    tw = ctx.measureText(label).width
  }
  return {
    text: label,
    width: Math.ceil(tw + padX * 2),
    height: pillH,
  }
}

function drawFilledPill(
  ctx: CanvasRenderingContext2D,
  pill: PillLayout,
  x: number,
  y: number,
  fontSize: number,
  padX: number,
  bg: string,
  fg: string,
  border?: string,
): void {
  roundRect(ctx, x, y, pill.width, pill.height, pill.height / 2)
  ctx.fillStyle = bg
  ctx.fill()
  if (border) {
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`
  ctx.fillStyle = fg
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(pill.text, x + padX, y + pill.height / 2)
}

function layoutPills(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number,
): { rows: PillRow[]; height: number; pillH: number } {
  if (words.length === 0) return { rows: [], height: 0, pillH: 0 }
  ctx.font = `600 ${PILL_FONT}px ${FONT_STACK}`
  const pillH = PILL_FONT + PILL_PAD_Y * 2
  const measured: PillLayout[] = words.map((text) => ({
    text,
    width: Math.ceil(ctx.measureText(text).width + PILL_PAD_X * 2),
    height: pillH,
  }))
  const rows: PillRow[] = []
  let row: PillLayout[] = []
  let rowW = 0
  for (const pill of measured) {
    const next = row.length === 0 ? pill.width : rowW + PILL_GAP + pill.width
    if (row.length > 0 && next > maxWidth) {
      rows.push({ pills: row, width: rowW })
      row = [pill]
      rowW = pill.width
    } else {
      row.push(pill)
      rowW = next
    }
  }
  if (row.length > 0) rows.push({ pills: row, width: rowW })
  const height =
    rows.length * pillH + Math.max(0, rows.length - 1) * PILL_ROW_GAP
  return { rows, height, pillH }
}

async function loadCoverImage(
  url: string | undefined,
): Promise<HTMLImageElement | null> {
  if (!url) return null
  try {
    const img = new Image()
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('cover load failed'))
      img.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) return null
    return img
  } catch {
    return null
  }
}

/** Ordered gallery URLs starting at current index, wrapping. */
function orderedGalleryUrls(
  urls: string[],
  imageIndex: number,
): string[] {
  if (urls.length === 0) return []
  const start =
    ((imageIndex % urls.length) + urls.length) % urls.length
  const out: string[] = []
  for (let i = 0; i < urls.length; i++) {
    out.push(urls[(start + i) % urls.length]!)
  }
  return out
}

type ThumbSlot = {
  img: HTMLImageElement
  w: number
  h: number
}

/**
 * Pack ≤3 thumbs into maxW × targetH.
 * Height prefers targetH (yellow-box / left meta band); width from aspect.
 * Landscape may fill with 1–2; portrait up to 3. Right-aligned later.
 */
function packThumbs(
  images: HTMLImageElement[],
  targetH: number,
  maxW: number,
): ThumbSlot[] {
  if (images.length === 0 || targetH <= 0 || maxW <= 0) return []
  const H = Math.max(24, targetH)
  const slots: ThumbSlot[] = []
  let used = 0

  for (const img of images.slice(0, MAX_THUMBS)) {
    const aspect = img.naturalWidth / img.naturalHeight
    let w = Math.max(1, Math.round(H * aspect))
    let h = H
    const gap = slots.length > 0 ? THUMB_GAP : 0
    const need = gap + w

    if (used + need <= maxW) {
      slots.push({ img, w, h })
      used += need
      continue
    }

    if (slots.length === 0) {
      // First image alone too wide at targetH — scale to fit maxW
      const scale = maxW / w
      w = maxW
      h = Math.max(1, Math.round(H * scale))
      slots.push({ img, w, h })
    }
    break
  }
  return slots
}

/**
 * Draw image at exact aspect size with a tight border hugging the pixels.
 * No white letterbox / fixed square frame.
 */
function drawCoverTight(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  borderColor: string,
): void {
  ctx.save()
  roundRect(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()

  roundRect(ctx, x, y, w, h, radius)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawCtaBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  palette: Palette,
): void {
  ctx.fillStyle = palette.soft
  ctx.fillRect(0, y, CARD_WIDTH, CTA_BAR_H)

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  const beforeW = ctx.measureText(CTA_BEFORE).width
  const afterW = ctx.measureText(CTA_AFTER).width
  const gapBefore = 7
  const gapAfter = 7
  ctx.font = `700 ${CTA_SIZE}px ${FONT_STACK}`
  const brandTw = ctx.measureText(CTA_BRAND).width
  const brandPadX = 9
  const brandPadY = 4
  const brandW = brandTw + brandPadX * 2
  const brandH = CTA_SIZE + brandPadY * 2
  const clusterW = beforeW + gapBefore + brandW + gapAfter + afterW
  const midY = y + CTA_BAR_H / 2
  let cx = CARD_WIDTH - PAD_X - clusterW

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = palette.ctaText
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(CTA_BEFORE, cx, midY)
  cx += beforeW + gapBefore

  roundRect(ctx, cx, midY - brandH / 2, brandW, brandH, 6)
  ctx.fillStyle = palette.accent
  ctx.fill()
  ctx.font = `700 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(CTA_BRAND, cx + brandW / 2, midY)
  cx += brandW + gapAfter

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = palette.ctaText
  ctx.textAlign = 'left'
  ctx.fillText(CTA_AFTER, cx, midY)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export type PromptCardResult = {
  blob: Blob
  filename: string
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: 'image/jpeg' | 'image/png',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('生成图片失败'))),
      mime,
      mime === 'image/jpeg' ? quality : undefined,
    )
  })
}

/**
 * Shared card renderer used by download + clipboard image copy.
 * Header (meta height-capped + ≤3 right thumbs) → CTA bar → prompt body.
 */
export async function generatePromptCard(
  options: PromptCardOptions,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<PromptCardResult> {
  const content = (options.content ?? '').replace(/\r\n/g, '\n')
  const replyKeyword = (options.replyKeyword ?? '').trim()
  const title = (options.title ?? '').trim()
  const keywords = uniqueNonEmpty(options.keywords).filter(
    (k) => k !== replyKeyword,
  )
  const palette = pickPalette()

  const rawUrls = (options.imageUrls ?? []).map((u) => u.trim()).filter(Boolean)
  if (rawUrls.length === 0 && options.coverUrl?.trim()) {
    rawUrls.push(options.coverUrl.trim())
  }
  const orderedUrls = orderedGalleryUrls(rawUrls, options.imageIndex ?? 0)
  const loaded = (
    await Promise.all(
      orderedUrls.slice(0, MAX_THUMBS).map((u) => loadCoverImage(u)),
    )
  ).filter((img): img is HTMLImageElement => img != null)

  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')

  const contentW = CARD_WIDTH - PAD_X * 2
  const rightMax = loaded.length
    ? Math.floor(contentW * RIGHT_RESERVE_RATIO)
    : 0
  const leftMaxW =
    contentW - (rightMax > 0 ? rightMax + LEFT_RIGHT_GAP : 0)

  const relayPill = replyKeyword
    ? measurePill(
        measure,
        replyKeyword,
        RELAY_FONT,
        RELAY_PAD_X,
        RELAY_PAD_Y,
        leftMaxW,
      )
    : null

  measure.font = `700 ${TITLE_SIZE}px ${FONT_STACK}`
  const titleLines = title ? wrapLines(measure, title, leftMaxW) : []
  const titleLineH = TITLE_SIZE + TITLE_LINE_GAP
  const titleBlockH = titleLines.length * titleLineH

  const pillLayout = layoutPills(measure, keywords, leftMaxW)

  const leftColH = Math.max(
    HEADER_MIN_H,
    (relayPill ? relayPill.height + META_GAP : 0) +
      (titleBlockH > 0 ? titleBlockH + META_GAP : 0) +
      pillLayout.height,
  )

  // Header height = yellow-box / left meta band (thumbs capped to this)
  const headerH = leftColH
  const thumbs = packThumbs(loaded, headerH, rightMax)
  const thumbsRowW =
    thumbs.reduce((s, t) => s + t.w, 0) +
    Math.max(0, thumbs.length - 1) * THUMB_GAP

  const textWidth = CARD_WIDTH - PAD_X * 2
  measure.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  const bodyLines = wrapLines(measure, content, textWidth)
  const bodyLineH = BODY_SIZE + BODY_LINE_GAP
  const bodyBlockH = Math.max(bodyLines.length, 1) * bodyLineH

  const afterHeaderGap = 16
  const height = Math.ceil(
    PAD_TOP +
      headerH +
      afterHeaderGap +
      CTA_BAR_H +
      BODY_PAD_Y +
      bodyBlockH +
      PAD_BOTTOM_BODY,
  )

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_WIDTH * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.scale(dpr, dpr)

  roundRect(ctx, 0, 0, CARD_WIDTH, height, CARD_RADIUS)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.save()
  roundRect(ctx, 0, 0, CARD_WIDTH, height, CARD_RADIUS)
  ctx.clip()

  const headerTop = PAD_TOP
  let y = headerTop

  if (relayPill) {
    drawFilledPill(
      ctx,
      relayPill,
      PAD_X,
      y,
      RELAY_FONT,
      RELAY_PAD_X,
      palette.accent,
      '#ffffff',
    )
    y += relayPill.height + META_GAP
  }

  if (titleLines.length > 0) {
    ctx.fillStyle = '#1a1a1f'
    ctx.font = `700 ${TITLE_SIZE}px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const line of titleLines) {
      ctx.fillText(line, PAD_X, y)
      y += titleLineH
    }
    y += META_GAP - TITLE_LINE_GAP
  }

  if (pillLayout.rows.length > 0) {
    let py = y
    for (const row of pillLayout.rows) {
      let px = PAD_X
      for (const pill of row.pills) {
        drawFilledPill(
          ctx,
          pill,
          px,
          py,
          PILL_FONT,
          PILL_PAD_X,
          palette.soft,
          palette.softText,
          palette.softBorder,
        )
        px += pill.width + PILL_GAP
      }
      py += pillLayout.pillH + PILL_ROW_GAP
    }
  }

  // Right-aligned thumb row (current → next → wrap), height ≤ header band
  if (thumbs.length > 0) {
    let tx = CARD_WIDTH - PAD_X - thumbsRowW
    for (const slot of thumbs) {
      const ty = headerTop + Math.max(0, (headerH - slot.h) / 2)
      drawCoverTight(
        ctx,
        slot.img,
        tx,
        ty,
        slot.w,
        slot.h,
        COVER_RADIUS,
        palette.accent,
      )
      tx += slot.w + THUMB_GAP
    }
  }

  const ctaY = PAD_TOP + headerH + afterHeaderGap
  drawCtaBar(ctx, ctaY, palette)

  const bodyStartY = ctaY + CTA_BAR_H + BODY_PAD_Y
  ctx.fillStyle = '#2a2a32'
  ctx.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let by = bodyStartY
  for (const line of bodyLines) {
    ctx.fillText(line, PAD_X, by)
    by += bodyLineH
  }

  ctx.restore()

  roundRect(ctx, 1, 1, CARD_WIDTH - 2, height - 2, CARD_RADIUS - 1)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.stroke()

  const ext = mime === 'image/png' ? 'png' : 'jpg'
  const filename = `${buildFilename(replyKeyword)}.${ext}`
  const blob = await canvasToBlob(canvas, mime)
  return { blob, filename }
}

/** Download the prompt card as JPEG. */
export async function downloadPromptCard(
  options: PromptCardOptions,
): Promise<void> {
  const { blob, filename } = await generatePromptCard(options, 'image/jpeg')
  triggerDownload(blob, filename)
}

/**
 * Copy the prompt-card image to the system clipboard (PNG for ClipboardItem).
 * Returns false if clipboard write is unsupported / denied.
 */
export async function copyPromptCardImage(
  options: PromptCardOptions,
): Promise<boolean> {
  const { blob } = await generatePromptCard(options, 'image/png')
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return false
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ])
    return true
  } catch {
    return false
  }
}

export const PROMPT_CARD_PALETTE_NAMES: PaletteName[] = PALETTES.map(
  (p) => p.name,
)

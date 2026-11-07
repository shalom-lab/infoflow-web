/**
 * Horizontal share-card JPEG for the detail modal download button.
 * Matches the 图美AI sample: left meta + right cover + bottom CTA bar.
 * Accent palette is picked at random per download (5 themes).
 */

const CARD_WIDTH = 1080
const CARD_RADIUS = 28
const PAD_X = 44
const PAD_TOP = 40
const PAD_BOTTOM_CONTENT = 36
const FOOTER_H = 64
const TITLE_SIZE = 36
const TITLE_LINE_GAP = 8
const RELAY_FONT = 17
const RELAY_PAD_X = 18
const RELAY_PAD_Y = 9
const PILL_FONT = 14
const PILL_PAD_X = 12
const PILL_PAD_Y = 6
const PILL_GAP = 8
const PILL_ROW_GAP = 8
const CTA_SIZE = 15
const COVER_SIZE = 280
const COVER_RADIUS = 22
const STACK_OFFSET = 10
const LEFT_RIGHT_GAP = 36

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
  stack: string
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
    stack: '#ddd6f8',
  },
  {
    name: 'teal',
    accent: '#0d9488',
    soft: '#e6f7f5',
    softBorder: '#b8e6e0',
    softText: '#0f766e',
    ctaText: '#134e4a',
    border: '#c5e8e3',
    stack: '#cfeceb',
  },
  {
    name: 'coral',
    accent: '#e11d48',
    soft: '#ffe4ea',
    softBorder: '#fecdd3',
    softText: '#be123c',
    ctaText: '#881337',
    border: '#f8cdd6',
    stack: '#fdd5dd',
  },
  {
    name: 'blue',
    accent: '#2563eb',
    soft: '#e8effe',
    softBorder: '#c7d7fd',
    softText: '#1d4ed8',
    ctaText: '#1e3a8a',
    border: '#cdd9f8',
    stack: '#d4e0fc',
  },
  {
    name: 'amber',
    accent: '#d97706',
    soft: '#fff3df',
    softBorder: '#fde2b0',
    softText: '#b45309',
    ctaText: '#78350f',
    border: '#f5dfb8',
    stack: '#f7e4c0',
  },
]

export type PromptCardOptions = {
  /** Unused on the horizontal share card; kept for call-site compat */
  content?: string
  /** reply_keyword — solid accent pill; also used for filename */
  replyKeyword?: string
  /** wechat_title — bold title */
  title?: string
  /** keywords[] — soft accent pills */
  keywords?: string[]
  /** First/cover image (object URL or https) */
  coverUrl?: string
  /** Optional second image for stacked peek behind cover */
  secondCoverUrl?: string
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
    ctx.lineWidth = 1.1
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

function drawCoverInto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  radius: number,
  borderColor: string,
): void {
  ctx.save()
  roundRect(ctx, x, y, size, size, radius)
  ctx.clip()
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
  ctx.restore()
  roundRect(ctx, x, y, size, size, radius)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawStackedCover(
  ctx: CanvasRenderingContext2D,
  cover: HTMLImageElement,
  second: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius: number,
  palette: Palette,
): void {
  // Back peek plate (slightly up/right) — sample style stacked card
  const backX = x + STACK_OFFSET
  const backY = y - STACK_OFFSET
  roundRect(ctx, backX, backY, size, size, radius)
  ctx.fillStyle = palette.stack
  ctx.fill()
  if (second) {
    ctx.save()
    roundRect(ctx, backX, backY, size, size, radius)
    ctx.clip()
    // Only show a thin top strip of the second image
    const scale = Math.max(size / second.naturalWidth, size / second.naturalHeight)
    const dw = second.naturalWidth * scale
    const dh = second.naturalHeight * scale
    ctx.globalAlpha = 0.85
    ctx.drawImage(second, backX + (size - dw) / 2, backY + (size - dh) / 2, dw, dh)
    ctx.restore()
  }
  roundRect(ctx, backX, backY, size, size, radius)
  ctx.strokeStyle = palette.softBorder
  ctx.lineWidth = 1
  ctx.stroke()

  drawCoverInto(ctx, cover, x, y, size, radius, palette.softBorder)
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

/**
 * Draw a horizontal share card and download as JPEG.
 * Palette is randomized among purple / teal / coral / blue / amber.
 */
export async function downloadPromptCard(
  options: PromptCardOptions,
): Promise<void> {
  const replyKeyword = (options.replyKeyword ?? '').trim()
  const title = (options.title ?? '').trim()
  const keywords = uniqueNonEmpty(options.keywords).filter(
    (k) => k !== replyKeyword,
  )
  const palette = pickPalette()

  const [coverImg, secondImg] = await Promise.all([
    loadCoverImage(options.coverUrl),
    loadCoverImage(options.secondCoverUrl),
  ])
  const hasCover = coverImg != null

  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')

  const coverBlockW = hasCover ? COVER_SIZE + STACK_OFFSET : 0
  const leftMaxW =
    CARD_WIDTH - PAD_X * 2 - (hasCover ? coverBlockW + LEFT_RIGHT_GAP : 0)

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

  const leftColH =
    (relayPill ? relayPill.height + 18 : 0) +
    (titleBlockH > 0 ? titleBlockH + 18 : 0) +
    pillLayout.height

  const coverBlockH = hasCover ? COVER_SIZE + STACK_OFFSET : 0
  const contentH = Math.max(leftColH, coverBlockH)
  const height = Math.ceil(
    PAD_TOP + contentH + PAD_BOTTOM_CONTENT + FOOTER_H,
  )

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_WIDTH * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.scale(dpr, dpr)

  // Card background with rounded corners
  roundRect(ctx, 0, 0, CARD_WIDTH, height, CARD_RADIUS)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.stroke()

  // Clip subsequent draws to rounded card
  ctx.save()
  roundRect(ctx, 0, 0, CARD_WIDTH, height, CARD_RADIUS)
  ctx.clip()

  // LEFT column — vertically centered in content band
  const contentTop = PAD_TOP + Math.max(0, (contentH - leftColH) / 2)
  let y = contentTop

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
    y += relayPill.height + 18
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
    y += 18 - TITLE_LINE_GAP
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

  // RIGHT cover
  if (hasCover && coverImg) {
    const coverX = CARD_WIDTH - PAD_X - COVER_SIZE - STACK_OFFSET
    const coverY = PAD_TOP + STACK_OFFSET + Math.max(0, (contentH - coverBlockH) / 2)
    drawStackedCover(
      ctx,
      coverImg,
      secondImg,
      coverX,
      coverY,
      COVER_SIZE,
      COVER_RADIUS,
      palette,
    )
  }

  // BOTTOM CTA bar
  const footerY = height - FOOTER_H
  ctx.fillStyle = palette.soft
  ctx.fillRect(0, footerY, CARD_WIDTH, FOOTER_H)

  // Measure CTA cluster and right-align
  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  const beforeW = ctx.measureText(CTA_BEFORE).width
  const afterW = ctx.measureText(CTA_AFTER).width
  const gapBefore = 8
  const gapAfter = 8
  ctx.font = `700 ${CTA_SIZE}px ${FONT_STACK}`
  const brandTw = ctx.measureText(CTA_BRAND).width
  const brandPadX = 10
  const brandPadY = 5
  const brandW = brandTw + brandPadX * 2
  const brandH = CTA_SIZE + brandPadY * 2
  const clusterW = beforeW + gapBefore + brandW + gapAfter + afterW
  const midY = footerY + FOOTER_H / 2
  let cx = CARD_WIDTH - PAD_X - clusterW

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = palette.ctaText
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(CTA_BEFORE, cx, midY)
  cx += beforeW + gapBefore

  roundRect(ctx, cx, midY - brandH / 2, brandW, brandH, 7)
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

  ctx.restore()

  // Outer border again on top of clip for crisp edge
  roundRect(ctx, 1, 1, CARD_WIDTH - 2, height - 2, CARD_RADIUS - 1)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.stroke()

  const filename = `${buildFilename(replyKeyword)}.jpg`
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('生成图片失败'))),
      'image/jpeg',
      0.92,
    )
  })
  triggerDownload(blob, filename)
}

/** Exported for tests / debugging */
export const PROMPT_CARD_PALETTE_NAMES: PaletteName[] = PALETTES.map(
  (p) => p.name,
)

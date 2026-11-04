/** Render prompt text as a shareable JPEG card matching the 图美AI sample layout. */

const CARD_WIDTH = 900
const PAD_X = 48
const PAD_TOP = 40
const PAD_BOTTOM = 48
const BODY_SIZE = 17
const LINE_GAP = 7
const TITLE_SIZE = 34
const CTA_SIZE = 16
const ROW_GAP = 22
const PILL_FONT = 15
const PILL_PAD_X = 14
const PILL_PAD_Y = 7
const PILL_GAP = 10
const PILL_ROW_GAP = 10
const RELAY_FONT = 18
const RELAY_PAD_X = 20
const RELAY_PAD_Y = 10
const PROMPT_LABEL_FONT = 14
const PROMPT_LABEL_PAD_X = 12
const PROMPT_LABEL_PAD_Y = 6

const PURPLE = '#5b4fcf'
const PURPLE_SOFT = '#eeecfb'
const PURPLE_SOFT_BORDER = '#cfc8f0'
const PURPLE_TEXT = '#4a3fbb'
const CTA_TEXT = '#3d3a6b'
const BODY_TEXT = '#2a2a32'
const TITLE_TEXT = '#1a1a1f'
const BORDER = '#d4c4e8'
const DIVIDER = '#d8d0f0'

const FONT_STACK =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

const CTA_BEFORE = '更多提示词 请关注 '
const CTA_BRAND = '图美AI'
const CTA_AFTER = ' 公众号自动获取'

export type PromptCardOptions = {
  content: string
  /** reply_keyword — top-left solid purple chip; also used for filename */
  replyKeyword?: string
  /** wechat_title — bold title under the top row */
  title?: string
  /** keywords[] — soft purple pills under the title */
  keywords?: string[]
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
  const cleaned = sanitizeFilenamePart(replyKeyword)
  return cleaned || '提示词-图美AI'
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

type PillLayout = {
  text: string
  width: number
  height: number
}

type PillRow = {
  pills: PillLayout[]
  width: number
}

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
    ctx.lineWidth = 1.25
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
  const measured: PillLayout[] = words.map((text) => {
    const tw = ctx.measureText(text).width
    return {
      text,
      width: Math.ceil(tw + PILL_PAD_X * 2),
      height: pillH,
    }
  })

  const rows: PillRow[] = []
  let row: PillLayout[] = []
  let rowW = 0

  for (const pill of measured) {
    const next =
      row.length === 0 ? pill.width : rowW + PILL_GAP + pill.width
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

function drawKeywordPills(
  ctx: CanvasRenderingContext2D,
  rows: PillRow[],
  startY: number,
  left: number,
): void {
  let y = startY
  for (const row of rows) {
    let x = left
    for (const pill of row.pills) {
      drawFilledPill(
        ctx,
        pill,
        x,
        y,
        PILL_FONT,
        PILL_PAD_X,
        PURPLE_SOFT,
        PURPLE_TEXT,
        PURPLE_SOFT_BORDER,
      )
      x += pill.width + PILL_GAP
    }
    y += row.pills[0].height + PILL_ROW_GAP
  }
}

/** Right-aligned CTA with 图美AI highlighted in a purple badge. */
function measureCta(ctx: CanvasRenderingContext2D): {
  width: number
  height: number
  brandW: number
  brandH: number
  beforeW: number
  afterW: number
} {
  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  const beforeW = ctx.measureText(CTA_BEFORE).width
  const afterW = ctx.measureText(CTA_AFTER).width
  ctx.font = `700 ${CTA_SIZE}px ${FONT_STACK}`
  const brandTw = ctx.measureText(CTA_BRAND).width
  const brandPadX = 8
  const brandPadY = 4
  const brandW = brandTw + brandPadX * 2
  const brandH = CTA_SIZE + brandPadY * 2
  const width = beforeW + brandW + afterW
  const height = Math.max(CTA_SIZE + 4, brandH)
  return { width, height, brandW, brandH, beforeW, afterW }
}

function drawCta(
  ctx: CanvasRenderingContext2D,
  right: number,
  midY: number,
  metrics: ReturnType<typeof measureCta>,
): void {
  const startX = right - metrics.width
  const baseline = midY

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = CTA_TEXT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(CTA_BEFORE, startX, baseline)

  const brandX = startX + metrics.beforeW
  const brandY = baseline - metrics.brandH / 2
  // Slightly rounded rect (not full pill) for brand badge
  roundRect(ctx, brandX, brandY, metrics.brandW, metrics.brandH, 6)
  ctx.fillStyle = PURPLE
  ctx.fill()

  ctx.font = `700 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(CTA_BRAND, brandX + metrics.brandW / 2, baseline)

  ctx.font = `500 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.fillStyle = CTA_TEXT
  ctx.textAlign = 'left'
  ctx.fillText(CTA_AFTER, brandX + metrics.brandW, baseline)
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
 * Draw a light prompt card on canvas and download as JPEG.
 *
 * Sample layout:
 *  1) Top row: solid purple reply_keyword (left) + CTA with 图美AI badge (right)
 *  2) Bold wechat_title
 *  3) Soft keyword pills
 *  4) Divider
 *  5) 「Prompt」 label + prompt body
 */
export async function downloadPromptCard(
  options: PromptCardOptions,
): Promise<void> {
  const content = options.content ?? ''
  const replyKeyword = (options.replyKeyword ?? '').trim()
  const title = (options.title ?? '').trim()
  const keywords = uniqueNonEmpty(options.keywords).filter(
    (k) => k !== replyKeyword,
  )
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const textWidth = CARD_WIDTH - PAD_X * 2

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')

  const ctaMetrics = measureCta(measure)
  const relayMax = Math.floor(textWidth - ctaMetrics.width - 24)
  const relayPill = replyKeyword
    ? measurePill(
        measure,
        replyKeyword,
        RELAY_FONT,
        RELAY_PAD_X,
        RELAY_PAD_Y,
        Math.max(80, relayMax),
      )
    : null
  const topRowH = Math.max(
    relayPill?.height ?? 0,
    ctaMetrics.height,
    RELAY_FONT + RELAY_PAD_Y * 2,
  )

  measure.font = `700 ${TITLE_SIZE}px ${FONT_STACK}`
  const titleLines = title ? wrapLines(measure, title, textWidth) : []
  const titleLineH = TITLE_SIZE + 8
  const titleBlockH = titleLines.length * titleLineH

  const pillLayout = layoutPills(measure, keywords, textWidth)
  const pillsBlockH = pillLayout.height

  const promptLabel = measurePill(
    measure,
    'Prompt',
    PROMPT_LABEL_FONT,
    PROMPT_LABEL_PAD_X,
    PROMPT_LABEL_PAD_Y,
    200,
  )

  measure.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  const bodyLines = wrapLines(measure, content, textWidth)
  const bodyLineH = BODY_SIZE + LINE_GAP
  const bodyBlockH = Math.max(bodyLines.length, 1) * bodyLineH

  let yCursor = PAD_TOP + topRowH
  yCursor += ROW_GAP
  const titleStartY = yCursor
  yCursor += titleBlockH > 0 ? titleBlockH + 16 : 0
  const pillsStartY = yCursor
  yCursor += pillsBlockH > 0 ? pillsBlockH + 20 : 0
  const dividerY = yCursor
  yCursor += 20
  const promptLabelY = yCursor
  yCursor += promptLabel.height + 14
  const bodyStartY = yCursor
  yCursor += bodyBlockH + PAD_BOTTOM
  const height = Math.ceil(yCursor)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_WIDTH * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  ctx.scale(dpr, dpr)

  // Background + soft purple outer border (sample style)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_WIDTH, height)
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, height - 2)

  // 1) Top row: relay left + CTA right (same line)
  const topMidY = PAD_TOP + topRowH / 2
  if (relayPill) {
    drawFilledPill(
      ctx,
      relayPill,
      PAD_X,
      PAD_TOP + (topRowH - relayPill.height) / 2,
      RELAY_FONT,
      RELAY_PAD_X,
      PURPLE,
      '#ffffff',
    )
  }
  drawCta(ctx, CARD_WIDTH - PAD_X, topMidY, ctaMetrics)

  // 2) Bold title
  if (titleLines.length > 0) {
    ctx.fillStyle = TITLE_TEXT
    ctx.font = `700 ${TITLE_SIZE}px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let ty = titleStartY
    for (const line of titleLines) {
      ctx.fillText(line, PAD_X, ty)
      ty += titleLineH
    }
  }

  // 3) Keyword pills (left-aligned)
  if (pillLayout.rows.length > 0) {
    drawKeywordPills(ctx, pillLayout.rows, pillsStartY, PAD_X)
  }

  // 4) Divider
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(PAD_X, dividerY)
  ctx.lineTo(CARD_WIDTH - PAD_X, dividerY)
  ctx.stroke()

  // 5) Prompt label + body
  drawFilledPill(
    ctx,
    promptLabel,
    PAD_X,
    promptLabelY,
    PROMPT_LABEL_FONT,
    PROMPT_LABEL_PAD_X,
    PURPLE_SOFT,
    PURPLE_TEXT,
    PURPLE_SOFT_BORDER,
  )

  ctx.fillStyle = BODY_TEXT
  ctx.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  let by = bodyStartY
  for (const line of bodyLines) {
    ctx.fillText(line, PAD_X, by)
    by += bodyLineH
  }

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

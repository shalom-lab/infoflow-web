/** Render prompt text as a shareable PNG card and trigger browser download. */

const CTA = '更多提示词 请关注 图美AI 公众号自动获取'
const CARD_WIDTH = 900
const PAD_X = 48
const PAD_TOP = 36
const PAD_BOTTOM = 48
const CTA_SIZE = 26
const BODY_SIZE = 18
const LINE_GAP = 8
const DASH_GAP = 18
const ROW_GAP = 18
const PILL_FONT = 16
const PILL_PAD_X = 14
const PILL_PAD_Y = 7
const PILL_GAP = 10
const PILL_ROW_GAP = 10
const TOP_PILL_FONT = 17
const TOP_PILL_PAD_X = 16
const TOP_PILL_PAD_Y = 8
/** Light lavender fill / purple border+text matching app reply_keyword chip */
const PILL_BG = '#eeecfb'
const PILL_BORDER = '#5b4fcf'
const PILL_TEXT = '#5b4fcf'
/** Softer chip for wechat_title / tag on the top-right */
const TAG_BG = '#f3f1ec'
const TAG_BORDER = '#c8c3b8'
const TAG_TEXT = '#3a3a42'
const FONT_STACK =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

export type PromptCardOptions = {
  content: string
  /** reply_keyword — top-left purple chip; also used for filename */
  replyKeyword?: string
  /**
   * Category/title tag for top-right (wechat_title — not the keywords list).
   * Schema has no separate `tag` field.
   */
  tag?: string
  /** keywords[] — purple pills below the dashed line */
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

/** Filename = reply_keyword (relay word); filesystem-safe Chinese OK. */
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

type PillStyle = {
  bg: string
  border: string
  text: string
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

function drawOnePill(
  ctx: CanvasRenderingContext2D,
  pill: PillLayout,
  x: number,
  y: number,
  fontSize: number,
  padX: number,
  style: PillStyle,
): void {
  roundRect(ctx, x, y, pill.width, pill.height, pill.height / 2)
  ctx.fillStyle = style.bg
  ctx.fill()
  ctx.strokeStyle = style.border
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.font = `600 ${fontSize}px ${FONT_STACK}`
  ctx.fillStyle = style.text
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

function drawPills(
  ctx: CanvasRenderingContext2D,
  rows: PillRow[],
  startY: number,
  pillH: number,
  contentLeft: number,
  contentWidth: number,
): void {
  ctx.font = `600 ${PILL_FONT}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  let y = startY
  for (const row of rows) {
    let x = contentLeft + Math.max(0, (contentWidth - row.width) / 2)
    for (const pill of row.pills) {
      drawOnePill(ctx, pill, x, y, PILL_FONT, PILL_PAD_X, {
        bg: PILL_BG,
        border: PILL_BORDER,
        text: PILL_TEXT,
      })
      x += pill.width + PILL_GAP
    }
    y += pillH + PILL_ROW_GAP
  }
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
 * Layout:
 *  1) Top row: reply_keyword (left purple) + wechat_title tag (right)
 *  2) CTA follow-account line
 *  3) Dashed divider
 *  4) keywords pills (if any)
 *  5) Prompt body
 */
export async function downloadPromptCard(
  options: PromptCardOptions,
): Promise<void> {
  const content = options.content ?? ''
  const replyKeyword = (options.replyKeyword ?? '').trim()
  const tag = (options.tag ?? '').trim()
  const keywords = uniqueNonEmpty(options.keywords).filter(
    (k) => k !== replyKeyword,
  )
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const textWidth = CARD_WIDTH - PAD_X * 2

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')

  // Top row pills (each may take up to ~48% so they don't collide)
  const topMaxEach = Math.floor(textWidth * 0.48)
  const topPillH = TOP_PILL_FONT + TOP_PILL_PAD_Y * 2
  const leftPill = replyKeyword
    ? measurePill(
        measure,
        replyKeyword,
        TOP_PILL_FONT,
        TOP_PILL_PAD_X,
        TOP_PILL_PAD_Y,
        topMaxEach,
      )
    : null
  const rightPill = tag
    ? measurePill(
        measure,
        tag,
        TOP_PILL_FONT,
        TOP_PILL_PAD_X,
        TOP_PILL_PAD_Y,
        topMaxEach,
      )
    : null
  const topRowH = leftPill || rightPill ? topPillH : 0

  measure.font = `600 ${CTA_SIZE}px ${FONT_STACK}`
  const ctaLines = wrapLines(measure, CTA, textWidth)
  const ctaLineH = CTA_SIZE + 6
  const ctaBlockH = ctaLines.length * ctaLineH

  measure.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  const bodyLines = wrapLines(measure, content, textWidth)
  const bodyLineH = BODY_SIZE + LINE_GAP

  const afterTop = topRowH > 0 ? ROW_GAP : 0
  const ctaStartY = PAD_TOP + topRowH + afterTop
  const dashY = ctaStartY + ctaBlockH + DASH_GAP

  const pillLayout = layoutPills(measure, keywords, textWidth)
  const pillsBlockH = pillLayout.height
  const afterDashGap = DASH_GAP + 4
  const pillsStartY = dashY + afterDashGap
  const betweenPillsAndBody = pillsBlockH > 0 ? 20 : 0
  const bodyStartY =
    pillsStartY + pillsBlockH + (pillsBlockH > 0 ? betweenPillsAndBody : 0)
  const bodyBlockH = Math.max(bodyLines.length, 1) * bodyLineH
  const height = Math.ceil(bodyStartY + bodyBlockH + PAD_BOTTOM)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CARD_WIDTH * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_WIDTH, height)

  ctx.strokeStyle = '#e8e4dc'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, CARD_WIDTH - 1, height - 1)

  // 1) Top row: relay left, tag right
  if (leftPill) {
    drawOnePill(ctx, leftPill, PAD_X, PAD_TOP, TOP_PILL_FONT, TOP_PILL_PAD_X, {
      bg: PILL_BG,
      border: PILL_BORDER,
      text: PILL_TEXT,
    })
  }
  if (rightPill) {
    const rx = CARD_WIDTH - PAD_X - rightPill.width
    drawOnePill(ctx, rightPill, rx, PAD_TOP, TOP_PILL_FONT, TOP_PILL_PAD_X, {
      bg: TAG_BG,
      border: TAG_BORDER,
      text: TAG_TEXT,
    })
  }

  // 2) CTA
  ctx.fillStyle = '#1a1a1f'
  ctx.font = `600 ${CTA_SIZE}px ${FONT_STACK}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  let y = ctaStartY
  for (const line of ctaLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += ctaLineH
  }

  // 3) Dashed divider
  ctx.strokeStyle = '#c8c3b8'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 7])
  ctx.beginPath()
  ctx.moveTo(PAD_X, dashY)
  ctx.lineTo(CARD_WIDTH - PAD_X, dashY)
  ctx.stroke()
  ctx.setLineDash([])

  // 4) Keyword pills
  if (pillLayout.rows.length > 0) {
    drawPills(
      ctx,
      pillLayout.rows,
      pillsStartY,
      pillLayout.pillH,
      PAD_X,
      textWidth,
    )
  }

  // 5) Body
  ctx.fillStyle = '#2a2a32'
  ctx.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  y = bodyStartY
  for (const line of bodyLines) {
    ctx.fillText(line, PAD_X, y)
    y += bodyLineH
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

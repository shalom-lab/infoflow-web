/** Render prompt text as a shareable PNG card and trigger browser download. */

const HEADER = '更多提示词 请关注 图美AI 公众号自动获取'
const CARD_WIDTH = 900
const PAD_X = 48
const PAD_TOP = 44
const PAD_BOTTOM = 48
const HEADER_SIZE = 28
const BODY_SIZE = 18
const LINE_GAP = 8
const DASH_GAP = 18
const PILL_FONT = 16
const PILL_PAD_X = 14
const PILL_PAD_Y = 7
const PILL_GAP = 10
const PILL_ROW_GAP = 10
/** Light lavender fill / purple border+text matching app reply_keyword chip */
const PILL_BG = '#eeecfb'
const PILL_BORDER = '#5b4fcf'
const PILL_TEXT = '#5b4fcf'
const FONT_STACK =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

export type PromptCardOptions = {
  content: string
  /** Used to build a safe filename; falls back to 提示词-图美AI.png */
  title?: string
  /**
   * Relay / reply keywords to draw as purple pills
   * (typically `reply_keyword`, optionally plus `keywords`).
   */
  relayWords?: string[]
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

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
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
    // Center each row within the content column
    let x = contentLeft + Math.max(0, (contentWidth - row.width) / 2)
    for (const pill of row.pills) {
      roundRect(ctx, x, y, pill.width, pillH, pillH / 2)
      ctx.fillStyle = PILL_BG
      ctx.fill()
      ctx.strokeStyle = PILL_BORDER
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.fillStyle = PILL_TEXT
      ctx.fillText(pill.text, x + PILL_PAD_X, y + pillH / 2)
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
 * Draw a light prompt card on canvas and download as PNG.
 * Uses devicePixelRatio for crisp text on HiDPI screens.
 */
export async function downloadPromptCard(
  options: PromptCardOptions,
): Promise<void> {
  const content = options.content ?? ''
  const relayWords = uniqueNonEmpty(options.relayWords)
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
  const textWidth = CARD_WIDTH - PAD_X * 2

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas 不可用')

  measure.font = `600 ${HEADER_SIZE}px ${FONT_STACK}`
  const headerLines = wrapLines(measure, HEADER, textWidth)
  const headerLineH = HEADER_SIZE + 6

  measure.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  const bodyLines = wrapLines(measure, content, textWidth)
  const bodyLineH = BODY_SIZE + LINE_GAP

  const headerBlockH = headerLines.length * headerLineH
  const dashY = PAD_TOP + headerBlockH + DASH_GAP

  const pillLayout = layoutPills(measure, relayWords, textWidth)
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

  // Header
  ctx.fillStyle = '#1a1a1f'
  ctx.font = `600 ${HEADER_SIZE}px ${FONT_STACK}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  let y = PAD_TOP
  for (const line of headerLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += headerLineH
  }

  // Dashed divider
  ctx.strokeStyle = '#c8c3b8'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 7])
  ctx.beginPath()
  ctx.moveTo(PAD_X, dashY)
  ctx.lineTo(CARD_WIDTH - PAD_X, dashY)
  ctx.stroke()
  ctx.setLineDash([])

  // Relay-word purple pills
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

  // Body prompt text
  ctx.fillStyle = '#2a2a32'
  ctx.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  y = bodyStartY
  for (const line of bodyLines) {
    ctx.fillText(line, PAD_X, y)
    y += bodyLineH
  }

  const filename = `${sanitizeFilename(options.title ?? '')}.png`

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('生成图片失败'))),
      'image/png',
    )
  })

  triggerDownload(blob, filename)
}

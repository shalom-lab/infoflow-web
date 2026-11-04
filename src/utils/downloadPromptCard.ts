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
const FONT_STACK =
  '"PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'

export type PromptCardOptions = {
  content: string
  /** Used to build a safe filename; falls back to 提示词-图美AI.png */
  title?: string
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
  const bodyStartY = dashY + DASH_GAP + 4
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

  ctx.fillStyle = '#1a1a1f'
  ctx.font = `600 ${HEADER_SIZE}px ${FONT_STACK}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  let y = PAD_TOP
  for (const line of headerLines) {
    ctx.fillText(line, CARD_WIDTH / 2, y)
    y += headerLineH
  }

  ctx.strokeStyle = '#c8c3b8'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 7])
  ctx.beginPath()
  ctx.moveTo(PAD_X, dashY)
  ctx.lineTo(CARD_WIDTH - PAD_X, dashY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#2a2a32'
  ctx.font = `400 ${BODY_SIZE}px ${FONT_STACK}`
  ctx.textAlign = 'left'
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

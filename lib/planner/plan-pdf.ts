import type { StoryPlanRecord } from "./types"
import { secondPersonDirection } from "./voice"

type PdfRun = {
  text: string
  size?: number
  bold?: boolean
  indent?: number
  color?: [number, number, number]
  gapBefore?: number
  gapAfter?: number
}

type PageState = { commands: string[]; y: number; pageNumber: number }

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const TOP_Y = 738
const BOTTOM_Y = 54
const BODY_WIDTH = PAGE_WIDTH - MARGIN_X * 2

export function downloadStoryPlanPdf(plan: StoryPlanRecord) {
  const bytes = buildStoryPlanPdf(plan)
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${slugify(plan.output.title || "story-plan")}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function buildStoryPlanPdf(plan: StoryPlanRecord): Uint8Array {
  const pages: PageState[] = []
  let page = newPage(pages)

  function ensureSpace(points: number) {
    if (page.y - points < BOTTOM_Y) page = newPage(pages)
  }

  function addLine(run: PdfRun) {
    const size = run.size ?? 10.5
    const indent = run.indent ?? 0
    const maxWidth = BODY_WIDTH - indent
    const lines = wrapText(run.text, size, maxWidth)
    const lineHeight = Math.max(14, size * 1.45)
    const before = run.gapBefore ?? 0
    const after = run.gapAfter ?? 0
    ensureSpace(before + lines.length * lineHeight + after)
    page.y -= before
    for (const line of lines) {
      page.commands.push(textCommand(line, MARGIN_X + indent, page.y, size, Boolean(run.bold), run.color))
      page.y -= lineHeight
    }
    page.y -= after
  }

  function addRule(gapBefore = 8, gapAfter = 14) {
    ensureSpace(gapBefore + gapAfter + 2)
    page.y -= gapBefore
    page.commands.push(`0.86 0.86 0.84 RG 0.7 w ${MARGIN_X} ${page.y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN_X).toFixed(2)} ${page.y.toFixed(2)} l S`)
    page.y -= gapAfter
  }

  function addSection(title: string) {
    addLine({ text: title.toUpperCase(), size: 8.5, bold: true, color: [0.18, 0.43, 0.75], gapBefore: 10, gapAfter: 7 })
  }

  function addBullet(text: string, index?: number) {
    const prefix = typeof index === "number" ? `${index}. ` : "- "
    addLine({ text: `${prefix}${text}`, size: 10.2, indent: 12, gapAfter: 4 })
  }

  addLine({ text: "TELLWISE STORY PLAN", size: 9, bold: true, color: [0.18, 0.43, 0.75], gapAfter: 8 })
  addLine({ text: plan.output.title, size: 23, bold: true, color: [0.12, 0.11, 0.10], gapAfter: 6 })
  addLine({ text: secondPersonDirection(plan.output.throughline), size: 11.5, color: [0.35, 0.34, 0.32], gapAfter: 8 })
  addRule(4, 12)

  addSection("Context")
  addLine({ text: `Where you are telling it: ${plan.audienceContext}`, size: 10.2, gapAfter: 4 })
  addLine({ text: `What you want to get across: ${plan.goal}`, size: 10.2, gapAfter: 4 })

  addSection("Opening")
  addLine({ text: secondPersonDirection(plan.output.opening), size: 10.5, gapAfter: 4 })

  addSection("Story beats")
  plan.output.beats.forEach((beat, index) => {
    addLine({ text: `${index + 1}. ${beat.label}`, size: 10.5, bold: true, gapAfter: 1 })
    addLine({ text: secondPersonDirection(beat.purpose), size: 9.5, bold: true, indent: 18, color: [0.18, 0.43, 0.75], gapAfter: 1 })
    addLine({ text: secondPersonDirection(beat.suggestion), size: 10, indent: 18, color: [0.35, 0.34, 0.32], gapAfter: 7 })
  })

  addSection("Landing")
  addLine({ text: secondPersonDirection(plan.output.ending), size: 10.5, gapAfter: 4 })

  if (plan.output.keep.length) {
    addSection("Keep these details")
    plan.output.keep.map(secondPersonDirection).forEach((item) => addBullet(item))
  }

  if (plan.output.clarify.length) {
    addSection("Clarify before telling")
    plan.output.clarify.map(secondPersonDirection).forEach((item) => addBullet(item))
  }

  addSection("Two things to remember")
  plan.output.deliveryTips.slice(0, 2).map(secondPersonDirection).forEach((item, index) => addBullet(item, index + 1))

  if (plan.output.reassurance?.trim()) {
    addRule(10, 10)
    addLine({ text: secondPersonDirection(plan.output.reassurance), size: 10.2, color: [0.28, 0.27, 0.25], gapAfter: 4 })
  }

  pages.forEach((item, index) => {
    item.commands.push(textCommand(`Tellwise  -  ${index + 1} / ${pages.length}`, MARGIN_X, 28, 8, false, [0.48, 0.47, 0.44]))
  })

  return encodePdf(pages)
}

function newPage(pages: PageState[]): PageState {
  const page = { commands: [], y: TOP_Y, pageNumber: pages.length + 1 }
  pages.push(page)
  return page
}

function wrapText(value: string, fontSize: number, maxWidth: number) {
  const clean = ascii(value).replace(/\s+/g, " ").trim()
  if (!clean) return [""]
  const averageCharWidth = fontSize * 0.52
  const maxChars = Math.max(18, Math.floor(maxWidth / averageCharWidth))
  const words = clean.split(" ")
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= maxChars) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (word.length <= maxChars) {
      line = word
    } else {
      let rest = word
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars))
        rest = rest.slice(maxChars)
      }
      line = rest
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

function textCommand(text: string, x: number, y: number, size: number, bold: boolean, color: [number, number, number] = [0.16, 0.15, 0.14]) {
  const [r, g, b] = color
  return `BT ${r} ${g} ${b} rg /${bold ? "F2" : "F1"} ${size.toFixed(2)} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfString(ascii(text))}) Tj ET`
}

function encodePdf(pages: PageState[]): Uint8Array {
  const objects: string[] = []
  const pageIds = pages.map((_, index) => 6 + index * 2)
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`

  pages.forEach((page, index) => {
    const contentId = 5 + index * 2
    const pageId = 6 + index * 2
    const stream = page.commands.join("\n")
    objects[contentId] = `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
  })

  let pdf = "%PDF-1.4\n%Tellwise\n"
  const offsets: number[] = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = byteLength(pdf)
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = byteLength(pdf)
  pdf += `xref\n0 ${objects.length}\n`
  pdf += "0000000000 65535 f \n"
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

function ascii(value: string) {
  return String(value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n\r\t]/g, "?")
}

function escapePdfString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function slugify(value: string) {
  return ascii(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "story-plan"
}

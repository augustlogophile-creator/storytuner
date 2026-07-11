import type { ReactNode } from "react"

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}

export function RichText({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n")
  const output: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line || line === "---") {
      index += 1
      continue
    }
    if (line.startsWith("> ")) {
      const quote: string[] = []
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quote.push(lines[index].trim().slice(2))
        index += 1
      }
      output.push(
        <blockquote key={`q-${index}`} className="rounded-3xl border-l-4 border-brand bg-brand-soft/50 p-5 text-sm leading-relaxed text-foreground">
          {quote.map((item, quoteIndex) => <p key={quoteIndex} className={quoteIndex ? "mt-3" : ""}>{inline(item)}</p>)}
        </blockquote>,
      )
      continue
    }
    if (/^\|.+\|$/.test(line) && index + 1 < lines.length && /^\|[-| :]+\|$/.test(lines[index + 1].trim())) {
      const rows: string[][] = []
      while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
        rows.push(lines[index].trim().slice(1, -1).split("|").map((cell) => cell.trim()))
        index += 1
      }
      const [head, , ...body] = rows
      output.push(
        <div key={`t-${index}`} className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary"><tr>{head.map((cell, i) => <th key={i} className="p-3 font-semibold">{inline(cell)}</th>)}</tr></thead>
            <tbody>{body.map((row, r) => <tr key={r} className="border-t border-border">{row.map((cell, c) => <td key={c} className="p-3 align-top leading-relaxed text-muted-foreground">{inline(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*] /.test(lines[index].trim())) {
        items.push(lines[index].trim().slice(2))
        index += 1
      }
      output.push(<ul key={`ul-${index}`} className="space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">{items.map((item, i) => <li key={i} className="list-disc pl-1 marker:text-brand">{inline(item)}</li>)}</ul>)
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\. /.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\. /, ""))
        index += 1
      }
      output.push(<ol key={`ol-${index}`} className="space-y-3 pl-5 text-sm leading-relaxed text-foreground/90">{items.map((item, i) => <li key={i} className="list-decimal pl-1 marker:font-semibold marker:text-accent-foreground">{inline(item)}</li>)}</ol>)
      continue
    }
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index].trim()
      if (!next || next.startsWith("> ") || /^[-*] /.test(next) || /^\d+\. /.test(next) || /^\|.+\|$/.test(next)) break
      paragraph.push(next)
      index += 1
    }
    output.push(<p key={`p-${index}`} className="text-[0.95rem] leading-7 text-foreground/90 text-pretty">{inline(paragraph.join(" "))}</p>)
  }
  return <div className="flex flex-col gap-4">{output}</div>
}

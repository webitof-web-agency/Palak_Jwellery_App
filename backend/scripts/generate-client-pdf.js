import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '../..')
const mdPath = path.resolve(rootDir, 'docs/CLIENT_USER_GUIDE.md')
const pdfPath = path.resolve(rootDir, 'docs/CLIENT_USER_GUIDE.pdf')

const escapeHtml = (unsafe) =>
  String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const parseMarkdownToHtml = (mdContent) => {
  const lines = mdContent.split('\n')
  let htmlResult = ''
  let inMermaid = false
  let mermaidCode = ''
  let inList = false
  let listType = '' // 'ul' or 'ol'
  let inTable = false
  let tableRows = []

  const closeList = () => {
    if (inList) {
      htmlResult += `</${listType}>\n`
      inList = false
    }
  }

  const closeTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<table>\n'
      // Parse header row
      const headerCols = tableRows[0].split('|').map(s => s.trim()).filter(Boolean)
      tableHtml += '  <thead>\n    <tr>\n'
      for (const col of headerCols) {
        tableHtml += `      <th>${col}</th>\n`
      }
      tableHtml += '    </tr>\n  </thead>\n  <tbody>\n'

      // Skip alignment row (index 1) and parse body rows
      for (let i = 2; i < tableRows.length; i++) {
        const cols = tableRows[i].split('|').map(s => s.trim()).filter(Boolean)
        if (cols.length === 0) continue
        tableHtml += '    <tr>\n'
        for (const col of cols) {
          tableHtml += `      <td>${col}</td>\n`
        }
        tableHtml += '    </tr>\n'
      }
      tableHtml += '  </tbody>\n</table>\n'
      htmlResult += tableHtml
      inTable = false
      tableRows = []
    }
  }

  for (let line of lines) {
    // Trim right but keep left spacing for markdown context if needed
    const trimmed = line.trim()

    // Handle Mermaid Code Block
    if (trimmed.startsWith('```mermaid')) {
      closeList()
      closeTable()
      inMermaid = true
      mermaidCode = ''
      continue
    }

    if (inMermaid) {
      if (trimmed.startsWith('```')) {
        inMermaid = false
        htmlResult += `<div class="mermaid">\n${mermaidCode}\n</div>\n`
      } else {
        mermaidCode += line + '\n'
      }
      continue
    }

    // Handle standard table blocks
    if (trimmed.startsWith('|')) {
      closeList()
      inTable = true
      tableRows.push(line)
      continue
    } else {
      closeTable()
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      closeList()
      const content = parseInlineMarkdown(trimmed.slice(4))
      htmlResult += `<h3>${content}</h3>\n`
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      const content = parseInlineMarkdown(trimmed.slice(3))
      htmlResult += `<h2>${content}</h2>\n`
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeList()
      const content = parseInlineMarkdown(trimmed.slice(2))
      htmlResult += `<h1>${content}</h1>\n`
      continue
    }

    // Horizontal Rule
    if (trimmed === '---') {
      closeList()
      htmlResult += '<hr />\n'
      continue
    }

    // Ordered lists
    const olMatch = trimmed.match(/^\d+\.\s+(.*)/)
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList()
        inList = true
        listType = 'ol'
        htmlResult += '<ol>\n'
      }
      const itemContent = parseInlineMarkdown(olMatch[1])
      htmlResult += `  <li>${itemContent}</li>\n`
      continue
    }

    // Unordered lists
    const ulMatch = trimmed.match(/^[\*\-]\s+(.*)/)
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList()
        inList = true
        listType = 'ul'
        htmlResult += '<ul>\n'
      }
      const itemContent = parseInlineMarkdown(ulMatch[1])
      htmlResult += `  <li>${itemContent}</li>\n`
      continue
    }

    // Paragraph text (or empty lines)
    if (trimmed === '') {
      closeList()
      continue
    }

    // Regular line - parse paragraph
    closeList()
    const pContent = parseInlineMarkdown(trimmed)
    htmlResult += `<p>${pContent}</p>\n`
  }

  // Final clean up
  closeList()
  closeTable()

  return htmlResult
}

const parseInlineMarkdown = (text) => {
  let escaped = escapeHtml(text)
  // Bold **word**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Inline code `code`
  escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>')
  return escaped
}

const run = async () => {
  try {
    const mdContent = await fs.readFile(mdPath, 'utf8')
    const bodyHtml = parseMarkdownToHtml(mdContent)

    const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Palak Jewellery - System User Guide</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;700&display=swap');
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 18mm 15mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Inter', Arial, sans-serif;
            color: #3e322d;
            line-height: 1.5;
            background: #fff;
            padding: 10px;
          }
          h1, h2, h3 {
            font-family: 'Outfit', sans-serif;
            color: #b95c58;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 22px;
            border-bottom: 2px solid #b95c58;
            padding-bottom: 8px;
            text-align: center;
            margin-top: 0;
            margin-bottom: 24px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          h2 {
            font-size: 14px;
            border-bottom: 1.5px solid rgba(92, 70, 56, 0.15);
            padding-bottom: 4px;
            margin-top: 24px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          h3 {
            font-size: 11px;
            margin-top: 14px;
            color: #4f4039;
          }
          p, li {
            font-size: 10.5px;
            margin-bottom: 8px;
          }
          ul, ol {
            margin-left: 18px;
            margin-bottom: 12px;
          }
          li {
            margin-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 9.5px;
          }
          th, td {
            border: 1px solid rgba(92, 70, 56, 0.25);
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background: #fbf6f0;
            color: #b95c58;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8.5px;
            letter-spacing: 0.03em;
          }
          tbody tr:nth-child(even) td {
            background: #fffaf5;
          }
          hr {
            border: 0;
            border-top: 1.5px solid rgba(92, 70, 56, 0.15);
            margin: 20px 0;
          }
          code {
            font-family: monospace;
            background: #fbf6f0;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9.5px;
            color: #b95c58;
            border: 0.5px solid rgba(92, 70, 56, 0.15);
          }
          .mermaid {
            display: flex;
            justify-content: center;
            margin: 20px 0;
            background: #fff;
            padding: 10px;
          }
          /* Custom styling for rendered SVG classes inside PDF */
          .node rect, .node circle, .node polygon {
            fill: #fffaf5 !important;
            stroke: #b95c58 !important;
            stroke-width: 1.5px !important;
          }
          .label {
            color: #4f4039 !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 9px !important;
          }
          .messageText {
            font-family: 'Inter', sans-serif !important;
            font-size: 9px !important;
            fill: #4f4039 !important;
          }
          .actor {
            font-family: 'Outfit', sans-serif !important;
            font-size: 9.5px !important;
            font-weight: bold !important;
            fill: #b95c58 !important;
          }
        </style>
        <!-- Mermaid CDN -->
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
        <script>
          mermaid.initialize({
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
              primaryColor: '#fffaf5',
              primaryTextColor: '#4f4039',
              primaryBorderColor: '#b95c58',
              lineColor: '#b95c58',
              secondaryColor: '#fbf6f0',
              tertiaryColor: '#fff'
            }
          });
        </script>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>`

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 })
    await page.setContent(fullHtml, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] })

    // Wait a brief moment for Mermaid to finalize SVG rendering in the page
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '18mm',
        left: '15mm',
      },
    })

    await browser.close()
    await fs.writeFile(pdfPath, pdfBuffer)
    console.log('PDF generated successfully at docs/CLIENT_USER_GUIDE.pdf')
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    process.exit(1)
  }
}

run()

/**
 * lib/resume/extract-text.ts
 *
 * PDF and DOCX text extraction for Next.js serverless (Node.js runtime).
 * Uses pdfjs-dist in legacy mode (no worker) for PDF, mammoth for DOCX.
 */

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Use pdfjs-dist in legacy mode for Node.js serverless
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs') as any

  // Disable worker in serverless environment (no DOM, no Worker API)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdfDocument = await loadingTask.promise

  const textPages: string[] = []
  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items as { str?: string }[])
      .map((item) => item.str ?? '')
      .join(' ')
    textPages.push(pageText)
  }

  return textPages.join('\n\n')
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  // mammoth works fine with Buffer in serverless
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

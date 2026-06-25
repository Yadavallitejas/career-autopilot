// CRITICAL: this import MUST come before importing PDFParse — it sets up
// the canvas factory and polyfills (DOMMatrix, ImageData) that pdfjs-dist
// needs and which don't exist in a bare Node.js serverless runtime.
import 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (buffer.length > 30 * 1024 * 1024) {
    throw new Error('PDF is too large (max 30MB). Please upload a smaller file.')
  }

  try {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()

    if (!result.text || result.text.trim().length < 50) {
      throw new Error('The PDF appears to be empty, scanned, or image-only. Please try a text-based PDF, or paste your resume text directly.')
    }

    return result.text

  } catch (error) {
    console.error('[PDF Extraction] Failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown extraction error'
    throw new Error(message)
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('The document appears to be empty.')
    }
    return result.value
  } catch (error) {
    console.error('[DOCX Extraction] Failed:', error)
    throw new Error('Could not read the DOCX file. Please try a PDF, or paste your resume text directly.')
  }
}

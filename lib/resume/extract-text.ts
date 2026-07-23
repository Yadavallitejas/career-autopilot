export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  console.log('[PDF] Starting extraction, buffer size:', buffer.length)

  // Attempt 1: pdf-parse text extraction (pure Node.js — works in Vercel serverless)
  try {
    const pdfMod = await import('pdf-parse')
    const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
      (pdfMod as any).default ?? (pdfMod as any)

    const data = await pdfParse(buffer)
    console.log('[PDF] Document loaded, pages:', data.numpages)

    const fullText = data.text.trim()
    console.log('[PDF] Text extraction result length:', fullText.length)
    console.log('[PDF] Text preview:', fullText.slice(0, 100))

    if (fullText.length >= 80) {
      return fullText
    }

    console.log('[PDF] Text too short — PDF is image-based, switching to vision')
  } catch (textErr) {
    console.warn('[PDF] Text extraction threw:', textErr instanceof Error ? textErr.message : textErr)
    console.log('[PDF] Falling back to vision model')
  }

  // Attempt 2: Vision model (for image-based PDFs like Coursera/IBM/Meta certs)
  // Send raw PDF bytes as base64 directly to the Groq vision model — no canvas needed.
  try {
    console.log('[PDF] Sending PDF to vision model as base64 data URI')

    const base64 = buffer.toString('base64')
    console.log('[PDF] PDF base64 size:', base64.length, 'chars')

    // Call vision model
    const { default: OpenAI } = await import('openai')
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1'
    })

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${base64}`, detail: 'high' }
          },
          {
            type: 'text',
            text: 'This is a certificate. Extract all visible text: recipient name, course/certification name, issuing organization (company/university), date completed, any score or grade visible. Be thorough and accurate.'
          }
        ]
      }]
    })

    const visionText = response.choices[0]?.message?.content ?? ''
    console.log('[PDF] Vision model extracted:', visionText.slice(0, 200))

    if (visionText.length > 30) return visionText
    throw new Error('Vision model returned too little')

  } catch (visionErr) {
    console.error('[PDF] Vision also failed:', visionErr instanceof Error ? visionErr.message : visionErr)
    throw new Error(
      'Could not read this PDF. Try uploading the certificate as a JPG or PNG image instead.'
    )
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

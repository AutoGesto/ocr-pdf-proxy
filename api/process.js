import { json } from 'micro';
import { google } from 'googleapis';
import OpenAI from 'openai';
import CloudmersiveOcrApiClient from 'cloudmersive-ocr-api-client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { folderId, spreadsheetId } = await json(req);
    if (!folderId || !spreadsheetId) {
      res.status(400).json({ error: 'folderId and spreadsheetId are required' });
      return;
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    );

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id,name)',
    });
    const files = data.files || [];

    const ocrApiClient = CloudmersiveOcrApiClient.ApiClient.instance;
    ocrApiClient.authentications['Apikey'].apiKey = process.env.CLOUDMERSIVE_API_KEY;
    const ocrApi = new CloudmersiveOcrApiClient.ConvertDocumentApi();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (const file of files) {
      // Descargar el PDF
      const pdfRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
      const pdfBuffer = Buffer.from(pdfRes.data);

      // Aplicar OCR usando Cloudmersive
      let text = '';
      try {
        const result = await new Promise((resolve, reject) => {
          ocrApi.convertDocumentPdfToText(pdfBuffer, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        text = result?.textResult || result?.TextResult || '';
      } catch (e) {
        console.error('OCR error', e);
      }

      // Clasificar con OpenAI
      let classification = '';
      try {
        const chat = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Extrae los datos relevantes del siguiente texto.' },
            { role: 'user', content: text },
          ],
        });
        classification = chat.choices?.[0]?.message?.content?.trim() || '';
      } catch (e) {
        console.error('OpenAI error', e);
      }

      // Agregar resultados a Google Sheets
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[file.name, classification]],
        },
      });
    }

    res.status(200).json({ message: 'Procesamiento completado', processed: files.length });
  } catch (error) {
    console.error('Process error', error);
    res.status(500).json({ error: 'Error procesando archivos' });
  }
}

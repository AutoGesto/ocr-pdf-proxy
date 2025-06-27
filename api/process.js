import { google } from 'googleapis';
import CloudmersiveOCRApiClient from 'cloudmersive-ocr-api-client';
import { Configuration, OpenAIApi } from 'openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { folderId, sheetId } = req.query;
  if (!folderId || !sheetId) {
    res.status(400).json({ error: 'folderId and sheetId are required query params' });
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // List all PDF files in the given folder
    const driveRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id,name)',
    });

    const files = driveRes.data.files || [];
    const values = [];

    for (const file of files) {
      const pdf = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
      const text = await extractText(Buffer.from(pdf.data));
      const classification = await classifyText(text);
      values.push([file.name, classification, text]);
    }

    if (values.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        resource: { values },
      });
    }

    res.status(200).json({ processed: values.length });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ error: 'Error processing PDFs' });
  }
}

async function extractText(buffer) {
  const apiClient = CloudmersiveOCRApiClient.ApiClient.instance;
  apiClient.authentications['Apikey'].apiKey = process.env.CLOUDMERSIVE_API_KEY;
  const api = new CloudmersiveOCRApiClient.ImageOcrApi();

  return new Promise((resolve, reject) => {
    api.imageOcrPost(buffer, (error, data) => {
      if (error) return reject(error);
      resolve(data?.Text || '');
    });
  });
}

async function classifyText(text) {
  const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  const openai = new OpenAIApi(configuration);
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Clasifica el texto y devuelve la categoría' },
      { role: 'user', content: text },
    ],
  });
  return completion.data.choices[0].message.content.trim();
}

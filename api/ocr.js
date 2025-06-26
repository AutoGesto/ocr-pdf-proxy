import { buffer } from 'micro';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    const buf = await buffer(req);
    const data = await pdfParse(buf);
    res.status(200).json({ text: data.text });
  } catch (error) {
    console.error('Error al procesar el PDF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo PDF.' });
  }
}

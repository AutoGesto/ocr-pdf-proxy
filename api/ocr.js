import { buffer } from 'micro';
import Tesseract from 'tesseract.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    const buf = await buffer(req);

    const {
      data: { text },
    } = await Tesseract.recognize(buf, 'spa+eng'); // español + inglés

    res.status(200).json({ text });
  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: 'Error al procesar la imagen.' });
  }
}

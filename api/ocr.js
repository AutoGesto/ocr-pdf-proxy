import Tesseract from 'tesseract.js';
import { buffer } from 'micro';
import { createWorker } from 'tesseract.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    const buf = await buffer(req);
    const worker = await createWorker(['eng', 'spa']);

    const {
      data: { text },
    } = await worker.recognize(buf);

    await worker.terminate();

    res.status(200).json({ text });
  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: 'Error al procesar el archivo PDF.' });
  }
}

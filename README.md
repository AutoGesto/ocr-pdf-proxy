# OCR PDF Proxy

This project exposes serverless API endpoints for processing PDF documents.

## Endpoints

- **POST `/api/ocr`** - Performs OCR on an uploaded file using Tesseract.
- **GET `/api/process`** - Reads all PDFs from a Google Drive folder, performs OCR with Cloudmersive when needed, classifies text using OpenAI, and appends the results to a Google Sheet.

Both endpoints expect the necessary API credentials to be available in environment variables.


import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import the vercel function directly
import submitHandler from './api/submit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables from .env
dotenv.config();

// Mock the Vercel req/res API
app.post('/api/submit', async (req, res) => {
    // Vercel serverless functions use exactly the same signature as Express (req, res)
    await submitHandler(req, res);
});

// Serve static files from dist (if built) or public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n\n=============================================================`);
    console.log(`🚀 LOCAL TEST SERVER RUNNING AT: http://localhost:${PORT}`);
    console.log(`To test the backend locally, open: http://localhost:${PORT}/round2.html`);
    console.log(`=============================================================\n\n`);
});

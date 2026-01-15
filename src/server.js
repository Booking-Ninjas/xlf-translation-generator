require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { syncXLFtoSheet, generateXLF, getLanguages } = require('./main');
const { EXCLUDED_CATEGORIES } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads (memory storage for serverless compatibility)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * GET / - Serve main page
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * POST /api/import - Import XLF to Google Sheets
 * Upload XLF file and sync to Google Sheets
 */
app.post('/api/import', upload.single('xlf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }

        // Read uploaded file from memory buffer
        const xlfContent = req.file.buffer.toString('utf-8');

        // Get selected categories from request
        const categories = req.body.categories ? JSON.parse(req.body.categories) : null;

        // Sync to Google Sheets with category filter
        const result = await syncXLFtoSheet(xlfContent, categories);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/languages - Get available languages
 */
app.get('/api/languages', async (req, res) => {
    try {
        const languages = await getLanguages();
        res.json({ 
            success: true, 
            languages 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/config - Get configuration (excluded categories, etc.)
 */
app.get('/api/config', (req, res) => {
    try {
        res.json({ 
            success: true, 
            defaultExcludedCategories: EXCLUDED_CATEGORIES
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /api/export - Export XLF for specified language
 * Generates XLF file with translations from Google Sheets
 */
app.post('/api/export', async (req, res) => {
    try {
        const { language } = req.body;

        if (!language) {
            return res.status(400).json({ 
                success: false, 
                error: 'Language not specified' 
            });
        }

        // Generate XLF with translations from Google Sheets
        const result = await generateXLF(language);

        if (result.success) {
            // Set headers for file download
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Content-Disposition', `attachment; filename="translation_${language}_${dateStr}.xlf"`);
            res.send(result.xlfContent);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/status - Check server status
 */
app.get('/api/status', (req, res) => {
    res.json({ 
        success: true, 
        status: 'running'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`XLF Translator server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

module.exports = app;

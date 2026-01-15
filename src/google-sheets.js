const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { GOOGLE_SHEET_ID, SHEET_NAME } = require('./config');

/**
 * Initializes Google Sheets API client
 * Supports two methods:
 * 1. Environment variables (recommended for production/GitHub)
 * 2. google.json file (for local development)
 * @returns {Object} - Sheets API client
 */
function getGoogleSheetsClient() {
    let auth;

    // Method 1: Use environment variables (secure)
    if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
        auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                project_id: process.env.GOOGLE_PROJECT_ID
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    // Method 2: Use google.json file (local development only)
    else {
        const googleJsonPath = path.join(__dirname, '../google.json');
        
        if (!fs.existsSync(googleJsonPath)) {
            throw new Error(
                'Google credentials not found. Please provide either:\n' +
                '1. Environment variables: GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID\n' +
                '2. google.json file in project root (for local development only)'
            );
        }

        auth = new google.auth.GoogleAuth({
            keyFile: googleJsonPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }

    return google.sheets({ version: 'v4', auth });
}

/**
 * Gets sheet headers (column names)
 * @returns {Promise<Array>} - Array of column names
 */
async function getSheetHeaders() {
    const sheets = getGoogleSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!1:1`,
        });

        const headers = response.data.values ? response.data.values[0] : [];
        return headers.filter(h => h); // Remove empty headers
    } catch (error) {
        throw new Error(`Failed to read sheet headers: ${error.message}`);
    }
}

/**
 * Reads all data from Google Sheet
 * @returns {Promise<Array>} - Array of row objects
 */
async function readSheet() {
    const sheets = getGoogleSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:AH`, // A to AH covers all columns
        });

        const rows = response.data.values;
        
        if (!rows || rows.length === 0) {
            return [];
        }

        // First row is headers
        const headers = rows[0];
        const data = [];

        // Convert rows to objects
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const obj = {};
            
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            
            data.push(obj);
        }

        return data;
    } catch (error) {
        throw new Error(`Failed to read Google Sheet: ${error.message}`);
    }
}

/**
 * Writes data to Google Sheet (preserves existing headers)
 * @param {Array} data - Array of row objects
 * @returns {Promise<void>}
 */
async function writeSheet(data) {
    const sheets = getGoogleSheetsClient();

    try {
        // Get existing headers
        const headers = await getSheetHeaders();
        
        if (headers.length === 0) {
            throw new Error('No headers found in sheet');
        }

        // Prepare rows
        const rows = [headers];

        // Convert objects to rows based on existing headers
        data.forEach(item => {
            const row = headers.map(col => {
                const value = item[col];
                return value !== undefined ? value : '';
            });
            rows.push(row);
        });

        // Clear existing data and write new data
        const lastColumn = String.fromCharCode(65 + headers.length - 1); // A, B, C, ...
        await sheets.spreadsheets.values.clear({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:${lastColumn}`,
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: rows,
            },
        });

    } catch (error) {
        throw new Error(`Failed to write to Google Sheet: ${error.message}`);
    }
}

/**
 * Updates specific rows in Google Sheet
 * @param {Array} updates - Array of {row: number, data: object}
 * @returns {Promise<void>}
 */
async function updateRows(updates) {
    const sheets = getGoogleSheetsClient();

    try {
        const headers = await getSheetHeaders();
        
        const batchData = updates.map(update => {
            const row = headers.map(col => {
                const value = update.data[col];
                return value !== undefined ? value : '';
            });
            
            return {
                range: `${SHEET_NAME}!A${update.row}`,
                values: [row],
            };
        });

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: GOOGLE_SHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data: batchData,
            },
        });

    } catch (error) {
        throw new Error(`Failed to update Google Sheet rows: ${error.message}`);
    }
}

/**
 * Appends rows to Google Sheet
 * @param {Array} data - Array of row objects to append
 * @returns {Promise<void>}
 */
async function appendRows(data) {
    const sheets = getGoogleSheetsClient();

    try {
        const headers = await getSheetHeaders();
        
        const rows = data.map(item => 
            headers.map(col => {
                const value = item[col];
                return value !== undefined ? value : '';
            })
        );

        const lastColumn = String.fromCharCode(65 + headers.length - 1);
        await sheets.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `${SHEET_NAME}!A:${lastColumn}`,
            valueInputOption: 'RAW',
            resource: {
                values: rows,
            },
        });

    } catch (error) {
        throw new Error(`Failed to append rows to Google Sheet: ${error.message}`);
    }
}

module.exports = {
    getSheetHeaders,
    readSheet,
    writeSheet,
    updateRows,
    appendRows
};

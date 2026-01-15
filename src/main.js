const { parseXLF } = require('./xlf-parser');
const { getSheetHeaders, readSheet, writeSheet } = require('./google-sheets');
const { exportXLF, getAvailableLanguages } = require('./xlf-exporter');
const { BASE_COLUMNS } = require('./config');

/**
 * Extracts category from id (first part before the first dot)
 * @param {string} id - Full id like "PicklistValue.Contact.Type.Owner"
 * @returns {string} - Category part like "PicklistValue"
 */
function extractCategory(id) {
    if (!id || typeof id !== 'string') return '';
    const parts = id.split('.');

    console.log(parts[0]);
    return parts[0] || '';
}

/**
 * Synchronizes XLF file to Google Sheets
 * Independent operation - reads XLF and updates Google Sheets
 * 
 * Logic:
 * - Parse XLF file and extract segments
 * - Load existing Google Sheets data
 * - Compare and sync:
 *   - New id → add row with English text, empty translations
 *   - Existing id with changed English → update English and clear all translations
 *   - Missing id in XLF → remove or mark as inactive
 * 
 * @param {string} xlfContent - XLF file content
 * @returns {Promise<Object>} - Sync result with statistics
 */
async function syncXLFtoSheet(xlfContent) {
    try {
        // Parse XLF
        const parsed = await parseXLF(xlfContent);
        const segments = parsed.segments;

        // Read existing Google Sheet data
        const sheetData = await readSheet();
        
        // Create maps for comparison
        const xlfMap = new Map();
        segments.forEach(seg => {
            xlfMap.set(seg.id, seg);
        });

        const sheetMap = new Map();
        sheetData.forEach(row => {
            if (row.id) {
                sheetMap.set(row.id, row);
            }
        });

        // Get current sheet headers to know which columns exist
        const sheetHeaders = await getSheetHeaders();
        const languageColumns = sheetHeaders.filter(h => 
            !BASE_COLUMNS.includes(h) && h !== 'active'
        );
        
        const updatedData = [];
        const stats = {
            added: 0,
            updated: 0,
            unchanged: 0,
            deactivated: 0
        };

        // Process XLF segments - mark as active (true)
        for (const [id, segment] of xlfMap) {
            const existingRow = sheetMap.get(id);

            if (!existingRow) {
                // New segment - add to sheet with empty translations
                const newRow = {
                    id: segment.id,
                    category: extractCategory(segment.id),
                    maxwidth: segment.maxwidth,
                    'size-unit': segment.sizeUnit,
                    English: segment.source,
                    active: true
                };
                
                // Add empty values for all language columns that exist in sheet
                languageColumns.forEach(col => {
                    newRow[col] = '';
                });
                
                updatedData.push(newRow);
                stats.added++;
            } else {
                // Existing segment - check if English changed
                if (existingRow.English !== segment.source) {
                    // English changed - update English and clear all translations
                    const updatedRow = {
                        ...existingRow,
                        English: segment.source,
                        maxwidth: segment.maxwidth,
                        'size-unit': segment.sizeUnit,
                        active: true
                    };
                    
                    // Clear all language translations
                    languageColumns.forEach(col => {
                        updatedRow[col] = '';
                    });
                    
                    updatedData.push(updatedRow);
                    stats.updated++;
                } else {
                    updatedData.push({
                        ...existingRow,
                        maxwidth: segment.maxwidth,
                        'size-unit': segment.sizeUnit,
                        active: true
                    });
                    stats.unchanged++;
                }
            }
        }

        // Process rows not in XLF - mark as inactive (false) but keep in sheet
        for (const [id, row] of sheetMap) {
            if (!xlfMap.has(id)) {
                updatedData.push({
                    ...row,
                    active: false
                });
                stats.deactivated++;
            }
        }

        // Write updated data back to Google Sheets
        await writeSheet(updatedData);

        return {
            success: true,
            stats,
            totalSegments: segments.length,
            message: `Sync completed: ${stats.added} added, ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.deactivated} deactivated`
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Exports XLF file from Google Sheets for specified language
 * Independent operation - can be called anytime
 * 
 * @param {string} targetLanguage - Target language display name (e.g., 'French', 'Spanish')
 * @returns {Promise<Object>} - Export result with XLF content
 */
async function generateXLF(targetLanguage) {
    try {
        // Read Google Sheets data and headers
        const sheetData = await readSheet();
        const sheetHeaders = await getSheetHeaders();
        
        // Validate language exists in both config and sheet
        const availableLanguages = getAvailableLanguages(sheetHeaders);
        if (!availableLanguages.includes(targetLanguage)) {
            throw new Error(`Invalid language: ${targetLanguage}. Available languages: ${availableLanguages.join(', ')}`);
        }

        // Generate XLF from sheet data (no template needed)
        const xlfContent = await exportXLF(targetLanguage, sheetData);

        return {
            success: true,
            xlfContent,
            language: targetLanguage,
            segmentCount: sheetData.length
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Gets list of available languages from Google Sheet
 * Only returns languages that exist in both config and sheet columns
 * @returns {Promise<Array>} - Array of language display names
 */
async function getLanguages() {
    try {
        const sheetHeaders = await getSheetHeaders();
        return getAvailableLanguages(sheetHeaders);
    } catch (error) {
        // Fallback to all configured languages if sheet read fails
        return getAvailableLanguages();
    }
}

module.exports = {
    syncXLFtoSheet,
    generateXLF,
    getLanguages
};

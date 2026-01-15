const { parseXLF } = require('./xlf-parser');
const { getSheetHeaders, readSheet, updateRows, appendRows } = require('./google-sheets');
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

        // Process existing rows while preserving their order in the sheet
        const rowsToUpdate = [];
        const rowsToAdd = [];
        
        for (let i = 0; i < sheetData.length; i++) {
            const row = sheetData[i];
            const rowNumber = i + 2; // Row number in sheet: array index + 1 (0-based to 1-based) + 1 (header row)
            
            // Skip rows without valid id
            if (!row.id || row.id.trim() === '') {
                continue;
            }
            
            const segment = xlfMap.get(row.id);
            
            if (segment) {
                // ID found in XLF - check if any fields need updating
                const needsUpdate = 
                    row.English !== segment.source || 
                    row.active !== true ||
                    row.maxwidth !== segment.maxwidth ||
                    row['size-unit'] !== segment.sizeUnit;
                
                if (needsUpdate) {
                    if (row.English !== segment.source) {
                        // Source text changed - update English field and clear all translations
                        const updatedRow = {
                            ...row,
                            English: segment.source,
                            maxwidth: segment.maxwidth,
                            'size-unit': segment.sizeUnit,
                            active: true
                        };
                        
                        // Clear all language translations
                        languageColumns.forEach(col => {
                            updatedRow[col] = '';
                        });
                        
                        rowsToUpdate.push({ row: rowNumber, data: updatedRow });
                        stats.updated++;
                    } else {
                        // Only metadata changed (maxwidth, size-unit, or active status)
                        rowsToUpdate.push({
                            row: rowNumber,
                            data: {
                                ...row,
                                maxwidth: segment.maxwidth,
                                'size-unit': segment.sizeUnit,
                                active: true
                            }
                        });
                        stats.unchanged++;
                    }
                } else {
                    stats.unchanged++;
                }
                
                // Remove from map to track which segments are new
                xlfMap.delete(row.id);
            } else {
                // ID not found in XLF - mark as inactive if currently active
                if (row.active !== false) {
                    rowsToUpdate.push({
                        row: rowNumber,
                        data: { ...row, active: false }
                    });
                }
                stats.deactivated++;
            }
        }

        // Add new segments from XLF that don't exist in sheet yet
        for (const [id, segment] of xlfMap) {
            const newRow = {
                id: segment.id,
                category: extractCategory(segment.id),
                maxwidth: segment.maxwidth,
                'size-unit': segment.sizeUnit,
                English: segment.source,
                active: true
            };
            
            // Initialize all language columns as empty strings
            languageColumns.forEach(col => {
                newRow[col] = '';
            });
            
            rowsToAdd.push(newRow);
            stats.added++;
        }

        // Apply all changes to Google Sheet
        if (rowsToUpdate.length > 0) {
            await updateRows(rowsToUpdate);
        }
        
        if (rowsToAdd.length > 0) {
            await appendRows(rowsToAdd);
        }

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

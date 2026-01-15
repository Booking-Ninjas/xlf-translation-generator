const xml2js = require('xml2js');
const { LANGUAGES } = require('./config');

/**
 * Generates XLF file with translations for specified language
 * Creates XLF structure from Google Sheets data (no template needed)
 * 
 * @param {string} targetLang - Language display name (e.g., 'French', 'Spanish')
 * @param {Array} sheetData - Data from Google Sheets
 * @returns {Promise<string>} - Generated XLF content
 */
async function exportXLF(targetLang, sheetData) {
    try {
        const langCode = LANGUAGES[targetLang];
        if (!langCode) {
            throw new Error(`Unknown target language: ${targetLang}`);
        }

        // Filter only active records (active can be: true, 'true', date string, etc)
        // Any truthy value except false/'false'/0 is considered active
        const activeRecords = sheetData.filter(row => {
            const active = row.active;
            // Consider active if: true, 'true', 'TRUE', date string, or any truthy value
            // NOT active only if: false, 'false', 'FALSE', empty, 0
            if (!active) return false;
            if (active === false || active === 'false' || active === 'FALSE' || active === '0') return false;
            return true;
        });

        // Check for maxwidth violations and build trans-units, skipping invalid ones
        const maxwidthErrors = [];
        const transUnits = activeRecords
            .filter(row => row[targetLang] && row[targetLang].trim() !== '') // Only include if translation exists and is not empty
            .filter(row => {
                // If translation exceeds maxwidth, add to errors and skip from export
                if (row.maxwidth && !isNaN(Number(row.maxwidth))) {
                    const max = Number(row.maxwidth);
                    if (typeof row[targetLang] === 'string' && row[targetLang].length > max) {
                        maxwidthErrors.push({
                            id: row.id,
                            value: row[targetLang],
                            maxwidth: row.maxwidth
                        });
                        return false; // skip this entry
                    }
                }
                return true;
            })
            .map(row => {
                const unit = {
                    '$': {
                        id: row.id || '',
                        maxwidth: row.maxwidth || '',
                        'size-unit': row['size-unit'] || ''
                    },
                    source: row.English || ''
                };
                unit.target = row[targetLang];
                return unit;
            });

        // Build INNER XLF document as complete XML string
        const innerBuilder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8' },
            renderOpts: { pretty: true, indent: '    ' }
        });

        const innerXliffStructure = {
            xliff: {
                '$': {
                    version: '1.2'
                },
                file: {
                    '$': {
                        original: 'Salesforce',
                        'source-language': 'en_US',
                        'target-language': langCode,
                        'translation-type': 'metadata',
                        datatype: 'xml'
                    },
                    body: {
                        'trans-unit': transUnits
                    }
                }
            }
        };

        const xmlString = innerBuilder.buildObject(innerXliffStructure);

        return { xlf: xmlString, maxwidthErrors };

    } catch (error) {
        throw new Error(`Failed to export XLF: ${error.message}`);
    }
}

/**
 * Gets available languages for export based on Google Sheet columns
 * Only returns languages that exist BOTH in LANGUAGES map AND in Google Sheet
 * @param {Array} sheetHeaders - Column headers from Google Sheet
 * @returns {Array} - Array of language display names available in sheet
 */
function getAvailableLanguages(sheetHeaders) {
    if (!sheetHeaders) {
        // Fallback: return all configured languages
        return Object.keys(LANGUAGES);
    }
    
    // Filter: only languages that are in LANGUAGES map AND exist as columns
    return Object.keys(LANGUAGES).filter(lang => sheetHeaders.includes(lang));
}

/**
 * Gets language code for display name
 * @param {string} displayName - Language display name
 * @returns {string} - Language code or null
 */
function getLanguageCode(displayName) {
    return LANGUAGES[displayName] || null;
}

module.exports = {
    exportXLF,
    getAvailableLanguages,
    getLanguageCode
};

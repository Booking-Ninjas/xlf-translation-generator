const xml2js = require('xml2js');

/**
 * Parses XLF file and extracts translation units
 * @param {string} xmlContent - XLF file content as string
 * @returns {Promise<Object>} - Parsed data with segments and metadata
 */
async function parseXLF(xmlContent) {
    const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true
    });

    try {
        const result = await parser.parseStringPromise(xmlContent);
        
        if (!result.xliff || !result.xliff.file) {
            throw new Error('Invalid XLF format: missing xliff or file element');
        }

        const file = result.xliff.file;

        // Verify source language is en_US
        if (file['source-language'] !== 'en_US') {
            throw new Error(`Invalid source language: ${file['source-language']}. Only en_US is supported.`);
        }

        const segments = [];
        
        // Parse nested body structure (as shown in demo.xlf)
        let transUnits = [];
        
        if (file.body) {
            // Handle nested xliff structure
            if (file.body.xliff && file.body.xliff.file && file.body.xliff.file.body) {
                const innerBody = file.body.xliff.file.body;
                transUnits = Array.isArray(innerBody['trans-unit']) 
                    ? innerBody['trans-unit'] 
                    : [innerBody['trans-unit']];
            } else if (file.body['trans-unit']) {
                // Handle direct trans-unit elements
                transUnits = Array.isArray(file.body['trans-unit']) 
                    ? file.body['trans-unit'] 
                    : [file.body['trans-unit']];
            }
        }

        // Extract segments
        for (const unit of transUnits) {
            if (!unit) continue;

            const segment = {
                id: unit.id || '',
                source: unit.source || '',
                maxwidth: unit.maxwidth || '',
                sizeUnit: unit['size-unit'] || '',
                note: unit.note || ''
            };

            segments.push(segment);
        }

        return {
            sourceLanguage: file['source-language'],
            targetLanguage: file['target-language'],
            original: file.original,
            segments
        };

    } catch (error) {
        throw new Error(`Failed to parse XLF: ${error.message}`);
    }
}

/**
 * Validates if the file is a valid XLF with en_US source language
 * @param {string} xmlContent - XLF file content
 * @returns {Promise<boolean>} - True if valid
 */
async function validateXLF(xmlContent) {
    try {
        const parsed = await parseXLF(xmlContent);
        return parsed.sourceLanguage === 'en_US';
    } catch (error) {
        return false;
    }
}

module.exports = {
    parseXLF,
    validateXLF
};

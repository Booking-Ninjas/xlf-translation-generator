#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { syncXLFtoSheet, generateXLF, getLanguages } = require('./main');

const args = process.argv.slice(2);
const command = args[0];

/**
 * Display usage information
 */
function showHelp() {
    console.log(`
XLF Translator - Command Line Interface

Usage:
  node src/cli.js <command> [options]

Commands:
  import <file>              Import XLF file to Google Sheets
  export <language> <file>   Export translated XLF from Google Sheets
  languages                  List available languages
  help                       Show this help message

Examples:
  node src/cli.js import demo.xlf
  node src/cli.js export French output.xlf
  node src/cli.js languages
    `);
}

/**
 * Import XLF to Google Sheets
 */
async function importXLF(filePath) {
    try {
        console.log(`[IMPORT] Importing ${filePath} to Google Sheets...`);
        
        const xlfContent = await fs.readFile(filePath, 'utf-8');
        const result = await syncXLFtoSheet(xlfContent);

        if (result.success) {
            console.log('Import completed.');
            console.log(`   Added: ${result.stats.added}`);
            console.log(`   Updated: ${result.stats.updated}`);
            console.log(`   Unchanged: ${result.stats.unchanged}`);
            console.log(`   Deactivated: ${result.stats.deactivated}`);
        } else {
            console.error(`Import failed: ${result.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Export XLF with translations
 */
async function exportXLF(language, outputFile) {
    try {
        console.log(`Exporting ${language} translations to ${outputFile}...`);
        
        // Generate XLF from Google Sheets data (no template needed)
        const result = await generateXLF(language);

        if (result.success) {
            await fs.writeFile(outputFile, result.xlfContent);
            console.log(`Export completed. ${result.segmentCount} segments exported.`);
        } else {
            console.error(`Export failed: ${result.error}`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

/**
 * List available languages
 */
async function listLanguages() {
    console.log('Available languages:\n');
    const languages = await getLanguages();
    
    languages.forEach((lang, index) => {
        console.log(`   ${index + 1}. ${lang}`);
    });
    
    console.log(`\n   Total: ${languages.length} languages`);
}

/**
 * Main CLI handler
 */
async function main() {
    if (!command || command === 'help') {
        showHelp();
        return;
    }

    switch (command) {
        case 'import':
            const importFile = args[1];
            if (!importFile) {
                console.error('Error: Please specify XLF file to import');
                console.log('Usage: node src/cli.js import <file>');
                process.exit(1);
            }
            await importXLF(importFile);
            break;

        case 'export':
            const language = args[1];
            const outputFile = args[2];

            if (!language || !outputFile) {
                console.error('Error: Please specify language and output file');
                console.log('Usage: node src/cli.js export <language> <output-file>');
                process.exit(1);
            }
            await exportXLF(language, outputFile);
            break;

        case 'languages':
            await listLanguages();
            break;

        default:
            console.error(`Error: Unknown command '${command}'`);
            showHelp();
            process.exit(1);
    }
}

// Run CLI
main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});

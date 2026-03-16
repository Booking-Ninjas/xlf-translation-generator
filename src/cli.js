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
  import <file>                        Import XLF file to Google Sheets
  export <language> <file> [--mask <file>]  Export translated XLF from Google Sheets
  languages                            List available languages
  help                                 Show this help message

Options:
  --mask <file>                        Export mask: only export records whose IDs are present
                                       in the specified source XLF file.

Examples:
  node src/cli.js import demo.xlf
  node src/cli.js export French output.xlf
  node src/cli.js export French output.xlf --mask source_en_US.xlf
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
			console.log(`   Activated: ${result.stats.activated}`);
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
async function exportXLF(language, outputFile, maskFile = null) {
	try {
		const modeLabel = maskFile ? ` (mask: ${maskFile})` : '';
		console.log(`Exporting ${language} translations to ${outputFile}${modeLabel}...`);

		let maskIds = null;
		if (maskFile) {
			const maskContent = await fs.readFile(maskFile, 'utf-8');
			const { parseXLF } = require('./xlf-parser');
			const parsed = await parseXLF(maskContent);
			maskIds = new Set(parsed.segments.map((s) => s.id));
			console.log(`   Mask loaded: ${maskIds.size} IDs from ${maskFile}`);
		}

		// Generate XLF from Google Sheets data (no template needed)
		const result = await generateXLF(language, maskIds);

		if (result.success) {
			await fs.writeFile(outputFile, result.xlfContent);
			console.log(`Export completed. ${result.segmentCount} segments exported.`);
			if (result.maxwidthErrors && result.maxwidthErrors.length > 0) {
				console.warn(
					'\nWARNING: The following translations exceed maxwidth and were NOT included in the exported file:',
				);
				result.maxwidthErrors.forEach((e) => {
					console.warn(`  ${e.id}: ${e.value} (max: ${e.maxwidth})`);
				});
				console.warn('\nThese entries must be fixed before import.');
			}
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
				console.log('Usage: node src/cli.js export <language> <output-file> [--mask <file>]');
				process.exit(1);
			}
			// Parse optional --mask flag: node cli.js export French out.xlf --mask source.xlf
			const maskFlagIdx = args.indexOf('--mask');
			const maskFile = maskFlagIdx !== -1 ? args[maskFlagIdx + 1] : null;
			await exportXLF(language, outputFile, maskFile);
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
main().catch((error) => {
	console.error(`Error: ${error.message}`);
	process.exit(1);
});

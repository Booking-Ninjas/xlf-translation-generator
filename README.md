# XLF Translation Generator

A utility for managing Salesforce XLIFF translation files using Google Sheets as a collaborative translation database. Designed specifically for Salesforce XLF files with nested structure and English (`en_US`) as the source language.

## What It Does

This tool solves a specific problem: managing translations for Salesforce `.xlf` files across multiple languages with team collaboration. Instead of editing XML files manually, you:

1. **Import** your English XLF file → syncs to Google Sheets
2. **Translate** in Google Sheets with your team
3. **Export** translated XLF files for each language

## Installation

### Prerequisites

- **Node.js** 14 or higher
- **Access to team Google Sheet** (ask developers for share access)

### Setup Steps

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd xlf-translator
   npm install
   ```

2. **Configure credentials**

   Create `.env` file (copy from `.env.example`):
   ```env
   GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_PROJECT_ID=your-project-id
   ```
   
   > **Note:** Get these credentials from your team developers. The Google Sheet is already configured in the project.

3. **Start using**
   ```bash
   npm start
   # Open http://localhost:3000
   ```

That's it! The tool is configured to work with your team's shared Google Sheet automatically.

## Google Sheet Structure

Your Google Sheet must have these columns (order doesn't matter):

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | Text | Unique XLF identifier | `PicklistValue.Contact.Type.Owner` |
| `category` | Text | Category extracted from id (first part before dot) | `PicklistValue` |
| `maxwidth` | Number | Character width limit | `50` |
| `size-unit` | Text | Unit of measurement | `char` |
| `English` | Text | Source text (en_US) | `Hello World` |
| `active` | Boolean | Export this record? | `TRUE` / `FALSE` |
| `French` | Text | French translation | `Bonjour le monde` |
| `Spanish` | Text | Spanish translation | `Hola Mundo` |
| ... | ... | Add more language columns | ... |

**Important Notes:**
- Сolumns `id`, `category`, `maxwidth`, `size-unit`, `English`, `active` are required
- Language column names must match exactly: "French", "Spanish", "German", etc. (case-sensitive)
- Add/remove/reorder language columns freely - the tool auto-detects them
- `active=TRUE` = record will be exported, `FALSE` = skipped

## Usage

### Web Interface

1. Start the server:
   ```bash
   npm start
   ```

2. Open browser: `http://localhost:3000`

3. **Import XLF:**
   - Click "Import" section
   - Select your `.xlf` file (must be `source-language="en_US"`)
   - Click "Import to Google Sheets"
   - View statistics: Added, Updated, Unchanged, Deactivated

4. **Export XLF:**
   - Select target language from dropdown
   - Click "Export XLF with Translations"
   - Download: `translation_French_2026-01-14.xlf`

### Command Line

**Import XLF to Google Sheets**

```bash
node src/cli.js import <file>
```

Example:
```bash
node src/cli.js import demo.xlf
```

**Export translated XLF**

```bash
node src/cli.js export <language> <file>
```

Example:
```bash
node src/cli.js export French output.xlf
```

**List available languages**

```bash
node src/cli.js languages
```

**Show help**

```bash
node src/cli.js help
```

## How It Works

### Import Process (XLF → Google Sheets)

When you import an XLF file:

1. **Parse XLF** - Extracts all `<trans-unit>` elements with `id`, `source`, `maxwidth`, `size-unit`
2. **Compare with Sheet** - Checks each segment against existing Google Sheet data
3. **Apply Changes:**
   - **New segment** → Add row with `category`, `active=TRUE`, empty translation columns
   - **English text changed** → Update English, clear ALL translations, set `active=TRUE`
   - **Unchanged** → Keep as-is
   - **Missing in XLF** → Set `active=FALSE` (deactivated, not deleted)
4. **Write to Sheet** - Updates Google Sheet preserving existing headers

**Result:** Statistics show Added / Updated / Unchanged / Deactivated counts

### Export Process (Google Sheets → XLF)

When you export a language:

1. **Read from Sheet** - Gets all rows where `active=TRUE` (or any truthy value like dates)
2. **Filter by Language** - Only includes segments with translation in selected language column
3. **Generate XLF** - Creates nested Salesforce XLF structure:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <xliff version="1.2">
       <file source-language="en_US" target-language="en_US">
           <body>
               <?xml version="1.0" encoding="UTF-8"?>
               <xliff version="1.2">
                   <file source-language="en_US" target-language="fr">
                       <body>
                           <trans-unit id="..." maxwidth="..." size-unit="...">
                               <source>English text</source>
                               <target>French text</target>
                           </trans-unit>
                       </body>
                   </file>
               </xliff>
           </body>
       </file>
   </xliff>
   ```
4. **Download** - Filename format: `translation_{Language}_{YYYY-MM-DD}.xlf`

## Workflow Example

**Scenario:** You have a Salesforce XLF with 100 English labels. You need French, Spanish, and German translations.

1. **Initial Import:**
   ```bash
   node src/cli.js import salesforce_en_US.xlf
   # Result: 100 added
   ```

2. **Translate in Google Sheets:**
   - Fill in the required language columns (e.g., French, Spanish, German).

3. **Export Translations:**
   ```bash
   node src/cli.js export French    # Gets 100 French translations
   node src/cli.js export Spanish   # Gets 100 Spanish translations
   node src/cli.js export German    # Gets 100 German translations
   ```

4. **Source XLF Updated (20 new labels, 5 changed):**
   ```bash
   node src/cli.js import salesforce_en_US_v2.xlf
   # Result: 20 added, 5 updated (translations cleared), 75 unchanged
   ```

5. **Update only new/changed items in Google Sheets, then export again as needed.**

## Adding More Languages

Edit `src/config.js`:

```javascript
const LANGUAGES = {
    // Existing languages...
    Chinese: 'zh_CN',        // Add Chinese
    Russian: 'ua',           // Add Ukrainian
    Portuguese: 'pt_PT',     // Portugal Portuguese (pt_BR already exists)
};
```

Then add matching columns in Google Sheet: "Chinese", "Portuguese"
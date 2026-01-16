# Salesforce Translation Workflow (Scratch Org)

## Overview

This document describes how to export, translate, and import custom object translations in a Salesforce Scratch Org using the Translation Workbench and a custom translation generator tool.

The process is based on **XLIFF files** and a centralized **Google Sheets translation database**, with validation to prevent invalid imports.

---

## How It Works

1. Salesforce exports translations as an **XLIFF** file.
2. The custom tool parses the file and extracts labels.
3. All labels are stored in a Google Sheet acting as a translation database.
4. Translations are added and validated (length limits).
5. A language-specific XLIFF file is generated.
6. The file is imported back into the Scratch Org.
7. Translated metadata is fetched into the project.

Inactive or invalid labels are skipped automatically.

---

## Step-by-Step Guide

### 1. Enable Languages in Scratch Org
1. Open **Translation Workbench** in Scratch Org.
2. Enable and add required languages.

---

### 2. Export Translations from Salesforce
1. Go to **Translation Workbench → Export**.
2. Export translations in **XLIFF format**.
3. Wait for the email and download the file.
4. Unzip the archive.

---

### 3. Upload XLIFF to Translation Tool
1. Open the `XLF Translation Generator`.
2. Upload the extracted XLIFF file.
3. Review detected categories:
   - Buttons
   - Custom Fields
   - Custom Applications
   - Custom Objects
4. **Do NOT enable Custom Labels category** (handled by a separate tool).

---

### 4. Import Labels into Translation Database
1. Import labels into the tool.
2. Labels are saved in Google Sheets.
3. Each label has an **Active** flag:
   - `true` → included in exports
   - `false` → skipped (old/removed labels)

The sheet acts as a persistent translation database.

---

### 5. Add Translations
1. Enter translations for required languages in the spreadsheet.
2. Follow **MaxWidth** limits for each label.
3. Cells exceeding limits are highlighted in red.

> Labels exceeding limits are excluded from generated files to prevent Salesforce import failures.

---

### 6. Generate Translation File
1. Select a target language (e.g. Spanish, French).
2. Generate and download the XLIFF file.
3. Labels that exceed the maximum length (MaxWidth) are automatically excluded from the file. The file can still be imported.
4. Fix any validation errors in the translation database and regenerate the file after all issues are resolved.

---

### 7. Import Translations into Scratch Org
1. Open **Translation Workbench → Import** in Scratch Org.
2. Upload the generated XLIFF file.
3. Start the import process.
4. Wait for the confirmation email.
5. Ensure the import status is successful before continuing.

---

### 8. Fetch Translation Metadata
1. Update `.forceignore`:
   - Temporarily comment out `**/objectTranslations/**`.
2. Fetch metadata from the Scratch Org.
3. Translated custom object files are pulled into the project.

---

## Notes & Limitations

- XLIFF is the **only supported format**.
- Invalid translations are skipped to avoid full import cancellation.
- The Google Sheet keeps historical (inactive) translations for reuse.

---

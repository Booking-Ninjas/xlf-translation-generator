# Salesforce Translation Workflow

## Overview

This document describes how to manage translations for Salesforce orgs using the Translation Workbench and a custom translation generator tool.

The process is based on **XLIFF files** and a centralized **Google Sheets translation database**, with validation to prevent invalid imports.

**Live Tool:** https://xlf-translation-generator-one.vercel.app/

---

## Two Workflows

There are two separate workflows depending on the goal:

| Workflow                                                                                    | When to use                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **[Flow 1: Update Translation Database](#flow-1-update-translation-database)**              | New labels were added to the app and the Google Sheet needs to be updated |
| **[Flow 2: Generate & Deploy Translation File](#flow-2-generate--deploy-translation-file)** | Translations need to be generated and imported into a target org          |

---

## Flow 1: Update Translation Database

Use this flow when new metadata (fields, objects, buttons) has been added to the app and the Google Sheet needs to reflect those changes.

> **Warning: Always use a clean dev scratch org with all BN apps installed (main app + all extension packages). Never import from a client org or an org with an installed package.**
>
> Every import mutates the Google Sheet. Labels are synced by ID — if a label ID is missing from the uploaded file, it is marked as inactive and excluded from all future translation files. Importing from a client org would add their custom fields and corrupt the database. Importing from an org with incomplete metadata (e.g. BN without POS) would mark missing labels as inactive, breaking translation generation for orgs that do have those modules.

### 1. Enable Languages in Scratch Org

1. Open **Translation Workbench** in Scratch Org.
2. Enable and add required languages.

---

### 2. Export Translations from Salesforce Scratch Org

1. Go to **Translation Workbench → Export**.
2. Export translations in **XLIFF format**.
3. Wait for the email and download the file.
4. Unzip the archive.

---

### 3. Upload XLIFF to Translation Tool

1. Open the `XLF Translation Generator`  
   https://xlf-translation-generator-one.vercel.app/
2. Upload the extracted XLIFF file.
3. Review detected categories:
    - Buttons
    - Custom Fields
    - Custom Applications
    - Custom Objects

---

### 4. Import Labels into Translation Database

> **Warning: Only import from a clean dev scratch org with all BN apps installed (main app + all extension packages).**

1. In the tool, click **Import to Google Sheets**.
2. Labels are synced by ID — new labels are added, existing ones are updated.

---

### 5. Add Translations

1. Enter translations for required languages in the Google Sheet.
2. Follow **MaxWidth** limits for each label.
3. Cells exceeding limits are highlighted in red.
4. Each label has an **Active** flag:
    - `TRUE` → included in exports
    - `FALSE` → skipped (old or removed labels)

> Labels exceeding limits are excluded from generated files to prevent Salesforce import failures.

---

## Flow 2: Generate & Deploy Translation File

Use this flow when translations need to be generated and imported into a target org (scratch org or an org with an installed package).

The Google Sheet is the single source of truth for all BN app translations. The source file from the target org acts as a filter — it determines which labels from the Google Sheet are included in the output.

### 1. Export Source File from Target Org

1. Go to **Translation Workbench → Export** in the target org.
2. Export translations in **XLIFF format**.
3. Wait for the email, download and unzip the file.

---

### 2. Generate Translation File

1. Open the `XLF Translation Generator`  
   https://xlf-translation-generator-one.vercel.app/
2. Upload the source XLIFF file from the target org.
3. In the **Export Translated XLF** section, attach the same source file as a mask.
4. Select the target language.
5. Generate and download the XLIFF file.

> **Export Mask** is non-destructive — it never changes the Google Sheet. It only filters which records appear in the downloaded file.

#### Namespace Prefix and Installed Package Orgs

Scratch orgs and orgs with an installed package use different metadata IDs. When a package is installed, Salesforce adds a namespace prefix to every object and field:

| Org type              | Metadata ID example                                                       |
| --------------------- | ------------------------------------------------------------------------- |
| Scratch org           | `CustomField.bn2gp__ActivityHistory__c.DescriptionLong.FieldLabel`        |
| Installed package org | `CustomField.bn2gp__ActivityHistory__c.bn2gp__DescriptionLong.FieldLabel` |

The Google Sheet stores IDs without the namespace prefix (as they appear in the scratch org). The mask file overrides those IDs with whatever is in the source file from the target org — so if the target org has the package installed, the generated file will automatically use the prefixed IDs.

> **To generate translations for an org where the package is installed, always export the mask file from an org with the installed package.**

Labels exceeding **MaxWidth** are automatically excluded from the file. Fix any validation errors in the Google Sheet and regenerate if needed.

---

### 3. Import Translation File into Target Org

1. Open **Translation Workbench → Import** in the target org.
2. Upload the generated XLIFF file.
3. Start the import process.
4. Wait for the confirmation email.
5. Ensure the import status is successful before continuing.

---

## Notes & Limitations

- **XLIFF is the only supported format.**
- Invalid translations are skipped to avoid full import cancellation.
- The Google Sheet keeps historical (inactive) translations for reuse.

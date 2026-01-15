// Configuration for XLF Translator

const GOOGLE_SHEET_ID = '14KzQfO6fOl2S4gs_dQ415d5ir8gCFNDXzK37v0eGeDE';
const SHEET_NAME = 'Workbench_Transl';

// Language mappings: Display Name -> XLF language code
const LANGUAGES = {
    Spanish: 'es',
    French: 'fr',
    Portuguese: 'pt_BR',
    German: 'de',
    Italian: 'it',
    Turkish: 'tr',
    Dutch: 'nl_NL',
    Greek: 'el',
    Arabic: 'ar',
    Indonesian: 'id',
    Japanese: 'ja',
    Thai: 'th',
    Swedish: 'sv',
    Danish: 'da',
    Finnish: 'fi',
    Norwegian: 'no',
    Korean: 'ko',
    Croatian: 'hr',
    Vietnamese: 'vi',
    Bulgarian: 'bg',
    Polish: 'pl',
    Czech: 'cs',
    Romanian: 'ro',
    Ukrainian: 'uk',
    Hungarian: 'hu',
    Slovenian: 'sl',
    Slovak: 'sk',
    Hebrew: 'he'
};

// Required base columns (must exist in sheet)
const BASE_COLUMNS = ['id', 'maxwidth', 'size-unit', 'English'];

// System columns
const SYSTEM_COLUMNS = ['active']; // active (true/false) - marks if record is present in current XLF

module.exports = {
    GOOGLE_SHEET_ID,
    SHEET_NAME,
    LANGUAGES,
    BASE_COLUMNS,
    SYSTEM_COLUMNS
};

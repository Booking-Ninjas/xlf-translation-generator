let importedFile = null;
let parsedCategories = [];
let selectedCategories = new Set();
let defaultExcludedCategories = [];

// Load configuration from server
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.success && data.defaultExcludedCategories) {
            defaultExcludedCategories = data.defaultExcludedCategories;
        }
    } catch (error) {
        console.error('Failed to load config, using defaults:', error);
    }
}
// Load available languages on page load
async function loadLanguages() {
    try {
        const response = await fetch('/api/languages');
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('languageSelect');
            select.innerHTML = '<option value="">Select a language...</option>';
            data.languages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang;
                option.textContent = lang;
                select.appendChild(option);
            });
            select.disabled = false;
        }
    } catch (error) {
        console.error('Failed to load languages:', error);
    }
}
// Import file selection
document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        importedFile = file;
        document.getElementById('importFileName').textContent = `Selected: ${file.name}`;
        // Parse file to extract categories
        await extractAndDisplayCategories(file);
    }
});
// Extract categories from XLF file
async function extractAndDisplayCategories(file) {
    try {
        let text = await file.text();
        // Handle nested XML declarations (common in some XLF files)
        // Remove duplicate XML declarations that appear after the first one
        const xmlDeclRegex = /<\?xml[^?]*\?>/g;
        const matches = text.match(xmlDeclRegex);
        if (matches && matches.length > 1) {
            // Keep only the first XML declaration
            text = text.replace(xmlDeclRegex, (match, offset) => {
                return offset === text.indexOf(match) ? match : '';
            });
        }
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            console.error('XML Parser Error:', parserError.textContent);
            throw new Error('Invalid XML format: ' + parserError.textContent);
        }
        // Extract all trans-unit IDs (handles nested structure)
        const transUnits = xmlDoc.getElementsByTagName('trans-unit');
        const categorySet = new Set();

        if (transUnits.length === 0) {
            throw new Error('No trans-unit elements found in XLF file');
        }
        for (let unit of transUnits) {
            const id = unit.getAttribute('id');
            if (id) {
                // Extract category (first part before the first dot)
                const category = id.split('.')[0];
                if (category) {
                    categorySet.add(category);
                }
            }
        }
        // Sort categories alphabetically
        parsedCategories = Array.from(categorySet).sort();

        if (parsedCategories.length === 0) {
            throw new Error('No categories found in XLF file');
        }
        // Initialize selected categories (all except those in defaultExcludedCategories)
        selectedCategories.clear();
        parsedCategories.forEach(cat => {
            if (!defaultExcludedCategories.includes(cat)) {
                selectedCategories.add(cat);
            }
        });

        // Display category checkboxes
        displayCategories();
        // Enable import button
        document.getElementById('importBtn').disabled = false;
    } catch (error) {
        console.error('Failed to parse categories:', error);
        alert('Failed to parse XLF file: ' + error.message + '\n\nPlease check the browser console for more details.');
        document.getElementById('importBtn').disabled = true;
    }
}
// Display category checkboxes
function displayCategories() {
    const categoryList = document.getElementById('categoryList');
    const categorySelection = document.getElementById('categorySelection');
    
    if (parsedCategories.length === 0) {
        categorySelection.style.display = 'none';
        return;
    }
    categoryList.innerHTML = '';
    parsedCategories.forEach(category => {
        const label = document.createElement('label');
        label.className = 'category-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = category;
        checkbox.checked = selectedCategories.has(category);
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCategories.add(category);
            } else {
                selectedCategories.delete(category);
            }
        });
        const text = document.createTextNode(' ' + category);
        label.appendChild(checkbox);
        label.appendChild(text);
        categoryList.appendChild(label);
    });
    categorySelection.style.display = 'block';
}
// Trigger file input on area click
document.getElementById('importUpload').addEventListener('click', (e) => {
    if (e.target.id === 'importFileName') return;
    document.getElementById('importFile').click();
});
// Import XLF to Google Sheets
document.getElementById('importBtn').addEventListener('click', async () => {
    if (!importedFile) return;
    // Validate at least one category is selected
    if (selectedCategories.size === 0) {
        alert('Please select at least one category to import');
        return;
    }
    const btn = document.getElementById('importBtn');
    const loader = document.getElementById('importLoader');
    const message = document.getElementById('importMessage');
    btn.disabled = true;
    loader.style.display = 'block';
    message.style.display = 'none';
    try {
        const formData = new FormData();
        formData.append('xlf', importedFile);
        formData.append('categories', JSON.stringify(Array.from(selectedCategories)));
        const response = await fetch('/api/import', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            message.className = 'message success';
            message.textContent = data.message;
            message.style.display = 'block';
        } else {
            message.className = 'message error';
            message.textContent = `Error: ${data.error}`;
            message.style.display = 'block';
        }
    } catch (error) {
        message.className = 'message error';
        message.textContent = `Error: ${error.message}`;
        message.style.display = 'block';
    } finally {
        loader.style.display = 'none';
        btn.disabled = false;
    }
});
// Export XLF
document.getElementById('exportBtn').addEventListener('click', async () => {
    const language = document.getElementById('languageSelect').value;
    // Hide error block on export click
    const errorBlock = document.getElementById('maxwidthErrorBlock');
    errorBlock.style.display = 'none';
    errorBlock.innerHTML = '';
    if (!language) {
        alert('Please select a target language');
        return;
    }
    const btn = document.getElementById('exportBtn');
    const loader = document.getElementById('exportLoader');
    const message = document.getElementById('exportMessage');
    btn.disabled = true;
    loader.style.display = 'block';
    message.style.display = 'none';
    try {
        const response = await fetch('/api/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language })
        });
        
        if (response.ok) {
            // Parse JSON response with file data and metadata
            const data = await response.json();
            
            // Check for maxwidth errors in response body
            if (data.maxwidthErrors && Array.isArray(data.maxwidthErrors) && data.maxwidthErrors.length > 0) {
                errorBlock.style.display = 'block';
                errorBlock.style.wordBreak = 'break-all';
                errorBlock.style.maxHeight = '';
                errorBlock.style.overflowY = '';
                errorBlock.style.fontSize = '0.85em';
                errorBlock.innerHTML =
                    `<b>The following translations exceed maxwidth and were NOT included in the exported file:</b><br>` +
                    `<ul style='margin:8px 0 0 18px; word-break:break-all; font-size:0.85em;'>` +
                    data.maxwidthErrors.map(e => `<li style='margin-bottom:2px;'><b>${e.id}</b>: <span style='color:#b71c1c; word-break:break-all;'>${e.value}</span> (max: ${e.maxwidth})</li>`).join('') +
                    `</ul>` +
                    `<div style='margin-top:8px;color:#b71c1c;'><b>You must fix these entries before import.</b></div>`;
            }
            
            // Decode base64 content and create blob for download
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/xml' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            message.className = 'message success';
            message.textContent = `✅ XLF file exported successfully for ${language}`;
            message.style.display = 'block';
        } else {
            const data = await response.json();
            message.className = 'message error';
            message.textContent = `Error: ${data.error}`;
            message.style.display = 'block';
        }
    } catch (error) {
        message.className = 'message error';
        message.textContent = `Error: ${error.message}`;
        message.style.display = 'block';
    } finally {
        loader.style.display = 'none';
        btn.disabled = false;
    }
});
// Initialize
loadConfig();
loadLanguages();

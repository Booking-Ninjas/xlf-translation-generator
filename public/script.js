let importedFile = null;

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
	tab.addEventListener('click', () => {
		document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
		document.querySelectorAll('.tab-content').forEach((c) => (c.style.display = 'none'));
		tab.classList.add('active');
		document.getElementById('tab-' + tab.dataset.tab).style.display = 'block';
	});
});

// Load available languages on page load
async function loadLanguages() {
	try {
		const response = await fetch('/api/languages');
		const data = await response.json();
		if (data.success) {
			const select = document.getElementById('languageSelect');
			select.innerHTML = '<option value="">Select a language...</option>';
			data.languages.forEach((lang) => {
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
		await previewImport();
	}
});
// Fetch dry-run import stats from the server and display the preview block
async function previewImport() {
	if (!importedFile) {
		document.getElementById('importPreview').style.display = 'none';
		return;
	}
	const btn = document.getElementById('importBtn');
	const loader = document.getElementById('importLoader');
	btn.disabled = true;
	loader.style.display = 'block';
	try {
		const formData = new FormData();
		formData.append('xlf', importedFile);
		const response = await fetch('/api/preview-import', {
			method: 'POST',
			body: formData,
		});
		const data = await response.json();
		if (data.success) {
			document.getElementById('previewAdded').textContent = data.stats.added;
			document.getElementById('previewUpdated').textContent = data.stats.updated;
			document.getElementById('previewDeactivated').textContent = data.stats.deactivated;
			document.getElementById('importPreview').style.display = 'block';
		}
	} catch (error) {
		console.error('Preview failed:', error);
	} finally {
		loader.style.display = 'none';
		btn.disabled = false;
	}
}
// Trigger file input on area click
document.getElementById('importUpload').addEventListener('click', (e) => {
	if (e.target.id === 'importFileName') return;
	document.getElementById('importFile').click();
});
// Import XLF to Google Sheets
document.getElementById('importBtn').addEventListener('click', async () => {
	if (!importedFile) return;
	const btn = document.getElementById('importBtn');
	const loader = document.getElementById('importLoader');
	const message = document.getElementById('importMessage');
	btn.disabled = true;
	loader.style.display = 'block';
	message.style.display = 'none';
	try {
		const formData = new FormData();
		formData.append('xlf', importedFile);
		const response = await fetch('/api/import', {
			method: 'POST',
			body: formData,
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
// Export mask: optional source XLF file to restrict which records are exported
let maskFileData = null;
document.getElementById('maskUpload').addEventListener('click', (e) => {
	if (e.target.id === 'maskFileName') return;
	document.getElementById('maskFile').click();
});
document.getElementById('maskFile').addEventListener('change', (e) => {
	const file = e.target.files[0];
	if (!file) return;
	maskFileData = file;
	document.getElementById('maskFileName').textContent = file.name;
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
		// If a mask file is selected, parse its IDs client-side and send them with the request
		let maskIds = null;
		if (maskFileData) {
			const maskText = await maskFileData.text();
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(maskText, 'application/xml');
			const units = xmlDoc.querySelectorAll('trans-unit');
			maskIds = Array.from(units)
				.map((u) => u.getAttribute('id'))
				.filter(Boolean);
		}
		const response = await fetch('/api/export', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ language, maskIds }),
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
					data.maxwidthErrors
						.map(
							(e) =>
								`<li style='margin-bottom:2px;'><b>${e.id}</b>: <span style='color:#b71c1c; word-break:break-all;'>${e.value}</span> (max: ${e.maxwidth})</li>`,
						)
						.join('') +
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
loadLanguages();

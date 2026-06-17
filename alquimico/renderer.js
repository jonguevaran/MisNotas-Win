// Mock API for browser testing without Electron
if (!window.api) {
    console.warn("Running in browser mode! Using mock API.");
    window.api = {
        getTree: async () => [
            {
                type: 'notebook',
                name: 'Bienvenida',
                children: [
                    {
                        type: 'category',
                        name: 'Ejemplo Codigo',
                        children: [
                            {
                                type: 'note',
                                name: 'Ejemplo Codigo',
                                path: 'mock/path'
                            }
                        ]
                    }
                ]
            }
        ],
        readNote: async () => `--h1 Ejemplos de Sintaxis Zcodex\n\nBienvenido al documento de demostración. Aquí podrás ver todos los recursos visuales que ofrece nuestra sintaxis personalizada.\n\n--h2 Formato de Texto\nPuedes hacer que tus textos destaquen utilizando --strong negritas strong-- o dándole un toque de --em cursiva em--. Además, puedes insertar un salto de línea en medio de un párrafo --br para continuar en la siguiente línea sin crear un nuevo bloque.\n\n--h3 Enlaces e Imágenes\nSi necesitas enlazar a otra página, puedes usar: --a -https://github.com--Enlace a GitHub- a--.\nTambién es fácil incrustar imágenes:\n--img -https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80--Laboratorio Alquímico- img--\n\n--hr\n\n--h2 Listas y Citas\n\nA continuación, una lista de ingredientes alquímicos (desordenada):\n--ulli Piedra filosofal\n--ulli Polvo de estrellas\n--ulli Extracto de luna\n\nY aquí los pasos para la transmutación (lista ordenada):\n--olli Preparar el crisol\n--olli Calentar a fuego lento\n--olli Añadir el material base\n\nA veces es necesario recordar las palabras de los antiguos:\n--blq "Lo que es abajo es como lo que es arriba, y lo que es arriba es como lo que es abajo, para realizar el milagro de una sola cosa." blq--\n\n--hr\n\n--h2 Bloques de Código y Tablas\n\nPara mencionar una variable rápida en un texto, usa código en línea como --code const elixir = true; code--. Para funciones completas, utiliza el bloque de código:\n\n--precode\n// Función de transmutación principal\nfunction transmutar(materiaPrima) {\n    if (materiaPrima === 'Plomo') {\n        return 'Oro';\n    }\n    return materiaPrima;\n}\nconsole.log(transmutar('Plomo'));\nprecode--\n\nFinalmente, puedes estructurar datos usando tablas:\n\n// Titulo1 // Titulo2 // Titulo3 //\n// <- // <-> // -> //\n// texto // texto // texto //\n\n¡Y eso es todo! Empieza a escribir tus propias notas.`,
        saveNote: async () => true,
        createNotebook: async () => true,
        createCategory: async () => true,
        createNote: async () => 'mock/path',
        renameNode: async () => 'mock/newPath',
        processImage: async (notePath, sourcePath) => 'mock/img/image.jpg'
    };
}

let currentTree = [];
let activeNotePath = null;
let isEditMode = false;
let sidebarLeftOpen = false;
let sidebarRightOpen = false;
let saveTimeout = null;

// DOM Elements
const treeView = document.getElementById('tree-view');
const btnAddNotebook = document.getElementById('btn-add-notebook');
const noteTitleEl = document.getElementById('note-title');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const toggleText = document.getElementById('toggle-text');
const toggleIcon = document.getElementById('toggle-icon');

const editorContainer = document.getElementById('editor-container');
const previewContainer = document.getElementById('preview-container');
const emptyState = document.getElementById('empty-state');

const markdownInput = document.getElementById('markdown-input');
const htmlOutput = document.getElementById('html-output');
const saveStatus = document.getElementById('save-status');

// Modal Elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
let modalCallback = null;

// Initialization
async function loadTree() {
    currentTree = await window.api.getTree();
    renderTree();
}

function renderTree() {
    treeView.innerHTML = '';
    
    if (currentTree.length === 0) {
        treeView.innerHTML = `
            <div class="p-4 text-center text-sm text-slate-400">
                No hay cuadernos
            </div>
        `;
        return;
    }

    currentTree.forEach(nb => {
        const nbEl = document.createElement('div');
        nbEl.className = 'mb-2';
        
        const escapedNbPath = nb.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedNbName = nb.name.replace(/'/g, "\\'");

        const nbItem = document.createElement('div');
        nbItem.className = 'flex items-center justify-between p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition group';
        nbItem.innerHTML = `
            <span class="font-bold flex items-center text-sm truncate cursor-pointer select-none" onclick="this.parentElement.nextElementSibling.classList.toggle('hidden')">
                <span class="mr-2 text-violet-500">
                    <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v16H4V4zm4 0v16M8 8h8m-8 4h8m-8 4h8"/></svg>
                </span>
                ${nb.name}
            </span>
            <div class="hidden group-hover:flex items-center space-x-1">
                <button title="Renombrar Cuaderno" onclick="promptRename('notebook', '${escapedNbPath}', '${escapedNbName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                <button title="Añadir Categoría" onclick="promptCreateCategory('${escapedNbName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                </button>
            </div>
        `;
        
        const nbChildren = document.createElement('div');
        nbChildren.className = 'ml-3 pl-2 border-l border-slate-200 dark:border-slate-800 mt-1 space-y-1';
        
        nb.children.forEach(child => {
            if (child.type === 'category') {
                const catEl = document.createElement('div');
                catEl.className = 'mb-1';
                
                const escapedCatPath = child.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const escapedCatName = child.name.replace(/'/g, "\\'");

                const catItem = document.createElement('div');
                catItem.className = 'flex items-center justify-between p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition group';
                catItem.innerHTML = `
                    <span class="font-semibold flex items-center text-xs truncate cursor-pointer select-none" onclick="this.parentElement.nextElementSibling.classList.toggle('hidden')">
                        <span class="mr-2 text-violet-400">
                            <svg class="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        </span>
                        ${child.name}
                    </span>
                    <div class="hidden group-hover:flex items-center space-x-1">
                        <button title="Renombrar Categoría" onclick="promptRename('category', '${escapedCatPath}', '${escapedCatName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button title="Añadir Nota" onclick="promptCreateNote('${escapedNbName}', '${escapedCatName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                `;
                
                const catChildren = document.createElement('div');
                catChildren.className = 'ml-3 pl-2 border-l border-slate-100 dark:border-slate-800/50 mt-1 space-y-1';
                child.children.forEach(note => {
                    catChildren.appendChild(createNoteEl(note));
                });
                
                catEl.appendChild(catItem);
                catEl.appendChild(catChildren);
                nbChildren.appendChild(catEl);
            }
        });
        
        nbEl.appendChild(nbItem);
        nbEl.appendChild(nbChildren);
        treeView.appendChild(nbEl);
    });
}

function createNoteEl(note) {
    const el = document.createElement('div');
    const isActive = activeNotePath === note.path;
    const activeClasses = isActive 
        ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-950 dark:text-white border-violet-600' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent';
        
    const escapedPath = note.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedName = note.name.replace(/'/g, "\\'");

    el.className = `p-2 rounded-lg cursor-pointer transition flex items-center justify-between text-xs border-l-2 group ${activeClasses}`;
    el.innerHTML = `
        <div class="flex items-center truncate" onclick="selectNote({name: '${escapedName}', path: '${escapedPath}'})">
            <span class="mr-2">📝</span><span class="truncate">${note.name}</span>
        </div>
        <div class="hidden group-hover:flex items-center">
            <button title="Renombrar Nota" onclick="promptRename('note', '${escapedPath}', '${escapedName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            </button>
        </div>
    `;
    return el;
}

// Modal Logic
function openModal(title, callback, defaultValue = '') {
    modalTitle.textContent = title;
    modalInput.value = defaultValue;
    modalCallback = callback;
    modal.classList.remove('hidden');
    modalInput.focus();
}

function closeModal() {
    modal.classList.add('hidden');
    modalCallback = null;
}

modalCancel.onclick = closeModal;
modalConfirm.onclick = () => {
    const val = modalInput.value.trim();
    if (val && modalCallback) {
        modalCallback(val);
    }
    closeModal();
};

btnAddNotebook.onclick = () => {
    openModal('Nuevo Cuaderno', async (name) => {
        await window.api.createNotebook(name);
        await loadTree();
        showNotification("¡Cuaderno creado! 📁");
    });
};

window.promptCreateCategory = (nbName, e) => {
    e.stopPropagation();
    openModal('Nueva Categoría', async (name) => {
        await window.api.createCategory(nbName, name);
        await loadTree();
        showNotification("¡Categoría creada! 📂");
    });
};

window.promptCreateNote = (nbName, catName, e) => {
    e.stopPropagation();
    openModal('Nueva Nota', async (name) => {
        const p = await window.api.createNote(nbName, catName, name);
        await loadTree();
        selectNote({ name: name, path: p });
        showNotification("¡Nota creada! ✏️");
    });
};

window.promptRename = (type, oldPath, currentName, e) => {
    e.stopPropagation();
    let title = 'Renombrar Nivel';
    if (type === 'notebook') title = 'Renombrar Cuaderno';
    else if (type === 'category') title = 'Renombrar Categoría';
    else if (type === 'note') title = 'Renombrar Nota';

    openModal(title, async (newName) => {
        if (newName === currentName) return;
        const newPath = await window.api.renameNode(oldPath, newName, type);
        if (newPath) {
            await loadTree();
            if (type === 'note' && activeNotePath === oldPath) {
                activeNotePath = newPath;
                noteTitleEl.textContent = newName;
            }
            showNotification(`¡Renombrado exitoso! ✨`);
        }
    }, currentName);
};

const btnRenameNote = document.getElementById('btn-rename-note');
if (btnRenameNote) {
    btnRenameNote.onclick = (e) => {
        if (!activeNotePath) return;
        const currentName = noteTitleEl.textContent;
        promptRename('note', activeNotePath, currentName, e);
    };
}

// Editor Logic
async function selectNote(note) {
    if (activeNotePath && isEditMode) {
        await saveCurrentNote();
    }
    activeNotePath = note.path;
    noteTitleEl.textContent = note.name;
    
    emptyState.classList.add('hidden');
    btnToggleMode.classList.remove('hidden');
    
    const content = await window.api.readNote(note.path);
    markdownInput.value = content;
    
    showReadMode();
    renderTree();
    
    if (window.innerWidth < 768) {
        closeSidebar('left');
    }
}

async function saveCurrentNote() {
    if (activeNotePath) {
        showSaveStatus(false);
        await window.api.saveNote(activeNotePath, markdownInput.value);
        showSaveStatus(true);
    }
}

function showSaveStatus(saved) {
    if (saved) {
        saveStatus.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
            <span>Guardado</span>
        `;
        saveStatus.className = "flex items-center space-x-1 text-emerald-500 font-medium";
    } else {
        saveStatus.innerHTML = `
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"/></svg>
            <span>Guardando...</span>
        `;
        saveStatus.className = "flex items-center space-x-1 text-amber-500 font-medium";
    }
}

btnToggleMode.onclick = async () => {
    if (isEditMode) {
        await saveCurrentNote();
        showReadMode();
    } else {
        showEditMode();
    }
};

function showEditMode() {
    isEditMode = true;
    editorContainer.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    toggleText.innerText = "Modo Edición";
    toggleIcon.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
    `;
    markdownInput.focus();
}

function showReadMode() {
    isEditMode = false;
    updatePreview();
    editorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    toggleText.innerText = "Modo Lectura";
    toggleIcon.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
    `;
}

markdownInput.addEventListener('input', (e) => {
    // Autocompletado de etiquetas Zcodex
    if (e.inputType === 'insertText' && e.data === ' ') {
        const cursor = markdownInput.selectionStart;
        const textToCursor = markdownInput.value.substring(0, cursor - 1);
        const words = textToCursor.split(/\s+/);
        const lastWord = words[words.length - 1];
        
        const CLOSING_TAGS = {
            '--strong': ' strong--',
            '--em': ' em--',
            '--code': ' code--',
            '--blq': ' blq--'
        };

        if (CLOSING_TAGS[lastWord]) {
            const closing = CLOSING_TAGS[lastWord];
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + closing + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = cursor;
        } else if (lastWord === '--a' || lastWord === '--img') {
            const closing = lastWord === '--a' ? '-Url--Texto- a--' : '-Url--Texto- img--';
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + closing + after;
            // Seleccionar la palabra "Url" para que el usuario empiece a escribir directamente
            markdownInput.selectionStart = cursor + 1;
            markdownInput.selectionEnd = cursor + 4;
        } else if (lastWord === '--precode') {
            const before = markdownInput.value.substring(0, cursor - 1);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + '\n\nprecode--' + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = before.length + 1;
        }
    }

    showSaveStatus(false);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveCurrentNote, 1000);
});

// Zcodex Parser
function parseZcodex(text) {
    if (!text) return '';

    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    let lines = escaped.split('\n');
    let resultLines = [];
    let inTable = false;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('//') && line.endsWith('//')) {
            inTable = true;
            tableRows.push(line);
        } else {
            if (inTable) {
                resultLines.push(renderTableHTML(tableRows));
                tableRows = [];
                inTable = false;
            }
            resultLines.push(lines[i]);
        }
    }
    if (inTable) {
        resultLines.push(renderTableHTML(tableRows));
    }

    let parsed = resultLines.join('\n');

    parsed = parsed.replace(/^--h1\s+(.*)$/gm, '<h1 class="text-3xl font-extrabold text-slate-900 dark:text-white mt-8 mb-4 border-b pb-2 border-slate-100 dark:border-slate-800">$1</h1>');
    parsed = parsed.replace(/^--h2\s+(.*)$/gm, '<h2 class="text-2xl font-bold text-slate-900 dark:text-white mt-6 mb-3">$1</h2>');
    parsed = parsed.replace(/^--h3\s+(.*)$/gm, '<h3 class="text-xl font-semibold text-slate-900 dark:text-white mt-5 mb-2">$1</h3>');

    parsed = parsed.replace(/--hr/g, '<hr class="my-6 border-t border-slate-200 dark:border-slate-700">');
    parsed = parsed.replace(/--br/g, '<br>');

    parsed = parsed.replace(/--precode\s+([\s\S]*?)\s+precode--/g, function(match, codeContent) {
        return `<pre class="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-mono text-xs overflow-x-auto my-5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"><code>${codeContent}</code></pre>`;
    });

    parsed = parsed.replace(/--blq\s+([\s\S]*?)\s+blq--/g, '<blockquote class="border-l-4 border-violet-500 pl-4 py-2 italic my-5 bg-violet-50/50 dark:bg-violet-950/20 text-slate-700 dark:text-slate-300 rounded-r-lg">$1</blockquote>');

    parsed = parsed.replace(/^--ulli\s+(.*)$/gm, '<ul><li class="list-disc list-inside ml-4 my-1.5 text-slate-700 dark:text-slate-300">$1</li></ul>');
    parsed = parsed.replace(/<\/ul>\s*<ul>/g, ''); 

    parsed = parsed.replace(/^--olli\s+(.*)$/gm, '<ol><li class="list-decimal list-inside ml-4 my-1.5 text-slate-700 dark:text-slate-300">$1</li></ol>');
    parsed = parsed.replace(/<\/ol>\s*<ol>/g, '');

    parsed = parsed.replace(/--img\s+-(.*?)--(.*?)-\s+img--/g, '<img src="$1" alt="$2" class="max-w-full h-auto rounded-xl shadow-md my-6 border border-slate-200 dark:border-slate-700 block mx-auto">');

    parsed = parsed.replace(/--a\s+-(.*?)--(.*?)-\s+a--/g, '<a href="$1" class="text-violet-600 dark:text-violet-400 hover:underline font-semibold" target="_blank">$2</a>');

    parsed = parsed.replace(/--strong\s+(.*?)\s+strong--/g, '<strong class="font-bold text-slate-950 dark:text-white">$1</strong>');

    parsed = parsed.replace(/--em\s+(.*?)\s+em--/g, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>');

    parsed = parsed.replace(/--code\s+(.*?)\s+code--/g, '<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs text-pink-600 dark:text-pink-400 font-semibold">$1</code>');

    let sections = parsed.split(/\n{2,}/);
    let processedSections = sections.map(section => {
        if (section.trim() === '') return '';
        if (/^<(h1|h2|h3|hr|pre|blockquote|ul|ol|table|div|img)/i.test(section.trim())) {
            return section;
        }
        return `<p class="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">${section.replace(/\n/g, '<br>')}</p>`;
    });

    return processedSections.join('\n');
}

// Renderizador de Tablas Zcodex
function renderTableHTML(rows) {
    if (rows.length === 0) return '';
    
    let cleanRows = rows.map(r => r.split('//').map(cell => cell.trim()).filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1));
    
    if (cleanRows.length === 0) return '';

    let headers = cleanRows[0];
    let alignment = [];
    let startDataIndex = 1;

    if (cleanRows.length > 1) {
        let secondRow = cleanRows[1];
        let isAlignRow = secondRow.every(cell => /^<?-+>?$/.test(cell));
        if (isAlignRow) {
            alignment = secondRow.map(cell => {
                if (cell.startsWith('<') && cell.endsWith('>')) return 'center';
                if (cell.endsWith('>')) return 'right';
                return 'left';
            });
            startDataIndex = 2;
        }
    }

    while (alignment.length < headers.length) {
        alignment.push('left');
    }

    let html = '<div class="overflow-x-auto my-6 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm bg-white dark:bg-slate-900">';
    html += '<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">';
    
    html += '<thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider font-semibold">';
    html += '<tr>';
    headers.forEach((h, idx) => {
        let alignClass = alignment[idx] === 'center' ? 'text-center' : (alignment[idx] === 'right' ? 'text-right' : 'text-left');
        html += `<th class="px-6 py-3.5 ${alignClass}">${h}</th>`;
    });
    html += '</tr></thead>';

    html += '<tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-400">';
    for (let i = startDataIndex; i < cleanRows.length; i++) {
        html += '<tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition duration-150">';
        let rowData = cleanRows[i];
        while (rowData.length < headers.length) rowData.push('');
        rowData.slice(0, headers.length).forEach((cell, idx) => {
            let alignClass = alignment[idx] === 'center' ? 'text-center' : (alignment[idx] === 'right' ? 'text-right' : 'text-left');
            html += `<td class="px-6 py-4 ${alignClass}">${cell}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function updatePreview() {
    const editorText = markdownInput.value;
    const parsedHTML = parseZcodex(editorText);
    htmlOutput.innerHTML = parsedHTML || `<p class="text-slate-400 italic">Contenido vacío...</p>`;
}

// Templates Insert
window.insertTemplate = (templateText) => {
    if (!activeNotePath) return;

    if (!isEditMode) {
        showEditMode();
    }

    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const text = markdownInput.value;
    const before = text.substring(0, start);
    const after  = text.substring(end, text.length);

    markdownInput.value = before + templateText + after;
    
    markdownInput.selectionStart = markdownInput.selectionEnd = start + templateText.length;
    markdownInput.focus();

    showSaveStatus(false);
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveCurrentNote, 1000);
    showNotification("¡Formato insertado! 📥");
};

// UI Toggles
window.toggleSidebar = (side) => {
    if (side === 'left') {
        const el = document.getElementById('sidebar-left');
        sidebarLeftOpen = !sidebarLeftOpen;
        if (sidebarLeftOpen) {
            el.classList.remove('-translate-x-full');
            closeSidebar('right');
        } else {
            el.classList.add('-translate-x-full');
        }
    } else if (side === 'right') {
        const el = document.getElementById('sidebar-right');
        sidebarRightOpen = !sidebarRightOpen;
        if (sidebarRightOpen) {
            el.classList.remove('translate-x-full');
            closeSidebar('left');
        } else {
            el.classList.add('translate-x-full');
        }
    }
};

window.closeSidebar = (side) => {
    if (side === 'left') {
        document.getElementById('sidebar-left').classList.add('-translate-x-full');
        sidebarLeftOpen = false;
    } else if (side === 'right') {
        document.getElementById('sidebar-right').classList.add('translate-x-full');
        sidebarRightOpen = false;
    }
};

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-sun').classList.remove('hidden');
        document.getElementById('theme-moon').classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-sun').classList.add('hidden');
        document.getElementById('theme-moon').classList.remove('hidden');
    }
}

window.toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-sun').classList.add('hidden');
        document.getElementById('theme-moon').classList.remove('hidden');
        showNotification("¡Modo claro activado! ☀️");
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-sun').classList.remove('hidden');
        document.getElementById('theme-moon').classList.add('hidden');
        showNotification("¡Modo oscuro activado! 🌙");
    }
};

window.showNotification = (msg) => {
    const el = document.getElementById('notification');
    const msgEl = document.getElementById('notification-msg');
    msgEl.innerText = msg;
    
    el.classList.remove('translate-y-20', 'opacity-0');
    el.classList.add('translate-y-0', 'opacity-100');
    
    setTimeout(() => {
        el.classList.remove('translate-y-0', 'opacity-100');
        el.classList.add('translate-y-20', 'opacity-0');
    }, 2500);
};

// Paste image logic
markdownInput.addEventListener('paste', async (e) => {
    if (!activeNotePath) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                console.log("Image pasting requires DataURL support in main. Skipping for now.");
                showNotification("No soportado por ahora.");
            };
            reader.readAsDataURL(blob);
        }
    }
});

// Auto-save on blur
markdownInput.addEventListener('blur', () => {
    saveCurrentNote();
});

// Start
initTheme();
loadTree();

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
        readNote: async () => `..h1 Ejemplos de Sintaxis Zcodex\n\nBienvenido al documento de demostración. Aquí podrás ver todos los recursos visuales que ofrece nuestra sintaxis personalizada.\n\n..h2 Formato de Texto\nPuedes hacer que tus textos destaquen utilizando ..strong negritas strong.. o dándole un toque de ..em cursiva em... Además, puedes insertar un salto de línea en medio de un párrafo ..br para continuar en la siguiente línea sin crear un nuevo bloque.\n\n..h3 Enlaces e Imágenes\nSi necesitas enlazar a otra página, puedes usar: ..a ::https://github.com::Enlace a GitHub:: a...\nTambién es fácil incrustar imágenes:\n..img ::https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=600&q=80::Laboratorio Alquímico:: img..\n\n..hr\n\n..h2 Listas y Citas\n\nA continuación, una lista de ingredientes alquímicos (desordenada):\n..ulli Piedra filosofal\n..ulli Polvo de estrellas\n..ulli Extracto de luna\n\nY aquí los pasos para la transmutación (lista ordenada):\n..olli Preparar el crisol\n..olli Calentar a fuego lento\n..olli Añadir el material base\n\nA veces es necesario recordar las palabras de los antiguos:\n..blq "Lo que es abajo es como lo que es arriba, y lo que es arriba es como lo que es abajo, para realizar el milagro de una sola cosa." blq..\n\n..hr\n\n..h2 Bloques de Código y Tablas\n\nPara mencionar una variable rápida en un texto, usa código en línea como ..code const elixir = true; code... Para funciones completas, utiliza el bloque de código:\n\n..precode\n// Función de transmutación principal\nfunction transmutar(materiaPrima) {\n    if (materiaPrima === 'Plomo') {\n        return 'Oro';\n    }\n    return materiaPrima;\n}\nconsole.log(transmutar('Plomo'));\nprecode..\n\nFinalmente, puedes estructurar datos usando tablas:\n\n// Titulo1 // Titulo2 // Titulo3 //\n// <- // <-> // -> //\n// texto // texto // texto //\n\n¡Y eso es todo! Empieza a escribir tus propias notas.`,
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
const toggleIcon = document.getElementById('toggle-icon');
const noteActions = document.getElementById('note-actions');
const btnExportNote = document.getElementById('btn-export-note');
const btnCopyNote = document.getElementById('btn-copy-note');
const btnNormalizeZcodex = document.getElementById('btn-normalize-zcodex');

const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsDirInput = document.getElementById('settings-dir-input');
const btnSelectDir = document.getElementById('btn-select-dir');

const editorContainer = document.getElementById('editor-container');
const previewContainer = document.getElementById('preview-container');
const emptyState = document.getElementById('empty-state');

const markdownInput = document.getElementById('markdown-input');
const syntaxBackdrop = document.getElementById('syntax-backdrop');
const htmlOutput = document.getElementById('html-output');
const saveStatus = document.getElementById('save-status');

// Modal Elements
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
let modalCallback = null;

const btnDeleteNote = document.getElementById('btn-delete-note');

const moveModal = document.getElementById('move-modal');
const moveNotebookSelect = document.getElementById('move-notebook-select');
const moveCategorySelect = document.getElementById('move-category-select');
const moveCancel = document.getElementById('move-cancel');
const moveConfirm = document.getElementById('move-confirm');
let noteToMovePath = null;

let treeState = {};
let searchTerm = '';

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeHtml(str) {
    return str
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function highlightZcodex(text) {
    const independentTags = ['t1', 't2', 't3', 'h', 's', 'l', 'lo', 'm', 'r'];
    let depth = 0;
    const tagRegex = /(?<!\S)(\.\.(?:t1|t2|t3|h|s|c|b|l|lo|ei|edir|e|n|cl|p|m|r(?:::[a-zA-Z0-9]+)?))|(?:(t1|t2|t3|h|s|c|b|l|lo|ei|edir|e|n|c|p|m|r)\.\.)|(::)/g;
    
    let result = '';
    let lastIndex = 0;
    let match;
    
    while ((match = tagRegex.exec(text)) !== null) {
        const before = text.substring(lastIndex, match.index);
        result += escapeHtml(before);
        
        if (match[3]) {
            result += `<span class="zcodex-separator">::</span>`;
            lastIndex = tagRegex.lastIndex;
            continue;
        }

        const isOpening = !!match[1];
        const tagName = isOpening ? match[1].substring(2) : match[2];
        const isIndependent = independentTags.includes(tagName);
        
        let spanClass;
        if (isOpening && isIndependent) {
            spanClass = 'zcodex-independent-tag';
        } else {
            spanClass = depth === 0 ? 'zcodex-parent-tag' : 'zcodex-nested-tag';
        }
        
        if (isOpening) {
            result += `<span class="${spanClass}">${escapeHtml(match[1])}</span>`;
            if (!isIndependent) depth++;
        } else {
            if (depth > 0) depth--;
            spanClass = depth === 0 ? 'zcodex-parent-tag' : 'zcodex-nested-tag';
            result += `<span class="${spanClass}">${escapeHtml(match[0])}</span>`;
        }
        lastIndex = tagRegex.lastIndex;
    }
    
    result += escapeHtml(text.substring(lastIndex));
    if (result.endsWith('\n')) {
        result += '<br>';
    }
    
    return result;
}

function updateSyntaxHighlighting() {
    if (!syntaxBackdrop) return;
    syntaxBackdrop.innerHTML = highlightZcodex(markdownInput.value);
}

function matchSearch(name, term) {
    if (!term) return true;
    const n = normalizeText(name);
    const terms = normalizeText(term).split(/\s+/).filter(t => t);
    return terms.every(t => n.includes(t));
}

function toggleNode(path, el) {
    treeState[path] = !treeState[path];
    el.parentElement.nextElementSibling.classList.toggle('hidden');
}


// Initialization
async function loadTree() {
    const config = await window.api.getConfig();
    if (settingsDirInput) {
        settingsDirInput.value = config.dataDir;
    }
    currentTree = await window.api.getTree();
    renderTree();

    const searchInput = document.getElementById('search-input');
    if (searchInput && !searchInput._listenerAdded) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderTree();
        });
        searchInput._listenerAdded = true;
    }
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
        const matchedCats = [];
        let nbMatches = matchSearch(nb.name, searchTerm);
        let hasAnyMatch = nbMatches;

        nb.children.forEach(child => {
            if (child.type === 'category') {
                const matchedNotes = [];
                let catMatches = matchSearch(child.name, searchTerm);
                let catHasMatch = catMatches;

                child.children.forEach(note => {
                    if (matchSearch(note.name, searchTerm) || catMatches || nbMatches) {
                        matchedNotes.push(note);
                        catHasMatch = true;
                        hasAnyMatch = true;
                    }
                });

                if (catHasMatch || searchTerm === '') {
                    matchedCats.push({ ...child, children: matchedNotes.length > 0 ? matchedNotes : child.children });
                }
            }
        });

        if (!hasAnyMatch && searchTerm !== '') return;

        const nbEl = document.createElement('div');
        nbEl.className = 'mb-2';
        
        const escapedNbPath = nb.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedNbName = nb.name.replace(/'/g, "\\'");
        const isNbExpanded = searchTerm !== '' || treeState[nb.path];

        const nbItem = document.createElement('div');
        nbItem.className = 'flex items-center justify-between p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition group cursor-pointer';
        nbItem.onclick = (e) => { if (e.target.closest('button')) return; toggleNode(nb.path, nbItem.firstElementChild); };
        nbItem.innerHTML = `
            <span class="font-bold flex items-center text-sm truncate select-none">
                <span class="mr-2 text-violet-500">
                    <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v16H4V4zm4 0v16M8 8h8m-8 4h8m-8 4h8"/></svg>
                </span>
                ${nb.name}
            </span>
            <div class="hidden group-hover:flex items-center space-x-1">
                <button title="Renombrar Cuaderno" onclick="event.stopPropagation(); promptRename('notebook', '${escapedNbPath}', '${escapedNbName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                </button>
                <button title="Añadir Categoría" onclick="event.stopPropagation(); promptCreateCategory('${escapedNbName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                </button>
            </div>
        `;
        
        const nbChildren = document.createElement('div');
        nbChildren.className = `ml-3 pl-2 border-l border-slate-200 dark:border-slate-800 mt-1 space-y-1 ${isNbExpanded ? '' : 'hidden'}`;
        
        const catsToRender = searchTerm !== '' ? matchedCats : nb.children;
        catsToRender.forEach(child => {
            if (child.type === 'category') {
                const catEl = document.createElement('div');
                catEl.className = 'mb-1';
                
                const escapedCatPath = child.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const escapedCatName = child.name.replace(/'/g, "\\'");
                const isCatExpanded = searchTerm !== '' || treeState[child.path];

                const catItem = document.createElement('div');
                catItem.className = 'flex items-center justify-between p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition group cursor-pointer';
                catItem.onclick = (e) => { if (e.target.closest('button')) return; toggleNode(child.path, catItem.firstElementChild); };
                catItem.innerHTML = `
                    <span class="font-semibold flex items-center text-xs truncate select-none">
                        <span class="mr-2 text-violet-400">
                            <svg class="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        </span>
                        ${child.name}
                    </span>
                    <div class="hidden group-hover:flex items-center space-x-1">
                        <button title="Renombrar Categoría" onclick="event.stopPropagation(); promptRename('category', '${escapedCatPath}', '${escapedCatName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        <button title="Añadir Nota" onclick="event.stopPropagation(); promptCreateNote('${escapedNbName}', '${escapedCatName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                `;
                
                const catChildren = document.createElement('div');
                catChildren.className = `ml-3 pl-2 border-l border-slate-100 dark:border-slate-800/50 mt-1 space-y-1 ${isCatExpanded ? '' : 'hidden'}`;
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
    el.onclick = (e) => {
        if (e.target.closest('button')) return;
        selectNote({name: note.name, path: note.path});
    };
    el.innerHTML = `
        <div class="flex items-center truncate">
            <span class="mr-2 text-violet-500">
                <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </span>
            <span class="truncate">${note.name}</span>
        </div>
        <div class="hidden group-hover:flex items-center space-x-1">
            <button title="Mover Nota" onclick="event.stopPropagation(); promptMoveNote('${escapedPath}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </button>
            <button title="Renombrar Nota" onclick="event.stopPropagation(); promptRename('note', '${escapedPath}', '${escapedName}', event)" class="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/50 transition">
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

btnSettings.onclick = async () => {
    const config = await window.api.getConfig();
    settingsDirInput.value = config.dataDir;
    settingsModal.classList.remove('hidden');
};

settingsModal.onclick = (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
};

btnSelectDir.onclick = async () => {
    const newDir = await window.api.selectDirectory();
    if (newDir) {
        settingsDirInput.value = newDir;
        await loadTree();
        showNotification("¡Directorio actualizado! 📁");
    }
};

btnAddNotebook.onclick = () => {
    openModal('Nuevo Cuaderno', async (name) => {
        name = name.trim().toUpperCase();
        await window.api.createNotebook(name);
        await loadTree();
        showNotification("¡Cuaderno creado! 📔");
    });
};

window.promptCreateCategory = (nbName, e) => {
    e.stopPropagation();
    openModal('Nueva Categoría', async (name) => {
        name = name.trim().toUpperCase();
        await window.api.createCategory(nbName, name);
        await loadTree();
        showNotification("¡Categoría creada! 📁");
    });
};

window.promptCreateNote = (nbName, catName, e) => {
    e.stopPropagation();
    openModal('Nueva Nota', async (name) => {
        name = name.trim();
        name = name.charAt(0).toUpperCase() + name.slice(1);
        const p = await window.api.createNote(nbName, catName, name);
        await loadTree();
        selectNote({ name: name, path: p });
        showNotification("¡Nota creada! 📝");
    });
};

window.promptRename = (type, oldPath, currentName, e) => {
    e.stopPropagation();
    let title = 'Renombrar Nivel';
    if (type === 'notebook') title = 'Renombrar Cuaderno';
    else if (type === 'category') title = 'Renombrar Categoría';
    else if (type === 'note') title = 'Renombrar Nota';

    openModal(title, async (newName) => {
        newName = newName.trim();
        if (type === 'notebook' || type === 'category') newName = newName.toUpperCase();
        else if (type === 'note') newName = newName.charAt(0).toUpperCase() + newName.slice(1);
        
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

// Move Note Logic
window.promptMoveNote = (oldPath, e) => {
    e.stopPropagation();
    noteToMovePath = oldPath;
    
    moveNotebookSelect.innerHTML = '<option value="">Selecciona un cuaderno</option>';
    currentTree.forEach(nb => {
        moveNotebookSelect.innerHTML += `<option value="${nb.name}">${nb.name}</option>`;
    });
    
    moveCategorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    moveCategorySelect.disabled = true;
    
    moveModal.classList.remove('hidden');
};

moveNotebookSelect.onchange = () => {
    const nbName = moveNotebookSelect.value;
    moveCategorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    
    if (nbName) {
        const nb = currentTree.find(n => n.name === nbName);
        if (nb && nb.children) {
            nb.children.forEach(cat => {
                if (cat.type === 'category') {
                    moveCategorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
                }
            });
        }
        moveCategorySelect.disabled = false;
    } else {
        moveCategorySelect.disabled = true;
    }
};

moveCancel.onclick = () => {
    moveModal.classList.add('hidden');
    noteToMovePath = null;
};

moveConfirm.onclick = async () => {
    const nb = moveNotebookSelect.value;
    const cat = moveCategorySelect.value;
    
    if (!nb) {
        alert("Debes seleccionar un cuaderno de destino.");
        return;
    }
    
    const newPath = await window.api.moveNode(noteToMovePath, nb, cat);
    if (newPath) {
        await loadTree();
        if (activeNotePath === noteToMovePath) {
            activeNotePath = newPath;
        }
        showNotification("¡Nota movida exitosamente! 🚚");
        moveModal.classList.add('hidden');
        noteToMovePath = null;
    } else {
        alert("Error al mover la nota.");
    }
};

// Delete Note Logic
if (btnDeleteNote) {
    btnDeleteNote.onclick = async () => {
        if (!activeNotePath) return;
        
        const confirmed = confirm("¿Estás seguro de que deseas eliminar esta nota de forma permanente?");
        if (confirmed) {
            const success = await window.api.deleteNode(activeNotePath);
            if (success) {
                showNotification("¡Nota eliminada! 🗑️");
                activeNotePath = null;
                emptyState.classList.remove('hidden');
                noteActions.classList.add('hidden');
                editorContainer.classList.add('hidden');
                previewContainer.classList.add('hidden');
                await loadTree();
            }
        }
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
    noteActions.classList.remove('hidden');
    
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

function zcodexToMarkdown(zcodex) {
    let md = zcodex;
    md = md.replace(/(?<!\S)\.\.t1\s+(.*)$/gm, '# $1');
    md = md.replace(/(?<!\S)\.\.t2\s+(.*)$/gm, '## $1');
    md = md.replace(/(?<!\S)\.\.t3\s+(.*)$/gm, '### $1');
    md = md.replace(/(?<!\S)\.\.h(?=\s|$)/g, '---');
    md = md.replace(/(?<!\S)\.\.s(?=\s|$)/g, '\n');
    md = md.replace(/(?<!\S)\.\.c\s*\n([\s\S]*?)\n\s*c\.\./g, '```\n$1\n```');
    md = md.replace(/(?<!\S)\.\.b\s+([\s\S]*?)\s+b\.\./g, '> $1');
    md = md.replace(/(?<!\S)\.\.l\s+(.*)$/gm, '- $1');
    md = md.replace(/(?<!\S)\.\.lo\s+(.*)$/gm, '1. $1');
    md = md.replace(/(?<!\S)\.\.ei\s+::(.*?)::(.*?)::\s+ei\.\./g, '![$2]($1)');
    md = md.replace(/(?<!\S)\.\.edir\s+::(.*?)::(.*?)::\s+edir\.\./g, '![$2](img/$1)');
    md = md.replace(/(?<!\S)\.\.e\s+::(.*?)::(.*?)::\s+e\.\./g, '[$2]($1)');
    md = md.replace(/(?<!\S)\.\.n\s+(.*?)\s+n\.\./g, '**$1**');
    md = md.replace(/(?<!\S)\.\.c\s+(.*?)\s+c\.\./g, '*$1*');
    md = md.replace(/(?<!\S)\.\.cl\s+(.*?)\s+c\.\./g, '`$1`');
    md = md.replace(/(?<!\S)\.\.p\s+([\s\S]*?)\s+p\.\./g, '$1\n');
    md = md.replace(/(?<!\S)\.\.m\b/g, '..mark');
    
    let lines = md.split('\n');
    let inTable = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('//') && line.endsWith('//')) {
            lines[i] = '| ' + line.substring(2, line.length - 2).split('//').map(c => c.trim()).join(' | ') + ' |';
        } else if (line.startsWith('::') && line.endsWith('::') && line.length > 4) {
            lines[i] = '| ' + line.substring(2, line.length - 2).split('::').map(c => c.trim()).join(' | ') + ' |';
        }
    }
    return lines.join('\n');
}

btnExportNote.onclick = async () => {
    if (!activeNotePath) return;
    const content = zcodexToMarkdown(markdownInput.value);
    const success = await window.api.exportNote(content);
    if (success) {
        showNotification("¡Nota exportada exitosamente! 📥");
    }
};

btnCopyNote.onclick = async () => {
    if (!activeNotePath) return;
    try {
        let textToCopy = '';
        if (isEditMode) {
            textToCopy = markdownInput.value;
        } else {
            textToCopy = htmlOutput.innerText;
        }
        await navigator.clipboard.writeText(textToCopy);
        showNotification("¡Contenido copiado al portapapeles! 📋");
    } catch (err) {
        console.error('Error al copiar: ', err);
    }
};

function showEditMode() {
    isEditMode = true;
    editorContainer.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    btnToggleMode.setAttribute('title', 'Modo Edición');
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
    btnToggleMode.setAttribute('title', 'Modo Lectura');
    toggleIcon.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
    `;
}

markdownInput.addEventListener('scroll', () => {
    if (syntaxBackdrop) {
        syntaxBackdrop.scrollTop = markdownInput.scrollTop;
        syntaxBackdrop.scrollLeft = markdownInput.scrollLeft;
    }
});

markdownInput.addEventListener('input', () => {
    updateSyntaxHighlighting();
});
markdownInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        if (btnNormalizeZcodex) btnNormalizeZcodex.click();
    } else if (e.key === 'Enter') {
        if (typeof autocompleteActive !== 'undefined' && autocompleteActive) return;
        
        const cursor = markdownInput.selectionStart;
        const textToCursor = markdownInput.value.substring(0, cursor);
        const lines = textToCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        const matchList = currentLine.match(/^(\s*)(\.\.l|\.\.lo|\.\.m\s+\[[ xX]\])\s+(.*)$/);
        
        if (matchList) {
            e.preventDefault();
            const indent = matchList[1] || '';
            const prefix = matchList[2];
            const content = matchList[3].trim();
            
            // Si la línea está vacía (solo prefijo y espacios), borramos el prefijo
            if (!content) {
                const newTextToCursor = textToCursor.substring(0, textToCursor.length - currentLine.length);
                const afterCursor = markdownInput.value.substring(cursor);
                markdownInput.value = newTextToCursor + afterCursor;
                markdownInput.selectionStart = markdownInput.selectionEnd = newTextToCursor.length;
            } else {
                // Insertamos nueva línea con prefijo
                let newPrefix = prefix;
                if (prefix.startsWith('..m')) newPrefix = '..m [ ]';
                const insertion = `\n${newPrefix} `;
                const before = markdownInput.value.substring(0, cursor);
                const after = markdownInput.value.substring(cursor);
                markdownInput.value = before + insertion + after;
                markdownInput.selectionStart = markdownInput.selectionEnd = cursor + insertion.length;
            }
        } else {
            e.preventDefault();
            const indentMatch = currentLine.match(/^(\s*)/);
            let currentIndent = indentMatch ? indentMatch[1] : '';
            
            const insertion = '\n' + currentIndent;
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            markdownInput.value = before + insertion + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = cursor + insertion.length;
            updateSyntaxHighlighting();
        }
    } else if (e.key === 'Backspace') {
        const cursor = markdownInput.selectionStart;
        const textToCursor = markdownInput.value.substring(0, cursor);
        const lines = textToCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        if (currentLine === '..l ' || currentLine === '..lo ' || currentLine === '..m [ ] ' || currentLine === '..m [x] ' || currentLine === '..m [X] ') {
            e.preventDefault();
            const newTextToCursor = textToCursor.substring(0, textToCursor.length - currentLine.length);
            const afterCursor = markdownInput.value.substring(cursor);
            markdownInput.value = newTextToCursor + afterCursor;
            markdownInput.selectionStart = markdownInput.selectionEnd = newTextToCursor.length;
        }
    }
});

markdownInput.addEventListener('input', (e) => {
    // Autocompletado de etiquetas Zcodex
    if (e.inputType === 'insertText' && e.data === ' ') {
        const cursor = markdownInput.selectionStart;
        const textToCursor = markdownInput.value.substring(0, cursor - 1);
        const words = textToCursor.split(/\s+/);
        const lastWord = words[words.length - 1];
        
        const CLOSING_TAGS = {
            '..n': ' n..',
            '..c': ' c..',
            '..cl': ' c..',
            '..b': '\n\nb..',
            '..p': '\n\np..',
            '..r': ' r..'
        };

        if (CLOSING_TAGS[lastWord]) {
            const closing = CLOSING_TAGS[lastWord];
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + closing + after;
            if (closing.includes('\n')) {
                markdownInput.selectionStart = markdownInput.selectionEnd = cursor + 1;
            } else {
                markdownInput.selectionStart = markdownInput.selectionEnd = cursor;
            }
        } else if (lastWord.startsWith('..r::')) {
            const closing = ' r..';
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + closing + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = cursor;
        } else if (lastWord === '..edir') {
            const before = markdownInput.value.substring(0, cursor - 7);
            const after = markdownInput.value.substring(cursor);
            
            // Pausar y abrir dialogo
            markdownInput.value = before + '..edir' + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = cursor - 1;
            
            window.api.selectLocalImage(activeNotePath).then(filename => {
                if (filename) {
                    const insertion = `..edir ::${filename}::Texto:: edir..`;
                    markdownInput.value = before + insertion + after;
                    markdownInput.selectionStart = before.length + insertion.length - 13; // Select "Texto"
                    markdownInput.selectionEnd = before.length + insertion.length - 8;
                } else {
                    markdownInput.value = before + '..edir ' + after;
                    markdownInput.selectionStart = markdownInput.selectionEnd = before.length + 7;
                }
                updatePreview();
                markdownInput.focus();
            });
            return;
        } else if (lastWord === '..e' || lastWord === '..ei') {
            const closing = lastWord === '..e' ? '::Url::Texto:: e..' : '::Url::Texto:: ei..';
            const before = markdownInput.value.substring(0, cursor);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + closing + after;
            // Seleccionar la palabra "Url" para que el usuario empiece a escribir directamente
            markdownInput.selectionStart = cursor + 1;
            markdownInput.selectionEnd = cursor + 4;
        } else if (lastWord === '..c') {
            const before = markdownInput.value.substring(0, cursor - 1);
            const after = markdownInput.value.substring(cursor);
            
            markdownInput.value = before + '\n\nc..' + after;
            markdownInput.selectionStart = markdownInput.selectionEnd = before.length + 1;
        }
    }

    showSaveStatus(false);
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
        if ((line.startsWith('//') && line.endsWith('//')) || (line.startsWith('::') && line.endsWith('::') && line.length > 4)) {
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

    parsed = parsed.replace(/(?<!\S)\.\.t1\s+(.*)$/gm, '<h1 class="text-3xl font-extrabold text-slate-700 dark:text-white mt-8 mb-4 border-b pb-2 border-slate-100 dark:border-slate-800">$1</h1>');
    parsed = parsed.replace(/(?<!\S)\.\.t2\s+(.*)$/gm, '<h2 class="text-2xl font-bold text-slate-700 dark:text-white mt-6 mb-3">$1</h2>');
    parsed = parsed.replace(/(?<!\S)\.\.t3\s+(.*)$/gm, '<h3 class="text-xl font-semibold text-slate-700 dark:text-white mt-5 mb-2">$1</h3>');

    parsed = parsed.replace(/(?<!\S)\.\.h(?=\s|$)/g, '<hr class="my-6 border-t border-slate-200 dark:border-slate-700">');
    parsed = parsed.replace(/(?<!\S)\.\.s(?=\s|$)/g, '<br>');

    parsed = parsed.replace(/(?<!\S)\.\.c\s*\n([\s\S]*?)\n\s*c\.\./g, function(match, codeContent) {
        return `<pre class="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-mono text-xs overflow-x-auto my-5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"><code>${codeContent}</code></pre>`;
    });

    parsed = parsed.replace(/(?<!\S)\.\.b\s+([\s\S]*?)\s+b\.\./g, '<blockquote class="border-l-4 border-violet-500 pl-4 py-2 italic my-5 bg-violet-50/50 dark:bg-violet-950/20 text-slate-700 dark:text-slate-300 rounded-r-lg">$1</blockquote>');

    parsed = parsed.replace(/(?<!\S)\.\.l\s+(.*)$/gm, '<ul><li class="list-disc list-inside ml-4 mb-4 text-slate-700 dark:text-slate-300">$1</li></ul>');
    parsed = parsed.replace(/<\/ul>\s*<ul>/g, ''); 

    parsed = parsed.replace(/(?<!\S)\.\.lo\s+(.*)$/gm, '<ol><li class="list-decimal list-inside ml-4 mb-4 text-slate-700 dark:text-slate-300">$1</li></ol>');
    parsed = parsed.replace(/<\/ol>\s*<ol>/g, '');

    parsed = parsed.replace(/(?<!\S)\.\.ei\s+::(.*?)::(.*?)::\s+ei\.\./g, '<img src="$1" alt="$2" class="max-w-full h-auto rounded-xl shadow-md my-6 border border-slate-200 dark:border-slate-700 block mx-auto">');

    parsed = parsed.replace(/(?<!\S)\.\.edir\s+::(.*?)::(.*?)::\s+edir\.\./g, (match, p1, p2) => {
        let fullPath = '';
        if (activeNotePath) {
            fullPath = 'file:///' + (activeNotePath + '/img/' + p1).replace(/\\/g, '/');
        } else {
            fullPath = 'img/' + p1;
        }
        return `<img src="${fullPath}" alt="${p2}" class="max-w-full h-auto rounded-xl shadow-md my-6 border border-slate-200 dark:border-slate-700 block mx-auto">`;
    });

    parsed = parsed.replace(/(?<!\S)\.\.e\s+::(.*?)::(.*?)::\s+e\.\./g, '<a href="$1" class="text-violet-600 dark:text-violet-400 hover:underline font-semibold">$2</a>');

    parsed = parsed.replace(/(?<!\S)\.\.n\s+(.*?)\s+n\.\./g, '<strong class="font-bold text-slate-950 dark:text-white">$1</strong>');

    parsed = parsed.replace(/(?<!\S)\.\.r::([a-zA-Z0-9]+)\s+(.*?)\s+r\.\./g, '<span style="background-color: #$1; color: #000; padding: 0 4px; border-radius: 4px;">$2</span>');
    parsed = parsed.replace(/(?<!\S)\.\.r\s+(.*?)\s+r\.\./g, '<span style="background-color: #39ff14; color: #000; padding: 0 4px; border-radius: 4px;">$1</span>');

    parsed = parsed.replace(/(?<!\S)\.\.c\s+(.*?)\s+c\.\./g, '<em class="italic text-slate-800 dark:text-slate-200">$1</em>');

    parsed = parsed.replace(/(?<!\S)\.\.cl\s+(.*?)\s+c\.\./g, '<code class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-xs text-slate-800 dark:text-slate-200">$1</code>');

    parsed = parsed.replace(/(?<!\S)\.\.p\s+([\s\S]*?)\s+p\.\./g, '<p class="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">$1</p>');

    let markCount = 0;
    parsed = parsed.replace(/(?<!\S)\.\.m\s+\[( |x|X)\]\s+(.*)$/gm, (match, state, text) => {
        let isChecked = state.toLowerCase() === 'x' ? 'checked' : '';
        let index = markCount++;
        return `<div class="flex items-center space-x-3 mb-4 group">
                  <input type="checkbox" class="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 transition-colors cursor-pointer flex-shrink-0" style="width:20px;height:20px;min-width:20px;min-height:20px;flex-shrink:0" data-mark-index="${index}" ${isChecked} onchange="toggleZcodexMark(${index}, this.checked)">
                  <span class="text-slate-700 dark:text-slate-300 select-none transition-colors ${isChecked ? 'line-through opacity-60' : ''}">${text}</span>
                </div>`;
    });

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

window.toggleZcodexMark = (index, isChecked) => {
    let rawText = markdownInput.value;
    let count = 0;
    let newChar = isChecked ? 'x' : ' ';
    
    let newText = rawText.replace(/(?<!\S)\.\.m\s+\[( |x|X)\]/gm, (match, state) => {
        if (count === index) {
            count++;
            return `..m [${newChar}]`;
        }
        count++;
        return match;
    });
    
    if (rawText !== newText) {
        markdownInput.value = newText;
        updatePreview();
        if (activeNotePath) {
            window.api.saveNote(activeNotePath, newText).then(() => {
                showSaveStatus(true);
            });
        }
    }
};

// Renderizador de Tablas Zcodex
function renderTableHTML(rows) {
    if (rows.length === 0) return '';
    
    let cleanRows = rows.map(r => r.split(r.startsWith('::') ? '::' : '//').map(cell => cell.trim()).filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1));
    
    if (cleanRows.length === 0) return '';

    let headers = cleanRows[0];
    let alignment = [];
    let startDataIndex = 1;

    if (cleanRows.length > 1) {
        let secondRow = cleanRows[1];
        let isAlignRow = secondRow.every(cell => /^(&lt;|<)?-+(&gt;|>)?$/.test(cell));
        if (isAlignRow) {
            alignment = secondRow.map(cell => {
                const startsLeft = cell.startsWith('<') || cell.startsWith('&lt;');
                const endsRight  = cell.endsWith('>')  || cell.endsWith('&gt;');
                if (startsLeft && endsRight) return 'center';
                if (endsRight) return 'right';
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
        let rowData = cleanRows[i];
        let isTotalRow = rowData.some(c => c.trim() === '=');
        let rowClass = isTotalRow ? 'bg-slate-50 dark:bg-slate-800/60 font-semibold' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition duration-150';
        html += `<tr class="${rowClass}">`;
        while (rowData.length < headers.length) rowData.push('');
        rowData.slice(0, headers.length).forEach((cell, idx) => {
            let alignClass = alignment[idx] === 'center' ? 'text-center' : (alignment[idx] === 'right' ? 'text-right' : 'text-left');
            
            let cellContent = cell.trim();
            if (cellContent === '=') {
                let total = 0;
                for (let r = startDataIndex; r < cleanRows.length; r++) {
                    if (r === i) continue;
                    let rCell = (cleanRows[r][idx] || '').trim();
                    if (rCell.includes('*')) {
                        // Extract only digits, minus, and dot for robust parsing
                        let numStr = rCell.substring(rCell.indexOf('*') + 1).replace(/[^\d.-]/g, '');
                        let num = parseFloat(numStr);
                        if (!isNaN(num)) {
                            // Si el texto original tenía un signo menos antes o después del asterisco, asegurar que sea negativo
                            if (rCell.includes('-')) {
                                num = -Math.abs(num);
                            }
                            total += num;
                        }
                    }
                }
                // Limitar a 2 decimales si tiene decimales, para evitar problemas de precisión flotante
                cellContent = Number.isInteger(total) ? total.toString() : total.toFixed(2);
            } else if (cellContent.includes('*')) {
                cellContent = cellContent.replace('*', '').trim();
            }
            
            html += `<td class="px-6 py-4 ${alignClass}">${cellContent}</td>`;
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
    updateSyntaxHighlighting();
}

// Interceptar clicks en links del preview → abrir en navegador del sistema
htmlOutput.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    if (window.api && window.api.openExternal) {
        window.api.openExternal(href);
    }
});


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
        document.getElementById('theme-moon').classList.remove('hidden');
        document.getElementById('theme-sun').classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-moon').classList.add('hidden');
        document.getElementById('theme-sun').classList.remove('hidden');
    }
}

window.toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-moon').classList.add('hidden');
        document.getElementById('theme-sun').classList.remove('hidden');
        showNotification("¡Modo claro activado! ☀️");
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-moon').classList.remove('hidden');
        document.getElementById('theme-sun').classList.add('hidden');
        showNotification("¡Modo oscuro activado! 🌙");
    }
};

window.showNotification = (msg) => {
    const el = document.getElementById('notification');
    const msgEl = document.getElementById('notification-msg');
    const cleanMsg = msg.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u2728\u270F\u2702]/gu, '').trim();
    msgEl.innerText = cleanMsg;
    
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
const autocompletePopup = document.getElementById('autocomplete-popup');
const autocompleteList = document.getElementById('autocomplete-list');

const autocompleteDictionary = [
    { label: 'Encabezado 1', prefix: '..t1', insert: '..t1 ', selStart: 5, selEnd: 5 },
    { label: 'Encabezado 2', prefix: '..t2', insert: '..t2 ', selStart: 5, selEnd: 5 },
    { label: 'Encabezado 3', prefix: '..t3', insert: '..t3 ', selStart: 5, selEnd: 5 },
    { label: 'Párrafo', prefix: '..p', insert: '..p\n\np..', selStart: 4, selEnd: 4 },
    { label: 'Negrita', prefix: '..n', insert: '..n  n..', selStart: 4, selEnd: 4 },
    { label: 'Cursiva', prefix: '..c', insert: '..c  c..', selStart: 4, selEnd: 4 },
    { label: 'Código en línea', prefix: '..cl', insert: '..cl  c..', selStart: 5, selEnd: 5 },
    { label: 'Bloque de código', prefix: '..c', insert: '..c\n\nc..', selStart: 4, selEnd: 4 },
    { label: 'Enlace web', prefix: '..e', insert: '..e ::URL::Texto:: e..', selStart: 6, selEnd: 9 },
    { label: 'Imagen web', prefix: '..ei', insert: '..ei ::URL::Texto:: ei..', selStart: 7, selEnd: 10 },
    { label: 'Cita', prefix: '..b', insert: '..b\n\nb..', selStart: 4, selEnd: 4 },
    { label: 'Lista Desordenada', prefix: '..l', insert: '..l ', selStart: 4, selEnd: 4 },
    { label: 'Lista Ordenada', prefix: '..lo', insert: '..lo ', selStart: 5, selEnd: 5 },
    { label: 'Casilla de verificación', prefix: '..m', insert: '..m [ ] Texto', selStart: 8, selEnd: 13 },
    { label: 'Línea horizontal', prefix: '..h', insert: '..h\n', selStart: 4, selEnd: 4 },
    { label: 'Salto de línea', prefix: '..s', insert: '..s\n', selStart: 4, selEnd: 4 },
    { label: 'Tabla', prefix: '// ', insert: '// Titulo1 // Titulo2 // Titulo3 //\n// <- // <-> // -> //\n:: texto :: texto :: texto ::\n', selStart: 3, selEnd: 10 },
    { label: 'Resaltado', prefix: '..r', insert: '..r  r..', selStart: 4, selEnd: 4 },
    { label: 'Resaltado Color', prefix: '..r::', insert: '..r::HEX  r..', selStart: 9, selEnd: 9 }
];

let currentAutocompletePrefix = '';
let currentAutocompleteMatches = [];
let autocompleteSelectedIndex = 0;
let autocompleteActive = false;

function getCaretCoordinates(element, position) {
    const div = document.createElement('div');
    const style = getComputedStyle(element);
    for (const prop of style) {
        div.style[prop] = style[prop];
    }
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.textContent = element.value.substring(0, position);
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const coordinates = {
        top: span.offsetTop - element.scrollTop,
        left: span.offsetLeft - element.scrollLeft,
    };
    document.body.removeChild(div);
    return coordinates;
}

function closeAutocomplete() {
    autocompletePopup.classList.add('hidden');
    autocompleteActive = false;
}

function renderAutocompleteList() {
    autocompleteList.innerHTML = '';
    currentAutocompleteMatches.forEach((match, index) => {
        const li = document.createElement('li');
        li.className = `px-3 py-1.5 cursor-pointer flex justify-between items-center ${index === autocompleteSelectedIndex ? 'bg-violet-100 dark:bg-violet-900/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;
        li.innerHTML = `
            <span class="font-semibold text-slate-700 dark:text-slate-300">${match.label}</span>
            <span class="text-slate-400 font-mono text-[10px] ml-4">${match.prefix}</span>
        `;
        li.onmousedown = (e) => {
            e.preventDefault(); // prevent blur
            insertAutocomplete(match);
        };
        autocompleteList.appendChild(li);
    });
}

function insertAutocomplete(match) {
    const cursor = markdownInput.selectionStart;
    const textToCursor = markdownInput.value.substring(0, cursor);
    const prefixMatch = textToCursor.match(/(?:^|\s)(\.\.[a-z0-9]*(?:::[a-zA-Z0-9]*)?|\/\/\s?)$/);
    const prefixLength = prefixMatch ? prefixMatch[1].length : currentAutocompletePrefix.length;
    
    const before = markdownInput.value.substring(0, cursor - prefixLength);
    const after = markdownInput.value.substring(cursor);
    
    closeAutocomplete();
    
    if (match.prefix === '..edir') {
        window.api.selectLocalImage(activeNotePath).then(filename => {
            if (filename) {
                const insertion = `..idir ::${filename}::Texto:: idir..`;
                markdownInput.value = before + insertion + after;
                markdownInput.selectionStart = before.length + insertion.length - 13; // Select "Texto"
                markdownInput.selectionEnd = before.length + insertion.length - 8;
            } else {
                markdownInput.value = before + '..idir ' + after;
                markdownInput.selectionStart = markdownInput.selectionEnd = before.length + 7;
            }
            updatePreview();
            markdownInput.focus();
        });
        return;
    }
    
    markdownInput.value = before + match.insert + after;
    markdownInput.selectionStart = before.length + match.selStart;
    markdownInput.selectionEnd = before.length + match.selEnd;
    
    updateSyntaxHighlighting();
    showSaveStatus(false);
    markdownInput.focus();
}

markdownInput.addEventListener('input', (e) => {
    // Existing logic... (stays untouched as it's outside this chunk)
    
    // Autocomplete UI logic
    const cursor = markdownInput.selectionStart;
    const textToCursor = markdownInput.value.substring(0, cursor);
    const match = textToCursor.match(/(?:^|\s)(\.\.[a-z0-9]*(?:::[a-zA-Z0-9]*)?|\/\/\s?)$/);
    
    if (match) {
        // Evitar que Backspace vuelva a abrir el menú si no estaba activo
        if ((e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') && !autocompleteActive) {
            closeAutocomplete();
            return;
        }

        currentAutocompletePrefix = match[1];
        if (currentAutocompletePrefix === '//') currentAutocompletePrefix = '// ';
        
        currentAutocompleteMatches = autocompleteDictionary.filter(item => item.prefix.startsWith(currentAutocompletePrefix));
        
        if (currentAutocompleteMatches.length > 0) {
            autocompleteActive = true;
            autocompleteSelectedIndex = 0;
            renderAutocompleteList();
            
            const coords = getCaretCoordinates(markdownInput, cursor);
            autocompletePopup.style.left = Math.min(coords.left + 30, markdownInput.clientWidth - 260) + 'px';
            autocompletePopup.style.top = Math.min(coords.top + 30, markdownInput.clientHeight - 200) + 'px';
            autocompletePopup.classList.remove('hidden');
        } else {
            closeAutocomplete();
        }
    } else {
        closeAutocomplete();
    }
});

markdownInput.addEventListener('keydown', (e) => {
    if (autocompleteActive) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            autocompleteSelectedIndex = (autocompleteSelectedIndex + 1) % currentAutocompleteMatches.length;
            renderAutocompleteList();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            autocompleteSelectedIndex = (autocompleteSelectedIndex - 1 + currentAutocompleteMatches.length) % currentAutocompleteMatches.length;
            renderAutocompleteList();
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            insertAutocomplete(currentAutocompleteMatches[autocompleteSelectedIndex]);
        } else if (e.key === 'Escape') {
            closeAutocomplete();
        } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            closeAutocomplete();
        }
    }
    // Existing keydown logic handled previously
});

document.addEventListener('mousedown', (e) => {
    if (autocompleteActive && autocompletePopup && !autocompletePopup.contains(e.target)) {
        closeAutocomplete();
    }
    
    const sidebarLeft = document.getElementById('sidebar-left');
    const sidebarRight = document.getElementById('sidebar-right');
    
    if (sidebarLeftOpen && sidebarLeft && !sidebarLeft.contains(e.target) && !e.target.closest('[onclick*="toggleSidebar(\\\'left\\\')"]')) {
        closeSidebar('left');
    }
    if (sidebarRightOpen && sidebarRight && !sidebarRight.contains(e.target) && !e.target.closest('[onclick*="toggleSidebar(\\\'right\\\')"]')) {
        closeSidebar('right');
    }
});

// Auto-save on blur
markdownInput.addEventListener('blur', () => {
    saveCurrentNote();
});

// UI Buttons Logic
const btnRefresh = document.getElementById('btn-refresh');
btnRefresh.onclick = () => {
    location.reload();
};

if (btnNormalizeZcodex) {
    btnNormalizeZcodex.onclick = async () => {
        if (!activeNotePath) return;
        let content = markdownInput.value;
        
        // Expandir etiquetas inline a multilinea para indentación
        content = content.replace(/(?<!\S)(\.\.(?:p|c|b))[ \t]+([\s\S]*?)[ \t]+((?:p|c|b)\.\.)/g, '$1\n$2\n$3');
        content = content.replace(/(?<!\S)(\.\.(?:t1|t2|t3))[ \t]+(.+)/g, '$1\n$2');

        // Aplicar sangría
        let linesArray = content.split('\n');
        let outLines = [];
        let depth = 0;
        let inPrecode = false;
        let indentNext = false;

        for (let line of linesArray) {
            let t = line.trim();
            if (t.length === 0) {
                outLines.push('');
                continue;
            }

            let isClose = t.match(/^(p|c|b)\.\.$/);
            if (isClose) {
                if (t === 'c..') inPrecode = false;
                if (depth > 0) depth--;
                outLines.push(' '.repeat(depth * 4) + t);
                continue;
            }

            let requiredIndent = depth + (indentNext ? 1 : 0);
            indentNext = false;

            if (inPrecode) {
                const currentSpacesMatch = line.match(/^(\s*)/);
                const currentSpaces = currentSpacesMatch ? currentSpacesMatch[1].length : 0;
                if (currentSpaces < requiredIndent * 4) {
                    outLines.push(' '.repeat(requiredIndent * 4 - currentSpaces) + line);
                } else {
                    outLines.push(line);
                }
            } else {
                outLines.push(' '.repeat(requiredIndent * 4) + t);
            }

            let isOpen = t.match(/^\.\.(p|c|b)$/);
            if (isOpen) {
                if (t === '..c') inPrecode = true;
                depth++;
            } else if (t.match(/^\.\.(t1|t2|t3)$/)) {
                indentNext = true;
            }
        }
        content = outLines.join('\n');
        
        if (markdownInput.value !== content) {
            markdownInput.value = content;
            updatePreview();
            updateSyntaxHighlighting();
            await saveCurrentNote();
            showNotification("Zcodex Normalizado ✔️");
        } else {
            showNotification("La nota ya está normalizada.");
        }
    };
}

const btnCheckImages = document.getElementById('btn-check-images');
btnCheckImages.onclick = async () => {
    if (!activeNotePath) return;
    const content = markdownInput.value;
    const result = await window.api.cleanupImages(activeNotePath, content);
    if (result.count > 0) {
        if (result.deleted) {
            showNotification(`Se limpiaron ${result.count} imagen(es) huérfana(s) 🧹`);
        } else {
            showNotification("Operación cancelada");
        }
    } else {
        showNotification("No hay imágenes huérfanas ❤️");
    }
};

const btnTrashContainer = document.getElementById('btn-trash-container');
const deleteContainerModal = document.getElementById('delete-container-modal');
const deleteNotebookSelect = document.getElementById('delete-notebook-select');
const deleteCategorySelect = document.getElementById('delete-category-select');
const deleteContainerCancel = document.getElementById('delete-container-cancel');
const deleteContainerConfirm = document.getElementById('delete-container-confirm');

const tabDelNotebook = document.getElementById('tab-del-notebook');
const tabDelCategory = document.getElementById('tab-del-category');
const deleteCategoryWrapper = document.getElementById('delete-category-wrapper');
const deleteContainerDesc = document.getElementById('delete-container-desc');

let currentDeleteMode = 'notebook';

function updateDeleteTabs() {
    if (currentDeleteMode === 'notebook') {
        tabDelNotebook.className = 'flex-1 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 shadow rounded text-slate-800 dark:text-white transition';
        tabDelCategory.className = 'flex-1 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition rounded';
        deleteCategoryWrapper.classList.add('hidden');
        deleteContainerDesc.innerHTML = 'Selecciona el cuaderno que deseas eliminar permanentemente. <strong class="text-red-500">Esto borrará todas las notas dentro.</strong>';
    } else {
        tabDelCategory.className = 'flex-1 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 shadow rounded text-slate-800 dark:text-white transition';
        tabDelNotebook.className = 'flex-1 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition rounded';
        deleteCategoryWrapper.classList.remove('hidden');
        deleteContainerDesc.innerHTML = 'Selecciona el cuaderno y luego la categoría que deseas eliminar. <strong class="text-red-500">Esto borrará todas las notas dentro de ella.</strong>';
    }
}

tabDelNotebook.onclick = () => {
    currentDeleteMode = 'notebook';
    updateDeleteTabs();
};

tabDelCategory.onclick = () => {
    currentDeleteMode = 'category';
    updateDeleteTabs();
};

btnTrashContainer.onclick = () => {
    currentDeleteMode = 'notebook';
    updateDeleteTabs();
    
    deleteNotebookSelect.innerHTML = '<option value="">Selecciona un cuaderno</option>';
    const notebooks = [...new Set(currentTree.map(n => n.notebook || n.name))].filter(Boolean);
    notebooks.forEach(nb => {
        deleteNotebookSelect.innerHTML += `<option value="${nb}">${nb}</option>`;
    });
    deleteCategorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    deleteCategorySelect.disabled = true;
    deleteContainerModal.classList.remove('hidden');
};

deleteNotebookSelect.onchange = () => {
    const nb = deleteNotebookSelect.value;
    deleteCategorySelect.innerHTML = '<option value="">Selecciona una categoría</option>';
    if (nb) {
        const nbNode = currentTree.find(n => (n.notebook === nb || n.name === nb));
        if (nbNode && nbNode.children) {
            const categories = nbNode.children.filter(c => c.type === 'category').map(c => c.name);
            categories.forEach(cat => {
                deleteCategorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
            deleteCategorySelect.disabled = categories.length === 0;
        } else {
            deleteCategorySelect.disabled = true;
        }
    } else {
        deleteCategorySelect.disabled = true;
    }
};

deleteContainerCancel.onclick = () => {
    deleteContainerModal.classList.add('hidden');
};

deleteContainerModal.onclick = (e) => {
    if(e.target === deleteContainerModal) deleteContainerModal.classList.add('hidden');
};

deleteContainerConfirm.onclick = async () => {
    const nb = deleteNotebookSelect.value;
    const cat = deleteCategorySelect.value;
    
    if (currentDeleteMode === 'notebook' && !nb) {
        showNotification("Selecciona un cuaderno primero");
        return;
    }
    
    if (currentDeleteMode === 'category' && (!nb || !cat)) {
        showNotification("Selecciona un cuaderno y una categoría");
        return;
    }
    
    const config = await window.api.getConfig();
    let targetPath = config.dataDir + '\\\\' + nb;
    if (currentDeleteMode === 'category') {
        targetPath += '\\\\' + cat;
    }
    
    const success = await window.api.deleteNode(targetPath);
    if (success) {
        showNotification("Estructura eliminada con éxito");
        deleteContainerModal.classList.add('hidden');
        
        if (activeNotePath && activeNotePath.startsWith(targetPath)) {
            activeNotePath = null;
            emptyState.classList.remove('hidden');
            noteActions.classList.add('hidden');
            editorContainer.classList.add('hidden');
            previewContainer.classList.add('hidden');
            noteTitleEl.textContent = 'Selecciona una nota';
        }
        
        await loadTree();
    } else {
        showNotification("Error al eliminar la estructura");
    }
};

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            window.toggleSidebar('left');
        } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            window.toggleSidebar('right');
        } else if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            if (activeNotePath) {
                if (isEditMode) {
                    showReadMode();
                } else {
                    showEditMode();
                }
            }
        }
    }
});

// Start
initTheme();
loadTree();

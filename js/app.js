import * as store from './store.js';
import { buildDoc } from './preview.js';
import { initChat } from './chat.js';

const $ = s => document.querySelector(s);
const db = store.init();
let editor, models = {}, activeFile = 'index.html', timer;

const proj = () => db.projects[db.current];
const langFor = n => ({ html: 'html', css: 'css', js: 'javascript', json: 'json', md: 'markdown' }[n.split('.').pop()] || 'plaintext');

function renderProjects() {
  const sel = $('#projectSelect');
  sel.innerHTML = Object.values(db.projects).sort((a, b) => b.updated - a.updated)
    .map(p => `<option value="${p.id}" ${p.id === db.current ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}
function renderFiles() {
  const names = Object.keys(proj().files);
  $('#fileList').innerHTML = names.map(n =>
    `<li data-n="${esc(n)}" class="${n === activeFile ? 'on' : ''}"><span>${esc(n)}</span><span class="x" data-del="${esc(n)}" title="Delete">x</span></li>`).join('');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function currentFiles() {
  const out = {};
  for (const [n, m] of Object.entries(models)) out[n] = m.getValue();
  return out;
}
function refresh() {
  $('#frame').srcdoc = buildDoc(currentFiles());
  $('#status').textContent = 'Saved ' + new Date().toLocaleTimeString();
}
function onEdit() {
  $('#status').textContent = 'Editing...';
  clearTimeout(timer);
  timer = setTimeout(() => { store.saveFiles(db, db.current, currentFiles()); refresh(); }, 350);
}

function loadProject() {
  Object.values(models).forEach(m => m.dispose());
  models = {};
  for (const [n, c] of Object.entries(proj().files)) {
    models[n] = monaco.editor.createModel(c, langFor(n));
    models[n].onDidChangeContent(onEdit);
  }
  if (!models[activeFile]) activeFile = Object.keys(models)[0];
  editor.setModel(models[activeFile]);
  renderProjects(); renderFiles(); refresh();
}

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' } });
require(['vs/editor/editor.main'], () => {
  editor = monaco.editor.create($('#editor'), { theme: 'vs-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 13, tabSize: 2, wordWrap: 'on' });
  loadProject();
});

$('#fileList').addEventListener('click', e => {
  const del = e.target.dataset.del;
  if (del) {
    if (Object.keys(models).length < 2 || !confirm(`Delete ${del}?`)) return;
    models[del].dispose(); delete models[del];
    if (activeFile === del) activeFile = Object.keys(models)[0];
    editor.setModel(models[activeFile]); store.saveFiles(db, db.current, currentFiles());
    renderFiles(); refresh(); return;
  }
  const li = e.target.closest('li'); if (!li) return;
  activeFile = li.dataset.n; editor.setModel(models[activeFile]); renderFiles();
});
$('#addFile').onclick = () => {
  const n = (prompt('File name (for example about.html or app.js)') || '').trim();
  if (!n || models[n]) return;
  models[n] = monaco.editor.createModel('', langFor(n)); models[n].onDidChangeContent(onEdit);
  activeFile = n; editor.setModel(models[n]); store.saveFiles(db, db.current, currentFiles()); renderFiles();
};
$('#projectSelect').onchange = e => { store.setCurrent(db, e.target.value); activeFile = 'index.html'; loadProject(); };
$('#newProject').onclick = () => {
  const n = (prompt('Project name') || '').trim(); if (!n) return;
  store.createProject(db, n); activeFile = 'index.html'; loadProject();
};
$('#renameProject').onclick = () => {
  const n = (prompt('New name', proj().name) || '').trim(); if (!n) return;
  store.renameProject(db, db.current, n); renderProjects();
};
$('#reload').onclick = refresh;
document.querySelectorAll('.devices button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.devices button').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('#frame').style.width = b.dataset.w;
});
$('#saveVersion').onclick = () => {
  const label = prompt('Label for this version', 'Checkpoint'); if (label === null) return;
  store.saveFiles(db, db.current, currentFiles()); store.snapshot(db, db.current, label || 'Checkpoint');
  $('#status').textContent = 'Version saved';
};
$('#versionsBtn').onclick = () => {
  const list = proj().versions;
  $('#versionList').innerHTML = list.length ? list.map(v =>
    `<li><span>${esc(v.label)}<br><small>${new Date(v.at).toLocaleString()}</small></span><button data-v="${v.id}">Restore</button></li>`).join('') : '<li>No versions yet.</li>';
  $('#versions').showModal();
};
$('#versionList').addEventListener('click', e => {
  const id = e.target.dataset.v; if (!id) return;
  const v = proj().versions.find(x => x.id === id);
  store.snapshot(db, db.current, 'Before restore');
  store.saveFiles(db, db.current, { ...v.files });
  $('#versions').close(); loadProject();
});

// CRM hook: ?lead=<id>&name=<business> opens a fresh project for that lead.
const q = new URLSearchParams(location.search);
if (q.get('lead')) {
  const existing = Object.values(db.projects).find(p => p.meta && p.meta.lead === q.get('lead'));
  if (existing) store.setCurrent(db, existing.id);
  else store.createProject(db, q.get('name') || 'Lead concept', { lead: q.get('lead') });
  history.replaceState({}, '', location.pathname);
}

initChat({
  getFiles: currentFiles,
  beforeApply: () => { store.saveFiles(db, db.current, currentFiles()); store.snapshot(db, db.current, 'Before AI edit'); },
  applyFiles: files => {
    for (const [n, c] of Object.entries(files)) {
      if (models[n]) models[n].setValue(c);
      else { models[n] = monaco.editor.createModel(c, langFor(n)); models[n].onDidChangeContent(onEdit); }
    }
    store.saveFiles(db, db.current, currentFiles()); renderFiles(); refresh();
  }
});

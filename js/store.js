// Project storage. localStorage for now; swap these functions for Supabase later.
const KEY = 'towpath-studio:v1';

const STARTER = {
  'index.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>New site</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header><h1>Your business name</h1><p>One clear line about what you do.</p><a class="btn" href="#contact">Get a quote</a></header>
<script src="script.js"></script>
</body>
</html>`,
  'styles.css': `body{margin:0;font-family:system-ui,sans-serif;color:#1b2430}
header{padding:96px 24px;text-align:center;background:#f6f1e6}
h1{font-size:44px;margin:0 0 12px}
.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#1b2a4a;color:#fff;border-radius:8px;text-decoration:none}`,
  'script.js': `console.log('Towpath Studio preview running');`
};

const uid = () => Math.random().toString(36).slice(2, 10);

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.projects) return d; } catch (e) {}
  return null;
}
function persist(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Could not save', e); }
}

export function init() {
  let db = load();
  if (!db) {
    const p = newProjectObj('Untitled project');
    db = { current: p.id, projects: { [p.id]: p } };
    persist(db);
  }
  return db;
}
function newProjectObj(name, meta = {}) {
  return { id: uid(), name, files: { ...STARTER }, versions: [], meta, updated: Date.now() };
}
export function createProject(db, name, meta) {
  const p = newProjectObj(name, meta);
  db.projects[p.id] = p; db.current = p.id; persist(db); return p;
}
export function saveFiles(db, id, files) {
  const p = db.projects[id]; p.files = files; p.updated = Date.now(); persist(db);
}
export function renameProject(db, id, name) { db.projects[id].name = name; persist(db); }
export function setCurrent(db, id) { db.current = id; persist(db); }
export function snapshot(db, id, label) {
  const p = db.projects[id];
  p.versions.unshift({ id: uid(), label, at: Date.now(), files: { ...p.files } });
  p.versions = p.versions.slice(0, 50); persist(db);
}

// Chat panel: sends the prompt plus current files to /api/chat, streams the reply,
// and applies any ```file:name blocks back into the project.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const PASS_KEY = 'towpath-studio:pass', ENGINE_KEY = 'towpath-studio:engine';
let history = [], busy = false;

export function initChat({ getFiles, applyFiles, beforeApply }) {
  const log = $('#chatLog'), input = $('#chatInput');

  function add(role, text) {
    const d = document.createElement('div');
    d.className = 'msg ' + role; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function passphrase(reset) {
    let p = null;
    try { p = reset ? null : localStorage.getItem(PASS_KEY); } catch (e) {}
    if (!p) { p = prompt('Studio passphrase (set as STUDIO_PASSPHRASE on the server)') || ''; try { localStorage.setItem(PASS_KEY, p); } catch (e) {} }
    return p;
  }
  function filesBlock(files) {
    return Object.entries(files).map(([n, c]) => '```file:' + n + '\n' + c + '\n```').join('\n\n');
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; input.value = ''; $('#chatSend').disabled = true;
    add('user', text);
    const out = add('bot', 'Thinking...');
    const prompt_ = text + '\n\nCURRENT PROJECT FILES:\n' + filesBlock(getFiles());
    const msgs = [...history.slice(-6), { role: 'user', content: prompt_ }];
    let full = '';
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-studio-key': passphrase() }, body: JSON.stringify({ messages: msgs, engine: $('#engine').value }) });
      if (res.status === 401) { passphrase(true); throw new Error('Wrong passphrase. Try again.'); }
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const l of lines) {
          if (!l.startsWith('data:')) continue;
          const data = l.slice(5).trim(); if (data === '[DONE]') continue;
          try { const delta = JSON.parse(data).choices[0].delta.content; if (delta) { full += delta; out.textContent = summarize(full); log.scrollTop = log.scrollHeight; } } catch (e) {}
        }
      }
      const files = parse(full);
      const names = Object.keys(files);
      if (names.length) { beforeApply(); applyFiles(files); }
      out.textContent = summarize(full) + (names.length ? '\n\nApplied: ' + names.join(', ') + '. Undo from History (Before AI edit).' : '');
      history.push({ role: 'user', content: text }, { role: 'assistant', content: summarize(full) });
    } catch (e) {
      out.textContent = 'Error: ' + e.message; out.classList.add('err');
    }
    busy = false; $('#chatSend').disabled = false; input.focus();
  }

  // Show only the prose in the chat; hide the file contents (they go to the editor).
  function summarize(t) { return t.replace(/```file:[^\n]*\n[\s\S]*?(```|$)/g, '[file]').replace(/(\[file\]\s*)+/g, '[writing files...]\n').trim(); }
  function parse(t) {
    const out = {}; const re = /```file:([^\n]+)\n([\s\S]*?)\n```/g; let m;
    while ((m = re.exec(t))) out[m[1].trim()] = m[2];
    return out;
  }

  try { const e = localStorage.getItem(ENGINE_KEY); if (e) $('#engine').value = e; } catch (x) {}
  $('#engine').onchange = e => { try { localStorage.setItem(ENGINE_KEY, e.target.value); } catch (x) {} };
  $('#chatSend').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); });
  $('#chatClear').onclick = () => { history = []; log.innerHTML = ''; };
}

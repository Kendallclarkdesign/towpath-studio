// Builds one self-contained HTML document from the project files for the sandboxed iframe.
export function buildDoc(files) {
  let html = files['index.html'] || '<p>Add an index.html file.</p>';
  html = html.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (tag, href) =>
    files[href] != null && /rel=["']stylesheet["']/i.test(tag) ? `<style>${files[href]}</style>` : tag);
  html = html.replace(/<script([^>]*)\ssrc=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, a, src, b) =>
    files[src] != null ? `<script${a}${b}>${files[src].replace(/<\/script/gi, '<\\/script')}</script>` : tag);
  return html;
}

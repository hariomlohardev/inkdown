import os, json, urllib.request

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app')
VENDOR = os.path.join(APP, 'vendor')
os.makedirs(os.path.join(VENDOR, 'fonts'), exist_ok=True)

LIBS = {
    'marked.min.js':       'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    'purify.min.js':       'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js',
    'highlight.min.js':    'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.9.0/highlight.min.js',
    'katex.min.js':        'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    'katex.min.css':       'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
    'auto-render.min.js':  'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js',
    'mermaid.min.js':      'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
    'html2canvas.min.js':  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'jszip.min.js':        'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
}

def download(url, dest):
    print('  →', os.path.basename(dest))
    urllib.request.urlretrieve(url, dest)

print('Downloading libraries…')
for name, url in LIBS.items():
    download(url, os.path.join(VENDOR, name))

print('Downloading KaTeX fonts…')
try:
    with urllib.request.urlopen('https://data.jsdelivr.com/v1/package/npm/katex@0.16.11/flat') as r:
        files = json.load(r)['files']
    for f in files:
        n = f['name']
        if n.startswith('/dist/fonts/') and n.endswith(('.woff2', '.woff')):
            download('https://cdn.jsdelivr.net/npm/katex@0.16.11' + n,
                     os.path.join(VENDOR, 'fonts', os.path.basename(n)))
except Exception as e:
    print('  KaTeX fonts skipped:', e)

print('\nDone. Vendor files are in app/vendor/')
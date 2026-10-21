#!/usr/bin/env python3
"""
Build ONE self-contained file (works offline by double-click, and can make PDFs and share pages
from anywhere) out of index.html + css/ + js/ + lib/.

    python3 build.py                        ->  Mathematics-Lecture-Studio.html
    python3 build.py my-copy.html           ->  my-copy.html

Needs only Python 3 (no packages). Run it in the same folder as index.html.
"""
import re, os, sys, json

root = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
out = sys.argv[1] if len(sys.argv) > 1 else 'Mathematics-Lecture-Studio.html'

html = rd('index.html')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>' + rd(m.group(1)) + '</style>', html)
katex = re.search(r'<script src="(lib/katex[^"]+)"></script>', html).group(1)
js_files = re.findall(r'<script src="(js/[^"]+)"></script>', html)
html = re.sub(r'<script src="[^"]+"></script>\n?', '', html)

libs = ''
for tid, f in (('lib-pdfjs', 'lib/pdfjs.src.js'), ('lib-pdfworker', 'lib/pdfjs-worker.src.js')):
    t = rd(f)
    src = json.loads(t[t.index('=') + 1:].rstrip().rstrip(';'))
    libs += '<script type="text/plain" id="%s">%s</script>\n' % (tid, src)
libs += '<script type="text/plain" id="lib-pdflib">%s</script>\n' % rd('lib/pdf-lib.min.js')

app = "(()=>{\n'use strict';\n" + '\n'.join(rd(f) for f in js_files) + '\n})();'
body = '<script>' + rd(katex) + '</script>\n' + libs + '<script>\n' + app + '\n</script>\n</body>'
html = html.replace('</body>', body)
open(os.path.join(root, out), 'w', encoding='utf-8').write(html)
print('Built', out, round(len(html) / 1024), 'KB from', len(js_files), 'script files')

/**
 * SmartBus Local Live Server with Automatic Live Reload
 * Zero dependencies - powered by Node.js built-in modules
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5501;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

// Connected SSE clients for live reload
const sseClients = new Set();

// Debounced file change notifier
let debounceTimer = null;
function notifyClients() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log('[Live Server] 🔄 Changes detected, triggering browser reload...');
    for (const res of sseClients) {
      try {
        res.write('data: reload\n\n');
      } catch (err) {
        sseClients.delete(res);
      }
    }
  }, 100);
}

// Watch directory for changes (.html, .css, .js, .json)
try {
  fs.watch(ROOT_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // Ignore git, vscode, scratch, and system directories
    if (filename.includes('.git') || filename.includes('.vscode') || filename.includes('node_modules')) {
      return;
    }
    const ext = path.extname(filename).toLowerCase();
    if (['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg'].includes(ext)) {
      notifyClients();
    }
  });
  console.log('[Live Server] 👁️  File watcher active for live reload');
} catch (err) {
  console.warn('[Live Server] Recursive watch not available, fallback watcher active:', err.message);
}

// Client-side live reload script injected into HTML files
const LIVE_RELOAD_SCRIPT = `
<!-- SmartBus Live Reload -->
<script>
(function() {
  if (typeof window === 'undefined') return;
  var es = new EventSource('/__live_reload__');
  es.onmessage = function(e) {
    if (e.data === 'reload') {
      console.log('[Live Server] Reloading page...');
      window.location.reload();
    }
  };
  es.onerror = function() {
    es.close();
    setTimeout(function() {
      new EventSource('/__live_reload__');
    }, 2000);
  };
})();
</script>
`;

const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];

  // SSE endpoint for live reload
  if (reqUrl === '/__live_reload__') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Resolve file path
  let relativePath = decodeURIComponent(reqUrl);
  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, relativePath));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h2>404 Not Found</h2><p>Cannot find ${relativePath}</p><p><a href="/">Go to Passenger App</a> | <a href="/admin.html">Go to Admin Portal</a></p>`);
      return;
    }

    let filePathToServe = safePath;
    if (stats.isDirectory()) {
      filePathToServe = path.join(safePath, 'index.html');
    }

    const ext = path.extname(filePathToServe).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Serve HTML with injected live reload script
    if (ext === '.html') {
      fs.readFile(filePathToServe, 'utf8', (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
          return;
        }

        let injectedContent = content;
        if (content.includes('</body>')) {
          injectedContent = content.replace('</body>', `${LIVE_RELOAD_SCRIPT}\n</body>`);
        } else {
          injectedContent = content + LIVE_RELOAD_SCRIPT;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(injectedContent);
      });
      return;
    }

    // Serve other static assets
    fs.readFile(filePathToServe, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log('  🚀 SmartBus Live Server is Running!');
  console.log('  --------------------------------------------------');
  console.log(`  🌐 Passenger App:   http://localhost:${PORT}/`);
  console.log(`  🛠️  Admin Portal:    http://localhost:${PORT}/admin.html`);
  console.log('  ⚡ Live Reload:     Active (auto-refreshes on file save)');
  console.log('======================================================\n');
});


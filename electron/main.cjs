const { app, BrowserWindow, Menu, shell, session } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

const DIST_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'dist')
  : path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let staticServer = null;
let mainWindow = null;

function resolveDistDir() {
  const unpackedDist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(path.join(unpackedDist, 'index.html'))) {
    return unpackedDist;
  }
  return DIST_DIR;
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const distRoot = resolveDistDir();
    const indexHtmlPath = path.join(distRoot, 'index.html');

    const server = http.createServer((req, res) => {
      const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
      const candidate = path.resolve(distRoot, safeRel);
      const inDist = candidate === distRoot || candidate.startsWith(distRoot + path.sep);

      let targetFile = indexHtmlPath;
      if (inDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        targetFile = candidate;
      }

      if (!fs.existsSync(targetFile)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Missing dist/index.html. Run "npm run build" first.');
        return;
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileSize = fs.statSync(targetFile).size;
      const rangeHeader = req.headers.range;

      if (rangeHeader && /^bytes=\d*-\d*$/i.test(rangeHeader)) {
        const [startStr, endStr] = rangeHeader.replace(/^bytes=/i, '').split('-');
        let start = startStr ? parseInt(startStr, 10) : 0;
        let end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        if (!startStr && endStr) {
          const suffixLen = parseInt(endStr, 10);
          start = Math.max(0, fileSize - suffixLen);
          end = fileSize - 1;
        }
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
          res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
          res.end();
          return;
        }
        end = Math.min(end, fileSize - 1);
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
        });
        fs.createReadStream(targetFile, { start, end }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(targetFile).pipe(res);
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind local static server'));
        return;
      }
      staticServer = server;
      resolve(addr.port);
    });
  });
}

function createWindow(port) {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0B1320',
    title: 'Борбарисово 001 — Зимний замес',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:')) {
      return { action: 'allow' };
    }
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && mainWindow) {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const singleLock = app.requestSingleInstanceLock();
if (!singleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      if (permission === 'pointerLock' || permission === 'fullscreen') {
        callback(true);
        return;
      }
      callback(false);
    });

    const port = await startStaticServer();
    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

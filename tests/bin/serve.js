import { createServer } from 'http';
import { parse, fileURLToPath } from 'url';
import { stat, readFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { lookup } from 'mime-types';

import { setupWSBackendConnections } from '../lib/websocket_backend.js';
import { setupWSTunnel } from '../lib/websocket_tunnel.js';
import { LocalBackend } from '../../src/index.node.js';

const baseDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

const backends = new Map();

function getBackend(name) {
  if (backends.has(name)) return backends.get(name);

  let backend;

  if (name.startsWith('local_')) {
    backend = new LocalBackend({ name });
  }

  if (!backend) throw new Error('Unsupported backend: ' + name);

  backends.set(name, backend);

  return backend;
}

const server = createServer(async (req, res) => {
  let path = parse(req.url).pathname;

  if (path === '') {
    path = '/';
  }

  if (path.endsWith('/')) {
    path += 'index.html';
  }

  const headers = {
    'Cache-Control': 'no-store',
  };

  const respond = (data, code, headers) => {
    if (!code) code = 200;
    res.writeHead(code, headers);
    res.end(data);
  };

  const txt = (data, code) => {
    if (!code) code = 200;
    respond(
      data,
      code,
      Object.assign(headers, { 'Content-Type': 'text/plain' })
    );
  };

  switch (path) {
    case '/_api/has_backends':
      return txt('ok');
  }

  const fname = join(baseDir, path);

  if (!fname.startsWith(baseDir)) {
    return txt('', 404);
  }

  try {
    const data = await readFile(fname, { encoding: 'utf-8' });
    return respond(
      data,
      200,
      Object.assign(headers, { 'Content-Type': lookup(extname(fname)) })
    );
  } catch (err) {}

  try {
    const stats = await stat(fname);

    if (stats.isDirectory()) {
      return respond('', 302, Object.assign(headers, { Location: path + '/' }));
    }
  } catch (err) {}

  return respond('', 404);
});

setupWSBackendConnections(server, '_ws', getBackend);
setupWSTunnel(server, '/_control/aes70', { host: 'localhost', port: 3000 });
setupWSTunnel(server, '/_control/emberplus', { host: '192.168.178.153', port: 9000 });

server.listen(8000);

console.log('Go to the testsuite at http://localhost:3000/tests/htdocs/');

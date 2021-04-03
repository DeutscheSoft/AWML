import { createServer } from 'http';
import { parse, fileURLToPath } from 'url';
import { stat, readFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { lookup } from 'mime-types';

import { setupWSBackendConnections } from '../lib/websocket_backend.js';
import { setupWSTunnel } from '../lib/websocket_tunnel.js';
import { closeUnhandledWebSockets } from '../lib/handle_websocket.js';
import { LocalBackend } from '../../src/index.node.js';

const baseDir = join(dirname(fileURLToPath(import.meta.url)), '../..');

const backends = new Map();

function help() {
  console.log(
    `node bin/serve.js [options]
  Options:
    --aes70 <IP>:<PORT>
      Optional destination of an AES70 test device.
    --emberplus <IP>:<PORT>
      Optional destination of an Ember+ test device.
`
  );
}

function parseDestination(str) {
  const tmp = str.split(':');

  if (tmp.length !== 2) throw new Error('Malformed destination string.');

  const host = tmp[0];
  const port = parseInt(tmp[1]);

  if (!(port > 0 && port < 0xffff))
    throw new Error('Malformed port in destination string: ' + str);

  return {
    host,
    port,
  };
}

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

{
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--aes70') {
      setupWSTunnel(server, '/_control/aes70', parseDestination(argv[++i]));
    } else if (arg === '--emberplus') {
      setupWSTunnel(server, '/_control/emberplus', parseDestination(argv[++i]));
    } else if (arg === '--help' || arg === '-h') {
      help();
      process.exit(0);
    } else {
      console.log('Unknown argument: %o', arg);
      help();
      process.exit(1);
    }
  }
}

server.on('upgrade', closeUnhandledWebSockets);

server.listen(8000);

console.log('Go to the testsuite at http://localhost:8000/tests/htdocs/');

const { createServer } = require('http');
const next = require('next');

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOSTNAME || '0.0.0.0';
const dev = false;

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

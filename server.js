const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, data) => {
    if (err) {
      res.writeHead(500, {'Content-Type':'text/plain'});
      return res.end('Server error');
    }
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Maintenance page running at http://localhost:${PORT}`);
});

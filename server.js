import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8000;
const API_BASE_URL = process.env.VITE_BACKEND;
const FRONTEND_URL = process.env.VITE_FRONTEND;

const PUBLIC_DIR = path.join(__dirname, 'public');

function getContentType(filePath) {
    const extname = path.extname(filePath);
    switch (extname) {
        case '.html': return 'text/html';
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        default: return 'application/octet-stream';
    }
}

async function serveStaticFile(res, filePath, status = 200) {
    try {
        const fullPath = path.join(PUBLIC_DIR, filePath);
        const data = await readFile(fullPath);
        res.writeHead(status, { 'Content-Type': getContentType(fullPath) });
        res.end(data);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
}

const requestListener = async (req, res) => {
    const parsedUrl = new URL(req.url, FRONTEND_URL);
    const pathname = parsedUrl.pathname;

    if (req.method === 'GET') {
        if (pathname === '/' || pathname === '/store') {
            return res.writeHead(302, { 'Location': '/store.html' }).end();
        }

        if (pathname === '/search') {
            const word = parsedUrl.searchParams.get('word');
            
            if (!word) {
                return res.writeHead(302, { 'Location': '/search.html' }).end();
            }

            const targetUrl = `${API_BASE_URL}/api/definitions/?word=${encodeURIComponent(word)}`;

            try {
                const proxyResponse = await fetch(targetUrl, { method: 'GET' });
                const data = await proxyResponse.json();

                res.writeHead(proxyResponse.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(data));

            } catch (error) {
                console.error(`[Proxy Error] Failed to connect to external API ${API_BASE_URL} for search:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: false,
                    message: `Server Error: Could not connect to the external API server on ${API_BASE_URL}.`
                }));
            }
        }

        return serveStaticFile(res, pathname === '/' ? 'index.html' : pathname.substring(1));
    }

    if (req.method === 'POST') {
        if (pathname === '/store') {
            const targetUrl = `${API_BASE_URL}/api/definitions/`;
            
            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }

            try {
                const proxyResponse = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });

                const data = await proxyResponse.json();

                res.writeHead(proxyResponse.status, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(data));

            } catch (error) {
                console.error(`[Proxy Error] Failed to connect to external API ${API_BASE_URL} for store:`, error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: false,
                    message: `Server Error: Could not connect to the external API server on ${API_BASE_URL}.`
                }));
            }
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
};

const server = http.createServer(requestListener);

server.listen(PORT, () => {
    console.log(`Front-End Proxy Server (Vanilla Node) running on ${FRONTEND_URL}`);
    console.log(`Access store page: ${FRONTEND_URL}/store.html`);
    console.log(`Access search page: ${FRONTEND_URL}/search.html`);
});

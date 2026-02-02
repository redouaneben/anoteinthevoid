import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// CORS: allow cross-origin requests (GET, POST, OPTIONS). All responses include these headers.
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Message actuel (en mémoire)
let currentMessage = "Someone was here before you.";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function serveFile(res, filePath, corsHeaders) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "text/plain";
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain", ...corsHeaders });
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType, ...corsHeaders });
      res.end(content, "utf-8");
    }
  });
}

function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  const method = req.method || "GET";

  // OPTIONS (preflight): respond immediately with CORS so browser allows actual request
  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // GET /message
  if (url === "/message" && method === "GET") {
    const body = currentMessage || "Someone was here before you.";
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
    });
    res.end(body, "utf-8");
    return;
  }

  // POST /message
  if (url === "/message" && method === "POST") {
    readBody(req)
      .then((raw) => {
        const text = (raw || "").trim();
        if (text.length > 240) {
          res.writeHead(400, {
            "Content-Type": "text/plain; charset=utf-8",
            ...CORS_HEADERS,
          });
          res.end("Message too long (max 240 characters).", "utf-8");
          return;
        }
        currentMessage = text || currentMessage;
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          ...CORS_HEADERS,
        });
        res.end(currentMessage, "utf-8");
      })
      .catch(() => {
        res.writeHead(500, { "Content-Type": "text/plain", ...CORS_HEADERS });
        res.end("Server error.");
      });
    return;
  }

  // GET / → page principale
  if (url === "/" && method === "GET") {
    serveFile(res, path.join(__dirname, "index.html"), CORS_HEADERS);
    return;
  }

  // Fichiers statiques
  if (method === "GET" && !url.includes("..")) {
    const rel = url.slice(1) || "index.html";
    const filePath = path.resolve(__dirname, rel);
    const root = path.resolve(__dirname);
    if (filePath === root || filePath.startsWith(root + path.sep)) {
      serveFile(res, filePath, CORS_HEADERS);
      return;
    }
  }

  // 404 with CORS so frontend can see the response
  res.writeHead(404, { "Content-Type": "text/plain", ...CORS_HEADERS });
  res.end("404 Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

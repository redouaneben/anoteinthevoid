import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let currentMessage = "Someone was here before you.";

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "text/plain";
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain", ...CORS_HEADERS });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType, ...CORS_HEADERS });
    res.end(content, "utf-8");
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

  try {
    // OPTIONS (préflight CORS)
    if (method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // GET /message
    if (url === "/message" && method === "GET") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
      res.end(currentMessage, "utf-8");
      return;
    }

    // POST /message
    if (url === "/message" && method === "POST") {
      readBody(req)
        .then((raw) => {
          const text = (raw || "").trim();
          if (text.length > 240) {
            res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
            res.end("Message too long (max 240 characters).", "utf-8");
            return;
          }
          currentMessage = text || currentMessage;
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
          res.end(currentMessage, "utf-8");
        })
        .catch((err) => {
          console.error("POST /message error:", err);
          res.writeHead(500, { "Content-Type": "text/plain", ...CORS_HEADERS });
          res.end("Server error.");
        });
      return;
    }

    // GET /
    if (url === "/" && method === "GET") {
      serveFile(res, path.join(__dirname, "index.html"));
      return;
    }

    // Fichiers statiques
    if (method === "GET" && !url.includes("..")) {
      const rel = url.slice(1) || "index.html";
      const filePath = path.resolve(__dirname, rel);
      const root = path.resolve(__dirname);
      if (filePath === root || filePath.startsWith(root + path.sep)) {
        serveFile(res, filePath);
        return;
      }
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain", ...CORS_HEADERS });
    res.end("404 Not Found");
  } catch (err) {
    console.error("Unexpected server error:", err);
    res.writeHead(500, { "Content-Type": "text/plain", ...CORS_HEADERS });
    res.end("Server error.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

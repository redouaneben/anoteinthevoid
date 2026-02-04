import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Railway injecte PORT automatiquement
const PORT = process.env.PORT || 3000;

// Utilisation des logs standards (capturés par Railway)
function agentLog(hypothesisId, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${hypothesisId}] ${message}:`, JSON.stringify(data));
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400", // Cache les requêtes OPTIONS pour 24h
};

let currentMessage = "Someone was here before you.";

function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  const method = req.method || "GET";

  // Preflight CORS
  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    // GET /message
    if (url === "/message" && method === "GET") {
      agentLog("H3", "GET /message");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
      res.end(currentMessage);
      return;
    }

    // POST /message
    if (url === "/message" && method === "POST") {
      try {
        const raw = await readBody(req);
        const text = (raw || "").trim();

        if (text.length > 240) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
          res.end("Too long.");
          return;
        }

        if (text) currentMessage = text;
        
        agentLog("H2", "POST success", { length: text.length });
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
        res.end(currentMessage);
      } catch (err) {
        agentLog("H2", "POST error", { error: err.message });
        res.writeHead(413, { "Content-Type": "text/plain", ...CORS_HEADERS });
        res.end("Error processing message.");
      }
      return;
    }

    // Fallback 404 pour les autres routes
    res.writeHead(404, { "Content-Type": "text/plain", ...CORS_HEADERS });
    res.end("Not Found");

  } catch (err) {
    agentLog("H4", "Critical Error", { error: err.message });
    if (!res.writableEnded) {
      res.writeHead(500, { "Content-Type": "text/plain", ...CORS_HEADERS });
      res.end("Internal Server Error");
    }
  }
});

// Écoute sur 0.0.0.0 est impératif pour Railway/Docker
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server launched on port ${PORT}`);
});

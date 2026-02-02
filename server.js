import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// Message actuel (en mémoire pour cette base)
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
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url?.split("?")[0] ?? "/";

  // GET / → page principale
  if (url === "/" && req.method === "GET") {
    serveFile(res, path.join(__dirname, "index.html"));
    return;
  }

  // CORS: allow frontend from any origin when deployed separately
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // GET /message → message actuel (texte brut), défaut si vide
  if (url === "/message" && req.method === "GET") {
    const body = currentMessage || "Someone was here before you.";
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders });
    res.end(body, "utf-8");
    return;
  }

  // POST /message → nouveau message (max 240 caractères), stocké pour le prochain visiteur
  if (url === "/message" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const text = (body || "").trim();
      if (text.length > 240) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders });
        res.end("Message too long (max 240 characters).", "utf-8");
        return;
      }
      currentMessage = text || currentMessage;
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders });
      res.end(currentMessage, "utf-8");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain", ...corsHeaders });
      res.end("Server error.");
    }
    return;
  }

  // Fichiers statiques (CSS, JS, context.html, etc.)
  if (req.method === "GET" && !url.includes("..")) {
    const rel = url === "/" ? "index.html" : url.slice(1);
    const filePath = path.resolve(__dirname, rel);
    const root = path.resolve(__dirname);
    const allowed = filePath === root || filePath.startsWith(root + path.sep);
    if (allowed) {
      serveFile(res, filePath);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

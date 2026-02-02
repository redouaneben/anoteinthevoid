import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

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

  // GET /message → message actuel (texte brut)
  if (url === "/message" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(currentMessage, "utf-8");
    return;
  }

  // POST /message → nouveau message (max 240 caractères)
  if (url === "/message" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const text = (body || "").trim();
      if (text.length > 240) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Message trop long (max 240 caractères).", "utf-8");
        return;
      }
      currentMessage = text || currentMessage; /* stocké pour la prochaine personne */
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(currentMessage, "utf-8");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Erreur serveur.");
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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

import http from "http";
import Redis from "ioredis"; // Nouvelle bibliothèque pour la mémoire
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Connexion à Redis (Railway remplit REDIS_URL tout seul)
const redis = new Redis(process.env.REDIS_URL);

// Utilisation des logs standards
function agentLog(hypothesisId, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${hypothesisId}] ${message}:`, JSON.stringify(data));
}

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Variable temporaire (sera mise à jour par Redis juste après)
let currentMessage = "Someone was here before you.";

// CHARGEMENT INITIAL : On récupère le dernier message enregistré dans Redis
async function loadMessage() {
  try {
    const savedMessage = await redis.get("void_note");
    if (savedMessage) {
      currentMessage = savedMessage;
      console.log("Message récupéré depuis Redis :", currentMessage);
    }
  } catch (err) {
    console.error("Erreur lecture Redis :", err);
  }
}
loadMessage();

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

        if (text) {
          currentMessage = text;
          // SAUVEGARDE DANS REDIS : pour ne pas perdre le message au redémarrage
          await redis.set("void_note", text);
        }
        
        agentLog("H2", "POST success (Saved to Redis)", { length: text.length });
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS });
        res.end(currentMessage);
      } catch (err) {
        agentLog("H2", "POST error", { error: err.message });
        res.writeHead(413, { "Content-Type": "text/plain", ...CORS_HEADERS });
        res.end("Error processing message.");
      }
      return;
    }

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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server launched on port ${PORT}`);
});

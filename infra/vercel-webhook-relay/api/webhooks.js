const crypto = require("node:crypto");

const TARGET = process.env.WEBHOOK_TARGET;
const HASH_KEY = process.env.HYPERSWITCH_PAYMENT_RESPONSE_HASH_KEY;

function collectRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function validSignature(rawBody, supplied, algorithm) {
  if (!HASH_KEY || !supplied) return false;

  const expected = crypto.createHmac(algorithm, HASH_KEY).update(rawBody).digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return (
    expectedBytes.length === suppliedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).send("method not allowed");
    return;
  }
  if (!TARGET || !HASH_KEY) {
    res.status(503).send("relay is not configured");
    return;
  }

  try {
    const rawBody = await collectRawBody(req);
    const signature512 = req.headers["x-webhook-signature-512"];
    const signature256 = req.headers["x-webhook-signature-256"];
    const signature = signature512 || signature256;
    const algorithm = signature512 ? "sha512" : "sha256";

    if (!validSignature(rawBody, signature, algorithm)) {
      res.status(401).send("invalid signature");
      return;
    }

    const headers = {
      "content-type": req.headers["content-type"] || "application/json",
      "user-agent": req.headers["user-agent"] || "Hyperswitch-Backend-Server",
    };
    if (signature512) headers["x-webhook-signature-512"] = signature512;
    if (signature256) headers["x-webhook-signature-256"] = signature256;

    const upstream = await fetch(TARGET, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await upstream.text();
    res
      .status(upstream.status)
      .setHeader("content-type", upstream.headers.get("content-type") || "text/plain")
      .send(body);
  } catch (error) {
    console.error("webhook relay failed", error);
    res.status(502).send("upstream unavailable");
  }
};

module.exports.config = {
  api: { bodyParser: false },
};

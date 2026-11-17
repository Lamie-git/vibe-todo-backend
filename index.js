const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const todoCollectionHandler = require("./api/todos");
const todoItemHandler = require("./api/todos/[id]");
const getTodoCollection = require("./routers/todo-collection");
const handleTodoCors = require("./routers/todo-cors");

const envPath = path.join(__dirname, ".env");
const dotenvResult = require("dotenv").config({ path: envPath });
if (dotenvResult.error && dotenvResult.error.code !== "ENOENT") throw dotenvResult.error;

const port = Number(process.env.PORT) || 5000;
const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
const root = __dirname;
const publicFiles = new Set(["/index.html", "/todo.html", "/todo.css", "/todo.js"]);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};
const server = http.createServer((request, response) => {
  let pathname;
  let requestUrl;
  try {
    requestUrl = new URL(request.url || "/", "http://localhost");
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("bad_request");
    return;
  }

  if (pathname === "/api/todos" || pathname.startsWith("/api/todos/")) {
    const origin = request.headers.origin;

    if (handleTodoCors.isAllowedOrigin(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type"
      });
      response.end();
      return;
    }

    handleTodoApi(request, response, requestUrl, pathname).catch((error) => {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("Todo API request failed.", error);
      const message = statusCode === 400
        ? "Invalid JSON request body."
        : statusCode === 413
          ? "Request body is too large."
          : "Internal server error.";
      sendJson(response, statusCode, { error: message });
    });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("method_not_allowed");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  if (!publicFiles.has(requestedPath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not_found");
    return;
  }
  const filePath = path.resolve(root, `.${requestedPath}`);
  const relativePath = path.relative(root, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("not_found");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("not_found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamError) => {
      console.error("파일을 읽지 못했습니다.", streamError);
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("internal_server_error");
    });
    stream.pipe(response);
  });
});

async function handleTodoApi(request, response, requestUrl, pathname) {
  let handler;
  const query = {};

  if (pathname === "/api/todos") {
    handler = todoCollectionHandler;
    const statuses = requestUrl.searchParams.getAll("status");
    if (statuses.length === 1) query.status = statuses[0];
    if (statuses.length > 1) query.status = statuses;
  } else {
    const match = pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (!match) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    handler = todoItemHandler;
    query.id = match[1];
  }

  const apiRequest = { method: request.method, query, headers: request.headers };
  if (request.method === "POST" || request.method === "PATCH") {
    apiRequest.body = await readJsonBody(request);
  }

  let statusCode = 200;
  const headers = {};
  const apiResponse = {
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      });
      response.end(JSON.stringify(body));
      return this;
    }
  };

  await handler(apiRequest, apiResponse);
  if (!response.writableEnded) {
    throw new Error("Todo API handler did not send a response.");
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const maxBodySize = 16 * 1024;
    let bodySize = 0;
    let settled = false;

    request.on("data", (chunk) => {
      if (settled) return;

      bodySize += chunk.length;
      if (bodySize > maxBodySize) {
        settled = true;
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        request.resume();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (settled) return;
      settled = true;
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body.trim()) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Invalid JSON request body.");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function sendJson(response, statusCode, body) {
  if (response.writableEnded) return;
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

server.on("error", (error) => {
  console.error("서버를 시작하지 못했습니다.", error);
  process.exitCode = 1;
});

if (!mongoUri) {
  console.error("MONGO_URI 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

async function startServer() {
  await getTodoCollection();
  console.log("몽고디비 연결 성공");

  server.listen(port, () => {
    console.log(`서버가 ${port}번 포트에서 실행 중입니다.`);
  });
}

startServer().catch((error) => {
  console.error("MongoDB 연결 또는 서버 시작에 실패했습니다.", error);
  process.exitCode = 1;
});

const assert = require("node:assert/strict");
const test = require("node:test");
const handleTodoCors = require("../routers/todo-cors");

function createResponse() {
  const headers = new Map();
  const response = {
    statusCode: undefined,
    ended: false,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
    }
  };

  return { headers, response };
}

test("allows preflight requests from Vercel deployments", () => {
  const { headers, response } = createResponse();
  const request = {
    method: "OPTIONS",
    headers: { origin: "https://todo-app.vercel.app" }
  };

  assert.equal(handleTodoCors(request, response, "GET, POST"), true);
  assert.equal(headers.get("access-control-allow-origin"), "https://todo-app.vercel.app");
  assert.equal(headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
});

test("does not grant CORS access to unrelated origins", () => {
  const { headers, response } = createResponse();
  const request = {
    method: "OPTIONS",
    headers: { origin: "https://example.com" }
  };

  assert.equal(handleTodoCors(request, response, "GET"), true);
  assert.equal(headers.has("access-control-allow-origin"), false);
  assert.equal(response.statusCode, 204);
});

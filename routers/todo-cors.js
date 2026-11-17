const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

module.exports = function handleTodoCors(request, response, allowedMethods) {
  const origin = request.headers.origin;

  if (allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  if (request.method !== "OPTIONS") return false;

  response.setHeader("Access-Control-Allow-Methods", `${allowedMethods}, OPTIONS`);
  response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  response.status(204).end();
  return true;
};

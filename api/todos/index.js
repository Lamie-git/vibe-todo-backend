const getTodoCollection = require("../../routers/todo-collection");
const handleTodoCors = require("../../routers/todo-cors");

module.exports = async function todoCollectionHandler(request, response) {
  if (handleTodoCors(request, response, "GET, POST")) return;

  if (request.method === "GET") {
    const status = request.query?.status;
    if (status !== undefined && !["all", "active", "completed"].includes(status)) {
      return response.status(400).json({ error: "Invalid status filter." });
    }
    const filter = {};
    if (status === "active") filter.completed = false;
    if (status === "completed") filter.completed = true;
    const collection = await getTodoCollection();
    const todos = await collection.find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
    return response.status(200).json(todos.map((todo) => ({
      id: todo._id.toHexString(),
      text: todo.text,
      completed: todo.completed,
      createdAt: todo.createdAt
    })));
  }

  if (request.method === "POST") {
    const text = request.body?.text;
    if (typeof text !== "string" || !text.trim() || text.trim().length > 120) {
      return response.status(400).json({ error: "Text must contain 1 to 120 characters." });
    }
    const todo = { text: text.trim(), completed: false, createdAt: new Date() };
    const collection = await getTodoCollection();
    const result = await collection.insertOne(todo);
    return response.status(201).json({
      id: result.insertedId.toHexString(),
      text: todo.text,
      completed: todo.completed,
      createdAt: todo.createdAt
    });
  }

  response.setHeader("Allow", "GET, POST, OPTIONS");
  return response.status(405).json({ error: "Method not allowed." });
};

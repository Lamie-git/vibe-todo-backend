const { ObjectId } = require("mongodb");
const getTodoCollection = require("../../routers/todo-collection");
const handleTodoCors = require("../../routers/todo-cors");

module.exports = async function todoItemHandler(request, response) {
  if (handleTodoCors(request, response, "PATCH, DELETE")) return;

  if (request.method !== "PATCH" && request.method !== "DELETE") {
    response.setHeader("Allow", "PATCH, DELETE, OPTIONS");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const id = request.query?.id;
  if (typeof id !== "string" || !/^[a-fA-F0-9]{24}$/.test(id)) {
    return response.status(400).json({ error: "Invalid todo ID." });
  }
  const filter = { _id: new ObjectId(id) };

  if (request.method === "DELETE") {
    const collection = await getTodoCollection();
    const result = await collection.deleteOne(filter);
    if (!result.deletedCount) {
      return response.status(404).json({ error: "Todo not found." });
    }
    return response.status(200).json({ id, deleted: true });
  }

  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ error: "Invalid update." });
  }
  const changes = {};
  if (Object.hasOwn(body, "text")) {
    if (typeof body.text !== "string" || !body.text.trim() || body.text.trim().length > 120) {
      return response.status(400).json({ error: "Text must contain 1 to 120 characters." });
    }
    changes.text = body.text.trim();
  }
  if (Object.hasOwn(body, "completed")) {
    if (typeof body.completed !== "boolean") {
      return response.status(400).json({ error: "Completed must be a boolean." });
    }
    changes.completed = body.completed;
  }
  if (!Object.keys(changes).length) {
    return response.status(400).json({ error: "Provide text or completed to update." });
  }

  const collection = await getTodoCollection();
  const todo = await collection.findOneAndUpdate(filter, { $set: changes }, {
    returnDocument: "after", includeResultMetadata: false
  });
  if (!todo) return response.status(404).json({ error: "Todo not found." });
  return response.status(200).json({
    id: todo._id.toHexString(),
    text: todo.text,
    completed: todo.completed,
    createdAt: todo.createdAt
  });
};

const todoSchema = require("../models/todo-schema");

module.exports = async function ensureTodoCollection(database) {
  const options = {
    validator: { $jsonSchema: todoSchema },
    validationLevel: "strict",
    validationAction: "error"
  };
  const collectionExists = await database
    .listCollections({ name: "todos" }, { nameOnly: true })
    .hasNext();

  if (collectionExists) return;

  try {
    await database.createCollection("todos", options);
  } catch (error) {
    // Another function instance can create the collection after listCollections.
    if (error.codeName !== "NamespaceExists" && error.code !== 48) throw error;
  }
};

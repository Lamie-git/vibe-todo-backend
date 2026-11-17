const { MongoClient } = require("mongodb");
const ensureTodoCollection = require("./ensure-todo-collection");

let todoCollectionPromise;

module.exports = async function getTodoCollection() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured.");
  }

  if (!todoCollectionPromise) {
    const client = new MongoClient(mongoUri);
    todoCollectionPromise = (async () => {
      try {
        await client.connect();
        const database = client.db("todo");
        await ensureTodoCollection(database);
        return database.collection("todos");
      } catch (error) {
        await client.close();
        throw error;
      }
    })();

    todoCollectionPromise.catch(() => {
      todoCollectionPromise = null;
    });
  }

  return todoCollectionPromise;
};

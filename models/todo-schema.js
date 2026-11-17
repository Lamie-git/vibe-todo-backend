module.exports = {
  bsonType: "object",
  required: ["text", "completed", "createdAt"],
  properties: {
    _id: { bsonType: "objectId" },
    text: { bsonType: "string", minLength: 1, maxLength: 120 },
    completed: { bsonType: "bool" },
    createdAt: { bsonType: "date" }
  }
};

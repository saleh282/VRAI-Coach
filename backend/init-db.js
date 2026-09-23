const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const User = require("./models/userModel");
const Session = require("./models/sessionModel");
const Evaluation = require("./models/evaluationModel");

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const initializeDatabase = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to the project .env file.");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    for (const model of [User, Session, Evaluation]) {
      await model.createCollection();
      await model.createIndexes();
      console.log(`Collection ready: ${model.collection.collectionName}`);
    }

    console.log("Database schema initialized successfully");
  } finally {
    await mongoose.connection.close();
  }
};

initializeDatabase().catch((error) => {
  console.error("Database initialization failed:", error.message);
  process.exit(1);
});

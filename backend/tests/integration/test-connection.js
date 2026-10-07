const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env"), quiet: true });

const testConnection = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to the project .env file.");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("MongoDB Atlas connection test passed");
  } finally {
    await mongoose.connection.close();
  }
};

testConnection().catch((error) => {
  console.error("MongoDB Atlas connection test failed:", error.message);
  process.exit(1);
});

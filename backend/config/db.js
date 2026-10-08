const mongoose = require("mongoose");

// Connect Mongoose to the database configured by the private MONGO_URI setting.
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to the project .env file.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB Atlas connected successfully");
};

module.exports = connectDB;

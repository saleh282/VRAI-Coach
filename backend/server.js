const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("VRAI-Coach Backend is running 🚀");
});

app.get("/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down server...");
    await mongoose.connection.close();
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});

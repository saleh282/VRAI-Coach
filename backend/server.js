const express = require("express");

const dotenv = require("dotenv"); // new for environment variables
const connectDB = require("./config/db"); // new for database connection

dotenv.config({ path: "./config/config.env" }); // new for environment variables

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.send("VRAI-Coach Backend is running 🚀");
});

// app.listen(5000, () => {
//     console.log("Server running on port 5000");
// });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
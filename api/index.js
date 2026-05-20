const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({
    success: true
  });
});

app.post("/api/auth/register", (req, res) => {
  res.json({
    success: true,
    message: "Register Success"
  });
});

module.exports = app;
module.exports.handler = serverless(app);

// server.js
const express = require("express");
const path = require("path"); // Required for path.join
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Start the server
app.listen(port, () => {
  console.log(`Static server listening at http://localhost:${port}`);
});

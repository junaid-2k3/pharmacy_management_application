const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { PORT, ROOT_DIR } = require("./config");
const { runMigrations } = require("./db/initDb");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

runMigrations();

const app = express();
const frontendDir = path.resolve(ROOT_DIR, "frontend");

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRoutes);
app.use(express.static(frontendDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

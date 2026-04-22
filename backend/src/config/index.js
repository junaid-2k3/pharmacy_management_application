const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "../../..");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.resolve(ROOT_DIR, process.env.DB_PATH || "data/pharmacy.db");

module.exports = {
  PORT,
  DB_PATH,
  ROOT_DIR,
};

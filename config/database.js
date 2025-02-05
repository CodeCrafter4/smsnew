const mysql = require("mysql");
require("dotenv").config();

// Create MySQL Pool Connection
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectTimeout: 20000,
  queueLimit: 0,
});

// Add connection error handling
pool.on("error", (err) => {
  console.error("Database pool error:", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.error("Database connection was closed.");
  }
  if (err.code === "ER_CON_COUNT_ERROR") {
    console.error("Database has too many connections.");
  }
  if (err.code === "ECONNREFUSED") {
    console.error("Database connection was refused.");
  }
});

// Add graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  pool.end((err) => {
    if (err) console.error("Error closing pool", err);
    process.exit(0);
  });
});

module.exports = pool;

const express = require("express");
const exphbs = require("express-handlebars");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const mysql = require("mysql");
const path = require("path");

require("dotenv").config();

// Add these near the top after other requires
const compression = require("compression");
const helmet = require("helmet");

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

// Setup function
const setup = () => {
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

  const app = express();

  const session = require("express-session");

  // Update session configuration
  app.use(
    session({
      secret: process.env.JWT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  app.use(cookieParser());

  const port = process.env.PORT || 3000;

  // Configure Handlebars with custom helpers (like eq)
  const hbs = exphbs.create({
    extname: ".html",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views", "layout"),
    helpers: {
      formatDateTime: (dateString) => {
        if (!dateString) return "N/A";
        const options = {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        };
        return new Date(dateString).toLocaleDateString("en-US", options);
      },
      fallback: (value, fallbackValue) => value || fallbackValue,
      eq: function (a, b) {
        return a === b;
      },
      firstChar: function (str) {
        return str ? str.charAt(0).toUpperCase() : "";
      },
      subtract: function (a, b) {
        return (a || 0) - (b || 0);
      },
      getFeeStatusClass: function (status) {
        switch (status?.toLowerCase()) {
          case "paid":
            return "badge-paid";
          case "partial":
            return "badge-partial";
          default:
            return "badge-pending";
        }
      },
    },
  });

  // Middleware for parsing the request body
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // Serve static files from "public" directory
  app.use(express.static("public"));

  // Set up Handlebars as the templating engine
  app.engine("html", hbs.engine);
  app.set("view engine", "html");
  app.set("views", path.join(__dirname, "views"));

  // Add these middleware before routes
  app.use(compression()); // Compress responses
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
            "https://code.jquery.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://fonts.googleapis.com",
          ],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdn.jsdelivr.net",
          ],
          connectSrc: ["'self'"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  // Routes configuration (assuming you have a student route in ./server/routes/student)
  const routes = require("./server/routes/student");
  app.use("/", routes);

  // Add this after your other middleware
  app.use(express.static(path.join(__dirname, "public")));

  // Add error handling for database connection
  pool.on("connection", (connection) => {
    console.log("DB Connection established");

    connection.on("error", (err) => {
      console.error("DB Connection error", err);
    });
  });

  // Add graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received");
    pool.end((err) => {
      if (err) console.error("Error closing pool", err);
      process.exit(0);
    });
  });

  // Add this after your routes
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", {
      error: "Something broke!",
      details: process.env.NODE_ENV === "development" ? err.message : null,
    });
  });

  // Add a catch-all route for 404s
  app.use((req, res) => {
    res.status(404).render("error", { error: "Page not found" });
  });

  // Add this before your routes
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
};

// Export for Vercel
module.exports = setup();

// Start server if running directly (not on Vercel)
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Export pool for use in other files
exports.pool = pool;

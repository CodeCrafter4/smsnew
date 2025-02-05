const express = require("express");
const exphbs = require("express-handlebars");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

require("dotenv").config();

// Import database configuration
const pool = require("./config/database");

// Create Express app
const app = express();

// Configure Handlebars
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
    eq: (a, b) => a === b,
    firstChar: (str) => (str ? str.charAt(0).toUpperCase() : ""),
    subtract: (a, b) => (a || 0) - (b || 0),
    getFeeStatusClass: (status) => {
      switch (status?.toLowerCase()) {
        case "paid":
          return "badge-paid";
        case "partial":
          return "badge-partial";
        default:
          return "badge-pending";
      }
    },
    toLowerCase: function (str) {
      return str.toLowerCase();
    },
    formatDate: function (date) {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString();
    },
    formatDateTime: function (date) {
      if (!date) return "N/A";
      return new Date(date).toLocaleString();
    },
    formatCurrency: function (amount) {
      if (!amount) return "ET 0";
      return `ET ${amount.toLocaleString()}`;
    },
  },
});

// Session store setup
const sessionStore = new MySQLStore(
  {
    expiration: 86400000,
    createDatabaseTable: true,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data",
      },
    },
  },
  pool
);

// Middleware setup
app.use(compression());
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

app.use(
  session({
    key: "session_cookie_name",
    secret: process.env.JWT_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

// View engine setup
app.engine("html", hbs.engine);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Main routes
const routes = require(path.join(__dirname, "server", "routes", "student"));
app.use("/", routes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    error: "Something broke!",
    details: process.env.NODE_ENV === "development" ? err.message : null,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", { error: "Page not found" });
});

// Export for Vercel
module.exports = app;

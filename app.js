const express = require("express");
const exphbs = require("express-handlebars");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const mysql = require("mysql");
const path = require("path");

require("dotenv").config();

// Create MySQL Pool Connection
const pool = mysql.createPool({
  connectionLimit: 100,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Database connected successfully");
    connection.release();
  }
});

const app = express();

const session = require("express-session");

// app.use(
//   session({
//     secret: "muhammed",
//     resave: false,
//     saveUninitialized: true,
//     cookie: { secure: false }, // Use `secure: true` if using HTTPS
//   })
// );

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

// Export pool for use in other files
module.exports = { pool };

// Routes configuration (assuming you have a student route in ./server/routes/student)
const routes = require("./server/routes/student");
app.use("/", routes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

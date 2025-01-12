const express = require("express");
const exphbs = require("express-handlebars");

const bodyParser = require("body-parser");

const mysql = require("mysql");
const path = require("path");

require("dotenv").config();


const app = express();

const session = require("express-session");

app.use(
  session({
    secret: "muhammed",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use `secure: true` if using HTTPS
  })
);





const port = process.env.PORT || 5000;

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

// Routes configuration (assuming you have a student route in ./server/routes/student)
const routes = require("./server/routes/student");
app.use("/", routes);

// Start the server
app.listen(port, () => console.log(`Listening on port ${port}`));


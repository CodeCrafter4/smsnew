const express = require("express");
const router = express.Router();
const path = require("path");

// Import controllers and middleware
const userController = require(path.join(
  __dirname,
  "..",
  "controller",
  "studentController"
));
const { authenticateToken } = require(path.join(
  __dirname,
  "..",
  "middleware",
  "authMiddleware"
));
const pool = require("../../config/database");

// **Authentication Routes**
router.get("/signup", (req, res) => res.render("signup"));
router.post("/signup", userController.signup);
router.get("/login", (req, res) => res.render("login"));
router.post("/login", userController.login);
// router.get("/logout", userController.logout);

//create, find update, delete

// View receipt in browser
router.get(
  "/fees/receipt/view/:studentId",
  authenticateToken,
  userController.generateFeeReceipt
);

// Download receipt as PDF
router.get(
  "/fees/receipt/download/:studentId",
  authenticateToken,
  userController.generateFeeReceipt
);

router.get("/attendance", authenticateToken, userController.viewAttendance);
router.get(
  "/update/fees-status",
  authenticateToken,
  userController.getFeeStatusForm
);
router.post(
  "/update/fees-status",
  authenticateToken,
  userController.updateFeesStatus
);

router.post(
  "/attendance/mark",
  authenticateToken,
  express.json(),
  userController.markAttendance
);
router.get(
  "/attendance/weekly",
  authenticateToken,
  userController.weeklyReport
);

// **Protected Routes (Require Login)**
router.get("/", authenticateToken, userController.view);
router.post("/", authenticateToken, userController.find);
router.get("/add", authenticateToken, userController.form);
router.post("/add", authenticateToken, userController.create);
router.get("/edit/:id", authenticateToken, userController.edit);
router.post("/edit/:id", authenticateToken, userController.update);
router.get("/delete/:id", authenticateToken, userController.delete);

router.get("/view_all", authenticateToken, userController.viewAllStudents);
router.post(
  "/update/fees/:studentId",
  authenticateToken,
  userController.updateFeesStatus
);
router.post(
  "/update/attendance/:studentId",
  authenticateToken,
  userController.updateAttendanceStatus
);

router.get(
  "/fees/payment-history/:studentId",
  authenticateToken,
  userController.getPaymentHistory
);

// Update these routes for fee receipt generation
router.get(
  "/fees/receipt/generate/:studentId",
  authenticateToken,
  userController.generateFeeReceipt
);

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

router.get("/", (req, res) => {
  const isAuthenticated = req.session.user || req.cookies.token ? true : false;
  res.render("home", { isAuthenticated });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

module.exports = router;

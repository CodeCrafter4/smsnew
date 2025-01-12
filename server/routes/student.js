const express = require('express')
const router = express.Router();
const userController=require('../controller/studentController');
const { authenticateToken } = require("../middleware/authMiddleware");


//create, find update, delete
router.get("/",userController.view);
router.post("/", userController.find);

// User Authentication


router.get("/signup", (req, res) => {
  res.render("signup"); // Assumes a signup.html file exists in the views folder
});

router.get("/login", (req, res) => {
  res.render("login"); // Assumes a signup.html file exists in the views folder
});


router.post("/signup", userController.signup);
router.post("/login", userController.login);

// View receipt in browser
router.get("/fees/receipt/view/:studentId", userController.viewFeeReceipt);

// Download receipt as PDF
router.get("/fees/receipt/download/:studentId", userController.generateFeeReceipt);




router.get("/attendance", userController.viewAttendance);

router.get("/update/fees-status", userController.getFeeStatusForm);
router.post("/update/fees-status", userController.updateFeesStatus);



router.post("/attendance/mark",userController.markAttendance);

router.get("/attendance/weekly", userController.weeklyReport);





router.get("/add", userController.form);
router.get("/view_all", userController.viewAllStudents);

router.post("/add", userController.create);
router.get("/edit/:id", userController.edit);
router.post("/edit/:id", userController.update);
router.get("/delete/:id", userController.delete);

router.post("/update/fees/:studentId", userController.updateFeesStatus);
router.post("/update/attendance/:studentId",userController.updateAttendanceStatus);
router.get("", (req, res) => {
  
  res.render("home", { title: "Welcome Home!" });
});





// Protected Route Example
router.get("/protected", authenticateToken, (req, res) => {
  res.send(`Welcome, ${req.user.email}. This is a protected route.`);
});

module.exports = router;
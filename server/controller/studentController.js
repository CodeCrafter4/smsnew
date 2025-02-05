const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/database");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

//view students
// View all students, fees, and attendance
exports.view = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed!", err);
      return;
    }

    const currentDate = new Date().toISOString().split("T")[0];

    const query = `
      SELECT 
        students.*, 
        fees.fee_amount,
        CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END as is_present
      FROM students 
      LEFT JOIN fees ON students.student_id = fees.student_id
      LEFT JOIN attendance ON students.student_id = attendance.student_id 
        AND attendance.attendance_date = ?
    `;

    connection.query(query, [currentDate], (error, rows) => {
      connection.release();
      if (error) {
        console.error("Error fetching data:", error);
        return res.status(500).send("Error fetching data");
      }
      res.render("home", { rows });
    });
  });
};

//find user by search
// Find user by search (fetching from students and fees tables)
exports.find = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;
    console.log("Connected to the database! " + connection.threadId);

    let search = req.body.search;

    // Query to fetch student data along with fee details
    const query = `
      SELECT 
        students.student_id, 
        students.name, 
        students.roll_number, 
        students.class, 
        students.parent_contact, 
        fees.fee_amount, 
        fees.fees_status, 
      fees.paid_date
      FROM students 
      LEFT JOIN fees ON students.student_id = fees.student_id
      WHERE students.name LIKE ?;
    `;

    connection.query(query, [`%${search}%`], (err, rows) => {
      connection.release();

      if (!err && rows) {
        res.render("home.html", { rows });
      } else {
        console.error("Error fetching student and fee data: ", err);
        res.status(500).send("Error fetching data");
      }

      console.log("Fetched data from students and fees tables.");
    });
  });
};

// Render edit page
exports.edit = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;
    let id = req.params.id;

    connection.query(
      "SELECT * FROM students WHERE student_id = ?",
      [id],
      (err, rows) => {
        connection.release();
        if (!err && rows.length > 0) {
          const grades = [
            "Grade 1",
            "Grade 2",
            "Grade 3",
            "Grade 4",
            "Grade 5",
            "Grade 6",
            "Grade 7",
            "Grade 8",
            "Grade 9",
            "Grade 10",
            "Grade 11",
            "Grade 12",

          ];
          res.render("edit.html", {
            student: rows[0],
            grades: grades,
          });
        } else {
          console.log(err);
        }
      }
    );
  });
};

// Update student
exports.update = (req, res) => {
  const { name, roll_number, class: studentClass, parent_contact } = req.body;
  const id = req.params.id;

  pool.getConnection((err, connection) => {
    if (err) throw err;
    connection.query(
      "UPDATE students SET name = ?, roll_number = ?, class = ?, parent_contact = ? WHERE student_id = ?",
      [name, roll_number, studentClass, parent_contact, id],
      (err) => {
        connection.release();
        if (err) {
          console.log(err);
          return res.redirect(
            `/edit/${id}?error=Failed to update student information`
          );
        }
        res.redirect("/?success=Student information updated successfully");
      }
    );
  });
};

exports.delete = (req, res) => {
  const id = req.params.id;
  pool.getConnection((err, connection) => {
    if (err) throw err;
    connection.query(
      "DELETE FROM students WHERE student_id = ?",
      [id],
      (err) => {
        connection.release();
        if (err) {
          console.log(err);
          return res.redirect("/?error=Failed to delete student");
        }
        res.redirect("/?success=Student deleted successfully");
      }
    );
  });
};

// Add new student
exports.create = (req, res) => {
  const {
    name,
    roll_number,
    class: studentClass,
    parent_contact,
    fee_amount,
  } = req.body;
  const paid_date = new Date().toISOString().split("T")[0];

  pool.getConnection((err, connection) => {
    if (err) throw err;

    connection.query(
      "INSERT INTO students (name, roll_number, class, parent_contact) VALUES (?, ?, ?, ?)",
      [name, roll_number, studentClass, parent_contact],
      (err, results) => {
        if (err) {
          console.error(err);
          connection.release();
          return res.redirect(
            "/add?error=The roll number must be unique. Student creation failed."
          );
        }

        const studentId = results.insertId;

        connection.query(
          "INSERT INTO fees (student_id, fee_amount, paid_date) VALUES (?, ?, ?)",
          [studentId, fee_amount, paid_date],
          (err) => {
            connection.release();
            if (err) {
              console.error(err);
              return res.redirect("/add?error=Error adding fee information.");
            }
            res.redirect("/?success=Student added successfully!");
          }
        );
      }
    );
  });
};

exports.viewAllStudents = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.log("Database connection error: ", err);
      res.send("An error occurred while connecting to the database.");
      return;
    }

    const query = `
  SELECT 
    students.student_id, 
    students.name, 
    students.roll_number, 
    students.class, 
    students.parent_contact, 
    fees.fee_amount, 
    fees.fees_status, 
    attendance.attendance_date, 
    attendance.status AS attendance_status
  FROM 
    students 
  LEFT JOIN 
    fees ON students.student_id = fees.student_id 
  LEFT JOIN 
    attendance ON students.student_id = attendance.student_id
`;

    connection.query(query, (error, rows) => {
      connection.release();
      if (error) {
        console.log("Error with query: ", error); // Check for specific syntax errors
        res.send("An error occurred while fetching data.");
        return;
      }

      console.log("Data from query: ", rows); // Check the results from the query
      res.render("view_all.html", { rows });
    });
  });
};

// Update Fees Status
exports.updateFeesStatus = (req, res) => {
  const { studentId, fees_status, payment_amount, payment_date } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.redirect(
        "/update/fees-status?error=Database connection failed"
      );
    }

    // Start transaction
    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Transaction error:", err);
        return res.redirect("/update/fees-status?error=Transaction failed");
      }

      // First insert the payment record
      const paymentQuery = `
        INSERT INTO fee_payments (
          student_id, 
          amount, 
          payment_date, 
          status
        ) VALUES (?, ?, ?, ?)
      `;

      connection.query(
        paymentQuery,
        [studentId, payment_amount, payment_date, fees_status],
        (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Payment insert error:", err);
              res.redirect(
                "/update/fees-status?error=Failed to update payment"
              );
            });
          }

          // Then update the fees table status
          const updateQuery = `
            UPDATE fees 
            SET 
              fees_status = ?,
              paid_date = ?,
              paid_amount = COALESCE(paid_amount, 0) + ?
            WHERE student_id = ?
          `;

          connection.query(
            updateQuery,
            [fees_status, payment_date, payment_amount, studentId],
            (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error("Status update error:", err);
                  res.redirect(
                    "/update/fees-status?error=Failed to update status"
                  );
                });
              }

              // Commit the transaction
              connection.commit((err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error("Commit error:", err);
                    res.redirect(
                      "/update/fees-status?error=Failed to commit changes"
                    );
                  });
                }

                connection.release();
                res.redirect(
                  "/update/fees-status?success=Payment updated successfully"
                );
              });
            }
          );
        }
      );
    });
  });
};

// Update Attendance Status
exports.updateAttendanceStatus = (req, res) => {
  const studentId = req.params.studentId;

  pool.getConnection((err, connection) => {
    if (err) throw err;

    // Get the current attendance status
    connection.query(
      "SELECT status FROM attendance WHERE student_id = ?",
      [studentId],
      (err, results) => {
        if (err) {
          connection.release();
          console.log(err);
          return res.status(500).send("Error fetching attendance status");
        }

        const currentStatus = results[0]?.status;
        const newStatus = currentStatus === "absent" ? "present" : "absent";
        const currentDate = new Date().toLocaleDateString("en-CA");

        // Update the attendance status and attendance_date
        connection.query(
          "UPDATE attendance SET status = ?, attendance_date = ? WHERE student_id = ?",
          [newStatus, currentDate, studentId],
          (err) => {
            connection.release();
            if (err) {
              console.log(err);
              return res.status(500).send("Error updating attendance status");
            }
            res.redirect("/view_all");
          }
        );
      }
    );
  });
};

// Render form to add new student
exports.form = (req, res) => {
  res.render("add"); // This assumes you have an 'add.hbs' file in your 'views' folder
};

// Mark attendance for a specific date
exports.markAttendance = (req, res) => {
  const { studentId, status, date } = req.body;
  const attendance_date = date || new Date().toISOString().split("T")[0];

  // Validate status
  if (status !== "present" && status !== "absent") {
    return res.json({
      success: false,
      error: "Invalid status value",
    });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.json({
        success: false,
        error: "Database connection failed",
      });
    }

    // First check if an attendance record exists for this date
    const checkQuery = `
      SELECT * FROM attendance 
      WHERE student_id = ? AND DATE(attendance_date) = DATE(?)
    `;

    connection.query(
      checkQuery,
      [studentId, attendance_date],
      (checkErr, checkResults) => {
        if (checkErr) {
          connection.release();
          console.error("Check query error:", checkErr);
          return res.json({
            success: false,
            error: "Failed to check existing attendance",
          });
        }

        let query;
        let params;

        if (checkResults.length > 0) {
          // Update existing record
          query = `
          UPDATE attendance 
          SET status = ? 
          WHERE student_id = ? AND DATE(attendance_date) = DATE(?)
        `;
          params = [status, studentId, attendance_date];
        } else {
          // Insert new record
          query = `
          INSERT INTO attendance (student_id, attendance_date, status) 
          VALUES (?, ?, ?)
        `;
          params = [studentId, attendance_date, status];
        }

        connection.query(query, params, (err, result) => {
          connection.release();

          if (err) {
            console.error("Attendance update error:", err);
            return res.json({
              success: false,
              error: "Failed to update attendance",
            });
          }

          res.json({
            success: true,
            message: "Attendance marked successfully",
            status: status,
            date: attendance_date,
          });
        });
      }
    );
  });
};

exports.viewAttendance = (req, res) => {
  const selectedDate = req.query.date || new Date().toISOString().split("T")[0];

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed!", err);
      return res.status(500).send("Database connection failed");
    }

    const query = `
      SELECT 
        students.*, 
        CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END as is_present
      FROM 
        students
      LEFT JOIN 
        attendance ON students.student_id = attendance.student_id 
        AND DATE(attendance.attendance_date) = ?
      ORDER BY students.name
    `;

    connection.query(query, [selectedDate], (err, rows) => {
      connection.release();
      if (err) {
        console.error("Error fetching attendance data:", err);
        return res.status(500).send("Error fetching attendance data");
      }

      res.render("attendance", {
        rows,
        currentDate: selectedDate,
      });
    });
  });
};

exports.getFeeStatusForm = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = `
      SELECT 
        s.student_id,
        s.name,
        s.roll_number,
        s.class,
        f.fee_amount,
        COALESCE(
          (SELECT SUM(amount) 
          FROM fee_payments 
          WHERE student_id = s.student_id), 
          0
        ) as paid_amount,
        f.fees_status,
        f.paid_date,
        (
          SELECT MAX(payment_date) 
          FROM fee_payments 
          WHERE student_id = s.student_id
        ) as last_payment_date
      FROM students s
      LEFT JOIN fees f ON s.student_id = f.student_id
      ORDER BY s.name
    `;

    connection.query(query, (err, rows) => {
      connection.release();
      if (!err) {
        // Calculate fee status based on paid amount
        rows.forEach((row) => {
          if (row.paid_amount >= row.fee_amount) {
            row.fees_status = "paid";
          } else if (row.paid_amount > 0) {
            row.fees_status = "partial";
          } else {
            row.fees_status = "pending";
          }
        });
        res.render("update_fee_status", { rows });
      } else {
        console.log(err);
      }
    });
  });
};

exports.generateFeeReceipt = async (req, res) => {
  const { studentId } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).send("Database connection failed");
    }

    const query = `
      SELECT 
        students.name,
        students.roll_number,
        students.class,
        fees.fee_amount,
        fees.paid_amount,
        fees.fees_status,
        fees.updated_date,
        (
          SELECT amount 
          FROM fee_payments 
          WHERE student_id = students.student_id 
          ORDER BY payment_date DESC 
          LIMIT 1
        ) as last_payment_amount,
        (
          SELECT payment_date 
          FROM fee_payments 
          WHERE student_id = students.student_id 
          ORDER BY payment_date DESC 
          LIMIT 1
        ) as last_payment_date
      FROM students 
      LEFT JOIN fees ON students.student_id = fees.student_id
      WHERE students.student_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
      connection.release();
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).send("Error fetching student data");
      }

      if (!results || results.length === 0) {
        return res.status(404).send("No student data found");
      }

      const receiptData = results[0];
      res.render("fee_receipt", {
        receipt: {
          ...receiptData,
          receiptNo: `${studentId}-${Date.now()}`,
          currentDate: new Date().toLocaleDateString(),
          balance:
            (receiptData.fee_amount || 0) - (receiptData.paid_amount || 0),
        },
      });
    });
  });
};

exports.viewFeeReceipt = (req, res) => {
  const { studentId } = req.params;

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = `
      SELECT 
        students.student_id,
        students.name, 
        students.roll_number, 
        students.class, 
        students.parent_contact, 
        fees.fee_amount, 
        fees.fees_status, 
        fees.updated_date 
      FROM 
        students 
      LEFT JOIN 
        fees ON students.student_id = fees.student_id 
      WHERE 
        students.student_id = ?
    `;

    connection.query(query, [studentId], (err, results) => {
      connection.release();
      if (err) {
        console.error("Error fetching fee receipt:", err);
        return res.status(500).send("Error fetching fee receipt");
      }

      if (results.length === 0) {
        return res.status(404).send("No receipt found for this student");
      }

      const receiptData = results[0];
      receiptData.updated_date = receiptData.updated_date || "N/A"; // Add fallback

      res.render("view_receipt", { receipt: receiptData });
    });
  });
};

exports.weeklyReport = (req, res) => {
  const { weekStart } = req.query;
  if (!weekStart) {
    return res.json({ success: false, error: "Week start date is required" });
  }

  // Calculate week dates
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 4); // Monday to Friday (5 days)

  pool.getConnection((err, connection) => {
    if (err) {
      return res.json({ success: false, error: "Database connection failed" });
    }

    const query = `
      SELECT 
        students.student_id,
        students.name,
        attendance.attendance_date,
        attendance.status
      FROM 
        students
      LEFT JOIN 
        attendance ON students.student_id = attendance.student_id
      WHERE 
        attendance.attendance_date BETWEEN ? AND ?
      ORDER BY 
        students.name, attendance.attendance_date
    `;

    connection.query(
      query,
      [weekStart, endDate.toISOString().split("T")[0]],
      (err, results) => {
        connection.release();
        if (err) {
          return res.json({
            success: false,
            error: "Failed to fetch attendance data",
          });
        }

        // Process the results
        const studentAttendance = {};
        let totalAttendance = 0;
        let studentCount = 0;

        results.forEach((record) => {
          if (!studentAttendance[record.student_id]) {
            studentAttendance[record.student_id] = {
              name: record.name,
              attendance: {
                Monday: "absent",
                Tuesday: "absent",
                Wednesday: "absent",
                Thursday: "absent",
                Friday: "absent",
              },
              presentDays: 0,
            };
          }

          if (record.status === "present") {
            const dayOfWeek = new Date(record.attendance_date).toLocaleString(
              "en-US",
              { weekday: "long" }
            );
            studentAttendance[record.student_id].attendance[dayOfWeek] =
              "present";
            studentAttendance[record.student_id].presentDays++;
          }
        });

        // Calculate statistics
        const report = Object.values(studentAttendance).map((student) => {
          const attendancePercentage = Math.round(
            (student.presentDays / 5) * 100
          );
          totalAttendance += attendancePercentage;
          studentCount++;
          return {
            ...student,
            attendancePercentage,
          };
        });

        const statistics = {
          totalStudents: studentCount,
          averageAttendance: studentCount
            ? Math.round(totalAttendance / studentCount)
            : 0,
          highestAttendance: Math.max(
            ...report.map((s) => s.attendancePercentage)
          ),
          lowestAttendance: Math.min(
            ...report.map((s) => s.attendancePercentage)
          ),
        };

        res.json({
          success: true,
          report,
          statistics,
        });
      }
    );
  });
};

exports.signup = (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.render("signup", { error: "All fields are required." });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    connection.query(query, [name, email, hashedPassword], (error, results) => {
      connection.release();

      if (error) {
        if (error.code === "ER_DUP_ENTRY") {
          return res.render("signup", { error: "Email already exists." });
        }
        return res.render("signup", { error: "Error registering user." });
      }

      res.render("login", {
        success: "Registration successful! Please login.",
      });
    });
  });
};

// **User Login**
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("login", { error: "Email and password are required." });
  }

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = "SELECT * FROM users WHERE email = ?";
    connection.query(query, [email], (error, results) => {
      connection.release();

      if (error) {
        return res.render("login", { error: "Error logging in." });
      }

      if (results.length === 0) {
        return res.render("login", { error: "Invalid email or password." });
      }

      const user = results[0];
      const isValid = bcrypt.compareSync(password, user.password);

      if (!isValid) {
        return res.render("login", { error: "Invalid email or password." });
      }

      // **Generate JWT Token**
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // **Set the token in HTTP-only cookie**
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 3600000,
      });

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Secure only in production
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Prevents CSRF attacks
        maxAge: 3600000, // 1 hour
      };

      res.cookie("token", token, cookieOptions);

      res.redirect("/?success=Login successful!");
    });
  });
};

// **User Logout**
exports.logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/login?success=Logged out successfully");
};

// Add this new endpoint for payment history
exports.getPaymentHistory = (req, res) => {
  const studentId = req.params.studentId;

  pool.getConnection((err, connection) => {
    if (err) {
      return res.json({ success: false, error: "Database connection failed" });
    }

    connection.query(
      "SELECT * FROM fee_payments WHERE student_id = ? ORDER BY payment_date DESC",
      [studentId],
      (err, payments) => {
        connection.release();
        if (err) {
          return res.json({
            success: false,
            error: "Error fetching payment history",
          });
        }
        res.json({ success: true, payments });
      }
    );
  });
};

exports.viewWeeklyReport = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed!", err);
      return res.status(500).send("Database connection failed");
    }

    // Get the current week's date range
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    const monday = new Date(selectedDate);
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    monday.setHours(0, 0, 0, 0);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);

    // First get all students to ensure we include everyone
    const studentsQuery = `
      SELECT 
        student_id,
        name,
        roll_number,
        class
      FROM students
      ORDER BY name
    `;

    connection.query(studentsQuery, (err, students) => {
      if (err) {
        connection.release();
        console.error("Error fetching students:", err);
        return res.status(500).send("Error generating report");
      }

      // Get all students with their daily attendance
      const attendanceQuery = `
        SELECT 
          student_id,
          DATE(attendance_date) as attendance_date,
          status
        FROM 
          attendance
        WHERE 
          DATE(attendance_date) BETWEEN DATE(?) AND DATE(?)
      `;

      connection.query(attendanceQuery, [monday, friday], (err, attendance) => {
        connection.release();
        if (err) {
          console.error("Error fetching students:", err);
          return res.status(500).send("Error generating report");
        }

        // Process results into weekly format
        const weeklyData = {};
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

        // First, get all unique students and initialize their data
        students.forEach((student) => {
          weeklyData[student.student_id] = {
            student_id: student.student_id,
            name: student.name,
            roll_number: student.roll_number,
            class: student.class,
            attendance: {
              Monday: "absent",
              Tuesday: "absent",
              Wednesday: "absent",
              Thursday: "absent",
              Friday: "absent",
            },
            presentCount: 0,
            attendancePercentage: 0,
          };
        });

        // Process attendance records
        attendance.forEach((record) => {
          if (record.attendance_date) {
            const date = new Date(record.attendance_date);
            const day = date.toLocaleDateString("en-US", { weekday: "long" });

            if (days.includes(day)) {
              weeklyData[record.student_id].attendance[day] = record.status;
              if (record.status === "present") {
                weeklyData[record.student_id].presentCount++;
              }
            }
          }
        });

        // Calculate percentages and summary
        let totalAttendance = 0;
        let studentCount = 0;

        Object.values(weeklyData).forEach((student) => {
          // Calculate percentage based on actual school days
          const schoolDays = 5; // Monday to Friday
          student.attendancePercentage = Math.round(
            (student.presentCount / schoolDays) * 100
          );
          totalAttendance += student.attendancePercentage;
          studentCount++;
        });

        console.log("Weekly Data Sample:", Object.values(weeklyData)[0]);
        console.log("Date Range:", { monday, friday });

        const summary = {
          totalStudents: studentCount,
          averageAttendance: studentCount
            ? Math.round(totalAttendance / studentCount)
            : 0,
          weekRange: {
            start: monday.toISOString().split("T")[0],
            end: friday.toISOString().split("T")[0],
          },
        };

        res.render("weekly-report", {
          weeklyData: Object.values(weeklyData),
          summary,
          days,
          helpers: {
            eq: function (a, b) {
              return a === b;
            },
          },
        });
      });
    });
  });
};

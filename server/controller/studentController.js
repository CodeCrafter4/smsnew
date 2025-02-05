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
          res.render("edit.html", { student: rows[0] });
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

    // First check if a fee record exists for this student
    connection.query(
      "SELECT fee_amount FROM fees WHERE student_id = ?",
      [studentId],
      (err, results) => {
        if (err) {
          connection.release();
          console.error("Query error:", err);
          return res.redirect(
            "/update/fees-status?error=Error checking fee details"
          );
        }

        if (results.length === 0) {
          connection.release();
          return res.redirect(
            "/update/fees-status?error=No fee record found for this student"
          );
        }

        const currentFee = results[0];

        // Check if columns exist and add them if they don't
        connection.query(
          `SHOW COLUMNS FROM fees LIKE 'paid_amount'`,
          (err, columns) => {
            if (err) {
              connection.release();
              console.error("Column check error:", err);
              return res.redirect(
                "/update/fees-status?error=Error checking database structure"
              );
            }

            const addColumnsIfNeeded = async () => {
              try {
                if (columns.length === 0) {
                  await connection.query(
                    "ALTER TABLE fees ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0"
                  );
                }

                await connection.query(
                  `SHOW COLUMNS FROM fees LIKE 'updated_date'`,
                  async (err, dateColumns) => {
                    if (dateColumns.length === 0) {
                      await connection.query(
                        "ALTER TABLE fees ADD COLUMN updated_date DATE"
                      );
                    }

                    // Now get the current paid amount
                    connection.query(
                      "SELECT COALESCE(paid_amount, 0) as current_paid FROM fees WHERE student_id = ?",
                      [studentId],
                      (err, paidResults) => {
                        if (err) {
                          connection.release();
                          console.error("Paid amount query error:", err);
                          return res.redirect(
                            "/update/fees-status?error=Error fetching current payment"
                          );
                        }

                        const currentPaid = parseFloat(
                          paidResults[0]?.current_paid || 0
                        );
                        const newPaidAmount =
                          currentPaid + parseFloat(payment_amount);

                        // Determine the final status based on the payment amount
                        let finalStatus = fees_status;
                        if (newPaidAmount >= currentFee.fee_amount) {
                          finalStatus = "paid";
                        } else if (newPaidAmount > 0) {
                          finalStatus = "partial";
                        } else {
                          finalStatus = "pending";
                        }

                        // Update the fees table
                        const updateQuery = `
                          UPDATE fees 
                          SET 
                            fees_status = ?,
                            updated_date = ?,
                            paid_amount = ?
                          WHERE student_id = ?
                        `;

                        connection.query(
                          updateQuery,
                          [finalStatus, payment_date, newPaidAmount, studentId],
                          (err) => {
                            if (err) {
                              connection.release();
                              console.error("Update error:", err);
                              return res.redirect(
                                "/update/fees-status?error=Error updating fee status"
                              );
                            }

                            // Create fee_payments table
                            const createPaymentsTable = `
                              CREATE TABLE IF NOT EXISTS fee_payments (
                                payment_id INT PRIMARY KEY AUTO_INCREMENT,
                                student_id INT NOT NULL,
                                amount DECIMAL(10,2) NOT NULL,
                                payment_date DATE NOT NULL,
                                status VARCHAR(20) NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
                              )
                            `;

                            connection.query(createPaymentsTable, (err) => {
                              if (err) {
                                connection.release();
                                console.error("Table creation error:", err);
                                return res.redirect(
                                  "/update/fees-status?error=Error setting up payment history"
                                );
                              }

                              // Record the payment
                              const paymentQuery = `
                                INSERT INTO fee_payments 
                                (student_id, amount, payment_date, status) 
                                VALUES (?, ?, ?, ?)
                              `;

                              connection.query(
                                paymentQuery,
                                [
                                  studentId,
                                  payment_amount,
                                  payment_date,
                                  finalStatus,
                                ],
                                (err) => {
                                  connection.release();
                                  if (err) {
                                    console.error("Payment record error:", err);
                                    return res.redirect(
                                      "/update/fees-status?error=Payment recorded but history update failed"
                                    );
                                  }
                                  res.redirect(
                                    "/update/fees-status?success=Payment updated successfully"
                                  );
                                }
                              );
                            });
                          }
                        );
                      }
                    );
                  }
                );
              } catch (error) {
                connection.release();
                console.error("Database structure error:", error);
                return res.redirect(
                  "/update/fees-status?error=Error updating database structure"
                );
              }
            };

            addColumnsIfNeeded();
          }
        );
      }
    );
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

  // Validate inputs
  if (!studentId || !status) {
    return res.json({
      success: false,
      error: "Student ID and status are required",
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
      WHERE student_id = ? AND attendance_date = ?
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
          WHERE student_id = ? AND attendance_date = ?
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
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).send("Database connection failed");
    }

    // Simplified query to avoid missing columns
    const checkTableQuery = `
      SELECT 
        students.student_id, 
        students.name,
        students.roll_number,
        fees.fee_amount,
        fees.fees_status,
        fees.updated_date as last_payment_date
      FROM 
        students 
      LEFT JOIN 
        fees ON students.student_id = fees.student_id
      ORDER BY 
        students.name ASC
    `;

    connection.query(checkTableQuery, (err, rows) => {
      connection.release();

      if (err) {
        console.error("Database query error:", err);
        return res.status(500).send("Error fetching students: " + err.message);
      }

      try {
        // Format the data with default values
        const formattedRows = rows.map((row) => ({
          ...row,
          fee_amount: parseFloat(row.fee_amount) || 0,
          paid_amount: 0, // Default value until column is created
          fees_status: row.fees_status || "pending",
          last_payment_date: row.last_payment_date || null,
        }));

        // Render the form with student data
        res.render("update_fees_status", {
          rows: formattedRows,
          success: req.query.success,
          error: req.query.error,
        });
      } catch (error) {
        console.error("Data processing error:", error);
        res.status(500).send("Error processing student data");
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

const mysql = require("mysql");


//connection pool
const pool = mysql.createPool({
  connectionLimit: 100,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});


//view students
// View all students, fees, and attendance
exports.view = (req, res) => {
  // Connect to the database
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed!", err);
      return;
    }
    console.log("Connected to the database!" );

    // SQL queries
    const studentQuery = "SELECT * FROM students";
    const feesQuery = "SELECT * FROM fees";
    const attendanceQuery = "SELECT * FROM attendance";

    // Get student data
    connection.query(studentQuery, (error1, studentRows) => {
      if (error1) {
        console.error("Error fetching students: ", error1);
        connection.release();
        return;
      }

      // Get fees data
      connection.query(feesQuery, (error2, feesRows) => {
        if (error2) {
          console.error("Error fetching fees: ", error2);
          connection.release();
          return;
        }

        // Get attendance data
        connection.query(attendanceQuery, (error3, attendanceRows) => {
          connection.release(); // Release the connection back to the pool

          if (error3) {
            console.error("Error fetching attendance: ", error3);
            return;
          }

          // Combine student, fees, and attendance data
          const combinedData = studentRows.map((student) => {
            const fee =
              feesRows.find((fee) => fee.student_id === student.student_id) ||
              {};
            const attendance =
              attendanceRows.find(
                (att) => att.student_id === student.student_id
              ) || {};

            return {
              ...student,
              fee_amount: fee.fee_amount || "N/A", // Default to 'N/A' if no data
              attendance_date: attendance.date || "N/A", // Default to 'N/A' if no data
            };
          });

          // Send the combined data to the "home" view
          res.render("home", { rows: combinedData });

          // Log the combined data for debugging
         
        });
      });
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

    connection.query('SELECT * FROM students WHERE student_id = ?', [id], (err, rows) => {
      connection.release();
      if (!err && rows.length > 0) {
        res.render("edit.html", { student: rows[0] });
      } else {
        console.log(err);
      }
    });
  });
};



// Update student
exports.update = (req, res) => {
  const { name, roll_number, class: studentClass, parent_contact } = req.body;
  const id = req.params.id;
  pool.getConnection((err, connection) => {
    if (err) throw err;
    connection.query(
      'UPDATE students SET name = ?, roll_number = ?, class = ?, parent_contact = ? WHERE student_id = ?',
      [name, roll_number, studentClass, parent_contact, id],
      (err) => {
        connection.release();
        if (!err) {
          res.redirect('/');
        } else {
          console.log(err);
        }
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
        if (!err) {
          res.redirect("/");
        } else {
          console.log(err);
        }
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

  const paid_date = new Date().toISOString().split("T")[0]; // Current date in YYYY-MM-DD format

  pool.getConnection((err, connection) => {
    if (err) throw err;

    // Insert into students table
    connection.query(
      "INSERT INTO students (name, roll_number, class, parent_contact) VALUES (?, ?, ?, ?)",
      [name, roll_number, studentClass, parent_contact],
      (err, results) => {
        if (err) {
          console.error(err);
          connection.release();
          return res.status(500).send("The roll number must be uniq, Error inserting into students table");
        }

        const studentId = results.insertId; // Get the new student ID

        // Insert into fees table
        connection.query(
          "INSERT INTO fees (student_id, fee_amount, paid_date) VALUES (?, ?, ?)",
          [studentId, fee_amount, paid_date],
          (err) => {
            connection.release();
            if (err) {
              console.error(err);
              return res.status(500).send("Error inserting into fees table");
            }

            // Redirect if all inserts are successful
            res.redirect("/");
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
  const studentId = req.params.studentId;

  pool.getConnection((err, connection) => {
    if (err) throw err;

    // Get the current fee status
    connection.query('SELECT fees_status FROM fees WHERE student_id = ?', [studentId], (err, results) => {
      if (err) {
        connection.release();
        console.log(err);
        return res.status(500).send("Error fetching fee status");
      }

      const currentStatus = results[0].fees_status;
      const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';

      // Update the fee status in the database
      connection.query('UPDATE fees SET fees_status = ? WHERE student_id = ?', [newStatus, studentId], (err) => {
        connection.release();
        if (err) {
          console.log(err);
          return res.status(500).send("Error updating fee status");
        }
        res.redirect('/view_all.html');
      });
    });
  });
};


// Update Attendance Status
exports.updateAttendanceStatus = (req, res) => {
  const studentId = req.params.studentId;

  pool.getConnection((err, connection) => {
    if (err) throw err;

    // Get the current attendance status
    connection.query('SELECT status FROM attendance WHERE student_id = ?', [studentId], (err, results) => {
      if (err) {
        connection.release();
        console.log(err);
        return res.status(500).send("Error fetching attendance status");
      }

      const currentStatus = results[0]?.status;
      const newStatus = currentStatus === 'absent' ? 'present' : 'absent';
      const currentDate = new Date().toLocaleDateString("en-CA");


      // Update the attendance status and attendance_date
      connection.query(
        'UPDATE attendance SET status = ?, attendance_date = ? WHERE student_id = ?',
        [newStatus, currentDate, studentId],
        (err) => {
          connection.release();
          if (err) {
            console.log(err);
            return res.status(500).send("Error updating attendance status");
          }
          res.redirect('/view_all');
        }
      );
    });
  });
};



// Render form to add new student
exports.form = (req, res) => {
  res.render('add'); // This assumes you have an 'add.hbs' file in your 'views' folder
};

// Mark attendance for a specific date
exports.markAttendance = (req, res) => {
  const { studentId,  status } = req.body;
  const attendance_date = new Date().toISOString().split("T")[0];


  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = `
      INSERT INTO attendance (student_id, attendance_date, status)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `;
    connection.query(query, [studentId, attendance_date, status], (err) => {
      connection.release();
      if (err) {
        console.error(err);
        return res.status(500).send("Error marking attendance");
      }
      res.redirect("/view_all");
    });
  });
};




exports.viewAttendance = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection failed!", err);
      return res.status(500).send("Database connection failed");
    }

    // Query to fetch attendance details
    const query = `
      SELECT 
        students.name, 
        students.roll_number, 
        attendance.attendance_date, 
        attendance.status AS attendance_status
      FROM 
        students
      LEFT JOIN 
        attendance ON students.student_id = attendance.student_id
    `;

    connection.query(query, (err, rows) => {
      connection.release();
      if (err) {
        console.error("Error fetching attendance data:", err);
        return res.status(500).send("Error fetching attendance data");
      }

      // Format the attendance_date
      const formattedRows = rows.map((row) => {
        if (row.attendance_date) {
          const options = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          };
          row.attendance_date = new Date(
            row.attendance_date
          ).toLocaleDateString("en-US", options);
        } else {
          row.attendance_date = "N/A";
        }
        return row;
      });

      // Render attendance data to a view
      res.render("attendance", { rows: formattedRows });
    });
  });
};




exports.updateFeesStatus = (req, res) => {
  const { studentId, fees_status } = req.body;
  const currentDate = new Date().toISOString().split("T")[0]; 

  pool.getConnection((err, connection) => {
    if (err) throw err;

    connection.query(
      "UPDATE fees SET fees_status = ?,updated_date = ?  WHERE student_id = ?",
      [fees_status,currentDate, studentId],
      (err) => {
        connection.release();
        if (err) {
          console.error("Error updating fee status:", err);
          return res.status(500).send("Error updating fee status");
        }

        res.redirect("/update/fees-status"); // Redirect back to the form
      }
    );
  });
};



exports.getFeeStatusForm = (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;

    // Fetch all students and their fees_status
    const query = `
      SELECT 
        students.student_id, 
        students.name,
        students.roll_number,
        fees.fees_status,
        fees.updated_date AS last_updated_date
      FROM 
        students 
      LEFT JOIN 
        fees ON students.student_id = fees.student_id
    `;

    connection.query(query, (err, rows) => {
      connection.release();
      if (err) {
        console.error("Error fetching students:", err);
        return res.status(500).send("Error fetching students");
      }

      // Render the form with student data
      res.render("update_fees_status", { rows });
    });
  });
};

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

exports.generateFeeReceipt = async (req, res) => {
  const { studentId } = req.params;

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = `
      SELECT 
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

    connection.query(query, [studentId], async (err, results) => {
      connection.release();
      if (err) {
        console.error("Error fetching fee receipt:", err);
        return res.status(500).send("Error generating fee receipt");
      }

      if (results.length === 0) {
        return res.status(404).send("No receipt found for this student");
      }

      const receiptData = results[0];

      // Render the receipt as HTML
      const receiptHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Fee Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .receipt { max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
            .receipt h2 { text-align: center; }
            .receipt .details { margin-bottom: 20px; }
            .receipt .details p { margin: 5px 0; }
            .receipt .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #555; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <h2>Fee Receipt</h2>
            <div class="details">
              <p><strong>Name:</strong> ${receiptData.name}</p>
              <p><strong>Roll Number:</strong> ${receiptData.roll_number}</p>
              <p><strong>Class:</strong> ${receiptData.class}</p>
              <p><strong>Parent Contact:</strong> ${
                receiptData.parent_contact
              }</p>
              <hr>
              <p><strong>Fee Amount:</strong> ${receiptData.fee_amount}</p>
              <p><strong>Fee Status:</strong> ${receiptData.fees_status}</p>
              <p><strong>Last Updated:</strong> ${
                receiptData.updated_date || "N/A"
              }</p>
            </div>
            <div class="footer">
              <p>Thank you!</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Generate PDF using Puppeteer
      try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(receiptHtml);
        const pdfPath = path.join(
          __dirname,
          `../../public/receipts/receipt_${studentId}.pdf`
        );

        // Create receipts folder if it doesn't exist
        if (!fs.existsSync(path.dirname(pdfPath))) {
          fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
        }

        await page.pdf({ path: pdfPath, format: "A4" });
        await browser.close();

        // Send the PDF file to the user
        res.download(pdfPath, `receipt_${studentId}.pdf`, (err) => {
          if (err) {
            console.error("Error sending PDF:", err);
          }
        });
      } catch (pdfError) {
        console.error("Error generating PDF:", pdfError);
        return res.status(500).send("Error generating PDF");
      }
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
  const { weekStart } = req.query; // Example query param for the week start date

  if (!weekStart) {
    return res.status(400).send("Week start date is required.");
  }

  // Calculate week end date
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formattedStart = new Date(weekStart).toISOString().split("T")[0];
  const formattedEnd = weekEnd.toISOString().split("T")[0];

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = `
      SELECT 
        students.name, 
        students.roll_number, 
        attendance.attendance_date, 
        attendance.status 
      FROM 
        attendance 
      INNER JOIN 
        students ON attendance.student_id = students.student_id 
      WHERE 
        attendance.attendance_date BETWEEN ? AND ?
      ORDER BY attendance.attendance_date ASC
    `;

    connection.query(query, [formattedStart, formattedEnd], (error, rows) => {
      connection.release();

      if (error) {
        console.error("Error fetching weekly attendance:", error);
        return res.status(500).send("Error fetching weekly attendance");
      }

      const period = `${formattedStart} to ${formattedEnd}`;
      res.render("weekly_attendance_report", { rows, period });
    });
  });
};



const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.signup = (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("All fields are required.");
  }

  // Hash the password here
  const hashedPassword = bcrypt.hashSync(password, 10);

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    connection.query(query, [name, email, hashedPassword], (error, results) => {
      connection.release();

      if (error) {
        if (error.code === "ER_DUP_ENTRY") {
          return res.status(400).send("Email already exists.");
        }
        return res.status(500).send("Error registering user.");
      }

       res.redirect("/");
    });
  });
};


exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required.");
  }

  pool.getConnection((err, connection) => {
    if (err) throw err;

    const query = "SELECT * FROM users WHERE email = ?";
    connection.query(query, [email], (error, results) => {
      connection.release();

      if (error) {
        return res.status(500).send("Error logging in.");
      }

      if (results.length === 0) {
        return res.status(400).send("Invalid email or password.");
      }

      const user = results[0];
      const isValid = bcrypt.compareSync(password, user.password);

      if (!isValid) {
        return res.status(400).send("Invalid email or password.");
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ message: "Login successful", token });
    });
  });
};



exports.authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) return res.status(403).send("Access denied.");

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid token.");
    req.user = user;
    next();
  });
};

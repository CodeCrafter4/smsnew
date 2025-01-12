CREATE TABLE students ( student_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL, roll_number VARCHAR(20) UNIQUE NOT NULL, class VARCHAR(10) NOT NULL, parent_contact VARCHAR(15) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE fees ( fee_id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, fee_amount DECIMAL(10, 2) NOT NULL, paid_date DATE NOT NULL, status ENUM('Paid', 'Pending') DEFAULT 'Pending', FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE );
CREATE TABLE attendance ( attendance_id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, attendance_date DATE NOT NULL, status ENUM('Present', 'Absent') DEFAULT 'Absent', FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE );

CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY, 
    name VARCHAR(50) NOT NULL, 
    roll_number VARCHAR(20) UNIQUE NOT NULL,
    class VARCHAR(10) NOT NULL, 
    parent_contact VARCHAR(15) NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fees Table
CREATE TABLE fees (
    fee_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL, 
    fee_amount DECIMAL(10, 2) NOT NULL, 
    paid_date DATE NOT NULL, 
    status ENUM('Paid', 'Pending') DEFAULT 'Pending', 
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);


CREATE TABLE attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY, 
    student_id INT NOT NULL, 
    attendance_date DATE NOT NULL,
    status ENUM('Present', 'Absent') DEFAULT 'Absent',
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);
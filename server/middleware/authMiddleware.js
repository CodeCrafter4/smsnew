const jwt = require("jsonwebtoken");

exports.authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]; // Expecting 'Bearer <token>'

  if (!token) {
    return res.status(403).send("Access denied. No token provided.");
  }

  const extractedToken = token.split(" ")[1]; // Remove 'Bearer' prefix if present

  jwt.verify(extractedToken, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send("Invalid or expired token.");
    }
    req.user = user; // Store user details in request object
    next(); // Proceed to the next middleware or route
  });
};

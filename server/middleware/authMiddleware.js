const jwt = require("jsonwebtoken");

exports.authenticateToken = (req, res, next) => {
  const token = req.cookies.token; // Read the token from cookies

  if (!token) {
    return res.redirect("/login"); // Redirect to login if no token is found
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.redirect("/login"); // Redirect to login if token is invalid
    }

    req.user = user;
    next();
  });
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.MONGO_URI);
      req.user = await User.findById(decoded.user.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ msg: 'Token is not valid' });
    }
  }
  if (!token) {
    res.status(401).json({ msg: 'No token, authorization denied' });
  }
};
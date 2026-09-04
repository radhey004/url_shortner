const rateLimit = require('express-rate-limit');

const shortenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per window
  message: { error: 'Too many links created from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { shortenLimiter };
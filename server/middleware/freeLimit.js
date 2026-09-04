const Url = require('../models/Url');

const FREE_LIMIT = 2;

async function checkFreeLimit(req, res, next) {
  try {
    if (req.user) {
      return next();
    }

    const visitorId = req.cookies.visitorId;

    if (!visitorId) {
      return next();
    }

    const count = await Url.countDocuments({
      visitorId,
    });

    if (count >= FREE_LIMIT) {
      return res.status(403).json({
        error: 'FREE_LIMIT_REACHED',
        message:
          'You have used your 2 free links. Please login or sign up to continue.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkFreeLimit,
};
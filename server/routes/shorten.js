const express = require('express');
const { nanoid } = require('nanoid');
const validator = require('validator');
const crypto = require('crypto');

const Url = require('../models/Url');
const User = require('../models/User');
const { shortenLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const FREE_LIMIT = 2;

router.post('/shorten', shortenLimiter, async (req, res) => {
  try {
    const { longUrl, userId } = req.body;

    if (!longUrl || typeof longUrl !== 'string') {
      return res.status(400).json({
        error: 'longUrl is required and must be a string',
      });
    }

    if (
      !validator.isURL(longUrl, {
        require_protocol: true,
        protocols: ['http', 'https'],
      })
    ) {
      return res.status(400).json({
        error:
          'Invalid URL format — must include http:// or https://',
      });
    }

    if (longUrl.length > 2048) {
      return res.status(400).json({
        error: 'URL exceeds maximum length of 2048 characters',
      });
    }

    let visitorId = req.cookies.visitorId;

    if (!visitorId) {
      visitorId = crypto.randomUUID();

      res.cookie('visitorId', visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    let user = null;

    if (userId) {
      user = await User.findById(userId);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid user',
        });
      }
    }

    if (!user) {
      const freeCount = await Url.countDocuments({
        visitorId,
        userId: null,
      });

      if (freeCount >= FREE_LIMIT) {
        return res.status(403).json({
          error: 'FREE_LIMIT_REACHED',
          message:
            'You have used your 2 free links. Please login or sign up to continue.',
        });
      }
    }

    const shortCode = nanoid(7);

    const newUrl = new Url({
      longUrl,
      shortCode,
      userId: user ? user._id : null,
      visitorId,
    });

    await newUrl.save();

    const shortUrl = `${req.protocol}://${req.get(
      'host'
    )}/${shortCode}`;

    res.status(201).json({
      shortCode,
      shortUrl,
      longUrl,
      clicks: 0,
    });
  } catch (error) {
    console.error('Error creating short URL:', error);

    res.status(500).json({
      error: 'Something went wrong',
    });
  }
});

router.get('/urls/:userId', async (req, res) => {
  try {
    const urls = await Url.find({
      userId: req.params.userId,
    }).sort({
      createdAt: -1,
    });

    res.json(urls);
  } catch (error) {
    res.status(500).json({
      error: 'Something went wrong',
    });
  }
});

router.delete('/shorten/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.body;

    const url = await Url.findOne({
      shortCode: code,
      userId,
    });

    if (!url) {
      return res.status(404).json({
        error: 'URL not found',
      });
    }

    await Url.deleteOne({
      _id: url._id,
    });

    res.json({
      message: 'URL deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Something went wrong',
    });
  }
});

module.exports = router;
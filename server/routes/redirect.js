const express = require('express');

const Url = require('../models/Url');
const { redisClient } = require('../config/redis');

const router = express.Router();

const CACHE_TTL_SECONDS = 60 * 60 * 24;

router.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const cacheKey = `shortUrl:${shortCode}`;

    const cachedUrl = await redisClient.get(cacheKey);

    if (cachedUrl) {
      console.log('CACHE HIT');

      Url.updateOne(
        { shortCode },
        { $inc: { clicks: 1 } }
      ).catch((error) => {
        console.error(
          'Click increment failed:',
          error.message
        );
      });

      return res.redirect(302, cachedUrl);
    }

    console.log('CACHE MISS');

    const urlDoc = await Url.findOne({
      shortCode,
    });

    if (!urlDoc) {
      return res.status(404).json({
        error: 'Short URL not found',
      });
    }

    await redisClient.setEx(
      cacheKey,
      CACHE_TTL_SECONDS,
      urlDoc.longUrl
    );

    Url.updateOne(
      { shortCode },
      { $inc: { clicks: 1 } }
    ).catch((error) => {
      console.error(
        'Click increment failed:',
        error.message
      );
    });

    return res.redirect(302, urlDoc.longUrl);
  } catch (error) {
    console.error('Redirect error:', error.message);

    res.status(500).json({
      error: 'Something went wrong',
    });
  }
});

module.exports = router;
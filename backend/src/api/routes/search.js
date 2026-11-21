const express = require('express');
const { searchProducts } = require('../../search/searchService');

const router = express.Router();

router.get(['/search', '/api/search'], async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, city, page, size } = req.query;

    const parsedMinPrice = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined;
    const parsedPage = page !== undefined && page !== '' ? Number(page) : undefined;
    const parsedSize = size !== undefined && size !== '' ? Number(size) : undefined;

    const result = await searchProducts({
      q,
      category,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
      city,
      page: parsedPage,
      size: parsedSize
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ Search error:', err.message || err);
    return res.status(503).json({
      error: 'SEARCH_UNAVAILABLE',
      message: 'Search service is temporarily unavailable.'
    });
  }
});

module.exports = router;

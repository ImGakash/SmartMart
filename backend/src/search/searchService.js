const { client } = require('./client');

async function searchProducts({ q, category, minPrice, maxPrice, city, page = 1, size = 20 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, parseInt(size, 10) || 20);
  const from = (pageNum - 1) * pageSize;

  let must;
  if (q && q.trim()) {
    must = [
      {
        multi_match: {
          query: q.trim(),
          fields: ['name^3', 'brand^2', 'category', 'description'],
          fuzziness: 'AUTO',
          prefix_length: 1
        }
      }
    ];
  } else {
    must = [
      {
        match_all: {}
      }
    ];
  }

  const filter = [];

  if (category) {
    filter.push({
      term: {
        category
      }
    });
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceRange = {};
    if (minPrice !== undefined && minPrice !== null && minPrice !== '' && !isNaN(Number(minPrice))) {
      priceRange.gte = Number(minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '' && !isNaN(Number(maxPrice))) {
      priceRange.lte = Number(maxPrice);
    }
    if (Object.keys(priceRange).length > 0) {
      filter.push({
        range: {
          pricePaise: priceRange
        }
      });
    }
  }

  if (city) {
    filter.push({
      term: {
        cities: city
      }
    });
  }

  // ALWAYS include: range: { totalStock: { gt: 0 } } (Hide out-of-stock products)
  filter.push({
    range: {
      totalStock: {
        gt: 0
      }
    }
  });

  const searchParams = {
    index: process.env.OPENSEARCH_INDEX || 'smartmart-products',
    body: {
      from,
      size: pageSize,
      query: {
        bool: {
          must,
          filter
        }
      },
      highlight: {
        fields: {
          name: {},
          brand: {},
          category: {}
        }
      }
    }
  };

  const response = await client.search(searchParams);
  const raw = response.body || response;
  const total = typeof raw.hits?.total === 'object' ? raw.hits.total.value : (raw.hits?.total || 0);
  const tookMs = raw.took || 0;

  const products = (raw.hits?.hits || []).map((hit) => {
    const source = hit._source || {};
    const highlight = hit.highlight || {};
    const formattedHighlight = {};
    for (const [field, fragments] of Object.entries(highlight)) {
      formattedHighlight[field] = Array.isArray(fragments) ? fragments.join(' ') : fragments;
    }
    return {
      ...source,
      highlight: formattedHighlight,
      _score: hit._score
    };
  });

  return {
    total,
    tookMs,
    products
  };
}

module.exports = {
  searchProducts
};

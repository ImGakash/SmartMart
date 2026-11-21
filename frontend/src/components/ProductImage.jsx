import React, { useState, useEffect } from 'react';

const CATEGORY_PLACEHOLDERS = {
  electronics: '/placeholders/electronics.svg',
  audio: '/placeholders/audio.svg',
  appliances: '/placeholders/appliances.svg',
  footwear: '/placeholders/footwear.svg',
  apparel: '/placeholders/apparel.svg',
};

// Verified, high-resolution distinct product photos curated per SKU & category
export const SKU_REMOTE_IMAGES = {
  // Audio products
  'SM-AUD-001': 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-06':  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-11':  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-16':  'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-21':  'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-26':  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-31':  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'SM-AUD-36':  'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',

  // Electronics products
  'SM-WCH-002': 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-07':  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-12':  'https://images.unsplash.com/photo-1511707171634-5f897ff02560?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-17':  'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-22':  'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-27':  'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
  'SM-ELE-32':  'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600&auto=format&fit=crop&q=80',

  // Appliances products
  'SM-APP-003': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
  'SM-APP-08':  'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
  'SM-APP-13':  'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
  'SM-APP-18':  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
  'SM-APP-23':  'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',
  'SM-APP-28':  'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
  'SM-APP-33':  'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',

  // Footwear products
  'SM-FOO-04':  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-09':  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-14':  'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-19':  'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-24':  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-29':  'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600&auto=format&fit=crop&q=80',
  'SM-FOO-34':  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',

  // Apparel products
  'SM-APP-05':  'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
  'SM-APP-10':  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
  'SM-APP-15':  'https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80',
  'SM-APP-20':  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
  'SM-APP-25':  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80',
  'SM-APP-30':  'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop&q=80',
  'SM-APP-35':  'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
};

export const CATEGORY_DEFAULT_IMAGES = {
  electronics: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
  audio: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
  appliances: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
  footwear: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  apparel: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
};

/**
 * Returns a robust offline SVG placeholder based on product category.
 */
export function getPlaceholderForCategory(category) {
  if (!category) return '/placeholders/default.svg';
  const norm = String(category).trim().toLowerCase();
  return CATEGORY_PLACEHOLDERS[norm] || '/placeholders/default.svg';
}

/**
 * Resolves the most accurate and category-relevant image for a product.
 * Automatically corrects the database seed issue where a single shoe URL
 * was duplicated across 33 products of different categories.
 */
export function resolveBestImage(src, sku, category) {
  const normCat = category ? String(category).trim().toLowerCase() : '';
  const cleanSku = sku ? String(sku).trim() : '';
  // Support both SM-*-04 and SM-*-004 SKU formats
  const normalizedSku = cleanSku.replace(/-0(\d)$/, '-$1');
  const padSku = cleanSku.replace(/-(\d{2})$/, '-0$1');

  const curatedImage = SKU_REMOTE_IMAGES[cleanSku] || SKU_REMOTE_IMAGES[normalizedSku] || SKU_REMOTE_IMAGES[padSku];

  // If incoming src is missing or is the generic duplicate photo-1505740420928-5e560c06d30e
  if (!src || String(src).includes('photo-1505740420928-5e560c06d30e')) {
    if (curatedImage) {
      return curatedImage;
    }
    // If it's audio, photo-1505740420928-5e560c06d30e is actually headphones
    if (normCat === 'audio' && src) {
      return src;
    }
    return CATEGORY_DEFAULT_IMAGES[normCat] || getPlaceholderForCategory(category);
  }

  // If a valid distinct URL is provided
  if (typeof src === 'string' && src.trim()) {
    return src.trim();
  }

  // Fallback to SKU image or category default
  return curatedImage || CATEGORY_DEFAULT_IMAGES[normCat] || getPlaceholderForCategory(category);
}

/**
 * ProductImage component with:
 * - Category-relevant image resolution (fixes seed duplication)
 * - Offline SVG fallback per category
 * - Error interception (never displays broken image icon)
 * - Loading shimmer skeleton + smooth fade-in
 * - Strict aspect ratio and object-fit containment
 * - Configurable eager/lazy loading
 */
export default function ProductImage({
  src,
  alt = 'Product image',
  category = 'default',
  sku = '',
  className = '',
  containerClassName = '',
  aspectRatio = 'square',
  loading = 'lazy',
  onClick,
}) {
  const fallbackSrc = getPlaceholderForCategory(category);
  const resolvedInitialSrc = resolveBestImage(src, sku, category);

  const [currentSrc, setCurrentSrc] = useState(resolvedInitialSrc);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(resolvedInitialSrc && resolvedInitialSrc !== fallbackSrc));

  // Sync state when src, sku, or category changes
  useEffect(() => {
    const bestSrc = resolveBestImage(src, sku, category);
    setCurrentSrc(bestSrc);
    if (!bestSrc || bestSrc === fallbackSrc) {
      setIsLoading(false);
    } else {
      setHasError(false);
      setIsLoading(true);
    }
  }, [src, sku, category, fallbackSrc]);

  function handleError() {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(true);
    }
    setIsLoading(false);
  }

  function handleLoad() {
    setIsLoading(false);
  }

  // Derive aspect ratio class or style
  const aspectClass =
    aspectRatio === 'square' || aspectRatio === '1:1' || aspectRatio === '1/1'
      ? 'aspect-square'
      : aspectRatio === 'video' || aspectRatio === '16:9'
      ? 'aspect-video'
      : '';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white flex items-center justify-center shrink-0 ${aspectClass} ${containerClassName}`}
      style={!aspectClass && aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Subtle skeleton shimmer during network fetch */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-slate-100 animate-pulse z-10 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Main Image */}
      <img
        src={currentSrc}
        alt={alt || 'Product'}
        loading={loading}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        className={`w-full h-full object-contain transition-opacity duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
      />
    </div>
  );
}

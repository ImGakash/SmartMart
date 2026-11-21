import React, { useState, useEffect } from 'react';

const CATEGORY_PLACEHOLDERS = {
  electronics: '/placeholders/electronics.svg',
  audio: '/placeholders/audio.svg',
  appliances: '/placeholders/appliances.svg',
  footwear: '/placeholders/footwear.svg',
  apparel: '/placeholders/apparel.svg',
};

// Verified, high-resolution product photos curated per product type & category (all HTTP 200)
export const PRODUCT_IMAGES = {
  // Electronics
  smartwatch:   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  smartwatch2:  'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80',
  tablet:       'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
  mouse:        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
  smartphone:   'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80',
  ssd:          'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80',
  smartspeaker: 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=600&auto=format&fit=crop&q=80',
  router:       'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&auto=format&fit=crop&q=80',
  laptop:       'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80',

  // Audio
  boatAirdopes:       '/products/boat-airdopes-141.jpg',
  boatAirdopesRemote: 'https://www.boat-lifestyle.com/cdn/shop/files/AD141-FI_Black06_600x.jpg?v=1722247855',
  earbuds:            '/products/boat-airdopes-141.jpg',
  earbuds2:           'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80',
  headphones:   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  speaker:      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80',
  soundbar:     'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',

  // Appliances
  vacuum:       'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
  airfryer:     'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
  mixer:        'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
  microwave:    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
  waterheater:  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80',
  cooler:       'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80',

  // Footwear
  sneakers:     'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  airmax:       'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
  boots:        'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80',
  running:      'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=600&auto=format&fit=crop&q=80',
  loafers:      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&auto=format&fit=crop&q=80',
  clogs:        'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600&auto=format&fit=crop&q=80',

  // Apparel
  shirt:        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80',
  tshirt:       'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
  jeans:        'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80',
  kurti:        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
  trousers:     'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&auto=format&fit=crop&q=80',
  blazer:       'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80',
};

// SKU level fast map
export const SKU_REMOTE_IMAGES = {
  // Audio
  'SM-AUD-001': PRODUCT_IMAGES.earbuds,
  'SM-AUD-01':  PRODUCT_IMAGES.earbuds,
  'SM-AUD-004': PRODUCT_IMAGES.headphones,
  'SM-AUD-04':  PRODUCT_IMAGES.headphones,
  'SM-AUD-005': PRODUCT_IMAGES.speaker,
  'SM-AUD-05':  PRODUCT_IMAGES.speaker,
  'SM-AUD-006': PRODUCT_IMAGES.earbuds2,
  'SM-AUD-06':  PRODUCT_IMAGES.headphones,
  'SM-AUD-11':  PRODUCT_IMAGES.speaker,
  'SM-AUD-16':  PRODUCT_IMAGES.earbuds2,
  'SM-AUD-21':  PRODUCT_IMAGES.soundbar,
  'SM-AUD-023': PRODUCT_IMAGES.speaker,
  'SM-AUD-26':  PRODUCT_IMAGES.earbuds,
  'SM-AUD-029': PRODUCT_IMAGES.earbuds,
  'SM-AUD-31':  PRODUCT_IMAGES.headphones,
  'SM-AUD-034': PRODUCT_IMAGES.headphones,
  'SM-AUD-36':  PRODUCT_IMAGES.speaker,

  // Electronics (GUARANTEED electronics hardware photos, never fashion/shoes)
  'SM-WCH-002': PRODUCT_IMAGES.smartwatch,
  'SM-ELE-002': PRODUCT_IMAGES.smartwatch,
  'SM-ELE-02':  PRODUCT_IMAGES.smartwatch,
  'SM-ELE-007': PRODUCT_IMAGES.tablet,
  'SM-ELE-07':  PRODUCT_IMAGES.tablet,
  'SM-ELE-008': PRODUCT_IMAGES.mouse,
  'SM-ELE-08':  PRODUCT_IMAGES.mouse,
  'SM-ELE-009': PRODUCT_IMAGES.smartphone,
  'SM-ELE-09':  PRODUCT_IMAGES.smartphone,
  'SM-ELE-010': PRODUCT_IMAGES.ssd,
  'SM-ELE-10':  PRODUCT_IMAGES.ssd,
  'SM-ELE-12':  PRODUCT_IMAGES.smartphone,
  'SM-ELE-17':  PRODUCT_IMAGES.mouse,
  'SM-ELE-022': PRODUCT_IMAGES.smartwatch,
  'SM-ELE-22':  PRODUCT_IMAGES.smartwatch2,
  'SM-ELE-027': PRODUCT_IMAGES.smartspeaker,
  'SM-ELE-27':  PRODUCT_IMAGES.ssd,
  'SM-ELE-032': PRODUCT_IMAGES.router,
  'SM-ELE-32':  PRODUCT_IMAGES.router,

  // Appliances
  'SM-APP-003': PRODUCT_IMAGES.vacuum,
  'SM-APP-03':  PRODUCT_IMAGES.vacuum,
  'SM-APP-08':  PRODUCT_IMAGES.airfryer,
  'SM-APP-011': PRODUCT_IMAGES.airfryer,
  'SM-APP-012': PRODUCT_IMAGES.waterheater,
  'SM-APP-12':  PRODUCT_IMAGES.waterheater,
  'SM-APP-013': PRODUCT_IMAGES.mixer,
  'SM-APP-13':  PRODUCT_IMAGES.mixer,
  'SM-APP-18':  PRODUCT_IMAGES.microwave,
  'SM-APP-024': PRODUCT_IMAGES.waterheater,
  'SM-APP-23':  PRODUCT_IMAGES.vacuum,
  'SM-APP-028': PRODUCT_IMAGES.cooler,
  'SM-APP-28':  PRODUCT_IMAGES.cooler,
  'SM-APP-033': PRODUCT_IMAGES.microwave,
  'SM-APP-33':  PRODUCT_IMAGES.waterheater,

  // Footwear
  'SM-FOO-04':  PRODUCT_IMAGES.sneakers,
  'SM-FOO-09':  PRODUCT_IMAGES.airmax,
  'SM-FOO-14':  PRODUCT_IMAGES.boots,
  'SM-FTW-014': PRODUCT_IMAGES.running,
  'SM-FTW-015': PRODUCT_IMAGES.boots,
  'SM-FTW-016': PRODUCT_IMAGES.airmax,
  'SM-FTW-017': PRODUCT_IMAGES.running,
  'SM-FOO-19':  PRODUCT_IMAGES.running,
  'SM-FOO-24':  PRODUCT_IMAGES.loafers,
  'SM-FTW-025': PRODUCT_IMAGES.loafers,
  'SM-FOO-29':  PRODUCT_IMAGES.sneakers,
  'SM-FTW-030': PRODUCT_IMAGES.clogs,
  'SM-FOO-34':  PRODUCT_IMAGES.running,
  'SM-FTW-035': PRODUCT_IMAGES.airmax,

  // Apparel
  'SM-APP-05':  PRODUCT_IMAGES.shirt,
  'SM-APP-10':  PRODUCT_IMAGES.tshirt,
  'SM-APP-15':  PRODUCT_IMAGES.jeans,
  'SM-APP-018': PRODUCT_IMAGES.shirt,
  'SM-APP-019': PRODUCT_IMAGES.jeans,
  'SM-APP-020': PRODUCT_IMAGES.kurti,
  'SM-APP-20':  PRODUCT_IMAGES.kurti,
  'SM-APP-021': PRODUCT_IMAGES.trousers,
  'SM-APP-25':  PRODUCT_IMAGES.blazer,
  'SM-APP-026': PRODUCT_IMAGES.blazer,
  'SM-APP-30':  PRODUCT_IMAGES.trousers,
  'SM-APP-031': PRODUCT_IMAGES.tshirt,
  'SM-APP-35':  PRODUCT_IMAGES.shirt,
  'SM-APP-036': PRODUCT_IMAGES.kurti,
};

export const CATEGORY_DEFAULT_IMAGES = {
  electronics: PRODUCT_IMAGES.tablet,
  audio: PRODUCT_IMAGES.earbuds,
  appliances: PRODUCT_IMAGES.vacuum,
  footwear: PRODUCT_IMAGES.sneakers,
  apparel: PRODUCT_IMAGES.shirt,
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
 * Resolves the most accurate and category-relevant image according to product name, category, and SKU.
 * Eliminates duplicate seed images and guarantees that electronic products display true electronic
 * device images rather than apparel/fashion items.
 */
export function resolveBestImage(src, sku, category, name = '') {
  const normCat = category ? String(category).trim().toLowerCase() : '';
  const cleanSku = sku ? String(sku).trim() : '';
  const normName = String(name || '').trim().toLowerCase();

  // 1. MATCH BY SPECIFIC PRODUCT NAME (Accurate product semantic match)
  if (normName) {
    if (normName.includes('smartwatch') || normName.includes('watch') || (cleanSku && cleanSku.includes('WCH'))) {
      return PRODUCT_IMAGES.smartwatch;
    }
    if (normName.includes('ipad') || normName.includes('tablet')) {
      return PRODUCT_IMAGES.tablet;
    }
    if (normName.includes('mouse') || normName.includes('trackpad')) {
      return PRODUCT_IMAGES.mouse;
    }
    if (
      normName.includes('phone') ||
      normName.includes('smartphone') ||
      normName.includes('nord') ||
      normName.includes('5g') ||
      normName.includes('lite')
    ) {
      return PRODUCT_IMAGES.smartphone;
    }
    if (normName.includes('ssd') || normName.includes('storage') || normName.includes('sandisk')) {
      return PRODUCT_IMAGES.ssd;
    }
    if (normName.includes('echo') || normName.includes('alexa')) {
      return PRODUCT_IMAGES.smartspeaker;
    }
    if (
      normName.includes('wi-fi') ||
      normName.includes('wifi') ||
      normName.includes('mesh') ||
      normName.includes('router') ||
      normName.includes('deco')
    ) {
      return PRODUCT_IMAGES.router;
    }
    if (
      normName.includes('airdopes') ||
      normName.includes('141') ||
      cleanSku === 'SM-AUD-001' ||
      cleanSku === 'SM-AUD-01'
    ) {
      return PRODUCT_IMAGES.boatAirdopes;
    }
    if (
      normName.includes('earbuds') ||
      normName.includes('buds') ||
      normName.includes('earphone')
    ) {
      return PRODUCT_IMAGES.earbuds;
    }
    if (
      normName.includes('headphones') ||
      normName.includes('headset') ||
      normName.includes('wh-1000') ||
      normName.includes('hd 400')
    ) {
      return PRODUCT_IMAGES.headphones;
    }
    if (
      normName.includes('speaker') ||
      normName.includes('flip') ||
      normName.includes('emberton') ||
      normName.includes('soundbar')
    ) {
      return PRODUCT_IMAGES.speaker;
    }
    if (normName.includes('vacuum') || normName.includes('cleaner')) {
      return PRODUCT_IMAGES.vacuum;
    }
    if (normName.includes('air fryer') || normName.includes('fryer')) {
      return PRODUCT_IMAGES.airfryer;
    }
    if (normName.includes('mixer') || normName.includes('grinder')) {
      return PRODUCT_IMAGES.mixer;
    }
    if (
      normName.includes('water heater') ||
      normName.includes('geyser') ||
      normName.includes('shakti') ||
      normName.includes('instanio')
    ) {
      return PRODUCT_IMAGES.waterheater;
    }
    if (normName.includes('microwave') || normName.includes('oven')) {
      return PRODUCT_IMAGES.microwave;
    }
    if (normName.includes('cooler') || normName.includes('ozone')) {
      return PRODUCT_IMAGES.cooler;
    }
    if (normName.includes('running') || (normName.includes('shoe') && normName.includes('running'))) {
      return PRODUCT_IMAGES.running;
    }
    if (normName.includes('boots') || normName.includes('boot')) {
      return PRODUCT_IMAGES.boots;
    }
    if (normName.includes('sneaker') || normName.includes('walking')) {
      return PRODUCT_IMAGES.airmax;
    }
    if (normName.includes('loafers') || normName.includes('loafer')) {
      return PRODUCT_IMAGES.loafers;
    }
    if (normName.includes('clogs') || normName.includes('crocs')) {
      return PRODUCT_IMAGES.clogs;
    }
    if (normName.includes('shoes') || normName.includes('shoe') || normName.includes('footwear')) {
      return PRODUCT_IMAGES.sneakers;
    }
    if (normName.includes('t-shirt') || normName.includes('graphic print')) {
      return PRODUCT_IMAGES.tshirt;
    }
    if (normName.includes('shirt')) {
      return PRODUCT_IMAGES.shirt;
    }
    if (normName.includes('jeans') || normName.includes('denim')) {
      return PRODUCT_IMAGES.jeans;
    }
    if (normName.includes('kurta') || normName.includes('kurti') || normName.includes('saree')) {
      return PRODUCT_IMAGES.kurti;
    }
    if (normName.includes('trouser') || normName.includes('pant')) {
      return PRODUCT_IMAGES.trousers;
    }
    if (normName.includes('blazer') || normName.includes('suit')) {
      return PRODUCT_IMAGES.blazer;
    }
  }

  // 2. CHECK SKU LOOKUP
  const normalizedSku = cleanSku.replace(/-0(\d)$/, '-$1');
  const padSku = cleanSku.replace(/-(\d{2})$/, '-0$1');
  const curatedImage = SKU_REMOTE_IMAGES[cleanSku] || SKU_REMOTE_IMAGES[normalizedSku] || SKU_REMOTE_IMAGES[padSku];

  if (curatedImage) {
    // If the category is Electronics, make sure the curated image is NOT fashion/footwear
    if (normCat === 'electronics' || normName.includes('electronics')) {
      const isFashionOrFootwear = [
        PRODUCT_IMAGES.shirt,
        PRODUCT_IMAGES.tshirt,
        PRODUCT_IMAGES.jeans,
        PRODUCT_IMAGES.kurti,
        PRODUCT_IMAGES.trousers,
        PRODUCT_IMAGES.blazer,
        PRODUCT_IMAGES.sneakers,
        PRODUCT_IMAGES.airmax,
        PRODUCT_IMAGES.boots,
        PRODUCT_IMAGES.running,
        PRODUCT_IMAGES.loafers,
        PRODUCT_IMAGES.clogs,
      ].includes(curatedImage);
      if (!isFashionOrFootwear) {
        return curatedImage;
      }
    } else {
      return curatedImage;
    }
  }

  // 3. ELECTRONICS HARDWARE GUARANTEE
  // If the product belongs to Electronics, it MUST show an electronic device photo!
  if (normCat === 'electronics' || normName.includes('electronics')) {
    if (cleanSku.includes('07')) return PRODUCT_IMAGES.tablet;
    if (cleanSku.includes('12')) return PRODUCT_IMAGES.smartphone;
    if (cleanSku.includes('17')) return PRODUCT_IMAGES.mouse;
    if (cleanSku.includes('22')) return PRODUCT_IMAGES.smartwatch2;
    if (cleanSku.includes('27')) return PRODUCT_IMAGES.ssd;
    if (cleanSku.includes('32')) return PRODUCT_IMAGES.router;
    return PRODUCT_IMAGES.tablet;
  }

  // 4. If incoming src is provided and is a valid distinct image (not the duplicate seed URL)
  if (src && typeof src === 'string' && src.trim() && !src.includes('photo-1505740420928-5e560c06d30e')) {
    return src.trim();
  }

  // 5. Category fallback
  return CATEGORY_DEFAULT_IMAGES[normCat] || getPlaceholderForCategory(category);
}

/**
 * ProductImage component with:
 * - Semantic product name matching (watches, tablets, phones, audio, appliances, shoes, clothing)
 * - Strict category isolation (electronics never show fashion/shoes)
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
  name = '',
  className = '',
  containerClassName = '',
  aspectRatio = 'square',
  loading = 'lazy',
  onClick,
}) {
  const productName = name || alt;
  const fallbackSrc = getPlaceholderForCategory(category);
  const resolvedInitialSrc = resolveBestImage(src, sku, category, productName);

  const [currentSrc, setCurrentSrc] = useState(resolvedInitialSrc);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(resolvedInitialSrc && resolvedInitialSrc !== fallbackSrc));

  // Sync state when src, sku, category, or name changes
  useEffect(() => {
    const bestSrc = resolveBestImage(src, sku, category, productName);
    setCurrentSrc(bestSrc);
    if (!bestSrc || bestSrc === fallbackSrc) {
      setIsLoading(false);
    } else {
      setHasError(false);
      setIsLoading(true);
    }
  }, [src, sku, category, productName, fallbackSrc]);

  function handleError() {
    if (currentSrc === PRODUCT_IMAGES.boatAirdopes) {
      setCurrentSrc(PRODUCT_IMAGES.boatAirdopesRemote);
      return;
    }
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
      : 'aspect-square';

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center bg-slate-50/60 ${aspectClass} ${containerClassName}`}
      onClick={onClick}
    >
      {/* Loading Shimmer Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 animate-pulse z-10" />
      )}

      {/* Rendered Image */}
      <img
        src={currentSrc || fallbackSrc}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-contain p-1 transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
      />
    </div>
  );
}

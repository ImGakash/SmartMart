import React, { useState, useEffect } from 'react';

const CATEGORY_PLACEHOLDERS = {
  electronics: '/placeholders/electronics.svg',
  audio: '/placeholders/audio.svg',
  appliances: '/placeholders/appliances.svg',
  footwear: '/placeholders/footwear.svg',
  apparel: '/placeholders/apparel.svg',
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
 * ProductImage component with:
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
  className = '',
  containerClassName = '',
  aspectRatio = 'square', // 'square' (1:1), 'video' (16:9), or CSS value
  loading = 'lazy',
  onClick,
}) {
  const fallbackSrc = getPlaceholderForCategory(category);
  const initialSrc = (src && typeof src === 'string' && src.trim()) ? src.trim() : fallbackSrc;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(!src || !src.trim());
  const [isLoading, setIsLoading] = useState(Boolean(src && src.trim() && src.trim() !== fallbackSrc));

  // Sync state when src or category changes
  useEffect(() => {
    const validSrc = (src && typeof src === 'string' && src.trim()) ? src.trim() : fallbackSrc;
    setCurrentSrc(validSrc);
    if (!src || !src.trim()) {
      setHasError(true);
      setIsLoading(false);
    } else {
      setHasError(false);
      setIsLoading(validSrc !== fallbackSrc);
    }
  }, [src, category, fallbackSrc]);

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

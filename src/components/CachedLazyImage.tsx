import React, { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';

// In-memory cache to prevent multiple object URL creations for the same URL in the same session
const memoryCache = new Map<string, string>();

interface CachedLazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSeed?: string;
  style?: React.CSSProperties;
}

export default function CachedLazyImage({ src, alt, className = '', fallbackSeed, style }: CachedLazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Intersection Observer for Lazy Loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Load before it comes into view for a seamless experience
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Fetch and Cache logic
  useEffect(() => {
    if (!isInViewport || !src) return;

    let isMounted = true;
    let objectUrl: string | null = null;

    const loadImage = async () => {
      // Step A: Check In-Memory Cache first
      if (memoryCache.has(src)) {
        if (isMounted) {
          setImageSrc(memoryCache.get(src)!);
          setIsLoaded(true);
        }
        return;
      }

      // Step B: Check Cache Storage (Service Worker Cache API)
      const cacheName = 'newfriends-profile-photos-v1';
      let cacheAvailable = false;
      try {
        cacheAvailable = 'caches' in window;
      } catch (e) {
        console.warn('Cache Storage is not available in this context:', e);
      }

      if (cacheAvailable) {
        try {
          const cache = await caches.open(cacheName);
          const cachedResponse = await cache.match(src);

          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            objectUrl = URL.createObjectURL(blob);
            memoryCache.set(src, objectUrl);
            if (isMounted) {
              setImageSrc(objectUrl);
              setIsLoaded(true);
            }
            return;
          }
        } catch (err) {
          console.warn('Error reading from Cache Storage:', err);
        }
      }

      // Step C: Fetch the image and save to cache
      try {
        // Try fetching with CORS to cache the Blob
        const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        memoryCache.set(src, objectUrl);

        if (cacheAvailable) {
          try {
            const cache = await caches.open(cacheName);
            // Re-fetch or clone the response to store it
            const responseToCache = new Response(blob, {
              headers: {
                'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000',
              },
            });
            await cache.put(src, responseToCache);
          } catch (cacheWriteErr) {
            console.warn('Failed to write to Cache Storage:', cacheWriteErr);
          }
        }

        if (isMounted) {
          setImageSrc(objectUrl);
          setIsLoaded(true);
        }
      } catch (fetchErr) {
        // Step D: CORS or Network Fallback
        // If fetch fails (usually due to CORS restrictions on external images),
        // we fallback to setting the image src directly to the original URL.
        // This will let the browser load it normally without caching in Cache Storage,
        // but still benefits from standard browser HTTP cache and lazy loading!
        if (isMounted) {
          setImageSrc(src);
          // We set isLoaded to true only when the img onload fires for this fallback
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Note: We do NOT revoke the object URLs here because they might be in use
      // by other mounted instances of the image or stored in the memoryCache.
    };
  }, [isInViewport, src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
  };

  // Check if width or height are specified in className to avoid conflicts
  const hasWidth = className.split(' ').some(cls => cls.startsWith('w-'));
  const hasHeight = className.split(' ').some(cls => cls.startsWith('h-'));
  
  const sizeClasses = `${hasWidth ? '' : 'w-full'} ${hasHeight ? '' : 'h-full'}`;

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${sizeClasses} ${className}`}
      style={style}
    >
      {/* 1. Pulse Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      )}

      {/* 2. Loaded Image with Fade-in animation */}
      {isInViewport && imageSrc && !hasError && (
        <img
          src={imageSrc}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* 3. Fallback state on error or empty URL */}
      {(hasError || (!src && isInViewport)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-50 dark:bg-slate-800 text-indigo-400 dark:text-slate-500">
          {fallbackSeed ? (
            <img 
              src={`https://api.dicebear.com/9.x/notionists/svg?seed=${fallbackSeed}`} 
              alt={alt}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-10 h-10" />
          )}
        </div>
      )}
    </div>
  );
}

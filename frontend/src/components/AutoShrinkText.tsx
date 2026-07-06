import { useEffect, useState, useRef, useCallback } from 'react';

interface AutoShrinkTextProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  minScale?: number;
}

export default function AutoShrinkText({
  children,
  className = '',
  align = 'left',
  minScale = 0.25,
}: AutoShrinkTextProps) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1); // Храним актуальное значение, чтобы не зависеть от state

  const updateScale = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const containerWidth = container.clientWidth;
    const contentWidth = content.scrollWidth;

    if (containerWidth > 0 && contentWidth > 0) {
      const newScale = Math.min(1, containerWidth / contentWidth);
      const clampedScale = Math.max(minScale, newScale);

      // Обновляем только если изменение существенно (>5%)
      if (Math.abs(clampedScale - scaleRef.current) > 0.05) {
        scaleRef.current = clampedScale;
        setScale(clampedScale);
      }
    }
  }, [minScale]);

  useEffect(() => {
    const id = requestAnimationFrame(updateScale);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateScale);
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [updateScale]);

  // Сброс при смене контента — НЕ зависит от updateScale
  useEffect(() => {
    scaleRef.current = 1;
    setScale(1);
    requestAnimationFrame(updateScale);
  }, [children]); // eslint-disable-line react-hooks/exhaustive-deps

  const transformOrigin =
    align === 'center' ? 'center center' : align === 'right' ? 'right center' : 'left center';

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden flex items-center"
      style={{ height: '100%' }}
    >
      <div
        ref={contentRef}
        className={className}
        style={{
          whiteSpace: 'nowrap',
          transform: `scale(${scale})`,
          transformOrigin,
          display: 'inline-block',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
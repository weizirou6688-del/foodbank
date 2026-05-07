import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import styles from "./ImageWithFallback.module.css";
const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==";
interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackContainerClassName?: string;
  fallbackContentClassName?: string;
  centerFallback?: boolean;
}
export function ImageWithFallback({
  src,
  alt,
  style,
  className,
  onError,
  fallbackContainerClassName = styles.fallbackContainer,
  fallbackContentClassName = styles.fallbackContent,
  centerFallback = true,
  ...rest
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false);
  const fallbackWrapperProps = style ? { style } : {};
  const imageProps = style ? { ...rest, style } : rest;
  useEffect(() => {
    // 列表和轮播图常以新 src 复用同一组件实例,src 变化时重置回退状态
    setDidError(false);
  }, [src]);
  return didError ? (
    <div
      className={cn(className, fallbackContainerClassName)}
      {...fallbackWrapperProps}
    >
      {centerFallback ? (
        <div className={fallbackContentClassName}>
          <img
            src={ERROR_IMG_SRC}
            alt="Error loading image"
            {...rest}
            // 保留原始 URL 在 DOM 上,便于 QA 排查第三方图片加载失败,不在 UI 中直接暴露原始链接
            data-original-url={src}
          />
        </div>
      ) : (
        <img
          src={ERROR_IMG_SRC}
          alt="Error loading image"
          {...rest}
          // 保留原始 URL 在 DOM 上,便于 QA 排查第三方图片加载失败,不在 UI 中直接暴露原始链接
          data-original-url={src}
        />
      )}
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      {...imageProps}
      onError={(event) => {
        setDidError(true);
        onError?.(event);
      }}
    />
  );
}

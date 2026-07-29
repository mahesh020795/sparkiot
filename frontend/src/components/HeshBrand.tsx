type HeshBrandProps = {
  variant?: "full" | "compact" | "mark";
  tagline?: boolean;
  className?: string;
};

export function HeshBrand({ variant = "full", tagline = false, className = "" }: HeshBrandProps) {
  return (
    <span className={`hesh-brand hesh-brand-${variant} ${className}`.trim()} aria-label="Hesh IoT">
      <span className="hesh-circuit" data-testid="hesh-circuit" aria-hidden="true">
        <i className="hesh-rail hesh-rail-left" /><i className="hesh-rail hesh-rail-right" />
        <b className="hesh-link" /><i className="hesh-node hesh-node-left" />
        <i className="hesh-node hesh-node-center" /><i className="hesh-node hesh-node-right" />
      </span>
      {variant !== "mark" && <span className="hesh-brand-copy"><span className="hesh-wordmark"><strong>Hesh</strong><em className="hesh-word-iot">IoT</em></span>{tagline && <small>Make IoT simple.</small>}</span>}
    </span>
  );
}

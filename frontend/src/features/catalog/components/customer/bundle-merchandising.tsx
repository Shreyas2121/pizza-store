import type { BundleComponent, Product } from "../../model/catalog.types";
import { formatPaise } from "@/shared/lib";

export function BundleContents({ components, expandable = false }: { components: BundleComponent[]; expandable?: boolean }) {
  const contents = <ul className="mt-2 space-y-1 text-sm text-ink-muted" aria-label="Combo contents">{components.map((component) => <li key={component.productId}>{component.quantityPerBundle} × {component.name}{!component.isAvailable && " (currently unavailable)"}</li>)}</ul>;
  return expandable ? <details className="mt-3"><summary className="cursor-pointer font-semibold text-ink">Combo contents (per combo)</summary>{contents}</details> : <div className="mt-3"><p className="text-sm font-semibold">Combo contents</p>{contents}</div>;
}
export function BundlePrice({ product }: { product: Product }) {
  return <div>
    {product.compareAtPricePaise != null && <p className="text-sm text-ink-muted"><span className="sr-only">Regular price </span><s>{formatPaise(product.compareAtPricePaise)}</s></p>}
    <p className="mt-0.5 text-xl font-bold tabular-nums text-ink"><span className="sr-only">Combo price </span>{formatPaise(product.sellingPricePaise ?? product.pricePaise)}</p>
    {product.markdownPaise != null && product.markdownPaise > 0 && <p className="mt-1 text-sm font-semibold text-basil">Save {formatPaise(product.markdownPaise)}</p>}
  </div>;
}

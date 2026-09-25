import { productTypeTagStyle, type ProductTypeLike } from '../productTypeStyle'

type ProductTypeBadgeProps = {
  productType: ProductTypeLike
}

export function ProductTypeBadge({ productType }: ProductTypeBadgeProps) {
  return <span style={productTypeTagStyle(productType)}>{productType || '—'}</span>
}
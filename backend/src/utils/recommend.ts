export class RecommendEngine {
  coOccurrence: Record<number, Record<number, number>>;
  productCounts: Record<number, number>;

  constructor() {
    this.coOccurrence = {};
    this.productCounts = {};
  }
}

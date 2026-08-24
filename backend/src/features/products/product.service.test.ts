import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import productService from "./product.service";

describe("ProductService stock status exposure", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getProducts with storeId", () => {
    it("derives in_stock, low_stock, out_of_stock, and untracked statuses correctly and retains out-of-stock products", async () => {
      const mockDbRows = [
        {
          id: 1,
          name: "Margherita",
          slug: "margherita",
          price: 299,
          image: "img1.jpg",
          isAvailable: true,
          categoryId: 1,
          hasCustomization: true,
          veg: true,
          createdAt: new Date(),
          onHandQuantity: 15,
          lowStockThreshold: 5,
          reservedQuantity: 2, // available = 13 -> in_stock
        },
        {
          id: 2,
          name: "Farmhouse",
          slug: "farmhouse",
          price: 399,
          image: "img2.jpg",
          isAvailable: true,
          categoryId: 1,
          hasCustomization: true,
          veg: true,
          createdAt: new Date(),
          onHandQuantity: 5,
          lowStockThreshold: 5,
          reservedQuantity: 0, // available = 5 (exact threshold) -> low_stock
        },
        {
          id: 3,
          name: "Peppy Paneer",
          slug: "peppy-paneer",
          price: 349,
          image: "img3.jpg",
          isAvailable: true,
          categoryId: 1,
          hasCustomization: true,
          veg: true,
          createdAt: new Date(),
          onHandQuantity: 3,
          lowStockThreshold: 5,
          reservedQuantity: 3, // available = 0 -> out_of_stock
        },
        {
          id: 4,
          name: "Coke",
          slug: "coke",
          price: 60,
          image: "img4.jpg",
          isAvailable: true,
          categoryId: 2,
          hasCustomization: false,
          veg: true,
          createdAt: new Date(),
          onHandQuantity: null,
          lowStockThreshold: 5,
          reservedQuantity: 0, // untracked
        },
      ];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              as: () => ({}),
            }),
          }),
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                offset: () => ({
                  limit: () => ({
                    orderBy: vi.fn().mockResolvedValue(mockDbRows),
                  }),
                }),
              }),
            }),
            innerJoin: () => ({
              innerJoin: () => ({
                leftJoin: () => ({
                  where: () => ({
                    offset: () => ({
                      limit: () => ({
                        orderBy: vi.fn().mockResolvedValue(mockDbRows),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })) as any);

      const products = await productService.getProducts({ storeId: 1 });

      expect(products).toHaveLength(4);

      // Product 1: in_stock, stockCount: null
      expect(products[0]).toMatchObject({
        id: 1,
        name: "Margherita",
        stockStatus: "in_stock",
        stockCount: null,
      });

      // Product 2: low_stock (at threshold 5), stockCount: 5
      expect(products[1]).toMatchObject({
        id: 2,
        name: "Farmhouse",
        stockStatus: "low_stock",
        stockCount: 5,
      });

      // Product 3: out_of_stock, stockCount: null (retained in listing!)
      expect(products[2]).toMatchObject({
        id: 3,
        name: "Peppy Paneer",
        stockStatus: "out_of_stock",
        stockCount: null,
      });

      // Product 4: untracked, stockCount: null
      expect(products[3]).toMatchObject({
        id: 4,
        name: "Coke",
        stockStatus: "untracked",
        stockCount: null,
      });
    });
  });

  describe("getProducts without storeId (global)", () => {
    it("returns untracked stock status for global product queries", async () => {
      const mockGlobalRows = [
        {
          id: 1,
          name: "Margherita",
          slug: "margherita",
          price: 299,
          image: "img1.jpg",
          isAvailable: true,
          categoryId: 1,
          hasCustomization: true,
          veg: true,
          createdAt: new Date(),
        },
      ];

      vi.spyOn(db.query.productsTable, "findMany").mockResolvedValue(
        mockGlobalRows as any
      );

      const products = await productService.getProducts({});

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        id: 1,
        stockStatus: "untracked",
        stockCount: null,
      });
    });
  });
});

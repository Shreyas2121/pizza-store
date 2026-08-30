import { Router } from "express";
import { authenticateAdmin, authenticateUser } from "../../middleware/authenticateUser";
import { fromParam, requireStorePermission } from "../access/access.middleware";
import authorizationService, { permissionDenied } from "../access/access.service";
import { AppError, asyncHandler } from "../../utils/error";
import { parseIntegerParam, requireRouteParam } from "../../utils/request";
import type { AuthenticatedRequest } from "../../utils/types";
import {
  addDeliveryZonesSchema,
  createStoreSchema,
  managerUpdateStoreSchema,
  mapStoreProductsSchema,
  resolveStoreSchema,
  updateStoreProductSchema,
  updateStoreSchema,
} from "../../utils/zodSchema";
import storeService from "./stores.service";

export const storeRoutes = Router();

// ──────────────────────────────────────────────
// Store Management Endpoints
// ──────────────────────────────────────────────

// List stores with pagination and search (scoped by assignment for staff, all for admin)
storeRoutes.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const search = req.query.search ? (req.query.search as string) : undefined;

    let isActive: boolean | undefined = undefined;
    if (req.query.isActive !== undefined) {
      isActive = req.query.isActive === "true" || req.query.isActive === "1";
    }

    const result = await storeService.getStores({
      principal: req.principal,
      page,
      limit,
      search,
      isActive,
    });

    res.json({
      data: result.stores,
      meta: result.meta,
    });
  })
);

// Get select options for dropdowns (scoped by assignment for staff, all active for admin)
storeRoutes.get(
  "/select",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stores = await storeService.getStoresSelect(req.principal);
    res.json({ data: stores });
  })
);

// Create a new store (platform-admin only)
storeRoutes.post(
  "/",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    authorizationService.requirePlatformAdmin(
      req.principal,
      "platform.stores.create"
    );

    const validatedData = createStoreSchema.parse(req.body);
    const store = await storeService.createStore(
      {
        name: validatedData.name,
        slug: validatedData.slug,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        pincode: validatedData.pincode,
        phone: validatedData.phone,
        email: validatedData.email || null,
        latitude: validatedData.latitude ?? null,
        longitude: validatedData.longitude ?? null,
        opensAt: validatedData.opensAt,
        closesAt: validatedData.closesAt,
        isActive: validatedData.isActive ?? true,
      },
      req.principal
    );

    res.status(201).json({
      data: store,
      message: "Store created successfully",
    });
  })
);

// Resolve the active, open store serving a pincode (public)
storeRoutes.post(
  "/resolve",
  asyncHandler(async (req, res) => {
    const { pincode } = resolveStoreSchema.parse(req.body);
    const store = await storeService.resolveStore(pincode);

    res.json({ data: store });
  })
);

// ──────────────────────────────────────────────
// Store-product mapping
// ──────────────────────────────────────────────

storeRoutes.get(
  "/:id/products",
  authenticateUser,
  requireStorePermission("store.products.read", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const mappings = await storeService.getStoreProducts(storeId, req.principal);

    res.json({ data: mappings });
  })
);

storeRoutes.post(
  "/:id/products",
  authenticateUser,
  requireStorePermission("store.products.mapping.manage", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const mappings = mapStoreProductsSchema.parse(req.body);
    const storeProducts = await storeService.mapStoreProducts(
      storeId,
      mappings,
      req.principal
    );

    res.status(201).json({
      data: storeProducts,
      message: "Store products mapped successfully",
    });
  })
);

storeRoutes.put(
  "/:id/products/:productId",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const data = updateStoreProductSchema.parse(req.body);

    const mapping = await storeService.updateStoreProduct(
      storeId,
      productId,
      data,
      req.principal
    );

    res.json({
      data: mapping,
      message: "Store product updated successfully",
    });
  })
);

storeRoutes.delete(
  "/:id/products/:productId",
  authenticateUser,
  requireStorePermission("store.products.mapping.manage", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const productId = parseIntegerParam(req.params.productId, "Product ID");
    const mapping = await storeService.deleteStoreProduct(
      storeId,
      productId,
      req.principal
    );

    res.json({
      data: mapping,
      message: "Store product removed successfully",
    });
  })
);

// ──────────────────────────────────────────────
// Delivery zone management
// ──────────────────────────────────────────────

storeRoutes.get(
  "/:id/delivery-zones",
  authenticateUser,
  requireStorePermission("store.delivery_zones.read", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const zones = await storeService.getDeliveryZones(storeId, req.principal);

    res.json({ data: zones });
  })
);

storeRoutes.post(
  "/:id/delivery-zones",
  authenticateUser,
  requireStorePermission("store.delivery_zones.manage", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const { pincodes } = addDeliveryZonesSchema.parse(req.body);
    const result = await storeService.addDeliveryZones(
      storeId,
      pincodes,
      req.principal
    );

    res.status(201).json({
      data: result.zones,
      meta: {
        addedCount: result.addedCount,
        skippedCount: result.skippedCount,
      },
      message: "Delivery zones added successfully",
    });
  })
);

storeRoutes.delete(
  "/:id/delivery-zones/:zoneId",
  authenticateUser,
  requireStorePermission("store.delivery_zones.manage", fromParam("id")),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storeId = parseIntegerParam(req.params.id, "Store ID");
    const zoneId = parseIntegerParam(req.params.zoneId, "Delivery zone ID");
    const zone = await storeService.deleteDeliveryZone(
      storeId,
      zoneId,
      req.principal
    );

    res.json({
      data: zone,
      message: "Delivery zone removed successfully",
    });
  })
);

// ──────────────────────────────────────────────
// Detail Endpoints (Public)
// ──────────────────────────────────────────────

// Get store by slug
storeRoutes.get(
  "/slug/:slug",
  asyncHandler(async (req, res) => {
    const slug = requireRouteParam(req.params.slug, "Store slug");
    const store = await storeService.getStoreBySlug(slug);

    if (!store) {
      throw new AppError("Store not found", 404);
    }

    res.json({ data: store });
  })
);

// Get a single store by ID
storeRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Store ID");
    const store = await storeService.getStoreById(id);

    if (!store) {
      throw new AppError("Store not found", 404);
    }

    res.json({ data: store });
  })
);

// Update a store (platform-admin or store manager with allow-listed fields)
storeRoutes.put(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseIntegerParam(req.params.id, "Store ID");
    const isPlatformAdmin = req.principal?.platformRole === "admin";

    let validatedData: Record<string, any>;
    if (isPlatformAdmin) {
      validatedData = updateStoreSchema.parse(req.body);
    } else {
      if (req.body.slug !== undefined || req.body.isActive !== undefined) {
        throw permissionDenied();
      }
      validatedData = managerUpdateStoreSchema.parse(req.body);
    }

    const updatePayload: Record<string, any> = {};
    if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
    if (validatedData.slug !== undefined) updatePayload.slug = validatedData.slug;
    if (validatedData.address !== undefined) updatePayload.address = validatedData.address;
    if (validatedData.city !== undefined) updatePayload.city = validatedData.city;
    if (validatedData.state !== undefined) updatePayload.state = validatedData.state;
    if (validatedData.pincode !== undefined) updatePayload.pincode = validatedData.pincode;
    if (validatedData.phone !== undefined) updatePayload.phone = validatedData.phone;
    if (validatedData.email !== undefined) updatePayload.email = validatedData.email || null;
    if (validatedData.latitude !== undefined) updatePayload.latitude = validatedData.latitude;
    if (validatedData.longitude !== undefined) updatePayload.longitude = validatedData.longitude;
    if (validatedData.opensAt !== undefined) updatePayload.opensAt = validatedData.opensAt;
    if (validatedData.closesAt !== undefined) updatePayload.closesAt = validatedData.closesAt;
    if (validatedData.isActive !== undefined) updatePayload.isActive = validatedData.isActive;

    const store = await storeService.updateStore(
      id,
      updatePayload,
      req.principal
    );

    res.json({
      data: store,
      message: "Store updated successfully",
    });
  })
);

// Delete / deactivate a store (platform-admin only)
storeRoutes.delete(
  "/:id",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseIntegerParam(req.params.id, "Store ID");
    const permanent = req.query.permanent === "true";

    const result = await storeService.deleteStore(
      id,
      { permanent },
      req.principal
    );

    res.json({
      data: result,
      message: result.message,
    });
  })
);

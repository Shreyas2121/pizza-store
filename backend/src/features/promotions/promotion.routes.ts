import { Router, type Request, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticateUser } from "../../middleware/authenticateUser";
import { fromParam, requireStorePermission } from "../access/access.middleware";
import { auditHighRiskOperation } from "../audit/high-risk-audit.middleware";
import { AppError, asyncHandler } from "../../utils/error";
import { MAX_POSTGRES_INT } from "../../utils/money";
import {
  PROMOTION_AUDIT_OPERATIONS,
  PROMOTION_ERROR_CODES,
  PROMOTION_IMAGE_ALT_MAX_LENGTH,
  PROMOTION_IMAGE_MAX_BYTES,
} from "./promotion.constants";
import {
  promotionDiscoveryQuerySchema,
  promotionMediaRemovalSchema,
} from "./promotion.schemas";
import defaultService, { PromotionService } from "./promotion.service";
import { parsePromotionRequest } from "./promotion.validation";

const actor = (req: Request) => {
  if (!req.principal)
    throw new AppError(
      "Authentication required",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  return req.principal;
};
const idSchema = z.coerce.number().int().positive().max(MAX_POSTGRES_INT);
const id = (value: unknown) => {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success)
    throw new AppError(
      "Invalid promotion or store ID",
      400,
      PROMOTION_ERROR_CODES.INVALID_DEFINITION,
    );
  return parsed.data;
};
const auditStoreId = (value: unknown) => {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
// authenticateUser returns directly for missing tokens. Throw first so the
// high-risk failure auditor also persists unauthenticated mutation attempts.
const authentication = [
  asyncHandler((req, _res, next) => {
    if (
      !req.get("Authorization")?.startsWith("Bearer ") ||
      !req.get("Authorization")?.slice(7).trim()
    )
      throw new AppError(
        "Access denied, no token provided.",
        401,
        "AUTH_TOKEN_MISSING",
      );
    next();
  }),
  authenticateUser,
];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PROMOTION_IMAGE_MAX_BYTES,
    files: 1,
    fields: 2,
    // Busboy emits partsLimit when the count reaches this bound. Allow the
    // terminating boundary after three parts; files/fields enforce exact shape.
    parts: 4,
    fieldSize: PROMOTION_IMAGE_ALT_MAX_LENGTH * 4,
  },
});
const parseUpload: RequestHandler = (req, res, next) => {
  imageUpload.single("file")(req, res, (error: unknown) =>
    next(
      error
        ? new AppError(
            "Invalid promotion image upload",
            400,
            PROMOTION_ERROR_CODES.MEDIA_INVALID,
          )
        : undefined,
    ),
  );
};

export const createPromotionRoutes = (
  service: PromotionService = defaultService,
) => {
  const promotions = Router();
  const stores = Router();
  const admin: RequestHandler = asyncHandler((req, _res, next) => {
    service.requireAdmin(actor(req));
    next();
  });
  const highRisk = (
    operation: (typeof PROMOTION_AUDIT_OPERATIONS)[keyof typeof PROMOTION_AUDIT_OPERATIONS],
    creating = false,
  ) =>
    auditHighRiskOperation({
      operation,
      resourceType: "promotion",
      resourceId: (req) => (creating ? "new" : req.params.id),
    });

  promotions.get(
    "/offers",
    asyncHandler(async (req, res) => {
      const query = parsePromotionRequest(
        promotionDiscoveryQuerySchema,
        req.query,
      );
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.json({ data: await service.offers(query.storeId) });
    }),
  );
  promotions.get(
    "/featured",
    asyncHandler(async (req, res) => {
      const query = parsePromotionRequest(
        promotionDiscoveryQuerySchema,
        req.query,
      );
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.json({ data: await service.offers(query.storeId, true) });
    }),
  );
  promotions.post(
    "/",
    highRisk(PROMOTION_AUDIT_OPERATIONS.CREATE, true),
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json({ data: await service.create(actor(req), req.body) }),
    ),
  );
  promotions.get(
    "/",
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res.json({ data: await service.list(actor(req), req.query) }),
    ),
  );
  promotions.post(
    "/:id/images",
    highRisk(PROMOTION_AUDIT_OPERATIONS.MEDIA_UPLOAD),
    ...authentication,
    admin,
    parseUpload,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.uploadImage(
          actor(req),
          id(req.params.id),
          req.body,
          req.file,
        ),
      }),
    ),
  );
  promotions.delete(
    "/:id/images",
    highRisk(PROMOTION_AUDIT_OPERATIONS.MEDIA_REMOVE),
    ...authentication,
    admin,
    asyncHandler(async (req, res) => {
      const { variant } = parsePromotionRequest(
        promotionMediaRemovalSchema,
        req.body,
        PROMOTION_ERROR_CODES.MEDIA_INVALID,
      );
      res.json({
        data: await service.removeImage(actor(req), id(req.params.id), variant),
      });
    }),
  );
  promotions.get(
    "/:id/analytics",
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.getAnalytics(
          actor(req),
          id(req.params.id),
          req.query,
        ),
      }),
    ),
  );
  promotions.get(
    "/:id",
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res.json({ data: await service.get(actor(req), id(req.params.id)) }),
    ),
  );
  promotions.put(
    "/:id",
    highRisk(PROMOTION_AUDIT_OPERATIONS.UPDATE),
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.update(actor(req), id(req.params.id), req.body),
      }),
    ),
  );
  promotions.delete(
    "/:id",
    highRisk(PROMOTION_AUDIT_OPERATIONS.DEACTIVATE),
    ...authentication,
    admin,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.deactivate(actor(req), id(req.params.id)),
      }),
    ),
  );

  const manager = asyncHandler(async (req, _res, next) => {
    await service.requireManager(actor(req), id(req.params.storeId));
    next();
  });
  stores.get(
    "/:storeId/promotions",
    ...authentication,
    requireStorePermission("store.promotions.toggle", fromParam("storeId")),
    manager,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.listStore(
          actor(req),
          id(req.params.storeId),
          req.query,
        ),
      }),
    ),
  );
  stores.put(
    "/:storeId/promotions/:promotionId/setting",
    auditHighRiskOperation({
      operation: PROMOTION_AUDIT_OPERATIONS.STORE_SETTING,
      resourceType: "store_promotion_setting",
      resourceId: (req) => req.params.promotionId,
      storeId: (req) => auditStoreId(req.params.storeId),
    }),
    ...authentication,
    requireStorePermission("store.promotions.toggle", fromParam("storeId")),
    manager,
    asyncHandler(async (req, res) =>
      res.json({
        data: await service.setStoreEnabled(
          actor(req),
          id(req.params.storeId),
          id(req.params.promotionId),
          req.body,
        ),
      }),
    ),
  );
  return { promotions, stores };
};
const routes = createPromotionRoutes();
export const promotionRoutes = routes.promotions;
export const storePromotionRoutes = routes.stores;

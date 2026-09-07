import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import { authenticateAdmin } from "../../middleware/authenticateUser";
import customizeService from "./customize.service";
import { parseIntegerParam } from "../../utils/request";
import { MONEY_CAPS, parsePaise } from "../../utils/money";

export const customizationRoutes = Router();

// Group

customizationRoutes.post(
  "/group",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = req.body;
    const [group] = await customizeService.createCustomizationGroup(data);
    res.status(201).json({ data: group });
  })
);

// option

customizationRoutes.post(
  "/option",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = req.body;
    const pricePaise = parsePaise(data.pricePaise ?? 0, MONEY_CAPS.CUSTOMIZATION_PRICE, "Customization price");
    const [option] = await customizeService.createCustomizationOption({ ...data, pricePaise });
    res.status(201).json({ data: option });
  })
);

// mapping

customizationRoutes.post(
  "/mapping",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { productIds, groupId } = req.body;

    if (!Number.isInteger(groupId) || !Array.isArray(productIds)) {
      throw new AppError("A valid group and product list are required", 400);
    }

    const uniqueProductIds = [...new Set(productIds)].filter(Number.isInteger) as number[];
    await customizeService.replaceProductCustomizationGroupMappings(
      groupId,
      uniqueProductIds
    );

    res.status(200).json({ message: "Product assignments updated." });
  })
);

// Product Customization Get

customizationRoutes.get(
  "/product/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Product ID");

    const data = await customizeService.getCustomizationByProductId(id);

    res.json({ data });
  })
);

// admin all customizations

customizationRoutes.get(
  "/admin",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = await customizeService.getAllCustomizationGroups();

    const newData = data.map((group) => {
      const products = group.mapping.map((m) => m.product);
      return {
        ...group,
        mapping : null,
        products,
      };
    });

    res.json({ data: newData });
  })
);

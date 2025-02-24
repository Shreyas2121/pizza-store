import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import { authenticateAdmin } from "../../middleware/authenticeUser";
import customizeService from "./customize.service";

export const customizationRoutes = Router();

// Group

customizationRoutes.post(
  "/group",
  //   authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = req.body;
    const [group] = await customizeService.createCustomizationGroup(data);
    res.status(201).json({ data: group });
  })
);

// option

customizationRoutes.post(
  "/option",
  //   authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = req.body;
    const [option] = await customizeService.createCustomizationOption(data);
    res.status(201).json({ data: option });
  })
);

// mapping

customizationRoutes.post(
  "/mapping",
  //   authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { productIds, groupId } = req.body;

    await Promise.all(
      productIds.map((id: number) => {
        return customizeService.createProductCustomizationGroupMapping({
          productId: id,
          groupId,
        });
      })
    );

    res.status(201).json({ message: "Mapping created successfully." });
  })
);

// Product Customization Get

customizationRoutes.get(
  "/product/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!Number.isInteger(parseInt(id))) {
      throw new AppError("ID must be a number", 400);
    }

    const data = await customizeService.getCustomizationByProductId(
      parseInt(id)
    );

    res.json({ data });
  })
);

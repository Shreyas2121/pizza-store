import { PanelSkeleton } from "@/shared/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  Stack,
  Text,
} from "@mantine/core";
import { API } from "@/shared/api";
import { usePromotionAccess } from "../api/promotion.queries";
import { promotionKeys } from "../model/promotion.keys";
import {
  MONEY_CAPS,
  PROMOTION_MAX_EXPANDED_UNITS,
} from "../model/promotion.constants";
import type {
  PromotionDefinition,
  PromotionRule,
} from "../model/promotion.types";
import { PromotionDiscountEditor } from "./promotion-discount-editor";
import { IntegerField } from "./promotion-fields";

type Option = { value: string; label: string };
const Targets = ({
  label,
  ids,
  options,
  onChange,
}: {
  label: string;
  ids: number[];
  options: Option[];
  onChange: (ids: number[]) => void;
}) => {
  const known = new Set(options.map((option) => option.value));
  const data = [
    ...options,
    ...ids
      .filter((id) => !known.has(String(id)))
      .map((id) => ({
        value: String(id),
        label: `ID ${id} (not in current catalogue)`,
      })),
  ];
  return (
    <MultiSelect
      label={label}
      searchable
      data={data}
      value={ids.map(String)}
      onChange={(values) => onChange(values.map(Number))}
      nothingFoundMessage="No matching targets"
    />
  );
};
export const PromotionRulesEditor = ({
  definition,
  onChange,
}: {
  definition: PromotionDefinition;
  onChange: (rules: PromotionRule[]) => void;
}) => {
  const { admin, userId } = usePromotionAccess();
  const needsTargets =
    definition.scope === "product" || definition.scope === "category";
  const options = useQuery({
    queryKey: [...promotionKeys.principal(userId), "targets"],
    enabled: admin && needsTargets,
    queryFn: async ({ signal }) => {
      const [products, categories] = await Promise.all([
        API.get<{ data: Array<{ id: number; name: string }> }>(
          "/product/admin",
          { signal },
        ),
        API.get<{ data: Option[] }>("/category/select", { signal }),
      ]);
      return {
        products: products.data.data.map((product) => ({
          value: String(product.id),
          label: `${product.name} (#${product.id})`,
        })),
        categories: categories.data.data,
      };
    },
  });
  const products = options.data?.products ?? [];
  const categories = options.data?.categories ?? [];
  const updateRule = (index: number, value: PromotionRule) =>
    onChange(
      definition.rules.map((rule, current) =>
        current === index ? value : rule,
      ),
    );
  const bxgy = definition.rules.find((rule) => rule.type === "buy_x_get_y");
  return (
    <Stack gap="sm">
      <Text fw={700}>Targets and rules</Text>
      {needsTargets && options.isLoading && (
        <PanelSkeleton form rows={2} label="Loading catalogue targets" />
      )}
      {needsTargets && options.isError && (
        <Alert color="red">
          Catalogue targets could not be loaded.{" "}
          <Button variant="subtle" onClick={() => void options.refetch()}>
            Retry targets
          </Button>
        </Alert>
      )}
      {(definition.discount.type === "percentage" ||
        definition.discount.type === "fixed_amount") &&
        definition.scope === "product" && (
          <Targets
            label="Included products"
            ids={definition.rules.flatMap((rule) =>
              rule.type === "product_include" ? [rule.productId] : [],
            )}
            options={products}
            onChange={(ids) =>
              onChange(
                ids.map((productId) => ({
                  type: "product_include",
                  productId,
                })),
              )
            }
          />
        )}
      {(definition.discount.type === "percentage" ||
        definition.discount.type === "fixed_amount") &&
        definition.scope === "category" && (
          <Targets
            label="Included categories"
            ids={definition.rules.flatMap((rule) =>
              rule.type === "category_include" ? [rule.categoryId] : [],
            )}
            options={categories}
            onChange={(ids) =>
              onChange(
                ids.map((categoryId) => ({
                  type: "category_include",
                  categoryId,
                })),
              )
            }
          />
        )}
      {definition.discount.type === "buy_x_get_y" &&
        (bxgy ? (
          <Card withBorder>
            <Stack gap="sm">
              <Group grow>
                <IntegerField
                  label="Buy quantity"
                  required
                  min={1}
                  max={PROMOTION_MAX_EXPANDED_UNITS}
                  value={bxgy.buyQuantity}
                  onChange={(buyQuantity) =>
                    onChange([{ ...bxgy, buyQuantity }])
                  }
                />
                <IntegerField
                  label="Get quantity"
                  required
                  min={1}
                  max={PROMOTION_MAX_EXPANDED_UNITS}
                  value={bxgy.getQuantity}
                  onChange={(getQuantity) =>
                    onChange([{ ...bxgy, getQuantity }])
                  }
                />
              </Group>
              <Targets
                label="Buy products"
                ids={bxgy.buyProductIds}
                options={products}
                onChange={(buyProductIds) =>
                  onChange([{ ...bxgy, buyProductIds }])
                }
              />
              <Targets
                label="Buy categories"
                ids={bxgy.buyCategoryIds}
                options={categories}
                onChange={(buyCategoryIds) =>
                  onChange([{ ...bxgy, buyCategoryIds }])
                }
              />
              <Targets
                label="Get products"
                ids={bxgy.getProductIds}
                options={products}
                onChange={(getProductIds) =>
                  onChange([{ ...bxgy, getProductIds }])
                }
              />
              <Targets
                label="Get categories"
                ids={bxgy.getCategoryIds}
                options={categories}
                onChange={(getCategoryIds) =>
                  onChange([{ ...bxgy, getCategoryIds }])
                }
              />
            </Stack>
          </Card>
        ) : (
          <Button
            variant="light"
            onClick={() =>
              onChange([
                {
                  type: "buy_x_get_y",
                  buyQuantity: 1,
                  getQuantity: 1,
                  buyProductIds: [],
                  buyCategoryIds: [],
                  getProductIds: [],
                  getCategoryIds: [],
                },
              ])
            }
          >
            Configure buy and get targets
          </Button>
        ))}
      {definition.discount.type === "tiered" && (
        <>
          <Text size="sm">
            Each threshold must be unique. Tiers are saved in ascending
            threshold order.
          </Text>
          {definition.rules.map(
            (rule, index) =>
              rule.type === "tier" && (
                <Card key={index} withBorder>
                  <Stack gap="sm">
                    <Text fw={600}>Tier {index + 1}</Text>
                    <IntegerField
                      label={`Tier ${index + 1} minimum subtotal (paise)`}
                      min={0}
                      max={MONEY_CAPS.ORDER_AMOUNT}
                      required
                      value={rule.minimumSubtotalPaise}
                      onChange={(minimumSubtotalPaise) =>
                        updateRule(index, { ...rule, minimumSubtotalPaise })
                      }
                    />
                    <PromotionDiscountEditor
                      tier
                      label={`Tier ${index + 1} discount type`}
                      value={rule.discount}
                      onChange={(discount) => {
                        if (
                          discount.type === "percentage" ||
                          discount.type === "fixed_amount"
                        )
                          updateRule(index, { ...rule, discount });
                      }}
                    />
                    <Button
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        onChange(
                          definition.rules.filter(
                            (_, current) => current !== index,
                          ),
                        )
                      }
                    >
                      Remove tier {index + 1}
                    </Button>
                  </Stack>
                </Card>
              ),
          )}
          <Button
            variant="light"
            onClick={() =>
              onChange([
                ...definition.rules,
                {
                  type: "tier",
                  minimumSubtotalPaise: 0,
                  discount: { type: "fixed_amount", amountPaise: 0 },
                },
              ])
            }
          >
            Add tier
          </Button>
        </>
      )}
      {((definition.scope === "cart" &&
        definition.discount.type !== "tiered") ||
        definition.scope === "delivery") && (
        <Text size="sm" c="dimmed">
          This discount needs no target rules.
        </Text>
      )}
    </Stack>
  );
};

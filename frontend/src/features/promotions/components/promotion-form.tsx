import { useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { usePromotionMutations } from "../api/promotion.mutations";
import {
  defaultDiscount,
  definitionFromPromotion,
  newPromotionDefinition,
  promotionErrorCode,
  promotionErrorMessage,
  utcInputToIso,
} from "../model/promotion.helpers";
import { promotionDefinitionWriteSchema } from "../model/promotion.schemas";
import {
  MAX_POSTGRES_INT,
  MONEY_CAPS,
  PROMOTION_CODE_MAX_LENGTH,
  PROMOTION_DESCRIPTION_MAX_LENGTH,
  PROMOTION_MAX_EXPANDED_UNITS,
  PROMOTION_NAME_MAX_LENGTH,
  WEEKDAY_LABELS,
} from "../model/promotion.constants";
import type { Promotion, PromotionDefinition } from "../model/promotion.types";
import { PromotionDiscountEditor } from "./promotion-discount-editor";
import { IntegerField, NullableIntegerField } from "./promotion-fields";
import { PromotionRulesEditor } from "./promotion-rules-editor";

export const PromotionForm = ({
  promotion,
  latestVersion,
  reload,
  timezone,
  onSaved,
  onCancel,
}: {
  promotion?: Promotion;
  latestVersion?: number;
  reload?: () => Promise<Promotion | undefined>;
  timezone?: string;
  onSaved: () => void;
  onCancel: () => void;
}) => {
  const [baseline, setBaseline] = useState(promotion);
  const [definition, setDefinition] = useState<PromotionDefinition>(() =>
    promotion ? definitionFromPromotion(promotion) : newPromotionDefinition(),
  );
  const [issues, setIssues] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<unknown>();
  const [confirm, setConfirm] = useState<"reload" | "close" | null>(null);
  const [reloading, setReloading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const { save } = usePromotionMutations();
  const update = (next: PromotionDefinition) => {
    setDefinition(next);
    setDirty(true);
  };
  const stale =
    Boolean(
      baseline &&
        latestVersion !== undefined &&
        latestVersion !== baseline.definitionVersion,
    ) || promotionErrorCode(requestError) === "PROMOTION_VERSION_CONFLICT";
  const limitedScopes =
    definition.kind === "coupon" || definition.discount.type === "tiered"
      ? ["cart"]
      : definition.discount.type === "free_delivery"
      ? ["delivery"]
      : definition.discount.type === "buy_x_get_y"
      ? ["product", "category"]
      : ["cart", "product", "category"];
  const submit = async () => {
    if (save.isPending || reloading || stale) return;
    setRequestError(undefined);
    const result = promotionDefinitionWriteSchema.safeParse(definition);
    if (!result.success) {
      setIssues(
        result.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      );
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setIssues([]);
    const rules = [...result.data.rules].sort((a, b) =>
      a.type === "tier" && b.type === "tier"
        ? a.minimumSubtotalPaise - b.minimumSubtotalPaise
        : 0,
    );
    try {
      await save.mutateAsync({
        id: baseline?.id,
        version: baseline?.definitionVersion,
        definition: { ...result.data, rules },
      });
      onSaved();
    } catch (error) {
      setRequestError(error);
      requestAnimationFrame(() => summary.current?.focus());
    }
  };
  return (
    <>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Stack>
          <div
            ref={summary}
            tabIndex={-1}
            role={issues.length || requestError ? "alert" : undefined}
          >
            {!!issues.length && (
              <Alert color="red" title="Check the following fields">
                <ul>
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {requestError !== undefined && (
              <Alert color="red">{promotionErrorMessage(requestError)}</Alert>
            )}
          </div>
          {stale && (
            <Alert color="yellow" title="A newer definition is available">
              Your draft is preserved. Reload to review the latest definition
              before saving.
            </Alert>
          )}
          <fieldset
            disabled={save.isPending || reloading}
            className="m-0 min-w-0 border-0 p-0"
          >
            <Stack>
              <Group grow>
                <Select
                  label="Promotion kind"
                  required
                  allowDeselect={false}
                  value={definition.kind}
                  data={[
                    { value: "offer", label: "Automatic offer" },
                    { value: "coupon", label: "Manual coupon" },
                  ]}
                  onChange={(kind) => {
                    if (kind !== "offer" && kind !== "coupon") return;
                    const discount =
                      kind === "coupon" &&
                      !["percentage", "fixed_amount", "tiered"].includes(
                        definition.discount.type,
                      )
                        ? defaultDiscount("percentage")
                        : definition.discount;
                    update({
                      ...definition,
                      kind,
                      code: kind === "coupon" ? "" : null,
                      discount,
                      scope: kind === "coupon" ? "cart" : definition.scope,
                      rules: [],
                      display: { ...definition.display, showOnHomepage: false },
                    });
                  }}
                />
                <Checkbox
                  label="Globally active"
                  checked={definition.isActive}
                  onChange={(event) =>
                    update({
                      ...definition,
                      isActive: event.currentTarget.checked,
                    })
                  }
                />
              </Group>
              <TextInput
                label="Name"
                required
                maxLength={PROMOTION_NAME_MAX_LENGTH}
                value={definition.name}
                onChange={(event) =>
                  update({ ...definition, name: event.currentTarget.value })
                }
              />
              <Textarea
                label="Description"
                required
                minRows={2}
                maxLength={PROMOTION_DESCRIPTION_MAX_LENGTH}
                value={definition.description}
                onChange={(event) =>
                  update({
                    ...definition,
                    description: event.currentTarget.value,
                  })
                }
              />
              {definition.kind === "coupon" && (
                <TextInput
                  label="Coupon code"
                  required
                  maxLength={PROMOTION_CODE_MAX_LENGTH}
                  value={definition.code ?? ""}
                  onChange={(event) =>
                    update({ ...definition, code: event.currentTarget.value })
                  }
                  description="Trimmed and uppercased on save; entered manually by customers."
                />
              )}
              <Divider />
              <PromotionDiscountEditor
                coupon={definition.kind === "coupon"}
                value={definition.discount}
                onChange={(discount) =>
                  update({
                    ...definition,
                    discount,
                    scope:
                      discount.type === "free_delivery"
                        ? "delivery"
                        : discount.type === "buy_x_get_y"
                        ? "product"
                        : "cart",
                    includeCustomizationValue: false,
                    rules: [],
                  })
                }
              />
              <Select
                label="Scope"
                required
                allowDeselect={false}
                value={definition.scope}
                data={limitedScopes}
                description="Changing kind, discount type or scope clears the current rules."
                onChange={(scope) => {
                  if (
                    scope === "cart" ||
                    scope === "product" ||
                    scope === "category" ||
                    scope === "delivery"
                  )
                    update({ ...definition, scope, rules: [] });
                }}
              />
              {["percentage", "fixed_amount", "tiered"].includes(
                definition.discount.type,
              ) && (
                <Checkbox
                  label="Include customization value in the discount basis"
                  checked={definition.includeCustomizationValue}
                  onChange={(event) =>
                    update({
                      ...definition,
                      includeCustomizationValue: event.currentTarget.checked,
                    })
                  }
                />
              )}
              <PromotionRulesEditor
                definition={definition}
                onChange={(rules) => update({ ...definition, rules })}
              />
              <Divider label="Eligibility" />
              <Group grow>
                <IntegerField
                  label="Minimum order (paise)"
                  required
                  min={0}
                  max={MONEY_CAPS.ORDER_AMOUNT}
                  value={definition.eligibility.minimumOrderPaise}
                  onChange={(minimumOrderPaise) =>
                    update({
                      ...definition,
                      eligibility: {
                        ...definition.eligibility,
                        minimumOrderPaise,
                      },
                    })
                  }
                />
                <IntegerField
                  label="Minimum cart quantity"
                  required
                  min={0}
                  max={PROMOTION_MAX_EXPANDED_UNITS}
                  value={definition.eligibility.minimumCartQuantity}
                  onChange={(minimumCartQuantity) =>
                    update({
                      ...definition,
                      eligibility: {
                        ...definition.eligibility,
                        minimumCartQuantity,
                      },
                    })
                  }
                />
              </Group>
              <Checkbox
                label="First qualifying order only"
                checked={definition.eligibility.firstOrderOnly}
                onChange={(event) =>
                  update({
                    ...definition,
                    eligibility: {
                      ...definition.eligibility,
                      firstOrderOnly: event.currentTarget.checked,
                    },
                  })
                }
              />
              <Divider label="Schedule" />
              <Text size="sm">
                Dates below are UTC, with an exclusive end. Day/time windows use
                each participating store’s configured IANA timezone. Overnight
                windows belong to their starting weekday.
                {timezone && ` Selected store timezone: ${timezone}.`}
              </Text>
              <Group grow>
                <TextInput
                  label="Starts at (UTC)"
                  type="datetime-local"
                  step="0.001"
                  required
                  value={definition.validity.startsAt.replace(/Z$/, "")}
                  onChange={(event) =>
                    update({
                      ...definition,
                      validity: {
                        ...definition.validity,
                        startsAt: utcInputToIso(event.currentTarget.value),
                      },
                    })
                  }
                />
                <TextInput
                  label="Ends at (UTC, exclusive)"
                  type="datetime-local"
                  step="0.001"
                  required
                  value={definition.validity.endsAt.replace(/Z$/, "")}
                  onChange={(event) =>
                    update({
                      ...definition,
                      validity: {
                        ...definition.validity,
                        endsAt: utcInputToIso(event.currentTarget.value),
                      },
                    })
                  }
                />
              </Group>
              <MultiSelect
                label="Active weekdays (store local time)"
                description="Leave empty for every day."
                data={WEEKDAY_LABELS.map((label, day) => ({
                  value: String(day),
                  label,
                }))}
                value={definition.validity.activeDaysOfWeek?.map(String) ?? []}
                onChange={(values) => {
                  const days = values.flatMap((value) => {
                    switch (value) {
                      case "0":
                        return [0 as const];
                      case "1":
                        return [1 as const];
                      case "2":
                        return [2 as const];
                      case "3":
                        return [3 as const];
                      case "4":
                        return [4 as const];
                      case "5":
                        return [5 as const];
                      case "6":
                        return [6 as const];
                      default:
                        return [];
                    }
                  });
                  update({
                    ...definition,
                    validity: {
                      ...definition.validity,
                      activeDaysOfWeek: days.length ? days : null,
                    },
                  });
                }}
              />
              <Group grow>
                <TextInput
                  label="Daily start (store local time)"
                  type="time"
                  value={definition.validity.activeStartTime ?? ""}
                  onChange={(event) =>
                    update({
                      ...definition,
                      validity: {
                        ...definition.validity,
                        activeStartTime: event.currentTarget.value || null,
                      },
                    })
                  }
                />
                <TextInput
                  label="Daily end (store local time)"
                  type="time"
                  value={definition.validity.activeEndTime ?? ""}
                  onChange={(event) =>
                    update({
                      ...definition,
                      validity: {
                        ...definition.validity,
                        activeEndTime: event.currentTarget.value || null,
                      },
                    })
                  }
                />
              </Group>
              <Divider label="Limits and global budget" />
              <Group grow align="start">
                <NullableIntegerField
                  label="Per-user redemptions"
                  min={1}
                  max={MAX_POSTGRES_INT}
                  value={definition.limits.perUserRedemptions}
                  onChange={(perUserRedemptions) =>
                    update({
                      ...definition,
                      limits: { ...definition.limits, perUserRedemptions },
                    })
                  }
                />
                <NullableIntegerField
                  label="Global redemptions"
                  min={1}
                  max={MAX_POSTGRES_INT}
                  value={definition.limits.globalRedemptions}
                  onChange={(globalRedemptions) =>
                    update({
                      ...definition,
                      limits: { ...definition.limits, globalRedemptions },
                    })
                  }
                />
                <NullableIntegerField
                  label="Global budget (paise)"
                  min={1}
                  max={MAX_POSTGRES_INT}
                  value={definition.limits.budgetPaise}
                  onChange={(budgetPaise) =>
                    update({
                      ...definition,
                      limits: { ...definition.limits, budgetPaise },
                    })
                  }
                />
              </Group>
              <Divider label="Placement" />
              <IntegerField
                label="Display priority"
                min={0}
                max={MAX_POSTGRES_INT}
                required
                value={definition.display.priority}
                onChange={(priority) =>
                  update({
                    ...definition,
                    display: { ...definition.display, priority },
                  })
                }
              />
              <Checkbox
                label="Show on homepage"
                disabled={
                  definition.kind !== "offer" ||
                  !baseline?.display.imageUrl ||
                  !baseline.display.imageAlt
                }
                checked={definition.display.showOnHomepage}
                onChange={(event) =>
                  update({
                    ...definition,
                    display: {
                      ...definition.display,
                      showOnHomepage: event.currentTarget.checked,
                    },
                  })
                }
              />
              <Text size="sm" c="dimmed">
                Save with homepage placement off, then use Media to upload a
                desktop image and alt text. Reopen Edit to enable placement.
              </Text>
            </Stack>
          </fieldset>
          <Group justify="flex-end">
            <Button
              type="button"
              variant="default"
              disabled={save.isPending || reloading}
              onClick={() => (dirty ? setConfirm("close") : onCancel())}
            >
              Cancel
            </Button>
            {baseline && (
              <Button
                type="button"
                variant="light"
                disabled={save.isPending || reloading}
                onClick={() => setConfirm("reload")}
              >
                Reload latest definition
              </Button>
            )}
            <Button
              type="submit"
              loading={save.isPending}
              disabled={stale || reloading}
            >
              Save promotion
            </Button>
          </Group>
        </Stack>
      </form>
      <Modal
        opened={confirm !== null}
        onClose={() => {
          if (!reloading) setConfirm(null);
        }}
        title="Discard current draft?"
        closeOnEscape={!reloading}
        closeOnClickOutside={!reloading}
      >
        <Stack>
          <Text>
            {confirm === "reload"
              ? "Reloading replaces your draft with the latest saved definition."
              : "Your unsaved edits will be discarded."}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={reloading}
              onClick={() => setConfirm(null)}
            >
              Keep editing
            </Button>
            <Button
              color="red"
              loading={reloading}
              onClick={async () => {
                if (confirm === "close") {
                  setConfirm(null);
                  onCancel();
                  return;
                }
                setReloading(true);
                try {
                  const latest = await reload?.();
                  if (latest) {
                    setBaseline(latest);
                    setDefinition(definitionFromPromotion(latest));
                    setDirty(false);
                    setRequestError(undefined);
                    setIssues([]);
                    setConfirm(null);
                  }
                } catch (error) {
                  setRequestError(error);
                  setConfirm(null);
                } finally {
                  setReloading(false);
                }
              }}
            >
              Discard draft{confirm === "reload" ? " and reload" : ""}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

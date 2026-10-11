import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  FileInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { imageUrl } from "@/shared/config";
import { usePromotionMutations } from "../api/promotion.mutations";
import {
  PROMOTION_IMAGE_ALT_MAX_LENGTH,
  PROMOTION_IMAGE_MIMES,
  PROMOTION_DESKTOP_MIN_WIDTH,
  PROMOTION_DESKTOP_MIN_HEIGHT,
  PROMOTION_MOBILE_MIN_WIDTH,
  PROMOTION_MOBILE_MIN_HEIGHT,
  PROMOTION_IMAGE_MAX_WIDTH,
  PROMOTION_IMAGE_MAX_HEIGHT,
  PROMOTION_IMAGE_MAX_BYTES,
} from "../model/promotion.constants";
import { promotionErrorMessage } from "../model/promotion.helpers";
import { validateImageForUpload } from "../model/promotion-media";
import type { MediaVariant, Promotion } from "../model/promotion.types";

export const PromotionImageUpload = ({
  promotion,
  onClose,
}: {
  promotion: Promotion;
  onClose: () => void;
}) => {
  const [variant, setVariant] = useState<MediaVariant>("desktop");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState(promotion.display.imageAlt ?? "");
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { upload, removeImage } = usePromotionMutations();
  const pending = upload.isPending || removeImage.isPending || validating;
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const current =
    variant === "desktop"
      ? promotion.display.imageUrl
      : promotion.display.mobileImageUrl;
  const fallback =
    !current && variant === "mobile" ? promotion.display.imageUrl : null;
  const src =
    preview ??
    (current || fallback ? imageUrl(current ?? fallback) : undefined);
  return (
    <Stack>
      <Text>
        Desktop: {PROMOTION_DESKTOP_MIN_WIDTH} × {PROMOTION_DESKTOP_MIN_HEIGHT}{" "}
        minimum. Mobile: {PROMOTION_MOBILE_MIN_WIDTH} ×{" "}
        {PROMOTION_MOBILE_MIN_HEIGHT} minimum. Maximum:{" "}
        {PROMOTION_IMAGE_MAX_WIDTH} × {PROMOTION_IMAGE_MAX_HEIGHT};{" "}
        {PROMOTION_IMAGE_MAX_BYTES.toLocaleString()} bytes; JPEG, PNG or WebP.
        The server validates decoded content. Both variants share alt text.
      </Text>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <Select
        label="Image variant"
        allowDeselect={false}
        disabled={pending}
        data={[
          { value: "desktop", label: "Desktop" },
          { value: "mobile", label: "Mobile" },
        ]}
        value={variant}
        onChange={(value) => {
          if (value === "desktop" || value === "mobile") {
            setVariant(value);
            setFile(null);
            setError(null);
          }
        }}
      />
      {src ? (
        <img
          src={src}
          alt={alt.trim() || "Selected promotion image preview"}
          className="max-h-64 w-full rounded-control object-contain"
        />
      ) : (
        <Text c="dimmed">No image uploaded for this variant.</Text>
      )}
      {fallback && !file && (
        <Text size="sm">
          No mobile image: the desktop image is used as fallback.
        </Text>
      )}
      <FileInput
        label={current ? "Replacement image" : "Upload image"}
        accept={PROMOTION_IMAGE_MIMES.join(",")}
        value={file}
        onChange={(next) => {
          setFile(next);
          setError(null);
        }}
        disabled={pending}
        clearable
      />
      <TextInput
        label="Image alt text"
        required
        maxLength={PROMOTION_IMAGE_ALT_MAX_LENGTH}
        value={alt}
        onChange={(event) => setAlt(event.currentTarget.value)}
        disabled={pending}
        description="Describe the offer and relevant image content. To change alt text, upload either variant again."
      />
      <Group justify="flex-end">
        <Button variant="default" disabled={pending} onClick={onClose}>
          Close media
        </Button>
        <Button
          color="red"
          variant="light"
          disabled={!current || pending}
          onClick={() => setConfirmRemove(true)}
        >
          Remove {variant} image
        </Button>
        <Button
          loading={pending}
          disabled={!file || !alt.trim()}
          onClick={async () => {
            if (!file) return;
            setValidating(true);
            setError(null);
            try {
              const invalid = await validateImageForUpload(file, variant);
              if (invalid) {
                setError(invalid);
                return;
              }
              await upload.mutateAsync({
                id: promotion.id,
                file,
                variant,
                imageAlt: alt,
              });
              setFile(null);
            } catch (cause) {
              setError(promotionErrorMessage(cause));
            } finally {
              setValidating(false);
            }
          }}
        >
          {current ? "Replace" : "Upload"} {variant} image
        </Button>
      </Group>
      <Modal
        opened={confirmRemove}
        onClose={() => {
          if (!pending) setConfirmRemove(false);
        }}
        title={`Remove ${variant} image?`}
        closeOnEscape={!pending}
        closeOnClickOutside={!pending}
      >
        <Stack>
          <Text>
            {variant === "desktop"
              ? "Removing the desktop image also disables homepage placement."
              : "The desktop image will become the mobile fallback."}
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={pending}
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={pending}
              onClick={async () => {
                try {
                  await removeImage.mutateAsync({ id: promotion.id, variant });
                  setConfirmRemove(false);
                } catch (cause) {
                  setError(promotionErrorMessage(cause));
                  setConfirmRemove(false);
                }
              }}
            >
              Remove image
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

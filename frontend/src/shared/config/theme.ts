import { MantineColorsTuple } from "@mantine/core";

export const brandColor: MantineColorsTuple = [
  "#FDF2F0",
  "#F9E4DE",
  "#F3C5BA",
  "#E99D8F",
  "#DD6E5D",
  "#D44A37",
  "#C83E2B",
  "#A92F20",
  "#872316",
  "#64180D",
];

export const basilColor: MantineColorsTuple = [
  "#F2F8F4",
  "#E4F0E7",
  "#C3DEC9",
  "#9BC3A4",
  "#6F9E7B",
  "#4D835B",
  "#39734E",
  "#2D5C3E",
  "#21442E",
  "#162E1F",
];

export const myColor = brandColor;

export const designTokens = {
  canvas: "#F8F4EC",
  surface: "#FFFDF8",
  surfaceMuted: "#F1EADF",
  ink: "#201A17",
  inkMuted: "#6F665F",
  border: "#E5DACE",
  brand: "#C83E2B",
  brandHover: "#A92F20",
  brandSoft: "#F9E4DE",
  basil: "#39734E",
  basilSoft: "#E4F0E7",
  gold: "#D69A2D",
  danger: "#B42318",
};

import { createTheme } from "@mantine/core";

export const theme = createTheme({
  colors: {
    brand: brandColor,
    basil: basilColor,
    myColor,
  },
  primaryColor: "brand",
  fontFamily: "Inter, sans-serif",
  headings: {
    fontFamily: "Inter, sans-serif",
  },
  components: {
    Button: {
      defaultProps: {
        color: "brand",
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        color: "brand",
        radius: "md",
        size: "lg",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
        innerInput: { height: "42px" },
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    Textarea: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17" },
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    MultiSelect: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
      },
    },
    Drawer: {
      defaultProps: {
        radius: "lg",
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        verticalSpacing: "sm",
        horizontalSpacing: "md",
      },
    },
    Pagination: {
      defaultProps: {
        color: "brand",
        radius: "md",
      },
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        radius: "md",
      },
    },
    Skeleton: {
      defaultProps: {
        radius: "md",
      },
    },
    Notification: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
  },
});


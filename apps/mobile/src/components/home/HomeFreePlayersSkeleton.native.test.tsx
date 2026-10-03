/// <reference types="jest" />

import "../../lib/i18n";
import { StyleSheet } from "react-native";
import { render, type RenderResult } from "@testing-library/react-native";
import { HomeFreePlayersSkeleton } from "./HomeFreePlayersCarousel";

type Tree = ReturnType<RenderResult["toJSON"]>;
type TreeNode = Exclude<Tree, null | unknown[]>;

function flattenTree(node: Tree): TreeNode[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenTree);
  const children = (node.children ?? []).filter(
    (child: TreeNode | string): child is TreeNode => typeof child !== "string",
  );
  return [node, ...children.flatMap((child: TreeNode) => flattenTree(child))];
}

describe("HomeFreePlayersSkeleton", () => {
  it.each(["v5", "classic"] as const)(
    "draws no card shadow or outline before the cards load (%s)",
    async (layout) => {
      const view = await render(<HomeFreePlayersSkeleton layout={layout} />);

      const styles = flattenTree(view.toJSON()).map(
        (node) => StyleSheet.flatten(node.props.style) ?? {},
      );
      expect(styles.length).toBeGreaterThan(0);
      for (const style of styles) {
        expect(style.elevation ?? 0).toBe(0);
        expect(style.shadowOpacity ?? 0).toBe(0);
        if ((style.borderWidth ?? 0) > 0) {
          expect(style.borderColor).toBe("transparent");
        }
      }
    },
  );
});

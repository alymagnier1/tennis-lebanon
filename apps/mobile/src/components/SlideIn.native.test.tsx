/// <reference types="jest" />

import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { SlideIn } from "./SlideIn";

describe("SlideIn", () => {
  it("fades its content as one layer, so Android fades shadows with it", async () => {
    const view = await render(
      <SlideIn from={1}>
        <Text>Card</Text>
      </SlideIn>,
    );

    const root = view.toJSON();
    expect(root).not.toBeNull();
    expect(Array.isArray(root)).toBe(false);
    if (root && !Array.isArray(root)) {
      expect(root.props.needsOffscreenAlphaCompositing).toBe(true);
    }
  });
});

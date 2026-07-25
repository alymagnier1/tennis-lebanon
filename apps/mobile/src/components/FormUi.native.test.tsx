/// <reference types="jest" />

import { fireEvent, render } from "@testing-library/react-native";
import { PrimaryButton } from "./FormUi";

describe("PrimaryButton", () => {
  it("exposes an accessible label and invokes its action", async () => {
    const onPress = jest.fn();
    const view = await render(
      <PrimaryButton label="Continue" onPress={onPress} />,
    );

    fireEvent.press(view.getByRole("button", { name: "Continue" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not invoke its action while disabled", async () => {
    const onPress = jest.fn();
    const view = await render(
      <PrimaryButton label="Continue" onPress={onPress} disabled />,
    );

    fireEvent.press(view.getByRole("button", { name: "Continue" }));

    expect(onPress).not.toHaveBeenCalled();
  });
});

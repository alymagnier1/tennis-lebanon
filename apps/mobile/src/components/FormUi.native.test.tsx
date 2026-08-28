/// <reference types="jest" />

import "../lib/i18n";
import { fireEvent, render } from "@testing-library/react-native";
import { Choice, PrimaryButton } from "./FormUi";

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

describe("Choice", () => {
  // It announced "checkbox" for a set where picking one clears the last, so a
  // screen-reader user was told they could select several and then lost the
  // answer they had already given.
  it("announces a single-choice option as a radio", async () => {
    const view = await render(
      <Choice label="Spam or solicitation" selected onPress={() => {}} />,
    );

    expect(
      view.getByRole("radio", { name: "Spam or solicitation" }),
    ).toBeTruthy();
  });

  it("stays a checkbox where several answers are allowed", async () => {
    const view = await render(
      <Choice label="Evenings" selected={false} onPress={() => {}} multiple />,
    );

    expect(view.getByRole("checkbox", { name: "Evenings" })).toBeTruthy();
  });

  it("reports whether it is chosen, and acts when pressed", async () => {
    const onPress = jest.fn();
    const view = await render(
      <Choice label="Spam or solicitation" selected onPress={onPress} />,
    );

    const option = view.getByRole("radio", { name: "Spam or solicitation" });
    expect(option.props.accessibilityState.checked).toBe(true);

    fireEvent.press(option);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

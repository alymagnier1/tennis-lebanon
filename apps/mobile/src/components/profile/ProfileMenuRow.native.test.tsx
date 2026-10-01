/// <reference types="jest" />

import "../../lib/i18n";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ProfileMenuRow } from "./ProfileMenuRow";

describe("ProfileMenuRow", () => {
  it("is a button when it does something", async () => {
    const onPress = jest.fn();
    const view = await render(
      <ProfileMenuRow
        icon={<Text>i</Text>}
        label="Notifications"
        subtitle="On"
        onPress={onPress}
      />,
    );

    fireEvent.press(view.getByRole("button", { name: "Notifications. On" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is information only without an action: no button to press", async () => {
    const view = await render(
      <ProfileMenuRow
        icon={<Text>i</Text>}
        label="Signed in with Google"
        subtitle="player@example.com"
      />,
    );

    expect(view.queryByRole("button")).toBeNull();
    expect(
      view.getByLabelText("Signed in with Google. player@example.com"),
    ).toBeTruthy();
  });
});

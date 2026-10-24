/// <reference types="jest" />

import "../../lib/i18n";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { NotificationCard } from "./NotificationCard";

const base = {
  title: "You're in!",
  body: "The host accepted you. Tap for time and place.",
  time: "21:30",
  look: { icon: "checkMark", tone: "good" } as const,
};

describe("NotificationCard", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reads as unread, with its title, line and time", async () => {
    const onPress = jest.fn();
    const view = await render(
      <NotificationCard {...base} unread onPress={onPress} />,
    );

    const card = view.getByRole("button", {
      name: "Unread. You're in! The host accepted you. Tap for time and place. 21:30.",
    });
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByText("21:30")).toBeTruthy();
  });

  it("drops the unread label once read", async () => {
    const view = await render(
      <NotificationCard {...base} unread={false} onPress={() => {}} />,
    );

    expect(
      view.getByRole("button", {
        name: "You're in! The host accepted you. Tap for time and place. 21:30.",
      }),
    ).toBeTruthy();
  });
});

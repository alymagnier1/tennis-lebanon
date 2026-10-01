/// <reference types="jest" />

import "../../lib/i18n";
import { fireEvent, render } from "@testing-library/react-native";
import type { HomeNextAction } from "../../lib/home-next-actions";
import { HomeTodoCard } from "./HomeTodoCard";

const vote: HomeNextAction = {
  id: "vote-1",
  kind: "vote",
  titleKey: "home.nextAction.voteTitle",
  bodyKey: "home.nextAction.voteBody",
  matchId: "m1",
};
const court: HomeNextAction = {
  id: "court-2",
  kind: "court",
  titleKey: "home.nextAction.courtTitle",
  bodyKey: "home.nextAction.courtBody",
  matchId: "m2",
};
const played: HomeNextAction = {
  id: "played-3",
  kind: "played",
  titleKey: "home.nextAction.playedTitle",
  bodyKey: "home.nextAction.playedBody",
  matchId: "m3",
};

describe("HomeTodoCard", () => {
  it("shows the first to-do in full and counts the rest", async () => {
    const onPress = jest.fn();
    const onMore = jest.fn();
    const view = await render(
      <HomeTodoCard
        actions={[vote, court, played]}
        factsFor={() => "Sat 12, 6:30 PM · JDK"}
        onPress={onPress}
        onMore={onMore}
      />,
    );

    expect(view.getByText("Vote on a time")).toBeTruthy();
    expect(view.getByText("Sat 12, 6:30 PM · JDK")).toBeTruthy();
    expect(view.queryByText("Ready to book a court")).toBeNull();
    expect(view.getByText("2 more to do")).toBeTruthy();

    await fireEvent.press(
      view.getByLabelText("Vote on a time. Sat 12, 6:30 PM · JDK"),
    );
    expect(onPress).toHaveBeenCalledWith(vote);

    await fireEvent.press(
      view.getByLabelText("2 more to do. Opens your matches."),
    );
    expect(onMore).toHaveBeenCalled();
  });

  it("falls back to the body copy and omits the count for a single to-do", async () => {
    const view = await render(
      <HomeTodoCard
        actions={[vote]}
        factsFor={() => null}
        onPress={() => {}}
        onMore={() => {}}
      />,
    );

    expect(
      view.getByText("Your group still needs to agree on when to play."),
    ).toBeTruthy();
    expect(view.queryByText(/more to do/)).toBeNull();
  });

  it("renders nothing without to-dos", async () => {
    const view = await render(
      <HomeTodoCard
        actions={[]}
        factsFor={() => null}
        onPress={() => {}}
        onMore={() => {}}
      />,
    );
    expect(view.toJSON()).toBeNull();
  });
});

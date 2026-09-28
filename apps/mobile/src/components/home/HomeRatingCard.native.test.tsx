/// <reference types="jest" />

import "../../lib/i18n";
import { fireEvent, render } from "@testing-library/react-native";
import { HomeRatingCard } from "./HomeRatingCard";

const base = {
  remaining: 5,
  ratingValue: "—",
  awaitingScore: 0,
  onExplain: () => {},
  onOpenAwaitingScore: () => {},
};

describe("HomeRatingCard", () => {
  it("shows progress to an unlocked rating as a progress bar of confirmed results", async () => {
    const view = await render(
      <HomeRatingCard
        {...base}
        provisional
        ratedMatchCount={3}
        remaining={2}
      />,
    );

    const bar = view.getByRole("progressbar");
    expect(bar.props.accessibilityValue).toMatchObject({
      min: 0,
      max: 5,
      now: 3,
    });
    expect(view.getByText("3 of 5 confirmed results")).toBeTruthy();
  });

  it("reads as progress even at zero", async () => {
    const view = await render(
      <HomeRatingCard {...base} provisional ratedMatchCount={0} />,
    );

    expect(
      view.getByRole("progressbar").props.accessibilityValue,
    ).toMatchObject({ now: 0, max: 5 });
  });

  it("opens the explainer from its heading", async () => {
    const onExplain = jest.fn();
    const view = await render(
      <HomeRatingCard
        {...base}
        provisional
        ratedMatchCount={0}
        onExplain={onExplain}
      />,
    );

    fireEvent.press(
      view.getByRole("button", {
        name: "Your rating, 0 of 5 confirmed results",
      }),
    );

    expect(onExplain).toHaveBeenCalledTimes(1);
  });

  it("links to matches waiting for a score only when there are some", async () => {
    const onOpen = jest.fn();
    const none = await render(
      <HomeRatingCard {...base} provisional ratedMatchCount={1} />,
    );
    expect(
      none.queryByRole("button", { name: "See matches waiting for a score" }),
    ).toBeNull();

    const some = await render(
      <HomeRatingCard
        {...base}
        provisional
        ratedMatchCount={1}
        awaitingScore={2}
        onOpenAwaitingScore={onOpen}
      />,
    );
    fireEvent.press(
      some.getByRole("button", { name: "See matches waiting for a score" }),
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("collapses to one row with the number once the rating is visible", async () => {
    const view = await render(
      <HomeRatingCard
        {...base}
        provisional={false}
        ratedMatchCount={12}
        remaining={0}
        ratingValue="1,420"
      />,
    );

    expect(view.queryByRole("progressbar")).toBeNull();
    expect(
      view.getByRole("button", { name: "Your rating, 1,420" }),
    ).toBeTruthy();
  });
});

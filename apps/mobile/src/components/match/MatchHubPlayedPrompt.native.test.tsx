/// <reference types="jest" />

import "../../lib/i18n";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { MatchHubPlayedPrompt } from "./MatchHubPlayedPrompt";

describe("MatchHubPlayedPrompt", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("takes no second answer while one is being saved", async () => {
    const onPlayed = jest.fn();
    const onNotPlayed = jest.fn();
    const view = await render(
      <MatchHubPlayedPrompt
        pending="played"
        onPlayed={onPlayed}
        onNotPlayed={onNotPlayed}
      />,
    );

    // The testing library treats an inactive button as hidden, so it has to
    // be asked for explicitly; pressing it must still do nothing.
    fireEvent.press(
      view.getByText(/No, it didn/, { includeHiddenElements: true }),
    );
    expect(onNotPlayed).not.toHaveBeenCalled();
  });

  it("asks whether the match happened, with an answer for each case", async () => {
    const onPlayed = jest.fn();
    const onNotPlayed = jest.fn();
    const view = await render(
      <MatchHubPlayedPrompt
        pending={null}
        onPlayed={onPlayed}
        onNotPlayed={onNotPlayed}
      />,
    );

    expect(
      view.getByRole("header", { name: "Did this match happen?" }),
    ).toBeTruthy();

    fireEvent.press(view.getByRole("button", { name: "Yes, we played" }));
    expect(onPlayed).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByRole("button", { name: "No, it didn't happen" }));
    expect(onNotPlayed).toHaveBeenCalledTimes(1);
  });
});

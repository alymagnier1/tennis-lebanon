/// <reference types="jest" />

import { act, render } from "@testing-library/react-native";
import { BackHandler, Text } from "react-native";
import { AppOverlay, OverlayProvider } from "./OverlayProvider";

/**
 * Records back listeners and replays a press the way Android does: newest
 * listener first, stopping at the first that handles it.
 */
let backListeners: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  backListeners = [];
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      backListeners.push(listener);
      return {
        remove: () => {
          backListeners = backListeners.filter((item) => item !== listener);
        },
      };
    });
});
afterEach(() => jest.restoreAllMocks());

const pressBack = () => {
  for (const listener of [...backListeners].reverse()) {
    if (listener()) return;
  }
};

function Screen({
  sheet,
  dialog,
  onCloseSheet = () => {},
  onCloseDialog = () => {},
}: {
  sheet: boolean;
  dialog?: boolean;
  onCloseSheet?: () => void;
  onCloseDialog?: () => void;
}) {
  return (
    <OverlayProvider>
      <Text>The app</Text>
      <AppOverlay visible={sheet} onRequestClose={onCloseSheet}>
        <Text>Sheet</Text>
      </AppOverlay>
      <AppOverlay visible={Boolean(dialog)} onRequestClose={onCloseDialog}>
        <Text>Dialog</Text>
      </AppOverlay>
    </OverlayProvider>
  );
}

describe("OverlayProvider", () => {
  it("draws a popup only while it is visible", async () => {
    const view = await render(<Screen sheet={false} />);
    expect(view.queryByText("Sheet")).toBeNull();

    await view.rerender(<Screen sheet />);
    expect(view.getByText("Sheet")).toBeTruthy();

    await view.rerender(<Screen sheet={false} />);
    expect(view.queryByText("Sheet")).toBeNull();
  });

  it("hides the app from screen readers while a popup is open, as a Modal's window did", async () => {
    const view = await render(<Screen sheet={false} />);
    expect(view.getByText("The app")).toBeTruthy();

    await view.rerender(<Screen sheet />);
    expect(view.queryByText("The app")).toBeNull();
    expect(
      view.getByText("The app", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("sends Android back to the newest popup first", async () => {
    const onCloseSheet = jest.fn();
    const onCloseDialog = jest.fn();
    const view = await render(
      <Screen
        sheet
        onCloseSheet={onCloseSheet}
        onCloseDialog={onCloseDialog}
      />,
    );
    await view.rerender(
      <Screen
        sheet
        dialog
        onCloseSheet={onCloseSheet}
        onCloseDialog={onCloseDialog}
      />,
    );

    await act(async () => pressBack());

    expect(onCloseDialog).toHaveBeenCalledTimes(1);
    expect(onCloseSheet).not.toHaveBeenCalled();
  });

  it("draws in place outside a provider", async () => {
    const view = await render(
      <AppOverlay visible>
        <Text>Alone</Text>
      </AppOverlay>,
    );
    expect(view.getByText("Alone")).toBeTruthy();
  });
});

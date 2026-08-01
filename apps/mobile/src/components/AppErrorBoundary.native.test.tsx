/// <reference types="jest" />

import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { AppErrorBoundary } from "./AppErrorBoundary";

jest.mock("../lib/sentry", () => ({
  reportError: jest.fn(() => Promise.resolve()),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

function Boom(): never {
  throw new Error("render exploded");
}

describe("AppErrorBoundary", () => {
  const consoleError = console.error;

  beforeAll(() => {
    // React logs the caught error itself; silence it so a passing run is not
    // full of red that looks like a failure.
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = consoleError;
  });

  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("renders children when nothing throws", async () => {
    const view = await render(
      <AppErrorBoundary>
        <Text>All good</Text>
      </AppErrorBoundary>,
    );

    expect(view.getByText("All good")).toBeTruthy();
  });

  it("shows a recoverable fallback instead of a blank screen", async () => {
    const view = await render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(view.getByText("Something went wrong")).toBeTruthy();
    expect(view.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("reports the error so the crash is not silent", async () => {
    const { reportError } = jest.requireMock("../lib/sentry") as {
      reportError: jest.Mock;
    };
    reportError.mockClear();

    await render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledTimes(1);
  });
});

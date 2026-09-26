import { describe, expect, it } from "vitest";
import appJson from "../../app.json";
import {
  DEFAULT_ABIS,
  setReactNativeArchitectures,
} from "../../plugins/with-android-abis";

type GradleProperty = { type: string; key?: string; value?: string };

const template: GradleProperty[] = [
  { type: "comment", value: "Project-wide Gradle settings." },
  { type: "property", key: "org.gradle.jvmargs", value: "-Xmx2048m" },
  {
    type: "property",
    key: "reactNativeArchitectures",
    value: "armeabi-v7a,arm64-v8a,x86,x86_64",
  },
  { type: "property", key: "hermesEnabled", value: "true" },
];

describe("with-android-abis", () => {
  it("builds ARM only by default: no x86 or x86_64 in the APK", () => {
    expect(DEFAULT_ABIS).toEqual(["armeabi-v7a", "arm64-v8a"]);
  });

  it("replaces the template's four CPU types instead of adding a second line", () => {
    const result = setReactNativeArchitectures(template, DEFAULT_ABIS);
    const lines = result.filter(
      (item) => item.key === "reactNativeArchitectures",
    );

    expect(lines).toEqual([
      {
        type: "property",
        key: "reactNativeArchitectures",
        value: "armeabi-v7a,arm64-v8a",
      },
    ]);
  });

  it("leaves every other Gradle property alone", () => {
    const result = setReactNativeArchitectures(template, DEFAULT_ABIS);

    expect(
      result.filter((item) => item.key !== "reactNativeArchitectures"),
    ).toEqual(
      template.filter((item) => item.key !== "reactNativeArchitectures"),
    );
  });

  it("adds the property when the template has none", () => {
    const result = setReactNativeArchitectures(
      [{ type: "property", key: "hermesEnabled", value: "true" }],
      ["arm64-v8a"],
    );

    expect(result).toContainEqual({
      type: "property",
      key: "reactNativeArchitectures",
      value: "arm64-v8a",
    });
  });

  it("refuses an empty list rather than building an APK with no native code", () => {
    expect(() => setReactNativeArchitectures(template, [])).toThrow(
      /at least one ABI/,
    );
  });

  it("is registered in app.json, so EAS builds apply it", () => {
    expect(appJson.expo.plugins).toContain("./plugins/with-android-abis");
  });
});

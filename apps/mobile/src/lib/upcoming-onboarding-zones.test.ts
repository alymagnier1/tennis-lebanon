import { describe, expect, it } from "vitest";
import { upcomingZonesToShow } from "./upcoming-onboarding-zones";

describe("upcomingZonesToShow", () => {
  it("shows both coming-soon cities when the API only has Beirut", () => {
    expect(upcomingZonesToShow(["Beirut"]).map((zone) => zone.id)).toEqual([
      "upcoming-tripoli",
      "upcoming-saida",
    ]);
  });

  it("drops a tile once that city is a live zone", () => {
    expect(
      upcomingZonesToShow(["Beirut", "Tripoli"]).map((zone) => zone.id),
    ).toEqual(["upcoming-saida"]);
  });
});

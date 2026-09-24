import { describe, expect, it } from "vitest";
import { getSquareCropSource } from "./image-crop";

describe("getSquareCropSource", () => {
  it("centres a square crop by default", () => {
    expect(getSquareCropSource(1200, 800, 1, 0, 0)).toEqual({
      sx: 200,
      sy: 0,
      sw: 800,
      sh: 800,
    });
  });

  it("zooms while keeping the crop inside the image", () => {
    expect(getSquareCropSource(1200, 800, 2, 0, 0)).toEqual({
      sx: 400,
      sy: 200,
      sw: 400,
      sh: 400,
    });
  });

  it("clamps positioning offsets to the source bounds", () => {
    expect(getSquareCropSource(800, 1200, 1, -4, 4)).toEqual({
      sx: 0,
      sy: 400,
      sw: 800,
      sh: 800,
    });
  });
});

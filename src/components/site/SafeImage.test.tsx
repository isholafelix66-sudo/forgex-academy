import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SafeImage } from "./SafeImage";

afterEach(cleanup);

describe("SafeImage", () => {
  it("renders the image when src is present", () => {
    render(
      <SafeImage
        src="https://example.com/pic.jpg"
        alt="avatar"
        fallback={<div>fallback</div>}
      />,
    );
    const img = screen.getByAltText("avatar");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
  });

  it("renders the fallback when src is missing", () => {
    render(<SafeImage src={null} alt="avatar" fallback={<div>fallback</div>} />);
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByAltText("avatar")).not.toBeInTheDocument();
  });

  it("swaps to the fallback when the image fails to load", () => {
    render(
      <SafeImage
        src="https://example.com/broken.jpg"
        alt="avatar"
        fallback={<div>fallback</div>}
      />,
    );
    const img = screen.getByAltText("avatar");
    fireEvent.error(img);
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByAltText("avatar")).not.toBeInTheDocument();
  });

  it("resets the failed state when src changes", () => {
    const { rerender } = render(
      <SafeImage
        src="https://example.com/broken.jpg"
        alt="avatar"
        fallback={<div>fallback</div>}
      />,
    );
    const img = screen.getByAltText("avatar");
    fireEvent.error(img);
    expect(screen.getByText("fallback")).toBeInTheDocument();

    rerender(
      <SafeImage
        src="https://example.com/recovered.jpg"
        alt="avatar"
        fallback={<div>fallback</div>}
      />,
    );
    expect(screen.getByAltText("avatar")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("forwards extra image attributes", () => {
    const onLoad = vi.fn();
    render(
      <SafeImage
        src="https://example.com/pic.jpg"
        alt="avatar"
        loading="lazy"
        onLoad={onLoad}
      />,
    );
    const img = screen.getByAltText("avatar");
    fireEvent.load(img);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

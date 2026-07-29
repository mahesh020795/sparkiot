import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeshBrand } from "./HeshBrand";

afterEach(cleanup);

describe("HeshBrand", () => {
  it("renders the accessible Hesh IoT identity and optional tagline", () => {
    render(<HeshBrand tagline />);

    expect(screen.getByRole("img", { name: "Hesh IoT" })).toBeInTheDocument();
    expect(screen.getByText("Hesh")).toBeInTheDocument();
    expect(screen.getByText("IoT")).toHaveClass("hesh-word-iot");
    expect(screen.getByText("Make IoT simple.")).toBeInTheDocument();
    expect(screen.getByTestId("hesh-circuit")).toHaveAttribute("aria-hidden", "true");
  });

  it("gives the textless mark variant an accessible image name", () => {
    render(<HeshBrand variant="mark" />);

    expect(screen.getByRole("img", { name: "Hesh IoT" })).toBeInTheDocument();
    expect(screen.queryByText("Hesh")).not.toBeInTheDocument();
  });
});

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeshBrand } from "./HeshBrand";

describe("HeshBrand", () => {
  it("renders the accessible Hesh IoT identity and optional tagline", () => {
    render(<HeshBrand tagline />);

    expect(screen.getByLabelText("Hesh IoT")).toBeInTheDocument();
    expect(screen.getByText("Hesh")).toBeInTheDocument();
    expect(screen.getByText("IoT")).toHaveClass("hesh-word-iot");
    expect(screen.getByText("Make IoT simple.")).toBeInTheDocument();
    expect(screen.getByTestId("hesh-circuit")).toHaveAttribute("aria-hidden", "true");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../src/services/apiClient";
import { Login } from "../src/features/auth/Login";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  app: {
    signIn: vi.fn(),
    isAuthenticated: false,
    showToast: vi.fn(),
    theme: "light" as const,
    toggleTheme: vi.fn(),
  },
}));

vi.mock("../src/app/AppProvider", () => ({
  useApp: () => mocks.app,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: () => ({ state: { from: "/patients" } }),
    useNavigate: () => mocks.navigate,
  };
});

describe("Login", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.app.signIn.mockReset();
    mocks.app.signIn.mockResolvedValue(undefined);
    mocks.app.showToast.mockReset();
    mocks.app.toggleTheme.mockReset();
    mocks.app.isAuthenticated = false;
    mocks.app.theme = "light";
  });

  it("submits credentials and redirects to the intended route", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mocks.app.signIn).toHaveBeenCalledWith("admin@stjude.local", "Password123!");
      expect(mocks.navigate).toHaveBeenCalledWith("/patients");
    });
  });

  it("shows friendly network errors and notifies through toast", async () => {
    const user = userEvent.setup();
    const error = new ApiError("Network connection failed", { code: "network" });
    mocks.app.signIn.mockRejectedValueOnce(error);

    render(<Login />);
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    const message = "Cannot reach the server. Check your connection and try again.";
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mocks.app.showToast).toHaveBeenCalledWith(message, "error");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("supports demo shortcuts, password reveal, and the theme toggle", async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole("button", { name: /staff/i }));
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe("staff@stjude.local");

    const password = screen.getByPlaceholderText("Enter your password");
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password.getAttribute("type")).toBe("text");

    await user.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(mocks.app.toggleTheme).toHaveBeenCalledTimes(1);
  });
});

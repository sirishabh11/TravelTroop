import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import CreateTrip from "./CreateTrip";
import { createTrip } from "../lib/api";
vi.mock("../lib/api", () => ({
  createTrip: vi.fn(),
  errorMessage: (e: Error) => e.message,
}));
function renderForm() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CreateTrip />} />
        <Route path="/trips/:id" element={<p>Saved dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
function fillForm() {
  fireEvent.change(screen.getByLabelText("Trip name"), {
    target: { value: "Goa with friends" },
  });
  fireEvent.change(screen.getByLabelText("Destination"), {
    target: { value: "Goa" },
  });
  fireEvent.change(screen.getByLabelText("Departure"), {
    target: { value: "2027-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Return"), {
    target: { value: "2027-01-03" },
  });
  fireEvent.change(screen.getByLabelText("Estimated per-person cost · INR"), {
    target: { value: "12000" },
  });
}
it("blocks an invalid form before calling the backend", async () => {
  renderForm();
  fireEvent.click(screen.getByRole("button", { name: /Create trip & get/ }));
  expect(await screen.findByText(/Enter a trip name/)).toBeVisible();
  expect(createTrip).not.toHaveBeenCalled();
});
it("saves normalized data and opens the created dashboard", async () => {
  vi.mocked(createTrip).mockResolvedValue("created-id");
  renderForm();
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: /Create trip & get/ }));
  expect(await screen.findByText("Saved dashboard")).toBeVisible();
  expect(createTrip).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Goa with friends",
      invitees: [],
      options: [
        {
          destination: "Goa",
          start_date: "2027-01-01",
          end_date: "2027-01-03",
          estimated_cost: 12000,
        },
      ],
    }),
  );
});
it("shows backend errors without claiming a trip was saved", async () => {
  vi.mocked(createTrip).mockRejectedValue(new Error("Database unavailable"));
  renderForm();
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: /Create trip & get/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Database unavailable",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Create trip & get/ }),
    ).toBeEnabled(),
  );
  expect(screen.queryByText("Saved dashboard")).not.toBeInTheDocument();
});
it("adds and removes proposed travel options", () => {
  renderForm();
  fireEvent.click(screen.getByRole("button", { name: "+ Add travel option" }));
  expect(screen.getAllByLabelText("Destination")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Remove option 2" }));
  expect(screen.getAllByLabelText("Destination")).toHaveLength(1);
});

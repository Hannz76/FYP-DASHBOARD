import React, { useState } from "react";
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CareerRecommendations from "@/components/CareerRecommendations";

const job = (jobId, title, postedAt = "2026-01-01T00:00:00Z") => ({ jobId, title, company: "Fixture Employer", location: "Selangor", salary: "Gaji / elaun tidak dinyatakan", postedAt, applyLink: `https://example.com/${jobId}`, source: "Fixture" });
const suggestion = (value) => ({ job: value, reasons: ["Bidang pilihan anda."], checksNeeded: [] });
const response = (body, ok = true) => ({ ok, json: async () => body });
const body = (overrides = {}) => ({ success: true, department: "DFK", resetAt: Date.now() + 60000, mode: "course-only",
  roleChoices: [{ id: "cloud-support", label: "Cloud Support" }, { id: "it-support", label: "IT Support" }],
  placeChoices: [{ id: "selangor", label: "Selangor" }, { id: "penang", label: "Penang" }],
  suggestions: [suggestion(job("A", "Cloud Support Intern")), suggestion(job("C", "IT Support Intern"))], needsReview: [], olderAdvertisements: [],
  emptyReason: null, starterSearches: [{ label: "Cloud Intern", q: "Cloud Support Intern", location: "Malaysia", employmentType: "INTERN" }], ...overrides });

function Harness({ scope = "DFK-A", department = "DFK", active = true, refreshKey = 0, onSearch = vi.fn() }) {
  const [stored, setStored] = useState(null);
  const preferences = stored?.scope === scope ? stored.value : { roleFamilyId: "", placeId: "", placeMode: "prefer" };
  return <CareerRecommendations active={active} scope={scope} department={department} preferences={preferences}
    onPreferencesChange={(value) => setStored({ scope, value })} refreshKey={refreshKey} onSearch={onSearch} />;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => response(body())));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("automatic career recommendations", () => {
  it("does not fetch or show automatic results while the view is inactive", async () => {
    const view = render(<Harness active={false} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Bidang kerjaya pilihan")).not.toBeInTheDocument();
    view.rerender(<Harness />);
    await screen.findByText("Cloud Support Intern");
    view.rerender(<Harness active={false} />);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Cloud Support Intern")).not.toBeInTheDocument();
  });

  it("renders server order, reasons and unverified employer conditions without a percentage", async () => {
    render(<Harness />);
    const results = await screen.findByRole("region", { name: "Cadangan mengikut kursus" });
    expect(within(results).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Cadangan mengikut kursus", "Cloud Support Intern", "IT Support Intern"]);
    expect(within(results).getAllByText("Bidang pilihan anda.")).toHaveLength(2);
    expect(within(results).getByText(/Syarat majikan belum disahkan/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe("/api/careers/recommendations");
    expect(fetch.mock.calls.every(([url]) => !url.includes("studentId") && !url.includes("department="))).toBe(true);
  });

  it("sends only the current student's declared role and required workplace", async () => {
    render(<Harness />);
    await screen.findByRole("region", { name: "Cadangan mengikut kursus" });
    expect(screen.getByRole("checkbox", { name: "Lokasi ini wajib" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Bidang kerjaya pilihan"), { target: { value: "it-support" } });
    fireEvent.change(screen.getByLabelText("Lokasi kerja pilihan"), { target: { value: "selangor" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Lokasi ini wajib" }));
    await screen.findByRole("region", { name: "Cadangan mengikut kursus" });
    const url = new URL(fetch.mock.calls.at(-1)[0], "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ roleFamilyId: "it-support", placeId: "selangor", placeMode: "require" });
  });

  it("ignores a delayed response for an earlier preference", async () => {
    let finishCloud;
    fetch.mockImplementation(async (url) => {
      const role = new URL(url, "http://localhost").searchParams.get("roleFamilyId");
      if (role === "cloud-support") return new Promise((resolve) => { finishCloud = resolve; });
      return response(body({ suggestions: [suggestion(job("C", role === "it-support" ? "Current IT Support" : "Initial result"))] }));
    });
    render(<Harness />);
    await screen.findByText("Initial result");
    fireEvent.change(screen.getByLabelText("Bidang kerjaya pilihan"), { target: { value: "cloud-support" } });
    expect(screen.queryByText("Initial result")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bidang kerjaya pilihan"), { target: { value: "it-support" } });
    expect(await screen.findByText("Current IT Support")).toBeInTheDocument();
    await act(async () => finishCloud(response(body({ suggestions: [suggestion(job("OLD", "Stale Cloud result"))] }))));
    expect(screen.queryByText("Stale Cloud result")).not.toBeInTheDocument();
    expect(screen.getByText("Current IT Support")).toBeInTheDocument();
  });

  it("clears previous course cards and preferences and rejects a foreign-course reply", async () => {
    let finishNewCourse;
    const view = render(<Harness />);
    await screen.findByText("Cloud Support Intern");
    fireEvent.change(screen.getByLabelText("Bidang kerjaya pilihan"), { target: { value: "cloud-support" } });
    await screen.findByText("Cloud Support Intern");
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishNewCourse = resolve; }));
    view.rerender(<Harness scope="ITW-C" department="ITW" />);
    expect(screen.queryByText("Cloud Support Intern")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Bidang kerjaya pilihan")).toHaveValue("");
    await act(async () => finishNewCourse(response(body())));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kursus pelajar telah berubah");
    expect(screen.queryByText("Cloud Support Intern")).not.toBeInTheDocument();
  });

  it("distinguishes unavailable history from an empty course pool", async () => {
    fetch.mockRejectedValueOnce(new Error("Sejarah tidak dapat dimuatkan"));
    render(<Harness />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sejarah tidak dapat dimuatkan");
    expect(screen.queryByText("Belum ada sejarah carian kursus hari ini")).not.toBeInTheDocument();
    fetch.mockResolvedValueOnce(response(body({ suggestions: [], emptyReason: "no-history" })));
    fireEvent.click(screen.getByRole("button", { name: "Muat semula cadangan" }));
    expect(await screen.findByText("Belum ada sejarah carian kursus hari ini")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows review and older advertisements separately with their uncertainty", async () => {
    fetch.mockResolvedValueOnce(response(body({ suggestions: [],
      needsReview: [{ job: job("D", "Technology Programme", ""), reasons: [], checksNeeded: ["Lokasi wajib belum dapat disahkan."] }],
      olderAdvertisements: [suggestion(job("E", "Older Cloud Support"))] })));
    render(<Harness />);
    const review = await screen.findByRole("region", { name: "Perlu semakan" });
    expect(within(review).getByText("Lokasi wajib belum dapat disahkan.")).toBeInTheDocument();
    expect(within(review).getByText("Tarikh iklan tidak dinyatakan.")).toBeInTheDocument();
    const older = screen.getByRole("region", { name: "Iklan lebih lama" });
    expect(within(older).getByText("Older Cloud Support")).toBeInTheDocument();
    expect(screen.queryByText("Belum ada hasil yang sesuai")).not.toBeInTheDocument();
  });

  it("refreshes on window focus and after a successful-search refresh signal", async () => {
    const view = render(<Harness />);
    await screen.findByText("Cloud Support Intern");
    fetch.mockResolvedValueOnce(response(body({ suggestions: [suggestion(job("N", "New saved result"))] })));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByText("New saved result")).toBeInTheDocument();
    fetch.mockResolvedValueOnce(response(body({ suggestions: [suggestion(job("S", "Result after search"))] })));
    view.rerender(<Harness refreshKey={1} />);
    expect(await screen.findByText("Result after search")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("clears expired cards and reloads only saved recommendations at the deadline", async () => {
    vi.useFakeTimers();
    let finishRefresh;
    fetch.mockResolvedValueOnce(response(body({ resetAt: Date.now() + 1000 })));
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    await act(async () => render(<Harness />));
    expect(screen.getByText("Cloud Support Intern")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(screen.queryByText("Cloud Support Intern")).not.toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/careers/recommendations", "/api/careers/recommendations"]);
    await act(async () => finishRefresh(response(body({ suggestions: [], emptyReason: "no-history" }))));
    expect(screen.getByText("Belum ada sejarah carian kursus hari ini")).toBeInTheDocument();
  });

  it("starts a new search only on a deliberate click using the chosen workplace", async () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    await screen.findByText("Cloud Support Intern");
    fireEvent.change(screen.getByLabelText("Lokasi kerja pilihan"), { target: { value: "selangor" } });
    const action = await screen.findByRole("button", { name: "Cari jawatan untuk pilihan saya" });
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.click(action);
    expect(onSearch).toHaveBeenCalledWith({ label: "Cloud Intern", q: "Cloud Support Intern", location: "Selangor", employmentType: "INTERN" });
    expect(fetch.mock.calls.every(([url]) => url.startsWith("/api/careers/recommendations"))).toBe(true);
  });
});

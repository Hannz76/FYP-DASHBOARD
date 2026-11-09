import React from "react";
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDashboardClient from "@/components/dashboard/StudentDashboardClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props) => <img {...props} alt={props.alt || ""} /> }));
vi.mock("@/app/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/client-auth", () => ({
  getClientUser: () => ({ role: "user", studentId: "DFK-A", displayName: "DFK student" }),
  getClientToken: () => "proxy-handled",
}));
vi.mock("react-chartjs-2", () => ({ Radar: () => <div aria-label="Radar chart" /> }));

const student = {
  id: "DFK-A", nama: "DFK student", kursus: "DFK", cgpa: 3, attendance: 90,
  dropoutRisk: "Sederhana", uploadedCertificates: [], sourceDataset: "JJ2026",
};
const response = (body) => ({ ok: true, json: async () => body });
let historyDepartment;
let historyKeywords;
let pendingHistory;

beforeEach(() => {
  historyDepartment = "DFK";
  historyKeywords = ["cloud support"];
  pendingHistory = null;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.startsWith("/api/careers/recommendations")) return response({ success: true, department: "DFK", resetAt: Date.now() + 60000,
      mode: "course-only", roleChoices: [], placeChoices: [], suggestions: [], needsReview: [], olderAdvertisements: [], starterSearches: [], emptyReason: "no-history" });
    if (url.startsWith("/api/careers/history")) {
      if (pendingHistory) return pendingHistory;
      return response({ success: true, department: historyDepartment, keywords: [...historyKeywords], resetAt: Date.now() + 60000 });
    }
    if (url.startsWith("/api/careers/saved-jobs")) return response({ success: true, jobs: [] });
    if (url === "/api/semesters") {
      return response([{ _id: "current", datasetName: "JJ2026", isCurrentSemester: true, recordsProcessed: 1, status: "Processed" }]);
    }
    if (url.includes("/skill-gap")) {
      return response({
        student, chart: { labels: ["PLO 1"], current: [70], target: [80] },
        insight: { weakestSkill: "PLO 1", message: "DFK skill analysis" },
      });
    }
    if (url.startsWith("/api/students/DFK-A")) return response(student);
    if (url.startsWith("/api/students")) return response([student]);
    throw new Error(`Unexpected request ${url}`);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openHistory() {
  render(<StudentDashboardClient />);
  await screen.findByText("DFK skill analysis");
  fireEvent.click(screen.getByRole("button", { name: "Padanan Kerjaya (AI)" }));
  fireEvent.click(screen.getByRole("button", { name: "Carian Manual" }));
  const input = screen.getByLabelText("Kata kunci jawatan");
  await act(async () => input.focus());
  return input;
}

describe("course-scoped search history", () => {
  it("shows shared DFK history to a DFK student", async () => {
    await openHistory();
    expect(await screen.findByRole("option", { name: "cloud support" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Kata kunci jawatan" })).toHaveAttribute("aria-expanded", "true");
  });

  it("never replaces DFK history with a response from ITW", async () => {
    const input = await openHistory();
    expect(await screen.findByRole("option", { name: "cloud support" })).toBeInTheDocument();
    historyDepartment = "ITW";
    historyKeywords = ["welding inspector"];
    await act(async () => fireEvent.focus(input));
    expect(screen.queryByRole("option", { name: "welding inspector" })).not.toBeInTheDocument();
  });

  it("refreshes an open DFK history list after returning to the window", async () => {
    await openHistory();
    expect(await screen.findByRole("option", { name: "cloud support" })).toBeInTheDocument();
    historyKeywords = ["azure support", "cloud support"];
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(await screen.findByRole("option", { name: "azure support" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "cloud support" })).toBeInTheDocument();
  });

  it("ignores an older foreign-course reply after a newer DFK refresh", async () => {
    let finishOldRequest;
    pendingHistory = new Promise((resolve) => { finishOldRequest = resolve; });
    const input = await openHistory();
    pendingHistory = null;
    await act(async () => fireEvent.focus(input));
    expect(await screen.findByRole("option", { name: "cloud support" })).toBeInTheDocument();
    await act(async () => finishOldRequest(response({
      success: true, department: "ITW", keywords: ["welding inspector"], resetAt: Date.now() + 60000,
    })));
    expect(screen.getByRole("option", { name: "cloud support" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "welding inspector" })).not.toBeInTheDocument();
  });
});

import React from "react";
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDashboardClient from "@/components/dashboard/StudentDashboardClient";
import JobCard from "@/components/JobCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props) => <img {...props} alt={props.alt || ""} /> }));
vi.mock("@/app/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/client-auth", () => ({ getClientUser: () => ({ role: "user", studentId: "S1", displayName: "Test Student" }), getClientToken: () => "proxy-handled" }));
vi.mock("react-chartjs-2", () => ({ Radar: () => <div aria-label="Radar chart" /> }));

const student = { id: "S1", nama: "Test Student", kursus: "ITW", cgpa: 3, attendance: 90, dropoutRisk: "Sederhana", uploadedCertificates: [] };
const job = { jobId: "J1", title: "Welder Intern", company: "Test Employer", location: "Terengganu", salary: "RM 1,000+", applyLink: "https://example.com/apply", source: "Test Jobs" };
const pathway = {
  supported: true, courseName: "Diploma Kompetensi Kimpalan", readinessScore: 74, readinessExplanation: "Indeks panduan akademik.", targetRoles: ["Welder / Fabricator"],
  actionPlan: [{ title: "Sediakan portfolio", description: "Kumpulkan projek kimpalan anda." }], recommendedCertifications: ["TWIMC"],
  suggestedSearches: [{ label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" }],
};
const response = (body, ok = true) => ({ ok, json: async () => body });
let careerFetch;

beforeEach(() => {
  careerFetch = vi.fn(async () => response({ success: true, jobs: [job], pathway }));
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url.startsWith("/api/careers/")) return careerFetch(url, options);
    if (url.endsWith("/skill-gap")) return response({ student, chart: { labels: ["PLO 1"], current: [60], target: [80] }, insight: { weakestSkill: "PLO 1", message: "Test insight" } });
    if (url === "/api/students") return response([student]);
    if (url === "/api/students/S1") return response(student);
    throw new Error(`Unexpected request ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openCareers(view) {
  render(<StudentDashboardClient />);
  fireEvent.click(await screen.findByRole("button", { name: "Padanan Kerjaya (AI)" }));
  if (view) fireEvent.click(screen.getByRole("button", { name: view }));
}

describe("career tab", () => {
  it("keeps automatic recommendations and searches through the same-origin proxy", async () => {
    await openCareers("Carian Manual");
    expect(screen.getByText("Mulakan carian anda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByRole("link", { name: /Mohon Sekarang untuk Welder Intern/ })).toHaveAttribute("href", "https://example.com/apply");
    const url = new URL(careerFetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/careers/search");
    expect(url.searchParams.get("q")).toBe("Welder");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
    fireEvent.click(screen.getByRole("button", { name: "Cadangan Automatik" }));
    expect(screen.getByText("Juruteknik Kimpalan 6G")).toBeInTheDocument();
    expect(screen.queryByText("Test Employer")).not.toBeInTheDocument();
  });

  it("shows the action plan and preserves suggested location and employment type", async () => {
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "74");
    fireEvent.click(screen.getByRole("button", { name: "Oil & Gas Welder · Terengganu" }));
    await screen.findByLabelText("Kata kunci jawatan");
    expect(screen.getByLabelText("Lokasi di Malaysia")).toHaveValue("Terengganu");
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.get("q")).toBe("Pipe Welder NDT Intern");
    expect(url.searchParams.get("location")).toBe("Terengganu");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
  });

  it("recovers from a search error and distinguishes empty results", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: false, warning: "Carian tergendala" }, false));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByText("Carian tergendala")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari Jawatan" })).toBeEnabled();
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Cuba Lagi" }));
    expect(await screen.findByText("Tiada jawatan ditemui")).toBeInTheDocument();
  });

  it("keeps the pathway visible if job listings are unavailable", async () => {
    careerFetch.mockResolvedValue(response({ success: true, pathway, jobs: [], warning: "Carian belum diaktifkan" }));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByText("Carian belum diaktifkan")).toBeInTheDocument();
  });

  it("does not keep showing a spinner after a network failure", async () => {
    careerFetch.mockRejectedValue(new Error("Sambungan terputus"));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sambungan terputus")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuba Lagi" })).toBeEnabled());
  });
});

it("does not render unsafe application links", () => {
  render(<JobCard job={{ ...job, applyLink: "javascript:alert(1)" }} isDynamic />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Pautan permohonan tidak tersedia.")).toBeInTheDocument();
});

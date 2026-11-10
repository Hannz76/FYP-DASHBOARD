import React from "react";
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearningRecommendations from "@/components/LearningRecommendations";

const item = (id, title, kind, url, extra = {}) => ({
  resource: { id, title, kind, url, provider: "Verified provider", level: "introductory", languages: ["en"],
    durationMinutes: null, prerequisites: [], publication: { checkedAt: "2026-11-10", access: { kind: "free-open" } },
    credentialNote: "Pembacaan tidak memberikan pensijilan profesional.", ...extra },
  action: { label: kind === "ebook" ? "Baca e-buku" : kind === "provider-catalog" ? "Buka portal" : "Mula Belajar", url },
  reasons: ["Berdasarkan kursus anda."], notes: [],
});
const cloud = item("cloud", "Cloud foundations", "module", "https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/");
const book = item("computing", "Computing foundations", "ebook", "https://openstax.org/books/introduction-computer-science/pages/preface");
const body = (overrides = {}) => ({ success: true, department: "DFK", dataset: "JJ2026", catalogVersion: "2026-11-10", mode: "course-foundations",
  courses: [cloud], ebooks: [book], assessment: { target: 80, gaps: [{ plo: 2, score: 55 }], unrecorded: [6], recordedCount: 8 },
  notices: ["PLO 6 belum direkodkan.", "Cadangan berdasarkan kursus; pemetaan topik PLO belum disahkan."], emptyReason: null, ...overrides });
const response = (value, ok = true) => ({ ok, json: async () => value });

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => response(body()))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("personalized learning resources", () => {
  it("renders server resources and genuine provider destinations without invented claims", async () => {
    render(<LearningRecommendations scope="student-A" displayedDataset="JJ2026" />);
    expect(await screen.findByText("Cloud foundations")).toBeInTheDocument();
    const course = screen.getByRole("region", { name: "Kursus dan modul" });
    expect(within(course).getByText("Berdasarkan kursus anda.")).toBeInTheDocument();
    const start = within(course).getByRole("link", { name: /Mula Belajar untuk Cloud foundations/ });
    expect(start).toHaveAttribute("href", cloud.action.url);
    expect(start).toHaveAttribute("target", "_blank");
    expect(start).toHaveAttribute("rel", "noopener noreferrer");
    const reading = screen.getByRole("region", { name: "E-buku dan bacaan" });
    expect(within(reading).getByRole("link", { name: /Baca e-buku untuk Computing foundations/ })).toHaveAttribute("href", book.action.url);
    expect(screen.getAllByText("Tempoh tidak dinyatakan")).toHaveLength(2);
    expect(screen.queryByText("Disyorkan AI")).not.toBeInTheDocument();
    expect(screen.queryByText("Daftar Sesi")).not.toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/courses/recommendations"]);
  });

  it("keeps missing assessments separate from the server's recorded learning gaps", async () => {
    render(<LearningRecommendations scope="student-A" />);
    const basis = await screen.findByRole("region", { name: "Asas cadangan pembelajaran" });
    expect(within(basis).getByText("PLO 6 belum direkodkan.")).toBeInTheDocument();
    expect(within(basis).getByText(/PLO 2: 55/)).toHaveTextContent("Skor direkodkan di bawah sasaran 80");
    expect(within(basis).queryByText(/PLO 6: 0/)).not.toBeInTheDocument();
    expect(within(basis).getByText("Cadangan berdasarkan kursus anda")).toBeInTheDocument();
  });

  it("shows enrichment and incomplete-data notices without inventing a weak score", async () => {
    fetch.mockResolvedValueOnce(response(body({ mode: "enrichment", assessment: { target: 80, gaps: [], unrecorded: [9], recordedCount: 8 },
      notices: ["Semua skor yang direkodkan mencapai sasaran 80.", "PLO 9 belum direkodkan."] })));
    render(<LearningRecommendations scope="student-A" />);
    expect(await screen.findByText("Bahan pengayaan")).toBeInTheDocument();
    expect(screen.getByText("PLO 9 belum direkodkan.")).toBeInTheDocument();
    expect(screen.queryByText(/Skor direkodkan di bawah sasaran/)).not.toBeInTheDocument();
    expect(screen.getByText("Cloud foundations")).toBeInTheDocument();
  });

  it("displays the current server course and dataset when viewing historical academics", async () => {
    fetch.mockResolvedValueOnce(response(body({ department: "ITW", dataset: "JJ2026", courses: [], ebooks: [item("blueprint", "Blueprint reading", "ebook", "https://openoregon.pressbooks.pub/blueprint/")] })));
    render(<LearningRecommendations scope="student-A-historical-DFK" displayedDataset="JD2025" />);
    expect(await screen.findByText("Blueprint reading")).toBeInTheDocument();
    expect(screen.getByText("Rekod semasa: ITW · JJ2026.")).toBeInTheDocument();
    expect(screen.getByText("Dataset akademik yang dipaparkan ialah JD2025. Cadangan ini menggunakan rekod semasa JJ2026.")).toBeInTheDocument();
    expect(screen.queryByText("Cloud foundations")).not.toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe("/api/courses/recommendations");
  });

  it("hides the previous account's cards immediately and ignores its delayed response", async () => {
    let finishOld;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    const view = render(<LearningRecommendations scope="student-A" />);
    fetch.mockResolvedValueOnce(response(body({ department: "ITW", courses: [], ebooks: [item("blueprint", "Current welding reading", "ebook", "https://openoregon.pressbooks.pub/blueprint/")] })));
    view.rerender(<LearningRecommendations scope="student-B" />);
    expect(await screen.findByText("Current welding reading")).toBeInTheDocument();
    await act(async () => finishOld(response(body())));
    expect(screen.queryByText("Cloud foundations")).not.toBeInTheDocument();
    expect(screen.getByText("Current welding reading")).toBeInTheDocument();
  });

  it("clears existing cards while a different course request is pending", async () => {
    const view = render(<LearningRecommendations scope="student-A-DFK" />);
    await screen.findByText("Cloud foundations");
    let finishNew;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finishNew = resolve; }));
    view.rerender(<LearningRecommendations scope="student-A-ITW" />);
    expect(screen.queryByText("Cloud foundations")).not.toBeInTheDocument();
    await act(async () => finishNew(response(body({ department: "ITW", courses: [], ebooks: [item("blueprint", "Welding reading", "ebook", "https://openoregon.pressbooks.pub/blueprint/")] }))));
    expect(screen.getByText("Welding reading")).toBeInTheDocument();
  });

  it("distinguishes a failed request from catalog coverage and recovers on retry", async () => {
    fetch.mockResolvedValueOnce(response({ success: false, message: "Rekod kursus semasa tidak tersedia." }, false));
    render(<LearningRecommendations scope="student-A" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Rekod kursus semasa tidak tersedia.");
    expect(screen.queryByText("Bahan berkaitan belum tersedia")).not.toBeInTheDocument();
    fetch.mockResolvedValueOnce(response(body({ courses: [], ebooks: [], emptyReason: "catalog-coverage-gap" })));
    fireEvent.click(screen.getByRole("button", { name: "Muat semula bahan" }));
    expect(await screen.findByText("Bahan berkaitan belum tersedia")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows account, provider-portal and published-duration information honestly", async () => {
    const portal = item("hvac", "Cooling learning portal", "provider-catalog", "https://www.danfoss.com/en-gb/service-and-support/learning/cooling-learning/", {
      publication: { checkedAt: "2026-11-10", access: { kind: "free-account", note: "Akaun penyedia diperlukan; sesi kelas mungkin berbayar." } }, languages: [], durationMinutes: null,
    });
    fetch.mockResolvedValueOnce(response(body({ department: "PPU", courses: [portal, { ...cloud, resource: { ...cloud.resource, durationMinutes: 25 } }], ebooks: [] })));
    render(<LearningRecommendations scope="student-C" />);
    expect(await screen.findByRole("link", { name: /Buka portal untuk Cooling learning portal/ })).toHaveAttribute("href", portal.action.url);
    expect(screen.getByText("Percuma dengan akaun penyedia")).toBeInTheDocument();
    expect(screen.getByText("Akaun penyedia diperlukan; sesi kelas mungkin berbayar.")).toBeInTheDocument();
    expect(screen.getByText(/Bahasa tidak dinyatakan/)).toBeInTheDocument();
    expect(screen.getByText("25 minit")).toBeInTheDocument();
  });

  it("does not turn an unsafe or credential-bearing destination into a learning link", async () => {
    fetch.mockResolvedValueOnce(response(body({ courses: [item("unsafe", "Unsafe destination", "module", "javascript:alert(1)"), item("credentials", "Credential URL", "module", "https://user:password@example.com/")], ebooks: [] })));
    render(<LearningRecommendations scope="student-A" />);
    expect(await screen.findByText("Unsafe destination")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByText("Pautan pembelajaran tidak tersedia.")).toHaveLength(2);
  });
});

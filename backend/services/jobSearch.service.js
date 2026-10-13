function normaliseJob(job) {
  if (!job || typeof job !== "object" || !job.job_id || !job.job_title) return null;
  let applyLink;
  try {
    const url = new URL(job.job_apply_link);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    applyLink = url.href;
  } catch {
    return null;
  }
  const currency = job.job_salary_currency || "MYR";
  const amount = Number(job.job_min_salary);
  const salary = typeof job.job_salary_string === "string" && job.job_salary_string.trim()
    ? job.job_salary_string.trim()
    : job.job_min_salary != null && Number.isFinite(amount) && amount > 0
    ? `${currency === "MYR" ? "RM" : currency} ${amount.toLocaleString("en-MY")}+${job.job_salary_period ? ` / ${job.job_salary_period}` : ""}`
    : "Gaji / elaun tidak dinyatakan";
  return {
    jobId: String(job.job_id),
    title: String(job.job_title),
    company: String(job.employer_name || "Majikan tidak dinyatakan"),
    location: String(job.job_location || [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Lokasi tidak dinyatakan"),
    applyLink,
    salary,
    postedAt: String(job.job_posted_at_datetime_utc || ""),
    source: String(job.job_publisher || "JSearch"),
  };
}

export async function searchJobsFromProvider({ q, location = "Malaysia", employmentType = "INTERN" }) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) return { jobs: [], warning: "Carian jawatan belum tersedia. Hubungi penyelaras untuk mengaktifkannya." };

  const url = new URL("https://api.openwebninja.com/jsearch/search-v2");
  url.searchParams.set("query", `${q} in ${location}`);
  url.searchParams.set("employment_types", employmentType);
  url.searchParams.set("country", "my");
  url.searchParams.set("num_pages", "1");

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Provider request failed");
    const data = await response.json();
    if (data.status !== "OK" || !Array.isArray(data.data?.jobs)) throw new Error("Invalid provider response");
    const jobs = data.data.jobs.map(normaliseJob).filter(Boolean);
    return { jobs: [...new Map(jobs.map((job) => [job.jobId, job])).values()].slice(0, 6) };
  } catch {
    return { jobs: [], warning: "Carian jawatan tergendala. Sila cuba lagi sebentar nanti." };
  }
}

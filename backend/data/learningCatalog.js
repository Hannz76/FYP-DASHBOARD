function resource({ access = { kind: "free-open" }, evidenceUrl, evidenceKind = "public-reading-tested", ...entry }) {
  return {
    level: "introductory", languages: ["en"], durationMinutes: null, prerequisites: [],
    credentialNote: "Bahan pembelajaran ini tidak mengesahkan kelayakan profesional atau kompetensi amali.",
    license: null,
    ...entry,
    publication: { status: "active", checkedAt: "2026-11-10", evidenceUrl: evidenceUrl || entry.url, evidenceKind, access },
  };
}

export const learningCatalog = {
  version: "2026-11-10",
  alignments: [],
  resources: [
    resource({
      id: "cloud-computing", title: "Describe cloud computing", provider: "Microsoft Learn",
      url: "https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/", kind: "module",
      audience: { kind: "program", departments: ["DFK"] }, topics: ["cloud-foundations"], editorialOrder: 10,
      prerequisites: ["Pengetahuan asas istilah IT."],
      evidenceUrl: "https://learn.microsoft.com/en-us/training/support/faq",
      credentialNote: "Kandungan percuma untuk dibaca. Profil diperlukan untuk merekod pencapaian; peperiksaan pensijilan berasingan.",
    }),
    resource({
      id: "computing-foundations", title: "Introduction to Computer Science", provider: "OpenStax",
      url: "https://openstax.org/books/introduction-computer-science/pages/preface", kind: "ebook",
      audience: { kind: "program", departments: ["DFK"] }, topics: ["computing-foundations"], editorialOrder: 10,
      license: { label: "CC BY-NC-SA 4.0; semak pengecualian pada penerbit.", url: "https://openstax.org/books/introduction-computer-science/pages/preface" },
    }),
    resource({
      id: "blueprint-reading", title: "Basic Blueprint Reading", provider: "LibreTexts / Open Oregon",
      url: "https://workforce.libretexts.org/Bookshelves/Manufacturing/Basic_Blueprint_Reading_(Costin)", kind: "ebook",
      audience: { kind: "program", departments: ["ITW", "SLR"] }, topics: ["blueprint-reading"], editorialOrder: 10,
      evidenceUrl: "https://workforce.libretexts.org/Bookshelves/Manufacturing/Basic_Blueprint_Reading_(Costin)/00%3A_Front_Matter/04%3A_Preface",
      license: { label: "CC BY 4.0 kecuali dinyatakan sebaliknya.", url: "https://workforce.libretexts.org/Bookshelves/Manufacturing/Basic_Blueprint_Reading_(Costin)/00%3A_Front_Matter/04%3A_Preface" },
    }),
    resource({
      id: "autocad-drafting", title: "Introduction to Drafting and AutoCAD 2D", provider: "BCcampus",
      url: "https://opentextbc.ca/autocad2d/", kind: "ebook",
      audience: { kind: "program", departments: ["SLR"] }, topics: ["drafting-foundations"], editorialOrder: 5,
      credentialNote: "Buku percuma tidak merangkumi lesen perisian AutoCAD. Semak versi alat bersama pensyarah.",
      license: { label: "CC BY 4.0 dengan pengecualian bahan pihak ketiga.", url: "https://opentextbc.ca/autocad2d/" },
    }),
    resource({
      id: "electricity-foundations", title: "Electrical Fundamentals E-1", provider: "BCcampus / Camosun College",
      url: "https://collection.bccampus.ca/textbook/Nf7jVbAg/", kind: "ebook",
      audience: { kind: "program", departments: ["DCG", "SED"] }, topics: ["electrical-foundations"], editorialOrder: 10,
      evidenceKind: "provider-listed",
      credentialNote: "Teori asas elektrik. Bahan antarabangsa ini bukan pengesahan pematuhan pendawaian atau lesen Malaysia.",
      license: { label: "CC BY 4.0 kecuali dinyatakan sebaliknya.", url: "https://collection.bccampus.ca/textbook/Nf7jVbAg/" },
    }),
    resource({
      id: "automotive-learning", title: "TekniWiki: modul teknikal automotif", provider: "NGK / NTK",
      url: "https://www.ngkntk.com/uk/service/tekniwiki/", kind: "provider-catalog",
      audience: { kind: "program", departments: ["DGA"] }, topics: ["automotive-foundations"], editorialOrder: 10,
      level: "unknown", languages: [], evidenceKind: "provider-listed",
      credentialNote: "Portal modul, diagnostik dan video automotif. Pengiktirafan modul penyedia bukan kelayakan automotif IKMB.",
    }),
    resource({
      id: "hvac-introduction", title: "What is HVAC?", provider: "LibreTexts / Coalinga College",
      url: "https://workforce.libretexts.org/Courses/Coalinga_College/Introduction_to_Residential_HVAC_Level_1/01%3A_Fundamentals_of_Heating_Ventilation_Air_Conditioning_and_Refrigeration_(HVAC_R)/1.01%3A_What_is_HVAC", kind: "module",
      audience: { kind: "program", departments: ["PPU"] }, topics: ["refrigeration-foundations"], editorialOrder: 10,
      license: { label: "CC BY-NC 4.0; semak pengecualian pada penerbit.", url: "https://workforce.libretexts.org/Courses/Coalinga_College/Introduction_to_Residential_HVAC_Level_1/01%3A_Fundamentals_of_Heating_Ventilation_Air_Conditioning_and_Refrigeration_(HVAC_R)/1.01%3A_What_is_HVAC" },
    }),
    resource({
      id: "heat-pumps-reading", title: "Heat Pumps and Refrigerators", provider: "OpenStax",
      url: "https://openstax.org/books/college-physics-2e/pages/15-5-applications-of-thermodynamics-heat-pumps-and-refrigerators", kind: "ebook",
      audience: { kind: "program", departments: ["PPU"] }, topics: ["refrigeration-theory"], editorialOrder: 10,
      level: "intermediate",
      prerequisites: ["Asas algebra dan termodinamik. Semak kesesuaian topik bersama pensyarah."],
      license: { label: "CC BY-NC-SA 4.0; semak pengecualian pada penerbit.", url: "https://openstax.org/books/college-physics-2e/pages/preface" },
    }),
    resource({
      id: "trades-study-skills", title: "Apply Study and Learning Skills", provider: "BCcampus / Camosun College",
      url: "https://opentextbc.ca/tradescommoncoreb1/", kind: "ebook",
      audience: { kind: "general" }, topics: ["study-skills"], editorialOrder: 100,
      license: { label: "CC BY 4.0 dengan bahagian berlesen CC BY-NC-SA; semak penerbit.", url: "https://opentextbc.ca/tradescommoncoreb1/" },
    }),
    resource({
      id: "trades-communication", title: "Use Interpersonal Communication Skills", provider: "BCcampus / Camosun College",
      url: "https://opentextbc.ca/tradescommoncoreb3/", kind: "ebook",
      audience: { kind: "general" }, topics: ["communication"], editorialOrder: 110,
      license: { label: "CC BY 4.0 dengan bahagian berlesen CC BY-NC-SA; semak penerbit.", url: "https://opentextbc.ca/tradescommoncoreb3/" },
    }),
  ],
};

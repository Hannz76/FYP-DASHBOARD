export const pathwayMap = {
  SED: {
    courseName: "Diploma Kompetensi Elektrik (Penyelenggaraan) (Industri)",
    roleFamilies: [
      { id: "electrical-technician", label: "Electrical Technician", aliases: ["electrical technician", "electrical maintenance technician", "industrial electrician", "juruteknik elektrik", "wireman", "juruwireman"] },
      { id: "chargeman", label: "Chargeman Trainee (PW4)", aliases: ["chargeman"] },
      { id: "electrical-machine", label: "Penjaga Jentera Elektrik", aliases: ["electrical machine technician", "electrical machinery technician", "penjaga jentera elektrik"] },
    ],
    baseQuery: "Electrical Maintenance Technician Industrial",
    recommendedCertifications: ["Sijil Kompetisi Juruwireman (PW2/PW4)", "Chargeman AO/A4 (Suruhanjaya Tenaga)", "CIDB Green Card"],
    suggestedSearches: [
      { label: "Electrical Intern", q: "Electrical Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Wireman / Chargeman", q: "Wireman Chargeman Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  ITW: {
    courseName: "Diploma Kompetensi Kimpalan",
    roleFamilies: [
      { id: "welding", label: "Welder / Fabricator", aliases: ["welder", "fabricator", "jurukimpal", "juruteknik kimpalan"] },
      { id: "welding-inspection", label: "Welding Inspector (VI)", aliases: ["welding inspector", "visual welding inspector", "pemeriksa kimpalan"] },
      { id: "ndt", label: "NDT Technician", aliases: ["ndt technician", "ndt inspector", "non destructive testing"] },
      { id: "pipe-welding", label: "Pipe Welder", aliases: ["pipe welder", "pipe welding"] },
    ],
    baseQuery: "Welder Fabricator QAQC NDT",
    recommendedCertifications: ["TWIMC", "ASME / AWS Welding", "NDT Level 1/2", "Visual Inspector (VI)"],
    suggestedSearches: [
      { label: "Welder Intern", q: "Welder Fabricator Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" },
    ],
  },
  DFK: {
    courseName: "Diploma Teknologi Komputer (Komputasi Awan)",
    roleFamilies: [
      { id: "cloud-support", label: "Cloud Support Trainee", aliases: ["cloud support", "cloud computing support", "cloud operations", "cloud engineer", "jurutera awan", "sokongan awan"] },
      { id: "it-support", label: "IT Support Technician", aliases: ["it support", "it system support", "help desk", "helpdesk", "desktop support", "juruteknik sokongan it"] },
      { id: "system-admin", label: "System Administrator Assistant", aliases: ["system administrator", "systems administrator", "system admin", "systems admin", "pentadbir sistem"] },
    ],
    baseQuery: "Cloud Computing IT Support System Admin",
    recommendedCertifications: ["AWS Certified Cloud Practitioner", "Microsoft Azure Fundamentals (AZ-900)", "Cisco CCNA"],
    suggestedSearches: [
      { label: "Cloud Intern", q: "Cloud Computing Support Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "IT Support", q: "IT Support Technician Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  PPU: {
    courseName: "Diploma Teknologi Penyejukan dan Penyamanan Udara",
    roleFamilies: [
      { id: "hvac", label: "HVAC Technician Trainee", aliases: ["hvac technician", "refrigeration technician", "juruteknik penyejukan"] },
      { id: "air-conditioning", label: "Air Conditioning Mechanic", aliases: ["air conditioning mechanic", "air conditioning technician", "juruteknik penyaman udara"] },
      { id: "facility-me", label: "Facility M&E Assistant", aliases: ["facility m e", "facilities m e", "facility mechanical electrical"] },
    ],
    baseQuery: "HVAC Air Conditioning Refrigeration Technician",
    recommendedCertifications: ["CIDB Green Card", "DOS Refrigerant Handling", "SKM/DKM (Penyejukan)"],
    suggestedSearches: [
      { label: "HVAC Intern", q: "HVAC Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Facility M&E", q: "Facility Maintenance M&E Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  SLR: {
    courseName: "Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)",
    roleFamilies: [
      { id: "cad-drafter", label: "CAD Drafter Intern", aliases: ["cad drafter", "cad draftsman", "autocad drafter", "pelukis pelan"] },
      { id: "mechanical-design", label: "Mechanical Design Trainee", aliases: ["mechanical design", "mechanical designer", "mechanical design engineer"] },
      { id: "drafting", label: "Junior Draftsperson", aliases: ["draftsperson", "draftsman", "drafting technician"] },
    ],
    baseQuery: "CAD Drafter Mechanical Design AutoCAD SolidWorks",
    recommendedCertifications: ["AutoCAD Certified Professional", "SolidWorks CSWA"],
    suggestedSearches: [
      { label: "CAD Drafter", q: "CAD Drafter Intern AutoCAD", location: "Malaysia", employmentType: "INTERN" },
      { label: "Mechanical Design", q: "Mechanical Design Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
};

export const careerPlaces = [
  { id: "johor", label: "Johor", aliases: ["johor"] },
  { id: "kedah", label: "Kedah", aliases: ["kedah"] },
  { id: "kelantan", label: "Kelantan", aliases: ["kelantan"] },
  { id: "melaka", label: "Melaka", aliases: ["melaka", "malacca"] },
  { id: "negeri-sembilan", label: "Negeri Sembilan", aliases: ["negeri sembilan"] },
  { id: "pahang", label: "Pahang", aliases: ["pahang"] },
  { id: "penang", label: "Penang", aliases: ["penang", "pulau pinang"] },
  { id: "perak", label: "Perak", aliases: ["perak"] },
  { id: "perlis", label: "Perlis", aliases: ["perlis"] },
  { id: "sabah", label: "Sabah", aliases: ["sabah"] },
  { id: "sarawak", label: "Sarawak", aliases: ["sarawak"] },
  { id: "selangor", label: "Selangor", aliases: ["selangor"] },
  { id: "terengganu", label: "Terengganu", aliases: ["terengganu"] },
  { id: "kuala-lumpur", label: "Kuala Lumpur", aliases: ["kuala lumpur", "wilayah persekutuan kuala lumpur"] },
  { id: "putrajaya", label: "Putrajaya", aliases: ["putrajaya"] },
  { id: "labuan", label: "Labuan", aliases: ["labuan"] },
  { id: "petaling-jaya", label: "Petaling Jaya", aliases: ["petaling jaya"], state: "selangor" },
  { id: "shah-alam", label: "Shah Alam", aliases: ["shah alam"], state: "selangor" },
  { id: "cyberjaya", label: "Cyberjaya", aliases: ["cyberjaya"], state: "selangor" },
  { id: "bayan-lepas", label: "Bayan Lepas", aliases: ["bayan lepas"], state: "penang" },
  { id: "george-town", label: "George Town", aliases: ["george town", "georgetown"], state: "penang" },
  { id: "johor-bahru", label: "Johor Bahru", aliases: ["johor bahru"], state: "johor" },
];

function score(value, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(max, numeric)) : 0;
}

export function buildStudentPathway(student) {
  const courseCode = String(student.Kursus || "").replaceAll("*", "").trim().toUpperCase();
  const course = pathwayMap[courseCode] || {
    courseName: courseCode || "Kursus belum direkodkan",
    targetRoles: [],
    baseQuery: null,
    recommendedCertifications: [],
    suggestedSearches: [],
  };
  const ploScores = Array.from({ length: 9 }, (_, i) => score(student[`PLO_${i + 1}`], 100));
  const ploAverage = ploScores.reduce((sum, value) => sum + value, 0) / 9;
  const cgpa = score(student.CGPA, 4);
  const attendance = score(student.Kehadiran_Pct, 100);
  const readinessScore = Math.round(ploAverage * 0.4 + (cgpa / 4) * 30 + attendance * 0.3);
  const actionPlan = [];
  const missingPlos = ploScores.flatMap((value, i) => value === 0 ? [`PLO ${i + 1}`] : []);
  if (missingPlos.length) {
    actionPlan.push({ title: "Lengkapkan rekod PLO", description: `Semak ${missingPlos.join(", ")} bersama pensyarah. Skor sifar dianggap belum direkodkan.` });
  }
  const weakPlos = ploScores.flatMap((value, i) => value > 0 && value < 80 ? [`PLO ${i + 1}`] : []);
  if (weakPlos.length) {
    actionPlan.push({ title: "Tingkatkan kemahiran PLO", description: `Utamakan latihan untuk ${weakPlos.join(", ")} sehingga mencapai sasaran 80%.` });
  }
  if (cgpa < 3) actionPlan.push({ title: "Kukuhkan pencapaian akademik", description: "Bincangkan pelan ulang kaji dan klinik akademik dengan pensyarah untuk mencapai CGPA 3.00." });
  if (attendance < 80) actionPlan.push({ title: "Perbaiki kehadiran", description: "Rancang jadual bersama penasihat untuk mencapai kehadiran sekurang-kurangnya 80%." });
  if (course.recommendedCertifications.length) {
    actionPlan.push({ title: "Rancang pensijilan industri", description: `Semak syarat, pengalaman dan latihan yang diperlukan untuk ${course.recommendedCertifications.join(", ")}.` });
  }
  actionPlan.push({ title: "Sediakan permohonan latihan industri", description: "Kemas kini CV, sijil dan portfolio projek. Sesuaikan permohonan dengan syarat setiap jawatan." });

  const { roleFamilies = [], ...courseDetails } = course;
  return {
    ...courseDetails,
    targetRoles: roleFamilies.map((role) => role.label),
    courseCode,
    supported: Boolean(pathwayMap[courseCode]),
    readinessScore,
    readinessExplanation: "Indeks panduan: purata 9 PLO (40%), CGPA (30%) dan kehadiran (30%). Data belum direkodkan dikira sifar. Ini bukan kebarangkalian mendapat kerja.",
    actionPlan,
  };
}

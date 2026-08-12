// Curated allow-list of hospitals located in Malaysia, mirrored from
// server/src/lib/malaysiaHospitals.js. This drives the <select> dropdown so
// the form can't even offer a non-Malaysian hospital; the backend is the
// real enforcement point and validates against the same list independently.
export const MALAYSIA_HOSPITALS = [
  // Public / government hospitals
  "Hospital Kuala Lumpur (HKL)",
  "Hospital Selayang",
  "Hospital Sungai Buloh",
  "Hospital Serdang",
  "Hospital Putrajaya",
  "Hospital Ampang",
  "Hospital Tuanku Ja'afar Seremban",
  "Hospital Melaka",
  "Hospital Sultanah Aminah Johor Bahru",
  "Hospital Sultan Ismail Johor Bahru",
  "Hospital Sultanah Bahiyah Alor Setar",
  "Hospital Raja Perempuan Zainab II Kota Bharu",
  "Hospital Pulau Pinang",
  "Hospital Taiping",
  "Hospital Raja Permaisuri Bainun Ipoh",
  "Hospital Sultanah Nur Zahirah Kuala Terengganu",
  "Hospital Tengku Ampuan Rahimah Klang",
  "Hospital Queen Elizabeth Kota Kinabalu",
  "Hospital Umum Sarawak Kuching",
  "Hospital Tuanku Fauziah Kangar",
  "Hospital Sultan Haji Ahmad Shah Temerloh",
  "Institut Jantung Negara (IJN)",

  // University teaching hospitals
  "Pusat Perubatan Universiti Malaya (UMMC)",
  "Hospital Canselor Tuanku Muhriz UKM",
  "Hospital Universiti Sains Malaysia (Hospital USM)",
  "Hospital Sultan Abdul Halim (UiTM)",

  // Private hospitals
  "Gleneagles Kuala Lumpur",
  "Gleneagles Penang",
  "Pantai Hospital Kuala Lumpur",
  "Sunway Medical Centre",
  "Prince Court Medical Centre",
  "Subang Jaya Medical Centre",
  "KPJ Ampang Puteri Specialist Hospital",
  "KPJ Damansara Specialist Hospital",
  "KPJ Johor Specialist Hospital",
  "Mahkota Medical Centre Melaka",
  "Penang Adventist Hospital",
  "Island Hospital Penang",
  "Regency Specialist Hospital Johor Bahru",
  "Columbia Asia Hospital Petaling Jaya",
  "Columbia Asia Hospital Bukit Rimau",
  "Sarawak Specialist Hospital",
];

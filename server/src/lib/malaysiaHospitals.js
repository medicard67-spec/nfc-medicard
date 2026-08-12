// Curated allow-list of hospitals located in Malaysia. Doctor registration
// only accepts a hospital from this list -- enforced server-side here (the
// real gate) and mirrored as a <select> on the client so the UI can't even
// offer anything outside Malaysia in the first place.
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

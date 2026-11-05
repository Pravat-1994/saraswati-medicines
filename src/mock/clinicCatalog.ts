/**
 * Static reference data for the healthcare modules. All people are fictional;
 * registration numbers are illustrative only and not real practitioner records.
 */
import type { ClinicSettings, ConsultationType, Doctor, Gender, RoomType } from '../types/clinic'

const ALL: ConsultationType[] = ['VIDEO', 'AUDIO', 'IN_PERSON']
const weekdays = (days: number[], start: string, end: string) => days.map((day) => ({ day, start, end }))

export const DOCTORS: Omit<Doctor, 'isActive'>[] = [
  { id: 'doc_01', name: 'Dr. Ananya Mishra', gender: 'FEMALE', specialization: 'General Physician', qualifications: 'MBBS, MD (General Medicine)', experienceYears: 12, registrationNo: 'OMC/2012/18452', registrationCouncil: 'Odisha Medical Council', consultationFee: 400, languages: ['Odia', 'Hindi', 'English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ALL, slotMinutes: 15, schedule: [...weekdays([1, 2, 3, 4, 5, 6], '10:00', '13:00'), ...weekdays([1, 2, 3, 4, 5], '17:00', '20:00')], online: true, bio: 'Family physician with a focus on diabetes, hypertension and preventive care. Coordinates admissions at Saraswati Clinic.', userId: 'usr_doctor' },
  { id: 'doc_02', name: 'Dr. Rajesh Kumar Sahu', gender: 'MALE', specialization: 'Cardiologist', qualifications: 'MBBS, MD (Medicine), DM (Cardiology)', experienceYears: 18, registrationNo: 'OMC/2006/11208', registrationCouncil: 'Odisha Medical Council', consultationFee: 800, languages: ['Odia', 'Hindi', 'English'], affiliation: 'Kalinga Heart Institute', consultationTypes: ['VIDEO', 'IN_PERSON'], slotMinutes: 20, schedule: weekdays([1, 3, 5], '11:00', '14:00'), online: true, bio: 'Interventional cardiologist. Heart failure, arrhythmia and post-MI follow-up.', userId: 'usr_doctor2' },
  { id: 'doc_03', name: 'Dr. Priyanka Nayak', gender: 'FEMALE', specialization: 'Paediatrician', qualifications: 'MBBS, DCH, DNB (Paediatrics)', experienceYears: 9, registrationNo: 'OMC/2015/22917', registrationCouncil: 'Odisha Medical Council', consultationFee: 500, languages: ['Odia', 'English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ALL, slotMinutes: 15, schedule: [...weekdays([1, 2, 4, 6], '09:30', '12:30'), ...weekdays([3, 5], '16:00', '19:00')], online: true, bio: 'Child health, vaccinations, growth and nutrition counselling.' },
  { id: 'doc_04', name: 'Dr. Subhashree Panda', gender: 'FEMALE', specialization: 'Gynaecologist & Obstetrician', qualifications: 'MBBS, MS (Obstetrics & Gynaecology)', experienceYears: 14, registrationNo: 'OMC/2010/16634', registrationCouncil: 'Odisha Medical Council', consultationFee: 700, languages: ['Odia', 'Hindi', 'English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ['VIDEO', 'IN_PERSON'], slotMinutes: 20, schedule: weekdays([2, 4, 6], '10:00', '14:00'), online: false, bio: 'Antenatal care, high-risk pregnancy and women’s health.' },
  { id: 'doc_05', name: 'Dr. Manas Ranjan Behera', gender: 'MALE', specialization: 'Orthopaedic Surgeon', qualifications: 'MBBS, MS (Orthopaedics)', experienceYears: 16, registrationNo: 'OMC/2008/13377', registrationCouncil: 'Odisha Medical Council', consultationFee: 700, languages: ['Odia', 'English'], affiliation: 'Utkal Bone & Joint Centre', consultationTypes: ['IN_PERSON', 'VIDEO'], slotMinutes: 20, schedule: weekdays([1, 2, 3, 4, 5], '15:00', '18:00'), online: true, bio: 'Joint replacement, sports injuries and fracture management.' },
  { id: 'doc_06', name: 'Dr. Farhan Ali', gender: 'MALE', specialization: 'Dermatologist', qualifications: 'MBBS, MD (Dermatology, Venereology & Leprosy)', experienceYears: 8, registrationNo: 'OMC/2016/24051', registrationCouncil: 'Odisha Medical Council', consultationFee: 600, languages: ['Hindi', 'English', 'Urdu'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ALL, slotMinutes: 15, schedule: weekdays([1, 3, 5, 6], '12:00', '16:00'), online: true, bio: 'Acne, eczema, fungal infections and hair-loss clinics.' },
  { id: 'doc_07', name: 'Dr. Lipika Mohanty', gender: 'FEMALE', specialization: 'Endocrinologist', qualifications: 'MBBS, MD (Medicine), DM (Endocrinology)', experienceYears: 11, registrationNo: 'OMC/2013/19980', registrationCouncil: 'Odisha Medical Council', consultationFee: 750, languages: ['Odia', 'English'], affiliation: 'Saraswati Diabetes Care', consultationTypes: ['VIDEO', 'AUDIO', 'IN_PERSON'], slotMinutes: 20, schedule: weekdays([2, 4], '10:00', '13:00'), online: true, bio: 'Diabetes, thyroid and hormonal disorders. Insulin initiation and follow-up.' },
  { id: 'doc_08', name: 'Dr. Arvind Rao', gender: 'MALE', specialization: 'ENT Specialist', qualifications: 'MBBS, MS (ENT)', experienceYears: 20, registrationNo: 'OMC/2004/09912', registrationCouncil: 'Odisha Medical Council', consultationFee: 500, languages: ['Telugu', 'Hindi', 'English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ['IN_PERSON', 'VIDEO'], slotMinutes: 15, schedule: weekdays([1, 2, 3, 4, 5, 6], '18:00', '20:30'), online: true, bio: 'Sinusitis, hearing assessment and voice disorders.' },
  { id: 'doc_09', name: 'Dr. Sneha Das', gender: 'FEMALE', specialization: 'Psychiatrist', qualifications: 'MBBS, MD (Psychiatry)', experienceYears: 7, registrationNo: 'OMC/2017/25530', registrationCouncil: 'Odisha Medical Council', consultationFee: 800, languages: ['Odia', 'Bengali', 'English'], affiliation: 'MindWell Tele-Clinic', consultationTypes: ['VIDEO', 'AUDIO'], slotMinutes: 30, schedule: [...weekdays([1, 3, 5], '19:00', '21:00'), ...weekdays([6, 0], '10:00', '13:00')], online: true, bio: 'Anxiety, depression, sleep and stress management. Tele-consultations only.' },
  { id: 'doc_10', name: 'Dr. Bikram Keshari Jena', gender: 'MALE', specialization: 'Pulmonologist', qualifications: 'MBBS, MD (Respiratory Medicine)', experienceYears: 13, registrationNo: 'OMC/2011/17045', registrationCouncil: 'Odisha Medical Council', consultationFee: 650, languages: ['Odia', 'Hindi', 'English'], affiliation: 'Saraswati Clinic, Janpath', consultationTypes: ALL, slotMinutes: 20, schedule: weekdays([2, 3, 5], '16:00', '19:00'), online: true, bio: 'Asthma, COPD, sleep apnoea and post-infection lung care.' },
  { id: 'doc_11', name: 'Dr. Meera Iyer', gender: 'FEMALE', specialization: 'Dentist', qualifications: 'BDS, MDS (Endodontics)', experienceYears: 10, registrationNo: 'ODC/A-4471', registrationCouncil: 'Odisha Dental Council', consultationFee: 400, languages: ['Tamil', 'English', 'Hindi'], affiliation: 'Saraswati Dental Studio', consultationTypes: ['IN_PERSON'], slotMinutes: 30, schedule: weekdays([1, 2, 3, 4, 5, 6], '10:00', '14:00'), online: false, bio: 'Root canal treatment, fillings and preventive dentistry.' },
  { id: 'doc_12', name: 'Dr. Sourav Pattnaik', gender: 'MALE', specialization: 'Neurologist', qualifications: 'MBBS, MD (Medicine), DM (Neurology)', experienceYears: 15, registrationNo: 'OMC/2009/14460', registrationCouncil: 'Odisha Medical Council', consultationFee: 900, languages: ['Odia', 'English'], affiliation: 'Kalinga Neuro Sciences', consultationTypes: ['VIDEO', 'IN_PERSON'], slotMinutes: 20, schedule: weekdays([4, 6], '11:00', '14:00'), online: false, bio: 'Headache, epilepsy, stroke follow-up and neuropathy.' },
]

export interface PatientSeed {
  name: string
  dob: string
  gender: Gender
  blood?: string
  allergies: string[]
  conditions: string[]
  area: string
}

export const PATIENTS: PatientSeed[] = [
  { name: 'Ramesh Chandra Patnaik', dob: '1958-04-12', gender: 'MALE', blood: 'B+', allergies: [], conditions: ['Type 2 diabetes', 'Hypertension'], area: 'Sahid Nagar' },
  { name: 'Sunita Mishra', dob: '1974-11-02', gender: 'FEMALE', blood: 'O+', allergies: ['Sulfa drugs'], conditions: ['Hypothyroidism'], area: 'Jaydev Vihar' },
  { name: 'Abhinav Sethi', dob: '1991-06-21', gender: 'MALE', allergies: [], conditions: [], area: 'Patia' },
  { name: 'Lipsa Behera', dob: '1996-02-14', gender: 'FEMALE', blood: 'A+', allergies: [], conditions: ['Asthma'], area: 'Nayapalli' },
  { name: 'Debasish Panda', dob: '1965-09-30', gender: 'MALE', blood: 'AB+', allergies: ['Penicillin'], conditions: ['Type 2 diabetes', 'Chronic kidney disease (stage 2)'], area: 'Old Town' },
  { name: 'Pratima Sahoo', dob: '1982-01-08', gender: 'FEMALE', allergies: [], conditions: [], area: 'Khandagiri' },
  { name: 'Sourav Mohapatra', dob: '1988-12-19', gender: 'MALE', blood: 'O-', allergies: [], conditions: ['Migraine'], area: 'Chandrasekharpur' },
  { name: 'Kalpana Jena', dob: '1951-09-03', gender: 'FEMALE', blood: 'B+', allergies: ['Aspirin'], conditions: ['Osteoarthritis', 'Hypertension'], area: 'Rasulgarh' },
  { name: 'Arvind Sharma', dob: '1979-05-27', gender: 'MALE', allergies: [], conditions: ['Dyslipidaemia'], area: 'Unit 4' },
  { name: 'Meera Pattanayak', dob: '1993-07-11', gender: 'FEMALE', blood: 'A-', allergies: [], conditions: [], area: 'Saheed Nagar' },
  { name: 'Biswajit Das', dob: '1970-03-15', gender: 'MALE', blood: 'O+', allergies: [], conditions: ['COPD'], area: 'Bomikhal' },
  { name: 'Ananya Tripathy', dob: '2001-10-09', gender: 'FEMALE', allergies: ['Dust mites'], conditions: ['Allergic rhinitis'], area: 'Kalpana Square' },
  { name: 'Prakash Swain', dob: '1985-08-23', gender: 'MALE', blood: 'B-', allergies: [], conditions: ['Asthma'], area: 'Laxmisagar' },
  { name: 'Smruti Rekha Parida', dob: '1990-04-04', gender: 'FEMALE', blood: 'O+', allergies: [], conditions: ['PCOS'], area: 'IRC Village' },
  { name: 'Gopal Krishna Rout', dob: '1962-01-27', gender: 'MALE', blood: 'A+', allergies: [], conditions: ['Coronary artery disease'], area: 'Baramunda' },
  { name: 'Nandini Acharya', dob: '1998-06-30', gender: 'FEMALE', allergies: [], conditions: [], area: 'Bapuji Nagar' },
  { name: 'Rohit Agarwal', dob: '1987-02-18', gender: 'MALE', blood: 'B+', allergies: ['Shellfish'], conditions: [], area: 'Master Canteen' },
  { name: 'Jyotirmayee Senapati', dob: '1976-12-01', gender: 'FEMALE', blood: 'AB-', allergies: [], conditions: ['Rheumatoid arthritis'], area: 'Palasuni' },
  { name: 'Aarav Mohanty', dob: '2019-03-22', gender: 'MALE', allergies: [], conditions: [], area: 'Vani Vihar' },
  { name: 'Ipsita Mohanty', dob: '1994-09-17', gender: 'FEMALE', blood: 'O+', allergies: [], conditions: ['Pregnancy (2nd trimester)'], area: 'Acharya Vihar' },
  { name: 'Manaswini Biswal', dob: '1983-05-06', gender: 'FEMALE', allergies: ['Ibuprofen'], conditions: [], area: 'Damana' },
  { name: 'Sanjay Kumar Nayak', dob: '1968-07-14', gender: 'MALE', blood: 'A+', allergies: [], conditions: ['Hypertension', 'Gout'], area: 'Kalinga Vihar' },
  { name: 'Riya Pradhan', dob: '2016-11-25', gender: 'FEMALE', allergies: ['Egg'], conditions: [], area: 'Patrapada' },
  { name: 'Tapan Kumar Swain', dob: '1955-02-09', gender: 'MALE', blood: 'B+', allergies: [], conditions: ['Parkinson’s disease'], area: 'Cuttack Road' },
  { name: 'Archana Rath', dob: '1989-08-02', gender: 'FEMALE', allergies: [], conditions: ['Iron-deficiency anaemia'], area: 'Gautam Nagar' },
  { name: 'Subrat Mallick', dob: '1997-01-29', gender: 'MALE', blood: 'O+', allergies: [], conditions: [], area: 'Jharpada' },
  { name: 'Pooja Sahu', dob: '1999-04-16', gender: 'FEMALE', allergies: [], conditions: ['Anxiety disorder'], area: 'Sailashree Vihar' },
  { name: 'Hemant Dash', dob: '1972-10-20', gender: 'MALE', blood: 'A-', allergies: ['Contrast dye'], conditions: ['Type 2 diabetes'], area: 'Mancheswar' },
  { name: 'Sarojini Das', dob: '1948-06-05', gender: 'FEMALE', blood: 'B+', allergies: [], conditions: ['Heart failure', 'Atrial fibrillation'], area: 'Old Town' },
  { name: 'Kunal Mohapatra', dob: '2008-12-12', gender: 'MALE', allergies: [], conditions: ['Asthma'], area: 'Niladri Vihar' },
  { name: 'Deepika Behera', dob: '1992-03-03', gender: 'FEMALE', blood: 'O+', allergies: [], conditions: [], area: 'Nayapalli' },
  { name: 'Ashutosh Pati', dob: '1980-07-07', gender: 'MALE', blood: 'AB+', allergies: [], conditions: ['Chronic back pain'], area: 'Kharavela Nagar' },
  { name: 'Lopamudra Jena', dob: '1986-09-13', gender: 'FEMALE', allergies: [], conditions: ['Hypothyroidism'], area: 'Saheed Nagar' },
  { name: 'Bijay Kumar Rout', dob: '1960-11-18', gender: 'MALE', blood: 'O+', allergies: [], conditions: ['COPD', 'Hypertension'], area: 'Rasulgarh' },
]

export interface RoomSeed {
  number: string
  type: RoomType
  department: string
  floor: string
  dailyRate: number
  beds: number
}

export const ROOMS: RoomSeed[] = [
  { number: 'ER-01', type: 'EMERGENCY', department: 'Emergency', floor: 'Ground', dailyRate: 2500, beds: 3 },
  { number: 'OBS-01', type: 'OBSERVATION', department: 'General Medicine', floor: 'Ground', dailyRate: 1200, beds: 4 },
  { number: 'GW-101', type: 'GENERAL_WARD', department: 'General Medicine', floor: '1st', dailyRate: 900, beds: 6 },
  { number: 'GW-102', type: 'GENERAL_WARD', department: 'Orthopaedics', floor: '1st', dailyRate: 900, beds: 6 },
  { number: 'SP-201', type: 'SEMI_PRIVATE', department: 'Cardiology', floor: '2nd', dailyRate: 1800, beds: 2 },
  { number: 'SP-202', type: 'SEMI_PRIVATE', department: 'General Medicine', floor: '2nd', dailyRate: 1800, beds: 2 },
  { number: 'PR-301', type: 'PRIVATE', department: 'Cardiology', floor: '3rd', dailyRate: 3500, beds: 1 },
  { number: 'PR-302', type: 'PRIVATE', department: 'General Medicine', floor: '3rd', dailyRate: 3500, beds: 1 },
  { number: 'PR-303', type: 'PRIVATE', department: 'Obstetrics & Gynaecology', floor: '3rd', dailyRate: 3800, beds: 1 },
]

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  facilityName: 'Saraswati Clinic & Day Care',
  departments: ['General Medicine', 'Cardiology', 'Paediatrics', 'Obstetrics & Gynaecology', 'Orthopaedics', 'Emergency', 'Pulmonology'],
  specializations: [...new Set(DOCTORS.map((d) => d.specialization))].sort(),
  admissionCharge: 500,
  videoProvider: 'NONE',
  videoBaseUrl: 'https://meet.jit.si',
  defaultSlotMinutes: 15,
  bookingWindowDays: 14,
  maxReportSizeMb: 10,
  serviceCatalog: [
    { code: 'NURS', name: 'Nursing care (per day)', rate: 600, taxRate: 0, category: 'TREATMENT' },
    { code: 'IVF', name: 'IV fluid administration', rate: 350, taxRate: 0, category: 'TREATMENT' },
    { code: 'NEB', name: 'Nebulisation', rate: 200, taxRate: 0, category: 'TREATMENT' },
    { code: 'ECG', name: 'ECG (12-lead)', rate: 300, taxRate: 0, category: 'SERVICE' },
    { code: 'CBC', name: 'Complete blood count', rate: 350, taxRate: 0, category: 'SERVICE' },
    { code: 'XRAY', name: 'X-ray (single view)', rate: 450, taxRate: 0, category: 'SERVICE' },
    { code: 'DRESS', name: 'Wound dressing', rate: 250, taxRate: 0, category: 'TREATMENT' },
    { code: 'O2', name: 'Oxygen therapy (per day)', rate: 800, taxRate: 0, category: 'TREATMENT' },
    { code: 'AMB', name: 'Ambulance (local)', rate: 1200, taxRate: 0, category: 'SERVICE' },
    { code: 'DIET', name: 'Dietician consultation', rate: 300, taxRate: 18, category: 'SERVICE' },
  ],
}


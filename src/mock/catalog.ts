/**
 * Static reference data used to seed demo mode. Brand names, manufacturers and
 * prices are illustrative approximations of products sold in Indian pharmacies;
 * they are sample data only and are not authoritative price lists.
 */
import type { AppSettings, AppUser, Customer, DosageForm, Permission, Role, RoleId, Supplier } from '../types/domain'

export type SeedProfile = 'normal' | 'low' | 'out' | 'expired' | 'near'

export interface CatalogEntry {
  name: string
  generic: string
  manufacturer: string
  category: string
  composition: string
  strength: string
  form: DosageForm
  pack: string
  hsn: string
  gst: number
  mrp: number
  /** Purchase cost as a fraction of MRP. */
  costRatio: number
  min: number
  /** Relative daily demand (units/day). */
  demand: number
  storage: string
  rx: boolean
  supplier: number
  profile: SeedProfile
}

const ROOM = 'Store below 25°C in a dry place, away from direct sunlight.'
const COOL = 'Store below 30°C. Protect from light and moisture.'
const FRIDGE = 'Store in a refrigerator (2°C – 8°C). Do not freeze.'
const LIQUID = 'Store below 25°C. Keep the bottle tightly closed. Shake well before use.'

export const CATALOG: CatalogEntry[] = [
  { name: 'Dolo 650', generic: 'Paracetamol', manufacturer: 'Micro Labs', category: 'Analgesics & Antipyretics', composition: 'Paracetamol 650 mg', strength: '650 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 33.6, costRatio: 0.72, min: 60, demand: 7, storage: ROOM, rx: false, supplier: 0, profile: 'near' },
  { name: 'Crocin Advance', generic: 'Paracetamol', manufacturer: 'GSK Consumer Healthcare', category: 'Analgesics & Antipyretics', composition: 'Paracetamol 500 mg', strength: '500 mg', form: 'Tablet', pack: 'Strip of 20 tablets', hsn: '30049099', gst: 12, mrp: 32, costRatio: 0.74, min: 40, demand: 4, storage: ROOM, rx: false, supplier: 1, profile: 'normal' },
  { name: 'Calpol 250 Suspension', generic: 'Paracetamol', manufacturer: 'GSK Pharmaceuticals', category: 'Analgesics & Antipyretics', composition: 'Paracetamol 250 mg / 5 ml', strength: '250 mg/5 ml', form: 'Suspension', pack: 'Bottle of 60 ml', hsn: '30049099', gst: 12, mrp: 42.5, costRatio: 0.75, min: 15, demand: 1.4, storage: LIQUID, rx: false, supplier: 1, profile: 'expired' },
  { name: 'Combiflam', generic: 'Ibuprofen + Paracetamol', manufacturer: 'Sanofi India', category: 'Analgesics & Antipyretics', composition: 'Ibuprofen 400 mg + Paracetamol 325 mg', strength: '400/325 mg', form: 'Tablet', pack: 'Strip of 20 tablets', hsn: '30049099', gst: 12, mrp: 45, costRatio: 0.73, min: 30, demand: 3, storage: ROOM, rx: false, supplier: 0, profile: 'normal' },
  { name: 'Meftal-Spas', generic: 'Mefenamic Acid + Dicyclomine', manufacturer: 'Blue Cross Laboratories', category: 'Analgesics & Antipyretics', composition: 'Mefenamic Acid 250 mg + Dicyclomine 10 mg', strength: '250/10 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30049099', gst: 12, mrp: 48, costRatio: 0.7, min: 25, demand: 2.2, storage: ROOM, rx: true, supplier: 2, profile: 'normal' },
  { name: 'Azithral 500', generic: 'Azithromycin', manufacturer: 'Alembic Pharmaceuticals', category: 'Antibiotics', composition: 'Azithromycin 500 mg', strength: '500 mg', form: 'Tablet', pack: 'Strip of 5 tablets', hsn: '30042019', gst: 12, mrp: 119.5, costRatio: 0.7, min: 20, demand: 1.8, storage: ROOM, rx: true, supplier: 2, profile: 'near' },
  { name: 'Augmentin 625 Duo', generic: 'Amoxicillin + Clavulanic Acid', manufacturer: 'GSK Pharmaceuticals', category: 'Antibiotics', composition: 'Amoxicillin 500 mg + Clavulanic Acid 125 mg', strength: '625 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30041030', gst: 12, mrp: 223.5, costRatio: 0.72, min: 15, demand: 1.5, storage: COOL, rx: true, supplier: 1, profile: 'normal' },
  { name: 'Moxikind-CV 625', generic: 'Amoxicillin + Clavulanic Acid', manufacturer: 'Mankind Pharma', category: 'Antibiotics', composition: 'Amoxicillin 500 mg + Clavulanic Acid 125 mg', strength: '625 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30041030', gst: 12, mrp: 198, costRatio: 0.66, min: 15, demand: 1.6, storage: COOL, rx: true, supplier: 3, profile: 'out' },
  { name: 'Ciplox 500', generic: 'Ciprofloxacin', manufacturer: 'Cipla', category: 'Antibiotics', composition: 'Ciprofloxacin 500 mg', strength: '500 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30042099', gst: 12, mrp: 62.5, costRatio: 0.7, min: 20, demand: 1.2, storage: ROOM, rx: true, supplier: 4, profile: 'normal' },
  { name: 'Taxim-O 200', generic: 'Cefixime', manufacturer: 'Alkem Laboratories', category: 'Antibiotics', composition: 'Cefixime 200 mg', strength: '200 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30042019', gst: 12, mrp: 109, costRatio: 0.69, min: 15, demand: 1.3, storage: ROOM, rx: true, supplier: 0, profile: 'normal' },
  { name: 'Pan 40', generic: 'Pantoprazole', manufacturer: 'Alkem Laboratories', category: 'Gastrointestinal', composition: 'Pantoprazole 40 mg', strength: '40 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 155, costRatio: 0.68, min: 30, demand: 3.4, storage: ROOM, rx: true, supplier: 0, profile: 'low' },
  { name: 'Pantocid DSR', generic: 'Pantoprazole + Domperidone', manufacturer: 'Sun Pharmaceutical', category: 'Gastrointestinal', composition: 'Pantoprazole 40 mg + Domperidone 30 mg (SR)', strength: '40/30 mg', form: 'Capsule', pack: 'Strip of 10 capsules', hsn: '30049099', gst: 12, mrp: 199, costRatio: 0.69, min: 20, demand: 2.1, storage: ROOM, rx: true, supplier: 3, profile: 'normal' },
  { name: 'Omez 20', generic: 'Omeprazole', manufacturer: "Dr. Reddy's Laboratories", category: 'Gastrointestinal', composition: 'Omeprazole 20 mg', strength: '20 mg', form: 'Capsule', pack: 'Strip of 20 capsules', hsn: '30049099', gst: 12, mrp: 62, costRatio: 0.7, min: 20, demand: 1.6, storage: ROOM, rx: true, supplier: 4, profile: 'normal' },
  { name: 'Digene Gel Mint', generic: 'Antacid (Aluminium + Magnesium Hydroxide)', manufacturer: 'Abbott India', category: 'Gastrointestinal', composition: 'Dried Aluminium Hydroxide Gel 300 mg + Magnesium Hydroxide 25 mg + Simethicone 25 mg / 10 ml', strength: '200 ml', form: 'Syrup', pack: 'Bottle of 200 ml', hsn: '30049099', gst: 12, mrp: 155, costRatio: 0.74, min: 12, demand: 1.1, storage: LIQUID, rx: false, supplier: 5, profile: 'expired' },
  { name: 'Gelusil MPS', generic: 'Antacid with Simethicone', manufacturer: 'Pfizer', category: 'Gastrointestinal', composition: 'Aluminium Hydroxide 250 mg + Magnesium Hydroxide 250 mg + Simethicone 50 mg / 5 ml', strength: '200 ml', form: 'Suspension', pack: 'Bottle of 200 ml', hsn: '30049099', gst: 12, mrp: 128, costRatio: 0.75, min: 10, demand: 0.8, storage: LIQUID, rx: false, supplier: 5, profile: 'normal' },
  { name: 'Cyclopam', generic: 'Dicyclomine + Paracetamol', manufacturer: 'Indoco Remedies', category: 'Gastrointestinal', composition: 'Dicyclomine 20 mg + Paracetamol 500 mg', strength: '20/500 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30049099', gst: 12, mrp: 54, costRatio: 0.7, min: 15, demand: 1.1, storage: ROOM, rx: true, supplier: 2, profile: 'normal' },
  { name: 'Sporlac DS', generic: 'Lactic Acid Bacillus', manufacturer: 'Sanzyme', category: 'Gastrointestinal', composition: 'Lactic Acid Bacillus 120 million spores', strength: '120 M', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30029030', gst: 12, mrp: 96, costRatio: 0.72, min: 12, demand: 0.9, storage: COOL, rx: false, supplier: 3, profile: 'normal' },
  { name: 'Duphalac Syrup', generic: 'Lactulose', manufacturer: 'Abbott India', category: 'Gastrointestinal', composition: 'Lactulose 10 g / 15 ml', strength: '200 ml', form: 'Syrup', pack: 'Bottle of 200 ml', hsn: '30049099', gst: 12, mrp: 285, costRatio: 0.76, min: 8, demand: 0.5, storage: LIQUID, rx: false, supplier: 5, profile: 'normal' },
  { name: 'Electral ORS', generic: 'Oral Rehydration Salts', manufacturer: 'FDC Limited', category: 'Gastrointestinal', composition: 'WHO ORS formula, 21.8 g', strength: '21.8 g', form: 'Sachet', pack: 'Sachet of 21.8 g', hsn: '30049099', gst: 12, mrp: 22, costRatio: 0.72, min: 50, demand: 4.5, storage: COOL, rx: false, supplier: 1, profile: 'normal' },
  { name: 'Allegra 120', generic: 'Fexofenadine', manufacturer: 'Sanofi India', category: 'Allergy & Antihistamines', composition: 'Fexofenadine Hydrochloride 120 mg', strength: '120 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30049099', gst: 12, mrp: 224, costRatio: 0.72, min: 15, demand: 1.3, storage: ROOM, rx: false, supplier: 0, profile: 'near' },
  { name: 'Montair LC', generic: 'Montelukast + Levocetirizine', manufacturer: 'Cipla', category: 'Allergy & Antihistamines', composition: 'Montelukast 10 mg + Levocetirizine 5 mg', strength: '10/5 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 268, costRatio: 0.68, min: 20, demand: 2, storage: ROOM, rx: true, supplier: 4, profile: 'normal' },
  { name: 'Cetzine 10', generic: 'Cetirizine', manufacturer: "Dr. Reddy's Laboratories", category: 'Allergy & Antihistamines', composition: 'Cetirizine Hydrochloride 10 mg', strength: '10 mg', form: 'Tablet', pack: 'Strip of 10 tablets', hsn: '30049099', gst: 12, mrp: 22, costRatio: 0.7, min: 30, demand: 2.6, storage: ROOM, rx: false, supplier: 4, profile: 'normal' },
  { name: 'Avil 25', generic: 'Pheniramine Maleate', manufacturer: 'Sanofi India', category: 'Allergy & Antihistamines', composition: 'Pheniramine Maleate 25 mg', strength: '25 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 17, costRatio: 0.72, min: 20, demand: 1.2, storage: ROOM, rx: false, supplier: 0, profile: 'normal' },
  { name: 'Telma 40', generic: 'Telmisartan', manufacturer: 'Glenmark Pharmaceuticals', category: 'Cardiovascular', composition: 'Telmisartan 40 mg', strength: '40 mg', form: 'Tablet', pack: 'Strip of 30 tablets', hsn: '30049099', gst: 12, mrp: 268, costRatio: 0.66, min: 25, demand: 2.4, storage: ROOM, rx: true, supplier: 2, profile: 'low' },
  { name: 'Amlokind 5', generic: 'Amlodipine', manufacturer: 'Mankind Pharma', category: 'Cardiovascular', composition: 'Amlodipine 5 mg', strength: '5 mg', form: 'Tablet', pack: 'Strip of 30 tablets', hsn: '30049099', gst: 12, mrp: 48, costRatio: 0.62, min: 20, demand: 1.9, storage: ROOM, rx: true, supplier: 3, profile: 'normal' },
  { name: 'Ecosprin 75', generic: 'Aspirin', manufacturer: 'USV', category: 'Cardiovascular', composition: 'Aspirin (Gastro-resistant) 75 mg', strength: '75 mg', form: 'Tablet', pack: 'Strip of 14 tablets', hsn: '30049099', gst: 12, mrp: 7.5, costRatio: 0.7, min: 40, demand: 3.2, storage: ROOM, rx: true, supplier: 1, profile: 'normal' },
  { name: 'Atorva 10', generic: 'Atorvastatin', manufacturer: 'Zydus Lifesciences', category: 'Cardiovascular', composition: 'Atorvastatin 10 mg', strength: '10 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 118, costRatio: 0.66, min: 20, demand: 1.6, storage: ROOM, rx: true, supplier: 2, profile: 'normal' },
  { name: 'Rosuvas 10', generic: 'Rosuvastatin', manufacturer: 'Sun Pharmaceutical', category: 'Cardiovascular', composition: 'Rosuvastatin 10 mg', strength: '10 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 245, costRatio: 0.65, min: 15, demand: 1.2, storage: ROOM, rx: true, supplier: 3, profile: 'out' },
  { name: 'Glycomet GP 1', generic: 'Glimepiride + Metformin', manufacturer: 'USV', category: 'Antidiabetic', composition: 'Glimepiride 1 mg + Metformin 500 mg (SR)', strength: '1/500 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 128, costRatio: 0.66, min: 30, demand: 3, storage: ROOM, rx: true, supplier: 1, profile: 'normal' },
  { name: 'Istamet 50/500', generic: 'Sitagliptin + Metformin', manufacturer: 'Sun Pharmaceutical', category: 'Antidiabetic', composition: 'Sitagliptin 50 mg + Metformin 500 mg', strength: '50/500 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30049099', gst: 12, mrp: 372, costRatio: 0.67, min: 15, demand: 1.1, storage: ROOM, rx: true, supplier: 3, profile: 'normal' },
  { name: 'Huminsulin 30/70', generic: 'Human Insulin (Biphasic)', manufacturer: 'Eli Lilly', category: 'Antidiabetic', composition: 'Human Insulin 30% soluble + 70% isophane, 40 IU/ml', strength: '40 IU/ml', form: 'Injection', pack: 'Vial of 10 ml', hsn: '30043110', gst: 5, mrp: 168, costRatio: 0.8, min: 10, demand: 0.9, storage: FRIDGE, rx: true, supplier: 5, profile: 'low' },
  { name: 'Thyronorm 50', generic: 'Thyroxine Sodium', manufacturer: 'Abbott India', category: 'Thyroid & Hormones', composition: 'Thyroxine Sodium 50 mcg', strength: '50 mcg', form: 'Tablet', pack: 'Bottle of 100 tablets', hsn: '30043900', gst: 12, mrp: 178, costRatio: 0.7, min: 12, demand: 1.2, storage: COOL, rx: true, supplier: 5, profile: 'low' },
  { name: 'Eltroxin 25', generic: 'Thyroxine Sodium', manufacturer: 'GSK Pharmaceuticals', category: 'Thyroid & Hormones', composition: 'Thyroxine Sodium 25 mcg', strength: '25 mcg', form: 'Tablet', pack: 'Bottle of 120 tablets', hsn: '30043900', gst: 12, mrp: 139, costRatio: 0.71, min: 8, demand: 0.6, storage: COOL, rx: true, supplier: 1, profile: 'normal' },
  { name: 'Shelcal 500', generic: 'Calcium + Vitamin D3', manufacturer: 'Torrent Pharmaceuticals', category: 'Vitamins & Supplements', composition: 'Calcium Carbonate 1250 mg + Vitamin D3 250 IU', strength: '500 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30045090', gst: 12, mrp: 128, costRatio: 0.68, min: 25, demand: 2.3, storage: ROOM, rx: false, supplier: 2, profile: 'low' },
  { name: 'Becosules Z', generic: 'B-Complex with Zinc', manufacturer: 'Pfizer', category: 'Vitamins & Supplements', composition: 'Vitamin B-Complex + Vitamin C + Zinc Sulphate', strength: '—', form: 'Capsule', pack: 'Strip of 20 capsules', hsn: '30045090', gst: 12, mrp: 53, costRatio: 0.72, min: 25, demand: 2.5, storage: ROOM, rx: false, supplier: 5, profile: 'normal' },
  { name: 'Limcee 500', generic: 'Vitamin C', manufacturer: 'Abbott India', category: 'Vitamins & Supplements', composition: 'Ascorbic Acid 500 mg (chewable)', strength: '500 mg', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '30045090', gst: 12, mrp: 26, costRatio: 0.72, min: 30, demand: 2.4, storage: COOL, rx: false, supplier: 5, profile: 'near' },
  { name: 'Zincovit', generic: 'Multivitamin with Zinc', manufacturer: 'Apex Laboratories', category: 'Vitamins & Supplements', composition: 'Multivitamin, Multimineral with Grape Seed Extract', strength: '—', form: 'Tablet', pack: 'Strip of 15 tablets', hsn: '21069099', gst: 18, mrp: 110, costRatio: 0.7, min: 20, demand: 1.7, storage: ROOM, rx: false, supplier: 4, profile: 'normal' },
  { name: 'Neurobion Forte', generic: 'Vitamin B1, B6, B12', manufacturer: 'P&G Health', category: 'Vitamins & Supplements', composition: 'Thiamine 10 mg + Pyridoxine 3 mg + Cyanocobalamin 15 mcg + others', strength: '—', form: 'Tablet', pack: 'Strip of 30 tablets', hsn: '30045090', gst: 12, mrp: 37, costRatio: 0.73, min: 25, demand: 2, storage: ROOM, rx: false, supplier: 0, profile: 'normal' },
  { name: 'Ascoril LS Syrup', generic: 'Ambroxol + Levosalbutamol + Guaifenesin', manufacturer: 'Glenmark Pharmaceuticals', category: 'Respiratory', composition: 'Ambroxol 30 mg + Levosalbutamol 1 mg + Guaifenesin 50 mg / 5 ml', strength: '100 ml', form: 'Syrup', pack: 'Bottle of 100 ml', hsn: '30049099', gst: 12, mrp: 118, costRatio: 0.7, min: 15, demand: 1.7, storage: LIQUID, rx: true, supplier: 2, profile: 'near' },
  { name: 'Benadryl Cough Formula', generic: 'Diphenhydramine + Ammonium Chloride', manufacturer: 'Kenvue', category: 'Respiratory', composition: 'Diphenhydramine 14.08 mg + Ammonium Chloride 138 mg / 5 ml', strength: '150 ml', form: 'Syrup', pack: 'Bottle of 150 ml', hsn: '30049099', gst: 12, mrp: 139, costRatio: 0.74, min: 12, demand: 1.2, storage: LIQUID, rx: false, supplier: 1, profile: 'expired' },
  { name: 'Grilinctus Syrup', generic: 'Dextromethorphan + Chlorpheniramine', manufacturer: 'Franco-Indian Pharmaceuticals', category: 'Respiratory', composition: 'Dextromethorphan 5 mg + Chlorpheniramine 2.5 mg / 5 ml', strength: '100 ml', form: 'Syrup', pack: 'Bottle of 100 ml', hsn: '30049099', gst: 12, mrp: 109, costRatio: 0.72, min: 10, demand: 0.9, storage: LIQUID, rx: true, supplier: 4, profile: 'normal' },
  { name: 'Asthalin Inhaler', generic: 'Salbutamol', manufacturer: 'Cipla', category: 'Respiratory', composition: 'Salbutamol 100 mcg per actuation, 200 MDI', strength: '100 mcg', form: 'Inhaler', pack: 'Inhaler of 200 doses', hsn: '30049099', gst: 12, mrp: 155, costRatio: 0.72, min: 8, demand: 0.7, storage: ROOM, rx: true, supplier: 4, profile: 'normal' },
  { name: 'Budecort 200 Inhaler', generic: 'Budesonide', manufacturer: 'Cipla', category: 'Respiratory', composition: 'Budesonide 200 mcg per actuation, 200 MDI', strength: '200 mcg', form: 'Inhaler', pack: 'Inhaler of 200 doses', hsn: '30043900', gst: 12, mrp: 420, costRatio: 0.72, min: 5, demand: 0.4, storage: ROOM, rx: true, supplier: 4, profile: 'out' },
  { name: 'Otrivin Nasal Drops', generic: 'Xylometazoline', manufacturer: 'Haleon', category: 'Eye, Ear & Nasal', composition: 'Xylometazoline Hydrochloride 0.1% w/v', strength: '0.1%', form: 'Drops', pack: 'Bottle of 10 ml', hsn: '30049099', gst: 12, mrp: 98, costRatio: 0.74, min: 10, demand: 0.9, storage: COOL, rx: false, supplier: 1, profile: 'normal' },
  { name: 'Ciplox Eye/Ear Drops', generic: 'Ciprofloxacin', manufacturer: 'Cipla', category: 'Eye, Ear & Nasal', composition: 'Ciprofloxacin 0.3% w/v', strength: '0.3%', form: 'Drops', pack: 'Bottle of 5 ml', hsn: '30042099', gst: 12, mrp: 22, costRatio: 0.7, min: 12, demand: 0.9, storage: COOL, rx: true, supplier: 4, profile: 'expired' },
  { name: 'Volini Gel', generic: 'Diclofenac + Menthol + Linseed Oil', manufacturer: 'Sun Pharmaceutical', category: 'Topical Pain Relief', composition: 'Diclofenac Diethylamine 1.16% + Methyl Salicylate + Menthol + Linseed Oil', strength: '30 g', form: 'Gel', pack: 'Tube of 30 g', hsn: '30049099', gst: 12, mrp: 125, costRatio: 0.73, min: 12, demand: 1.1, storage: ROOM, rx: false, supplier: 3, profile: 'near' },
  { name: 'Moov Pain Relief Cream', generic: 'Herbal Analgesic', manufacturer: 'Reckitt Benckiser', category: 'Topical Pain Relief', composition: 'Wintergreen Oil + Eucalyptus Oil + Menthol + Turpentine Oil', strength: '50 g', form: 'Cream', pack: 'Tube of 50 g', hsn: '30049011', gst: 12, mrp: 199, costRatio: 0.75, min: 10, demand: 0.8, storage: ROOM, rx: false, supplier: 5, profile: 'normal' },
  { name: 'Betadine 10% Ointment', generic: 'Povidone-Iodine', manufacturer: 'Win-Medicare', category: 'Dermatology & First Aid', composition: 'Povidone-Iodine 10% w/w', strength: '10%', form: 'Ointment', pack: 'Tube of 20 g', hsn: '30049099', gst: 12, mrp: 128, costRatio: 0.73, min: 10, demand: 0.8, storage: ROOM, rx: false, supplier: 0, profile: 'normal' },
  { name: 'Soframycin Cream', generic: 'Framycetin', manufacturer: 'Sanofi India', category: 'Dermatology & First Aid', composition: 'Framycetin Sulphate 1% w/w', strength: '1%', form: 'Cream', pack: 'Tube of 30 g', hsn: '30042099', gst: 12, mrp: 70, costRatio: 0.72, min: 10, demand: 0.8, storage: ROOM, rx: false, supplier: 0, profile: 'normal' },
  { name: 'Candid Cream', generic: 'Clotrimazole', manufacturer: 'Glenmark Pharmaceuticals', category: 'Dermatology & First Aid', composition: 'Clotrimazole 1% w/w', strength: '1%', form: 'Cream', pack: 'Tube of 20 g', hsn: '30049099', gst: 12, mrp: 122, costRatio: 0.71, min: 10, demand: 0.9, storage: ROOM, rx: false, supplier: 2, profile: 'near' },
  { name: 'Dettol Antiseptic Liquid', generic: 'Chloroxylenol', manufacturer: 'Reckitt Benckiser', category: 'Dermatology & First Aid', composition: 'Chloroxylenol 4.8% w/v', strength: '250 ml', form: 'Spray', pack: 'Bottle of 250 ml', hsn: '38089400', gst: 18, mrp: 145, costRatio: 0.8, min: 10, demand: 0.9, storage: ROOM, rx: false, supplier: 5, profile: 'normal' },
  { name: 'Liv.52', generic: 'Herbal Hepatoprotective', manufacturer: 'Himalaya Wellness', category: 'Ayurvedic & Herbal', composition: 'Himsra, Kasani, Mandur Bhasma and other herbs', strength: '—', form: 'Tablet', pack: 'Bottle of 100 tablets', hsn: '30039011', gst: 12, mrp: 160, costRatio: 0.74, min: 10, demand: 0.8, storage: ROOM, rx: false, supplier: 3, profile: 'normal' },
  { name: 'Accu-Chek Active Strips', generic: 'Blood Glucose Test Strips', manufacturer: 'Roche Diabetes Care', category: 'Devices & Diagnostics', composition: 'Glucose test strips for Accu-Chek Active meter', strength: '50 strips', form: 'Device', pack: 'Box of 50 strips', hsn: '38220090', gst: 12, mrp: 1110, costRatio: 0.82, min: 6, demand: 0.35, storage: 'Store between 2°C and 32°C. Close the vial immediately after removing a strip.', rx: false, supplier: 5, profile: 'low' },
]

const odishaAddr = (line1: string, city: string, pincode: string) => ({ line1, city, state: 'Odisha', pincode })

export const SUPPLIERS: Omit<Supplier, 'id' | 'createdAt'>[] = [
  { name: 'Kalinga Pharma Distributors', contactPerson: 'Sanjay Mohanty', phone: '+91 94370 21145', email: 'orders@kalingapharma.in', gstin: '21AAKFK4512L1Z8', drugLicenseNo: 'OD-KH-20B-11823', address: odishaAddr('Plot 42, Rasulgarh Industrial Estate', 'Bhubaneswar', '751010'), paymentTermsDays: 30, openingBalance: 0, notes: 'Primary distributor for analgesics and Sanofi range. Weekly delivery on Mondays.', isActive: true },
  { name: 'Utkal Medical Agencies', contactPerson: 'Priyanka Das', phone: '+91 98610 44872', email: 'utkalmedical@gmail.com', gstin: '21AABFU7731Q1ZK', drugLicenseNo: 'OD-KH-20B-09341', address: odishaAddr('Unit 3, Bapuji Nagar Market', 'Bhubaneswar', '751009'), paymentTermsDays: 21, openingBalance: 0, notes: 'GSK and FDC stockist.', isActive: true },
  { name: 'Shree Jagannath Drug House', contactPerson: 'Bikash Pradhan', phone: '+91 99370 66120', email: 'sjdh.ctc@outlook.com', gstin: '21ABCPS9913M1ZQ', drugLicenseNo: 'OD-CU-20B-07215', address: odishaAddr('Chandni Chowk, Near Choudhury Bazar', 'Cuttack', '753001'), paymentTermsDays: 30, openingBalance: 0, isActive: true },
  { name: 'Mahanadi Healthcare LLP', contactPerson: 'Ritesh Agarwal', phone: '+91 90400 18833', email: 'accounts@mahanadihealth.co.in', gstin: '21AAWFM2201C1Z3', drugLicenseNo: 'OD-KH-20B-14408', address: odishaAddr('2nd Floor, Janpath Tower, Saheed Nagar', 'Bhubaneswar', '751007'), paymentTermsDays: 45, openingBalance: 0, notes: 'Sun Pharma and Mankind super-stockist. Credit limit ₹3,00,000.', isActive: true },
  { name: 'Konark Pharma Traders', contactPerson: 'Ananya Rath', phone: '+91 94381 50926', email: 'konarkpharma@yahoo.in', gstin: '21AAHFK6690R1ZB', drugLicenseNo: 'OD-PU-20B-03377', address: odishaAddr('Grand Road, Badadanda Sahi', 'Puri', '752001'), paymentTermsDays: 15, openingBalance: 0, notes: 'Cipla, Dr. Reddy\'s and respiratory range.', isActive: true },
  { name: 'Eastern Surgicals & Pharma', contactPerson: 'Manoj Kumar Sahu', phone: '+91 93380 77014', email: 'eastern.surgicals@gmail.com', gstin: '21AAECE3348P1ZT', drugLicenseNo: 'OD-KH-21B-05562', address: odishaAddr('B-17, Mancheswar Industrial Estate', 'Bhubaneswar', '751017'), paymentTermsDays: 30, openingBalance: 0, notes: 'Cold-chain capable. Insulin, Abbott range and diagnostics.', isActive: true },
]

export const CUSTOMERS: Omit<Customer, 'id' | 'createdAt'>[] = [
  { name: 'Ramesh Chandra Patnaik', phone: '+91 94370 11223', address: 'Plot 112, Sahid Nagar, Bhubaneswar', notes: 'Regular — hypertension & diabetes medication monthly.', dateOfBirth: '1958-04-12' },
  { name: 'Sunita Mishra', phone: '+91 98611 23409', email: 'sunita.mishra@gmail.com', address: 'Jaydev Vihar, Bhubaneswar', notes: 'Prefers UPI. Thyroid medication.' },
  { name: 'Abhishek Nayak', phone: '+91 70081 55432', address: 'Patia, Bhubaneswar' },
  { name: 'Lipsa Behera', phone: '+91 96921 77310', email: 'lipsa.b@outlook.com', address: 'Nayapalli, Bhubaneswar' },
  { name: 'Debasish Panda', phone: '+91 94390 88021', address: 'Old Town, Bhubaneswar', notes: 'Insulin — keep a vial reserved when stock arrives.' },
  { name: 'Pratima Sahoo', phone: '+91 99380 41276', address: 'Khandagiri, Bhubaneswar' },
  { name: 'Sourav Mohapatra', phone: '+91 80180 66234', email: 'sourav.m@gmail.com', address: 'Chandrasekharpur, Bhubaneswar' },
  { name: 'Kalpana Jena', phone: '+91 94371 90876', address: 'Rasulgarh, Bhubaneswar', notes: 'Senior citizen — home delivery requested occasionally.', dateOfBirth: '1951-09-03' },
  { name: 'Arvind Sharma', phone: '+91 98530 12457', address: 'Unit 4, Bhubaneswar' },
  { name: 'Meera Pattanayak', phone: '+91 70089 34561', email: 'meera.p@yahoo.com', address: 'Saheed Nagar, Bhubaneswar' },
  { name: 'Biswajit Das', phone: '+91 96582 23018', address: 'Bomikhal, Bhubaneswar' },
  { name: 'Ananya Tripathy', phone: '+91 79788 45620', address: 'Kalpana Square, Bhubaneswar' },
  { name: 'Prakash Swain', phone: '+91 94372 67755', address: 'Laxmisagar, Bhubaneswar', notes: 'Asthma — inhaler refills.' },
  { name: 'Smruti Rekha Parida', phone: '+91 99371 20984', email: 'smruti.parida@gmail.com', address: 'IRC Village, Bhubaneswar' },
  { name: 'Gopal Krishna Rout', phone: '+91 90903 11876', address: 'Baramunda, Bhubaneswar', dateOfBirth: '1962-01-27' },
  { name: 'Nandini Acharya', phone: '+91 98614 55093', address: 'Bapuji Nagar, Bhubaneswar' },
  { name: 'Rohit Agarwal', phone: '+91 97765 30042', email: 'rohit.agarwal@gmail.com', address: 'Master Canteen, Bhubaneswar' },
  { name: 'Jyotirmayee Senapati', phone: '+91 94380 72219', address: 'Palasuni, Bhubaneswar' },
  { name: 'Subhash Chandra Bose Mallick', phone: '+91 99372 68830', address: 'Vani Vihar, Bhubaneswar' },
  { name: 'Ipsita Mohanty', phone: '+91 70773 91254', address: 'Acharya Vihar, Bhubaneswar' },
  { name: 'Dr. Satyajit Kar', phone: '+91 94371 00456', email: 'dr.skar@clinicmail.in', address: 'Kar Clinic, Unit 9, Bhubaneswar', notes: 'Local GP — bulk purchases for clinic.' },
  { name: 'Manaswini Biswal', phone: '+91 96685 14327', address: 'Damana, Bhubaneswar' },
]

const PHARMACY_ROLES: Role[] = [
  {
    id: 'ADMIN',
    name: 'Administrator',
    description: 'Full access to every module, configuration, users and approvals.',
    maxDiscountPct: 100,
    permissions: [
      'dashboard.view', 'medicines.view', 'medicines.manage', 'inventory.view', 'inventory.adjust', 'inventory.approve',
      'inventory.transfer', 'sales.pos', 'sales.view', 'sales.overrideFefo', 'sales.discount.extended', 'returns.request',
      'returns.approve', 'purchases.view', 'purchases.manage', 'purchases.receive', 'suppliers.view', 'suppliers.manage',
      'suppliers.payments', 'customers.view', 'customers.manage', 'reports.view', 'admin.users', 'admin.settings', 'demo.reset',
      'orders.view', 'orders.manage', 'orders.verifyRx',
    ],
  },
  {
    id: 'STORE_MANAGER',
    name: 'Store Manager',
    description: 'Runs daily operations: purchasing, suppliers, approvals and reports.',
    maxDiscountPct: 20,
    permissions: [
      'dashboard.view', 'medicines.view', 'medicines.manage', 'inventory.view', 'inventory.adjust', 'inventory.approve',
      'inventory.transfer', 'sales.pos', 'sales.view', 'sales.overrideFefo', 'sales.discount.extended', 'returns.request',
      'returns.approve', 'purchases.view', 'purchases.manage', 'purchases.receive', 'suppliers.view', 'suppliers.manage',
      'suppliers.payments', 'customers.view', 'customers.manage', 'reports.view', 'orders.view', 'orders.manage', 'orders.verifyRx',
    ],
  },
  {
    id: 'PHARMACIST',
    name: 'Pharmacist',
    description: 'Dispenses medicines, manages the catalogue and inventory, receives stock.',
    maxDiscountPct: 10,
    permissions: [
      'dashboard.view', 'medicines.view', 'medicines.manage', 'inventory.view', 'inventory.adjust', 'inventory.transfer',
      'sales.pos', 'sales.view', 'sales.overrideFefo', 'returns.request', 'purchases.view', 'purchases.receive',
      'suppliers.view', 'customers.view', 'customers.manage', 'orders.view', 'orders.manage', 'orders.verifyRx',
    ],
  },
  {
    id: 'SALES_OPERATOR',
    name: 'Sales Operator',
    description: 'Counter billing, customer lookup and return requests.',
    maxDiscountPct: 5,
    permissions: ['dashboard.view', 'medicines.view', 'inventory.view', 'sales.pos', 'sales.view', 'returns.request', 'customers.view', 'customers.manage', 'orders.view', 'orders.manage'],
  },
]

// Healthcare permissions layered onto the pharmacy roles, plus the new clinical roles.
// Prescription issuing, consultations, clinical notes and discharge approval are
// reserved for the Doctor role — pharmacy and admin roles never receive them.
const HC_VIEW: Permission[] = ['doctors.view', 'appointments.view', 'patients.view', 'admissions.view', 'beds.view', 'clinical.view', 'prescriptions.view', 'billing.view']
const HEALTHCARE_EXTRA: Partial<Record<RoleId, Permission[]>> = {
  ADMIN: [...HC_VIEW, 'doctors.manage', 'appointments.manage', 'patients.manage', 'admissions.manage', 'admissions.approve', 'beds.manage', 'discharge.request', 'billing.manage', 'prescriptions.fulfil'],
  STORE_MANAGER: [...HC_VIEW, 'doctors.manage', 'admissions.approve', 'beds.manage', 'billing.manage', 'prescriptions.fulfil'],
  PHARMACIST: ['prescriptions.view', 'prescriptions.fulfil', 'patients.view', 'doctors.view'],
}

const CLINICAL_ROLES: Role[] = [
  {
    id: 'DOCTOR',
    name: 'Doctor',
    description: 'Consults patients, issues prescriptions, records clinical notes and approves discharges.',
    maxDiscountPct: 0,
    permissions: ['dashboard.view', 'medicines.view', 'doctors.view', 'appointments.view', 'appointments.manage', 'consultations.conduct', 'prescriptions.view', 'prescriptions.issue', 'patients.view', 'admissions.view', 'admissions.approve', 'beds.view', 'clinical.view', 'clinical.record', 'clinical.notes', 'discharge.request', 'discharge.approve'],
  },
  {
    id: 'RECEPTIONIST',
    name: 'Receptionist',
    description: 'Registers patients, schedules consultations, raises admission requests and allocates beds.',
    maxDiscountPct: 0,
    permissions: ['dashboard.view', 'doctors.view', 'appointments.view', 'appointments.manage', 'patients.view', 'patients.manage', 'admissions.view', 'admissions.manage', 'beds.view', 'beds.manage', 'customers.view', 'billing.view'],
  },
  {
    id: 'NURSE',
    name: 'Nurse',
    description: 'Cares for inpatients: records vital signs, medication administration and observations.',
    maxDiscountPct: 0,
    permissions: ['dashboard.view', 'patients.view', 'admissions.view', 'beds.view', 'clinical.view', 'clinical.record', 'prescriptions.view', 'discharge.request'],
  },
  {
    id: 'BILLING_OPERATOR',
    name: 'Billing Operator',
    description: 'Manages patient accounts, charges, advances, payments and final bills.',
    maxDiscountPct: 10,
    permissions: ['dashboard.view', 'patients.view', 'admissions.view', 'billing.view', 'billing.manage', 'sales.view'],
  },
]

/** Permissions that only the Doctor role may hold (enforced in saveRole too). */
export const DOCTOR_ONLY_PERMISSIONS: Permission[] = ['prescriptions.issue', 'consultations.conduct', 'clinical.notes', 'discharge.approve']

export const ROLES: Role[] = [
  ...PHARMACY_ROLES.map((r) => ({ ...r, permissions: [...new Set([...r.permissions, ...(HEALTHCARE_EXTRA[r.id] ?? [])])] })),
  ...CLINICAL_ROLES,
]

export const USERS: Omit<AppUser, 'createdAt'>[] = [
  { id: 'usr_admin', name: 'Pravat Ranjan Parhi', email: 'admin@saraswatimedicines.in', phone: '+91 94370 00001', roleId: 'ADMIN', isActive: true },
  { id: 'usr_manager', name: 'Sasmita Rout', email: 'manager@saraswatimedicines.in', phone: '+91 94370 00002', roleId: 'STORE_MANAGER', isActive: true },
  { id: 'usr_pharmacist', name: 'Dr. Ashok Kumar Dash', email: 'pharmacist@saraswatimedicines.in', phone: '+91 94370 00003', roleId: 'PHARMACIST', isActive: true },
  { id: 'usr_sales', name: 'Rakesh Behera', email: 'counter@saraswatimedicines.in', phone: '+91 94370 00004', roleId: 'SALES_OPERATOR', isActive: true },
  { id: 'usr_sales2', name: 'Pooja Nayak', email: 'counter2@saraswatimedicines.in', phone: '+91 94370 00005', roleId: 'SALES_OPERATOR', isActive: false },
  { id: 'usr_doctor', name: 'Dr. Ananya Mishra', email: 'dr.ananya@saraswaticlinic.in', phone: '+91 94370 00011', roleId: 'DOCTOR', doctorId: 'doc_01', isActive: true },
  { id: 'usr_doctor2', name: 'Dr. Rajesh Kumar Sahu', email: 'dr.rajesh@saraswaticlinic.in', phone: '+91 94370 00012', roleId: 'DOCTOR', doctorId: 'doc_02', isActive: true },
  { id: 'usr_reception', name: 'Swati Jena', email: 'reception@saraswaticlinic.in', phone: '+91 94370 00013', roleId: 'RECEPTIONIST', isActive: true },
  { id: 'usr_nurse', name: 'Sr. Mamata Pradhan', email: 'nurse@saraswaticlinic.in', phone: '+91 94370 00014', roleId: 'NURSE', isActive: true },
  { id: 'usr_billing', name: 'Alok Ranjan Das', email: 'billing@saraswaticlinic.in', phone: '+91 94370 00015', roleId: 'BILLING_OPERATOR', isActive: true },
]

export const DEFAULT_SETTINGS: AppSettings = {
  store: {
    name: 'Saraswati Medicines Store',
    tagline: 'Care you can trust',
    addressLine: 'Shop No. 7, Saraswati Complex, Janpath',
    city: 'Bhubaneswar',
    state: 'Odisha',
    pincode: '751001',
    phone: '+91 674 255 0101',
    email: 'care@saraswatimedicines.in',
    gstin: '21ABCFS1234K1Z5',
    drugLicenseNo: 'OD-KH-20B-12345 / 21B-12346',
  },
  nearExpiryDays: 90,
  criticalExpiryDays: 30,
  pricesIncludeGst: true,
  roundOffInvoice: true,
  gstRates: [0, 5, 12, 18],
  categories: [...new Set(CATALOG.map((c) => c.category))].sort(),
  dosageForms: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Ointment', 'Cream', 'Gel', 'Drops', 'Inhaler', 'Powder', 'Sachet', 'Spray', 'Device'],
  locations: ['Main Shelf', 'Back Store', 'Cold Storage'],
  enableStockTransfers: true,
  adjustmentApprovalThreshold: 10,
  returnApprovalThreshold: 500,
  invoicePrefix: 'SMS',
  poPrefix: 'PO',
  defaultPaymentTermsDays: 30,
  lowStockAlertsEnabled: true,
  expiryAlertsEnabled: true,
  onlineOrdersEnabled: true,
  onlineDeliveryEnabled: true,
  onlineMinOrderValue: 0,
  onlineMaxQtyPerItem: 10,
  deliveryAreaNote: 'Home delivery within 5 km of Janpath, Bhubaneswar. Orders confirmed by 6 pm are delivered the same day.',
}

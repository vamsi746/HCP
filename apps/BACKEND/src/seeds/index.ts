import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database';
import { Officer, Zone, Division, Circle, PoliceStation, Sector, SectorOfficer } from '../models';

// ── Types ──────────────────────────────────────────────────────────────────
interface SeedOfficerData {
  name: string;
  phone: string;
  role: string; // e.g. 'Sector-I', 'Admin', 'DSI', 'Sector-I & Admin'
  type?: 'DIRECT' | 'RANKER'; // recruitment type
  rank?: string; // SI, WSI, PSI etc.
  batch?: number; // year
  remarks?: string;
}

interface SeedStationData {
  name: string;
  code: string;
  officers: SeedOfficerData[];
}

interface SeedZoneData {
  name: string;
  code: string;
  stations: SeedStationData[];
}

// ── Zone Data ──────────────────────────────────────────────────────────────
const ZONES: SeedZoneData[] = [
  // ─── 1. CHARMINAR ZONE ───────────────────────────────────────────────────
  {
    name: 'Charminar Zone', code: 'CZ',
    stations: [
      { name: 'Charminar', code: 'PS-CHM', officers: [
        { name: 'Sri B Praveen Kumar', phone: '9441000900, 8712571864', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Sri K Ramesh', phone: '8712571778', role: 'Sector 4', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Sri V Raja Shekar', phone: '6303290479', role: 'Sector 1 & 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Sri G Sateesh Reddy', phone: '8712571488', role: 'DSI', type: 'DIRECT', rank: 'SI', batch: 2014 },
        { name: 'Sri L Buchi Reddy', phone: '8712571683', role: 'Admin', type: 'RANKER', rank: 'SI', batch: 1985 },
      ]},
      { name: 'Hussainialam', code: 'PS-HUS', officers: [
        { name: 'D. Bhaskar Reddy', phone: '8712571502', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2012 },
        { name: 'K Srinivas Teja', phone: '8712571856', role: 'Admin/Sector 3 & 4', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'G Priyanka', phone: '8712571923', role: 'Maternity Leave', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'S Praveen Kumar', phone: '8712549749', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'Mohd Rasheed Miya', phone: '8712567016', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 2025 },
      ]},
      { name: 'Mirchowk', code: 'PS-MIR', officers: [
        { name: 'Chitram Anitha', phone: '8712660353', role: 'Admin/Sector 1', type: 'DIRECT', rank: 'WSI', batch: 2020 },
        { name: 'P Krishnaiah', phone: '8712661632', role: 'DSI / Sector 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'R. Rajashekar Reddy', phone: '8712572115', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'T. Santhosh Kumar', phone: '8712549710', role: 'Sector 4', type: 'DIRECT', rank: 'SI', batch: 2024 },
      ]},
      { name: 'Reinbazar', code: 'PS-RBZ', officers: [
        { name: 'K.Pavan Kumar', phone: '8712660371', role: 'Admin/Sector 4', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'C Gnana Prakash', phone: '8712571735', role: 'DSI (Sick)', type: 'RANKER', rank: 'SI', batch: 1989 },
        { name: 'P Ramakishan', phone: '8712660374', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'G Linga raju', phone: '8712660376', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'P Priyanka', phone: '8712660372', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2024 },
      ]},
      { name: 'Bhavaninagar', code: 'PS-BHV', officers: [
        { name: 'K. Shiva Kumar', phone: '8712661038', role: 'Sector-3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'D. Vittal', phone: '8712661034', role: 'DSI', type: 'RANKER', rank: 'SI' },
        { name: 'G. Srikanth', phone: '8712661038', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'B. Pochaiah', phone: '8712661037', role: 'Sec – 2/ Admin', type: 'DIRECT', rank: 'SI', batch: 2012 },
      ]},
      { name: 'Chatrinaka', code: 'PS-CTK', officers: [
        { name: 'R. Thrimurthulu SI', phone: '8712661017', role: 'Admin/ Sector 4', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'S. Swapna SI', phone: '8712572054', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'V. Akhil SI', phone: '9515735198', role: 'DSI', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'R Prem Kumar SI', phone: '8712661014', role: 'Sector 1 & 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
      ]},
      { name: 'Shahalibanda', code: 'PS-SHB', officers: [
        { name: 'Shaik Aslam', phone: '8712571822', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Shama Noor', phone: '8712572102', role: 'Sector 2', type: 'DIRECT', rank: 'WSI', batch: 2020 },
        { name: 'Akula Prem Kumar', phone: '8712549745', role: 'Admin/Sector 3', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'M Surya', phone: '8712581146', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 2025 },
      ]},
      { name: 'Moghalpura', code: 'PS-MGP', officers: [
        { name: 'G.Swetha', phone: '8712571967', role: 'Admin/ Sector 2', type: 'DIRECT', rank: 'WSI', batch: 2020 },
        { name: 'Narlakanti Srisailam', phone: '8309796184', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2024 },
      ]},
      { name: 'Malakpet', code: 'PS-MLK', officers: [
        { name: 'K. Sanjeeva Reddy', phone: '8712660573', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2012 },
        { name: 'J. Kiran lal', phone: '8712660576', role: 'DSI', type: 'DIRECT', rank: 'SI', batch: 2012 },
        { name: 'Karra. Rajashekar Reddy', phone: '8712660572', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'M. Tejya Naik', phone: '8712660574', role: 'Sector 3', type: 'RANKER', rank: 'SI' },
        { name: 'Munukurtla.Jhansi', phone: '9959272537', role: 'Admin', type: 'DIRECT', rank: 'WSI', batch: 2020 },
      ]},
      { name: 'Chaderghat', code: 'PS-CHG', officers: [
        { name: 'B. Krishna Reddy', phone: '8712660526', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 1985 },
        { name: 'B. Yellakrishna', phone: '8712660525', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'A. Bharath Kumar', phone: '8712660523', role: 'Sector 2 & 4', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Mallela Suresh Reddy', phone: '8712660522', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'I Kalpana', phone: '8712660527', role: 'Admin', type: 'DIRECT', rank: 'WSI', batch: 2020 },
      ]},
      { name: 'Dabeerpura', code: 'PS-DBP', officers: [
        { name: 'N. Sudhakar', phone: '8712660354', role: 'Sector 1', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'S. Keerthi', phone: '8712660355', role: 'Admin /sector 2', type: 'DIRECT', rank: 'WSI', batch: 2020 },
        { name: 'G.Naresh', phone: '8712660356', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'K. Madhu', phone: '8712660358', role: 'DSI', type: 'DIRECT', rank: 'SI', batch: 2024 },
      ]},
      { name: 'Saidabad', code: 'PS-SDB', officers: [
        { name: 'P. Venkateshwarulu', phone: '8712660583', role: 'DSI', type: 'DIRECT', rank: 'SI', batch: 2016 },
        { name: 'B. Gnaneshwar', phone: '8712660587', role: 'Admin/ Sector 3', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'N. Ramchander', phone: '9849619875', role: 'Sector 1 & 2', type: 'RANKER', rank: 'SI', batch: 1990 },
      ]},
      { name: 'Madannapet', code: 'PS-MDP', officers: [
        { name: 'R. Shobha', phone: '8712661043', role: 'Sector 2', type: 'DIRECT', rank: 'WSI', batch: 2018 },
        { name: 'K. Sudhakar', phone: '8712661020', role: 'Admin/Sector 1', type: 'DIRECT', rank: 'SI', batch: 2018 },
        { name: 'V.P Saikanth', phone: '8712661041', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'K. Krishnaiah', phone: '9985277526', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 1989 },
        { name: 'B. Shiva Kumar', phone: '8712661030', role: 'Sector 4', type: 'DIRECT', rank: 'PSI', batch: 2024 },
      ]},
      { name: 'Santoshnagar', code: 'PS-SNR', officers: [
        { name: 'ManiKanta Raju P', phone: '8712661024', role: 'Admin/Sector 1', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Chinthala Ravi', phone: '8712661023', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Shaik Wajeed', phone: '8712549697', role: 'Sector 3', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'S. Venkatesham', phone: '9440509422', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 1990 },
      ]},
      { name: 'IS Sadan PS', code: 'PS-ISD', officers: [
        { name: 'K. Mahesh', phone: '8712661579', role: 'Secctor 1', type: 'DIRECT', rank: 'SI', batch: 2024 },
        { name: 'A. Pruthvi Raju', phone: '8712661584', role: 'Sector 2', type: 'DIRECT', rank: 'SI', batch: 2020 },
        { name: 'Rumana', phone: '8712661580', role: 'Admin/Sector 3', type: 'DIRECT', rank: 'WSI', batch: 2020 },
        { name: 'R. Pandu', phone: '8712661585', role: 'DSI', type: 'RANKER', rank: 'SI', batch: 1985 },
      ]},
    ],
  },

  // ─── 2. GOLKONDA ZONE ────────────────────────────────────────────────────
  {
    name: 'Golkonda Zone', code: 'GKZ',
    stations: [
      { name: 'Asifnagar PS', code: 'PS-ASF', officers: [
        { name: 'P Pramod Kumar Reddy', phone: '8712660417', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'A Ramanjaneyulu', phone: '8712660413', role: 'Sector-I and II', type: 'DIRECT', rank: 'SI' },
        { name: 'Syed Ayub', phone: '8712660416', role: 'Crime SI', type: 'DIRECT', rank: 'SI' },
        { name: 'E Tulasi', phone: '8712660414', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Mehdipatnam PS', code: 'PS-MHP', officers: [
        { name: 'G.V Narsinga Rao', phone: '8712660422', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'N.Preethi Reddy', phone: '8712660419', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Ravi Kumar', phone: '8712660424', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'P.Surya Narayana Chary', phone: '8712661085', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Habeebnagar PS', code: 'PS-HBN', officers: [
        { name: 'K Shiva Kumar', phone: '8712660482', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'T.Mallaiah', phone: '8712581160', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'A. Pooja', phone: '8712549699', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'V. Sandeep', phone: '8712660478', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'M.Ashok Kumar', phone: '8712660484', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Kulsumpura PS', code: 'PS-KSP', officers: [
        { name: 'B.Bhaskar Rao', phone: '8712660487', role: 'Sector-I & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'G Naveen', phone: '8712660485', role: 'Crime', type: 'DIRECT', rank: 'SI' },
        { name: 'Mamidi Narsimha', phone: '8712660486', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Rajeshwar', phone: '8712660489', role: 'General', type: 'DIRECT', rank: 'SI' },
        { name: 'K.Swetha', phone: '8712660488', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Tappachabutra PS', code: 'PS-TPC', officers: [
        { name: 'Mohd Amjad Shareef', phone: '8712660448', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'L.Raju', phone: '8712660444', role: 'Sector 2', type: 'DIRECT', rank: 'SI' },
        { name: 'P.Varalaxmi', phone: '8712660445', role: 'Sector 3', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Gudimalkapur PS', code: 'PS-GDK', officers: [
        { name: 'S. Jyothi', phone: '8712571982', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Ch. Suresh', phone: '8712572039', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'G. Bajya Naik', phone: '8712661544', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Lalit Pratham', phone: '8712549724', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Upendra Babu', phone: '8712661545', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Mangalhat PS', code: 'PS-MGH', officers: [
        { name: 'B.Naresh', phone: '8712660495', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'T.Vinod', phone: '8712661057', role: 'Sector-II & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'S.Shruthi', phone: '8712660497', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'T.Anusha', phone: '8712549677', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'K.Krishnaiah', phone: '8712583257', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Afzalgunj PS', code: 'PS-AFZ', officers: [
        { name: 'K. Niranjan', phone: '8712660534', role: 'Admin & Sector 3', type: 'DIRECT', rank: 'SI' },
        { name: 'M.Swapna', phone: '8712660535', role: 'Sector 2', type: 'DIRECT', rank: 'SI' },
        { name: 'M.Subhash', phone: '8712660532', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'V.Narender Reddy', phone: '8712660536', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Ramulu', phone: '9849358156', role: 'General', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Golconda PS', code: 'PS-GLC', officers: [
        { name: 'M Venkataiah', phone: '8712571729', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Ramu Naidu', phone: '8712660433', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'B Srikanth', phone: '8712549674', role: 'Sector 2', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Srilatha', phone: '8712660434', role: 'Sector 3', type: 'DIRECT', rank: 'SI' },
        { name: 'G. Anjaneyulu', phone: '8712660438', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Tolichowki PS', code: 'PS-TLC', officers: [
        { name: 'M. Satish Kumar', phone: '8712661161', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Rajendar Reddy', phone: '8712549726', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Ravi Kumar', phone: '8712571559', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Pandu Naik', phone: '8712566965', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Begum Bazar PS', code: 'PS-BGB', officers: [
        { name: 'Shaik Nagul Meera', phone: '8712660137', role: 'Admin & Sector 4', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Srishailam', phone: '8712660132', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'Ch. Kavitha Priya', phone: '8712660133', role: 'Sector 2', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Narasimha', phone: '8712660135', role: 'Sector 3', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Jagadiswar Rao', phone: '8712660136', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Goshamahal PS', code: 'PS-GSM', officers: [
        { name: 'K. Laxmaiah', phone: '8712660477', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Manisha', phone: '8712660474', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Arunoday', phone: '8712660473', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Aravind Goud', phone: '8712660476', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'L. Narsimha', phone: '8712660475', role: 'Admin', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Masab Tank PS', code: 'PS-MST', officers: [
        { name: 'M Satheesh', phone: '8712661484', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'P Kishore', phone: '8712661483', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'G Chandana', phone: '8712549744', role: 'Sector-II & III', type: 'DIRECT', rank: 'SI' },
        { name: 'K Shankar Naik', phone: '8712581188', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },

  // ─── 3. JUBILEE HILLS ZONE ──────────────────────────────────────────────
  {
    name: 'Jubilee Hills Zone', code: 'JHZ',
    stations: [
      { name: 'Banjara Hills', code: 'PS-BJH', officers: [
        { name: 'Naveen', phone: '8712660459', role: 'Sector III', type: 'DIRECT', rank: 'SI' },
        { name: 'Yasin Ali', phone: '8712660456', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Nagaraju', phone: '8712660458', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'Srinivasulu', phone: '8712571540', role: 'Sector –V', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Vijay', phone: '8712660454', role: 'Sector –I', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Surendar', phone: '8712660451', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'G. Sandhya Rani', phone: '8712549703', role: 'Sector -II', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Madhura Nagar', code: 'PS-MDN', officers: [
        { name: 'Kalal Bhanu Chander Goud', phone: '8121895890', role: 'Sector – III', type: 'DIRECT', rank: 'SI' },
        { name: 'G. Shiva Shankar', phone: '8712571916', role: 'Sector –II', type: 'DIRECT', rank: 'SI' },
        { name: 'Srihari Srinivas', phone: '8639759349', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'S Sushma', phone: '8790566727', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'Y Suraj', phone: '8712661088', role: 'Sector – IV', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Jubilee Hills', code: 'PS-JBH', officers: [
        { name: 'Nandigama Rama', phone: '8712660497', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Somashekar', phone: '8712660464', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Vinod Kumar Reddy', phone: '8712661096', role: 'Sector –II', type: 'DIRECT', rank: 'SI' },
        { name: 'Jagadishwar', phone: '8712660469', role: 'Sector – III', type: 'DIRECT', rank: 'SI' },
        { name: 'J. Sathish', phone: '8712660467', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'M.Srisailam', phone: '8712571602', role: 'Sector –IV', type: 'DIRECT', rank: 'SI' },
        { name: 'M Shravan Kumar Reddy', phone: '8712549722', role: 'Sector -V', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Film Nagar', code: 'PS-FNR', officers: [
        { name: 'M. Prem Raj', phone: '8712661089', role: 'Sector - III', type: 'DIRECT', rank: 'SI' },
        { name: 'Shaik Saleem', phone: '8712572014', role: 'Sector – II', type: 'DIRECT', rank: 'SI' },
        { name: 'U. Raghavender', phone: '8712661497', role: 'Attached to SIT', type: 'DIRECT', rank: 'SI' },
        { name: 'V Suneetha', phone: '8712661087', role: 'Sector – I', type: 'DIRECT', rank: 'SI' },
        { name: 'Pallavi', phone: '8712571875', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'SR Nagar', code: 'PS-SRN', officers: [
        { name: 'Nagaraj', phone: '8712571905', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Raju Rathod', phone: '8712661070', role: 'Admin/Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'V. Gopal', phone: '9885138952', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Sudheer Reddy', phone: '8712572002, 8712661077', role: 'Sector – III', type: 'DIRECT', rank: 'SI' },
        { name: 'B Madhu Sudhan', phone: '8712549720', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Borabanda', code: 'PS-BRB', officers: [
        { name: 'Shaik Nagul Meera', phone: '8712572071, 8712661594', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'Nagendra Babu', phone: '8712571877', role: 'Admin SI /Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Y. Kashaiah', phone: '8712661596', role: 'Sector – IV', type: 'DIRECT', rank: 'SI' },
        { name: 'Ch Madhu sudhan', phone: '8712549740', role: 'DSI / Sector - II', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Sanath Nagar', code: 'PS-SAN', officers: [
        { name: 'Md. Abdul Hayyum', phone: '8712663234', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'K.Harish', phone: '8712568283', role: 'Admin SI/Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'P.Anusha', phone: '8712554131', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'M.Venkatesham', phone: '8712581139', role: 'Sector-III/General/IO', type: 'DIRECT', rank: 'SI' },
        { name: 'G.Mallesham', phone: '8712663293', role: 'Courts monitoring', type: 'DIRECT', rank: 'SI' },
        { name: 'S.Nagarajulu', phone: '8712567049', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },

  // ─── 4. KHAIRTHABAD ZONE ────────────────────────────────────────────────
  {
    name: 'Khairthabad Zone', code: 'KZ',
    stations: [
      { name: 'Panjagutta PS', code: 'PS-PJG', officers: [
        { name: 'Sri G. Naresh Kumar', phone: '8712572064', role: 'Sector-I & II', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri P. Pradeep', phone: '8712571535', role: 'Sector-III & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri M. Venkat Kishan', phone: '8712571817', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri B. Venugopal', phone: '8712661063', role: 'Sector-V', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri A Suresh', phone: '8712571836', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri Shiva Shankar', phone: '8712571741', role: 'Att to SIT Case', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri G. Bharath Kumar Reddy', phone: '8712661065', role: 'Sick Since 08-10-2025', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri S. Penttaiah', phone: '8712661057', role: 'Atted from CM Security for CM Route BB, retiring 30-04-2026', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Khairatabad', code: 'PS-KHB', officers: [
        { name: 'Sri A. Sandeep Reddy', phone: '8712661534', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Smt B.Ramana', phone: '8712661533', role: 'Sector-II & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri Md Sameer', phone: '8712661537', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri B Pranith', phone: '8712661536', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Saifabad', code: 'PS-SFB', officers: [
        { name: 'P Balaraju', phone: '8712660199', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Swamy', phone: '8712660198', role: 'Sector-1', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Naveen', phone: '8712660196', role: 'Sector- II', type: 'DIRECT', rank: 'SI' },
        { name: 'V Nikith Kumar', phone: '8712660197', role: 'Sector- III', type: 'DIRECT', rank: 'SI' },
        { name: 'V. Parmeshwari', phone: '8712660194', role: 'Sector- IV', type: 'DIRECT', rank: 'SI' },
        { name: 'V. Shankar', phone: '8712660193', role: 'Sector-V', type: 'DIRECT', rank: 'SI' },
        { name: 'Md. Ahmed Pasha', phone: '8712660179', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Lake PS', code: 'PS-LKE', officers: [
        { name: 'B. Balaraj', phone: '8712660158', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Shiva Shankar', phone: '8712571529', role: 'DSI/Sec-I', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Prasanna', phone: '8712660159', role: 'Sector- II', type: 'DIRECT', rank: 'SI' },
        { name: 'Prashant Reddy', phone: '8712549719', role: 'Sector- III', type: 'DIRECT', rank: 'SI' },
        { name: 'Parcha Satish Kumar', phone: '8712660149', role: 'General', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'PS Abid Road', code: 'PS-ABD', officers: [
        { name: 'Smt. A. Madhavi', phone: '9866890174', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. N. Gourender Goud', phone: '8712660115', role: 'Sector-II & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. P. Srikanth', phone: '8712572033', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. Thirumalesh Yadav', phone: '8712660113', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. K. Sreeramulu', phone: '9963823331', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Nampally', code: 'PS-NMP', officers: [
        { name: 'M A Adil Riyaz Khan', phone: '8712571762', role: 'Sector -I', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Sai Kumar', phone: '8712660172', role: 'Sector -II & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sumitra Devi', phone: '8179384332', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Shanthi Kumar Noah', phone: '8712660173', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'E Anjaiah', phone: '7893706803', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Sultan Bazar PS', code: 'PS-SBZ', officers: [
        { name: 'Sri. P. Sairam', phone: '8712660512', role: 'Sector-1 & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. D. Venu', phone: '8712660513', role: 'Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Smt.M.Swetha', phone: '8712660514', role: 'Sector-3', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri.Md. Mujtaba Ali Quasim', phone: '8712660516', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. Y. Chalapathi Reddy', phone: '8712660156', role: 'General', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Narayanguda', code: 'PS-NRG', officers: [
        { name: 'Sri. J. Srikanth Reddy', phone: '8712660178', role: 'Admin SI & Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. Ch. Nagaraju', phone: '8712660126', role: 'DSI & Sector-3', type: 'DIRECT', rank: 'SI' },
        { name: 'Smt. B. Srivani', phone: '8712571785', role: 'Sector-1', type: 'DIRECT', rank: 'WSI' },
        { name: 'Sri. D.Sai Sandeep', phone: '8712660129', role: 'Sector-4', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. D.S. Raju', phone: '8712581147', role: 'Court In-charge', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },

  // ─── 5. RAJENDRANAGAR ZONE ───────────────────────────────────────────────
  {
    name: 'Rajendranagar Zone', code: 'RJNR',
    stations: [
      { name: 'Chandrayangutta', code: 'PS-CYG', officers: [
        { name: 'V. Srinivas Rao', phone: '8712571899', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'S Chandra Reddy', phone: '8712660384', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'J Kiran Kumar', phone: '8712660385', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'K.Aravind', phone: '8712549682', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'V.Jayamma', phone: '8712661644', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Bandlaguda PS', code: 'PS-BDG', officers: [
        { name: 'D. Subhash', phone: '8712661574', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'P Mahender', phone: '8712549670', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Naga Rani', phone: '8712661577', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Naga Raju Reddy', phone: '8712571573', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Yadaiah', phone: '8712661576', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Kanchanbagh', code: 'PS-KCB', officers: [
        { name: 'Sri. K.Raju', phone: '8712661029', role: 'Admin & DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri S.Krishna Kanth', phone: '8712661026', role: 'Sector I', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri M. Sreekanth', phone: '8712661027', role: 'Sector II', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. K.Venkata Ramana', phone: '8712567058', role: 'Sector III', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Mailardevpally', code: 'PS-MLP', officers: [
        { name: 'Sri. Shaik Abdullah', phone: '8712566979', role: 'Sector- 1', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. T. Paidi Naidu', phone: '8712568230', role: 'Sector- 2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. Ravinder Reddy', phone: '8712567061', role: 'Sector- 3', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. P. Vishwanath Reddy', phone: '8712554117', role: 'Sector- 4 & Admin SIP', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. P. Kondal Reddy', phone: '8712567681', role: 'Sector- 5', type: 'DIRECT', rank: 'ASI' },
      ]},
      { name: 'Falaknuma', code: 'PS-FLK', officers: [
        { name: 'Shaik Abbas Ali', phone: '8712660383', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'G Rajeswar Reddy', phone: '8712660377', role: 'Sector-I & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Md Haseena', phone: '8712660378', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'Sk Abdul Raheem', phone: '8712660379', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Kamatipura', code: 'PS-KMT', officers: [
        { name: 'K. Narsimulu', phone: '8712660329', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Swarna', phone: '8712549665', role: 'Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'MD Parvez Mohiuddin', phone: '8712660326', role: 'Sector SI (Sick)', type: 'DIRECT', rank: 'SI' },
        { name: 'V. Suman', phone: '8712660327', role: 'Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Nagaraju', phone: '8712660326', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Bahadurpura', code: 'PS-BHP', officers: [
        { name: 'R Mounika', phone: '8712549704', role: 'Sector I', type: 'DIRECT', rank: 'SI' },
        { name: 'G. Ambedkar', phone: '8712572106', role: 'Sector II', type: 'DIRECT', rank: 'SI' },
        { name: 'K Prashanth', phone: '8712572118', role: 'Sector III & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'D Srinivasulu', phone: '8712571506', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Kalapathar', code: 'PS-KPR', officers: [
        { name: 'N. Nagesh', phone: '8712660345', role: 'Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Srinivasulu', phone: '8712660344', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Jyothika', phone: '8712549664', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'Mohammad Amjad', phone: '8712660342', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'N Giridhar', phone: '8712660343', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Rajendranagar PS', code: 'PS-RJN', officers: [
        { name: 'Sri G Prashanth Reddy', phone: '8712568395', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri P Rajkumar', phone: '8712566937', role: 'Sector-VI', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri B Suman', phone: '8712568174', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri C Bhanu Prakash', phone: '8712566906', role: 'Sector-V', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri K Raghavender', phone: '8712554133', role: 'Sector-III & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri Md Sardar', phone: '9490640146', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Attapur', code: 'PS-ATP', officers: [
        { name: 'P Parvathi', phone: '8712554097', role: 'Sector- 1', type: 'DIRECT', rank: 'SI' },
        { name: 'A. Venkatesh', phone: '8712567032', role: 'Sector- 2', type: 'DIRECT', rank: 'SI' },
        { name: 'Ch Sreenu', phone: '8712663404', role: 'Sector- 4/Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'T. Jaya Raj', phone: '8712567026', role: 'Sector- 6', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Kishan Nayak', phone: '8712568250', role: 'Sector- 3', type: 'DIRECT', rank: 'SI' },
        { name: 'Md. Nayeem Hussain', phone: '8712568335', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Niranjan @ Mohd. Hussain', phone: '8712567075', role: 'Sector- 5', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },

  // ─── 6. SECUNDRABAD ZONE ─────────────────────────────────────────────────
  {
    name: 'Secundrabad Zone', code: 'SZ',
    stations: [
      { name: 'Mahankali PS', code: 'PS-MHK', officers: [
        { name: 'E. S. Sreedhar', phone: '8712660231', role: 'Sector –I & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Likhitha', phone: '8712549737', role: 'Sector –II', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Sandeep Reddy', phone: '8712660233', role: 'Sector –III', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Phool Singh', phone: '8008237214', role: 'Sector –III A', type: 'DIRECT', rank: 'SI' },
        { name: 'CH. Prasad Reddy', phone: '8712660235', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Ramgopalpet PS', code: 'PS-RGP', officers: [
        { name: 'N. Narsinga Rao', phone: '8712660184', role: 'Sector-I & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Lakshminarayana', phone: '8712660182', role: 'Sector II', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Gangadhar', phone: '8712660183', role: 'Sector III & DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Gayathri Devi', phone: '8712549736', role: 'Sector IV', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Chikkadpally PS', code: 'PS-CKP', officers: [
        { name: 'L. Mounika', phone: '8712660166', role: 'Sector-I & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Jangaiah Goud', phone: '8712660163', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Shiva Prasad', phone: '8712660162', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'MD. Kareem', phone: '8712660165', role: 'Sector-IV & DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Musheerabad PS', code: 'PS-MSB', officers: [
        { name: 'K. V. Laxmi Narayana', phone: '8712660154', role: 'Sector-III & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'L. Rajesh', phone: '8712660153', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'Sk Nasrin Begum', phone: '8712600152', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'Durga Choudary Ganta', phone: '8712660155', role: 'Sector-IV & DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Kachiguda PS', code: 'PS-KCG', officers: [
        { name: 'Narimalla Krishnaveni', phone: '8712660544', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'A. Bharath Kumar', phone: '8712660545', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'MD. Shahed Ali', phone: '8712660546', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Gandhi Nagar PS', code: 'PS-GDN', officers: [
        { name: 'M Likith Sai Kumar', phone: '8712518316', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'P Mounika', phone: '8712660144', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'G Harish Kumar', phone: '8712660143', role: 'Sector-II & Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'V Narsimhulu', phone: '8712660145', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'G Kantha Rao', phone: '8712571431', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Domalguda PS', code: 'PS-DMG', officers: [
        { name: 'Anantha Chary', phone: '8712660718', role: 'Sector I', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Srinivas Reddy', phone: '8712661525', role: 'Sector II', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Vijaya', phone: '8712661526', role: 'Sector III', type: 'DIRECT', rank: 'SI' },
        { name: 'V Venkateshwarlu', phone: '8712661523', role: 'Admin SI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'OUSity PS', code: 'PS-OUS', officers: [
        { name: 'Sri. P. Karunakar', phone: '8712660562', role: 'Sector-1, Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. K. Chandra Shekar', phone: '8712660569', role: 'Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. R. Jaya Chandar', phone: '8712660564', role: 'Sector-3', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. D. Krishna', phone: '8712660565', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Smt. N. Manimala', phone: '8712549675', role: 'WSI', type: 'DIRECT', rank: 'WSI', batch: 0, remarks: 'Sick from 02.02.2026' },
      ]},
      { name: 'Nallakunta PS', code: 'PS-NLK', officers: [
        { name: 'K. Varalaxmi', phone: '8712660555', role: 'Admin SI/Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Laxminarayana', phone: '8712660553', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'C. Hareesh Kumar', phone: '8712660552', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'J. Srinivasa Rao', phone: '8712660554', role: 'Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Bhoomeshwar', phone: '8712660556', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Amberpet PS', code: 'PS-AMB', officers: [
        { name: 'Inapakurthi Tarun Kumar', phone: '8712660593', role: 'Sector-1, Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'G Suresh Kumar', phone: '8712660594', role: 'Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Madhani Sandhya', phone: '8712660595', role: 'Sector-3', type: 'DIRECT', rank: 'SI' },
        { name: 'V Bhanu Prakash Reddy', phone: '', role: 'Suspended', type: 'DIRECT', rank: 'SI', remarks: 'Suspended' },
        { name: 'Nirdula Anjireddy', phone: '8712660596', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Chilkalguda PS', code: 'PS-CLG', officers: [
        { name: 'Ch Chandraiah', phone: '8712661049', role: 'Admin SI / Sector SI', type: 'DIRECT', rank: 'SI', remarks: '9908612324' },
        { name: 'J Rakesh', phone: '8712661047', role: 'DSI/Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Nagaraju', phone: '9505049056', role: 'SI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Lallaguda PS', code: 'PS-LLG', officers: [
        { name: 'P Yugandhar', phone: '8712549757', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
        { name: 'M Rameshwar Reddy', phone: '8712660222', role: 'Sector 2/Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'CH Vijay', phone: '8712571797', role: 'Sector 3', type: 'DIRECT', rank: 'SI' },
        { name: 'G Amar Singh', phone: '8712571716', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Warasiguda PS', code: 'PS-WRG', officers: [
        { name: 'A. Mallikarjun', phone: '8712660599', role: 'Admin SI & Sector-II SI', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Rama Chandra Reddy', phone: '8712549758', role: 'Sector I & III', type: 'DIRECT', rank: 'SI' },
        { name: 'K. Gopal', phone: '8712660578', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },

  // ─── 7. SHAMSHABAD ZONE ──────────────────────────────────────────────────
  {
    name: 'Shamshabad Zone', code: 'SMZ',
    stations: [
      { name: 'RGIA PS', code: 'PS-RGA', officers: [
        { name: 'Sri N. Sridhar', phone: '8712663311', role: 'Sector-1', type: 'DIRECT', rank: 'SI' },
        { name: 'P Ashok Varma', phone: '8712663312', role: 'Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri Md Arshad Ali', phone: '8712566953', role: 'Sector-3/Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'Kum P Uma Devi', phone: '8712554139', role: 'Sector-4', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri T Indra Sena Reddy', phone: '8712568368', role: 'Sector-5', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri H. Kishan Ji', phone: '8712567018', role: 'DSI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Pahadishareef PS', code: 'PS-PHS', officers: [
        { name: 'Sri. V. Laxmaiah', phone: '8712580023', role: 'Sector-1', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. MD. Faisal Ahmed', phone: '8712662403', role: 'Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. L Venkateswarlu', phone: '8712662402', role: 'Sector-3', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri. B. Dayakar Reddy', phone: '8712662397', role: 'Sector-4', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Adibatla PS', code: 'PS-ADB', officers: [
        { name: 'S. Venkatesh', phone: '8712662383', role: 'Admin SI & Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'D. Venkatesh', phone: '8712580217', role: 'Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'N. Noel Raj', phone: '8712662382', role: 'Sector SI & DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'S. Saidaiah', phone: '8712662381', role: 'Sector SI', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Satyanarayana', phone: '8712553736', role: 'Sector SI', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Balapur PS', code: 'PS-BLP', officers: [
        { name: 'Sri K. Sudhakar', phone: '8712662390', role: 'Admin SI & Sector-2', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri SRV Prasad Mekala', phone: '8712579980', role: 'Sector 3 & 5', type: 'DIRECT', rank: 'SI' },
        { name: 'Sri S. Koteshwar Rao', phone: '8712662387', role: 'DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'Mohd Sohail', phone: '8712662388', role: 'Sector 4', type: 'DIRECT', rank: 'SI' },
        { name: 'Manupuri Naveen Kumar', phone: '8712553719', role: 'Sector 1', type: 'DIRECT', rank: 'SI' },
      ]},
      { name: 'Meerpet PS', code: 'PS-MRP', officers: [
        { name: 'G. Srinivas Reddy', phone: '8712662310', role: 'Sector-IV/Admin', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Raja Shekar Goud', phone: '8712579983', role: 'Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Sarangapani', phone: '8712662299', role: 'Sector-VI', type: 'DIRECT', rank: 'SI' },
        { name: 'T. Nagabhushanam', phone: '8712578724', role: 'Sector-I', type: 'DIRECT', rank: 'SI' },
        { name: 'M. Nagireddy', phone: '8712580094', role: 'Sector-V', type: 'DIRECT', rank: 'SI' },
        { name: 'Pala Mallaiah', phone: '8712662298', role: 'Crime DSI', type: 'DIRECT', rank: 'SI' },
        { name: 'B. Satyanarayana Reddy', phone: '8712578547', role: 'Asst to Sector-VI', type: 'DIRECT', rank: 'SI' },
        { name: 'P. Sathaiah', phone: '8712578764', role: 'Asst to Sector-III', type: 'DIRECT', rank: 'SI' },
        { name: 'Chinthala Nithin Reddy', phone: '8712553702', role: 'Sector-II', type: 'DIRECT', rank: 'SI' },
        { name: 'Ch. Srinivas Rao', phone: '8712578796', role: 'Asst to Sector-IV', type: 'DIRECT', rank: 'SI' },
        { name: 'R. Sankaraiah', phone: '8712662140', role: 'Asst to Sector-I', type: 'DIRECT', rank: 'SI' },
      ]},
    ],
  },
];

// ── Seed Function ──────────────────────────────────────────────────────────
async function seed() {
  await connectDB();
  console.log('Connected to MongoDB. Seeding...');

  // Clear all collections (preserve admin account)
  await Promise.all([
    Officer.deleteMany({ badgeNumber: { $ne: 'admin@hcp.com' } }),
    SectorOfficer.deleteMany({}),
    Sector.deleteMany({}),
    PoliceStation.deleteMany({}),
    Circle.deleteMany({}),
    Division.deleteMany({}),
    Zone.deleteMany({}),
  ]);

  // Drop stale indexes
  try { await Officer.collection.dropIndexes(); } catch { /* ignore */ }
  try { await PoliceStation.collection.dropIndexes(); } catch { /* ignore */ }

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const commissionerHash = await bcrypt.hash('hcp@123', 12);
  let badgeCounter = 1;

  // Create Commissioner (login account)
  const commissioner = await Officer.create({
    name: 'Commissioner C V Anand',
    badgeNumber: 'HCP-001',
    rank: 'COMMISSIONER',
    phone: '9999900001',
    email: 'commissioner@hcp.gov.in',
    passwordHash: commissionerHash,
    isActive: true,
  });

  let totalOfficers = 1;
  let totalStations = 0;
  let totalSectors = 0;

  for (const zoneData of ZONES) {
    // Create Zone
    const zone = await Zone.create({ name: zoneData.name, code: zoneData.code });

    // Create one Division + Circle per Zone (simplified hierarchy)
    const division = await Division.create({
      name: `${zoneData.name} Division`,
      code: `${zoneData.code}-D1`,
      zoneId: zone._id,
    });
    const circle = await Circle.create({
      name: `${zoneData.name} Circle`,
      code: `${zoneData.code}-C1`,
      divisionId: division._id,
    });

    for (const stationData of zoneData.stations) {
      // Create Police Station
      const station = await PoliceStation.create({
        name: stationData.name,
        code: stationData.code,
        circleId: circle._id,
      });
      totalStations++;

      // Roman numeral to number converter
      const romanToNum = (r: string): number => {
        const map: Record<string, number> = { I: 1, V: 5, X: 10 };
        let result = 0;
        const s = r.toUpperCase();
        for (let i = 0; i < s.length; i++) {
          const cur = map[s[i]] || 0;
          const next = map[s[i + 1]] || 0;
          result += cur < next ? -cur : cur;
        }
        return result;
      };

      // Normalize role text: convert ALL Roman numerals to numbers
      const normalizeRole = (role: string): string => {
        // Convert "Sector-I", "Sector –III" etc.
        let result = role.replace(/Sector[\s\-–]+([IVX]+)/gi, (_m, rom) => `Sector ${romanToNum(rom)}`);
        // Convert standalone Roman after "and" or "&": "and II" → "& 2"
        result = result.replace(/(?:and|&)\s*([IVX]+)\b/gi, (_m, rom) => `& ${romanToNum(rom)}`);
        return result;
      };

      // Extract all sector numbers from a role string
      // If role mentions "Sec/Sector", collect ALL single digits as sector numbers
      const extractSectorNums = (role: string): string[] => {
        if (!/sec/i.test(role)) return [];
        return [...role.matchAll(/(\d)/g)].map(m => m[1]);
      };

      // Determine sectors from officer roles
      const sectorNames = new Set<string>();
      for (const off of stationData.officers) {
        const normalized = normalizeRole(off.role);
        for (const n of extractSectorNums(normalized)) {
          sectorNames.add(`Sector ${n}`);
        }
      }
      // Ensure at least 4 sectors per station
      if (sectorNames.size === 0) {
        ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4'].forEach(s => sectorNames.add(s));
      }

      // Create Sectors
      const sectorMap: Record<string, any> = {};
      for (const sName of sectorNames) {
        const sector = await Sector.create({ name: sName, policeStationId: station._id });
        sectorMap[sName] = sector;
        totalSectors++;
      }

      // Create Officers and sector assignments
      for (const off of stationData.officers) {
        badgeCounter++;
        const badge = `HCP-${String(badgeCounter).padStart(4, '0')}`;
        const normalizedRole = normalizeRole(off.role);

        const officer = await Officer.create({
          name: off.name,
          badgeNumber: badge,
          rank: off.rank || 'SI',
          phone: off.phone,
          recruitmentType: off.type || 'DIRECT',
          batch: off.batch,
          remarks: normalizedRole,
          passwordHash,
          isActive: true,
        });
        totalOfficers++;

        // Assign to ALL sectors mentioned in role
        const sectorNums = extractSectorNums(normalizedRole);
        let assigned = false;
        for (const n of sectorNums) {
          const key = `Sector ${n}`;
          const sector = sectorMap[key];
          if (sector) {
            await SectorOfficer.create({ sectorId: sector._id, officerId: officer._id, role: 'PRIMARY_SI' });
            assigned = true;
          }
        }
        if (!assigned && Object.values(sectorMap)[0]) {
          // Admin, DSI, Maternity Leave, General, Crime etc. — assign to first sector
          await SectorOfficer.create({ sectorId: Object.values(sectorMap)[0]._id, officerId: officer._id, role: 'PRIMARY_SI' });
        }
      }
    }

    console.log(`  ✓ ${zoneData.name}: ${zoneData.stations.length} stations`);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('══════════════════════════════════════════════');
  console.log(`  Zones:    7`);
  console.log(`  Stations: ${totalStations}`);
  console.log(`  Sectors:  ${totalSectors}`);
  console.log(`  Officers: ${totalOfficers}`);
  console.log('──────────────────────────────────────────────');
  console.log('  Login: commissioner@hcp.gov.in / hcp@123 (Commissioner)');
  console.log('  All SI officers also use: Admin@123');
  console.log('══════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

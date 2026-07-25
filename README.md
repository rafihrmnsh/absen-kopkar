# 📸 AbsenKopkar - Sistem Absensi Karyawan Berbasis Face Recognition & Geolocation

**AbsenKopkar** adalah aplikasi sistem absensi karyawan modern berbasis web yang mengintegrasikan pengenalan wajah real-time (**Face Recognition**) dan verifikasi lokasi presisi (**GPS Geofencing**) untuk memastikan keakuratan dan mencegah kecurangan kehadiran karyawan.

---

## 🚀 Fitur Utama

- 👤 **Absensi Biometrik Wajah (Face Recognition)**
  - Deteksi dan verifikasi wajah secara otomatis via kamera menggunakan `face-api.js`.
  - Verifikasi identitas karyawan secara akurat dengan data biometrik terenkripsi.

- 📍 **Verifikasi Lokasi (GPS / Geofencing)**
  - Mengunci area absensi karyawan berdasarkan koordinat GPS dan radius kantor yang ditentukan.
  - Peta interaktif menggunakan **Leaflet** untuk menampilkan posisi karyawan dan batas area kantor.

- 📝 **Registrasi Wajah Karyawan**
  - Alur pendaftaran foto & ekstraksi *descriptor* wajah untuk karyawan baru.

- 📊 **Panel Kontrol Admin (Admin Dashboard)**
  - **Manajemen Karyawan**: Tambah, edit, nonaktifkan, atau hapus data karyawan.
  - **Monitoring Kehadiran**: Pantau absensi harian secara real-time.
  - **Pengaturan Radius & Lokasi Kantor**: Fleksibilitas menentukan titik pusat dan jarak aman absensi.
  - **Amnesti & Koreksi Absensi**: Fitur persetujuan atau perbaikan status kehadiran karyawan.
  - **Export Laporan Excel**: Unduh rekap absensi bulanan/harian dalam format `.xlsx` profesional.

- 📜 **Riwayat Absensi Karyawan**
  - Karyawan dapat mengecek riwayat jam masuk, jam keluar, durasi kerja, dan status kehadiran.

- 📧 **Notifikasi & Keamanan**
  - Integrasi **Firebase Authentication** & **Firestore Database**.
  - Pengiriman notifikasi email via **Nodemailer**.

---

## 🛠️ Teknologi & Stack

| Layer | Teknologi / Library |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons |
| **Face Recognition** | `face-api.js` (TensorFlow.js backend) |
| **Maps & GPS** | Leaflet.js, React-Leaflet |
| **Backend** | Node.js, Express.js (v5) |
| **Database & Auth** | Firebase Auth, Firebase Firestore, Firebase Admin SDK |
| **Laporan & Export** | `xlsx`, `xlsx-js-style` |
| **Email Service** | Nodemailer |

---

## 📁 Struktur Folder Project

```text
absenkopkar/
├── api/                    # Handler API / Serverless (Vercel deployment)
├── client/                 # Application Frontend (React + Vite)
│   ├── components/         # Komponen UI (Buttons, Cards, Maps, Dialogs)
│   ├── lib/                # Konfigurasi Firebase, Utilitas, & Helper
│   ├── pages/              # Halaman Aplikasi (Index, Admin, Login, FaceRegister, History)
│   ├── services/           # Service API & integrasi backend
│   └── global.css          # Styling global Tailwind CSS
├── public/                 # Assets statis & Model bobot face-api.js
├── server/                 # Express backend server
├── shared/                 # Schema & tipe data bersama (TypeScript)
├── package.json            # Dependencies & npm scripts
├── tailwind.config.ts      # Konfigurasi Tailwind CSS
├── tsconfig.json           # Konfigurasi TypeScript
└── vite.config.ts          # Konfigurasi Vite Bundler
```

---

## 💻 Panduan Instalasi & Jalankan Lokal

### 1. Prasyarat
- **Node.js** v18+ atau versi terbaru
- **npm** atau **pnpm** / **yarn**

### 2. Clone Repository
```bash
git clone https://github.com/USERNAME_KAMU/absenkopkar.git
cd absenkopkar
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Konfigurasi Environment Variable (`.env`)
Buat file `.env` di root direktori project dan isi variabel berikut:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Backend & Email (Server)
PORT=5000
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

> ⚠️ **PENTING**: Jangan pernah melakukan *commit* atau *upload* file `.env` yang berisi key asli ke repository GitHub!

### 5. Jalankan Mode Development
```bash
npm run dev
```
Buka browser dan akses `http://localhost:5000` (atau port yang ditampilkan di terminal).

---

## 📜 NPM Scripts

- `npm run dev` : Menjalankan server development Vite + Express.
- `npm run build` : Melakukan kompilasi production (client & server).
- `npm run start` : Menjalankan server hasil build production (`node dist/server/node-build.mjs`).
- `npm run typecheck` : Mengecek *type-safety* TypeScript.
- `npm run format.fix` : Memformat ulang seluruh baris kode menggunakan Prettier.

---

## 🛡️ Lisensi & Kontribusi

Project ini dikembangkan untuk kebutuhan internal / riset sistem absensi Koperasi Karyawan. 
Silakan ajukan **Pull Request** atau **Issue** jika menemukan bug atau memiliki ide pengembangan lebih lanjut.

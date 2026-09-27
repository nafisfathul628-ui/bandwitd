# ⚡ IndiBiz NetGuard &mdash; MikroTik Queues & FiberHome HG6145D2 Controller

Aplikasi web pengendali bandwidth tingkat lanjut dengan antarmuka profesional bergaya **MikroTik Winbox / RouterOS 7** yang terhubung **langsung secara realtime** ke router **FiberHome HG6145D2 (192.168.1.1)** dengan akun `user` / `user1234`.

---

## 🌐 Akses Aplikasi
- **Online Cloud (Bisa dari HP / Mana Saja)**: **[https://netguard.mtsmambaulhikmah.sch.id](https://netguard.mtsmambaulhikmah.sch.id)**
- **Lokal (Komputer Rumah)**: `http://localhost:3000`

## 🚀 Cara Menjalankan Bridge Realtime di Rumah
Cukup **klik dua kali (double-click)** file:
👉 **`Buka_Dashboard.bat`** di folder `E:\BANDWITH`

Sistem otomatis menjalankan bridge lokal, menghubungkan ke modem FiberHome `192.168.1.1`, menyinkronkan data secara realtime ke Hostinger Cloud setiap 3 detik, dan membuka dashboard di browser.

---

## 📊 Detail Lengkap Fair Usage Policy (FUP) Indibiz Paket 75 Mbps

Layanan Telkom Indibiz paket **75 Mbps** menerapkan sistem pemakaian wajar (FUP) bertahap sebagai berikut:

| Parameter | Spesifikasi / Ketentuan |
| :--- | :--- |
| **Kecepatan Awal (Level 0)** | **75 Mbps Download / 25 Mbps Upload** (Rasio 3:1) |
| **Ambang Batas FUP Tahap 1** | **1.500 GB (1,5 Terabyte)** dalam 1 bulan |
| **Kecepatan Setelah FUP 1** | Diturunkan ke **50% &rarr; 37.5 Mbps** |
| **Dampak FUP 1 di Rumah** | Masih sangat cepat dan nyaman untuk 8-10 perangkat bersamaan, streaming YouTube 1080p 60fps tanpa jeda, video meeting Zoom HD tetap lancar. |
| **Ambang Batas FUP Tahap 2** | **2.000 GB (2,0 Terabyte)** dalam 1 bulan |
| **Kecepatan Setelah FUP 2** | Diturunkan ke **20% &rarr; 15.0 Mbps** |
| **Dampak FUP 2 di Rumah** | Masih cukup untuk browsing, sosmed, dan streaming video 720p pada 2-3 HP, namun unduhan game atau file besar akan terasa lebih lambat. |
| **Siklus Reset Kuota** | Direset otomatis ke **0 GB** pada **tanggal 1 setiap awal bulan pukul 00:00 WIB**. |
| **Anggaran Harian Aman** | **Maksimal 50 GB per hari** agar kuota 1.500 GB tidak habis sebelum tanggal 1. |
| **Opsi Paket Pro Non-FUP** | **100% Unlimited tanpa batas kuota**, rasio simetris 1:1 (75 Mbps Download / 75 Mbps Upload murni). |

*Catatan: Pada dashboard, Anda dapat mengklik tombol "Paket Pro (Non-FUP)" jika paket Indibiz yang Anda langgani adalah tipe dedicated bisnis tanpa FUP.*

---

## 🎛️ Fitur Pengatur Bandwidth Bergaya MikroTik (Simple Queues)

Antarmuka dirancang persis seperti **MikroTik Winbox &rarr; Queues &rarr; Simple Queues**:

1. **Daftar Antrean & Target IP**:
   - Menampilkan target IP/Subnet (misal: `192.168.1.12/32` untuk laptop kerja, `192.168.1.15/32` untuk Smart TV, `192.168.1.0/24` untuk seluruh jaringan).
2. **Pengaturan Max Limit & Burst**:
   - Membatasi batas kecepatan Download & Upload (Mbps).
   - Mendukung Burst Limit untuk lonjakan kecepatan cepat saat membuka website baru.
3. **Prioritas Trafik (Priority 1 - 8)**:
   - Priority 1 (VIP / Meeting Kerja), Priority 3 (Streaming TV), Priority 5 (Normal / HP Anak), Priority 8 (Tamu).
4. **Current Rate Monitor (Rx / Tx)**:
   - Bar indikator beban bandwidth realtime per perangkat. Berwarna hijau jika aman, kuning jika mendekati batas (saturated), dan merah jika terjadi antrean/drop.
5. **Toolbar Winbox**:
   - `Add`: Menambah aturan queue baru.
   - `Remove`: Menghapus queue yang dipilih.
   - `Enable` / `Disable`: Mengaktifkan atau menjeda koneksi perangkat tertentu dengan sekali klik.
   - `Reset Counters`: Mengatur ulang statistik total bytes dan dropped packets.
   - `Push ke FiberHome`: Menerapkan batas CAR/QoS ke modem 192.168.1.1.
   - `Export Script`: Menghasilkan script CLI RouterOS siap pakai (`/queue simple add name=... target=... max-limit=...`).

---

## 🔌 Koneksi Realtime ke Modem FiberHome HG6145D2

- **Host Router**: `192.168.1.1` (Port 80 HTTP)
- **Akun Otentikasi**: `user` / `user1234`
- **Host Laptop Anda**: Terdeteksi di IP lokal `192.168.1.21` (Wi-Fi)
- **Status Link GPON**: Terhubung dengan daya optik RX `-19.6 dBm` (Kondisi prima: batas standar Telkom adalah -8 dBm s/d -27 dBm).
- **Tombol Pintas**: Tersedia tombol "Buka 192.168.1.1" dan "Salin Aturan CAR" untuk mempermudah konfigurasi di router.

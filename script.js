// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, getDocs, deleteDoc, writeBatch, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
let db;
let auth;
let appId;
let isFirebaseReady = false;
let currentAttendanceRecordsWithIds = [];
let currentRegisteredEmployees = []; // New: To store registered employees
let isAdminLoggedIn = false;
let employeeIdToDelete = null; // New: To store ID of employee to be deleted

// Variables for QR Scanner
let videoStream = null;
let animationFrameId = null;

// Global variables for attendance settings, with default values
let lateCutoffHour = 7;
let lateCutoffMinute = 0;
let latePenaltyPerMinute = 1000; // Rp. 1,000 per minute late

// Variables for loading screen
const MINIMUM_LOADING_TIME_MS = 7000; // 7 seconds (Updated from 5000ms)
let minimumLoadingTimeElapsed = false;
let pageContentLoaded = false;

// Global variables for Office Location
let officeLocation = {
    latitude: 3.5890625,  // Default: Medan, North Sumatra
    longitude: 98.6679375, // Default: Medan, North Sumatra
    acceptRadius: 200, // Default: 200 meters
    address: "Medan, Sumatera Utara, Indonesia" // Default address
};
let map;
let officeMarker;

// GoMaps.pro API Key
const MAPS_API_KEY = 'AlzaSyoHFLfUbmoPGRVME4DsDxqAUtx5m1RkFuI';

// The GoMaps.pro API script calls `initMap` when it's loaded.
// We declare it globally (outside the IIFE) so it's accessible.
window.initMap = function() {
    console.log("GoMaps.pro API loaded. Map objects will be available via `google.maps`.");
    // No need to initialize geocoder, autocompleteService, placesService here anymore
    // as we will use direct fetch calls for GoMaps.pro REST APIs.
};

// Self-executing anonymous function for app logic
(() => {
    const RESET_PIN = "123";

    // Elements
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const adminLoginModal = document.getElementById('adminLoginModal');
    const loginModalContent = document.getElementById('loginModalContent');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminEmailInput = document.getElementById('adminEmail');
    const adminPasswordInput = document.getElementById('adminPassword');
    const loginErrorMsg = document.getElementById('loginErrorMsg');

    const heroSection = document.getElementById('heroSection');
    const fiturSection = document.getElementById('fitur');
    const absenSection = document.getElementById('absen');
    const adminDashboard = document.getElementById('adminDashboard');
    const attendanceListContainer = document.getElementById('attendanceListContainer');
    const noAttendanceMsg = document.getElementById('noAttendanceMsg');

    const employeeNameInput = document.getElementById('employeeName');
    const detectBtn = document.getElementById('detectBtn');
    const locationCard = document.getElementById('locationCard');

    const resetHistoryBtn = document.getElementById('resetHistoryBtn');
    const resetConfirmModal = document.getElementById('resetConfirmModal');
    const resetPinInput = document.getElementById('resetPinInput');
    const resetErrorMsg = document.getElementById('resetErrorMsg');
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');

    // New Employee Management Elements
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const addEmployeeModal = document.getElementById('addEmployeeModal');
    const addEmployeeModalContent = document.getElementById('addEmployeeModalContent');
    const addEmployeeForm = document.getElementById('addEmployeeForm');
    const newEmployeeName = document.getElementById('newEmployeeName');
    const newEmployeeIdDisplay = document.getElementById('newEmployeeIdDisplay');
    const addEmployeeErrorMsg = document.getElementById('addEmployeeErrorMsg');
    const cancelAddEmployeeBtn = document.getElementById('cancelAddEmployeeBtn');
    const addEmployeeConfirmBtn = document.getElementById('addEmployeeConfirmBtn');
    const employeesTableBody = document.getElementById('employeesTableBody');
    const noEmployeesMsg = document.getElementById('noEmployeesMsg');

    const deleteEmployeeConfirmModal = document.getElementById('deleteEmployeeConfirmModal');
    const employeeToDeleteName = document.getElementById('employeeToDeleteName');
    const deleteEmployeeErrorMsg = document.getElementById('deleteEmployeeErrorMsg');
    const cancelDeleteEmployeeBtn = document.getElementById('cancelDeleteEmployeeBtn');
    const confirmDeleteEmployeeBtn = document.getElementById('confirmDeleteEmployeeBtn');

    // QR Code Display Modal Elements (for Admin to show QR)
    const qrCodeModal = document.getElementById('qrCodeModal');
    const qrCodeModalContent = document.getElementById('qrCodeModalContent');
    const qrcodeDiv = document.getElementById('qrcode');
    const qrEmployeeIdDisplay = document.getElementById('qrEmployeeId');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');

    // New QR Scanner Modal Elements (for Employee attendance)
    const scanQrBtn = document.getElementById('scanQrBtn');
    const qrScannerModal = document.getElementById('qrScannerModal');
    const qrScannerModalContent = document.getElementById('qrScannerModalContent');
    const qrVideo = document.getElementById('qrVideo');
    const qrCanvas = document.getElementById('qrCanvas');
    const qrScanMessage = document.getElementById('qrScanMessage');
    const qrScanError = document.getElementById('qrScanError');
    const closeQrScannerModalBtn = document.getElementById('closeQrScannerModalBtn');
    const selectImageBtn = document.getElementById('selectImageBtn');
    const qrImageInput = document.getElementById('qrImageInput');
    const startCameraScanBtn = document.getElementById('startCameraScanBtn');

    // Attendance Settings Elements
    const attendanceSettingsForm = document.getElementById('attendanceSettingsForm');
    const lateCutoffTimeInput = document.getElementById('lateCutoffTime');
    const latePenaltyAmountInput = document.getElementById('latePenaltyAmount');
    const settingsSaveMsg = document.getElementById('settingsSaveMsg');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Office Location Elements
    const officeAddressInput = document.getElementById('officeAddressInput');
    const officeAddressSuggestions = document.getElementById('officeAddressSuggestions'); // Suggestions container
    const officeLatInput = document.getElementById('officeLatInput');
    const officeLonInput = document.getElementById('officeLonInput');
    const acceptRadiusInput = document.getElementById('acceptRadiusInput');
    const officeMapDiv = document.getElementById('officeMap');
    const useCurrentLocationBtn = document.getElementById('useCurrentLocationBtn');
    const saveOfficeLocationBtn = document.getElementById('saveOfficeLocationBtn');
    const locationSaveMsg = document.getElementById('locationSaveMsg');

    // Custom Loading Screen Elements
    const customLoadingOverlay = document.getElementById('customLoadingOverlay');
    const contentWrapper = document.getElementById('contentWrapper');

    // --- Firebase Initialization and Authentication ---
    const firebaseConfig = {
        apiKey: "AIzaSyDVdSSeAlhK1sgjyeSLSdNW3zesatzPKDE",
        authDomain: "data-absen-2025.firebaseapp.com",
        projectId: "data-absen-2025",
        storageBucket: "data-absen-2025.firebasestorage.app",
        messagingSenderId: "771101147789",
        appId: "1:771101147789:web:955049d4939500cfe4d8c4",
        measurementId: "G-H0S4BS3M50"
    };

    appId = firebaseConfig.projectId;

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            isFirebaseReady = true;
            await loadAttendanceSettings();
            await loadOfficeLocation();
            updateUIForAdmin();
            setupFirestoreListener();
            checkAndHideLoader();
        } else {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Firebase Auth Error:", error);
                checkAndHideLoader();
                locationCard.innerHTML = `
                    <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                        Gagal terhubung ke server absensi. Mohon periksa koneksi internet Anda atau hubungi admin jika masalah berlanjut. (${error.message})
                    </div>
                `;
            }
        }
    });

    // --- Loading Screen Logic ---
    function checkAndHideLoader() {
        if (isFirebaseReady && pageContentLoaded && minimumLoadingTimeElapsed) {
            customLoadingOverlay.classList.add('fade-out');
            customLoadingOverlay.addEventListener('transitionend', () => {
                customLoadingOverlay.style.display = 'none';
                document.body.style.overflow = 'auto';
                contentWrapper.classList.add('visible');
            }, { once: true });
        }
    }

    // Mark page content loaded
    document.addEventListener('DOMContentLoaded', () => {
        pageContentLoaded = true;
        checkAndHideLoader();
    });

    // Ensure minimum loading time
    setTimeout(() => {
        minimumLoadingTimeElapsed = true;
        checkAndHideLoader();
    }, MINIMUM_LOADING_TIME_MS);

    // --- Firestore Data Management ---
    function setupFirestoreListener() {
        if (!isFirebaseReady) return;

        // Listener for Attendance Records
        const attendanceColRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendanceRecords');
        onSnapshot(attendanceColRef, (snapshot) => {
            const records = [];
            snapshot.forEach(doc => {
                records.push({ id: doc.id, ...doc.data() });
            });
            records.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            currentAttendanceRecordsWithIds = records;
            if (isAdminLoggedIn) {
                renderAttendanceTable();
            }
        }, (error) => {
            console.error("Error fetching attendance records from Firestore:", error);
            if (isAdminLoggedIn) {
                noAttendanceMsg.textContent = `Gagal memuat history absensi: ${error.message}`;
                noAttendanceMsg.classList.remove('hidden');
            }
        });

        // Listener for Registered Employees
        const employeesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'registeredEmployees');
        onSnapshot(employeesColRef, (snapshot) => {
            const employees = [];
            snapshot.forEach(doc => {
                employees.push({ id: doc.id, ...doc.data() });
            });
            employees.sort((a, b) => a.name.localeCompare(b.name));
            currentRegisteredEmployees = employees;
            if (isAdminLoggedIn) {
                renderEmployeesTable();
            }
        }, (error) => {
            console.error("Error fetching employee records from Firestore:", error);
            if (isAdminLoggedIn) {
                noEmployeesMsg.textContent = `Gagal memuat daftar karyawan: ${error.message}`;
                noEmployeesMsg.classList.remove('hidden');
            }
        });

        // Listener for Attendance Settings
        const attendanceSettingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendanceSettings');
        onSnapshot(attendanceSettingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                lateCutoffHour = data.lateCutoffHour !== undefined ? data.lateCutoffHour : 7;
                lateCutoffMinute = data.lateCutoffMinute !== undefined ? data.lateCutoffMinute : 0;
                latePenaltyPerMinute = data.latePenaltyPerMinute !== undefined ? data.latePenaltyPerMinute : 1000;

                if (isAdminLoggedIn) {
                    lateCutoffTimeInput.value = `${String(lateCutoffHour).padStart(2, '0')}:${String(lateCutoffMinute).padStart(2, '0')}`;
                    latePenaltyAmountInput.value = latePenaltyPerMinute;
                }
            } else {
                lateCutoffHour = 7;
                lateCutoffMinute = 0;
                latePenaltyPerMinute = 1000;
                if (isAdminLoggedIn) {
                    lateCutoffTimeInput.value = '07:00';
                    latePenaltyAmountInput.value = 1000;
                }
            }
        }, (error) => {
            console.error("Error fetching attendance settings from Firestore:", error);
            if (isAdminLoggedIn) {
                settingsSaveMsg.textContent = `Gagal memuat pengaturan: ${error.message}`;
                settingsSaveMsg.classList.add('text-red-600');
                settingsSaveMsg.classList.remove('hidden');
            }
        });

        // Listener for Office Location Settings
        const officeLocationDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'officeLocation');
        onSnapshot(officeLocationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                officeLocation.latitude = data.latitude !== undefined ? data.latitude : 3.5890625;
                officeLocation.longitude = data.longitude !== undefined ? data.longitude : 98.6679375;
                officeLocation.acceptRadius = data.acceptRadius !== undefined ? data.acceptRadius : 200;
                officeLocation.address = data.address !== undefined ? data.address : "Medan, Sumatera Utara, Indonesia"; // Load address

                // Update admin location form inputs if admin is logged in
                if (isAdminLoggedIn) {
                    officeLatInput.value = officeLocation.latitude;
                    officeLonInput.value = officeLocation.longitude;
                    acceptRadiusInput.value = officeLocation.acceptRadius;
                    officeAddressInput.value = officeLocation.address; // Update address input
                    if (map && officeMarker) {
                        const newLatLng = new google.maps.LatLng(officeLocation.latitude, officeLocation.longitude);
                        officeMarker.setPosition(newLatLng);
                        map.setCenter(newLatLng);
                        map.setZoom(15);
                    }
                }
            } else {
                // If document doesn't exist, use default values for officeLocation
                officeLocation.latitude = 3.5890625;
                officeLocation.longitude = 98.6679375;
                officeLocation.acceptRadius = 200;
                officeLocation.address = "Medan, Sumatera Utara, Indonesia"; // Default address
                if (isAdminLoggedIn) {
                    officeLatInput.value = officeLocation.latitude;
                    officeLonInput.value = officeLocation.longitude;
                    acceptRadiusInput.value = officeLocation.acceptRadius;
                    officeAddressInput.value = officeLocation.address; // Update address input
                    if (map && officeMarker) {
                        const newLatLng = new google.maps.LatLng(officeLocation.latitude, officeLocation.longitude);
                        officeMarker.setPosition(newLatLng);
                        map.setCenter(newLatLng);
                        map.setZoom(15);
                    }
                }
            }
        }, (error) => {
            console.error("Error fetching office location settings from Firestore:", error);
            if (isAdminLoggedIn) {
                locationSaveMsg.textContent = `Gagal memuat lokasi kantor: ${error.message}`;
                locationSaveMsg.classList.add('text-red-600');
                locationSaveMsg.classList.remove('hidden');
            }
        });
    }

    async function loadAttendanceSettings() {
        if (!isFirebaseReady) return;
        const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendanceSettings');
        try {
            const docSnap = await getDoc(settingsDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                lateCutoffHour = data.lateCutoffHour !== undefined ? data.lateCutoffHour : 7;
                lateCutoffMinute = data.lateCutoffMinute !== undefined ? data.lateCutoffMinute : 0;
                latePenaltyPerMinute = data.latePenaltyPerMinute !== undefined ? data.latePenaltyPerMinute : 1000;
            } else {
                await saveAttendanceSettings(7, 0, 1000);
            }
        } catch (e) {
            console.error("Error loading attendance settings:", e);
            lateCutoffHour = 7;
            lateCutoffMinute = 0;
            latePenaltyPerMinute = 1000;
        }
    }

    async function saveAttendanceSettings(hour, minute, penalty) {
        if (!isFirebaseReady) {
            settingsSaveMsg.textContent = 'Server tidak siap. Coba lagi.';
            settingsSaveMsg.classList.add('text-red-600');
            settingsSaveMsg.classList.remove('hidden');
            return false;
        }
        const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'attendanceSettings');
        try {
            await setDoc(settingsDocRef, {
                lateCutoffHour: hour,
                lateCutoffMinute: minute,
                latePenaltyPerMinute: penalty
            });
            console.log("Attendance settings saved successfully!");
            settingsSaveMsg.textContent = 'Pengaturan berhasil disimpan!';
            settingsSaveMsg.classList.remove('text-red-600', 'hidden');
            settingsSaveMsg.classList.add('text-green-600');
            setTimeout(() => settingsSaveMsg.classList.add('hidden'), 3000);
            return true;
        } catch (e) {
            console.error("Error saving attendance settings: ", e);
            settingsSaveMsg.textContent = `Gagal menyimpan pengaturan: ${e.message}`;
            settingsSaveMsg.classList.remove('hidden', 'text-green-600');
            settingsSaveMsg.classList.add('text-red-600');
            return false;
        }
    }

    // Load Office Location from Firestore
    async function loadOfficeLocation() {
        if (!isFirebaseReady) return;
        const officeLocationDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'officeLocation');
        try {
            const docSnap = await getDoc(officeLocationDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                officeLocation.latitude = data.latitude !== undefined ? data.latitude : 3.5890625;
                officeLocation.longitude = data.longitude !== undefined ? data.longitude : 98.6679375;
                officeLocation.acceptRadius = data.acceptRadius !== undefined ? data.acceptRadius : 200;
                officeLocation.address = data.address !== undefined ? data.address : "Medan, Sumatera Utara, Indonesia"; // Load address
            } else {
                await saveOfficeLocation(officeLocation.latitude, officeLocation.longitude, officeLocation.acceptRadius, officeLocation.address);
            }
        } catch (e) {
            console.error("Error loading office location:", e);
            officeLocation.latitude = 3.5890625;
            officeLocation.longitude = 98.6679375;
            officeLocation.acceptRadius = 200;
            officeLocation.address = "Medan, Sumatera Utara, Indonesia";
        }
    }

    // Save Office Location to Firestore
    async function saveOfficeLocation(lat, lon, radius, address) { // Added address parameter
        if (!isFirebaseReady) {
            locationSaveMsg.textContent = 'Server tidak siap. Coba lagi.';
            locationSaveMsg.classList.add('text-red-600');
            locationSaveMsg.classList.remove('hidden');
            return false;
        }
        const officeLocationDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'officeLocation');
        try {
            await setDoc(officeLocationDocRef, {
                latitude: lat,
                longitude: lon,
                acceptRadius: radius,
                address: address // Save address
            });
            officeLocation.latitude = lat;
            officeLocation.longitude = lon;
            officeLocation.acceptRadius = radius;
            officeLocation.address = address; // Update global address
            console.log("Office location saved successfully!");
            locationSaveMsg.textContent = 'Lokasi kantor berhasil disimpan!';
            locationSaveMsg.classList.remove('text-red-600', 'hidden');
            locationSaveMsg.classList.add('text-green-600');
            setTimeout(() => locationSaveMsg.classList.add('hidden'), 3000);
            return true;
        } catch (e) {
            console.error("Error saving office location: ", e);
            locationSaveMsg.textContent = `Gagal menyimpan lokasi kantor: ${e.message}`;
            locationSaveMsg.classList.remove('hidden', 'text-green-600');
            locationSaveMsg.classList.add('text-red-600');
            return false;
        }
    }

    async function saveAttendanceRecord(record) {
        if (!isFirebaseReady) {
            locationCard.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 mt-4 select-none">
                    Aplikasi belum siap untuk menyimpan data. Silakan coba lagi.
                </div>
            `;
            return;
        }
        try {
            const attendanceColRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendanceRecords');
            await addDoc(attendanceColRef, {
                ...record,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error("Error adding document to Firestore: ", e);
            locationCard.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                    Gagal menyimpan absensi ke server: ${e.message}
                </div>
            `;
        }
    }

    async function addEmployeeToFirestore(name, id) {
        if (!isFirebaseReady) {
            addEmployeeErrorMsg.textContent = 'Server tidak siap. Coba lagi.';
            addEmployeeErrorMsg.classList.remove('hidden');
            return false;
        }
        try {
            const employeeDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'registeredEmployees', id);
            await setDoc(employeeDocRef, { name: name, id: id });
            return true;
        } catch (e) {
            console.error("Error adding employee to Firestore: ", e);
            addEmployeeErrorMsg.textContent = `Gagal menambahkan karyawan: ${e.message}`;
            addEmployeeErrorMsg.classList.remove('hidden');
            return false;
        }
    }

    async function deleteEmployeeFromFirestore(employeeId) {
        if (!isFirebaseReady) {
            deleteEmployeeErrorMsg.textContent = 'Server tidak siap. Coba lagi.';
            deleteEmployeeErrorMsg.classList.remove('hidden');
            return false;
        }
        try {
            const employeeDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'registeredEmployees', employeeId);
            await deleteDoc(employeeDocRef);
            return true;
        } catch (e) {
            console.error("Error deleting employee from Firestore: ", e);
            deleteEmployeeErrorMsg.textContent = `Gagal menghapus karyawan: ${e.message}`;
            deleteEmployeeErrorMsg.classList.remove('hidden');
            return false;
        }
    }

    function renderAttendanceTable() {
        const attendanceListContainer = document.getElementById('attendanceListContainer');
        attendanceListContainer.innerHTML = '';

        if (currentAttendanceRecordsWithIds.length === 0) {
            noAttendanceMsg.classList.remove('hidden');
            return;
        } else {
            noAttendanceMsg.classList.add('hidden');
        }

        const groupedAttendance = new Map();
        for (const record of currentAttendanceRecordsWithIds) {
            if (!groupedAttendance.has(record.id)) {
                groupedAttendance.set(record.id, []);
            }
            groupedAttendance.get(record.id).push(record);
        }

        for (const [employeeId, records] of groupedAttendance.entries()) {
            const employee = currentRegisteredEmployees.find(emp => emp.id === employeeId);
            const employeeName = employee ? employee.name : (records[0] ? records[0].name : 'Karyawan Tidak Dikenal');
            const attendanceCount = records.length;

            const employeeCardDiv = document.createElement('div');
            employeeCardDiv.classList.add('employee-attendance-card', 'bg-gray-50', 'rounded-xl', 'shadow-md', 'p-4', 'sm:p-6', 'border', 'border-gray-200');

            employeeCardDiv.innerHTML = `
                <h4 class="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                    <span>${escapeHtml(employeeName)}</span>
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">${attendanceCount} Kehadiran</span>
                </h4>
                <div class="overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400">
                    <table class="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr class="border-b border-gray-300 text-gray-700 select-none bg-gray-100">
                                <th class="py-3 px-4">Tanggal &amp; Waktu</th>
                                <th class="py-3 px-4">Latitude</th>
                                <th class="py-3 px-4">Longitude</th>
                                <th class="py-3 px-4">Alamat</th>
                                <th class="py-3 px-4">Keterangan</th>
                                <th class="py-3 px-4">Status Waktu</th>
                                <th class="py-3 px-4">Keterangan Denda</th>
                                <th class="py-3 px-4">Jumlah Denda</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200" id="attendanceTableBody-${escapeHtml(employeeId)}">
                        </tbody>
                    </table>
                </div>
                ${attendanceCount === 0 ? `<p class="text-center text-gray-500 mt-4">Belum ada absensi untuk karyawan ini.</p>` : ''}
            `;
            attendanceListContainer.appendChild(employeeCardDiv);

            const currentEmployeeTableBody = document.getElementById(`attendanceTableBody-${escapeHtml(employeeId)}`);

            records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            for (const r of records) {
                let statusText = r.keterangan;
                let statusClass = r.keterangan === 'Di luar lokasi' ? 'text-red-700 urgent-alert' : 'text-green-700';

                let lateStatusText = r.isLate ? `Telat ${r.lateMinutes} menit` : 'Tepat Waktu';
                let lateStatusClass = r.isLate ? 'text-red-600 font-semibold' : 'text-green-600';
                let lateIconSvg = r.isLate ? `<svg class="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>` : '';

                let penaltyKeterangan = r.isLate ? `Terlambat ${r.lateMinutes} menit` : '-';
                let penaltyAmount = r.isLate && r.penaltyAmount ? `Rp. ${r.penaltyAmount.toLocaleString('id-ID')}` : '-';
                let penaltyClass = r.isLate ? 'text-red-600 font-bold' : 'text-gray-500';

                const tr = document.createElement('tr');
                tr.classList.add('hover:bg-gray-50', 'transition');
                tr.innerHTML = `
                    <td class="py-3 px-4 text-sm">${escapeHtml(r.datetime)}</td>
                    <td class="py-3 px-4 text-sm font-mono">${escapeHtml(r.latitude)}</td>
                    <td class="py-3 px-4 text-sm font-mono">${escapeHtml(r.longitude)}</td>
                    <td class="py-3 px-4 text-sm">${escapeHtml(r.address)}</td>
                    <td class="py-3 px-4 text-sm font-semibold ${statusClass} select-none">
                        ${escapeHtml(statusText)}
                    </td>
                    <td class="py-3 px-4 text-sm ${lateStatusClass} select-none">
                        ${lateIconSvg} ${escapeHtml(lateStatusText)}
                    </td>
                    <td class="py-3 px-4 text-sm ${penaltyClass} select-none">
                        ${escapeHtml(penaltyKeterangan)}
                    </td>
                    <td class="py-3 px-4 text-sm ${penaltyClass} select-none">
                        ${escapeHtml(penaltyAmount)}
                    </td>
                `;
                currentEmployeeTableBody.appendChild(tr);
            }
        }
    }

    function renderEmployeesTable() {
        employeesTableBody.innerHTML = '';
        if (currentRegisteredEmployees.length === 0) {
            noEmployeesMsg.classList.remove('hidden');
        } else {
            noEmployeesMsg.classList.add('hidden');
            for (const emp of currentRegisteredEmployees) {
                const tr = document.createElement('tr');
                tr.classList.add('hover:bg-gray-50', 'transition');
                tr.innerHTML = `
                    <td class="py-3 px-4 font-medium">${escapeHtml(emp.name)}</td>
                    <td class="py-3 px-4 font-mono text-xs break-all">${escapeHtml(emp.id)}</td>
                    <td class="py-3 px-4">
                        <button data-employee-id="${escapeHtml(emp.id)}" data-employee-name="${escapeHtml(emp.name)}" class="delete-employee-btn px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-md hover:bg-red-600 transition">
                            Hapus
                        </button>
                    </td>
                    <td class="py-3 px-4"> <!-- New column for QR Code button -->
                        <button data-employee-id="${escapeHtml(emp.id)}" class="generate-qr-btn px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition">
                            QR
                        </button>
                    </td>
                `;
                employeesTableBody.appendChild(tr);
            }

            document.querySelectorAll('.delete-employee-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    employeeIdToDelete = e.target.dataset.employeeId;
                    const nameToDelete = e.target.dataset.employeeName;
                    employeeToDeleteName.textContent = nameToDelete;
                    deleteEmployeeErrorMsg.classList.add('hidden');
                    deleteEmployeeConfirmModal.classList.remove('hidden');
                });
            });

            document.querySelectorAll('.generate-qr-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const employeeId = e.target.dataset.employeeId;
                    displayQrCode(employeeId);
                });
            });
        }
    }

    function displayQrCode(employeeId) {
        qrcodeDiv.innerHTML = '';
        qrEmployeeIdDisplay.textContent = employeeId;

        new QRCode(qrcodeDiv, {
            text: employeeId,
            width: 180,
            height: 180,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        qrCodeModal.classList.remove('hidden');
        qrCodeModalContent.classList.remove('opacity-0', 'scale-95');
        qrCodeModalContent.classList.add('opacity-100', 'scale-100');
        qrCodeModal.focus();
    }

    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getDate() === d2.getDate();
    }

    function formatDate(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Intl.DateTimeFormat('id-ID', options).format(date);
    }

    function formatTime(date) {
        const options = { hour: '2-digit', minute: '2-digit' };
        return new Intl.DateTimeFormat('id-ID', options).format(date);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d;
    }
    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    // --- Core Attendance Recording Logic ---
    async function recordAttendance(employeeName, employeeId) {
        locationCard.innerHTML = `
            <div class="flex items-center justify-center space-x-2 mt-2">
                <svg class="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span class="text-blue-600 font-medium">Mendeteksi lokasi...</span>
            </div>
        `;

        const today = new Date();
        const existingAttendanceToday = currentAttendanceRecordsWithIds.find(record =>
            record.id === employeeId &&
            record.timestamp &&
            isSameDay(new Date(record.timestamp), today)
        );

        if (existingAttendanceToday) {
            const recordedTime = formatTime(new Date(existingAttendanceToday.timestamp));
            locationCard.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-4 mt-4 select-none">
                    Anda sudah absen hari ini pada pukul ${recordedTime}.
                </div>
            `;
            employeeNameInput.value = '';
            detectBtn.disabled = true;
            return;
        }

        if (!navigator.geolocation) {
            locationCard.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                    Browser Anda tidak mendukung deteksi lokasi.
                </div>
            `;
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async function(position) {
                const { latitude, longitude } = position.coords;
                try {
                    // Use GoMaps.pro for reverse geocoding for employee attendance
                    const addressResult = await reverseGeocodeGoMaps(latitude, longitude);
                    const address = addressResult || "Alamat tidak ditemukan";
                    const now = new Date();

                    const distance = getDistanceFromLatLonInMeters(latitude, longitude, officeLocation.latitude, officeLocation.longitude);
                    const inLocation = distance <= officeLocation.acceptRadius;

                    const keterangan = inLocation ? 'Di lokasi' : 'Di luar lokasi';

                    let isLate = false;
                    let lateMinutes = 0;
                    let penaltyAmount = 0;

                    const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), lateCutoffHour, lateCutoffMinute, 0, 0);

                    if (now.getTime() > cutoffDate.getTime()) {
                        isLate = true;
                        const diffMs = now.getTime() - cutoffDate.getTime();
                        lateMinutes = Math.ceil(diffMs / (1000 * 60));
                        penaltyAmount = lateMinutes * latePenaltyPerMinute;
                    }

                    let locationCardContent = '';
                    let statusBadgeClass = '';
                    let statusTextClass = '';
                    let statusIcon = '';

                    if (inLocation) {
                        statusBadgeClass = 'bg-green-50 border-green-200';
                        statusTextClass = 'text-green-700';
                        statusIcon = `
                            <svg class="w-8 h-8 text-green-500 mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M5 13l4 4L19 7" />
                            </svg>
                        `;
                    } else {
                        statusBadgeClass = 'urgent-alert';
                        statusTextClass = 'text-red-700';
                        statusIcon = `
                            <svg class="w-10 h-10 mb-3" fill="none" stroke="#b91c1c" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M12 9v2m0 4h.01M10.29 6.16a8 8 0 1113.42 10.69m-5.67-10.57L3 21" />
                            </svg>
                        `;
                    }

                    let lateBadge = '';
                    let penaltyInfo = '';

                    if (isLate) {
                        lateBadge = `
                            <div class="mt-3 text-red-600 font-bold flex items-center justify-center">
                                <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                TERLAMBAT: ${lateMinutes} menit
                            </div>
                        `;
                        penaltyInfo = `
                            <div class="text-red-700 font-bold mt-2">
                                Denda Keterlambatan: ${formatCurrency(penaltyAmount)}
                            </div>
                        `;
                    }


                    locationCardContent = `
                                <div class="${statusBadgeClass} border rounded-xl p-5 mt-4 flex flex-col items-center select-text">
                                    ${statusIcon}
                                    <div class="${statusTextClass} font-semibold mb-1">${inLocation ? 'Absensi berhasil dicatat!' : 'PERINGATAN DARURAT: Karyawan tidak di lokasi kantor!'}</div>
                                    <div class="text-gray-700 text-sm">Nama: <span class="font-semibold">${escapeHtml(employeeName)}</span></div>
                                    <div class="text-gray-700 text-sm">Waktu: <span class="font-mono">${formatDate(now)}</span></div>
                                    <div class="text-gray-700 text-sm">Latitude: <span class="font-mono">${latitude.toFixed(6)}</span></div>
                                    <div class="text-gray-700 text-sm">Longitude: <span class="font-mono">${longitude.toFixed(6)}</span></div>
                                    <div class="text-gray-700 text-sm mt-2">Alamat: <span class="font-mono">${escapeHtml(address)}</span></div>
                                    <div class="${statusTextClass} font-bold mt-3 select-none">${keterangan}</div>
                                    ${lateBadge}
                                    ${penaltyInfo}
                                </div>
                            `;
                    locationCard.innerHTML = locationCardContent;

                    const record = {
                        name: employeeName,
                        id: employeeId,
                        datetime: formatDate(now),
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6),
                        address: address,
                        keterangan: keterangan,
                        isLate: isLate,
                        lateMinutes: lateMinutes,
                        penaltyAmount: penaltyAmount
                    };
                    saveAttendanceRecord(record);

                    employeeNameInput.value = '';
                    detectBtn.disabled = true;

                } catch (error) {
                    console.error("Error fetching address or processing location:", error);
                    locationCard.innerHTML = `
                        <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                            Gagal mendapatkan alamat atau mencatat absensi: ${error.message}
                        </div>
                    `;
                }
            },
            function(error) {
                let message = "Gagal mendeteksi lokasi.";
                if (error.code === 1) message = "Izin lokasi ditolak. Silakan izinkan akses lokasi pada browser Anda.";
                else if (error.code === 2) message = "Lokasi tidak tersedia.";
                else if (error.code === 3) message = "Permintaan lokasi melebihi waktu tunggu.";
                locationCard.innerHTML = `
                    <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                        ${message}
                    </div>
                `;
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // --- UI Logic and Event Listeners ---

    employeeNameInput.addEventListener('input', () => {
        detectBtn.disabled = employeeNameInput.value.trim().length === 0;
    });

    adminLoginBtn.addEventListener('click', () => {
        loginErrorMsg.classList.add('hidden');
        adminLoginForm.reset();
        adminLoginModal.classList.remove('hidden');
        loginModalContent.classList.remove('opacity-0', 'scale-95');
        loginModalContent.classList.add('opacity-100', 'scale-100');
        adminEmailInput.focus();
    });

    document.getElementById('closeLoginModalBtn').addEventListener('click', () => {
        loginModalContent.classList.remove('opacity-100', 'scale-100');
        loginModalContent.classList.add('opacity-0', 'scale-95');
        loginModalContent.addEventListener('transitionend', function handler() {
            adminLoginModal.classList.add('hidden');
            loginModalContent.removeEventListener('transitionend', handler);
        }, {once: true});
    });
    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !adminLoginModal.classList.contains('hidden')) {
            document.getElementById('closeLoginModalBtn').click();
        }
    });

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = adminEmailInput.value.trim();
        const password = adminPasswordInput.value;

        loginErrorMsg.classList.add('hidden');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Admin berhasil login:", user.email);
            isAdminLoggedIn = true;

            loginModalContent.classList.remove('opacity-100', 'scale-100');
            loginModalContent.classList.add('opacity-0', 'scale-95');

            loginModalContent.addEventListener('transitionend', function handler() {
                adminLoginModal.classList.add('hidden');
                loginModalContent.removeEventListener('transitionend', handler);
                updateUIForAdmin();
            }, {once: true});

        } catch (error) {
            console.error("Login admin gagal:", error.code, error.message);
            let errorMessage = 'Login gagal. Periksa email dan password Anda.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Email atau password salah.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Format email tidak valid.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Terlalu banyak percobaan login. Coba lagi nanti.';
            }
            loginErrorMsg.textContent = errorMessage;
            loginErrorMsg.classList.remove('hidden');
        }
    });

    adminLogoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            isAdminLoggedIn = false;
            updateUIForAdmin();
        } catch (error) {
            console.error("Error logging out:", error);
        }
    });

    function updateUIForAdmin() {
        if (isAdminLoggedIn) {
            lateCutoffTimeInput.value = `${String(lateCutoffHour).padStart(2, '0')}:${String(lateCutoffMinute).padStart(2, '0')}`;
            latePenaltyAmountInput.value = latePenaltyPerMinute;
            settingsSaveMsg.classList.add('hidden');

            officeLatInput.value = officeLocation.latitude;
            officeLonInput.value = officeLocation.longitude;
            acceptRadiusInput.value = officeLocation.acceptRadius;
            officeAddressInput.value = officeLocation.address; // Populate address input
            locationSaveMsg.classList.add('hidden');

            // Initialize/update the map using GoMaps.pro
            if (window.google && window.google.maps) {
                if (!map) {
                    map = new google.maps.Map(officeMapDiv, {
                        center: { lat: officeLocation.latitude, lng: officeLocation.longitude },
                        zoom: 15,
                        mapTypeId: 'roadmap',
                        streetViewControl: false
                    });

                    officeMarker = new google.maps.Marker({
                        position: { lat: officeLocation.latitude, lng: officeLocation.longitude },
                        map: map,
                        draggable: true,
                        title: "Lokasi Kantor"
                    });

                    // Update input fields when marker is dragged
                    officeMarker.addListener('dragend', async () => {
                        const newPosition = officeMarker.getPosition();
                        officeLatInput.value = newPosition.lat().toFixed(7);
                        officeLonInput.value = newPosition.lng().toFixed(7);
                        // Reverse geocode to get address from new coordinates using GoMaps.pro
                        await reverseGeocodeGoMaps(newPosition.lat(), newPosition.lng());
                    });

                } else {
                    // If map already exists, just update its center and marker position
                    const newLatLng = new google.maps.LatLng(officeLocation.latitude, officeLocation.longitude);
                    officeMarker.setPosition(newLatLng);
                    map.setCenter(newLatLng);
                    map.setZoom(15);
                }
            } else {
                console.warn("GoMaps.pro API not yet loaded. Map will initialize when API is ready.");
            }

            heroSection.classList.add('hidden');
            fiturSection.classList.add('hidden');
            absenSection.classList.add('hidden');
            adminLoginBtn.classList.add('hidden');

            adminDashboard.classList.remove('hidden');
            adminLogoutBtn.classList.remove('hidden');

            locationCard.innerHTML = '';
            employeeNameInput.value = '';
            detectBtn.disabled = true;

            renderAttendanceTable();
            renderEmployeesTable();
        } else {
            adminDashboard.classList.add('hidden');
            adminLogoutBtn.classList.add('hidden');

            heroSection.classList.remove('hidden');
            fiturSection.classList.remove('hidden');
            absenSection.classList.remove('hidden');
            adminLoginBtn.classList.remove('hidden');

            locationCard.innerHTML = '';
        }
    }

    document.getElementById('startBtn').addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('absen').scrollIntoView({ behavior: 'smooth' });
    });

    detectBtn.addEventListener('click', () => {
        const employeeName = employeeNameInput.value.trim();
        if (employeeName.length === 0) {
            locationCard.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 mt-4 select-none">
                    Silakan masukkan nama karyawan terlebih dahulu.
                </div>
            `;
            return;
        }
        const registeredEmployee = currentRegisteredEmployees.find(emp => emp.name.toLowerCase() === employeeName.toLowerCase());
        if (!registeredEmployee) {
            locationCard.innerHTML = `
                        <div class="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4 mt-4 select-none">
                            Nama karyawan "${escapeHtml(employeeName)}" tidak terdaftar. Harap hubungi admin.
                        </div>
                    `;
            employeeNameInput.value = '';
            detectBtn.disabled = true;
            return;
        }
        recordAttendance(registeredEmployee.name, registeredEmployee.id);
    });

    resetHistoryBtn.addEventListener('click', () => {
        resetPinInput.value = '';
        resetErrorMsg.classList.add('hidden');
        resetConfirmModal.classList.remove('hidden');
        resetPinInput.focus();
    });

    cancelResetBtn.addEventListener('click', () => {
        resetConfirmModal.classList.add('hidden');
    });

    confirmResetBtn.addEventListener('click', async () => {
        const enteredPin = resetPinInput.value;
        if (enteredPin === RESET_PIN) {
            if (!isFirebaseReady) {
                resetErrorMsg.textContent = 'Server tidak siap. Coba lagi.';
                resetErrorMsg.classList.remove('hidden');
                return;
            }
            try {
                const attendanceColRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendanceRecords');
                const q = query(attendanceColRef);
                const querySnapshot = await getDocs(q);

                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();

                console.log("All records deleted from Firestore!");
                resetConfirmModal.classList.add('hidden');
                locationCard.innerHTML = `
                    <div class="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mt-4 select-none">
                        History absensi berhasil dihapus!
                    </div>
                `;
                setTimeout(() => locationCard.innerHTML = '', 3000);
            } catch (e) {
                console.error("Error deleting documents: ", e);
                resetErrorMsg.textContent = `Gagal menghapus history: ${e.message}`;
                resetErrorMsg.classList.remove('hidden');
            }
        } else {
            resetErrorMsg.textContent = 'PIN salah. Silakan coba lagi.';
            resetErrorMsg.classList.remove('hidden');
        }
    });

    addEmployeeBtn.addEventListener('click', () => {
        newEmployeeName.value = '';
        newEmployeeIdDisplay.value = crypto.randomUUID();
        addEmployeeErrorMsg.classList.add('hidden');
        addEmployeeModal.classList.remove('hidden');
        addEmployeeModalContent.classList.remove('opacity-0', 'scale-95');
        addEmployeeModalContent.classList.add('opacity-100', 'scale-100');
        newEmployeeName.focus();
    });

    cancelAddEmployeeBtn.addEventListener('click', () => {
        addEmployeeModalContent.classList.remove('opacity-100', 'scale-100');
        addEmployeeModalContent.classList.add('opacity-0', 'scale-95');
        addEmployeeModalContent.addEventListener('transitionend', function handler() {
            addEmployeeModal.classList.add('hidden');
            addEmployeeModalContent.removeEventListener('transitionend', handler);
        }, {once: true});
    });

    addEmployeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newEmployeeName.value.trim();
        const id = newEmployeeIdDisplay.value;

        if (name.length === 0) {
            addEmployeeErrorMsg.textContent = 'Nama karyawan tidak boleh kosong.';
            addEmployeeErrorMsg.classList.remove('hidden');
            return;
        }

        const nameExists = currentRegisteredEmployees.some(emp => emp.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
            addEmployeeErrorMsg.textContent = 'Nama karyawan ini sudah terdaftar.';
            addEmployeeErrorMsg.classList.remove('hidden');
            return;
        }

        addEmployeeConfirmBtn.disabled = true;
        addEmployeeErrorMsg.classList.add('hidden');

        const success = await addEmployeeToFirestore(name, id);
        if (success) {
            addEmployeeModalContent.classList.remove('opacity-100', 'scale-100');
            addEmployeeModalContent.classList.add('opacity-0', 'scale-95');
            addEmployeeModalContent.addEventListener('transitionend', function handler() {
                addEmployeeModal.classList.add('hidden');
                addEmployeeModalContent.removeEventListener('transitionend', handler);
                locationCard.innerHTML = `
                    <div class="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mt-4 select-none">
                        Karyawan "${escapeHtml(name)}" berhasil ditambahkan!
                    </div>
                `;
                setTimeout(() => locationCard.innerHTML = '', 3000);
            }, {once: true});
        }
        addEmployeeConfirmBtn.disabled = false;
    });

    cancelDeleteEmployeeBtn.addEventListener('click', () => {
        deleteEmployeeConfirmModal.classList.add('hidden');
        employeeIdToDelete = null;
    });

    confirmDeleteEmployeeBtn.addEventListener('click', async () => {
        if (!employeeIdToDelete) return;

        confirmDeleteEmployeeBtn.disabled = true;
        deleteEmployeeErrorMsg.classList.add('hidden');

        const success = await deleteEmployeeFromFirestore(employeeIdToDelete);
        if (success) {
            deleteEmployeeConfirmModal.classList.add('hidden');
            locationCard.innerHTML = `
                <div class="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mt-4 select-none">
                    Karyawan berhasil dihapus!
                </div>
            `;
            setTimeout(() => locationCard.innerHTML = '', 3000);
        }
        confirmDeleteEmployeeBtn.disabled = false;
        employeeIdToDelete = null;
    });

    closeQrModalBtn.addEventListener('click', () => {
        qrCodeModalContent.classList.remove('opacity-100', 'scale-100');
        qrCodeModalContent.classList.add('opacity-0', 'scale-95');
        qrCodeModalContent.addEventListener('transitionend', function handler() {
            qrCodeModal.classList.add('hidden');
            qrCodeModalContent.removeEventListener('transitionend', handler);
        }, {once: true});
    });

    scanQrBtn.addEventListener('click', () => {
        qrScanMessage.textContent = 'Pilih metode pemindaian QR Code.';
        qrScanError.classList.add('hidden');
        qrVideo.classList.add('hidden');
        qrScannerModal.classList.remove('hidden');
        qrScannerModalContent.classList.remove('opacity-0', 'scale-95');
        qrScannerModalContent.classList.add('opacity-100', 'scale-100');
        qrScannerModal.focus();
    });

    selectImageBtn.addEventListener('click', () => {
        qrImageInput.click();
    });

    qrImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            stopQrScanner();
            qrVideo.classList.add('hidden');
            qrScanMessage.textContent = 'Memindai gambar...';
            qrScanError.classList.add('hidden');

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const ctx = qrCanvas.getContext('2d');
                    const aspectRatio = img.width / img.height;
                    const maxWidth = 300;
                    const maxHeight = 300;

                    let drawWidth = img.width;
                    let drawHeight = img.height;

                    if (drawWidth > maxWidth) {
                        drawWidth = maxWidth;
                        drawHeight = drawWidth / aspectRatio;
                    }
                    if (drawHeight > maxHeight) {
                        drawHeight = maxHeight;
                        drawWidth = drawHeight * aspectRatio;
                    }

                    qrCanvas.width = drawWidth;
                    qrCanvas.height = drawHeight;

                    ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
                    const imageData = ctx.getImageData(0, 0, qrCanvas.width,
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
// Menggunakan ESM.SH agar bisa berjalan mulus di layar pratinjau (Preview)
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import {
  Monitor, Home, CalendarClock, History, Database,
  FileText, FilePlus, FileEdit, Clock, AlertTriangle, 
  CheckCircle, Trash2, Plus, UploadCloud, FileSpreadsheet, Save, X, Search,
  Edit, Download, Filter, MapPin, Bell, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, User, Check
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- PENGATURAN SUPABASE ---
const supabaseUrl = 'https://ggqhftplowteewzlzimu.supabase.co';
const supabaseKey = 'sb_publishable_O7S-yT9cFZiMWSLAOjSqoQ_uOtd8C3x';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ALGORITMA SMART PARSER EXCEL (Membaca segala jenis format Rupiah) ---
const parseExcelNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  // Ubah ke huruf besar dan hilangkan simbol mata uang, spasi
  let str = String(val).toUpperCase().replace(/RP|\s/g, ''); 
  
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  
  if (lastComma > lastDot && lastDot > -1) {
      // Format Indonesia: 1.500.000,00
      str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma > -1) {
      // Format Internasional: 1,500,000.00
      str = str.replace(/,/g, '');
  } else if (lastComma > -1) {
      // Hanya ada koma (misal: 1,500,000 atau 1500000,50)
      if (str.length - lastComma - 1 <= 2) { 
          str = str.replace(',', '.'); // Berfungsi sebagai desimal
      } else { 
          str = str.replace(/,/g, ''); // Berfungsi sebagai pemisah ribuan
      }
  } else if (lastDot > -1) {
      // Hanya ada titik (misal: 1.500.000 atau 1500000.50)
      if (str.length - lastDot - 1 <= 2) { 
          // Biarkan sebagai desimal
      } else { 
          str = str.replace(/\./g, ''); // Berfungsi sebagai pemisah ribuan
      }
  }
  
  // Ambil hanya angka, minus, dan titik desimal
  return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
};

export default function App() {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const [activeTab, setActiveTab] = useState('tab-home'); 
  const [notification, setNotification] = useState(null);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // State untuk Notifikasi Lonceng & Status Baca
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readNotifs, setReadNotifs] = useState([]);
  const notifRef = useRef(null);

  // State untuk Accordion Menu di Sidebar
  const [sidebarMenu, setSidebarMenu] = useState({ po: true, tagihan: true });

  const toggleSidebarMenu = (menu) => {
    setSidebarMenu(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  // State utama data dari Database
  const [pos, setPos] = useState([]);
  const [bills, setBills] = useState([]);

  // State Pencarian khusus untuk Master PO
  const [searchPOQuery, setSearchPOQuery] = useState('');

  // State untuk melacak PO mana yang sedang dibuka (expand) di menu Master PO
  const [expandedPOs, setExpandedPOs] = useState({});

  const togglePO = (poId) => {
    setExpandedPOs(prev => ({
      ...prev,
      [poId]: !prev[poId]
    }));
  };

  // Menutup dropdown notifikasi jika klik di luar area
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ambil daftar nama lokasi unik untuk Autocomplete
  const availableLocationNames = useMemo(() => {
    const names = new Set();
    pos.forEach(p => {
      if (p.locations) {
        p.locations.forEach(l => {
          if (l.name) names.add(l.name);
        });
      }
    });
    return Array.from(names);
  }, [pos]);

  // Saringan Master PO
  const filteredPOs = useMemo(() => {
    if (!searchPOQuery.trim()) return pos; 
    return pos.filter(p => p.poNumber.toLowerCase().includes(searchPOQuery.toLowerCase()));
  }, [pos, searchPOQuery]);

  // ==========================================
  // AMBIL DATA DARI SUPABASE
  // ==========================================
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoadingDB(true);
    try {
      const { data: posData, error: posErr } = await supabase
        .from('pos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (posErr) throw posErr;
      if (posData) {
        setPos(posData.map(p => ({ 
          idDB: p.id, 
          poNumber: p.po_number, 
          locations: p.locations 
        })));
      }

      const { data: billsData, error: billsErr } = await supabase
        .from('bills')
        .select('*')
        .order('date', { ascending: false });
      
      if (billsErr) throw billsErr;
      if (billsData) {
        setBills(billsData.map(b => ({
          id: b.id, 
          title: b.title, 
          noBast: b.no_bast, 
          amount: b.amount, 
          date: b.date, 
          year: b.year,
          hasPo: b.has_po, 
          poNumber: b.po_number, 
          locationId: b.location_id, 
          period: b.period,
          iteration: b.iteration, 
          locationName: b.location_name
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotif('Gagal mengambil data dari sistem.', 'error');
    } finally {
      setIsLoadingDB(false);
    }
  };

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(number);
  };

  const formatInputNumber = (val) => {
    if (!val) return '';
    let str = String(val);
    if (str.includes(',')) {
      str = str.split(',')[0];
    }
    const raw = str.replace(/[^0-9]/g, '');
    return raw ? new Intl.NumberFormat('id-ID').format(raw) : '';
  };

  const generateMonthsArray = (startMonthStr, limit) => {
    if (!startMonthStr || !limit || limit <= 0) return [];
    
    const parts = startMonthStr.split('-'); 
    if (parts.length !== 2) return [];
    
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1; 
    const periods = [];
    const dateObj = new Date(year, month, 1);
    
    for (let i = 0; i < limit; i++) {
        const formatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
        periods.push(formatter.format(dateObj));
        dateObj.setMonth(dateObj.getMonth() + 1);
    }
    return periods;
  };

  const parseIndonesianMonth = (monthStr, year) => {
    if (!monthStr) return '';
    const m = monthStr.toString().trim().toLowerCase();
    
    if (/^\d{4}-\d{2}$/.test(m)) return m;
    
    const map = {
      'januari': '01', 'jan': '01', '1': '01', '01': '01',
      'februari': '02', 'feb': '02', '2': '02', '02': '02',
      'maret': '03', 'mar': '03', '3': '03', '03': '03',
      'april': '04', 'apr': '04', '4': '04', '04': '04',
      'mei': '05', '5': '05', '05': '05',
      'juni': '06', 'jun': '06', '6': '06', '06': '06',
      'juli': '07', 'jul': '07', '7': '07', '07': '07',
      'agustus': '08', 'agu': '08', 'ags': '08', '8': '08', '08': '08',
      'september': '09', 'sep': '09', '9': '09', '09': '09',
      'oktober': '10', 'okt': '10', '10': '10',
      'november': '11', 'nov': '11', '11': '11',
      'desember': '12', 'des': '12', '12': '12'
    };

    for (const key in map) {
      if (m.includes(key)) {
          return `${year}-${map[key]}`;
      }
    }
    return '';
  };

  const showNotif = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ==========================================
  // LOGIKA INPUT PO BARU
  // ==========================================
  const [inputMode, setInputMode] = useState('manual'); 
  const [manualForm, setManualForm] = useState({
    poNumber: '',
    locations: [{ 
        id: `L-${Date.now()}`, 
        name: '', 
        value: '', 
        totalQuota: '', 
        startMonth: '', 
        endMonth: '', 
        periodDesc: '', 
        billingType: 'partial', 
        jenisTagihan: '', 
        showDetails: false 
    }]
  });

  const handleAddLocationRow = () => {
    setManualForm(prev => ({
      ...prev,
      locations: [
          ...prev.locations, 
          { 
              id: `L-${Date.now()}`, 
              name: '', 
              value: '', 
              totalQuota: '', 
              startMonth: '', 
              endMonth: '', 
              periodDesc: '', 
              billingType: 'partial', 
              jenisTagihan: '', 
              showDetails: false 
          }
      ]
    }));
  };

  const handleRemoveLocationRow = (idToRemove) => {
    setManualForm(prev => ({
      ...prev,
      locations: prev.locations.filter(loc => loc.id !== idToRemove)
    }));
  };

  const handleLocationChange = (id, field, value) => {
    setManualForm(prev => ({
      ...prev,
      locations: prev.locations.map(loc => {
        if (loc.id === id) {
          let updatedLoc = { ...loc, [field]: value };
          if (field === 'billingType' && value === 'full') {
            updatedLoc.totalQuota = 1;
            updatedLoc.endMonth = '';
            updatedLoc.periodDesc = '';
            updatedLoc.showDetails = false;
          }
          return updatedLoc;
        }
        return loc;
      })
    }));
  };

  const handleSaveManualPO = async (e) => {
    e.preventDefault();
    
    if(!manualForm.poNumber) {
        return showNotif('No PO harus diisi!', 'error');
    }
    
    const validLocations = manualForm.locations.filter(l => l.name && l.value && (l.billingType === 'full' || l.totalQuota));
    
    if(validLocations.length === 0) {
        return showNotif('Minimal isi 1 lokasi dengan lengkap!', 'error');
    }

    const formattedLocations = validLocations.map(l => {
      const finalQuota = l.billingType === 'full' ? 1 : parseInt(l.totalQuota);
      let generatedPeriods = [];
      
      if (l.startMonth && finalQuota > 0) {
          generatedPeriods = generateMonthsArray(l.startMonth, finalQuota);
      }
      
      const cleanValue = parseFloat(String(l.value).replace(/[^0-9]/g, '')) || 0;

      return {
          ...l,
          value: cleanValue,
          jenisTagihan: l.jenisTagihan || '-',
          billingType: l.billingType,
          totalQuota: finalQuota,
          startMonth: l.startMonth || '',
          endMonth: l.endMonth || '',
          periodDesc: l.periodDesc || '',
          usedQuota: 0,
          generatedPeriods: generatedPeriods 
      };
    });

    const dbPayload = {
      po_number: manualForm.poNumber,
      locations: formattedLocations
    };

    const { data, error } = await supabase.from('pos').insert([dbPayload]).select();
    
    if (error) {
      if(error.code === '23505') {
          return showNotif('No PO sudah ada di database!', 'error');
      }
      return showNotif('Gagal menyimpan PO: ' + error.message, 'error');
    }

    setPos([{ 
        idDB: data[0].id, 
        poNumber: data[0].po_number, 
        locations: data[0].locations 
    }, ...pos]);
    
    setManualForm({ 
        poNumber: '', 
        locations: [{ 
            id: `L-${Date.now()}`, 
            name: '', 
            value: '', 
            totalQuota: '', 
            startMonth: '', 
            endMonth: '', 
            periodDesc: '', 
            billingType: 'partial', 
            jenisTagihan: '', 
            showDetails: false 
        }] 
    });
    
    showNotif('PO Baru Berhasil Disimpan ke Supabase!', 'success');
  };

  // State Excel Import PO
  const fileInputRef = useRef(null);
  const [excelPreview, setExcelPreview] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      try {
        const module = await import('https://esm.sh/xlsx');
        window.XLSX = module.default || module;
      } catch (err) {
        return showNotif('Gagal memuat modul pembaca Excel.', 'error');
      }
    }

    const XLSX = window.XLSX;
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
            return showNotif('File Excel Kosong', 'error');
        }

        const groupedPOs = {};
        
        data.forEach((row, index) => {
          const poNo = row['PO'] || row['No PO'] || row['NO PO'] || row['no po'];
          if (!poNo) return; 

          const locName = row['LOKASI'] || row['Lokasi'] || 'Tanpa Nama';
          const rawValue = row['ESTIMASI'] || row['Nilai PO perlokasi'] || row['Nilai PO'];
          
          // Menggunakan Smart Parser
          const locValue = parseExcelNumber(rawValue);

          const duration = row['MONTH'] || row['Month'] || row['jumlah bulan dalam bentuk angka'] || row['Jumlah Bulan'];
          const finalQuota = parseInt(duration) || 1;
          const billingType = finalQuota === 1 ? 'full' : 'partial';

          const startRaw = row['Start Month'] || row['start month'];
          const start = parseIndonesianMonth(startRaw, currentYear);

          const end = row['End Month'] || row['end month'] || '';
          const desc = row['Keterangan'] || row['Keterangan Periode'] || '';
          const jenis = row['PEKERJAAN'] || row['Jenis Tagihan'] || row['Jenis'] || 'Lainnya';

          let generatedPeriods = [];
          if (start && finalQuota > 0) {
              generatedPeriods = generateMonthsArray(start, finalQuota);
          }

          if (!groupedPOs[poNo]) {
            groupedPOs[poNo] = { poNumber: poNo, locations: [] };
          }
          
          groupedPOs[poNo].locations.push({
            id: `EX-${index}`,
            name: locName,
            value: locValue,
            jenisTagihan: jenis,
            totalQuota: finalQuota,
            billingType: billingType,
            usedQuota: 0,
            startMonth: start,
            endMonth: end,
            periodDesc: desc,
            generatedPeriods: generatedPeriods
          });
        });

        const previewArray = Object.values(groupedPOs);
        
        if (previewArray.length === 0) {
            return showNotif('Format kolom tidak dikenali oleh sistem.', 'error');
        }
        
        setExcelPreview(previewArray);
        showNotif('Excel berhasil dibaca, silakan periksa preview.', 'success');
      } catch (error) {
        showNotif('Gagal membaca file Excel.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveExcel = async () => {
    if(!excelPreview) return;
    
    const posToInsert = excelPreview.map(p => ({ 
      po_number: String(p.poNumber), 
      locations: p.locations 
    }));

    const { data, error } = await supabase.from('pos').insert(posToInsert).select();
    
    if (error) {
      if(error.code === '23505') {
          return showNotif('Ada PO yang sudah terdaftar di database.', 'error');
      }
      return showNotif('Gagal impor ke database: ' + error.message, 'error');
    }

    const mappedNewPos = data.map(p => ({ 
        idDB: p.id, 
        poNumber: p.po_number, 
        locations: p.locations 
    }));
    
    setPos([...mappedNewPos, ...pos]);
    
    setExcelPreview(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    showNotif(`${excelPreview.length} PO Berhasil Diimpor ke Supabase!`, 'success');
  };

  const handleDownloadTemplatePO = async () => {
    if (!window.XLSX) {
      try {
        const module = await import('https://esm.sh/xlsx');
        window.XLSX = module.default || module;
      } catch (err) {
        return showNotif('Gagal memuat modul pembuat Excel.', 'error');
      }
    }
    
    const templateData = [{
      'No PO': '4160123456',
      'Lokasi': 'LPG Amurang',
      'Nilai PO': 15000000,
      'Jumlah Bulan': 12,
      'Start Month': '2026-01',
      'End Month': '2026-12',
      'Keterangan': 'Contoh Keterangan Periode',
      'Jenis Tagihan': 'Sewa Alat'
    }];

    const ws = window.XLSX.utils.json_to_sheet(templateData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Template_Master_PO");
    window.XLSX.writeFile(wb, `Template_Input_PO_Elnusa.xlsx`);
  };

  // ==========================================
  // LOGIKA INPUT TAGIHAN BARU & EXCEL IMPORT
  // ==========================================
  const [inputBillMode, setInputBillMode] = useState('manual');
  const fileBillInputRef = useRef(null);
  const [excelBillPreview, setExcelBillPreview] = useState(null);

  const [billForm, setBillForm] = useState({
    region: '',
    poNumber: '',
    locationId: '',
    selectedPeriod: '', 
    title: '',
    noBast: '', 
    amount: '',
    date: ''
  });

  const activePoForBill = pos.find(p => String(p.poNumber) === String(billForm.poNumber));
  const activeLocForBill = activePoForBill?.locations.find(l => String(l.id) === String(billForm.locationId));

  const getLocationStats = (loc, poNum) => {
    const locationBills = bills.filter(b => {
       return b.poNumber === poNum && b.locationName.includes(loc.name);
    });
    const totalBilled = locationBills.reduce((sum, b) => sum + b.amount, 0);
    const remainingValue = loc.value - totalBilled;
    const estimatedMonthly = loc.totalQuota > 0 ? loc.value / loc.totalQuota : 0;
    const remainingQuota = loc.totalQuota - loc.usedQuota;
    
    const isShortageWarning = remainingQuota === 1 && remainingValue < estimatedMonthly;
    return { 
        totalBilled, 
        remainingValue, 
        estimatedMonthly, 
        remainingQuota, 
        isShortageWarning 
    };
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();
    
    if (!billForm.region) {
      return showNotif('Silakan pilih Region!', 'error');
    }
    
    if (!billForm.title || !billForm.noBast || !billForm.amount || !billForm.date || !billForm.poNumber || !billForm.locationId) {
      return showNotif('Lengkapi data tagihan (Judul, No. BAST, Nilai, Tanggal, PO, Lokasi)!', 'error');
    }
    
    const cleanAmount = parseFloat(String(billForm.amount).replace(/[^0-9]/g, '')) || 0;
    if (!cleanAmount) {
        return showNotif('Nominal tagihan tidak valid!', 'error');
    }

    if (!activeLocForBill) {
        return showNotif('Lokasi tidak valid', 'error');
    }
    
    if (activeLocForBill.usedQuota >= activeLocForBill.totalQuota) {
        return showNotif('Gagal: Kuota Master PO untuk lokasi ini sudah penuh!', 'error');
    }
    
    if (activeLocForBill.generatedPeriods?.length > 0 && !billForm.selectedPeriod) {
        return showNotif('Pilih Periode Tagihan yang sesuai!', 'error');
    }

    const updatedLocsForState = activePoForBill.locations.map(l => {
      if (String(l.id) === String(billForm.locationId)) {
        return { ...l, usedQuota: l.usedQuota + 1 };
      }
      return l;
    });

    const { error: updatePoErr } = await supabase
      .from('pos')
      .update({ locations: updatedLocsForState })
      .eq('po_number', billForm.poNumber);

    if (updatePoErr) {
        return showNotif('Gagal memotong kuota PO: ' + updatePoErr.message, 'error');
    }
    
    const iteration = activeLocForBill.usedQuota + 1; 

    // Menyisipkan Region ke dalam string location_name
    const finalLocationName = `${billForm.region} | ${activeLocForBill.name}`;

    const dbBillPayload = {
      title: billForm.title,
      no_bast: billForm.noBast,
      amount: cleanAmount,
      date: billForm.date,
      year: parseInt(billForm.date.substring(0, 4)),
      has_po: true,
      po_number: billForm.poNumber,
      location_id: billForm.locationId,
      period: billForm.selectedPeriod,
      iteration: iteration,
      location_name: finalLocationName
    };

    const { data: insertedBill, error: insertErr } = await supabase.from('bills').insert([dbBillPayload]).select();
    
    if (insertErr) {
        return showNotif('Gagal menyimpan tagihan: ' + insertErr.message, 'error');
    }

    setPos(pos.map(p => String(p.poNumber) === String(billForm.poNumber) ? { ...p, locations: updatedLocsForState } : p));

    const newLocalBill = {
      id: insertedBill[0].id,
      title: insertedBill[0].title,
      noBast: insertedBill[0].no_bast,
      amount: insertedBill[0].amount,
      date: insertedBill[0].date,
      year: insertedBill[0].year,
      hasPo: insertedBill[0].has_po,
      poNumber: insertedBill[0].po_number,
      locationId: insertedBill[0].location_id,
      period: insertedBill[0].period,
      iteration: insertedBill[0].iteration,
      locationName: insertedBill[0].location_name
    };

    setBills([newLocalBill, ...bills].sort((a, b) => new Date(b.date) - new Date(a.date))); 
    showNotif('Tagihan Disimpan & Kuota Dipotong!', 'success');
    
    setBillForm({
      region: '',
      poNumber: '', 
      locationId: '', 
      selectedPeriod: '', 
      title: '', 
      noBast: '', 
      amount: '', 
      date: ''
    });
  };

  // Fungsi Import Excel Tagihan
  const handleFileBillUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      try {
        const module = await import('https://esm.sh/xlsx');
        window.XLSX = module.default || module;
      } catch (err) {
        return showNotif('Gagal memuat modul pembaca Excel.', 'error');
      }
    }

    const XLSX = window.XLSX;
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
            return showNotif('File Excel Kosong', 'error');
        }

        const simulatedPOs = JSON.parse(JSON.stringify(pos));
        
        const previewArray = data.map((row, index) => {
            const region = row['Region'] || '';
            const poNumber = String(row['Master PO'] || '').trim();
            const locationName = String(row['Lokasi / Peruntukan'] || '').trim();
            const period = String(row['Periode Tagihan'] || '').trim();
            const title = row['Judul Tagihan'] || '';
            const noBast = row['No BAST'] || '-';
            
            const rawAmount = row['Nominal Tagihan'];
            // Menggunakan Smart Parser untuk tagihan
            const amount = parseExcelNumber(rawAmount);
            
            let date = row['Tanggal Invoice'];
            if (typeof date === 'number') {
                date = new Date(Math.round((date - 25569) * 86400 * 1000)).toISOString().split('T')[0];
            } else if (date) {
               date = String(date); 
            } else {
               date = '';
            }

            let isValid = true;
            let errorMsg = [];
            let locationId = null;

            if (!region) { isValid = false; errorMsg.push('Region kosong'); }
            if (!poNumber) { isValid = false; errorMsg.push('PO kosong'); }
            if (!locationName) { isValid = false; errorMsg.push('Lokasi kosong'); }
            if (!title) { isValid = false; errorMsg.push('Judul kosong'); }
            if (!amount) { isValid = false; errorMsg.push('Nominal invalid'); }
            if (!date) { isValid = false; errorMsg.push('Tanggal kosong'); }

            if (poNumber && locationName) {
                const po = simulatedPOs.find(p => p.poNumber === poNumber);
                if (!po) {
                    isValid = false; errorMsg.push('Master PO tidak ditemukan');
                } else {
                    const loc = po.locations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
                    if (!loc) {
                        isValid = false; errorMsg.push('Lokasi tidak ada di PO ini');
                    } else {
                        locationId = loc.id;
                        if (loc.usedQuota >= loc.totalQuota) {
                            isValid = false; errorMsg.push('Kuota PO habis');
                        } else {
                            loc.usedQuota += 1; 
                        }
                    }
                }
            }

            return {
                id: `EXB-${index}`,
                region,
                hasPo: true,
                poNumber,
                locationName,
                locationId,
                period,
                title,
                noBast,
                amount,
                date,
                isValid,
                errorMsg: errorMsg.join(', ')
            };
        });

        setExcelBillPreview(previewArray);
        showNotif('Excel berhasil dibaca, silakan periksa preview di bawah.', 'success');
      } catch (error) {
        showNotif('Gagal membaca file Excel.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveExcelBill = async () => {
    if (!excelBillPreview) return;
    
    const validBills = excelBillPreview.filter(b => b.isValid);
    if (validBills.length === 0) {
      return showNotif('Tidak ada data yang valid untuk disimpan.', 'error');
    }

    const poUpdates = {};
    const finalBillsToInsert = [];
    const clonedPos = JSON.parse(JSON.stringify(pos));

    for (const b of validBills) {
        let iteration = null;
        let finalLocationName = b.region;

        const poIndex = clonedPos.findIndex(p => p.poNumber === b.poNumber);
        if (poIndex > -1) {
            const locIndex = clonedPos[poIndex].locations.findIndex(l => l.id === b.locationId);
            if (locIndex > -1) {
                clonedPos[poIndex].locations[locIndex].usedQuota += 1;
                iteration = clonedPos[poIndex].locations[locIndex].usedQuota;
                finalLocationName = `${b.region} | ${clonedPos[poIndex].locations[locIndex].name}`;
                poUpdates[b.poNumber] = clonedPos[poIndex].locations;
            }
        }

        finalBillsToInsert.push({
            title: b.title,
            no_bast: b.noBast,
            amount: b.amount,
            date: b.date,
            year: parseInt(b.date.substring(0, 4)),
            has_po: true,
            po_number: b.poNumber,
            location_id: b.locationId,
            period: b.period,
            iteration: iteration,
            location_name: finalLocationName
        });
    }

    // Update PO Quotas in DB
    for (const [poNum, newLocs] of Object.entries(poUpdates)) {
         const { error } = await supabase.from('pos').update({ locations: newLocs }).eq('po_number', poNum);
         if (error) console.error("Update PO Error:", error);
    }

    // Insert Bills
    const { data: insertedBills, error: insertErr } = await supabase.from('bills').insert(finalBillsToInsert).select();

    if (insertErr) {
        return showNotif('Gagal mengimpor tagihan: ' + insertErr.message, 'error');
    }

    setPos(clonedPos);
    
    const mappedNewBills = insertedBills.map(b => ({
        id: b.id,
        title: b.title,
        noBast: b.no_bast,
        amount: b.amount,
        date: b.date,
        year: b.year,
        hasPo: b.has_po,
        poNumber: b.po_number,
        locationId: b.location_id,
        period: b.period,
        iteration: b.iteration,
        locationName: b.location_name
    }));
    
    setBills([...mappedNewBills, ...bills].sort((a, b) => new Date(b.date) - new Date(a.date)));
    setExcelBillPreview(null);
    if(fileBillInputRef.current) fileBillInputRef.current.value = '';
    showNotif(`${finalBillsToInsert.length} Tagihan Berhasil Diimpor!`, 'success');
  };

  const handleDownloadTemplateBill = async () => {
    if (!window.XLSX) {
      try {
        const module = await import('https://esm.sh/xlsx');
        window.XLSX = module.default || module;
      } catch (err) {
        return showNotif('Gagal memuat modul pembuat Excel.', 'error');
      }
    }
    
    const templateData = [
      {
        'Region': 'Sulawesi',
        'Master PO': '4160123456',
        'Lokasi / Peruntukan': 'LPG Amurang',
        'Periode Tagihan': 'Januari 2026',
        'Judul Tagihan': 'Sewa Bulanan Mesin',
        'No BAST': 'BAST/001/2026',
        'Nominal Tagihan': 1500000,
        'Tanggal Invoice': '2026-01-15'
      }
    ];

    const ws = window.XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [ {wch:15}, {wch:20}, {wch:25}, {wch:20}, {wch:35}, {wch:20}, {wch:20}, {wch:20} ];
    
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Template_Import_Tagihan");
    window.XLSX.writeFile(wb, `Template_Input_Tagihan_Elnusa.xlsx`);
  };

  const handleDeleteBill = async (id) => {
    const billToDelete = bills.find(b => b.id === id);
    if (!billToDelete) return;

    if (billToDelete.poNumber && billToDelete.locationId) {
       const poToUpdate = pos.find(p => String(p.poNumber) === String(billToDelete.poNumber));
       
       if(poToUpdate) {
         const updatedLocs = poToUpdate.locations.map(l => {
           if (String(l.id) === String(billToDelete.locationId) && l.usedQuota > 0) {
             return { ...l, usedQuota: l.usedQuota - 1 };
           }
           return l;
         });
         
         const { error: poErr } = await supabase
            .from('pos')
            .update({ locations: updatedLocs })
            .eq('po_number', billToDelete.poNumber);
            
         if(poErr) {
             return showNotif('Gagal mengembalikan kuota PO.', 'error');
         }
         
         setPos(pos.map(p => String(p.poNumber) === String(billToDelete.poNumber) ? { ...p, locations: updatedLocs } : p));
       }
    }

    const { error: delErr } = await supabase.from('bills').delete().eq('id', id);
    
    if(delErr) {
        return showNotif('Gagal menghapus tagihan: ' + delErr.message, 'error');
    }

    setBills(bills.filter(b => b.id !== id));
    showNotif('Tagihan Dihapus & Kuota Dikembalikan!', 'success');
  };

  // ==========================================
  // FITUR EDIT TAGIHAN
  // ==========================================
  const [editingBill, setEditingBill] = useState(null);

  const handleEditClick = (bill) => {
    let extractedRegion = '';
    let rawLoc = bill.locationName || '';
    if(rawLoc.includes(' | ')) {
        extractedRegion = rawLoc.split(' | ')[0];
    } else {
        const regions = ['Sumbagut', 'Sumbagsel', 'Jabalinus', 'Kalimantan', 'Sulawesi', 'Malupa'];
        if(regions.includes(rawLoc)) extractedRegion = rawLoc;
    }

    setEditingBill({ 
        ...bill,
        region: extractedRegion,
        amount: formatInputNumber(bill.amount)
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    
    if (!editingBill.title || !editingBill.noBast || !editingBill.amount || !editingBill.date || !editingBill.region) {
      return showNotif('Lengkapi data wajib!', 'error');
    }
    
    const cleanAmount = parseFloat(String(editingBill.amount).replace(/[^0-9]/g, '')) || 0;
    if (!cleanAmount) {
        return showNotif('Nominal tagihan tidak valid!', 'error');
    }

    let newLocationName = editingBill.locationName || '';
    const parts = newLocationName.split(' | ');
    const locPart = parts.length > 1 ? parts[1] : newLocationName;
    newLocationName = `${editingBill.region} | ${locPart}`;

    const updatePayload = {
      title: editingBill.title,
      no_bast: editingBill.noBast,
      amount: cleanAmount,
      date: editingBill.date,
      location_name: newLocationName,
      year: parseInt(editingBill.date.substring(0, 4))
    };

    const { error } = await supabase.from('bills').update(updatePayload).eq('id', editingBill.id);
    
    if(error) {
        return showNotif('Gagal menyimpan perubahan: ' + error.message, 'error');
    }

    setBills(bills.map(b => b.id === editingBill.id ? { ...b, ...updatePayload, noBast: updatePayload.no_bast, locationName: updatePayload.location_name } : b).sort((a, b) => new Date(b.date) - new Date(a.date)));
    setEditingBill(null);
    showNotif('Perubahan Berhasil Disimpan ke Supabase!', 'success');
  };

  // ==========================================
  // FILTER & SEARCH & PAGINATION (DATA TAGIHAN)
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk Pagination Master PO
  const [currentPagePO, setCurrentPagePO] = useState(1);
  const [itemsPerPagePO, setItemsPerPagePO] = useState(10);

  // Reset ke halaman 1 setiap kali ada pencarian atau filter yang diubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterDate, itemsPerPage]);

  useEffect(() => {
    setCurrentPagePO(1);
  }, [searchPOQuery, itemsPerPagePO]);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const matchSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.poNumber && b.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (b.noBast && b.noBast.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let matchStatus = true;
      if (filterStatus === 'berjalan') {
        matchStatus = b.year >= currentYear;
      } else if (filterStatus === 'backdate') {
        matchStatus = b.year < currentYear;
      }

      let matchDate = true;
      if (filterDate) {
        matchDate = b.date === filterDate;
      }
      
      return matchSearch && matchStatus && matchDate;
    });
  }, [bills, searchTerm, filterStatus, filterDate, currentYear]);

  // Hitung data pagination
  const indexOfLastBill = currentPage * itemsPerPage;
  const indexOfFirstBill = indexOfLastBill - itemsPerPage;
  const currentBills = filteredBills.slice(indexOfFirstBill, indexOfLastBill);
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
        let startPage = Math.max(currentPage - 2, 1);
        let endPage = startPage + maxVisiblePages - 1;
        
        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = endPage - maxVisiblePages + 1;
        }
        
        for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    }
    return pageNumbers;
  };

  // Pagination Master PO
  const indexOfLastPO = currentPagePO * itemsPerPagePO;
  const indexOfFirstPO = indexOfLastPO - itemsPerPagePO;
  const currentPOs = filteredPOs.slice(indexOfFirstPO, indexOfLastPO);
  const totalPagesPO = Math.ceil(filteredPOs.length / itemsPerPagePO);

  const getPageNumbersPO = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPagesPO <= maxVisiblePages) {
        for (let i = 1; i <= totalPagesPO; i++) pageNumbers.push(i);
    } else {
        let startPage = Math.max(currentPagePO - 2, 1);
        let endPage = startPage + maxVisiblePages - 1;
        
        if (endPage > totalPagesPO) {
            endPage = totalPagesPO;
            startPage = endPage - maxVisiblePages + 1;
        }
        
        for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
    }
    return pageNumbers;
  };

  // EXPORT TO EXCEL
  const handleExportExcel = async () => {
    if (!window.XLSX) {
      try {
        const module = await import('https://esm.sh/xlsx');
        window.XLSX = module.default || module;
      } catch (err) {
        return showNotif('Gagal memuat modul pembuat Excel.', 'error');
      }
    }
    
    const dataToExport = filteredBills.map(b => ({
      'Tanggal Invoice': b.date,
      'Uraian Tagihan': b.title,
      'No. BAST': b.noBast,
      'Nominal (Rp)': b.amount,
      'Status Dokumen': 'Ada PO',
      'No. Referensi PO': b.poNumber || '-',
      'Lokasi / Peruntukan': b.locationName || '-',
      'Periode Tagih': b.period || '-'
    }));

    const ws = window.XLSX.utils.json_to_sheet(dataToExport);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Rekap_Tagihan");
    window.XLSX.writeFile(wb, `Data_Tagihan_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ==========================================
  // DATA PREPARATION FOR DASHBOARD & NOTIFIKASI
  // ==========================================
  const berjalanBills = bills.filter(b => b.year >= currentYear);
  const backdateBills = bills.filter(b => b.year < currentYear);

  const totalBerjalan = berjalanBills.reduce((sum, b) => sum + b.amount, 0);
  const totalBackdate = backdateBills.reduce((sum, b) => sum + b.amount, 0);

  const totalNilaiPO = pos.reduce((sum, p) => sum + p.locations.reduce((locSum, loc) => locSum + (parseFloat(loc.value) || 0), 0), 0);
  const totalDitagihkan = bills.reduce((sum, b) => sum + b.amount, 0);
  const sisaNilaiPO = totalNilaiPO - totalDitagihkan;
  const persentaseSerapan = totalNilaiPO > 0 ? (totalDitagihkan / totalNilaiPO) * 100 : 0;

  const poKritis = [];
  pos.forEach(p => {
    p.locations.forEach(loc => {
      // Perhitungan khusus untuk mengakomodasi region trik
      const locationBills = bills.filter(b => b.poNumber === p.poNumber && (b.locationName || '').includes(loc.name));
      const totalBilled = locationBills.reduce((sum, b) => sum + b.amount, 0);
      const remainingValue = loc.value - totalBilled;
      const estimatedMonthly = loc.totalQuota > 0 ? loc.value / loc.totalQuota : 0;
      const remainingQuota = loc.totalQuota - loc.usedQuota;
      
      const isShortageWarning = remainingQuota === 1 && remainingValue < estimatedMonthly;
      
      // HANYA masukkan jika isShortageWarning bernilai true (Nilai PO Kurang)
      if (isShortageWarning) {
        poKritis.push({ poIdDB: p.idDB, poNumber: p.poNumber, location: loc, stats: { remainingValue, totalBilled, isShortageWarning } });
      }
    });
  });

  // Mengurutkan agar peringatan "Potensi PO Additional!" selalu berada di paling atas
  poKritis.sort((a, b) => (b.stats.isShortageWarning ? 1 : 0) - (a.stats.isShortageWarning ? 1 : 0));

  // Notifikasi yang belum dibaca
  const unreadPoKritis = poKritis.filter(pk => !readNotifs.includes(`${pk.poNumber}-${pk.location.id}`));

  const tagihanTerakhir = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  // Aksi ketika notifikasi di-klik (menandai read & direct)
  const handleNotifClick = (pk) => {
    const notifId = `${pk.poNumber}-${pk.location.id}`;
    if (!readNotifs.includes(notifId)) {
      setReadNotifs([...readNotifs, notifId]);
    }
    
    setSearchPOQuery(pk.poNumber);
    setExpandedPOs(prev => ({ ...prev, [pk.poIdDB]: true }));
    setActiveTab('tab-master-po');
    setSidebarMenu(prev => ({ ...prev, po: true }));
    setIsNotifOpen(false);
  };

  // ==========================================
  // GET PAGE TITLE UNTUK HEADER KONTEKSTUAL
  // ==========================================
  const getBreadcrumbs = () => {
    const renderHome = () => (
      <span 
        onClick={() => setActiveTab('tab-home')} 
        className="cursor-pointer hover:text-[#12649b] text-slate-500 transition-colors flex items-center"
      >
        <Home size={14} className="inline mr-1.5 -mt-0.5" /> Beranda
      </span>
    );
    const separator = <span className="mx-2 text-slate-300">{'>'}</span>;

    switch(activeTab) {
      case 'tab-home': 
        return <div className="flex items-center">{renderHome()} {separator} <span className="text-[#12649b] font-semibold">Dashboard</span></div>;
      case 'tab-master-po': 
        return <div className="flex items-center">{renderHome()} {separator} <span onClick={() => {setActiveTab('tab-master-po'); setSidebarMenu(p => ({...p, po: true}))}} className="cursor-pointer hover:text-[#12649b] text-slate-500 transition-colors">PO</span> {separator} <span className="text-[#12649b] font-semibold">Data PO</span></div>;
      case 'tab-data-tagihan': 
        return <div className="flex items-center">{renderHome()} {separator} <span onClick={() => {setActiveTab('tab-data-tagihan'); setSidebarMenu(p => ({...p, tagihan: true}))}} className="cursor-pointer hover:text-[#12649b] text-slate-500 transition-colors">Tagihan</span> {separator} <span className="text-[#12649b] font-semibold">Data Tagihan</span></div>;
      case 'tab-input-tagihan': 
        return <div className="flex items-center">{renderHome()} {separator} <span onClick={() => {setActiveTab('tab-data-tagihan'); setSidebarMenu(p => ({...p, tagihan: true}))}} className="cursor-pointer hover:text-[#12649b] text-slate-500 transition-colors">Tagihan</span> {separator} <span className="text-[#12649b] font-semibold">Tagihan Baru</span></div>;
      case 'tab-input-po': 
        return <div className="flex items-center">{renderHome()} {separator} <span onClick={() => {setActiveTab('tab-master-po'); setSidebarMenu(p => ({...p, po: true}))}} className="cursor-pointer hover:text-[#12649b] text-slate-500 transition-colors">PO</span> {separator} <span className="text-[#12649b] font-semibold">PO Baru</span></div>;
      default: 
        return <div className="flex items-center">{renderHome()}</div>;
    }
  };

  const getPageTitleString = () => {
    switch(activeTab) {
      case 'tab-home': return 'Dashboard Monitoring';
      case 'tab-master-po': return ''; // Disembunyikan karena judul ada di dalam border box
      case 'tab-data-tagihan': return ''; // Disembunyikan karena judul ada di dalam border box
      case 'tab-input-tagihan': return ''; // Disembunyikan karena judul ada di dalam border box
      case 'tab-input-po': return ''; // Disembunyikan karena judul dipindah ke form border box
      default: return 'Aplikasi Monitoring';
    }
  };

  // Loading Screen Database
  if (isLoadingDB) {
    return (
      <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center text-slate-800" style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <Monitor size={48} className="text-[#12649b] animate-pulse mb-6" />
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#12649b] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-semibold text-slate-600 tracking-wide uppercase text-[13px]">Memuat Sistem Monitoring...</p>
          </div>
          <p className="text-xs text-slate-400">Menyiapkan dashboard dan basis data Anda</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER UI UTAMA
  // ==========================================
  return (
    <div className="bg-slate-50 text-slate-800 flex flex-col h-screen w-full overflow-hidden" style={{ fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* GLOBAL NOTIFICATION */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-in slide-in-from-top-4 ${notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* MODAL EDIT TAGIHAN */}
      {editingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Edit size={18}/> Edit Tagihan</h3>
              <button onClick={() => setEditingBill(null)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
               {/* Read Only Data (PO & Lokasi) */}
               <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-4 text-[13px] mb-4">
                 <div className="flex-1">
                   <span className="block text-[12px] text-slate-500 font-bold mb-0.5">Referensi PO (Terkunci)</span>
                   <span className="font-semibold text-slate-700">{editingBill.poNumber}</span>
                 </div>
                 <div className="flex-1">
                     <span className="block text-[12px] text-slate-500 font-bold mb-0.5">Lokasi Asal (Terkunci)</span>
                     <span className="font-semibold text-slate-700">{editingBill.locationName} {editingBill.period && `(${editingBill.period})`}</span>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[13px] font-bold text-slate-800 mb-1.5">Region <span className="text-red-500">*</span></label>
                    <select 
                      required
                      value={editingBill.region}
                      onChange={e => setEditingBill({...editingBill, region: e.target.value})}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] text-[13px] bg-white"
                    >
                      <option value="" disabled>Pilih Region</option>
                      <option value="Sumbagut">Sumbagut</option>
                      <option value="Sumbagsel">Sumbagsel</option>
                      <option value="Jabalinus">Jabalinus</option>
                      <option value="Kalimantan">Kalimantan</option>
                      <option value="Sulawesi">Sulawesi</option>
                      <option value="Malupa">Malupa</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[13px] font-bold text-slate-800 mb-1.5">Judul Tagihan</label>
                    <input 
                        type="text" 
                        required 
                        value={editingBill.title} 
                        onChange={e => setEditingBill({...editingBill, title: e.target.value})} 
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] text-[13px]" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[13px] font-bold text-slate-800 mb-1.5">No. BAST <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        required
                        placeholder="BAST-..."
                        value={editingBill.noBast === '-' ? '' : editingBill.noBast} 
                        onChange={e => setEditingBill({...editingBill, noBast: e.target.value})} 
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] text-[13px]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-slate-800 mb-1.5">Nominal Tagihan (Rp)</label>
                    <input 
                        type="text" 
                        required 
                        value={editingBill.amount} 
                        onChange={e => setEditingBill({...editingBill, amount: formatInputNumber(e.target.value)})} 
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] text-[14px] font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-slate-800 mb-1.5">Tanggal Approval</label>
                    <input 
                        type="date" 
                        required 
                        value={editingBill.date} 
                        onChange={e => setEditingBill({...editingBill, date: e.target.value})} 
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] text-[13px]" 
                    />
                  </div>
               </div>
               <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                 <button type="button" onClick={() => setEditingBill(null)} className="px-5 py-2 text-[13px] text-slate-500 font-semibold hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                 <button type="submit" className="px-6 py-2 text-[13px] bg-[#12649b] hover:bg-blue-800 text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2"><Save size={16}/> Simpan Perubahan</button>
               </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR KIRI (LIGHT THEME) */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20">
          <div className="flex flex-col px-6 py-4 mb-4 mt-2">
            <img 
              src="/logo-elnusa.png" 
              alt="Logo ELnusa" 
              className="h-10 w-auto object-contain object-left"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/150x40/ffffff/0f172a?text=MONITOR+TAGIHAN";
              }}
            />
          </div>
          
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide pb-6">
            
            {/* Dashboard Standalone */}
            <div>
              <button 
                onClick={() => setActiveTab('tab-home')} 
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full transition-all duration-200 
                  ${activeTab === 'tab-home' 
                    ? 'bg-blue-50 text-[#12649b] font-bold' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#12649b] font-medium'}`}
              >
                <Home size={18} /> <span className="text-[13px] font-semibold">Dashboard</span>
              </button>
            </div>

            {/* Accordion: PO */}
            <div className="pt-1">
              <button 
                onClick={() => toggleSidebarMenu('po')} 
                className="flex items-center justify-between px-4 py-2.5 rounded-xl w-full text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                   <Database size={18} className="text-slate-500" /> <span className="text-[13px]">Data PO</span>
                </div>
                {sidebarMenu.po ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </button>
              
              {sidebarMenu.po && (
                <div className="mt-1 space-y-1 pl-4">
                  <SidebarSubButton id="tab-master-po" label="Daftar PO" activeTab={activeTab} onClick={setActiveTab} />
                  <SidebarSubButton id="tab-input-po" label="Input PO Baru" activeTab={activeTab} onClick={setActiveTab} />
                </div>
              )}
            </div>

            {/* Accordion: Tagihan */}
            <div className="pt-1">
              <button 
                onClick={() => toggleSidebarMenu('tagihan')} 
                className="flex items-center justify-between px-4 py-2.5 rounded-xl w-full text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                   <FileText size={18} className="text-slate-500" /> <span className="text-[13px]">Data Tagihan</span>
                </div>
                {sidebarMenu.tagihan ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </button>
              
              {sidebarMenu.tagihan && (
                <div className="mt-1 space-y-1 pl-4">
                  <SidebarSubButton id="tab-data-tagihan" label="Daftar Tagihan" activeTab={activeTab} onClick={setActiveTab} />
                  <SidebarSubButton id="tab-input-tagihan" label="Input Tagihan Baru" activeTab={activeTab} onClick={setActiveTab} />
                </div>
              )}
            </div>

          </nav>
        </aside>

        {/* KONTEN UTAMA KANAN */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
          
          {/* HEADER TOPBAR KONTEKSTUAL */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
            <div className="text-[13px] text-slate-500 font-medium flex items-center">
              {getBreadcrumbs()}
            </div>
            
            <div className="flex items-center gap-5 relative">
              {/* Notifikasi Lonceng */}
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="text-slate-400 hover:text-[#12649b] transition-colors relative cursor-pointer p-2 rounded-full hover:bg-slate-50"
                >
                   <Bell size={20} />
                   {unreadPoKritis.length > 0 && (
                     <span className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 bg-[#f43f5e] rounded-full border-2 border-white"></span>
                   )}
                </button>
                
                {/* Dropdown Notifikasi */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="font-bold text-[13px] text-slate-700">Notifikasi ({unreadPoKritis.length})</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto main-scroll">
                      {unreadPoKritis.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {unreadPoKritis.map((pk, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => handleNotifClick(pk)}
                              className="p-4 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-start gap-3"
                            >
                              <div className="mt-0.5 bg-rose-100 p-1.5 rounded-full text-rose-500">
                                <AlertTriangle size={14} />
                              </div>
                              <div>
                                <p className="text-[13px] font-bold text-slate-800">{pk.poNumber}</p>
                                <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
                                  Lokasi <span className="font-semibold text-slate-700">{pk.location.name}</span> butuh atensi. Potensi nilai PO kurang!
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-400">
                          <CheckCircle size={24} className="mx-auto mb-2 opacity-50 text-emerald-500" />
                          <p className="text-[12px] font-medium">Tidak ada notifikasi baru.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Ikon Profil */}
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="text-right hidden md:block">
                  <p className="text-[14px] font-bold text-[#12649b] group-hover:text-blue-700 transition-colors tracking-tight">RTC Support</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Elnusa Petrofin</p>
                </div>
                <div className="h-10 w-10 bg-white border-2 border-slate-100 text-slate-400 rounded-full flex items-center justify-center shadow-sm group-hover:shadow transition-all group-hover:text-[#12649b] group-hover:border-blue-100">
                  <User size={20} />
                </div>
              </div>
            </div>
          </header>

          {/* AREA SCROLL KONTEN */}
          <div className="flex-1 overflow-y-auto main-scroll px-8 pb-8 pt-6">
            <div className="max-w-6xl mx-auto">
              
              {/* Main Content Title */}
              {getPageTitleString() && (
                 <h2 className="text-[22px] font-bold text-slate-800 mb-6">{getPageTitleString()}</h2>
              )}

              {/* TAB: DASHBOARD HOME */}
              {activeTab === 'tab-home' && (
                <div className="animate-tab space-y-6">
                  
                  {/* Baris Atas: 3 KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group" 
                         onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('berjalan'); setCurrentPage(1); }}>
                      <div className="flex justify-between items-start mb-2 lg:mb-4">
                         <h3 className="text-slate-500 font-bold text-[11px] tracking-wider uppercase">Tagihan Berjalan</h3>
                         <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-110 transition-transform"><CalendarClock size={16}/></div>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 truncate tracking-tight" title={formatRupiah(totalBerjalan)}>{formatRupiah(totalBerjalan)}</div>
                      <div className="text-[12px] text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-blue-600 font-bold">{berjalanBills.length}</span> Dokumen</div>
                    </div>
                    
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group" 
                         onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('backdate'); setCurrentPage(1); }}>
                      <div className="flex justify-between items-start mb-2 lg:mb-4">
                         <h3 className="text-slate-500 font-bold text-[11px] tracking-wider uppercase">Tunggakan Backdate</h3>
                         <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:scale-110 transition-transform"><History size={16}/></div>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 truncate tracking-tight" title={formatRupiah(totalBackdate)}>{formatRupiah(totalBackdate)}</div>
                      <div className="text-[12px] text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-amber-600 font-bold">{backdateBills.length}</span> Dokumen</div>
                    </div>

                    <div className="bg-white border border-slate-200 p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group" 
                         onClick={() => { setActiveTab('tab-master-po'); }}>
                      <div className="flex justify-between items-start mb-2 lg:mb-4">
                         <h3 className="text-slate-500 font-bold text-[11px] tracking-wider uppercase">Total Kontrak PO</h3>
                         <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform"><Database size={16}/></div>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 truncate tracking-tight" title={formatRupiah(totalNilaiPO)}>{formatRupiah(totalNilaiPO)}</div>
                      <div className="text-[12px] text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-emerald-600 font-bold">{pos.length}</span> Master Aktif</div>
                    </div>
                  </div>

                  {/* Baris Tengah: Grafik Serapan */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-[16px]">Serapan Anggaran PO (Rupiah)</h3>
                        <p className="text-[13px] text-slate-500 mt-1">Persentase nominal PO yang sudah ditagihkan ke sistem.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-bold text-slate-800 leading-none">{persentaseSerapan.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
                       <div className={`h-full transition-all duration-1000 ${persentaseSerapan > 90 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(persentaseSerapan, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[12px] font-semibold">
                       <span className="text-blue-600 truncate mr-2" title={`Terpakai: ${formatRupiah(totalDitagihkan)}`}>Terpakai: {formatRupiah(totalDitagihkan)}</span>
                       <span className="text-emerald-600 truncate text-right" title={`Sisa Anggaran: ${formatRupiah(sisaNilaiPO)}`}>Sisa: {formatRupiah(sisaNilaiPO)}</span>
                    </div>
                  </div>

                  {/* Baris Bawah: Panel Atensi & Aktivitas */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Kolom Kiri: PO Kritis */}
                     <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                        <h3 className="font-bold text-slate-800 text-[16px] mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                           <AlertTriangle size={18} className="text-amber-500" /> Butuh Atensi (PO Kritis)
                        </h3>
                        <div className="space-y-3 flex-1">
                           {poKritis.length > 0 ? poKritis.slice(0, 4).map((pk, idx) => (
                              <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-center cursor-pointer hover:border-amber-200 hover:shadow-sm transition-all" onClick={() => handleNotifClick(pk)}>
                                 <div className="overflow-hidden pr-2">
                                    <div className="font-bold text-slate-800 text-[13px] mb-1 truncate">{pk.poNumber}</div>
                                    <div className="text-[12px] text-slate-500 truncate">{pk.location.name}</div>
                                    {pk.stats.isShortageWarning && (
                                        <div className="inline-flex items-center gap-1 text-[10px] text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold mt-2">
                                            <AlertTriangle size={10} /> Potensi PO Additional!
                                        </div>
                                    )}
                                 </div>
                                 <div className="text-right whitespace-nowrap">
                                    <div className="text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                                      Sisa {pk.location.totalQuota - pk.location.usedQuota}x Tagih
                                    </div>
                                 </div>
                              </div>
                           )) : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                                 <CheckCircle size={32} className="mb-3 opacity-50" />
                                 <span className="text-[13px] font-medium">Semua kuota PO masih aman.</span>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Kolom Kanan: Tagihan Terbaru */}
                     <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                        <h3 className="font-bold text-slate-800 text-[16px] mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                           <History size={18} className="text-[#12649b]" /> Histori Tagihan Masuk
                        </h3>
                        <div className="space-y-3 flex-1 overflow-y-auto pr-2 main-scroll max-h-[300px]">
                           {tagihanTerakhir.length > 0 ? tagihanTerakhir.map(b => (
                              <div key={b.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group" 
                                   onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('all'); setSearchTerm(b.title); setCurrentPage(1); }}>
                                 <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-[13px] text-[#12649b] truncate pr-4 group-hover:text-blue-800 transition-colors" title={b.title}>{b.title}</div>
                                    <div className="font-bold text-[13px] text-slate-800 whitespace-nowrap">{formatRupiah(b.amount)}</div>
                                 </div>
                                 <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5"><CalendarClock size={12} className="text-slate-400" /> {new Date(b.date).toLocaleDateString('id-ID')}</span>
                                    <span className="text-[9px] font-bold px-2 py-1 rounded-md tracking-wider uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                                       {b.poNumber}
                                    </span>
                                 </div>
                              </div>
                           )) : (
                              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8">
                                 <span className="text-[13px] font-medium">Belum ada tagihan diinput.</span>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* TAB: MASTER PO VIEW */}
              {activeTab === 'tab-master-po' && (
                <div className="animate-tab flex flex-col h-full">
                  <div className="flex flex-col sm:flex-row justify-between mb-4 gap-4 items-center mt-2">
                    <h3 className="font-bold text-[18px] text-slate-800">Daftar Kontrak PO</h3>
                  </div>

                  {/* TOOLBAR */}
                  <div className="mb-4 flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-3 border border-slate-200 rounded-t-lg shadow-sm">
                    <div className="flex items-center gap-2 text-[13px] text-slate-700 w-full lg:w-auto">
                      <select 
                        value={itemsPerPagePO} 
                        onChange={e => setItemsPerPagePO(Number(e.target.value))}
                        className="border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-[#12649b] bg-white cursor-pointer"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span>entries per page</span>
                    </div>

                    <div className="relative w-full sm:w-auto">
                      <input 
                        type="text" 
                        value={searchPOQuery} 
                        onChange={e => setSearchPOQuery(e.target.value)} 
                        className="w-full sm:w-64 pl-3 pr-8 py-1.5 rounded border border-slate-300 text-[13px] outline-none focus:border-[#12649b] bg-white" 
                        placeholder="Cari No. PO..." 
                      />
                      {searchPOQuery ? (
                        <button onClick={() => setSearchPOQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-rose-500">
                           <X size={14} />
                        </button>
                      ) : (
                        <Search size={14} className="absolute right-2.5 top-2 text-slate-400"/>
                      )}
                    </div>
                  </div>

                  {/* TABEL PO */}
                  <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg shadow-sm overflow-hidden mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-[#12649b] text-white">
                          <tr>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">No PO</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap text-center">Total Lokasi</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Total Nilai PO</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Serapan Rupiah</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap text-center">Status Serapan</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-center">Detail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {currentPOs.length > 0 ? currentPOs.map((p, index) => {
                            const isExpanded = expandedPOs[p.idDB];
                            
                            const totalValue = p.locations.reduce((sum, l) => sum + (l.value || 0), 0);
                            const totalBilled = p.locations.reduce((sum, l) => sum + getLocationStats(l, p.poNumber).totalBilled, 0);
                            const progress = totalValue > 0 ? (totalBilled / totalValue) * 100 : 0;

                            return (
                              <React.Fragment key={p.idDB}>
                                <tr 
                                  className={`transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50' : (index % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f9] hover:bg-slate-100')}`} 
                                  onClick={() => togglePO(p.idDB)}
                                >
                                  <td className="px-4 py-4 text-[14px] font-bold text-[#12649b]">{p.poNumber}</td>
                                  <td className="px-4 py-4 text-[13px] text-slate-600 font-semibold text-center">{p.locations.length} Lokasi</td>
                                  <td className="px-4 py-4 text-[13px] font-bold text-slate-700">{formatRupiah(totalValue)}</td>
                                  <td className="px-4 py-4 text-[13px] font-bold text-slate-700">{formatRupiah(totalBilled)}</td>
                                  <td className="px-4 py-4 text-[13px] text-center">
                                     <div className="flex items-center justify-center gap-2">
                                        <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                                           <div className={`h-full ${progress >= 100 ? 'bg-emerald-500' : progress >= 80 ? 'bg-amber-500' : 'bg-[#12649b]'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-600 w-8 text-right">{progress.toFixed(0)}%</span>
                                     </div>
                                  </td>
                                  <td className="px-4 py-4 text-center text-slate-400">
                                    {isExpanded ? <ChevronUp size={18} className="mx-auto text-[#12649b]" /> : <ChevronDown size={18} className="mx-auto" />}
                                  </td>
                                </tr>
                                
                                {isExpanded && (
                                  <tr>
                                    <td colSpan="6" className="p-0 bg-slate-50 border-b-2 border-blue-200 shadow-inner">
                                      <div className="p-6">
                                        <h4 className="text-[14px] font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Rincian Lokasi: <span className="text-[#12649b]">{p.poNumber}</span></h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                          {p.locations.map(l => {
                                            const s = getLocationStats(l, p.poNumber);
                                            const locProgress = l.value > 0 ? (s.totalBilled / l.value) * 100 : 0;
                                            return (
                                              <div key={l.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
                                                <div className="flex justify-between items-start mb-3">
                                                  <div className="flex-1 pr-4">
                                                    <h5 className="font-bold text-slate-800 text-[13px] mb-1">{l.name}</h5>
                                                    <div className="text-[11px] text-slate-500">
                                                      Sisa Saldo: <span className={`font-bold ${s.isShortageWarning ? 'text-rose-600' : 'text-slate-700'}`}>
                                                        {formatRupiah(s.remainingValue)} / {formatRupiah(l.value)}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Serapan</div>
                                                    <div className="text-[12px] font-bold text-[#12649b]">{locProgress.toFixed(1)}%</div>
                                                  </div>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2.5">
                                                  <div 
                                                    className={`h-full transition-all duration-1000 ${locProgress >= 100 ? 'bg-emerald-500' : locProgress >= 80 ? 'bg-amber-500' : 'bg-[#12649b]'}`} 
                                                    style={{ width: `${Math.min(locProgress, 100)}%` }}
                                                  ></div>
                                                </div>
                                                <div className="flex justify-between">
                                                    <div className="text-[11px] font-medium text-slate-500">Dokumen: {l.usedQuota} / {l.totalQuota}</div>
                                                    {s.isShortageWarning && <div className="text-[10px] font-bold text-rose-500 flex items-center gap-1"><AlertTriangle size={10}/> Dana Menipis!</div>}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          }) : (
                            <tr>
                              <td colSpan="6" className="p-8 text-center text-slate-500">
                                <AlertTriangle size={32} className="mx-auto mb-2 opacity-30 text-amber-500" />
                                <p className="text-[14px]">Data PO tidak ditemukan.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {filteredPOs.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center text-[13px] text-slate-700 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                      <div>
                        Menampilkan <span className="font-bold">{indexOfFirstPO + 1}</span> hingga <span className="font-bold">{Math.min(indexOfLastPO, filteredPOs.length)}</span> dari <span className="font-bold">{filteredPOs.length}</span> entri
                      </div>
                      
                      <div className="flex items-center gap-1 mt-3 sm:mt-0">
                        <button 
                          onClick={() => setCurrentPagePO(prev => Math.max(prev - 1, 1))}
                          disabled={currentPagePO === 1}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 bg-white font-medium transition-colors"
                        >
                          <ChevronLeft size={14} /> Sebelumnya
                        </button>
                        <button 
                          onClick={() => setCurrentPagePO(prev => Math.min(prev + 1, totalPagesPO))}
                          disabled={currentPagePO === totalPagesPO}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 bg-white font-medium transition-colors"
                        >
                          Selanjutnya <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: DATA TAGIHAN VIEW */}
              {activeTab === 'tab-data-tagihan' && (
                <div className="animate-tab flex flex-col h-full">
                  <div className="flex flex-col sm:flex-row justify-between mb-4 gap-4 items-center mt-2">
                    <h3 className="font-bold text-[18px] text-slate-800">Daftar Tagihan</h3>
                    <button 
                      onClick={handleExportExcel} 
                      className="bg-[#12649b] text-white font-bold py-2 px-5 rounded flex items-center justify-center gap-2 text-[13px] shadow-sm hover:bg-blue-800 transition-colors"
                    >
                      <Download size={16}/> Ekspor ke Excel
                    </button>
                  </div>
                  
                  <div className="mb-4 flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-3 border border-slate-200 rounded-t-lg shadow-sm">
                    <div className="flex items-center gap-2 text-[13px] text-slate-700 w-full lg:w-auto">
                      <select 
                        value={itemsPerPage} 
                        onChange={e => setItemsPerPage(Number(e.target.value))}
                        className="border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-[#12649b] bg-white cursor-pointer"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                      <span>entri per halaman</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                      <div className="flex bg-slate-100 p-1 rounded-md overflow-x-auto scrollbar-hide">
                        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 text-[12px] font-bold rounded ${filterStatus === 'all' ? 'bg-white text-[#12649b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
                        <button onClick={() => setFilterStatus('berjalan')} className={`px-3 py-1.5 text-[12px] font-bold rounded ${filterStatus === 'berjalan' ? 'bg-white text-[#12649b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Berjalan</button>
                        <button onClick={() => setFilterStatus('backdate')} className={`px-3 py-1.5 text-[12px] font-bold rounded ${filterStatus === 'backdate' ? 'bg-white text-[#12649b] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Backdate</button>
                      </div>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={filterDate} 
                          onChange={e => setFilterDate(e.target.value)} 
                          className="w-full sm:w-auto px-3 py-1.5 rounded border border-slate-300 text-[13px] outline-none focus:border-[#12649b] bg-white text-slate-600"
                        />
                        {filterDate && (
                          <button onClick={() => setFilterDate('')} className="absolute right-8 top-2 text-slate-400 hover:text-rose-500">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="relative w-full sm:w-auto">
                        <input 
                          type="text" 
                          value={searchTerm} 
                          onChange={e => setSearchTerm(e.target.value)} 
                          className="w-full sm:w-64 pl-3 pr-8 py-1.5 rounded border border-slate-300 text-[13px] outline-none focus:border-[#12649b] bg-white" 
                          placeholder="Pencarian..." 
                        />
                        {searchTerm ? (
                          <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-rose-500">
                             <X size={14} />
                          </button>
                        ) : (
                          <Search size={14} className="absolute right-2.5 top-2 text-slate-400"/>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg shadow-sm overflow-hidden mb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-[#12649b] text-white">
                          <tr>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Uraian Tagihan</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Tanggal</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Referensi PO</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Wilayah & Lokasi</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap">Nominal</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider border-r border-[#1a73a8] last:border-0 whitespace-nowrap text-center">Status</th>
                            <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {currentBills.length > 0 ? currentBills.map((b, index) => {
                            const isBackdate = b.year < currentYear;
                            return (
                              <tr key={b.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#f4f6f9] hover:bg-slate-100 transition-colors'}>
                                <td className="px-4 py-4 text-[13px]">
                                  <span className="font-bold text-[#12649b] hover:underline cursor-pointer" onClick={() => handleEditClick(b)}>{b.title}</span>
                                  {b.noBast && b.noBast !== '-' && <div className="text-[11px] text-slate-500 mt-1 font-mono">BAST: {b.noBast}</div>}
                                </td>
                                <td className="px-4 py-4 text-[13px] text-slate-600 whitespace-nowrap">
                                  {new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-4 text-[13px] text-slate-700 font-semibold">
                                  {b.poNumber}
                                </td>
                                <td className="px-4 py-4 text-[13px] text-slate-600">
                                  <div className="font-medium">{b.locationName || '-'}</div>
                                  {b.period && <div className="text-[11px] text-slate-400 mt-0.5">{b.period}</div>}
                                </td>
                                <td className="px-4 py-4 text-[13px] font-bold text-slate-700 whitespace-nowrap">
                                  {formatRupiah(b.amount)}
                                </td>
                                <td className="px-4 py-4 text-[12px] font-bold text-center">
                                  <span className={isBackdate ? 'text-amber-600' : 'text-[#2bb673]'}>{isBackdate ? 'Backdate' : 'Selesai'}</span>
                                </td>
                                <td className="px-4 py-4 text-[13px] text-center">
                                  <div className="flex items-center justify-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditClick(b)} className="text-[#12649b] hover:text-blue-800" title="Edit"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteBill(b.id)} className="text-rose-500 hover:text-rose-700" title="Hapus"><Trash2 size={16}/></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr>
                              <td colSpan="7" className="p-8 text-center text-slate-500">
                                <AlertTriangle size={32} className="mx-auto mb-2 opacity-30 text-amber-500" />
                                <p className="text-[14px]">Data tagihan tidak ditemukan.</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {filteredBills.length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center text-[13px] text-slate-700 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                      <div>
                        Menampilkan <span className="font-bold">{indexOfFirstBill + 1}</span> hingga <span className="font-bold">{Math.min(indexOfLastBill, filteredBills.length)}</span> dari <span className="font-bold">{filteredBills.length}</span> entri
                      </div>
                      
                      <div className="flex items-center gap-1 mt-3 sm:mt-0">
                        <button 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 bg-white font-medium transition-colors"
                        >
                          <ChevronLeft size={14} /> Sebelumnya
                        </button>
                        <button 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 bg-white font-medium transition-colors"
                        >
                          Selanjutnya <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: INPUT PO */}
              {activeTab === 'tab-input-po' && (
                <div className="animate-tab">
                  <div className="flex justify-end mb-6">
                    {/* TOGGLE INPUT MODE */}
                    <div className="bg-[#e2e8f0] p-1.5 rounded-xl flex gap-1 shadow-inner">
                      <button 
                        onClick={() => setInputMode('manual')} 
                        className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${inputMode === 'manual' ? 'bg-white shadow-sm text-[#12649b]' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Input Manual
                      </button>
                      <button 
                        onClick={() => setInputMode('excel')} 
                        className={`px-5 py-2 rounded-lg text-[13px] font-bold flex items-center gap-2 transition-all ${inputMode === 'excel' ? 'bg-white shadow-sm text-[#12649b]' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <FileSpreadsheet size={16}/> Import Excel
                      </button>
                    </div>
                  </div>

                  {/* MODE MANUAL PO */}
                  {inputMode === 'manual' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 mt-2">
                      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                        <h3 className="text-[20px] font-bold text-slate-800 flex items-center gap-3">
                          Input PO Baru
                        </h3>
                      </div>
                      
                      <form onSubmit={handleSaveManualPO} className="space-y-6">
                        <div>
                          <label className="block text-[13px] font-bold text-slate-800 mb-2">Nomor Induk PO <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            required
                            value={manualForm.poNumber} 
                            onChange={e => setManualForm({...manualForm, poNumber: e.target.value})} 
                            className="w-full max-w-md px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:ring-[#12649b] text-[13px]" 
                            placeholder="Contoh: 416xxxxxxx" 
                          />
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 text-[14px]">Daftar Lokasi di bawah PO ini</h4>
                            <button 
                              type="button"
                              onClick={handleAddLocationRow} 
                              className="text-[13px] font-bold text-[#12649b] bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                            >
                              <Plus size={16}/> Tambah Baris
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            {manualForm.locations.map((loc) => (
                              <div key={loc.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-1 md:grid-cols-12 gap-4 relative group shadow-sm">
                                <div className="md:col-span-4">
                                  <label className="block text-[12px] font-bold text-slate-800 mb-2">Lokasi <span className="text-red-500">*</span></label>
                                  <LocationAutocomplete 
                                    value={loc.name} 
                                    options={availableLocationNames} 
                                    onChange={v => handleLocationChange(loc.id, 'name', v)} 
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <label className="block text-[12px] font-bold text-slate-800 mb-2">Nilai PO (Rp) <span className="text-red-500">*</span></label>
                                  <input 
                                    type="text" 
                                    required
                                    value={loc.value} 
                                    onChange={e => handleLocationChange(loc.id, 'value', formatInputNumber(e.target.value))} 
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] text-[13px] font-bold" 
                                    placeholder="0"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-[12px] font-bold text-slate-800 mb-2">Kuota (Bulan) <span className="text-red-500">*</span></label>
                                  <input 
                                    type="number" 
                                    required
                                    value={loc.totalQuota} 
                                    onChange={e => handleLocationChange(loc.id, 'totalQuota', e.target.value)} 
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] text-[13px]" 
                                  />
                                </div>
                                <div className="md:col-span-3">
                                   <label className="block text-[12px] font-bold text-slate-800 mb-2">Start Month</label>
                                   <input 
                                     type="month" 
                                     value={loc.startMonth} 
                                     onChange={e => handleLocationChange(loc.id, 'startMonth', e.target.value)} 
                                     className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] text-[13px]" 
                                   />
                                </div>
                                {manualForm.locations.length > 1 && (
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveLocationRow(loc.id)} 
                                    className="absolute -top-3 -right-3 bg-white text-rose-500 border border-rose-200 rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                                  >
                                    <X size={14}/>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="pt-6 flex justify-end">
                          <button 
                            type="submit" 
                            className="bg-[#12649b] hover:bg-blue-800 text-white font-bold py-3 px-10 rounded-lg shadow-sm transition-colors text-[14px]"
                          >
                            Simpan Data PO
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    
                    /* MODE EXCEL PO */
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 mt-2 space-y-6">
                      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                         <h3 className="text-[20px] font-bold text-slate-800 flex items-center gap-3">
                           Unggah Excel Master PO
                         </h3>
                         <button 
                           onClick={handleDownloadTemplatePO} 
                           className="text-[12px] font-bold text-[#12649b] bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                         >
                           <Download size={14}/> Unduh Template
                         </button>
                      </div>

                      <div className="border-2 border-dashed border-emerald-200 p-12 text-center relative rounded-xl bg-emerald-50/20">
                        <UploadCloud size={48} className="mx-auto text-emerald-500 mb-4 opacity-40" />
                        <p className="text-xs text-slate-400 mb-8 max-w-sm mx-auto">
                           Tarik dan lepas file Excel Master PO Anda di sini, atau klik tombol di bawah untuk mencari file.
                        </p>
                        <div className="inline-block relative">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept=".xlsx, .xls" 
                            onChange={handleFileUpload} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm text-[13px]">
                            <FileSpreadsheet size={18}/> Pilih File Dokumen
                          </div>
                        </div>
                      </div>
                      
                      {excelPreview && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                          <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-[13px]">Preview Data Excel ({excelPreview.length} PO Terdeteksi)</h3>
                            <button onClick={() => setExcelPreview(null)} className="p-2 text-slate-400 hover:text-rose-500">
                              <X size={18}/>
                            </button>
                          </div>
                          <div className="overflow-x-auto max-h-96 main-scroll">
                            <table className="w-full text-left text-xs min-w-max">
                              <thead className="bg-slate-100 text-slate-500 uppercase font-bold tracking-wider sticky top-0 shadow-sm z-10">
                                <tr>
                                  <th className="px-6 py-4 border-r border-slate-200 last:border-0">No PO</th>
                                  <th className="px-6 py-4 border-r border-slate-200 last:border-0">Daftar Lokasi & Nilai</th>
                                  <th className="px-6 py-4">Kuota</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y border-t border-slate-100">
                                {excelPreview.map((p, i) => (
                                  <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="px-6 py-5 font-bold text-[#12649b] text-[13px] align-top">{p.poNumber}</td>
                                    <td className="px-6 py-5 align-top">
                                      {p.locations.map((l, li) => (
                                        <div key={li} className="mb-2 last:mb-0">
                                          <span className="font-semibold text-slate-700">{l.name}</span> 
                                          <span className="text-slate-400 text-[11px] ml-2">({formatRupiah(l.value)})</span>
                                        </div>
                                      ))}
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                      {p.locations.map((l, li) => (
                                        <div key={li} className="mb-2 last:mb-0 font-semibold text-slate-500">
                                          {l.totalQuota} Bln
                                        </div>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-6 bg-emerald-50 border-t flex justify-end">
                            <button 
                              onClick={handleSaveExcel} 
                              className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-lg shadow-sm hover:bg-emerald-700 text-[13px]"
                            >
                              Ya, Simpan {excelPreview.length} PO ke Cloud
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: INPUT TAGIHAN */}
              {activeTab === 'tab-input-tagihan' && (
                <div className="animate-tab">
                  <div className="flex justify-end mb-6">
                    {/* TOGGLE INPUT MODE */}
                    <div className="bg-[#e2e8f0] p-1.5 rounded-xl flex gap-1 shadow-inner">
                      <button 
                        onClick={() => setInputBillMode('manual')} 
                        className={`px-5 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${inputBillMode === 'manual' ? 'bg-white shadow-sm text-[#12649b]' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Input Manual
                      </button>
                      <button 
                        onClick={() => setInputBillMode('excel')} 
                        className={`px-5 py-2 rounded-lg text-[13px] font-bold flex items-center gap-2 transition-all ${inputBillMode === 'excel' ? 'bg-white shadow-sm text-[#12649b]' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <FileText size={16}/> Import Excel
                      </button>
                    </div>
                  </div>

                  {inputBillMode === 'manual' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 mt-2">
                      
                      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                        <h3 className="text-[20px] font-bold text-slate-800 flex items-center gap-3">
                          Input Tagihan Baru
                        </h3>
                      </div>

                      <form onSubmit={handleSaveBill} className="space-y-6">
                        
                        <div>
                          <label className="block text-[13px] font-bold text-slate-800 mb-2">
                            Region <span className="text-red-500">*</span>
                          </label>
                          <select 
                            required
                            value={billForm.region}
                            onChange={e => setBillForm({...billForm, region: e.target.value})}
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:border-[#12649b] text-[13px] bg-white appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 9l4-4 4 4m0 6l-4 4-4-4'/%3E%3C/svg%3E")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.2em` }}
                          >
                            <option value="" disabled>Pilih Region</option>
                            <option value="Sumbagut">Sumbagut</option>
                            <option value="Sumbagsel">Sumbagsel</option>
                            <option value="Jabalinus">Jabalinus</option>
                            <option value="Kalimantan">Kalimantan</option>
                            <option value="Sulawesi">Sulawesi</option>
                            <option value="Malupa">Malupa</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[13px] font-bold text-slate-800 mb-2">
                            Master PO <span className="text-red-500">*</span>
                          </label>
                          <POAutocomplete 
                            value={billForm.poNumber} 
                            options={pos.map(p => p.poNumber)} 
                            onChange={(v) => setBillForm({
                              ...billForm, 
                              poNumber: v, 
                              locationId: '', 
                              selectedPeriod: ''
                            })} 
                          />
                        </div>

                        <div>
                          <label className="block text-[13px] font-bold text-slate-800 mb-2">
                            Lokasi / Peruntukan <span className="text-red-500">*</span>
                          </label>
                          <ObjectAutocomplete 
                            value={billForm.locationId} 
                            options={activePoForBill ? activePoForBill.locations.map(l => ({ 
                              id: l.id, 
                              label: `${l.name} (${l.usedQuota}/${l.totalQuota})`, 
                              disabled: l.usedQuota >= l.totalQuota 
                            })) : []} 
                            onChange={(v) => setBillForm({
                              ...billForm, 
                              locationId: v, 
                              selectedPeriod: ''
                            })} 
                            disabled={!billForm.poNumber} 
                            placeholder="-- Pilih Lokasi --" 
                          />
                        </div>

                        {activeLocForBill?.generatedPeriods?.length > 0 && (
                          <div className="pt-2 animate-in fade-in duration-300">
                            <label className="block text-[13px] font-bold text-slate-800 mb-3 flex justify-between">
                              <span>Pilih Opsi Periode Tagihan <span className="text-red-500">*</span></span>
                              <span className="text-[#12649b] font-semibold">Progress: {activeLocForBill.usedQuota}/{activeLocForBill.totalQuota}</span>
                            </label>
                            <div className="flex flex-wrap gap-2.5">
                              {activeLocForBill.generatedPeriods.map((p, i) => {
                                const isUsed = i < activeLocForBill.usedQuota;
                                return (
                                  <label 
                                    key={i} 
                                    className={`cursor-pointer px-5 py-2.5 rounded-lg border text-[13px] transition-all
                                      ${isUsed ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 
                                      billForm.selectedPeriod === p ? 'bg-[#12649b] text-white border-[#12649b] font-bold shadow-md transform scale-105' : 
                                      'bg-white text-slate-700 border-slate-300 hover:border-[#12649b] hover:bg-blue-50 font-semibold'}
                                    `}
                                  >
                                    <input 
                                      type="radio" 
                                      name="periodSelect" 
                                      className="hidden" 
                                      value={p} 
                                      disabled={isUsed}
                                      checked={billForm.selectedPeriod === p} 
                                      onChange={(e) => setBillForm({...billForm, selectedPeriod: e.target.value})} 
                                    />
                                    {p} {isUsed && ' ✓'}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {activeLocForBill && (() => {
                          const stats = getLocationStats(activeLocForBill, billForm.poNumber);
                          if (stats.isShortageWarning) {
                            return (
                              <div className="mt-2 p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 animate-in fade-in zoom-in">
                                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                                <div>
                                  <h5 className="text-[13px] font-bold text-rose-800">Peringatan: Potensi Nilai PO Kurang!</h5>
                                  <p className="text-[13px] text-rose-600 mt-1 leading-relaxed">
                                    Sisa kuota tinggal 1 kali tagih, namun sisa saldo PO (<strong>{formatRupiah(stats.remainingValue)}</strong>) lebih kecil dari estimasi awal per bulan (<strong>{formatRupiah(stats.estimatedMonthly)}</strong>). Pastikan tagihan final tidak melebihi sisa saldo PO.
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        
                        <div>
                          <label className="block text-[13px] font-bold text-slate-800 mb-2">
                            Judul / Uraian Tagihan <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="text" 
                            required
                            value={billForm.title} 
                            onChange={e => setBillForm({...billForm, title: e.target.value})} 
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:ring-[#12649b] text-[13px]" 
                            placeholder="Deskripsikan Uraian Tagihan..." 
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                             <label className="block text-[13px] font-bold text-slate-800 mb-2">
                               No. BAST <span className="text-red-500">*</span>
                             </label>
                             <input 
                               type="text" 
                               required
                               value={billForm.noBast} 
                               onChange={e => setBillForm({...billForm, noBast: e.target.value})} 
                               className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:ring-[#12649b] text-[13px]" 
                               placeholder="BAST-..." 
                             />
                          </div>
                          <div>
                            <label className="block text-[13px] font-bold text-slate-800 mb-2">
                              Tanggal Invoice <span className="text-red-500">*</span>
                            </label>
                            <input 
                              type="date" 
                              required
                              value={billForm.date} 
                              onChange={e => setBillForm({...billForm, date: e.target.value})} 
                              className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:ring-[#12649b] text-[13px] text-slate-700" 
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[13px] font-bold text-slate-800 mb-2">
                              Nominal (Rp) <span className="text-red-500">*</span>
                            </label>
                            <input 
                              type="text" 
                              required
                              value={billForm.amount} 
                              onChange={e => setBillForm({...billForm, amount: formatInputNumber(e.target.value)})} 
                              className="w-full px-4 py-3 rounded-lg border border-slate-300 outline-none focus:border-[#12649b] focus:ring-1 focus:ring-[#12649b] text-[15px] font-bold text-slate-800" 
                              placeholder="0"
                            />
                          </div>
                        </div>
                        
                        <div className="pt-6 flex justify-end">
                          <button 
                            type="submit" 
                            className="bg-[#12649b] hover:bg-blue-800 text-white font-bold py-3 px-10 rounded-lg shadow-sm transition-colors text-[14px]"
                          >
                            Simpan
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* MODE EXCEL TAGIHAN */
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 mt-2 space-y-6">
                      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                         <h3 className="text-[20px] font-bold text-slate-800 flex items-center gap-3">
                           Unggah Excel Data Tagihan
                         </h3>
                         <button 
                           onClick={handleDownloadTemplateBill} 
                           className="text-[12px] font-bold text-[#12649b] bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                         >
                           <Download size={14}/> Unduh Template
                         </button>
                      </div>

                      <div className="border-2 border-dashed border-blue-200 p-12 text-center relative rounded-xl bg-blue-50/20">
                        <UploadCloud size={48} className="mx-auto text-blue-500 mb-4 opacity-40" />
                        <p className="text-xs text-slate-400 mb-8 max-w-sm mx-auto">
                           Tarik dan lepas file Excel Tagihan Anda di sini, atau klik tombol di bawah untuk mencari file.
                        </p>
                        <div className="inline-block relative">
                          <input 
                            type="file" 
                            ref={fileBillInputRef} 
                            accept=".xlsx, .xls" 
                            onChange={handleFileBillUpload} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className="bg-[#12649b] text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-800 transition-colors shadow-sm text-[13px]">
                            <FileSpreadsheet size={18}/> Pilih File Tagihan
                          </div>
                        </div>
                      </div>
                      
                      {excelBillPreview && (
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                          <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-[13px]">Preview Data Excel ({excelBillPreview.length} Baris Dibaca)</h3>
                            <button onClick={() => setExcelBillPreview(null)} className="p-2 text-slate-400 hover:text-rose-500">
                              <X size={18}/>
                            </button>
                          </div>
                          <div className="overflow-x-auto max-h-96 main-scroll">
                            <table className="w-full text-left text-xs min-w-max">
                              <thead className="bg-slate-100 text-slate-500 uppercase font-bold tracking-wider sticky top-0 shadow-sm z-10">
                                <tr>
                                  <th className="px-4 py-3 border-r border-slate-200 text-center w-10">Valid</th>
                                  <th className="px-4 py-3 border-r border-slate-200">Uraian Tagihan</th>
                                  <th className="px-4 py-3 border-r border-slate-200">Keterangan PO</th>
                                  <th className="px-4 py-3 border-r border-slate-200">Nominal</th>
                                  <th className="px-4 py-3">Pesan Sistem</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y border-t border-slate-100">
                                {excelBillPreview.map((b) => (
                                  <tr key={b.id} className={`transition-colors ${b.isValid ? 'hover:bg-blue-50/20' : 'bg-rose-50/30'}`}>
                                    <td className="px-4 py-4 text-center align-top">
                                      {b.isValid ? <CheckCircle size={16} className="text-emerald-500 mx-auto"/> : <AlertTriangle size={16} className="text-rose-500 mx-auto"/>}
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                      <div className="font-bold text-[#12649b] text-[13px]">{b.title}</div>
                                      <div className="text-slate-400 text-[11px] mt-1">{new Date(b.date).toLocaleDateString('id-ID')} | BAST: {b.noBast}</div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                      <div className="font-semibold text-slate-700 text-[12px]">{b.poNumber}</div>
                                      <div className="text-slate-500 text-[11px] mt-0.5">{b.region} - {b.locationName}</div>
                                    </td>
                                    <td className="px-4 py-4 align-top font-bold text-slate-700 whitespace-nowrap">
                                      {formatRupiah(b.amount)}
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                      {b.isValid ? (
                                        <span className="text-emerald-600 font-semibold text-[11px]">Siap Diimpor</span>
                                      ) : (
                                        <span className="text-rose-600 font-bold text-[11px]">{b.errorMsg}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-6 bg-blue-50 border-t flex items-center justify-between">
                            <div className="text-[12px] text-slate-600">
                               Hanya baris dengan status <strong className="text-emerald-600">Valid</strong> yang akan dimasukkan ke database.
                            </div>
                            <button 
                              onClick={handleSaveExcelBill} 
                              className="bg-[#12649b] text-white font-bold py-3 px-8 rounded-lg shadow-sm hover:bg-blue-800 text-[13px] disabled:opacity-50"
                              disabled={!excelBillPreview.some(b => b.isValid)}
                            >
                              Simpan Tagihan Valid
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* FOOTER HIJAU */}
      <footer className="bg-[#8cc63f] text-white text-center text-[11px] py-3 font-semibold z-30 shadow-inner tracking-wider">
        ©{currentYear} PT. Elnusa Petrofin
      </footer>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function SidebarSubButton({ id, label, activeTab, onClick }) {
  const active = activeTab === id;
  return (
    <button 
      onClick={() => onClick(id)} 
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full transition-all duration-200 
        ${active 
          ? 'bg-blue-50 text-[#12649b] font-bold border border-blue-100' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-[#12649b] font-medium'
        }`}
    >
      <span className="text-[13px]">{label}</span>
    </button>
  );
}

function LocationAutocomplete({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = options.filter(x => x.toLowerCase().includes(value.toLowerCase()));
  
  useEffect(() => {
    const click = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); 
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);
  
  return (
    <div className="relative" ref={ref}>
      <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
      <input 
        type="text" 
        value={value} 
        onChange={e => { onChange(e.target.value); setOpen(true); }} 
        onFocus={() => setOpen(true)} 
        className="w-full pl-9 pr-3 py-3 rounded-lg border border-slate-300 text-[13px] focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] outline-none bg-white" 
        placeholder="Cari lokasi..." 
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto main-scroll">
          {filtered.map((x, i) => (
            <li 
              key={i} 
              onClick={() => { onChange(x); setOpen(false); }} 
              className="px-5 py-3 text-[13px] hover:bg-blue-50 cursor-pointer font-bold text-slate-700 border-b border-slate-50 last:border-0"
            >
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function POAutocomplete({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const ref = useRef(null);
  
  useEffect(() => { 
    setInput(value); 
  }, [value]);
  
  const filtered = options.filter(x => x.toLowerCase().includes(input.toLowerCase()));
  
  useEffect(() => {
    const click = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) { 
        setOpen(false); 
        setInput(value); 
      } 
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [value]);
  
  return (
    <div className="relative" ref={ref}>
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-3 text-slate-400" />
        <input 
          type="text" 
          value={input} 
          onChange={e => { 
            setInput(e.target.value); 
            setOpen(true); 
            if(e.target.value === '') {
              onChange(''); 
            }
          }} 
          onFocus={() => setOpen(true)} 
          className="w-full pl-9 pr-8 py-3 rounded-lg border border-slate-300 text-[13px] focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] outline-none bg-white" 
          placeholder="Cari PO..." 
        />
        {input && (
          <button 
            type="button"
            onClick={() => { onChange(''); setOpen(false); }} 
            className="absolute right-3 text-slate-300 hover:text-rose-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto main-scroll">
          {filtered.length > 0 ? (
            filtered.map((x, i) => (
              <li 
                key={i} 
                onClick={() => { onChange(x); setOpen(false); }} 
                className="px-5 py-3 text-[13px] font-bold text-[#12649b] hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
              >
                {x}
              </li>
            ))
          ) : (
            <li className="px-5 py-3 text-[12px] italic text-slate-400">PO tidak ditemukan</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ObjectAutocomplete({ value, options, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const ref = useRef(null);
  
  useEffect(() => { 
    const selected = options.find(o => String(o.id) === String(value)); 
    setInput(selected ? selected.label : ''); 
  }, [value, options]);
  
  const filtered = options.filter(x => x.label.toLowerCase().includes(input.toLowerCase()));
  
  useEffect(() => {
    const click = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) { 
        setOpen(false); 
        const selected = options.find(o => String(o.id) === String(value)); 
        setInput(selected ? selected.label : ''); 
      } 
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [value, options]);
  
  return (
    <div className="relative" ref={ref}>
      <div className="relative flex items-center">
        <Search size={14} className={`absolute left-3 ${disabled ? 'text-slate-300' : 'text-slate-400'}`} />
        <input 
          type="text" 
          value={input} 
          onChange={e => { 
            setInput(e.target.value); 
            setOpen(true); 
            if(e.target.value === '') {
              onChange(''); 
            }
          }} 
          onFocus={() => { if(!disabled) setOpen(true) }} 
          disabled={disabled} 
          className="w-full pl-9 pr-8 py-3 rounded-lg border border-slate-300 text-[13px] focus:ring-1 focus:ring-[#12649b] focus:border-[#12649b] outline-none disabled:bg-slate-50 disabled:text-slate-300 bg-white" 
          placeholder={placeholder} 
        />
        {input && !disabled && (
          <button 
            type="button"
            onClick={() => { onChange(''); setOpen(false); setInput(''); }} 
            className="absolute right-3 text-slate-300 hover:text-rose-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto main-scroll">
          {filtered.length > 0 ? (
            filtered.map((x, i) => (
              <li 
                key={i} 
                onClick={() => { 
                  if(!x.disabled) { 
                    onChange(x.id); 
                    setOpen(false); 
                  } 
                }} 
                className={`px-5 py-3 text-[13px] font-bold border-b border-slate-50 last:border-0 
                  ${x.disabled 
                    ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                    : 'text-slate-700 hover:bg-blue-50 hover:text-[#12649b] cursor-pointer'
                  }`}
              >
                {x.label}
              </li>
            ))
          ) : (
            <li className="px-5 py-3 text-[12px] italic text-slate-400">Tidak ditemukan</li>
          )}
        </ul>
      )}
    </div>
  );
}

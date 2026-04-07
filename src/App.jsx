import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
// Menggunakan ESM.SH agar bisa berjalan mulus di layar pratinjau (Preview)
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import {
  Monitor, Home, CalendarClock, History, Database,
  FileText, FilePlus, FileEdit, Clock, AlertTriangle, 
  CheckCircle, Trash2, Plus, UploadCloud, FileSpreadsheet, Save, X, Search,
  Edit, Download, Filter, MapPin, Bell, ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- KONFIGURASI SUPABASE ---
const supabaseUrl = 'https://ggqhftplowteewzlzimu.supabase.co';
const supabaseKey = 'sb_publishable_O7S-yT9cFZiMWSLAOjSqoQ_uOtd8C3x';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const [activeTab, setActiveTab] = useState('tab-home'); 
  const [notification, setNotification] = useState(null);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

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

  // Ambil daftar nama lokasi unik yang pernah diinput untuk saran (Autocomplete)
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

  // Filter khusus Master PO (Hanya memunculkan data saat di-search)
  const filteredPOs = useMemo(() => {
    if (!searchPOQuery.trim()) return [];
    return pos.filter(p => p.poNumber.toLowerCase().includes(searchPOQuery.toLowerCase()));
  }, [pos, searchPOQuery]);

  // ==========================================
  // FETCH DATA DARI SUPABASE
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
      showNotif('Gagal mengambil data dari Supabase.', 'error');
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

  // State Excel Import
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
          const cleanValue = rawValue ? String(rawValue).replace(/[^0-9]/g, '') : '0';
          const locValue = parseFloat(cleanValue);

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

  // ==========================================
  // LOGIKA INPUT TAGIHAN BARU 
  // ==========================================
  const [billForm, setBillForm] = useState({
    hasPo: true,
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

  const getLocationStats = (loc) => {
    const locationBills = bills.filter(b => String(b.locationId) === String(loc.id));
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
    
    if (!billForm.title || !billForm.amount || !billForm.date) {
      return showNotif('Lengkapi data tagihan (Judul, Nilai, Tanggal)!', 'error');
    }
    
    const cleanAmount = parseFloat(String(billForm.amount).replace(/[^0-9]/g, '')) || 0;
    if (!cleanAmount) {
        return showNotif('Nominal tagihan tidak valid!', 'error');
    }

    let iteration = null;
    let updatedLocsForState = null;

    if (billForm.hasPo) {
      if (!billForm.poNumber || !billForm.locationId) {
          return showNotif('Pilih Master PO dan Lokasi terlebih dahulu!', 'error');
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

      updatedLocsForState = activePoForBill.locations.map(l => {
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
      
      iteration = activeLocForBill.usedQuota + 1; 
    }

    const dbBillPayload = {
      title: billForm.title,
      no_bast: billForm.noBast || '-',
      amount: cleanAmount,
      date: billForm.date,
      year: parseInt(billForm.date.substring(0, 4)),
      has_po: billForm.hasPo,
      po_number: billForm.hasPo ? billForm.poNumber : null,
      location_id: billForm.hasPo ? billForm.locationId : null,
      period: billForm.hasPo ? billForm.selectedPeriod : null,
      iteration: iteration,
      location_name: activeLocForBill ? activeLocForBill.name : null
    };

    const { data: insertedBill, error: insertErr } = await supabase.from('bills').insert([dbBillPayload]).select();
    
    if (insertErr) {
        return showNotif('Gagal menyimpan tagihan: ' + insertErr.message, 'error');
    }

    if (billForm.hasPo && updatedLocsForState) {
      setPos(pos.map(p => String(p.poNumber) === String(billForm.poNumber) ? { ...p, locations: updatedLocsForState } : p));
    }

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
      hasPo: true, 
      poNumber: '', 
      locationId: '', 
      selectedPeriod: '', 
      title: '', 
      noBast: '', 
      amount: '', 
      date: ''
    });
  };

  const handleDeleteBill = async (id) => {
    const billToDelete = bills.find(b => b.id === id);
    if (!billToDelete) return;

    if (billToDelete.hasPo && billToDelete.poNumber && billToDelete.locationId) {
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
    setEditingBill({ 
        ...bill,
        amount: formatInputNumber(bill.amount)
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    
    if (!editingBill.title || !editingBill.amount || !editingBill.date) {
      return showNotif('Lengkapi data wajib!', 'error');
    }
    
    const cleanAmount = parseFloat(String(editingBill.amount).replace(/[^0-9]/g, '')) || 0;
    if (!cleanAmount) {
        return showNotif('Nominal tagihan tidak valid!', 'error');
    }

    const updatePayload = {
      title: editingBill.title,
      no_bast: editingBill.noBast || '-',
      amount: cleanAmount,
      date: editingBill.date,
      year: parseInt(editingBill.date.substring(0, 4))
    };

    const { error } = await supabase.from('bills').update(updatePayload).eq('id', editingBill.id);
    
    if(error) {
        return showNotif('Gagal menyimpan perubahan: ' + error.message, 'error');
    }

    setBills(bills.map(b => b.id === editingBill.id ? { ...b, ...updatePayload, noBast: updatePayload.no_bast } : b).sort((a, b) => new Date(b.date) - new Date(a.date)));
    setEditingBill(null);
    showNotif('Perubahan Berhasil Disimpan ke Supabase!', 'success');
  };

  // ==========================================
  // FILTER & SEARCH & PAGINATION (DATA TAGIHAN)
  // ==========================================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, berjalan, backdate, non-po
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset ke halaman 1 setiap kali ada pencarian atau filter yang diubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterDate]);

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
      } else if (filterStatus === 'non-po') {
        matchStatus = !b.hasPo;
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
      'Status Dokumen': b.hasPo ? 'Ada PO' : 'Tanpa PO',
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
  // DATA PREPARATION FOR DASHBOARD
  // ==========================================
  const berjalanBills = bills.filter(b => b.year >= currentYear);
  const backdateBills = bills.filter(b => b.year < currentYear);

  const totalBerjalan = berjalanBills.reduce((sum, b) => sum + b.amount, 0);
  const totalBackdate = backdateBills.reduce((sum, b) => sum + b.amount, 0);

  const noPoBills = bills.filter(b => !b.hasPo);
  const totalNoPo = noPoBills.reduce((sum, b) => sum + b.amount, 0);

  const totalNilaiPO = pos.reduce((sum, p) => sum + p.locations.reduce((locSum, loc) => locSum + (parseFloat(loc.value) || 0), 0), 0);
  const totalDitagihkan = bills.filter(b => b.hasPo).reduce((sum, b) => sum + b.amount, 0);
  const sisaNilaiPO = totalNilaiPO - totalDitagihkan;
  const persentaseSerapan = totalNilaiPO > 0 ? (totalDitagihkan / totalNilaiPO) * 100 : 0;

  const poKritis = [];
  pos.forEach(p => {
    p.locations.forEach(loc => {
      const stats = getLocationStats(loc);
      if (stats.isShortageWarning || (loc.totalQuota > 0 && (loc.totalQuota - loc.usedQuota) <= 1 && loc.usedQuota < loc.totalQuota)) {
        poKritis.push({ poNumber: p.poNumber, location: loc, stats });
      }
    });
  });

  // Mengurutkan agar peringatan "Potensi PO Additional!" selalu berada di paling atas
  poKritis.sort((a, b) => (b.stats.isShortageWarning ? 1 : 0) - (a.stats.isShortageWarning ? 1 : 0));

  const tagihanTerakhir = [...bills].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const chartData = useMemo(() => {
    let openCount = 0;
    let completeCount = 0;
    pos.forEach(po => {
      po.locations.forEach(loc => {
        if (loc.usedQuota >= loc.totalQuota) completeCount++;
        else openCount++;
      });
    });
    return {
      labels: ['Lokasi Open (Bisa Ditagih)', 'Lokasi Complete (Kuota Habis)'],
      datasets: [{ 
          data: [openCount, completeCount], 
          backgroundColor: ['#3b82f6', '#10b981'], 
          borderWidth: 0, 
          hoverOffset: 8 
      }]
    };
  }, [pos]);

  // ==========================================
  // GET PAGE TITLE UNTUK HEADER KONTEKSTUAL
  // ==========================================
  const getPageTitle = () => {
    switch(activeTab) {
      case 'tab-home': return 'DASHBOARD TAGIHAN';
      case 'tab-master-po': return 'Rekap Data PO';
      case 'tab-data-tagihan': return 'Rekap Data Tagihan';
      case 'tab-input-tagihan': return 'Input Tagihan';
      case 'tab-input-po': return 'Input PO';
      default: return 'Aplikasi Monitoring';
    }
  };

  // Loading Screen Database
  if (isLoadingDB) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        <Monitor size={48} className="text-blue-500 animate-pulse mb-6" />
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-semibold text-slate-300">Menghubungkan ke Supabase Cloud...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER UI UTAMA
  // ==========================================
  return (
    <div className="bg-slate-50 text-slate-800 flex h-screen w-full overflow-hidden" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      
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
               <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-4 text-sm mb-4">
                 <div className="flex-1">
                   <span className="block text-xs text-slate-500 font-bold mb-0.5">Referensi PO (Terkunci)</span>
                   <span className="font-medium text-slate-700">{editingBill.hasPo ? editingBill.poNumber : 'TANPA PO (Pengecualian)'}</span>
                 </div>
                 {editingBill.hasPo && (
                   <div className="flex-1">
                     <span className="block text-xs text-slate-500 font-bold mb-0.5">Lokasi / Periode (Terkunci)</span>
                     <span className="font-medium text-slate-700">{editingBill.locationName} {editingBill.period && `(${editingBill.period})`}</span>
                   </div>
                 )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Judul Tagihan</label>
                    <input 
                        type="text" 
                        required 
                        value={editingBill.title} 
                        onChange={e => setEditingBill({...editingBill, title: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">No. BAST (Opsional)</label>
                    <input 
                        type="text" 
                        value={editingBill.noBast === '-' ? '' : editingBill.noBast} 
                        onChange={e => setEditingBill({...editingBill, noBast: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nominal Tagihan (Rp)</label>
                    <input 
                        type="text" 
                        required 
                        value={editingBill.amount} 
                        onChange={e => setEditingBill({...editingBill, amount: formatInputNumber(e.target.value)})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Approval</label>
                    <input 
                        type="date" 
                        required 
                        value={editingBill.date} 
                        onChange={e => setEditingBill({...editingBill, date: e.target.value})} 
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                    />
                  </div>
               </div>
               <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                 <button type="button" onClick={() => setEditingBill(null)} className="px-5 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg transition-colors">Batal</button>
                 <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2"><Save size={16}/> Simpan Perubahan</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDEBAR KIRI */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="flex flex-col px-6 py-6 border-b border-slate-800 mb-4 gap-1">
          <img 
            src="/logo-elnusa.png" 
            alt="Elnusa Petrofin" 
            className="h-14 w-auto object-contain object-left"
            onError={(e) => {
              // Fallback jika gambar lokal belum ada saat simulasi
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/150x40/0f172a/ffffff?text=ELNUSA+PETROFIN";
            }}
          />
          <span className="font-black text-slate-400 text-[10px] tracking-widest uppercase mt-2 ml-1">Monitor Tagihan</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide pb-6">
          <SidebarButton 
            id="tab-home" 
            icon={<Home size={18} />} 
            label="Dashboard" 
            activeTab={activeTab} 
            onClick={setActiveTab} 
          />
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">
            Data Master
          </div>
          <SidebarButton 
            id="tab-master-po" 
            icon={<Database size={18} />} 
            label="Data PO" 
            activeTab={activeTab} 
            onClick={setActiveTab} 
          />
          <SidebarButton 
            id="tab-data-tagihan" 
            icon={<FileText size={18} />} 
            label="Data Tagihan" 
            activeTab={activeTab} 
            onClick={setActiveTab} 
          />
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">
            Input
          </div>
          <SidebarButton 
            id="tab-input-po" 
            icon={<FileEdit size={18} />} 
            label="PO Baru" 
            activeTab={activeTab} 
            onClick={setActiveTab} 
          />
          <SidebarButton 
            id="tab-input-tagihan" 
            icon={<FilePlus size={18} />} 
            label="Tagihan Baru" 
            activeTab={activeTab} 
            onClick={setActiveTab} 
          />
        </nav>
      </aside>

      {/* KONTEN UTAMA KANAN */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        
        {/* HEADER TOPBAR KONTEKSTUAL (BORDERLESS) */}
        <header className="h-20 bg-slate-50 flex items-center justify-between px-8 flex-shrink-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-blue-600 transition-colors relative cursor-pointer">
               <Bell size={20} />
               <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-50"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 cursor-pointer group">
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">RTC Support</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Admin</p>
              </div>
              <div className="h-10 w-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm group-hover:shadow-md transition-all">
                RS
              </div>
            </div>
          </div>
        </header>

        {/* AREA SCROLL KONTEN */}
        <div className="flex-1 overflow-y-auto main-scroll px-8 pb-8">
          <div className="max-w-5xl mx-auto">
            
            {/* TAB: DASHBOARD HOME */}
            {activeTab === 'tab-home' && (
              <div className="animate-tab space-y-6">
                
                {/* Baris Atas: 4 KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  <div className="bg-white border border-slate-200 p-5 lg:p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group" 
                       onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('berjalan'); setCurrentPage(1); }}>
                    <div className="flex justify-between items-start mb-2 lg:mb-4">
                       <h3 className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Tagihan Berjalan</h3>
                       <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-110 transition-transform"><CalendarClock size={16}/></div>
                    </div>
                    <div className="text-lg lg:text-xl font-black text-blue-900 truncate tracking-tight" title={formatRupiah(totalBerjalan)}>{formatRupiah(totalBerjalan)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-blue-600 font-bold">{berjalanBills.length}</span> Dokumen</div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 p-5 lg:p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group" 
                       onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('backdate'); setCurrentPage(1); }}>
                    <div className="flex justify-between items-start mb-2 lg:mb-4">
                       <h3 className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Tunggakan Backdate</h3>
                       <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:scale-110 transition-transform"><History size={16}/></div>
                    </div>
                    <div className="text-lg lg:text-xl font-black text-amber-900 truncate tracking-tight" title={formatRupiah(totalBackdate)}>{formatRupiah(totalBackdate)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-amber-600 font-bold">{backdateBills.length}</span> Dokumen</div>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 lg:p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group" 
                       onClick={() => { setActiveTab('tab-master-po'); }}>
                    <div className="flex justify-between items-start mb-2 lg:mb-4">
                       <h3 className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Total Kontrak PO</h3>
                       <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform"><Database size={16}/></div>
                    </div>
                    <div className="text-lg lg:text-xl font-black text-emerald-900 truncate tracking-tight" title={formatRupiah(totalNilaiPO)}>{formatRupiah(totalNilaiPO)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-emerald-600 font-bold">{pos.length}</span> Master Aktif</div>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 lg:p-6 rounded-2xl lg:rounded-3xl cursor-pointer hover:shadow-md hover:border-rose-200 transition-all group" 
                       onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('non-po'); setCurrentPage(1); }}>
                    <div className="flex justify-between items-start mb-2 lg:mb-4">
                       <h3 className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Tagihan Non-PO</h3>
                       <div className="p-2 bg-rose-50 rounded-lg text-rose-600 group-hover:scale-110 transition-transform"><AlertTriangle size={16}/></div>
                    </div>
                    <div className="text-lg lg:text-xl font-black text-rose-900 truncate tracking-tight" title={formatRupiah(totalNoPo)}>{formatRupiah(totalNoPo)}</div>
                    <div className="text-[10px] lg:text-xs text-slate-500 mt-1 lg:mt-2 font-medium"><span className="text-rose-600 font-bold">{noPoBills.length}</span> Pengecualian</div>
                  </div>
                </div>

                {/* Baris Tengah: Grafik Serapan */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Serapan Anggaran PO</h3>
                      <p className="text-sm text-slate-500">Perbandingan total nilai kontrak PO aktif dengan total tagihan yang sudah diinput.</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-slate-800 leading-none">{persentaseSerapan.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-3">
                     <div className={`h-full transition-all duration-1000 ${persentaseSerapan > 90 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(persentaseSerapan, 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                     <span className="text-blue-600 truncate mr-2" title={`Terpakai: ${formatRupiah(totalDitagihkan)}`}>Terpakai: {formatRupiah(totalDitagihkan)}</span>
                     <span className="text-emerald-600 truncate text-right" title={`Sisa Anggaran: ${formatRupiah(sisaNilaiPO)}`}>Sisa: {formatRupiah(sisaNilaiPO)}</span>
                  </div>
                </div>

                {/* Baris Bawah: Panel Atensi & Aktivitas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Kolom Kiri: PO Kritis */}
                   <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                      <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                         <AlertTriangle size={20} className="text-amber-500" /> Butuh Atensi (PO Kritis)
                      </h3>
                      <div className="space-y-3 flex-1">
                         {poKritis.length > 0 ? poKritis.slice(0, 4).map((pk, idx) => (
                            <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-center cursor-pointer hover:border-amber-200 hover:shadow-sm transition-all" onClick={() => {setSearchPOQuery(pk.poNumber); setActiveTab('tab-master-po');}}>
                               <div className="overflow-hidden pr-2">
                                  <div className="font-bold text-slate-800 text-sm mb-1 truncate">{pk.poNumber}</div>
                                  <div className="text-xs text-slate-500 truncate">{pk.location.name}</div>
                                  {pk.stats.isShortageWarning && (
                                      <div className="inline-flex items-center gap-1 text-[10px] text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold mt-2">
                                          <AlertTriangle size={10} /> Potensi PO Additional!
                                      </div>
                                  )}
                               </div>
                               <div className="text-right whitespace-nowrap">
                                  <div className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                                    Sisa {pk.location.totalQuota - pk.location.usedQuota}x Tagih
                                  </div>
                               </div>
                            </div>
                         )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                               <CheckCircle size={32} className="mb-3 opacity-50" />
                               <span className="text-sm font-medium">Semua kuota PO masih aman.</span>
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Kolom Kanan: Tagihan Terbaru */}
                   <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
                      <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                         <History size={20} className="text-blue-500" /> Histori Tagihan Masuk
                      </h3>
                      <div className="space-y-3 flex-1 overflow-y-auto pr-2 main-scroll max-h-[300px]">
                         {tagihanTerakhir.length > 0 ? tagihanTerakhir.map(b => (
                            <div key={b.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group" 
                                 onClick={() => { setActiveTab('tab-data-tagihan'); setFilterStatus('all'); setSearchTerm(b.title); setCurrentPage(1); }}>
                               <div className="flex justify-between items-start mb-2">
                                  <div className="font-bold text-sm text-slate-800 truncate pr-4 group-hover:text-blue-600 transition-colors" title={b.title}>{b.title}</div>
                                  <div className="font-black text-sm text-slate-800 whitespace-nowrap">{formatRupiah(b.amount)}</div>
                               </div>
                               <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><CalendarClock size={12} className="text-slate-400" /> {new Date(b.date).toLocaleDateString('id-ID')}</span>
                                  <span className={`text-[9px] font-bold px-2 py-1 rounded-md tracking-wider uppercase ${b.hasPo ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                     {b.hasPo ? b.poNumber : 'NON-PO'}
                                  </span>
                               </div>
                            </div>
                         )) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8">
                               <span className="text-sm font-medium">Belum ada tagihan diinput.</span>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* TAB: INPUT TAGIHAN */}
            {activeTab === 'tab-input-tagihan' && (
              <div className="animate-tab">
                <form onSubmit={handleSaveBill} className="bg-white rounded-3xl border shadow-sm overflow-hidden mt-2">
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={!billForm.hasPo} 
                      onChange={(e) => setBillForm({
                        ...billForm, 
                        hasPo: !e.target.checked, 
                        poNumber: '', 
                        locationId: '', 
                        selectedPeriod: ''
                      })} 
                      className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                      id="non-po" 
                    />
                    <label htmlFor="non-po" className="font-bold text-slate-700 cursor-pointer">
                      Tagihan Non-PO (Pengecualian)
                    </label>
                    {!billForm.hasPo && <AlertTriangle className="text-rose-500 animate-pulse hidden sm:block ml-2" size={20} />}
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* BAGIAN REFERENSI PO (JIKA ADA) */}
                    {billForm.hasPo && (
                      <div className="p-5 rounded-xl bg-blue-50 border border-blue-100 space-y-4">
                        <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2 border-b border-blue-200/50 pb-2">
                          <Database size={16}/> Pemotongan Kuota & Referensi PO
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Cari Master PO</label>
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
                            <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Lokasi / Peruntukan</label>
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
                        </div>
                        
                        {/* TOMBOL OPSI PERIODE BULAN */}
                        {activeLocForBill?.generatedPeriods?.length > 0 && (
                          <div className="pt-2 animate-in fade-in zoom-in duration-300">
                            <label className="block text-xs font-bold text-slate-600 mb-2 flex justify-between">
                              <span>Pilih Opsi Periode Tagihan</span>
                              <span className="text-blue-600 font-medium">Progress: {activeLocForBill.usedQuota}/{activeLocForBill.totalQuota}</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {activeLocForBill.generatedPeriods.map((p, i) => {
                                const isUsed = i < activeLocForBill.usedQuota;
                                return (
                                  <label 
                                    key={i} 
                                    className={`cursor-pointer px-4 py-2 rounded-lg border text-sm transition-all shadow-sm
                                      ${isUsed ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 
                                      billForm.selectedPeriod === p ? 'bg-blue-600 text-white border-blue-600 font-bold scale-105' : 
                                      'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50 font-medium'}
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
                          const stats = getLocationStats(activeLocForBill);
                          if (stats.isShortageWarning) {
                            return (
                              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 animate-in fade-in zoom-in">
                                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                                <div>
                                  <h5 className="text-xs font-bold text-rose-800">Peringatan: Potensi Nilai PO Kurang!</h5>
                                  <p className="text-xs text-rose-600 mt-1">
                                    Sisa kuota tinggal 1 kali tagih, namun sisa saldo PO (<strong>{formatRupiah(stats.remainingValue)}</strong>) lebih kecil dari estimasi awal per bulan (<strong>{formatRupiah(stats.estimatedMonthly)}</strong>). Pastikan tagihan final tidak melebihi sisa saldo PO.
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}

                      </div>
                    )}
                    
                    {/* BAGIAN DATA INVOICE UMUM */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">Data Dokumen / Invoice</h4>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-12">
                          <label className="block text-xs font-bold text-slate-600 mb-1">Judul / Uraian Tagihan</label>
                          <input 
                            type="text" 
                            value={billForm.title} 
                            onChange={e => setBillForm({...billForm, title: e.target.value})} 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                            placeholder="Ketik uraian tagihan..." 
                          />
                        </div>
                        <div className="md:col-span-8">
                           <label className="block text-xs font-bold text-slate-600 mb-1">No. BAST (Opsional)</label>
                           <input 
                             type="text" 
                             value={billForm.noBast} 
                             onChange={e => setBillForm({...billForm, noBast: e.target.value})} 
                             className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                             placeholder="Misal: BAST/001/2026" 
                           />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                          <input 
                            type="text" 
                            value={billForm.amount} 
                            onChange={e => setBillForm({...billForm, amount: formatInputNumber(e.target.value)})} 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm font-bold text-slate-800" 
                            placeholder="0"
                          />
                        </div>
                        <div className="md:col-span-6">
                          <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Invoice</label>
                          <input 
                            type="date" 
                            value={billForm.date} 
                            onChange={e => setBillForm({...billForm, date: e.target.value})} 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm text-slate-700" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button 
                      type="submit" 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Save size={18}/> Simpan ke Database
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB: INPUT PO */}
            {activeTab === 'tab-input-po' && (
              <div className="animate-tab">
                <div className="flex justify-end mb-6">
                  {/* TOGGLE INPUT MODE */}
                  <div className="bg-slate-200 p-1.5 rounded-2xl flex gap-1 shadow-inner">
                    <button 
                      onClick={() => setInputMode('manual')} 
                      className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${inputMode === 'manual' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:bg-slate-300'}`}
                    >
                      Input Manual
                    </button>
                    <button 
                      onClick={() => setInputMode('excel')} 
                      className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${inputMode === 'excel' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:bg-slate-300'}`}
                    >
                      <FileSpreadsheet size={16}/> Import Excel
                    </button>
                  </div>
                </div>

                {/* MODE MANUAL PO */}
                {inputMode === 'manual' ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-blue-50/30 border-b border-slate-100">
                      <label className="block text-sm font-bold text-blue-900 mb-2">Nomor Induk PO</label>
                      <input 
                        type="text" 
                        value={manualForm.poNumber} 
                        onChange={e => setManualForm({...manualForm, poNumber: e.target.value})} 
                        className="w-full max-w-md px-3 py-2 rounded-lg border border-blue-200 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                        placeholder="Contoh: 416xxxxxxx" 
                      />
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h3 className="font-bold text-slate-700">Daftar Lokasi di bawah PO ini</h3>
                        <button 
                          onClick={() => setManualForm(p => ({
                            ...p, 
                            locations: [
                              ...p.locations,
                              {
                                id: `L-${Date.now()}`,
                                name: '',
                                value: '',
                                totalQuota: '',
                                startMonth: '',
                                billingType: 'partial'
                              }
                            ]
                          }))} 
                          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <Plus size={14}/> Tambah Baris
                        </button>
                      </div>
                      
                      {/* LOOPING INPUT LOKASI */}
                      {manualForm.locations.map((loc) => {
                           const previewMonths = (loc.startMonth && loc.totalQuota > 0 && loc.billingType === 'partial') 
                                ? generateMonthsArray(loc.startMonth, loc.totalQuota) : [];

                           return (
                        <div key={loc.id} className="p-5 rounded-xl border bg-slate-50/50 grid grid-cols-1 md:grid-cols-12 gap-4 relative group border-slate-200 shadow-sm">
                          <div className="md:col-span-5">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi</label>
                            <LocationAutocomplete 
                              value={loc.name} 
                              options={availableLocationNames} 
                              onChange={v => handleLocationChange(loc.id, 'name', v)} 
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nilai PO (Rp)</label>
                            <input 
                              type="text" 
                              value={loc.value} 
                              onChange={e => handleLocationChange(loc.id, 'value', formatInputNumber(e.target.value))} 
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm font-bold" 
                              placeholder="0"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Kuota (Bulan)</label>
                            <input 
                              type="number" 
                              value={loc.totalQuota} 
                              onChange={e => handleLocationChange(loc.id, 'totalQuota', e.target.value)} 
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                            />
                          </div>
                          <div className="md:col-span-2">
                             <label className="block text-xs font-bold text-slate-600 mb-1">Start Month</label>
                             <input 
                               type="month" 
                               value={loc.startMonth} 
                               onChange={e => handleLocationChange(loc.id, 'startMonth', e.target.value)} 
                               className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 text-sm" 
                             />
                          </div>
                          <button 
                            onClick={() => setManualForm(p => ({ 
                              ...p, 
                              locations: p.locations.filter(x => x.id !== loc.id)
                            }))} 
                            className="absolute -top-2 -right-2 bg-white text-rose-500 border border-rose-100 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                          >
                            <X size={14}/>
                          </button>
                        </div>
                      )})}
                    </div>
                    
                    <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50">
                      <button 
                        onClick={handleSaveManualPO} 
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                      >
                        <Save size={18}/> Simpan Data PO
                      </button>
                    </div>
                  </div>
                ) : (
                  
                  /* MODE EXCEL PO */
                  <div className="space-y-6 mt-2">
                    <div className="bg-white rounded-3xl border-2 border-dashed border-emerald-200 p-12 text-center relative overflow-hidden bg-emerald-50/20">
                      <UploadCloud size={48} className="mx-auto text-emerald-500 mb-4 opacity-40" />
                      <h3 className="text-xl font-bold mb-2">Unggah Excel Master PO</h3>
                      <p className="text-xs text-slate-400 mb-8 max-w-sm mx-auto">
                      
                      </p>
                      <div className="inline-block relative">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          accept=".xlsx, .xls" 
                          onChange={handleFileUpload} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        />
                        <div className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100">
                          <FileSpreadsheet size={20}/> Pilih File Dokumen
                        </div>
                      </div>
                    </div>
                    
                    {excelPreview && (
                      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                          <h3 className="font-bold text-sm">Preview Data Excel ({excelPreview.length} PO Terdeteksi)</h3>
                          <button onClick={() => setExcelPreview(null)} className="p-2 text-slate-400">
                            <X size={20}/>
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-500 uppercase font-black tracking-widest">
                              <tr>
                                <th className="px-6 py-4">No PO</th>
                                <th className="px-6 py-4">Daftar Lokasi & Nilai</th>
                                <th className="px-6 py-4">Kuota</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y border-t border-slate-100">
                              {excelPreview.map((p, i) => (
                                <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-6 py-5 font-black text-blue-600 text-sm align-top">{p.poNumber}</td>
                                  <td className="px-6 py-5 align-top">
                                    {p.locations.map((l, li) => (
                                      <div key={li} className="mb-2 last:mb-0">
                                        <span className="font-bold text-slate-700">{l.name}</span> 
                                        <span className="text-slate-400 text-[10px] ml-2">({formatRupiah(l.value)})</span>
                                      </div>
                                    ))}
                                  </td>
                                  <td className="px-6 py-5 align-top">
                                    {p.locations.map((l, li) => (
                                      <div key={li} className="mb-2 last:mb-0 font-bold text-slate-500">
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
                            className="bg-emerald-600 text-white font-black py-3 px-8 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700"
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

            {/* TAB: MASTER PO VIEW */}
            {activeTab === 'tab-master-po' && (
              <div className="animate-tab">
                {/* Search Bar untuk Master PO */}
                <div className="mb-6 flex items-center gap-4 mt-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                      <input 
                        type="text" 
                        value={searchPOQuery} 
                        onChange={e => setSearchPOQuery(e.target.value)} 
                        className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:ring-4 focus:ring-blue-100 outline-none bg-white font-medium" 
                        placeholder="Ketik Nomor PO untuk memunculkan data..." 
                      />
                    </div>
                </div>

                <div className="columns-1 md:columns-2 gap-6 space-y-6">
                  {filteredPOs.length > 0 ? (
                    filteredPOs.map(p => {
                      const isExpanded = expandedPOs[p.idDB];
                      return (
                        <div key={p.idDB} className="break-inside-avoid bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
                          <div 
                            onClick={() => togglePO(p.idDB)}
                            className="p-5 bg-slate-800 text-white flex justify-between items-center cursor-pointer select-none hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-sm">{p.poNumber}</span>
                              <span className="bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border border-slate-600">
                                {p.locations.length} Lokasi
                              </span>
                            </div>
                            <div className="text-slate-400">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="divide-y divide-slate-100 flex-1 animate-in fade-in slide-in-from-top-2 duration-200">
                              {p.locations.map(l => {
                                const s = getLocationStats(l);
                                const progress = (l.usedQuota / l.totalQuota) * 100;
                                return (
                                  <div key={l.id} className="p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-end mb-3">
                                      <div>
                                        <h5 className="font-semibold text-slate-800 text-sm">{l.name}</h5>
                                        <div className="text-xs text-slate-500 mt-1">
                                          Sisa Saldo: <span className={`font-bold ${s.isShortageWarning ? 'text-rose-600' : 'text-slate-700'}`}>{formatRupiah(s.remainingValue)}</span>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[11px] font-bold text-slate-500 mb-1.5">
                                          {l.usedQuota} dari {l.totalQuota} Tagihan
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-700 ${l.usedQuota === l.totalQuota ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${progress}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="break-inside-avoid p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl w-full">
                        {searchPOQuery.trim() === '' ? (
                           <>
                             <Search size={48} className="mx-auto mb-4 opacity-30" />
                             <p className="font-medium text-lg">Silakan ketik nomor PO di kolom pencarian.</p>
                             <p className="text-sm mt-2 opacity-70">Data PO hanya akan muncul saat dicari agar tampilan lebih rapi.</p>
                           </>
                        ) : (
                           <>
                             <AlertTriangle size={48} className="mx-auto mb-4 opacity-30 text-amber-500" />
                             <p className="font-medium text-lg">PO tidak ditemukan.</p>
                           </>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DATA TAGIHAN VIEW */}
            {activeTab === 'tab-data-tagihan' && (
              <div className="animate-tab flex flex-col h-full">
                {/* Header & Export Button */}
                <div className="flex flex-col sm:flex-row justify-end mb-6 gap-4 mt-2">
                  <button 
                    onClick={handleExportExcel} 
                    className="bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 text-sm shadow-md hover:bg-emerald-700 transition-colors"
                  >
                    <Download size={16}/> Export ke Excel
                  </button>
                </div>
                
                {/* TOOLBAR */}
                <div className="mb-6 flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-3.5 text-slate-400"/>
                    <input 
                      type="text" 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-sm focus:ring-4 focus:ring-blue-100 outline-none bg-white font-medium" 
                      placeholder="Cari Uraian atau PO..." 
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative">
                      <input 
                        type="date" 
                        value={filterDate} 
                        onChange={e => setFilterDate(e.target.value)} 
                        className="w-full sm:w-auto pl-4 pr-10 py-3 rounded-2xl border border-slate-200 text-sm focus:ring-4 focus:ring-blue-100 outline-none bg-white text-slate-600 font-medium"
                      />
                      {filterDate && (
                        <button 
                          onClick={() => setFilterDate('')} 
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-rose-500"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {/* PILL TABS FILTER STATUS */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto scrollbar-hide flex-shrink-0">
                      <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${filterStatus === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semua Status</button>
                      <button onClick={() => setFilterStatus('berjalan')} className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${filterStatus === 'berjalan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Berjalan</button>
                      <button onClick={() => setFilterStatus('backdate')} className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${filterStatus === 'backdate' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Backdate</button>
                      <button onClick={() => setFilterStatus('non-po')} className={`px-4 py-2 text-sm font-bold rounded-xl whitespace-nowrap transition-all ${filterStatus === 'non-po' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Non-PO</button>
                    </div>
                  </div>
                </div>
                
                {/* DAFTAR DATA BERGAYA KARTU */}
                <div className="space-y-4 pb-8">
                  {currentBills.map(b => {
                    const isBackdate = b.year < currentYear;
                    
                    return (
                      <div key={b.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col md:flex-row md:items-center gap-4 relative overflow-hidden group">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${!b.hasPo ? 'bg-rose-500' : (isBackdate ? 'bg-amber-400' : 'bg-emerald-500')}`}></div>
                        
                        <div className="flex-1 pl-2">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                              <CalendarClock size={14}/> {new Date(b.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${isBackdate ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {isBackdate ? 'BACKDATE' : 'BERJALAN'}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-slate-800 text-lg mb-3 leading-tight pr-4">{b.title}</h4>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                            {b.hasPo ? (
                              <>
                                <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100">
                                  <Database size={14} /> {b.poNumber}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                  <MapPin size={14} className="text-slate-400" /> {b.locationName || 'Lokasi terhapus'}
                                </span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-100">
                                <AlertTriangle size={14} /> PENDING NON-PO
                              </span>
                            )}

                            {b.period && (
                              <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                <Clock size={14} className="text-slate-400"/> {b.period}
                              </span>
                            )}

                            {b.noBast && b.noBast !== '-' && (
                              <span className="flex items-center gap-1.5 font-mono bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                                <FileText size={14} className="text-slate-400"/> BAST: {b.noBast}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 pr-2">
                          <div className="text-left md:text-right">
                            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Nilai Tagihan</span>
                            <span className="block text-xl font-black text-slate-800">{formatRupiah(b.amount)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditClick(b)} 
                              className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                              title="Edit Tagihan"
                            >
                              <Edit size={14} /> Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteBill(b.id)} 
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                              title="Hapus Tagihan"
                            >
                              <Trash2 size={14} /> Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredBills.length === 0 && (
                    <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl">
                      <Search size={40} className="mx-auto mb-4 opacity-30" />
                      <p className="font-medium text-lg text-slate-500">Data tagihan tidak ditemukan.</p>
                      <p className="text-sm mt-1 opacity-70">Coba sesuaikan kata kunci pencarian atau filter tahun.</p>
                    </div>
                  )}

                  {/* PAGINATION CONTROLS */}
                  {filteredBills.length > 0 && (
                    <div className="pt-6 border-t border-slate-200 mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="text-xs text-slate-500 font-medium">
                        Menampilkan {indexOfFirstBill + 1} - {Math.min(indexOfLastBill, filteredBills.length)} dari {filteredBills.length} dokumen tagihan.
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          
                          {getPageNumbers().map(number => (
                            <button
                              key={number}
                              onClick={() => setCurrentPage(number)}
                              className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                                currentPage === number 
                                  ? 'bg-blue-600 text-white shadow-md' 
                                  : 'text-slate-600 hover:bg-blue-50 border border-transparent'
                              }`}
                            >
                              {number}
                            </button>
                          ))}

                          <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function SidebarButton({ id, icon, label, activeTab, onClick }) {
  const active = activeTab === id;
  return (
    <button 
      onClick={() => onClick(id)} 
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl w-full transition-all duration-300 
        ${active 
          ? 'bg-blue-600 text-white font-bold shadow-xl shadow-blue-900/50 translate-x-1' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
        }`}
    >
      {icon} <span className="text-xs uppercase tracking-wider">{label}</span>
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
      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
      <input 
        type="text" 
        value={value} 
        onChange={e => { onChange(e.target.value); setOpen(true); }} 
        onFocus={() => setOpen(true)} 
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
        placeholder="Ketik lokasi..." 
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto main-scroll">
          {filtered.map((x, i) => (
            <li 
              key={i} 
              onClick={() => { onChange(x); setOpen(false); }} 
              className="px-5 py-3 text-sm hover:bg-blue-50 cursor-pointer font-bold text-slate-700 border-b border-slate-50 last:border-0"
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
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
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
                className="px-5 py-3 text-sm font-black text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
              >
                {x}
              </li>
            ))
          ) : (
            <li className="px-5 py-3 text-xs italic text-slate-400">PO tidak ditemukan</li>
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
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-300" 
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
                className={`px-5 py-3 text-xs font-bold border-b border-slate-50 last:border-0 
                  ${x.disabled 
                    ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                    : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer'
                  }`}
              >
                {x.label}
              </li>
            ))
          ) : (
            <li className="px-5 py-3 text-xs italic text-slate-400">Tidak ditemukan</li>
          )}
        </ul>
      )}
    </div>
  );
}
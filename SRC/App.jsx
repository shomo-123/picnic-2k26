import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc,
  getDoc
} from "firebase/firestore";
import { 
  Wallet, Users, Receipt, Plus, Trash2, CreditCard, Banknote, 
  Calculator, RotateCcw, CheckCircle2, Sparkles, TrendingUp, 
  ArrowRight, Share2, LayoutDashboard, MessageCircle, Edit2, 
  Save, X, UserPlus, Lock, Link as LinkIcon
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBeHLGmFOEzwCIalqG42T9QiC8B8Z0wQp0",
  authDomain: "picnic2k26.firebaseapp.com",
  projectId: "picnic2k26",
  storageBucket: "picnic2k26.firebasestorage.app",
  messagingSenderId: "584914852010",
  appId: "1:584914852010:web:182b35dff14db4826798d3",
  measurementId: "G-4SL9F6529D"
};

// Initialize Firebase (Safe check for valid config)
const app = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

const PicnicApp = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data State
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  // Settings State
  const [calculationMode, setCalculationMode] = useState('auto');
  const [fixedRate, setFixedRate] = useState(0);

  // Forms
  const [expenseForm, setExpenseForm] = useState({ desc: '', amount: '' });
  const [participantForm, setParticipantForm] = useState({ name: '', amount: '', mode: 'online', count: 1 });

  // Security & Editing
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [toast, setToast] = useState(null);

  // --- Initialization ---
  useEffect(() => {
    // 1. Get or Create Room ID
    const params = new URLSearchParams(window.location.search);
    let id = params.get('room');
    if (!id) {
      id = 'trip-' + Math.random().toString(36).substring(2, 8);
      try {
        const newUrl = `${window.location.pathname}?room=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
      } catch (e) { console.log("URL update skipped in sandbox"); }
    }
    setRoomId(id);
  }, []);

  // --- Real-time Sync ---
  useEffect(() => {
    if (!roomId || !db) return;

    setLoading(true);

    // Sync Expenses
    const qExp = query(collection(db, "picnics", roomId, "expenses"), orderBy("createdAt", "desc"));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Sync Participants
    const qPart = query(collection(db, "picnics", roomId, "participants"), orderBy("createdAt", "desc"));
    const unsubPart = onSnapshot(qPart, (snapshot) => {
      setParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Sync Settings
    const unsubSettings = onSnapshot(doc(db, "picnics", roomId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.calculationMode) setCalculationMode(data.calculationMode);
        if (data.fixedRate) setFixedRate(data.fixedRate);
      }
    });

    setLoading(false);
    return () => { unsubExp(); unsubPart(); unsubSettings(); };
  }, [roomId]);

  // --- Derived Calculations ---
  const totalExpenses = useMemo(() => expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0), [expenses]);
  const totalCollected = useMemo(() => participants.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [participants]);
  
  const totalCash = useMemo(() => participants.filter(p => p.mode === 'cash').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [participants]);
  const totalOnline = useMemo(() => participants.filter(p => p.mode === 'online').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [participants]);

  const totalHeadCount = useMemo(() => participants.reduce((sum, p) => sum + (parseInt(p.count) || 1), 0), [participants]);

  const costPerPerson = useMemo(() => {
    if (calculationMode === 'fixed') return fixedRate;
    if (totalHeadCount === 0) return 0;
    return totalExpenses / totalHeadCount;
  }, [totalExpenses, totalHeadCount, calculationMode, fixedRate]);

  const balance = totalCollected - totalExpenses;

  // --- Security ---
  const requestVerification = (actionCallback) => {
    setPendingAction(() => actionCallback);
    setSecurityCode('');
    setSecurityError('');
    setIsSecurityModalOpen(true);
  };

  const handleVerify = (e) => {
    e.preventDefault();
    if (securityCode === "4670") {
      setIsSecurityModalOpen(false);
      setToast({ message: "Verified", type: 'success' });
      if (pendingAction) pendingAction();
      setPendingAction(null);
    } else {
      setSecurityError("Incorrect Code");
      setSecurityCode('');
    }
  };

  // --- Database Actions ---
  const updateSettings = async (updates) => {
    if (!db || !roomId) return;
    try {
      await setDoc(doc(db, "picnics", roomId), updates, { merge: true });
    } catch (e) { console.error(e); }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.desc || !expenseForm.amount) return;
    try {
      await addDoc(collection(db, "picnics", roomId, "expenses"), {
        desc: expenseForm.desc,
        amount: parseFloat(expenseForm.amount),
        createdAt: Date.now()
      });
      setExpenseForm({ desc: '', amount: '' });
      setToast({ message: "Expense added!", type: 'success' });
    } catch (e) { setToast({ message: "Error adding expense", type: 'error' }); }
  };

  const removeExpense = (id) => {
    requestVerification(async () => {
      if (window.confirm("Delete this expense?")) {
        await deleteDoc(doc(db, "picnics", roomId, "expenses", id));
      }
    });
  };

  const addParticipant = async (e) => {
    e.preventDefault();
    if (!participantForm.name) return;
    try {
      await addDoc(collection(db, "picnics", roomId, "participants"), {
        name: participantForm.name,
        amount: parseFloat(participantForm.amount) || 0,
        mode: participantForm.mode,
        count: parseInt(participantForm.count) || 1,
        createdAt: Date.now()
      });
      setParticipantForm({ name: '', amount: '', mode: 'online', count: 1 });
      setToast({ message: "Participant added!", type: 'success' });
    } catch (e) { setToast({ message: "Error adding participant", type: 'error' }); }
  };

  const removeParticipant = (id) => {
    requestVerification(async () => {
      if (window.confirm("Remove this participant?")) {
        await deleteDoc(doc(db, "picnics", roomId, "participants", id));
      }
    });
  };

  const saveEdit = async () => {
    const amount = parseFloat(editFormData.amount);
    if (!editFormData.id || isNaN(amount)) return;

    try {
      if (editingType === 'expense') {
        await updateDoc(doc(db, "picnics", roomId, "expenses", editingId), {
          desc: editFormData.desc,
          amount: amount
        });
      } else {
        await updateDoc(doc(db, "picnics", roomId, "participants", editingId), {
          name: editFormData.name,
          amount: amount,
          mode: editFormData.mode,
          count: parseInt(editFormData.count) || 1
        });
      }
      setToast({ message: "Updated successfully!", type: 'success' });
      setEditingId(null);
      setEditingType(null);
    } catch (e) { setToast({ message: "Update failed", type: 'error' }); }
  };

  const resetAll = () => {
    requestVerification(async () => {
      if(window.confirm("Reset ALL data for everyone?")) {
        // Quick way to reset: delete docs (or in real app, just change room ID)
        // For simplicity, we just reload to a new room here
        const newId = 'trip-' + Math.random().toString(36).substring(2, 8);
        window.location.href = `?room=${newId}`;
      }
    });
  };

  const changeCalculationMode = (mode) => {
    if (calculationMode === mode) return;
    requestVerification(() => updateSettings({ calculationMode: mode }));
  };

  const handleFixedRateChange = (val) => {
    setFixedRate(val); // Local update for UI smoothness
    // Debounce or save on blur in real app, here we verify first
  };

  const saveFixedRate = () => {
    updateSettings({ fixedRate: parseFloat(fixedRate) || 0 });
  };

  // --- Sharing ---
  const generateSummaryText = () => {
    if (participants.length === 0 && expenses.length === 0) return null;
    const expenseListText = expenses.length > 0 ? expenses.map(e => `• ${e.desc}: ₹${e.amount.toLocaleString()}`).join('\n') : 'No expenses added.';
    const summaryList = participants.map((p, i) => {
      const userHeadCount = p.count || 1;
      const due = (costPerPerson * userHeadCount) - p.amount;
      let status = Math.abs(due) < 0.1 ? '✅ Settled' : due > 0 ? `❌ Due: ₹${due.toFixed(0)}` : `💰 Refund: ₹${Math.abs(due).toFixed(0)}`;
      return `${i+1}. ${p.name}${userHeadCount > 1 ? ` (${userHeadCount} ppl)` : ''}: Paid ₹${p.amount} (${status})`;
    }).join('\n');
    return `🧺 *Picnic 2K26 Summary* 🧺\n\n💰 *Total Expense: ₹${totalExpenses.toLocaleString()}*\n\n*📝 Expense Details:*\n${expenseListText}\n\n------------------\n\n👥 Cost Per Head: ₹${costPerPerson.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n👨‍👩‍👧‍👦 Total Heads: ${totalHeadCount}\n\n*Participant Status:*\n${summaryList}\n\n*Net Balance:* ${balance >= 0 ? '+' : ''}₹${balance.toLocaleString()}\n\nGenerated by Picnic 2K26`;
  };

  const handleShare = async () => {
    const text = generateSummaryText();
    if (!text) return setToast({ message: "Add data first!", type: 'neutral' });
    try {
      if (navigator.share) await navigator.share({ title: 'Picnic 2K26', text });
      else {
        await navigator.clipboard.writeText(text);
        setToast({ message: "Copied to clipboard!", type: 'success' });
      }
    } catch (e) { console.error(e); }
  };

  const handleWhatsApp = () => {
    const text = generateSummaryText();
    if (!text) return setToast({ message: "Add data first!", type: 'neutral' });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setToast({ message: "Link copied! Send to friends.", type: 'success' });
  };

  if (!db) return <div className="p-10 text-center">⚠️ Firebase Config Missing. Please check App.jsx</div>;

  // --- Render ---
  return (
    <div className="min-h-screen bg-[#F0F4F8] font-sans text-slate-800 pb-24 lg:pb-10 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-[30vh] lg:h-96 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-b-[40px] shadow-2xl z-0" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6 lg:pt-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 lg:mb-10 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md shadow-inner border border-white/10">
              <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-300" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Picnic 2K26</h1>
              <p className="text-indigo-100 text-xs lg:text-sm font-medium opacity-90 flex items-center gap-1">
                Room: {roomId ? roomId.split('-')[1] : '...'} 
                <button onClick={handleCopyLink} className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] hover:bg-white/30 ml-1">Copy Link</button>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleWhatsApp} className="p-2.5 rounded-xl bg-white/10 hover:bg-emerald-500/50 backdrop-blur-sm border border-white/20"><MessageCircle className="w-5 h-5" /></button>
            <button onClick={handleShare} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"><Share2 className="w-5 h-5" /></button>
            <button onClick={resetAll} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"><RotateCcw className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Stats */}
        <div className={`mb-6 lg:mb-10 ${activeTab === 'dashboard' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex lg:grid lg:grid-cols-4 gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 lg:pb-0 [&::-webkit-scrollbar]:hidden -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="min-w-[85vw] sm:min-w-[45vw] lg:min-w-0 snap-center bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Expense</div>
              <div className="text-3xl font-black text-slate-800 flex items-center gap-2">₹{totalExpenses.toLocaleString()}</div>
            </div>
            <div className="min-w-[85vw] sm:min-w-[45vw] lg:min-w-0 snap-center bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Income</div>
              <div className="text-3xl font-black text-slate-800 flex items-center gap-2">₹{totalCollected.toLocaleString()}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold">
                <div className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md"><Banknote className="w-3 h-3 mr-1" /> ₹{totalCash.toLocaleString()}</div>
                <div className="flex items-center text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md"><CreditCard className="w-3 h-3 mr-1" /> ₹{totalOnline.toLocaleString()}</div>
              </div>
            </div>
            <div className="min-w-[85vw] sm:min-w-[45vw] lg:min-w-0 snap-center bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Cost Per Head</div>
              <div className="text-3xl font-black text-slate-800 flex items-center gap-2">₹{costPerPerson.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="mt-3 flex items-center text-xs text-purple-500 font-medium"><Users className="w-3.5 h-3.5 mr-1.5" /> {totalHeadCount} Heads</div>
            </div>
            <div className={`min-w-[85vw] sm:min-w-[45vw] lg:min-w-0 snap-center rounded-2xl p-5 shadow-lg relative overflow-hidden text-white ${balance >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'}`}>
              <div className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Net Balance</div>
              <div className="text-3xl font-black flex items-center gap-2">{balance >= 0 ? '+' : ''}₹{Math.abs(balance).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Expenses */}
          <div className={`lg:col-span-5 space-y-4 lg:space-y-6 ${activeTab === 'expenses' || activeTab === 'dashboard' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-1.5">
              <div className="flex bg-slate-100/50 p-1 rounded-xl">
                <button onClick={() => changeCalculationMode('auto')} className={`flex-1 flex items-center justify-center py-2 px-3 text-xs lg:text-sm font-bold rounded-lg transition-all ${calculationMode === 'auto' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:bg-white/50'}`}><Calculator className="w-3.5 h-3.5 mr-1.5" /> Auto</button>
                <button onClick={() => changeCalculationMode('fixed')} className={`flex-1 flex items-center justify-center py-2 px-3 text-xs lg:text-sm font-bold rounded-lg transition-all ${calculationMode === 'fixed' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:bg-white/50'}`}><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Fixed</button>
              </div>
              {calculationMode === 'fixed' && (
                <div className="p-3 animate-in fade-in slide-in-from-top-2 relative group" onClick={() => !isSettingsUnlocked && requestVerification(() => setIsSettingsUnlocked(true))}>
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input type="number" inputMode="decimal" value={fixedRate} readOnly={!isSettingsUnlocked} onChange={(e) => handleFixedRateChange(e.target.value)} onBlur={saveFixedRate} className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-lg font-bold rounded-xl py-2.5 pl-8 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
                  {!isSettingsUnlocked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[65vh] lg:h-[500px]">
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex justify-between">Expenses <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-xs">{expenses.length}</span></h2>
                <form onSubmit={addExpense} className="flex gap-2">
                  <input type="text" placeholder="Item" value={expenseForm.desc} onChange={(e) => setExpenseForm({...expenseForm, desc: e.target.value})} className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
                  <input type="number" placeholder="0" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-20 bg-slate-50 border-none rounded-xl px-2 py-3 text-center text-sm font-bold" />
                  <button type="submit" className="bg-rose-500 text-white p-3 rounded-xl shadow-lg active:scale-90"><Plus className="w-5 h-5" /></button>
                </form>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center p-3.5 bg-white border border-slate-100 rounded-2xl">
                    {editingId === exp.id && editingType === 'expense' ? (
                      <div className="flex-1 flex gap-2 items-center">
                        <input type="text" className="flex-1 bg-slate-100 rounded-lg px-2 py-1 text-sm" value={editFormData.desc} onChange={e => setEditFormData({...editFormData, desc: e.target.value})} />
                        <input type="number" className="w-20 bg-slate-100 rounded-lg px-2 py-1 text-sm" value={editFormData.amount} onChange={e => setEditFormData({...editFormData, amount: e.target.value})} />
                        <button onClick={saveEdit} className="text-emerald-600"><Save className="w-4 h-4" /></button>
                        <button onClick={() => {setEditingId(null); setEditingType(null)}} className="text-slate-500"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3"><Receipt className="w-4 h-4 text-rose-500" /><span className="font-semibold text-slate-700 text-sm">{exp.desc}</span></div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">₹{exp.amount}</span>
                          <button onClick={() => requestVerification(() => { setEditingType('expense'); setEditingId(exp.id); setEditFormData({...exp}); })} className="text-slate-300 hover:text-indigo-500"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => removeExpense(exp.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className={`lg:col-span-7 ${activeTab === 'participants' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[75vh] lg:h-[650px]">
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 z-10">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-800">Participants</h2>
                  <div className="flex gap-2"><span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold">{participants.length} Entries</span></div>
                </div>
                <form onSubmit={addParticipant} className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder={`Name (#${participants.length + 1})`} value={participantForm.name} onChange={(e) => setParticipantForm({...participantForm, name: e.target.value})} className="flex-1 bg-slate-50 border-none rounded-xl pl-4 py-3 text-sm font-bold" />
                    <div className="relative w-16"><div className="absolute left-2 top-3 text-slate-400"><UserPlus className="w-3 h-3" /></div><input type="number" min="1" placeholder="1" value={participantForm.count} onChange={(e) => setParticipantForm({...participantForm, count: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl pl-6 pr-2 py-3 text-sm font-bold text-center" /></div>
                    <div className="relative w-24"><div className="absolute left-3 top-3 text-slate-400 font-bold">₹</div><input type="number" placeholder="0" value={participantForm.amount} onChange={(e) => setParticipantForm({...participantForm, amount: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl pl-7 pr-3 py-3 text-sm font-bold" /></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex bg-slate-50 p-1 rounded-xl flex-1">
                      <button type="button" onClick={() => setParticipantForm({...participantForm, mode: 'online'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${participantForm.mode === 'online' ? 'bg-white shadow' : 'text-slate-400'}`}>Online</button>
                      <button type="button" onClick={() => setParticipantForm({...participantForm, mode: 'cash'})} className={`flex-1 py-2 rounded-lg text-xs font-bold ${participantForm.mode === 'cash' ? 'bg-white shadow' : 'text-slate-400'}`}>Cash</button>
                    </div>
                    <button type="submit" className="px-5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-95"><ArrowRight className="w-5 h-5" /></button>
                  </div>
                </form>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {participants.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60"><Users className="w-16 h-16 mb-4 stroke-1" /><p className="text-sm font-medium">Add friends to start</p></div> : participants.map((p, index) => {
                  const userHeadCount = p.count || 1;
                  const due = (costPerPerson * userHeadCount) - p.amount;
                  return (
                    <div key={p.id} className="relative bg-white rounded-2xl p-4 border border-slate-100 shadow-sm overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${due > 0 ? 'bg-rose-400' : Math.abs(due) < 0.1 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <div className="flex items-center justify-between pl-3">
                        {editingId === p.id && editingType === 'participant' ? (
                          <div className="flex-1 flex gap-2 items-center z-10 relative">
                            <input type="text" className="flex-1 bg-slate-100 rounded-lg px-2 py-2 text-sm" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} autoFocus />
                            <input type="number" className="w-12 bg-slate-100 rounded-lg px-1 py-2 text-sm text-center" value={editFormData.count} onChange={e => setEditFormData({...editFormData, count: e.target.value})} />
                            <input type="number" className="w-20 bg-slate-100 rounded-lg px-2 py-2 text-sm text-center" value={editFormData.amount} onChange={e => setEditFormData({...editFormData, amount: e.target.value})} />
                            <button onClick={saveEdit} className="text-emerald-600"><Save className="w-3 h-3" /></button>
                            <button onClick={() => {setEditingId(null); setEditingType(null)}} className="text-slate-500"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 font-mono text-xs font-bold w-5">{index + 1}.</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-slate-800 text-sm">{p.name}</h3>
                                  {(p.count || 1) > 1 && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center"><Users className="w-2.5 h-2.5 mr-1" /> {p.count}</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5"><span className="text-[9px] font-bold uppercase border px-1 rounded">{p.mode}</span><span className="text-[10px] text-slate-400 font-medium">Paid: ₹{p.amount}</span></div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {Math.abs(due) < 0.1 ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Settled</span> : due > 0 ? <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Due: {due.toFixed(0)}</span> : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Refund: {Math.abs(due).toFixed(0)}</span>}
                              <div className="flex items-center gap-1">
                                <button onClick={() => requestVerification(() => { setEditingType('participant'); setEditingId(p.id); setEditFormData({...p}); })} className="text-slate-300 hover:text-indigo-500 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => removeParticipant(p.id)} className="text-slate-300 hover:text-rose-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="text-center mb-6"><div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3 text-rose-600"><Lock className="w-6 h-6" /></div><h3 className="text-lg font-bold text-slate-800">Security Check</h3></div>
            <form onSubmit={handleVerify}>
              <div className="mb-5">
                <input type="password" inputMode="numeric" value={securityCode} onChange={(e) => {setSecurityCode(e.target.value); setSecurityError('')}} className={`w-full text-center text-3xl font-bold tracking-[0.5em] py-3 border-2 rounded-xl focus:ring-0 outline-none ${securityError ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200'}`} placeholder="••••" autoFocus maxLength={4} />
                {securityError && <p className="text-rose-500 text-xs text-center mt-2 font-bold">{securityError}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => {setIsSecurityModalOpen(false); setPendingAction(null)}} className="py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="py-3 font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg">Verify</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl z-[60]">{toast.message}</div>}
      
      {/* Mobile Nav */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 pb-safe lg:hidden z-50">
        <div className="flex justify-around items-center px-2">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center py-3 w-full ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}><LayoutDashboard className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Overview</span></button>
          <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center py-3 w-full ${activeTab === 'expenses' ? 'text-indigo-600' : 'text-slate-400'}`}><Receipt className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Expenses</span></button>
          <button onClick={() => setActiveTab('participants')} className={`flex flex-col items-center py-3 w-full ${activeTab === 'participants' ? 'text-indigo-600' : 'text-slate-400'}`}><Users className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">People</span></button>
        </div>
      </div>
    </div>
  );
};

export default PicnicApp;
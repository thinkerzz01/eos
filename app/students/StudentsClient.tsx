'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { useToast } from '@/components/ui/Toast';
import { Student, EnrolledSubject } from '@/lib/mockStudentsData';
import { ALL_PROGRAMS, EXAM_SESSIONS } from '@/lib/syllabiSeed';
import { bulkCreateStudents, updateStudent, softDeleteStudent, markStudentPassout, bulkDeleteStudents, bulkSetFeeStatus, bulkSetStatus, bulkSetProgram } from './actions';
import { ResetPasswordControl } from '@/components/account/ResetPasswordControl';
import { RowActionsMenu } from '@/components/ui/RowActionsMenu';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KeyRound } from 'lucide-react';
import { OnboardStudentModal } from '@/components/students/OnboardStudentModal';
import {
  Users,
  UserCheck,
  AlertTriangle,
  Receipt,
  Calendar,
  UserPlus,
  Sparkles,
  Search,
  Filter,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Download,
  Upload,
  Settings,
  Plus,
  CheckSquare,
  Star,
  ArrowUpRight,
  TrendingUp,
  Clock,
  DollarSign,
  BookOpen,
  Tag,
  Trash2,
  GraduationCap,
  Archive,
  Paperclip,
  ExternalLink,
  Eye,
  User,
  UserCog,
  Edit3,
  Video,
  FilePlus,
  CalendarPlus,
  CreditCard,
  PenTool,
  Award,
  CheckCircle2,
  Flame,
  Wallet,
  ShieldCheck,
  RefreshCw,
  QrCode,
  HardDrive,
  Check,
  RotateCcw,
  Save,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

const ALL_SUBJECTS_LIST = [
  'All Subjects',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Urdu',
  'Computer Science',
  'Economics',
  'Accounting',
  'Further Math',
  'Organic Chem',
  'Business Studies',
  'Sociology',
  'Psychology',
  'Islamiyat',
  'Pakistan Studies',
];

const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-emerald-100 text-emerald-700',
  'bg-[#EEEBFB] text-[#5B47D6]',
];

interface SavedView {
  id: string;
  name: string;
  status: string;
  program: string;
  subject: string;
  risk: string;
  minAttendance: number;
}

export function StudentsClient({ initialStudents }: { initialStudents: Student[] }) {
  const { role } = useRole();
  const { showToast } = useToast();

  // Copy the public onboarding link for a student so the admin can send it (e.g.
  // over WhatsApp). The student opens it to complete their fuller record.
  const copyOnboardingLink = async (studentId: string) => {
    const url = `${window.location.origin}/onboarding/${studentId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Admission form link copied - send it to the student.', 'success');
    } catch {
      showToast(url, 'success');
    }
  };

  // Seeded from the server (real, RLS-authorized DB rows). Local edits/CSV
  // import still mutate this client copy until those actions are wired to the DB.
  const [studentsData, setStudentsData] = useState<Student[]>(initialStudents);

  const router = useRouter();

  // Keep the table in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setStudentsData(initialStudents); }, [initialStudents]);

  // STATUS TABS STATE
  const [activeTabStatus, setActiveTabStatus] = useState<string>('All Students');
  
  // PRIMARY FILTERS STATE
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('All Programs');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('All Teachers');
  const [selectedFeeStatus, setSelectedFeeStatus] = useState<string>('All Statuses');
  
  // TOGGLE STATES
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showSavedViewsMenu, setShowSavedViewsMenu] = useState<boolean>(false);
  const [showSaveViewModal, setShowSaveViewModal] = useState<boolean>(false);
  const [newViewName, setNewViewName] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showOnboard, setShowOnboard] = useState<boolean>(false);
  const [showAiInsightsModal, setShowAiInsightsModal] = useState<boolean>(false);

  // IMPORT FILE & PREVIEW STATE
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importedRows, setImportedRows] = useState<any[]>([]);

  // TIMELINE ACTIVE FILTER STATE
  const [timelineActivityType, setTimelineActivityType] = useState<string>('All Activities');

  // SAVED VIEWS LIST STATE
  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: 'v1', name: 'All Active Students', status: 'Active', program: 'All Programs', subject: 'All Subjects', risk: 'All Tiers', minAttendance: 0 },
    { id: 'v2', name: 'At-Risk Critical Students', status: 'All Students', program: 'All Programs', subject: 'All Subjects', risk: 'Red (Critical)', minAttendance: 0 },
    { id: 'v3', name: 'Fees Overdue & Grace', status: 'All Students', program: 'All Programs', subject: 'All Subjects', risk: 'All Tiers', minAttendance: 0 },
    { id: 'v4', name: 'Alumni / Passout', status: 'Passout / Alumni', program: 'All Programs', subject: 'All Subjects', risk: 'All Tiers', minAttendance: 0 },
    { id: 'v5', name: 'Demo Trial Students', status: 'Demo', program: 'All Programs', subject: 'All Subjects', risk: 'All Tiers', minAttendance: 0 },
  ]);

  // RICH ADVANCED FILTERS STATE
  const [minAttendanceFilter, setMinAttendanceFilter] = useState<number>(0);
  const [minHomeworkFilter, setMinHomeworkFilter] = useState<number>(0);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('All Tiers');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('All Genders');
  const [subjectCountFilter, setSubjectCountFilter] = useState<string>('All');

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // BULK SELECTION STATE
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // CENTER POP-UP MODAL STATE FOR STUDENT PROFILE
  const [profileModalStudent, setProfileModalStudent] = useState<Student | null>(null);
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<
    'Overview' | 'Academics' | 'Attendance' | 'Finance' | 'Timeline'
  >('Overview');

  // PROFILE EDIT MODE STATE
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  // PREVENT BACKGROUND SCROLL WHEN MODAL IS OPEN
  useEffect(() => {
    if (profileModalStudent || showAiInsightsModal || showImportModal || showSaveViewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [profileModalStudent, showAiInsightsModal, showImportModal, showSaveViewModal]);

  const resetAllFilters = () => {
    setActiveTabStatus('All Students');
    setSearchQuery('');
    setSelectedProgram('All Programs');
    setSelectedSubject('All Subjects');
    setSelectedTeacher('All Teachers');
    setSelectedFeeStatus('All Statuses');
    setMinAttendanceFilter(0);
    setMinHomeworkFilter(0);
    setSelectedRiskLevel('All Tiers');
    setSelectedGenderFilter('All Genders');
    setSubjectCountFilter('All');
    setCurrentPage(1);
  };

  const applySavedView = (view: SavedView) => {
    setActiveTabStatus(view.status);
    setSelectedProgram(view.program);
    setSelectedSubject(view.subject);
    setSelectedRiskLevel(view.risk);
    setMinAttendanceFilter(view.minAttendance);
    setShowSavedViewsMenu(false);
    setCurrentPage(1);
  };

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: `⭐ ${newViewName}`,
      status: activeTabStatus,
      program: selectedProgram,
      subject: selectedSubject,
      risk: selectedRiskLevel,
      minAttendance: minAttendanceFilter,
    };
    setSavedViews([...savedViews, newView]);
    setNewViewName('');
    setShowSaveViewModal(false);
  };

  const handleSaveProfileChanges = async () => {
    if (!profileModalStudent || !editFormData) return;
    const res = await updateStudent({
      id: profileModalStudent.id,
      name: editFormData.name,
      parentName: editFormData.parentName,
      parentPhone: editFormData.parentPhone,
      program: editFormData.program,
      feeStatus: editFormData.feeStatus as string | undefined,
      email: editFormData.parentEmail,
      whatsapp: editFormData.whatsapp,
      city: editFormData.city,
      address: editFormData.address,
      gender: editFormData.gender,
      examSession: editFormData.examSession,
      monthlyFee: editFormData.monthlyFee,
      nextDueDate: editFormData.nextDueDate,
      dob: editFormData.dob,
    });
    if (!res.ok) {
      alert(res.error ?? 'Failed to save changes.');
      return;
    }
    // Reflect the edit locally, then refetch the authoritative row from the DB.
    setProfileModalStudent({ ...profileModalStudent, ...editFormData } as Student);
    setIsEditMode(false);
    router.refresh();
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student record? This action will be logged.')) return;
    const res = await softDeleteStudent(id);
    if (!res.ok) {
      alert(res.error ?? 'Failed to delete student.');
      return;
    }
    if (profileModalStudent?.id === id) setProfileModalStudent(null);
    router.refresh();
  };

  // MARK A STUDENT AS PASSED OUT (alumni) - keeps the record, drops them from active.
  const handlePassoutStudent = async (s: Student) => {
    if (!confirm(`Mark ${s.name} as passed out?\n\nThey move to Alumni / Passout and leave the active roster. You can reactivate them later from Edit Profile.`)) return;
    const res = await markStudentPassout(s.id);
    if (!res.ok) {
      alert(res.error ?? 'Failed to mark the student as passed out.');
      return;
    }
    router.refresh();
  };

  // DOWNLOAD SAMPLE CSV TEMPLATE
  const handleDownloadSampleCsv = () => {
    const sampleHeaders = "STU ID,Full Name,Program,Grade,Parent Name,Parent Phone,Parent Email,Fee Status,Attendance %,Performance Score\n";
    const sampleRows = 
      `"STU-00901","Zayn Malik","O Level","Grade 10","Mr. Malik","0300-1122334","malik@example.com","Paid",92,88\n` +
      `"STU-00902","Anaya Khan","A Level","Grade 12","Mr. Khan","0321-4455667","khan@example.com","Due",85,76\n` +
      `"STU-00903","Hamza Shah","IGCSE","Grade 9","Mr. Shah","0333-7788990","shah@example.com","In Grace",78,64\n`;

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Thinkerzz_Sample_Students_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // HANDLE CSV FILE UPLOAD
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
        if (cols.length >= 5) {
          // Only real CSV values are used; missing cells stay blank/zero rather
          // than being filled with fabricated sample data. On confirm, only
          // name/parent/phone/email/program/feeStatus are actually imported
          // (see bulkCreateStudents); the rest here is neutral preview scaffolding.
          parsed.push({
            id: `imp-${Date.now()}-${i}`,
            stuId: cols[0] || `STU-IMP-${100 + i}`,
            name: cols[1] || '',
            program: cols[2] || '',
            grade: cols[3] || '',
            parentName: cols[4] || '',
            parentPhone: cols[5] || '',
            parentEmail: cols[6] || '',
            feeStatus: cols[7] || 'Due',
            attendancePct: Number(cols[8]) || 0,
            performanceScore: Number(cols[9]) || 0,
            status: 'active',
            gender: '',
            rollNo: `IMP-${i}`,
            dob: '',
            admissionDate: '',
            motherName: '',
            motherPhone: '',
            prefLanguage: '',
            lastContact: '',
            healthBand: '',
            homeworkPct: 0,
            testsPct: 0,
            assignmentsPct: 0,
            masteryPct: 0,
            totalPaid: 'PKR 0',
            totalOutstanding: 'PKR 0',
            feeDateText: '',
            nextClassTime: '',
            nextClassSubject: '',
            nextClassTeacher: '',
            nextClassRoom: '',
            aiMessage: 'Newly imported student record.',
            enrolledSubjects: [],
            timeline: [{ date: 'Today', title: 'Student Imported', desc: 'Added via CSV import', tag: 'Import', tagBg: 'bg-[#EEEBFB] text-[#5B47D6]', detail: 'Batch import' }],
            documents: [],
          });
        }
      }
      setImportedRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0) return;
    const res = await bulkCreateStudents(
      importedRows.map((r) => ({
        name: r.name,
        parentName: r.parentName,
        parentPhone: r.parentPhone,
        parentEmail: r.parentEmail,
        program: r.program,
        feeStatus: r.feeStatus,
      }))
    );
    if (res.ok || res.inserted > 0) {
      setImportedRows([]);
      setImportedFileName(null);
      setShowImportModal(false);
      router.refresh();
      alert(
        `Imported ${res.inserted} student${res.inserted === 1 ? '' : 's'}.` +
          (res.skipped ? ` Skipped ${res.skipped} (missing name/parent or non-CAIE program).` : '') +
          ' Fee and exam session default to 0 / "To be set" - edit each student to complete.'
      );
      return;
    }
    alert(res.error ?? 'Import failed.');
    return;
  };

  const counts = useMemo(() => {
    return {
      all: studentsData.filter(s => s.status !== 'alumni').length,
      active: studentsData.filter(s => s.status === 'active').length,
      paused: studentsData.filter(s => s.status === 'paused').length,
      demo: studentsData.filter(s => s.status === 'demo').length,
      alumni: studentsData.filter(s => s.status === 'alumni').length,
      atRisk: studentsData.filter(s => s.healthBand === 'Red' && s.status === 'active').length,
      feesDue: studentsData.filter(s => s.feeStatus === 'Due' || s.feeStatus === 'In Grace').length,
    };
  }, [studentsData]);

  const filteredStudents = useMemo(() => {
    return studentsData.filter((s) => {
      if (activeTabStatus === 'All Students' && s.status === 'alumni') return false;
      if (activeTabStatus === 'Active' && s.status !== 'active') return false;
      if (activeTabStatus === 'Paused' && s.status !== 'paused') return false;
      if (activeTabStatus === 'Demo' && s.status !== 'demo') return false;
      if (activeTabStatus === 'Passout / Alumni' && s.status !== 'alumni') return false;

      if (selectedProgram !== 'All Programs' && s.program !== selectedProgram) return false;
      if (selectedSubject !== 'All Subjects' && !s.enrolledSubjects.some((es) => es.subject === selectedSubject)) return false;
      if (selectedTeacher !== 'All Teachers' && !s.enrolledSubjects.some((es) => es.teacherName === selectedTeacher)) return false;
      if (selectedFeeStatus !== 'All Statuses' && s.feeStatus !== selectedFeeStatus) return false;

      if (s.attendancePct < minAttendanceFilter) return false;
      if (s.homeworkPct < minHomeworkFilter) return false;
      if (selectedRiskLevel === 'Green (Healthy)' && s.healthBand !== 'Green') return false;
      if (selectedRiskLevel === 'Amber (Watch)' && s.healthBand !== 'Amber') return false;
      if (selectedRiskLevel === 'Red (Critical)' && s.healthBand !== 'Red') return false;

      if (selectedGenderFilter !== 'All Genders' && s.gender !== selectedGenderFilter) return false;

      if (subjectCountFilter === 'Single Subject' && s.enrolledSubjects.length !== 1) return false;
      if (subjectCountFilter === '2-3 Subjects' && (s.enrolledSubjects.length < 2 || s.enrolledSubjects.length > 3)) return false;
      if (subjectCountFilter === '4+ Subjects' && s.enrolledSubjects.length < 4) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesId = s.stuId.toLowerCase().includes(q);
        const matchesParent = s.parentName.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesParent) return false;
      }

      return true;
    });
  }, [
    studentsData,
    activeTabStatus,
    selectedProgram,
    selectedSubject,
    selectedTeacher,
    selectedFeeStatus,
    minAttendanceFilter,
    minHomeworkFilter,
    selectedRiskLevel,
    selectedGenderFilter,
    subjectCountFilter,
    searchQuery,
  ]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === paginatedStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(paginatedStudents.map((s) => s.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((item) => item !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  // BULK ACTIONS on the current selection.
  const [bulkBusy, setBulkBusy] = useState(false);
  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!confirm(`Delete ${selectedStudentIds.length} selected student${selectedStudentIds.length === 1 ? '' : 's'}? This removes them from the roster and is logged.`)) return;
    setBulkBusy(true);
    const res = await bulkDeleteStudents(selectedStudentIds);
    setBulkBusy(false);
    if (res.ok) { setSelectedStudentIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to delete the selected students.');
  };
  const handleBulkFeeStatus = async (feeStatus: string) => {
    if (selectedStudentIds.length === 0 || !feeStatus) return;
    setBulkBusy(true);
    const res = await bulkSetFeeStatus(selectedStudentIds, feeStatus);
    setBulkBusy(false);
    if (res.ok) { setSelectedStudentIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to update fee status.');
  };
  const handleBulkStatus = async (status: string) => {
    if (selectedStudentIds.length === 0 || !status) return;
    setBulkBusy(true);
    const res = await bulkSetStatus(selectedStudentIds, status);
    setBulkBusy(false);
    if (res.ok) { setSelectedStudentIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to update status.');
  };
  const handleBulkProgram = async (program: string) => {
    if (selectedStudentIds.length === 0 || !program) return;
    if (!confirm(`Change program to "${program}" for ${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? '' : 's'}?`)) return;
    setBulkBusy(true);
    const res = await bulkSetProgram(selectedStudentIds, program);
    setBulkBusy(false);
    if (res.ok) { setSelectedStudentIds([]); router.refresh(); }
    else alert(res.error ?? 'Failed to update program.');
  };

  const handleExportCsv = () => {
    const dataToExport = selectedStudentIds.length > 0
      ? studentsData.filter(s => selectedStudentIds.includes(s.id))
      : filteredStudents;

    let csvContent = "STU ID,Full Name,Program,Grade,Parent Name,Parent Phone,Parent Email,Fee Status,Attendance %,Performance Score\n";
    dataToExport.forEach((s) => {
      const row = `"${s.stuId}","${s.name}","${s.program}","${s.grade}","${s.parentName}","${s.parentPhone}","${s.parentEmail}","${s.feeStatus}",${s.attendancePct},${s.performanceScore}\n`;
      csvContent += row;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Thinkerzz_Students_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher']}>
      <div className="space-y-5 text-[#171A2B] max-w-full overflow-x-hidden relative pb-10">

        {/* TOP PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Students Management</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Manage all students, track progress, and take action.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {(role === 'admin' || role === 'manager') && (
              <Button variant="primary" onClick={() => setShowOnboard(true)} className="shadow-[#5B47D6]/20">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Student</span>
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowImportModal(true)}>
              <Upload className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Import CSV</span>
            </Button>

            <Button variant="secondary" onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5 text-[#5B47D6]" />
              <span>Export CSV</span>
            </Button>

          </div>
        </div>

        {/* 7 KPI CARDS STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-[#EEEBFB] text-[#5B47D6] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">Total Students</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white leading-none">{studentsData.length}</div>
              <div className="text-xs font-medium text-[#6B7185] mt-1">In the system</div>
            </div>
            <span className="text-xs font-medium text-[#5B47D6] hover:underline inline-flex items-center gap-0.5">
              View all
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">Active Students</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white leading-none">{counts.active}</div>
              <div className="text-xs font-medium text-emerald-600 mt-1">Enrolled</div>
            </div>
            <span className="text-xs font-medium text-emerald-600 hover:underline inline-flex items-center gap-0.5">
              View active
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-rose-50 text-[#E5484D] flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">At Risk Students</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-[#E5484D] leading-none">{counts.atRisk}</div>
              <div className="text-xs font-medium text-[#E5484D] mt-1">Critical review</div>
            </div>
            <span className="text-xs font-medium text-[#E5484D] hover:underline inline-flex items-center gap-0.5">
              View at risk
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">Fees Due Today</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white leading-none">{counts.feesDue}</div>
              <div className="text-xs font-medium text-amber-600 mt-1">Due this cycle</div>
            </div>
            <span className="text-xs font-medium text-amber-600 hover:underline inline-flex items-center gap-0.5">
              Collect now
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">Classes Today</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white leading-none">0</div>
              <div className="text-xs font-medium text-blue-600 mt-1">Scheduled</div>
            </div>
            <span className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5">
              View schedule
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[16px] p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7.5 h-7.5 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="font-heading font-medium text-[12.5px] text-[#3D4157] dark:text-slate-200">Demo Students</span>
            </div>
            <div className="my-2">
              <div className="font-heading font-medium text-2xl text-slate-900 dark:text-white leading-none">{counts.demo}</div>
              <div className="text-xs font-medium text-purple-600 mt-1">Trial period</div>
            </div>
            <span className="text-xs font-medium text-purple-600 hover:underline inline-flex items-center gap-0.5">
              View demo
            </span>
          </div>

          <div className="bg-gradient-to-br from-[#1B1E38] to-[#2E285C] text-white rounded-[16px] p-3.5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 font-heading font-medium text-[12.5px] text-purple-200">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Student Summary</span>
                </div>
              </div>
              <p className="text-xs text-purple-100 font-medium leading-tight">
                {counts.atRisk > 0
                  ? `${counts.atRisk} student${counts.atRisk === 1 ? '' : 's'} flagged at risk and due for review.`
                  : `${counts.active} active student${counts.active === 1 ? '' : 's'} · no at-risk flags right now.`}
              </p>
            </div>
            <button
              onClick={() => setShowAiInsightsModal(true)}
              className="text-xs font-medium text-purple-300 hover:text-white mt-2 inline-flex items-center gap-0.5 text-left cursor-pointer"
            >
              View all 5 AI insights
            </button>
          </div>
        </div>

        {/* STATUS TABS & RICH FILTER BAR */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-[#EBEDF3] dark:border-slate-800 pb-3">
            <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl flex-wrap">
              {[
                { name: 'All Students', count: counts.all },
                { name: 'Active', count: counts.active },
                { name: 'Paused', count: counts.paused },
                { name: 'Demo', count: counts.demo },
                { name: 'Passout / Alumni', count: counts.alumni },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => {
                    setActiveTabStatus(tab.name);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTabStatus === tab.name
                      ? tab.name === 'Passout / Alumni'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-[#5B47D6] text-white shadow-sm'
                      : 'text-[#6B7185] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-xs ${
                      activeTabStatus === tab.name ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-[#6B7185]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSavedViewsMenu(!showSavedViewsMenu)}
                className="h-8 px-3 border border-[#EBEDF3] dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-50 shadow-sm cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#5B47D6]" />
                <span>Saved Views</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showSavedViewsMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs font-medium space-y-1">
                  <div className="text-xs font-medium uppercase text-slate-400 px-2 py-1">Preset Saved Views</div>
                  {savedViews.map((sv) => (
                    <button
                      key={sv.id}
                      onClick={() => applySavedView(sv)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 font-medium flex items-center justify-between text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <span>{sv.name}</span>
                    </button>
                  ))}
                  <div className="border-t pt-1 mt-1">
                    <button
                      onClick={() => { setShowSavedViewsMenu(false); setShowSaveViewModal(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-[#EEEBFB] hover:bg-[#E2DCFA] font-medium text-[#5B47D6] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Current Filters as View</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FILTER ROW DROPDOWNS */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search students, parents, programs..."
                className="w-full bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl pl-8 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#5B47D6]"
              />
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Program</span>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Programs">All Programs</option>
                {Array.from(new Set(studentsData.map((s) => s.program).filter(Boolean))).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Subject</span>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Subjects">All Subjects</option>
                {Array.from(new Set(studentsData.flatMap((s) => s.enrolledSubjects.map((es) => es.subject)).filter(Boolean))).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="bg-[#F6F7FB] dark:bg-slate-800 border border-[#EBEDF3] dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-xs text-[#6B7185] block font-medium">Teacher</span>
              <select
                value={selectedTeacher}
                onChange={(e) => {
                  setSelectedTeacher(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer text-xs"
              >
                <option value="All Teachers">All Teachers</option>
                {Array.from(new Set(studentsData.flatMap((s) => s.enrolledSubjects.map((es) => es.teacherName)).filter(Boolean))).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-[38px] px-3.5 border text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all ml-auto cursor-pointer ${
                showAdvancedFilters
                  ? 'bg-[#5B47D6] text-white border-[#5B47D6] shadow-sm'
                  : 'bg-white dark:bg-slate-800 border-[#EBEDF3] dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Advanced Filters</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* EXPANDABLE ADVANCED FILTERS PANEL */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-[#EBEDF3] dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs animate-in fade-in">
              <div className="space-y-1.5 bg-[#F6F7FB] dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                  <span>Min Attendance %</span>
                  <span className="text-[#5B47D6] font-medium">{minAttendanceFilter}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minAttendanceFilter}
                  onChange={(e) => { setMinAttendanceFilter(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-[#5B47D6] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 bg-[#F6F7FB] dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                  <span>Min Homework %</span>
                  <span className="text-[#5B47D6] font-medium">{minHomeworkFilter}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minHomeworkFilter}
                  onChange={(e) => { setMinHomeworkFilter(Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full accent-[#5B47D6] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 bg-[#F6F7FB] dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="font-medium text-slate-700 dark:text-slate-300 block">Health Tier Risk</label>
                <select
                  value={selectedRiskLevel}
                  onChange={(e) => { setSelectedRiskLevel(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="All Tiers">All Tiers</option>
                  <option value="Green (Healthy)">Green (Healthy)</option>
                  <option value="Amber (Watch)">Amber (Watch)</option>
                  <option value="Red (Critical)">Red (Critical)</option>
                </select>
              </div>

              <div className="space-y-1.5 bg-[#F6F7FB] dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="font-medium text-slate-700 dark:text-slate-300 block">Subject Count Enrolled</label>
                <select
                  value={subjectCountFilter}
                  onChange={(e) => { setSubjectCountFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="All">All Counts</option>
                  <option value="Single Subject">Single Subject</option>
                  <option value="2-3 Subjects">2-3 Subjects</option>
                  <option value="4+ Subjects">4+ Subjects</option>
                </select>
              </div>

              <div className="col-span-full flex justify-end">
                <button
                  onClick={resetAllFilters}
                  className="px-3.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors border border-rose-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Advanced Filters</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BULK ACTION BAR — appears when rows are selected */}
        {selectedStudentIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-[#EEEBFB] dark:bg-[#5B47D6]/15 border border-[#5B47D6]/30 rounded-[14px] px-4 py-2.5 text-sm">
            <span className="font-medium text-[#5B47D6] dark:text-[#b9adf2]">
              {selectedStudentIds.length} selected
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>

            <select
              value=""
              disabled={bulkBusy}
              title="Set fee status"
              onChange={(e) => { if (e.target.value) handleBulkFeeStatus(e.target.value); }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
            >
              <option value="">Fee status…</option>
              <option value="Paid">Paid</option>
              <option value="Due">Due</option>
              <option value="In Grace">In Grace</option>
              <option value="Stopped">Stopped</option>
            </select>

            <select
              value=""
              disabled={bulkBusy}
              title="Set student status"
              onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value); }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
            >
              <option value="">Status…</option>
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Alumni">Alumni (passed out)</option>
            </select>

            <select
              value=""
              disabled={bulkBusy}
              title="Change program (e.g. promote a batch)"
              onChange={(e) => { if (e.target.value) handleBulkProgram(e.target.value); }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
            >
              <option value="">Program…</option>
              {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>

            <button
              onClick={handleExportCsv}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" /> Export
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> {bulkBusy ? 'Working…' : 'Delete'}
            </button>

            <button
              onClick={() => setSelectedStudentIds([])}
              disabled={bulkBusy}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}

        {/* 100% MATCHING MAIN STUDENTS TABLE */}
        <div className="w-full bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-medium text-slate-900 dark:text-slate-100 tracking-wide text-[13px]">
                  <th className="py-3.5 px-3 w-[40px] text-center">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.length === paginatedStudents.length && paginatedStudents.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded accent-[#5B47D6] cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Student</th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Parent / Guardian</th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Program / Grade</th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Enrolled Subjects & Teachers</th>
                  <th className="py-3.5 px-3 text-center font-medium text-slate-900 dark:text-white">Performance Score</th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Fee Status</th>
                  <th className="py-3.5 px-3 font-medium text-slate-900 dark:text-white">Next Class</th>
                  <th className="py-3.5 px-3 text-center font-medium text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-[13px]">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[#6B7185]">
                      No students match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((s, idx) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

                    return (
                      <tr key={s.id} className={`transition-colors ${isSelected ? 'bg-purple-50/40' : 'hover:bg-slate-50'}`}>
                        <td className="py-3.5 px-3 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(s.id)} className="rounded accent-[#5B47D6]" />
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full font-medium text-xs flex items-center justify-center shrink-0 shadow-sm ${avatarColor}`}>
                              {getInitials(s.name)}
                            </div>
                            <div>
                              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{s.name}</div>
                              <div className="text-xs text-[#6B7185] font-mono mt-0.5">{s.stuId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-xs text-slate-900 dark:text-slate-100">{s.parentName}</div>
                          <div className="text-xs text-[#6B7185] mt-0.5">{s.parentRelation}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-medium text-xs text-slate-900 dark:text-slate-100">{s.program}</div>
                          <div className="text-xs text-[#6B7185] mt-0.5">{s.grade}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            {s.enrolledSubjects.map((sub, sIdx) => (
                              <div key={sIdx} className="text-[12px] leading-tight">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{sub.subject}</span>
                                <span className="text-[#6B7185] font-medium"> ({sub.teacherName})</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-block font-medium text-sm sm:text-base font-mono px-3.5 py-1.5 rounded-full border-2 shadow-sm ${
                              s.performanceScore < 60
                                ? 'bg-rose-50 border-rose-400 text-rose-600'
                                : s.performanceScore < 80
                                ? 'bg-amber-50 border-amber-400 text-amber-600'
                                : 'bg-emerald-50 border-emerald-400 text-emerald-600'
                            }`}
                          >
                            {s.performanceScore}
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <Badge tone={s.feeStatus === 'Paid' ? 'success' : 'danger'}>
                            {s.feeStatus}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#EEEBFB] text-[#5B47D6] flex items-center justify-center shrink-0 mt-0.5">
                              <Calendar className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-medium text-xs text-slate-900 dark:text-slate-100">{s.nextClassTime}</div>
                              <div className="text-xs text-[#6B7185] font-medium mt-0.5">{s.nextClassSubject}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center relative row-menu-container">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`https://wa.me/${s.parentPhone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="WhatsApp Parent"
                              className="w-8 h-8 rounded-xl bg-[#E7F9EE] hover:bg-[#D3F3DE] text-[#12A150] border border-[#BDE8CC] flex items-center justify-center transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>

                            <a
                              href={`mailto:${s.parentEmail}`}
                              title="Invoice / Email Parent"
                              className="w-8 h-8 rounded-xl bg-[#E9F1FE] hover:bg-[#CBE0FE] text-[#2E7BEE] border border-[#CBE0FE] flex items-center justify-center transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => { setProfileModalStudent(s); setIsEditMode(false); }}
                              title="View Full Profile Modal"
                              className="h-8 px-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                            >
                              <span>Profile</span>
                            </button>

                            <RowActionsMenu
                              width={200}
                              actions={[
                                { label: 'Edit Profile', icon: <Edit3 className="w-3.5 h-3.5" />, tone: 'primary', onClick: () => { setProfileModalStudent(s); setEditFormData(s); setIsEditMode(true); } },
                                { label: 'View Profile', icon: <UserCog className="w-3.5 h-3.5" />, onClick: () => setProfileModalStudent(s) },
                                { label: 'Admission Form', icon: <GraduationCap className="w-3.5 h-3.5" />, tone: 'success', hidden: !(role === 'admin' || role === 'manager'), onClick: () => copyOnboardingLink(s.id) },
                                { label: 'Reset Password', icon: <KeyRound className="w-3.5 h-3.5" />, hidden: !(role === 'admin' || role === 'manager'), onClick: () => setResetStudent(s) },
                                { label: 'Pass Out', icon: <Archive className="w-3.5 h-3.5" />, tone: 'warning', hidden: !((role === 'admin' || role === 'manager') && s.status !== 'alumni'), onClick: () => handlePassoutStudent(s) },
                                { label: 'Delete Student', icon: <Trash2 className="w-3.5 h-3.5" />, tone: 'danger', onClick: () => handleDeleteStudent(s.id) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-3">
              <div>Showing {filteredStudents.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students</div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-500">Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none focus:border-[#5B47D6] cursor-pointer"
                >
                  {[10, 20, 50, 100, 500].map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50">Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="px-3 py-1 bg-white border rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>

        {/* IMPORT CSV MODAL */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 relative">
              <div className="flex justify-between items-center border-b pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EEEBFB] text-[#5B47D6] flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-medium text-slate-900 dark:text-white text-lg">Import Students CSV</h3>
                    <p className="text-xs text-[#6B7185]">Bulk import student records into the academy database.</p>
                  </div>
                </div>
                <button onClick={() => setShowImportModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
              </div>

              <div className="p-4 bg-[#F6F7FB] dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-xs text-slate-900 dark:text-white">Download Sample CSV Template</div>
                  <div className="text-xs text-[#6B7185] mt-0.5">Use our pre-formatted template with all required columns.</div>
                </div>
                <button
                  onClick={handleDownloadSampleCsv}
                  className="px-3.5 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-[#5B47D6] font-medium text-xs rounded-xl flex items-center gap-1.5 hover:bg-purple-50 transition-colors shrink-0 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Sample</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-[#5B47D6]/40 bg-purple-50/30 dark:bg-slate-800/40 rounded-2xl p-6 text-center space-y-3 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="w-12 h-12 rounded-full bg-[#EEEBFB] text-[#5B47D6] mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-medium text-sm text-[#5B47D6] block">Click to upload CSV or drag and drop</span>
                  <span className="text-xs text-[#6B7185] mt-0.5 block">Supports UTF-8 formatted .csv files</span>
                </div>
                {importedFileName && (
                  <div className="mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle className="w-4 h-4" />
                    <span>Selected: {importedFileName} ({importedRows.length} rows parsed)</span>
                  </div>
                )}
              </div>

              {importedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-xs text-slate-800">Parsed Preview ({importedRows.length} students)</div>
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-medium text-slate-700">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Program</th>
                          <th className="p-2">Grade</th>
                          <th className="p-2">Parent</th>
                          <th className="p-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {importedRows.map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-medium">{r.name}</td>
                            <td className="p-2">{r.program}</td>
                            <td className="p-2">{r.grade}</td>
                            <td className="p-2">{r.parentName}</td>
                            <td className="p-2">{r.parentPhone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-medium text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={importedRows.length === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-[#5B47D6] disabled:opacity-50 text-white rounded-xl font-medium text-xs shadow-md hover:bg-[#4F3DC7] transition-all cursor-pointer"
                >
                  Confirm & Import ({importedRows.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SAVE VIEW MODAL */}
        {showSaveViewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-medium text-slate-900 dark:text-white text-base">Save Current Filters as View</h3>
                <button onClick={() => setShowSaveViewModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div>
                <label className="font-medium text-xs text-slate-700 dark:text-slate-300 block mb-1">View Name</label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g. My Critical O-Level View"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-[#5B47D6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setShowSaveViewModal(false)} className="px-4 py-2 border rounded-xl font-medium text-xs">Cancel</button>
                <button onClick={handleSaveCurrentView} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium text-xs shadow-md">Save View</button>
              </div>
            </div>
          </div>
        )}

        {/* 100% MATCHING 6-TAB PROFILE MODAL (FULL RESPONSIVE VERIFIED) */}
        {profileModalStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl shadow-2xl max-w-6xl w-full h-[92vh] sm:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 relative">
              
              {/* STICKY MODAL HEADER */}
              <div className="shrink-0 bg-white dark:bg-slate-900 p-4 sm:p-6 border-b border-[#EBEDF3] dark:border-slate-800 space-y-3 z-20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#5B47D6] to-[#8B7BF0] text-white font-medium text-lg flex items-center justify-center shrink-0 shadow-md">
                      {getInitials(profileModalStudent.name)}
                    </div>
                    <div>
                      <h2 className="font-heading font-medium text-xl sm:text-2xl text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>{profileModalStudent.name}</span>
                        <span className={`text-xs font-medium px-3 py-0.5 rounded-full ${profileModalStudent.status === 'active' ? 'bg-emerald-100 text-[#12A150]' : 'bg-amber-100 text-amber-700'}`}>
                          {profileModalStudent.status.toUpperCase()}
                        </span>
                      </h2>
                      <div className="text-xs sm:text-sm text-[#6B7185] font-medium mt-0.5">
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{profileModalStudent.stuId}</span> · {profileModalStudent.program} • {profileModalStudent.grade}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setEditFormData(profileModalStudent);
                        setIsEditMode(!isEditMode);
                      }}
                      className={`h-9 px-4 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                        isEditMode
                          ? 'bg-[#5B47D6] text-white'
                          : 'bg-purple-50 text-[#5B47D6] hover:bg-purple-100 border border-[#D5CEF6]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditMode ? 'Close Edit Mode' : 'Edit Profile'}</span>
                    </button>

                    <a href={`https://wa.me/${profileModalStudent.parentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="h-9 px-3 bg-[#E7F9EE] text-[#12A150] rounded-xl font-medium text-xs flex items-center gap-1.5 border border-[#BDE8CC]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <a href={`tel:${profileModalStudent.parentPhone}`} className="h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                    <a href={`mailto:${profileModalStudent.parentEmail}`} className="h-9 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email</span>
                    </a>
                    <button onClick={() => { setProfileModalStudent(null); setIsEditMode(false); }} className="w-9 h-9 text-slate-400 hover:text-slate-600 rounded-xl flex items-center justify-center cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* MODAL TABS NAVIGATION */}
                <div className="flex items-center gap-4 sm:gap-6 border-b border-[#EBEDF3] dark:border-slate-800 pt-1 pb-0.5 text-xs font-medium overflow-x-auto">
                  {[
                    { name: 'Overview', icon: User },
                    { name: 'Academics', icon: BookOpen },
                    { name: 'Attendance', icon: CheckSquare },
                    { name: 'Finance', icon: DollarSign },
                    { name: 'Timeline', icon: Clock },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = modalActiveTab === tab.name;

                    return (
                      <button
                        key={tab.name}
                        onClick={() => setModalActiveTab(tab.name as any)}
                        className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-all shrink-0 cursor-pointer ${
                          isActive
                            ? 'border-[#5B47D6] text-[#5B47D6]'
                            : 'border-transparent text-[#6B7185] hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MODAL BODY RENDERING ALL 6 TABS MATCHING REFERENCE UI */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                
                {/* EDIT PROFILE MODE FORM */}
                {isEditMode ? (
                  <div className="bg-purple-50/50 border-2 border-[#5B47D6]/30 rounded-2xl p-5 space-y-4 text-xs animate-in fade-in mb-6">
                    <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                      <h3 className="font-medium text-[#5B47D6] text-sm flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        <span>Edit Student Profile Details</span>
                      </h3>
                      <span className="text-xs font-medium text-[#5B47D6] bg-white px-2.5 py-0.5 rounded-full border border-[#5B47D6]/30">
                        Live Profile Editor
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Student Full Name</label>
                        <input
                          type="text"
                          value={editFormData.name || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Program</label>
                        <select
                          value={editFormData.program || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, program: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        >
                          {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                        </select>
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Fee Status</label>
                        <select
                          value={editFormData.feeStatus || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, feeStatus: e.target.value as any })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        >
                          <option value="Paid">Paid</option>
                          <option value="Due">Due</option>
                          <option value="In Grace">In Grace</option>
                          <option value="Stopped">Stopped</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Parent Name</label>
                        <input
                          type="text"
                          value={editFormData.parentName || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, parentName: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Parent Phone</label>
                        <input
                          type="text"
                          value={editFormData.parentPhone || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Email <span className="text-slate-400 font-medium">(calendar invites)</span></label>
                        <input
                          type="email"
                          value={editFormData.parentEmail || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, parentEmail: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">WhatsApp</label>
                        <input
                          type="text"
                          value={editFormData.whatsapp || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Gender</label>
                        <select
                          value={editFormData.gender || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        >
                          <option value="">Select…</option>
                          <option value="female">Female (she/her)</option>
                          <option value="male">Male (he/him)</option>
                          <option value="other">Other (they/them)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={editFormData.dob || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">City</label>
                        <input
                          type="text"
                          value={editFormData.city || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div className="sm:col-span-2 md:col-span-3">
                        <label className="font-medium text-slate-700 block mb-1">Address</label>
                        <input
                          type="text"
                          value={editFormData.address || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Exam Session</label>
                        <select
                          value={editFormData.examSession || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, examSession: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        >
                          <option value="">Select…</option>
                          {EXAM_SESSIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Monthly Fee (PKR)</label>
                        <input
                          type="number"
                          value={editFormData.monthlyFee ?? ''}
                          onChange={(e) => setEditFormData({ ...editFormData, monthlyFee: e.target.value === '' ? undefined : Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium font-mono focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Next Due Date</label>
                        <input
                          type="date"
                          value={editFormData.nextDueDate || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, nextDueDate: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 font-medium focus:outline-none focus:border-[#5B47D6]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-slate-700 block mb-1">Performance Score (/100) <span className="text-slate-400 font-medium">(auto)</span></label>
                        <input
                          type="number"
                          disabled
                          value={editFormData.performanceScore || 0}
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 font-medium text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-purple-200">
                      <button
                        onClick={() => setIsEditMode(false)}
                        className="px-4 py-2 border rounded-xl font-medium bg-white text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfileChanges}
                        className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-medium shadow-md"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 1. OVERVIEW TAB MATCHING media_1785826130761.jpg & FIXED FOR PERFECT RESPONSIVENESS */}
                {modalActiveTab === 'Overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
                    {/* COLUMN 1 */}
                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-4 shadow-sm">
                        <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Student Info</h3>
                        <div className="space-y-2.5 text-xs sm:text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> Full Name</span><span className="font-medium text-slate-900">{profileModalStudent.name}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Date of Birth</span><span className="font-medium text-slate-900">{profileModalStudent.dob}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> Gender</span><span className="font-medium text-slate-900">{profileModalStudent.gender}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-slate-400" /> Program</span><span className="font-medium text-slate-900">{profileModalStudent.program}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-slate-400" /> Grade</span><span className="font-medium text-slate-900">{profileModalStudent.grade}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-slate-400" /> Roll Number</span><span className="font-medium text-slate-900">{profileModalStudent.rollNo}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> Admission Date</span><span className="font-medium text-slate-900">{profileModalStudent.admissionDate}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Status</span><span className={`font-medium ${profileModalStudent.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>{profileModalStudent.status.charAt(0).toUpperCase() + profileModalStudent.status.slice(1)}</span></div>
                          <div className="flex justify-between py-1.5"><span className="text-[#6B7185] font-medium flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5 text-slate-400" /> Student ID</span><span className="font-mono font-medium text-slate-900">{profileModalStudent.stuId}</span></div>
                        </div>
                      </div>

                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-4 shadow-sm">
                        <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Parent / Guardian</h3>
                        <div className="space-y-4 text-xs sm:text-sm">
                          <div>
                            <div className="text-xs text-[#6B7185] font-medium uppercase tracking-wider">FATHER</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-medium text-slate-900 text-sm">{profileModalStudent.parentName}</span>
                              <div className="flex items-center gap-2 text-slate-400">
                                <a href={`tel:${profileModalStudent.parentPhone}`} title="Call Father" className="hover:text-blue-600 p-1">
                                  <Phone className="w-4 h-4 text-emerald-600" />
                                </a>
                                <a href={`https://wa.me/${profileModalStudent.parentPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp Father" className="hover:text-emerald-600 p-1">
                                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                                </a>
                                <a href={`mailto:${profileModalStudent.parentEmail}`} title="Email Father" className="hover:text-purple-600 p-1">
                                  <Mail className="w-4 h-4 text-blue-600" />
                                </a>
                              </div>
                            </div>
                            <div className="text-xs font-mono text-slate-500 mt-0.5">{profileModalStudent.parentPhone}</div>
                          </div>

                          <div className="pt-3 border-t border-slate-100">
                            <div className="text-xs text-[#6B7185] font-medium uppercase tracking-wider">MOTHER</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-medium text-slate-900 text-sm">{profileModalStudent.motherName}</span>
                              <div className="flex items-center gap-2 text-slate-400">
                                <a href={`tel:${profileModalStudent.motherPhone}`} title="Call Mother" className="hover:text-blue-600 p-1">
                                  <Phone className="w-4 h-4 text-emerald-600" />
                                </a>
                                <a href={`https://wa.me/${profileModalStudent.motherPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp Mother" className="hover:text-emerald-600 p-1">
                                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                                </a>
                                <a href={`mailto:${profileModalStudent.parentEmail}`} title="Email Mother" className="hover:text-purple-600 p-1">
                                  <Mail className="w-4 h-4 text-blue-600" />
                                </a>
                              </div>
                            </div>
                            <div className="text-xs font-mono text-slate-500 mt-0.5">{profileModalStudent.motherPhone}</div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex justify-between">
                            <span className="text-[#6B7185] font-medium">Preferred Language</span>
                            <span className="font-medium text-slate-900">{profileModalStudent.prefLanguage}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#6B7185] font-medium">Last Contact</span>
                            <span className="font-medium text-slate-900">{profileModalStudent.lastContact}</span>
                          </div>
                        </div>
                      </div>

                      {/* ADMISSION & ONBOARDING — details collected on the public onboarding form */}
                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Admission &amp; Onboarding</h3>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${profileModalStudent.onboardingDone ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                            {profileModalStudent.onboardingDone ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                        <div className="space-y-2.5 text-xs sm:text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium">School</span><span className="font-medium text-slate-900 text-right">{profileModalStudent.schoolName || '—'}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium">Emergency Contact</span><span className="font-medium text-slate-900 text-right">{profileModalStudent.emergencyContact || '—'}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium">Exam Session</span><span className="font-medium text-slate-900 text-right">{profileModalStudent.examSession || '—'}</span></div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-[#6B7185] font-medium">City</span><span className="font-medium text-slate-900 text-right">{profileModalStudent.city || '—'}</span></div>
                          <div className="flex justify-between py-1.5"><span className="text-[#6B7185] font-medium">Address</span><span className="font-medium text-slate-900 text-right max-w-[60%] truncate" title={profileModalStudent.address || ''}>{profileModalStudent.address || '—'}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 2 - ACADEMIC SNAPSHOT WITH RESPONSIVE PILLS & SCORE GAUGE */}
                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-4 sm:p-5 space-y-5 shadow-sm">
                        <div className="flex justify-between items-center border-b pb-2.5">
                          <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Academic Snapshot</h3>
                        </div>

                        {/* RESPONSIVE 2x2 ON MOBILE, 4-COL ON LG WITH TRUNCATED LABELS */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 text-center">
                          <div className="bg-[#E7F6EC] p-2.5 sm:p-3 rounded-2xl border border-[#C6EAD3] flex flex-col justify-center">
                            <div className="text-xs sm:text-xs font-medium text-[#6B7185] truncate">Attendance</div>
                            <div className="font-medium text-base sm:text-lg text-[#12A150] mt-0.5">{profileModalStudent.attendancePct}%</div>
                          </div>
                          <div className="bg-[#E9F1FE] p-2.5 sm:p-3 rounded-2xl border border-[#CBE0FE] flex flex-col justify-center">
                            <div className="text-xs sm:text-xs font-medium text-[#6B7185] truncate">Homework</div>
                            <div className="font-medium text-base sm:text-lg text-blue-600 mt-0.5">{profileModalStudent.homeworkPct}%</div>
                          </div>
                          <div className="bg-[#FEF3E2] p-2.5 sm:p-3 rounded-2xl border border-[#FCDAA8] flex flex-col justify-center">
                            <div className="text-xs sm:text-xs font-medium text-[#6B7185] truncate">Tests</div>
                            <div className="font-medium text-base sm:text-lg text-amber-600 mt-0.5">{profileModalStudent.testsPct}%</div>
                          </div>
                          <div className="bg-[#EEEBFB] p-2.5 sm:p-3 rounded-2xl border border-[#D5CEF6] flex flex-col justify-center">
                            <div className="text-xs sm:text-xs font-medium text-[#6B7185] truncate">Assignments</div>
                            <div className="font-medium text-base sm:text-lg text-[#5B47D6] mt-0.5">{profileModalStudent.assignmentsPct}%</div>
                          </div>
                        </div>

                        <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-center">
                          <div className="text-xs font-medium text-rose-600">Concept Mastery</div>
                          <div className="font-medium text-lg text-rose-700 mt-0.5">{profileModalStudent.masteryPct}%</div>
                        </div>

                        {/* PERFECT RESPONSIVE PERFORMANCE SCORE GAUGE & LEGEND */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pt-3 border-t border-slate-100">
                          <div className={`relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex flex-col items-center justify-center bg-white rounded-full border-[8px] shadow-md ${profileModalStudent.performanceScore < 60 ? 'border-rose-400' : profileModalStudent.performanceScore < 80 ? 'border-amber-400' : 'border-[#12A150]'}`}>
                            <div className="font-heading font-medium text-3xl sm:text-4xl leading-none text-slate-900">{profileModalStudent.performanceScore}</div>
                            <div className="text-xs font-medium text-[#6B7185] mt-0.5">/100</div>
                            <div className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full mt-1 border border-slate-200">
                              {profileModalStudent.aiTag}
                            </div>
                          </div>

                          <div className="space-y-2 text-xs font-medium w-full flex-1">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 truncate"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Excellent (80-100)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 truncate"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" /> Good (60-79)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 truncate"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> Average (40-59)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1.5 truncate"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" /> Needs Improvement</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-900 to-[#2E285C] text-white rounded-2xl p-5 space-y-3 shadow-md">
                        <div className="flex items-center gap-2 font-medium text-xs text-purple-200 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span>AI Recommendation</span>
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed text-purple-100 font-medium">
                          {profileModalStudent.aiMessage}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {profileModalStudent.tags.map((tag, i) => (
                            <span key={i} className="px-2.5 py-0.5 bg-purple-500/20 text-purple-200 rounded-full text-xs font-medium border border-purple-500/30">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 3 */}
                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-3 shadow-sm">
                        <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Next Class</h3>
                        <div className="font-medium text-slate-900 text-sm flex items-center justify-between">
                          <span>{profileModalStudent.nextClassTime}</span>
                        </div>
                        <div className="text-xs text-blue-600 font-medium">{profileModalStudent.nextClassSubject}</div>
                        <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100 text-xs">
                          <div className="w-7 h-7 rounded-full bg-slate-200 font-medium text-xs flex items-center justify-center">{getInitials(profileModalStudent.nextClassTeacher || '')}</div>
                          <span className="font-medium text-slate-800">{profileModalStudent.nextClassTeacher}</span>
                          <span className="text-xs text-slate-600 font-medium ml-auto">{profileModalStudent.nextClassRoom}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-3 shadow-sm">
                        <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Fee Status</h3>
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                          <div>
                            <span className={`font-medium text-xs px-2.5 py-1 rounded-full ${profileModalStudent.feeStatus === 'Paid' ? 'bg-[#E7F6EC] text-[#12A150]' : profileModalStudent.feeStatus === 'Stopped' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{profileModalStudent.feeStatus}</span>
                            <div className="text-xs text-[#6B7185] mt-1 font-medium">{profileModalStudent.feeDateText}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[#6B7185] block text-xs font-medium">Total Paid</span>
                            <span className="font-medium text-slate-900 text-sm sm:text-base">{profileModalStudent.totalPaid}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-3 shadow-sm">
                        <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                          <button onClick={() => router.push('/homework')} className="p-3 bg-purple-50 text-[#5B47D6] rounded-xl font-medium flex items-center gap-2 hover:bg-purple-100 transition-colors cursor-pointer">
                            <FilePlus className="w-4 h-4" />
                            <span>Assign Homework</span>
                          </button>
                          <button onClick={() => router.push('/schedule')} className="p-3 bg-blue-50 text-blue-600 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-100 transition-colors cursor-pointer">
                            <CalendarPlus className="w-4 h-4" />
                            <span>Schedule Class</span>
                          </button>
                          <button onClick={() => router.push('/vouchers')} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-100 transition-colors cursor-pointer">
                            <Receipt className="w-4 h-4" />
                            <span>Generate Invoice</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACADEMICS TAB */}
                {/* ACADEMICS TAB (real data) */}
                {modalActiveTab === 'Academics' && (
                  <div className="space-y-6 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Subjects Enrolled</div>
                        <div className="font-medium text-2xl text-slate-900 mt-1">{profileModalStudent.enrolledSubjects.length}</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Overall Average</div>
                        <div className="font-medium text-2xl text-slate-900 mt-1">{profileModalStudent.performanceScore || 0}%</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Homework Completion</div>
                        <div className="font-medium text-2xl text-slate-900 mt-1">{profileModalStudent.homeworkPct || 0}%</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Program</div>
                        <div className="font-medium text-lg text-slate-900 mt-1">{profileModalStudent.program}</div>
                      </div>
                    </div>

                    <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 space-y-4 shadow-sm">
                      <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider">Subject Performance</h3>
                      {profileModalStudent.enrolledSubjects.length === 0 ? (
                        <div className="text-center text-[#6B7185] py-10 text-xs font-medium">No subjects enrolled yet. Assessed grades appear here after the first test.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[560px]">
                            <thead>
                              <tr className="bg-[#F6F7FB] border-b font-medium text-[#6B7185] text-xs uppercase">
                                <th className="py-2.5 px-3">SUBJECT</th>
                                <th className="py-2.5 px-3">TEACHER</th>
                                <th className="py-2.5 px-3">ASSESSED</th>
                                <th className="py-2.5 px-3">TARGET</th>
                                <th className="py-2.5 px-3">AVG. SCORE</th>
                                <th className="py-2.5 px-3">STATUS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {profileModalStudent.enrolledSubjects.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-3 px-3 font-medium text-slate-900">{row.subject}</td>
                                  <td className="py-3 px-3 text-slate-700">{row.teacherName}</td>
                                  <td className="py-3 px-3 font-medium text-emerald-600">{row.assessedGrade || '\u2014'}</td>
                                  <td className="py-3 px-3 font-medium text-[#5B47D6]">{row.targetGrade}</td>
                                  <td className="py-3 px-3 font-medium">{row.avgScore}%</td>
                                  <td className="py-3 px-3">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${row.status === 'Excellent' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {row.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ATTENDANCE TAB (real data) */}
                {modalActiveTab === 'Attendance' && (
                  <div className="space-y-6 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Attendance Rate</div>
                        <div className="font-medium text-2xl text-slate-900 mt-1">{profileModalStudent.attendancePct || 0}%</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Homework Completion</div>
                        <div className="font-medium text-2xl text-slate-900 mt-1">{profileModalStudent.homeworkPct || 0}%</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Health Band</div>
                        <div className={`font-medium text-2xl mt-1 ${profileModalStudent.healthBand === 'Green' ? 'text-emerald-600' : profileModalStudent.healthBand === 'Amber' ? 'text-amber-600' : 'text-rose-600'}`}>{profileModalStudent.healthBand}</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Status</div>
                        <div className="font-medium text-lg text-slate-900 mt-1 capitalize">{profileModalStudent.status}</div>
                      </div>
                    </div>
                    <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 shadow-sm">
                      <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider mb-3">Attendance History</h3>
                      <div className="text-center text-[#6B7185] py-10 text-xs font-medium">Class-by-class attendance appears here once sessions are recorded.</div>
                    </div>
                  </div>
                )}

                {/* FINANCE TAB (real data) */}
                {modalActiveTab === 'Finance' && (
                  <div className="space-y-6 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Fee Status</div>
                        <div className={`font-medium text-2xl mt-1 ${profileModalStudent.feeStatus === 'Paid' ? 'text-emerald-600' : profileModalStudent.feeStatus === 'Stopped' ? 'text-rose-600' : 'text-amber-600'}`}>{profileModalStudent.feeStatus}</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Next Due Date</div>
                        <div className="font-medium text-lg text-slate-900 mt-1">{profileModalStudent.feeDateText || '\u2014'}</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Total Paid</div>
                        <div className="font-medium text-lg text-emerald-600 mt-1">{profileModalStudent.totalPaid || 'PKR 0'}</div>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-[#6B7185] font-medium text-xs">Outstanding</div>
                        <div className="font-medium text-lg text-rose-600 mt-1">{profileModalStudent.totalOutstanding || 'PKR 0'}</div>
                      </div>
                    </div>
                    <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 shadow-sm">
                      <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider mb-3">Payment History</h3>
                      <div className="text-center text-[#6B7185] py-10 text-xs font-medium">Vouchers and payments for this student appear here once recorded.</div>
                    </div>
                  </div>
                )}

                {/* TIMELINE TAB (real data) */}
                {modalActiveTab === 'Timeline' && (
                  <div className="space-y-4 text-sm">
                    <div className="bg-white border border-[#EBEDF3] rounded-2xl p-5 shadow-sm">
                      <h3 className="font-medium text-[#6B7185] text-xs uppercase tracking-wider mb-3">Activity Timeline</h3>
                      {profileModalStudent.timeline.length === 0 ? (
                        <div className="text-center text-[#6B7185] py-10 text-xs font-medium">No activity yet for this student.</div>
                      ) : (
                        <div className="space-y-3">
                          {profileModalStudent.timeline.map((t, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-3 p-3 rounded-xl bg-slate-50">
                              <div>
                                <div className="font-medium text-slate-900">{t.title}</div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5">{t.desc}</div>
                              </div>
                              <span className="text-xs text-slate-400 font-mono shrink-0">{t.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </div>

      <OnboardStudentModal
        isOpen={showOnboard}
        onClose={() => setShowOnboard(false)}
        onSuccess={() => router.refresh()}
      />
      {resetStudent && (
        <ResetPasswordControl id={resetStudent.id} kind="student" autoOpen onClose={() => setResetStudent(null)} />
      )}
    </PortalLayout>
  );
}

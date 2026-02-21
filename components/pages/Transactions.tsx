"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  Eye,
  ExternalLink,
  FileImage,
  FileText,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useCompanyTransactions } from '@/hooks/useCompanyTransactions';
import { backend } from '@/integrations/backend/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { CompanyTransaction, CompanyTransactionType } from '@/types/database';

const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;

type TransactionFormState = {
  title: string;
  category: string;
  amount: string;
  transactionType: CompanyTransactionType;
  currency: string;
  transactionDate: string;
  description: string;
  reference: string;
  paidBy: string;
  creditedTo: string;
};

type TransactionPayload = Omit<CompanyTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

type ProofMeta = {
  proof_url: string | null;
  proof_type: string | null;
  proof_name: string | null;
};

const TYPE_OPTIONS: Array<{ value: CompanyTransactionType; label: string }> = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'salary', label: 'Salary' },
  { value: 'refund', label: 'Refund' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'investment', label: 'Investment' },
  { value: 'tax', label: 'Tax' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'loan', label: 'Loan' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
];

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

function piePalette(index: number): string {
  const colors = ['#22c55e', '#ef4444', '#0ea5e9', '#a855f7', '#f97316', '#14b8a6', '#eab308', '#ec4899'];
  return colors[index % colors.length];
}

function defaultTransactionFormState(): TransactionFormState {
  return {
    title: '',
    category: 'Operations',
    amount: '',
    transactionType: 'expense',
    currency: 'INR',
    transactionDate: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
    paidBy: '',
    creditedTo: '',
  };
}

function mapTransactionToFormState(transaction: CompanyTransaction): TransactionFormState {
  return {
    title: transaction.title || '',
    category: transaction.category || 'Operations',
    amount: String(transaction.amount || ''),
    transactionType: transaction.transaction_type,
    currency: transaction.currency || 'INR',
    transactionDate: transaction.transaction_date || new Date().toISOString().slice(0, 10),
    description: transaction.description || '',
    reference: transaction.reference || '',
    paidBy: transaction.paid_by || '',
    creditedTo: transaction.credited_to || '',
  };
}

function formatAmount(transaction: Pick<CompanyTransaction, 'currency' | 'amount'>): string {
  const safeAmount = Number.isFinite(Number(transaction.amount)) ? Number(transaction.amount) : 0;
  return `${transaction.currency || 'INR'} ${safeAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isImageProof(transaction: Pick<CompanyTransaction, 'proof_type' | 'proof_url'>): boolean {
  if (!transaction.proof_url) return false;
  return (
    transaction.proof_type?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(transaction.proof_url)
  );
}

function isPdfProof(transaction: Pick<CompanyTransaction, 'proof_type' | 'proof_url'>): boolean {
  if (!transaction.proof_url) return false;
  return transaction.proof_type === 'application/pdf' || /\.pdf(\?|$)/i.test(transaction.proof_url);
}

interface TransactionFormProps {
  form: TransactionFormState;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormState>>;
  proofFile: File | null;
  onProofFileChange: (file: File | null) => void;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  existingProof?: ProofMeta | null;
  removeCurrentProof?: boolean;
  onToggleRemoveCurrentProof?: () => void;
}

function TransactionForm({
  form,
  setForm,
  proofFile,
  onProofFileChange,
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  cancelLabel,
  onCancel,
  existingProof,
  removeCurrentProof,
  onToggleRemoveCurrentProof,
}: TransactionFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2 md:col-span-2">
        <Label>Title</Label>
        <Input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="e.g., Cloud invoice payment"
        />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={form.transactionType} onValueChange={(value: CompanyTransactionType) => setForm((prev) => ({ ...prev, transactionType: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Amount</Label>
        <Input
          type="number"
          value={form.amount}
          onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label>Currency</Label>
        <Input
          value={form.currency}
          onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
          maxLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label>Date</Label>
        <Input
          type="date"
          value={form.transactionDate}
          onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Input
          value={form.category}
          onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Reference</Label>
        <Input
          value={form.reference}
          onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
          placeholder="Invoice/UTR/Receipt"
        />
      </div>

      {form.transactionType === 'expense' ? (
        <div className="space-y-2">
          <Label>Who Paid For It?</Label>
          <Input
            value={form.paidBy}
            onChange={(event) => setForm((prev) => ({ ...prev, paidBy: event.target.value }))}
            placeholder="Name/account who paid"
          />
        </div>
      ) : null}

      {form.transactionType === 'income' ? (
        <div className="space-y-2">
          <Label>Income Credited To (Account)</Label>
          <Input
            value={form.creditedTo}
            onChange={(event) => setForm((prev) => ({ ...prev, creditedTo: event.target.value }))}
            placeholder="Receiving account/person"
          />
        </div>
      ) : null}

      <div className="space-y-2 md:col-span-3">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Add detailed notes. Multi-line supported."
          rows={4}
        />
      </div>

      <div className="space-y-2 md:col-span-3">
        <Label>Transaction Proof (Image/PDF)</Label>
        <Input
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => onProofFileChange(event.target.files?.[0] || null)}
        />
        {proofFile ? (
          <div className="text-xs text-muted-foreground rounded-md bg-muted/30 p-2">
            Selected: {proofFile.name} ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        ) : null}

        {existingProof?.proof_url ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Current proof: {existingProof.proof_name || 'attached file'}</p>
            <a href={existingProof.proof_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
              Open current proof <ExternalLink className="w-3 h-3" />
            </a>
            {onToggleRemoveCurrentProof ? (
              <div>
                <Button variant={removeCurrentProof ? 'destructive' : 'outline'} size="sm" onClick={onToggleRemoveCurrentProof}>
                  {removeCurrentProof ? 'Proof will be removed' : 'Remove current proof'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="md:col-span-3 flex items-center gap-2">
        <Button onClick={() => { void onSubmit(); }} disabled={submitDisabled || submitting}>
          <Upload className="w-4 h-4 mr-2" />
          {submitting ? 'Saving...' : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {cancelLabel || 'Cancel'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function Transactions() {
  const { isManager, isAdmin } = useAuth();
  const { activeWorkspaceId } = useWorkspaceContext();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [type, setType] = useState<'all' | CompanyTransactionType>('all');

  const {
    transactions,
    loading,
    error,
    isCollectionMissing,
    totalCount,
    hasMore,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    fetchAllTransactions,
  } = useCompanyTransactions({
    workspaceId: activeWorkspaceId,
    page,
    pageSize: 20,
    search,
    transactionType: type,
  });

  const [createForm, setCreateForm] = useState<TransactionFormState>(defaultTransactionFormState);
  const [createProofFile, setCreateProofFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<CompanyTransaction | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<CompanyTransaction | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<TransactionFormState>(defaultTransactionFormState);
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [removeEditProof, setRemoveEditProof] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, type]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((transaction) => transaction.transaction_type === 'income')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const expense = transactions
      .filter((transaction) => transaction.transaction_type === 'expense')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [transactions]);

  const monthlyTrend = useMemo(() => {
    const buckets = new Map<string, { month: string; income: number; expense: number }>();

    transactions.forEach((transaction) => {
      const month = (transaction.transaction_date || '').slice(0, 7) || 'Unknown';
      const existing = buckets.get(month) || { month, income: 0, expense: 0 };
      if (transaction.transaction_type === 'income') {
        existing.income += Number(transaction.amount || 0);
      }
      if (transaction.transaction_type === 'expense') {
        existing.expense += Number(transaction.amount || 0);
      }
      buckets.set(month, existing);
    });

    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach((transaction) => {
      counts.set(transaction.transaction_type, (counts.get(transaction.transaction_type) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: typeLabel(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const categoryDistribution = useMemo(() => {
    const categorySums = new Map<string, number>();
    transactions.forEach((transaction) => {
      const key = transaction.category || 'Uncategorized';
      categorySums.set(key, (categorySums.get(key) || 0) + Number(transaction.amount || 0));
    });

    return Array.from(categorySums.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [transactions]);

  const validateProofFile = (file: File): boolean => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      toast({ title: 'Invalid proof file', description: 'Only image files and PDFs are supported.', variant: 'destructive' });
      return false;
    }

    if (file.size > MAX_PROOF_SIZE_BYTES) {
      toast({ title: 'Proof too large', description: 'Max file size is 10MB.', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const uploadProof = async (file: File): Promise<ProofMeta> => {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const objectPath = `transactions/${activeWorkspaceId || 'global'}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeFileName}`;

    const uploadResult = await backend.storage.from('task-attachments').upload(objectPath, file, { upsert: false });
    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const {
      data: { publicUrl },
    } = backend.storage.from('task-attachments').getPublicUrl(objectPath);

    return {
      proof_url: publicUrl,
      proof_type: file.type || null,
      proof_name: file.name || null,
    };
  };

  const buildPayload = (form: TransactionFormState, proof: ProofMeta): TransactionPayload => ({
    workspace_id: activeWorkspaceId,
    transaction_type: form.transactionType,
    category: form.category.trim() || 'General',
    title: form.title.trim(),
    description: form.description.trim() || null,
    amount: Number(form.amount),
    currency: form.currency.trim().toUpperCase() || 'INR',
    transaction_date: form.transactionDate,
    reference: form.reference.trim() || null,
    paid_by: form.paidBy.trim() || null,
    credited_to: form.creditedTo.trim() || null,
    proof_url: proof.proof_url,
    proof_type: proof.proof_type,
    proof_name: proof.proof_name,
  });

  const resetCreateForm = () => {
    setCreateForm(defaultTransactionFormState());
    setCreateProofFile(null);
  };

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.amount) {
      toast({ title: 'Validation error', description: 'Title and amount are required.', variant: 'destructive' });
      return;
    }

    if (Number(createForm.amount) <= 0) {
      toast({ title: 'Validation error', description: 'Amount must be greater than zero.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      let proofMeta: ProofMeta = { proof_url: null, proof_type: null, proof_name: null };

      if (createProofFile) {
        if (!validateProofFile(createProofFile)) {
          setCreating(false);
          return;
        }
        proofMeta = await uploadProof(createProofFile);
      }

      const payload = buildPayload(createForm, proofMeta);
      const { error: createError } = await createTransaction(payload);

      if (createError) {
        toast({ title: 'Failed', description: createError.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Transaction added', description: 'Financial record created successfully.' });
      resetCreateForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload proof';
      toast({ title: 'Create failed', description: message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const openViewMode = (transaction: CompanyTransaction) => {
    setSelectedTransaction(transaction);
    setIsViewOpen(true);
  };

  const openEditMode = (transaction: CompanyTransaction) => {
    setEditingTransaction(transaction);
    setEditForm(mapTransactionToFormState(transaction));
    setEditProofFile(null);
    setRemoveEditProof(false);
    setIsEditOpen(true);
  };

  const closeEditMode = () => {
    setIsEditOpen(false);
    setEditingTransaction(null);
    setEditForm(defaultTransactionFormState());
    setEditProofFile(null);
    setRemoveEditProof(false);
  };

  const handleEditSave = async () => {
    if (!editingTransaction) return;

    if (!isAdmin) {
      toast({ title: 'Not allowed', description: 'Only admin can edit transactions.', variant: 'destructive' });
      return;
    }

    if (!editForm.title.trim() || !editForm.amount) {
      toast({ title: 'Validation error', description: 'Title and amount are required.', variant: 'destructive' });
      return;
    }

    if (Number(editForm.amount) <= 0) {
      toast({ title: 'Validation error', description: 'Amount must be greater than zero.', variant: 'destructive' });
      return;
    }

    setSavingEdit(true);
    try {
      let proofMeta: ProofMeta = {
        proof_url: editingTransaction.proof_url || null,
        proof_type: editingTransaction.proof_type || null,
        proof_name: editingTransaction.proof_name || null,
      };

      if (removeEditProof) {
        proofMeta = { proof_url: null, proof_type: null, proof_name: null };
      }

      if (editProofFile) {
        if (!validateProofFile(editProofFile)) {
          setSavingEdit(false);
          return;
        }
        proofMeta = await uploadProof(editProofFile);
      }

      const payload = buildPayload(editForm, proofMeta);
      const { error: updateError } = await updateTransaction(editingTransaction.id, payload);

      if (updateError) {
        toast({ title: 'Update failed', description: updateError.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Updated', description: 'Transaction updated successfully.' });
      closeEditMode();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update transaction';
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (transactionId: string) => {
    if (!isAdmin) {
      toast({ title: 'Not allowed', description: 'Only admin can delete transactions.', variant: 'destructive' });
      return;
    }

    const { error: deleteError } = await deleteTransaction(transactionId);
    if (deleteError) {
      toast({ title: 'Delete failed', description: deleteError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Deleted', description: 'Transaction removed.' });

    if (editingTransaction?.id === transactionId) {
      closeEditMode();
    }

    if (selectedTransaction?.id === transactionId) {
      setIsViewOpen(false);
      setSelectedTransaction(null);
    }
  };

  const exportTransactionsPdf = async () => {
    const { data, error: fetchError } = await fetchAllTransactions();
    if (fetchError) {
      toast({ title: 'Export failed', description: fetchError.message, variant: 'destructive' });
      return;
    }

    if (!data.length) {
      toast({ title: 'No data', description: 'There are no transactions to export.', variant: 'destructive' });
      return;
    }

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Company Transactions Report', 14, 16);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      head: [[
        'Date',
        'Type',
        'Category',
        'Title',
        'Amount',
        'Paid By',
        'Credited To',
        'Reference',
        'Proof',
        'Description',
      ]],
      body: data.map((transaction) => [
        transaction.transaction_date,
        typeLabel(transaction.transaction_type),
        transaction.category || '',
        transaction.title || '',
        formatAmount(transaction),
        transaction.paid_by || '',
        transaction.credited_to || '',
        transaction.reference || '',
        transaction.proof_name || '',
        transaction.description || '',
      ]),
      columnStyles: {
        3: { cellWidth: 36 },
        9: { cellWidth: 72 },
      },
    });

    doc.save(`company-transactions-${new Date().toISOString().slice(0, 10)}.pdf`);

    toast({ title: 'Export complete', description: 'Transactions PDF downloaded.' });
  };

  if (!isManager) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Restricted</CardTitle>
            </CardHeader>
            <CardContent>
              Only Admin and Manager can view company transactions.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Company Transactions</h1>
            <p className="text-muted-foreground">View mode and edit mode are now fully separated, with per-transaction proof support.</p>
          </div>
          <Button variant="outline" onClick={exportTransactionsPdf}>
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-xl font-semibold">{totals.income.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Expense</p>
                <p className="text-xl font-semibold">{totals.expense.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10"><Wallet className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Net</p>
                <p className="text-xl font-semibold">{totals.net.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionForm
              form={createForm}
              setForm={setCreateForm}
              proofFile={createProofFile}
              onProofFileChange={setCreateProofFile}
              onSubmit={handleCreate}
              submitLabel="Add transaction"
              submitting={creating}
            />
          </CardContent>
        </Card>

        <Tabs defaultValue="ledger" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="analytics">Transactions Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                  <CardTitle>Transaction History</CardTitle>
                  <div className="flex gap-2">
                    <Input placeholder="Search title" value={search} onChange={(event) => setSearch(event.target.value)} className="w-[220px]" />
                    <Select value={type} onValueChange={(value: 'all' | CompanyTransactionType) => setType(value)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {isCollectionMissing ? (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                    {error || 'Company transactions collection is missing in Appwrite. Please create `company_transactions` and reload.'}
                  </div>
                ) : null}

                {loading ? <p>Loading...</p> : transactions.length === 0 ? <p className="text-muted-foreground">No transactions found.</p> : null}

                {transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl border p-4 bg-gradient-to-br from-background to-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-base">{transaction.title}</p>
                        <p className="text-sm text-muted-foreground">{transaction.category} · {transaction.transaction_date}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-1">
                          <Badge variant="outline" className="mb-1 capitalize">{typeLabel(transaction.transaction_type)}</Badge>
                          <p className="font-semibold">{formatAmount(transaction)}</p>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => openViewMode(transaction)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>

                        {isAdmin ? (
                          <>
                            <Button variant="outline" size="icon" onClick={() => openEditMode(transaction)} title="Edit transaction">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDelete(transaction.id)} title="Delete transaction">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div><span className="font-medium text-foreground/80">Paid By:</span> {transaction.paid_by || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Credited To:</span> {transaction.credited_to || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Reference:</span> {transaction.reference || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Proof:</span> {transaction.proof_name || 'No proof'}</div>
                    </div>

                    {transaction.description ? (
                      <div className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-2">{transaction.description}</div>
                    ) : null}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">Page {page} · Total {totalCount}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>Next</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Income vs Expense</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="income" fill="#22c55e" />
                      <Bar dataKey="expense" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transaction Type Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeDistribution} dataKey="value" nameKey="name" outerRadius={110} label>
                        {typeDistribution.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={piePalette(index)} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Top Categories by Amount</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryDistribution}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl">
          {selectedTransaction ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Transaction View Mode
                </DialogTitle>
                <DialogDescription>
                  Read-only audit view. Use edit mode for changes.
                </DialogDescription>
              </DialogHeader>

              <Card className="border-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent">
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold">{selectedTransaction.title}</p>
                      <p className="text-sm text-muted-foreground">{selectedTransaction.category} · {selectedTransaction.transaction_date}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1 capitalize">{typeLabel(selectedTransaction.transaction_type)}</Badge>
                      <p className="text-2xl font-bold">{formatAmount(selectedTransaction)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Paid By</span><p className="font-medium">{selectedTransaction.paid_by || '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Credited To</span><p className="font-medium">{selectedTransaction.credited_to || '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Reference</span><p className="font-medium">{selectedTransaction.reference || '-'}</p></div>
                  </div>

                  {selectedTransaction.description ? (
                    <div className="rounded-md border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                      <p className="whitespace-pre-wrap text-sm">{selectedTransaction.description}</p>
                    </div>
                  ) : null}

                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Proof</p>
                      {selectedTransaction.proof_url ? (
                        <a href={selectedTransaction.proof_url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-primary underline">
                          Open original <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                    </div>

                    {selectedTransaction.proof_url ? (
                      <>
                        <p className="text-sm font-medium inline-flex items-center gap-2">
                          {isImageProof(selectedTransaction) ? <FileImage className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          {selectedTransaction.proof_name || 'Attached proof'}
                        </p>

                        {isImageProof(selectedTransaction) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedTransaction.proof_url}
                            alt={selectedTransaction.proof_name || 'Transaction proof'}
                            className="w-full max-h-[60vh] object-contain rounded-md border bg-background"
                          />
                        ) : null}

                        {isPdfProof(selectedTransaction) ? (
                          <iframe
                            src={selectedTransaction.proof_url}
                            title={selectedTransaction.proof_name || 'Transaction proof PDF'}
                            className="w-full h-[60vh] rounded-md border bg-background"
                          />
                        ) : null}

                        {!isImageProof(selectedTransaction) && !isPdfProof(selectedTransaction) ? (
                          <p className="text-sm text-muted-foreground">Preview not available for this file type. Open original proof instead.</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No proof file attached.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) closeEditMode(); }}>
        <DialogContent className="max-w-3xl">
          {editingTransaction ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5" />
                  Transaction Edit Mode
                </DialogTitle>
                <DialogDescription>
                  Editing controls only. Read-only view remains separate.
                </DialogDescription>
              </DialogHeader>

              <TransactionForm
                form={editForm}
                setForm={setEditForm}
                proofFile={editProofFile}
                onProofFileChange={(file) => {
                  setEditProofFile(file);
                  if (file) {
                    setRemoveEditProof(false);
                  }
                }}
                onSubmit={handleEditSave}
                submitLabel="Save changes"
                submitting={savingEdit}
                submitDisabled={!isAdmin}
                cancelLabel="Cancel edit"
                onCancel={closeEditMode}
                existingProof={{
                  proof_url: editingTransaction.proof_url,
                  proof_type: editingTransaction.proof_type,
                  proof_name: editingTransaction.proof_name,
                }}
                removeCurrentProof={removeEditProof}
                onToggleRemoveCurrentProof={() => {
                  setRemoveEditProof((prev) => !prev);
                  if (!removeEditProof) {
                    setEditProofFile(null);
                  }
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

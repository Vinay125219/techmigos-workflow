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
import { useProjects } from '@/hooks/useProjects';
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
import type {
  CompanyTransaction,
  CompanyTransactionSettlementStatus,
  CompanyTransactionType,
} from '@/types/database';

const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024;

type TransactionFormState = {
  title: string;
  category: string;
  amount: string;
  projectId: string;
  transactionType: CompanyTransactionType;
  settlementStatus: CompanyTransactionSettlementStatus;
  settledOn: string;
  currency: string;
  transactionDate: string;
  description: string;
  reference: string;
  paidBy: string;
  creditedTo: string;
  actualProjectValue: string;
  advanceTaken: string;
  teamMemberCount: string;
  teamAllocationAmount: string;
  companyBufferAmount: string;
  memberPayouts: TeamMemberPayoutFormValue[];
};

type TransactionPayload = Omit<CompanyTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

type ProofMeta = {
  proof_url: string | null;
  proof_type: string | null;
  proof_name: string | null;
};

type TeamMemberPayout = {
  member_name: string;
  amount: number;
};

type TeamMemberPayoutFormValue = {
  memberName: string;
  amount: string;
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

const SETTLEMENT_OPTIONS: Array<{ value: CompanyTransactionSettlementStatus; label: string }> = [
  { value: 'settled', label: 'Settled' },
  { value: 'unsettled', label: 'Unsettled' },
];

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

function settlementLabel(value: CompanyTransactionSettlementStatus): string {
  return SETTLEMENT_OPTIONS.find((option) => option.value === value)?.label || value;
}

function normalizeSettlementStatus(
  transaction: Pick<CompanyTransaction, 'settlement_status'>
): CompanyTransactionSettlementStatus {
  return transaction.settlement_status === 'unsettled' ? 'unsettled' : 'settled';
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseOptionalInteger(value: string): number | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

function parseTeamMemberPayouts(value: string | null): TeamMemberPayout[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const typed = row as { member_name?: unknown; amount?: unknown };
        const memberName = typeof typed.member_name === 'string' ? typed.member_name.trim() : '';
        const amount = Number(typed.amount);
        if (!memberName || !Number.isFinite(amount) || amount <= 0) return null;
        return {
          member_name: memberName,
          amount,
        } as TeamMemberPayout;
      })
      .filter((row): row is TeamMemberPayout => Boolean(row));
  } catch {
    return [];
  }
}

function toPayoutFormValues(value: string | null): TeamMemberPayoutFormValue[] {
  return parseTeamMemberPayouts(value).map((row) => ({
    memberName: row.member_name,
    amount: String(row.amount),
  }));
}

function payoutRowsFromForm(form: TransactionFormState): TeamMemberPayout[] {
  return form.memberPayouts
    .map((row) => ({
      memberName: row.memberName.trim(),
      amount: Number(row.amount),
    }))
    .filter((row) => row.memberName || row.amount > 0)
    .map((row) => {
      if (!row.memberName || !Number.isFinite(row.amount) || row.amount <= 0) return null;
      return {
        member_name: row.memberName,
        amount: Number(row.amount.toFixed(2)),
      } as TeamMemberPayout;
    })
    .filter((row): row is TeamMemberPayout => Boolean(row));
}

function formatPayoutSummary(transaction: Pick<CompanyTransaction, 'team_member_payouts_json' | 'currency'>): string {
  const payouts = parseTeamMemberPayouts(transaction.team_member_payouts_json);
  if (!payouts.length) return '-';
  const total = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  return `${payouts.length} member(s) · ${transaction.currency || 'INR'} ${formatMetricAmount(total)}`;
}

function formatPayoutDetails(transaction: Pick<CompanyTransaction, 'team_member_payouts_json' | 'currency'>): string {
  const payouts = parseTeamMemberPayouts(transaction.team_member_payouts_json);
  if (!payouts.length) return '-';
  return payouts
    .map((payout) => `${payout.member_name}: ${transaction.currency || 'INR'} ${formatMetricAmount(payout.amount)}`)
    .join(', ');
}

function formatMetricAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
    projectId: 'none',
    transactionType: 'expense',
    settlementStatus: 'settled',
    settledOn: new Date().toISOString().slice(0, 10),
    currency: 'INR',
    transactionDate: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
    paidBy: '',
    creditedTo: '',
    actualProjectValue: '',
    advanceTaken: '',
    teamMemberCount: '',
    teamAllocationAmount: '',
    companyBufferAmount: '',
    memberPayouts: [],
  };
}

function mapTransactionToFormState(transaction: CompanyTransaction): TransactionFormState {
  return {
    title: transaction.title || '',
    category: transaction.category || 'Operations',
    amount: String(transaction.amount || ''),
    projectId: transaction.project_id || 'none',
    transactionType: transaction.transaction_type,
    settlementStatus: normalizeSettlementStatus(transaction),
    settledOn: transaction.settled_on || transaction.transaction_date || new Date().toISOString().slice(0, 10),
    currency: transaction.currency || 'INR',
    transactionDate: transaction.transaction_date || new Date().toISOString().slice(0, 10),
    description: transaction.description || '',
    reference: transaction.reference || '',
    paidBy: transaction.paid_by || '',
    creditedTo: transaction.credited_to || '',
    actualProjectValue: transaction.actual_project_value != null ? String(transaction.actual_project_value) : '',
    advanceTaken: transaction.advance_taken != null ? String(transaction.advance_taken) : '',
    teamMemberCount: transaction.team_member_count != null ? String(transaction.team_member_count) : '',
    teamAllocationAmount: transaction.team_allocation_amount != null ? String(transaction.team_allocation_amount) : '',
    companyBufferAmount: transaction.company_buffer_amount != null ? String(transaction.company_buffer_amount) : '',
    memberPayouts: toPayoutFormValues(transaction.team_member_payouts_json),
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
  projectOptions: Array<{ id: string; name: string }>;
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
  projectOptions,
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
  const parsedActualProjectValue = Number(form.actualProjectValue || 0);
  const parsedAdvanceTaken = Number(form.advanceTaken || 0);
  const parsedTeamMemberCount = Number(form.teamMemberCount || 0);
  const parsedTeamAllocationAmount = Number(form.teamAllocationAmount || 0);
  const parsedCompanyBufferAmount = Number(form.companyBufferAmount || 0);
  const validMemberPayoutRows = payoutRowsFromForm(form);
  const memberPayoutTotal = validMemberPayoutRows.reduce((sum, row) => sum + row.amount, 0);
  const effectiveTeamMemberCount = validMemberPayoutRows.length || parsedTeamMemberCount;
  const effectiveTeamAllocation = validMemberPayoutRows.length ? memberPayoutTotal : parsedTeamAllocationAmount;
  const payoutDelta = parsedTeamAllocationAmount - memberPayoutTotal;
  const isPayoutMatched = Math.abs(payoutDelta) < 0.01;
  const projectReceivable = parsedActualProjectValue - parsedAdvanceTaken;
  const teamMemberShare = effectiveTeamMemberCount > 0 ? effectiveTeamAllocation / effectiveTeamMemberCount : 0;
  const projectedCompanyLeft = projectReceivable - effectiveTeamAllocation - parsedCompanyBufferAmount;
  const hasProjectFinanceInput = Boolean(
    form.actualProjectValue ||
      form.advanceTaken ||
      form.teamMemberCount ||
      form.teamAllocationAmount ||
      form.companyBufferAmount ||
      form.memberPayouts.some((row) => row.memberName.trim() || row.amount.trim())
  );

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

      <div className="space-y-2 md:col-span-2">
        <Label>Project</Label>
        <Select value={form.projectId} onValueChange={(value) => setForm((prev) => ({ ...prev, projectId: value }))}>
          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">General / No project</SelectItem>
            {projectOptions.map((project) => (
              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Settlement Status</Label>
        <Select
          value={form.settlementStatus}
          onValueChange={(value: CompanyTransactionSettlementStatus) => {
            setForm((prev) => ({
              ...prev,
              settlementStatus: value,
              settledOn: value === 'settled' ? prev.settledOn || prev.transactionDate : '',
            }));
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SETTLEMENT_OPTIONS.map((option) => (
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

      {form.settlementStatus === 'settled' ? (
        <div className="space-y-2">
          <Label>Settled On</Label>
          <Input
            type="date"
            value={form.settledOn}
            onChange={(event) => setForm((prev) => ({ ...prev, settledOn: event.target.value }))}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Settled On</Label>
          <Input value="Pending settlement" disabled />
        </div>
      )}

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

      <div className="md:col-span-3 rounded-lg border bg-muted/20 p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold">Project Financial Workflow</p>
          <p className="text-xs text-muted-foreground">
            Track actual value, advance, team split, and buffer to keep every project transaction auditable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Actual Project Value</Label>
            <Input
              type="number"
              min={0}
              value={form.actualProjectValue}
              onChange={(event) => setForm((prev) => ({ ...prev, actualProjectValue: event.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Advance Took</Label>
            <Input
              type="number"
              min={0}
              value={form.advanceTaken}
              onChange={(event) => setForm((prev) => ({ ...prev, advanceTaken: event.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Team Members Count</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={form.teamMemberCount}
              onChange={(event) => setForm((prev) => ({ ...prev, teamMemberCount: event.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Total Team Split Amount</Label>
            <Input
              type="number"
              min={0}
              value={form.teamAllocationAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, teamAllocationAmount: event.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Company Buffer Amount</Label>
            <Input
              type="number"
              min={0}
              value={form.companyBufferAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, companyBufferAmount: event.target.value }))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Member-Wise Team Payouts</p>
              <p className="text-xs text-muted-foreground">Capture different pay per team member.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  memberPayouts: [...prev.memberPayouts, { memberName: '', amount: '' }],
                }))
              }
            >
              Add member payout
            </Button>
          </div>

          {form.memberPayouts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No member payout rows added.</p>
          ) : (
            <div className="space-y-2">
              {form.memberPayouts.map((row, index) => (
                <div key={`member-payout-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Member Name</Label>
                    <Input
                      value={row.memberName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          memberPayouts: prev.memberPayouts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, memberName: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder="e.g., Alex / Priya"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Payout Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.amount}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          memberPayouts: prev.memberPayouts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: event.target.value }
                              : item
                          ),
                        }))
                      }
                      placeholder="0"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        memberPayouts: prev.memberPayouts.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    title="Remove payout row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {form.memberPayouts.length > 0 ? (
            <div className="text-xs text-muted-foreground rounded-md bg-muted/30 p-2 space-y-1">
              <p>Member payout total: {form.currency || 'INR'} {formatMetricAmount(memberPayoutTotal)}</p>
              <p>
                Difference vs team split: {form.currency || 'INR'} {formatMetricAmount(Math.abs(payoutDelta))}
                {' '}
                ({isPayoutMatched ? 'matched' : payoutDelta > 0 ? 'team split is higher' : 'member payouts are higher'})
              </p>
            </div>
          ) : null}
        </div>

        {hasProjectFinanceInput ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border bg-background/80 p-3">
              <p className="text-muted-foreground">Balance after advance</p>
              <p className="font-semibold mt-1">{form.currency || 'INR'} {formatMetricAmount(projectReceivable || 0)}</p>
            </div>
            <div className="rounded-md border bg-background/80 p-3">
              <p className="text-muted-foreground">Per member split</p>
              <p className="font-semibold mt-1">{form.currency || 'INR'} {formatMetricAmount(teamMemberShare || 0)}</p>
            </div>
            <div className="rounded-md border bg-background/80 p-3">
              <p className="text-muted-foreground">Projected company remainder</p>
              <p className="font-semibold mt-1">{form.currency || 'INR'} {formatMetricAmount(projectedCompanyLeft || 0)}</p>
            </div>
          </div>
        ) : null}
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
  const [settlementStatus, setSettlementStatus] = useState<'all' | CompanyTransactionSettlementStatus>('all');
  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');

  const { projects } = useProjects({
    workspaceId: activeWorkspaceId,
    page: 1,
    pageSize: 200,
  });

  const projectOptions = useMemo(() => {
    return projects
      .map((project) => ({ id: project.id, name: project.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const projectNameById = useMemo(() => {
    return new Map(projectOptions.map((project) => [project.id, project.name]));
  }, [projectOptions]);

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
    projectId: projectFilter,
    transactionType: type,
    settlementStatus,
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
  }, [search, type, settlementStatus, projectFilter, activeWorkspaceId]);

  const settledTransactions = useMemo(
    () => transactions.filter((transaction) => normalizeSettlementStatus(transaction) === 'settled'),
    [transactions]
  );

  const unsettledTransactions = useMemo(
    () => transactions.filter((transaction) => normalizeSettlementStatus(transaction) === 'unsettled'),
    [transactions]
  );

  const totals = useMemo(() => {
    const income = settledTransactions
      .filter((transaction) => transaction.transaction_type === 'income')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const expense = settledTransactions
      .filter((transaction) => transaction.transaction_type === 'expense')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [settledTransactions]);

  const pendingAmount = useMemo(
    () => unsettledTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    [unsettledTransactions]
  );

  const monthlyTrend = useMemo(() => {
    const buckets = new Map<string, { month: string; income: number; expense: number }>();

    settledTransactions.forEach((transaction) => {
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
  }, [settledTransactions]);

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    settledTransactions.forEach((transaction) => {
      counts.set(transaction.transaction_type, (counts.get(transaction.transaction_type) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name: typeLabel(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [settledTransactions]);

  const categoryDistribution = useMemo(() => {
    const categorySums = new Map<string, number>();
    settledTransactions.forEach((transaction) => {
      const key = transaction.category || 'Uncategorized';
      categorySums.set(key, (categorySums.get(key) || 0) + Number(transaction.amount || 0));
    });

    return Array.from(categorySums.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [settledTransactions]);

  const projectFinanceSummary = useMemo(() => {
    const buckets = new Map<
      string,
      {
        projectName: string;
        settledTotal: number;
        pendingTotal: number;
        actualProjectValue: number;
        advanceTaken: number;
        teamAllocationAmount: number;
        companyBufferAmount: number;
        teamMemberCount: number;
        teamMemberShare: number;
      }
    >();

    transactions.forEach((transaction) => {
      const key = transaction.project_id || 'none';
      const bucket = buckets.get(key) || {
        projectName: key === 'none' ? 'General' : projectNameById.get(key) || 'Archived project',
        settledTotal: 0,
        pendingTotal: 0,
        actualProjectValue: 0,
        advanceTaken: 0,
        teamAllocationAmount: 0,
        companyBufferAmount: 0,
        teamMemberCount: 0,
        teamMemberShare: 0,
      };

      if (normalizeSettlementStatus(transaction) === 'settled') {
        bucket.settledTotal += Number(transaction.amount || 0);
      } else {
        bucket.pendingTotal += Number(transaction.amount || 0);
      }

      bucket.actualProjectValue += Number(transaction.actual_project_value || 0);
      bucket.advanceTaken += Number(transaction.advance_taken || 0);
      bucket.teamAllocationAmount += Number(transaction.team_allocation_amount || 0);
      bucket.companyBufferAmount += Number(transaction.company_buffer_amount || 0);
      if (transaction.team_member_count != null) {
        bucket.teamMemberCount = Number(transaction.team_member_count || 0);
      }
      if (transaction.team_member_share != null) {
        bucket.teamMemberShare = Number(transaction.team_member_share || 0);
      }

      buckets.set(key, bucket);
    });

    return Array.from(buckets.values())
      .map((bucket) => ({
        ...bucket,
        projectedRemainder:
          bucket.actualProjectValue -
          bucket.advanceTaken -
          bucket.teamAllocationAmount -
          bucket.companyBufferAmount,
      }))
      .sort((a, b) => b.settledTotal - a.settledTotal);
  }, [transactions, projectNameById]);

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

  const resolveProjectName = (projectId: string | null): string => {
    if (!projectId) return 'General';
    return projectNameById.get(projectId) || 'Archived project';
  };

  const validateWorkflowForm = (form: TransactionFormState): string | null => {
    if (!form.title.trim() || !form.amount) {
      return 'Title and amount are required.';
    }

    if (Number(form.amount) <= 0) {
      return 'Amount must be greater than zero.';
    }

    if (form.settlementStatus === 'settled' && !form.settledOn) {
      return 'Settled transactions require a settled date.';
    }

    const actualProjectValue = parseOptionalNumber(form.actualProjectValue);
    const advanceTaken = parseOptionalNumber(form.advanceTaken);
    const teamMemberCount = parseOptionalInteger(form.teamMemberCount);
    const teamAllocationAmount = parseOptionalNumber(form.teamAllocationAmount);
    const companyBufferAmount = parseOptionalNumber(form.companyBufferAmount);
    const enteredPayoutRows = form.memberPayouts.filter((row) => row.memberName.trim() || row.amount.trim());
    const hasAnyPayoutInput = enteredPayoutRows.length > 0;
    const validPayoutRows = payoutRowsFromForm(form);
    const payoutTotal = validPayoutRows.reduce((sum, row) => sum + row.amount, 0);

    if (actualProjectValue !== null && actualProjectValue < 0) {
      return 'Actual project value cannot be negative.';
    }

    if (advanceTaken !== null && advanceTaken < 0) {
      return 'Advance amount cannot be negative.';
    }

    if (actualProjectValue !== null && advanceTaken !== null && advanceTaken > actualProjectValue) {
      return 'Advance took cannot exceed actual project value.';
    }

    if (form.teamMemberCount.trim()) {
      if (teamMemberCount === null || teamMemberCount <= 0) {
        return 'Team member count must be a positive whole number.';
      }
    }

    if (teamAllocationAmount !== null && teamAllocationAmount < 0) {
      return 'Team split amount cannot be negative.';
    }

    if (companyBufferAmount !== null && companyBufferAmount < 0) {
      return 'Company buffer amount cannot be negative.';
    }

    if (teamAllocationAmount !== null && !hasAnyPayoutInput && (teamMemberCount === null || teamMemberCount <= 0)) {
      return 'Set team member count before entering team split amount.';
    }

    if (hasAnyPayoutInput) {
      if (enteredPayoutRows.length !== validPayoutRows.length) {
        return 'Each member payout row must include member name and amount greater than zero.';
      }

      if (!validPayoutRows.length) {
        return 'Provide valid member payout rows (member name + amount > 0).';
      }

      const uniqueNameCount = new Set(
        validPayoutRows.map((row) => row.member_name.toLowerCase())
      ).size;
      if (uniqueNameCount !== validPayoutRows.length) {
        return 'Member names in payout rows must be unique.';
      }

      if (teamAllocationAmount === null) {
        return 'Total team split amount is required when member-wise payouts are added.';
      }

      if (Math.abs(teamAllocationAmount - payoutTotal) > 0.01) {
        return 'Total team split amount must match the sum of member payouts.';
      }

      if (teamMemberCount !== null && teamMemberCount > 0 && teamMemberCount !== validPayoutRows.length) {
        return 'Team members count must match the number of member payout rows.';
      }
    }

    return null;
  };

  const buildPayload = (form: TransactionFormState, proof: ProofMeta): TransactionPayload => {
    const actualProjectValue = parseOptionalNumber(form.actualProjectValue);
    const advanceTaken = parseOptionalNumber(form.advanceTaken);
    const manualTeamMemberCount = parseOptionalInteger(form.teamMemberCount);
    const manualTeamAllocationAmount = parseOptionalNumber(form.teamAllocationAmount);
    const companyBufferAmount = parseOptionalNumber(form.companyBufferAmount);
    const memberPayouts = payoutRowsFromForm(form);
    const payoutsTotal = memberPayouts.reduce((sum, row) => sum + row.amount, 0);
    const teamMemberCount = memberPayouts.length > 0 ? memberPayouts.length : manualTeamMemberCount;
    const teamAllocationAmount = memberPayouts.length > 0
      ? Number(payoutsTotal.toFixed(2))
      : manualTeamAllocationAmount;
    const teamMemberShare =
      teamMemberCount && teamAllocationAmount !== null
        ? Number((teamAllocationAmount / teamMemberCount).toFixed(2))
        : null;

    return {
      workspace_id: activeWorkspaceId,
      project_id: form.projectId === 'none' ? null : form.projectId,
      transaction_type: form.transactionType,
      settlement_status: form.settlementStatus,
      settled_on: form.settlementStatus === 'settled' ? form.settledOn || form.transactionDate : null,
      category: form.category.trim() || 'General',
      title: form.title.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount),
      actual_project_value: actualProjectValue,
      advance_taken: advanceTaken,
      team_member_count: teamMemberCount,
      team_allocation_amount: teamAllocationAmount,
      company_buffer_amount: companyBufferAmount,
      team_member_share: teamMemberShare,
      team_member_payouts_json: memberPayouts.length ? JSON.stringify(memberPayouts) : null,
      currency: form.currency.trim().toUpperCase() || 'INR',
      transaction_date: form.transactionDate,
      reference: form.reference.trim() || null,
      paid_by: form.paidBy.trim() || null,
      credited_to: form.creditedTo.trim() || null,
      proof_url: proof.proof_url,
      proof_type: proof.proof_type,
      proof_name: proof.proof_name,
    };
  };

  const resetCreateForm = () => {
    setCreateForm(defaultTransactionFormState());
    setCreateProofFile(null);
  };

  const handleCreate = async () => {
    const validationError = validateWorkflowForm(createForm);
    if (validationError) {
      toast({ title: 'Validation error', description: validationError, variant: 'destructive' });
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

    const validationError = validateWorkflowForm(editForm);
    if (validationError) {
      toast({ title: 'Validation error', description: validationError, variant: 'destructive' });
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
        'Settlement',
        'Project',
        'Type',
        'Category',
        'Title',
        'Amount',
        'Actual Value',
        'Advance',
        'Team Split',
        'Buffer',
        'Per Member',
        'Member Payouts',
        'Settled On',
        'Paid By',
        'Credited To',
        'Reference',
        'Proof',
        'Description',
      ]],
      body: data.map((transaction) => [
        transaction.transaction_date,
        settlementLabel(normalizeSettlementStatus(transaction)),
        resolveProjectName(transaction.project_id || null),
        typeLabel(transaction.transaction_type),
        transaction.category || '',
        transaction.title || '',
        formatAmount(transaction),
        transaction.actual_project_value != null ? formatAmount({ currency: transaction.currency, amount: transaction.actual_project_value }) : '',
        transaction.advance_taken != null ? formatAmount({ currency: transaction.currency, amount: transaction.advance_taken }) : '',
        transaction.team_allocation_amount != null ? formatAmount({ currency: transaction.currency, amount: transaction.team_allocation_amount }) : '',
        transaction.company_buffer_amount != null ? formatAmount({ currency: transaction.currency, amount: transaction.company_buffer_amount }) : '',
        transaction.team_member_share != null ? formatAmount({ currency: transaction.currency, amount: transaction.team_member_share }) : '',
        formatPayoutDetails(transaction),
        transaction.settled_on || '',
        transaction.paid_by || '',
        transaction.credited_to || '',
        transaction.reference || '',
        transaction.proof_name || '',
        transaction.description || '',
      ]),
      columnStyles: {
        5: { cellWidth: 34 },
        18: { cellWidth: 58 },
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
            <p className="text-muted-foreground">
              Project-wise finance workflow with settlement tracking, team split visibility, and proof-backed records.
            </p>
          </div>
          <Button variant="outline" onClick={exportTransactionsPdf}>
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Settled Income</p>
                <p className="text-xl font-semibold">{formatMetricAmount(totals.income)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Settled Expense</p>
                <p className="text-xl font-semibold">{formatMetricAmount(totals.expense)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10"><Wallet className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Settled Net</p>
                <p className="text-xl font-semibold">{formatMetricAmount(totals.net)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10"><Wallet className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Unsettled Pending</p>
                <p className="text-xl font-semibold">{formatMetricAmount(pendingAmount)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>1. Select project and record actual value + advance took.</p>
            <p>2. Enter team split and company buffer to capture allocation logic.</p>
            <p>3. Mark transaction as settled/unsettled and attach proof.</p>
            <p>4. Only settled entries are included in totals and analytics.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionForm
              form={createForm}
              setForm={setCreateForm}
              projectOptions={projectOptions}
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
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Search title"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-[220px]"
                    />
                    <Select value={type} onValueChange={(value: 'all' | CompanyTransactionType) => setType(value)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={settlementStatus} onValueChange={(value: 'all' | CompanyTransactionSettlementStatus) => setSettlementStatus(value)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All settlements</SelectItem>
                        {SETTLEMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={projectFilter} onValueChange={(value: 'all' | string) => setProjectFilter(value)}>
                      <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All projects</SelectItem>
                        <SelectItem value="none">General / No project</SelectItem>
                        {projectOptions.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
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

                {!loading && projectFinanceSummary.length > 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Project-Wise Finance Snapshot</p>
                      <p className="text-xs text-muted-foreground">Current page summary</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {projectFinanceSummary.slice(0, 6).map((project, index) => (
                        <div key={`${project.projectName}-${index}`} className="rounded-lg border bg-background p-3 text-xs space-y-1">
                          <p className="font-medium text-sm">{project.projectName}</p>
                          <p><span className="text-muted-foreground">Settled:</span> {formatMetricAmount(project.settledTotal)}</p>
                          <p><span className="text-muted-foreground">Pending:</span> {formatMetricAmount(project.pendingTotal)}</p>
                          <p><span className="text-muted-foreground">Actual Value:</span> {formatMetricAmount(project.actualProjectValue)}</p>
                          <p><span className="text-muted-foreground">Advance:</span> {formatMetricAmount(project.advanceTaken)}</p>
                          <p><span className="text-muted-foreground">Team Split:</span> {formatMetricAmount(project.teamAllocationAmount)}</p>
                          <p><span className="text-muted-foreground">Buffer:</span> {formatMetricAmount(project.companyBufferAmount)}</p>
                          <p><span className="text-muted-foreground">Projected Remainder:</span> {formatMetricAmount(project.projectedRemainder)}</p>
                          {project.teamMemberCount > 0 ? (
                            <p><span className="text-muted-foreground">Per Member:</span> {formatMetricAmount(project.teamMemberShare)}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-xl border p-4 bg-gradient-to-br from-background to-muted/20 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-base">{transaction.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.category} · {transaction.transaction_date} · {resolveProjectName(transaction.project_id || null)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-1">
                          <div className="flex items-center justify-end gap-1 mb-1">
                            <Badge variant="outline" className="capitalize">{typeLabel(transaction.transaction_type)}</Badge>
                            <Badge
                              variant="outline"
                              className={normalizeSettlementStatus(transaction) === 'settled'
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                                : 'border-amber-500/50 bg-amber-500/10 text-amber-700'}
                            >
                              {settlementLabel(normalizeSettlementStatus(transaction))}
                            </Badge>
                          </div>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div><span className="font-medium text-foreground/80">Paid By:</span> {transaction.paid_by || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Credited To:</span> {transaction.credited_to || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Reference:</span> {transaction.reference || '-'}</div>
                      <div><span className="font-medium text-foreground/80">Proof:</span> {transaction.proof_name || 'No proof'}</div>
                      <div><span className="font-medium text-foreground/80">Actual Value:</span> {transaction.actual_project_value != null ? formatAmount({ currency: transaction.currency, amount: transaction.actual_project_value }) : '-'}</div>
                      <div><span className="font-medium text-foreground/80">Advance Took:</span> {transaction.advance_taken != null ? formatAmount({ currency: transaction.currency, amount: transaction.advance_taken }) : '-'}</div>
                      <div><span className="font-medium text-foreground/80">Team Split:</span> {transaction.team_allocation_amount != null ? formatAmount({ currency: transaction.currency, amount: transaction.team_allocation_amount }) : '-'}</div>
                      <div><span className="font-medium text-foreground/80">Buffer:</span> {transaction.company_buffer_amount != null ? formatAmount({ currency: transaction.currency, amount: transaction.company_buffer_amount }) : '-'}</div>
                      <div><span className="font-medium text-foreground/80">Per Member:</span> {transaction.team_member_share != null ? formatAmount({ currency: transaction.currency, amount: transaction.team_member_share }) : '-'}</div>
                      <div><span className="font-medium text-foreground/80">Member Payouts:</span> {formatPayoutSummary(transaction)}</div>
                      <div><span className="font-medium text-foreground/80">Settled On:</span> {transaction.settled_on || '-'}</div>
                    </div>

                    {parseTeamMemberPayouts(transaction.team_member_payouts_json).length > 0 ? (
                      <div className="text-xs text-muted-foreground rounded-md bg-muted/25 p-2">
                        <span className="font-medium text-foreground/80">Payout Details: </span>
                        {formatPayoutDetails(transaction)}
                      </div>
                    ) : null}

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
                  <CardTitle>Monthly Settled Income vs Expense</CardTitle>
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
                  <CardTitle>Settled Transaction Type Distribution</CardTitle>
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
                  <CardTitle>Top Categories by Settled Amount</CardTitle>
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
                      <p className="text-sm text-muted-foreground">
                        {selectedTransaction.category} · {selectedTransaction.transaction_date} · {resolveProjectName(selectedTransaction.project_id || null)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 mb-1">
                        <Badge variant="outline" className="capitalize">{typeLabel(selectedTransaction.transaction_type)}</Badge>
                        <Badge
                          variant="outline"
                          className={normalizeSettlementStatus(selectedTransaction) === 'settled'
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                            : 'border-amber-500/50 bg-amber-500/10 text-amber-700'}
                        >
                          {settlementLabel(normalizeSettlementStatus(selectedTransaction))}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold">{formatAmount(selectedTransaction)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Project</span><p className="font-medium">{resolveProjectName(selectedTransaction.project_id || null)}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Settled On</span><p className="font-medium">{selectedTransaction.settled_on || '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Paid By</span><p className="font-medium">{selectedTransaction.paid_by || '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Credited To</span><p className="font-medium">{selectedTransaction.credited_to || '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Reference</span><p className="font-medium">{selectedTransaction.reference || '-'}</p></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Actual Project Value</span><p className="font-medium">{selectedTransaction.actual_project_value != null ? formatAmount({ currency: selectedTransaction.currency, amount: selectedTransaction.actual_project_value }) : '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Advance Took</span><p className="font-medium">{selectedTransaction.advance_taken != null ? formatAmount({ currency: selectedTransaction.currency, amount: selectedTransaction.advance_taken }) : '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Team Split</span><p className="font-medium">{selectedTransaction.team_allocation_amount != null ? formatAmount({ currency: selectedTransaction.currency, amount: selectedTransaction.team_allocation_amount }) : '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Company Buffer</span><p className="font-medium">{selectedTransaction.company_buffer_amount != null ? formatAmount({ currency: selectedTransaction.currency, amount: selectedTransaction.company_buffer_amount }) : '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Team Members</span><p className="font-medium">{selectedTransaction.team_member_count ?? '-'}</p></div>
                    <div className="rounded-md border p-3"><span className="text-muted-foreground">Per Member Share</span><p className="font-medium">{selectedTransaction.team_member_share != null ? formatAmount({ currency: selectedTransaction.currency, amount: selectedTransaction.team_member_share }) : '-'}</p></div>
                    <div className="rounded-md border p-3 md:col-span-3"><span className="text-muted-foreground">Member-Wise Payouts</span><p className="font-medium">{formatPayoutDetails(selectedTransaction)}</p></div>
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
                projectOptions={projectOptions}
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

import { Fragment } from 'react'
import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import { formatUkDate } from './formatting'
import type { CodeVerifyResult } from './adminFoodManagement.types'
import { canRedeemApplication, getApplicationPackageLabel, getApplicationStatusLabel } from './rules'
import { EditorActions, InlineEditor, InlineMessagePanel, renderModalField, renderModalFieldRow, type ModalFieldConfig } from './modalBits'

interface CodeVerifyModalProps {
  isOpen: boolean
  code: string
  result: CodeVerifyResult | null
  checking: boolean
  redeeming: boolean
  onClose: () => void
  onCodeChange: (value: string) => void
  onCheck: () => Promise<void>
  onRedeem: () => Promise<void>
}

interface CodeDetailsModalProps {
  record: AdminApplicationRecord | null
  isOpen: boolean
  onClose: () => void
}

function CodeVerifyResultPanel({ result }: { result: CodeVerifyResult | null }) {
  if (!result) return null
  return (
    <InlineMessagePanel tone={result.tone === 'info' ? 'warning' : result.tone} title={result.title} className="admin-code-result-panel">
      {result.message.split('\n').filter(Boolean).map((line) => <p key={line} className="admin-inline-message-line">{line}</p>)}
    </InlineMessagePanel>
  )
}

function CodeDetailsSection({ record }: { record: AdminApplicationRecord }) {
  const rows: ModalFieldConfig[][] = [
    [
      { key: 'code', kind: 'readonly', label: 'Redemption Code', value: record.redemption_code },
      { key: 'status', kind: 'readonly', label: 'Status', value: getApplicationStatusLabel(record) },
    ],
    [
      { key: 'package', kind: 'readonly', label: 'Package', value: getApplicationPackageLabel(record) },
      { key: 'redeemedAt', kind: 'readonly', label: 'Redeemed At', value: formatUkDate(record.redeemed_at) },
    ],
  ]

  return <>{rows.map((fields, rowIndex) => <Fragment key={`code-details-${rowIndex}`}>{renderModalFieldRow(fields)}</Fragment>)}</>
}

export function CodeVerifyModal({ isOpen, code, result, checking, redeeming, onClose, onCodeChange, onCheck, onRedeem }: CodeVerifyModalProps) {
  const isBusy = checking || redeeming
  return (
    <InlineEditor id="verify-code-editor" isOpen={isOpen} onClose={onClose} disableClose={isBusy} title="Verify Redemption Code">
      {renderModalField({ key: 'code', kind: 'text', label: 'Redemption Code', value: code, onChange: onCodeChange, placeholder: 'Enter redemption code', disabled: isBusy })}
      <CodeVerifyResultPanel result={result} />
      <EditorActions actions={[
        { label: 'Cancel', tone: 'secondary', onClick: onClose, disabled: isBusy },
        { label: checking ? 'Checking...' : 'Check Code', tone: 'secondary', onClick: () => void onCheck(), disabled: isBusy },
        { label: redeeming ? 'Redeeming...' : 'Redeem Code', onClick: () => void onRedeem(), disabled: isBusy || !result?.record || !canRedeemApplication(result.record) },
      ]} />
    </InlineEditor>
  )
}

export function CodeDetailsModal({ record, isOpen, onClose }: CodeDetailsModalProps) {
  if (!isOpen || !record) return null
  return (
    <InlineEditor id="view-code-editor" isOpen={isOpen} onClose={onClose} title="Redemption Code Details">
      <CodeDetailsSection record={record} />
      <EditorActions actions={[{ label: 'Close', tone: 'secondary', onClick: onClose }]} />
    </InlineEditor>
  )
}

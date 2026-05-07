import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import adminStyles from "./admin.module.css";
import type { CodeVerifyResult } from "./adminFoodManagement.types";
import { formatUkDate } from "./formatting";
import {
  AdminInlineFeedback,
  AdminModalShell,
  EditorActions,
  InlineModalField,
  InlineModalFieldRow,
  type ModalFieldConfig,
} from "./modalBits.editors.containers";
import {
  canRedeemApplication,
  getApplicationPackageLabel,
  getApplicationStatusLabel,
} from "./rules";

function CodeDetailsSection({ record }: { record: AdminApplicationRecord }) {
  const rows: ModalFieldConfig[][] = [
    [
      {
        key: "code",
        kind: "readonly",
        label: "Redemption Code",
        value: record.redemption_code,
      },
      {
        key: "status",
        kind: "readonly",
        label: "Status",
        value: getApplicationStatusLabel(record),
      },
    ],
    [
      {
        key: "package",
        kind: "readonly",
        label: "Package",
        value: getApplicationPackageLabel(record),
      },
      {
        key: "redeemedAt",
        kind: "readonly",
        label: "Redeemed At",
        value: formatUkDate(record.redeemed_at),
      },
    ],
  ];

  return (
    <>
      {rows.map((fields, rowIndex) => (
        <InlineModalFieldRow key={`code-details-${rowIndex}`} fields={fields} />
      ))}
    </>
  );
}

function CodeVerifyResultPanel({
  result,
}: {
  result: CodeVerifyResult | null;
}) {
  if (!result) {
    return null;
  }

  // Non-valid code states still need to stand out to the operator, so map
  // informational result tones onto the warning banner styling here.
  return (
    <AdminInlineFeedback
      tone={result.tone === "info" ? "warning" : result.tone}
      title={result.title}
    >
      {result.message
        .split("\n")
        .filter(Boolean)
        .map((line) => (
          <p key={line} className={adminStyles["admin-inline-message-line"]}>
            {line}
          </p>
        ))}
    </AdminInlineFeedback>
  );
}

export function CodeDetailsModal({
  record,
  isOpen,
  onClose,
}: {
  record: AdminApplicationRecord | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !record) {
    return null;
  }

  return (
    <AdminModalShell
      id="view-code-editor"
      isOpen={isOpen}
      onClose={onClose}
      title="Redemption Code Details"
    >
      <CodeDetailsSection record={record} />
      <EditorActions
        actions={[{ label: "Close", tone: "secondary", onClick: onClose }]}
      />
    </AdminModalShell>
  );
}

export function CodeVerifyModal({
  isOpen,
  code,
  result,
  checking,
  redeeming,
  onClose,
  onCodeChange,
  onCheck,
  onRedeem,
}: {
  isOpen: boolean;
  code: string;
  result: CodeVerifyResult | null;
  checking: boolean;
  redeeming: boolean;
  onClose: () => void;
  onCodeChange: (value: string) => void;
  onCheck: () => Promise<void>;
  onRedeem: () => Promise<void>;
}) {
  const isBusy = checking || redeeming;

  return (
    <AdminModalShell
      id="verify-code-editor"
      isOpen={isOpen}
      onClose={onClose}
      disableClose={isBusy}
      title="Verify Redemption Code"
    >
      <InlineModalField
        field={{
          key: "code",
          kind: "text",
          label: "Redemption Code",
          value: code,
          onChange: onCodeChange,
          placeholder: "Enter redemption code",
          disabled: isBusy,
        }}
      />
      <CodeVerifyResultPanel result={result} />
      <EditorActions
        actions={[
          {
            label: "Cancel",
            tone: "secondary",
            onClick: onClose,
            disabled: isBusy,
          },
          {
            label: checking ? "Checking..." : "Check Code",
            tone: "secondary",
            onClick: () => void onCheck(),
            disabled: isBusy,
          },
          {
            label: redeeming ? "Redeeming..." : "Redeem Code",
            onClick: () => void onRedeem(),
            disabled:
              isBusy || !result?.record || !canRedeemApplication(result.record),
          },
        ]}
      />
    </AdminModalShell>
  );
}

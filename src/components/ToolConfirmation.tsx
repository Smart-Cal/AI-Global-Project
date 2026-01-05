/**
 * Tool Confirmation Components
 *
 * Tool Execution Confirmation UI
 * - InlineConfirmation: Inline confirmation for medium risk
 * - ModalConfirmation: Modal confirmation for high risk
 */

import React, { useState } from 'react';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from './Icons';

// Risk Levels
type RiskLevel = 'low' | 'medium' | 'high';

// Tool Execution Info
interface ToolExecutionInfo {
  id: string;
  toolName: string;
  toolDisplayName: string;
  riskLevel: RiskLevel;
  preview?: {
    title?: string;
    description?: string;
    details?: Record<string, string>;
  };
  expiresAt?: Date;
}

// Styles by Risk Level
const riskStyles: Record<RiskLevel, { bg: string; border: string; text: string; icon: string }> = {
  low: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', icon: '✓' },
  medium: { bg: '#FEF3C7', border: '#FCD34D', text: '#B45309', icon: '⚡' },
  high: { bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626', icon: '⚠️' },
};

// Risk Labels
const riskLabels: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface InlineConfirmationProps {
  execution: ToolExecutionInfo;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  isLoading?: boolean;
}

/**
 * InlineConfirmation - Inline confirmation UI within chat messages
 * Used for medium risk tools
 */
export const InlineConfirmation: React.FC<InlineConfirmationProps> = ({
  execution,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const style = riskStyles[execution.riskLevel];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="inline-confirmation"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '12px',
        padding: '12px 16px',
        marginTop: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: style.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          {style.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: style.text }}>{execution.toolDisplayName}</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: style.border,
                color: style.text,
              }}
            >
              {riskLabels[execution.riskLevel]}
            </span>
          </div>

          {execution.preview && (
            <div style={{ marginBottom: '8px' }}>
              {execution.preview.title && (
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{execution.preview.title}</div>
              )}
              {execution.preview.description && (
                <div style={{ fontSize: '13px', color: '#6B7280' }}>{execution.preview.description}</div>
              )}
              {execution.preview.details && Object.keys(execution.preview.details).length > 0 && (
                <>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: style.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 0',
                      textDecoration: 'underline',
                    }}
                  >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                  </button>
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.5)',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      {Object.entries(execution.preview.details).map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ color: '#6B7280', minWidth: '60px' }}>{key}:</span>
                          <span style={{ fontWeight: 500 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {execution.expiresAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9CA3AF', marginBottom: '8px' }}>
              <ClockIcon size={12} />
              <span>Expires: {formatTimeRemaining(execution.expiresAt)}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onConfirm(execution.id)}
              disabled={isLoading}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#10B981',
                color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <CheckCircleIcon size={14} />
              Execute
            </button>
            <button
              onClick={() => onCancel(execution.id)}
              disabled={isLoading}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                background: 'white',
                color: '#6B7280',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              <XCircleIcon size={14} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ModalConfirmationProps {
  execution: ToolExecutionInfo;
  isOpen: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  isLoading?: boolean;
}

/**
 * ModalConfirmation - Modal confirmation UI for high risk tools
 * Used for deletions, external service integrations, etc.
 */
export const ModalConfirmation: React.FC<ModalConfirmationProps> = ({
  execution,
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const style = riskStyles[execution.riskLevel];

  return (
    <div
      className="modal-overlay"
      onClick={() => !isLoading && onCancel(execution.id)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '400px',
          width: '90%',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: style.bg,
            padding: '20px',
            borderBottom: `1px solid ${style.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: style.border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}
            >
              {style.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px', color: style.text }}>
                {execution.toolDisplayName}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: style.text,
                  marginTop: '2px',
                }}
              >
                Risk Level: {riskLabels[execution.riskLevel]}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px', color: '#374151' }}>
            Execute this action? {execution.riskLevel === 'high' && 'This action might be irreversible.'}
          </div>

          {execution.preview && (
            <div
              style={{
                background: '#F9FAFB',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
              }}
            >
              {execution.preview.title && (
                <div style={{ fontWeight: 500, marginBottom: '8px' }}>{execution.preview.title}</div>
              )}
              {execution.preview.description && (
                <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                  {execution.preview.description}
                </div>
              )}
              {execution.preview.details && Object.keys(execution.preview.details).length > 0 && (
                <div style={{ fontSize: '13px' }}>
                  {Object.entries(execution.preview.details).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#9CA3AF', minWidth: '80px' }}>{key}:</span>
                      <span style={{ fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {execution.expiresAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: '#9CA3AF',
                marginBottom: '16px',
              }}
            >
              <ClockIcon size={12} />
              <span>Expires: {formatTimeRemaining(execution.expiresAt)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px 20px',
            background: '#F9FAFB',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          <button
            onClick={() => onCancel(execution.id)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              background: 'white',
              color: '#374151',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(execution.id)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: execution.riskLevel === 'high' ? '#DC2626' : '#10B981',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Processing...' : execution.riskLevel === 'high' ? 'Confirm & Execute' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Format Remaining Time
 */
function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  }
  return `${seconds}s remaining`;
}

/**
 * Tool Execution List Component
 */
interface PendingExecutionsListProps {
  executions: ToolExecutionInfo[];
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  loadingId?: string;
}

export const PendingExecutionsList: React.FC<PendingExecutionsListProps> = ({
  executions,
  onConfirm,
  onCancel,
  loadingId,
}) => {
  const [modalExecution, setModalExecution] = useState<ToolExecutionInfo | null>(null);

  if (executions.length === 0) return null;

  const handleConfirm = (id: string) => {
    const execution = executions.find((e) => e.id === id);
    if (execution?.riskLevel === 'high') {
      setModalExecution(execution);
    } else {
      onConfirm(id);
    }
  };

  const handleModalConfirm = (id: string) => {
    onConfirm(id);
    setModalExecution(null);
  };

  const handleModalCancel = (id: string) => {
    onCancel(id);
    setModalExecution(null);
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#6B7280',
          marginBottom: '8px',
          textTransform: 'uppercase',
        }}
      >
        Pending Actions ({executions.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {executions.map((execution) => (
          <InlineConfirmation
            key={execution.id}
            execution={execution}
            onConfirm={handleConfirm}
            onCancel={onCancel}
            isLoading={loadingId === execution.id}
          />
        ))}
      </div>

      {modalExecution && (
        <ModalConfirmation
          execution={modalExecution}
          isOpen={true}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isLoading={loadingId === modalExecution.id}
        />
      )}
    </div>
  );
};

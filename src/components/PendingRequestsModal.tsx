// TEAM_012: PendingRequestsModal 重構 - 套用通用 BaseModal
import React from 'react';
import { User } from '../types';
import { UserCheck, Check, X, Inbox } from 'lucide-react';
import { BaseModal } from './common/BaseModal';
import styles from './PendingRequestsModal.module.css';

interface PendingRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingRequests: User[];
  onAccept: (userId: number) => Promise<void>;
  onReject: (userId: number) => Promise<void>;
}

export const PendingRequestsModal: React.FC<PendingRequestsModalProps> = ({
  isOpen,
  onClose,
  pendingRequests,
  onAccept,
  onReject,
}) => {
  if (!isOpen) return null;

  const getDisplayName = (u: User) => u.display_name || u.account_id;
  const getAccountTag = (u: User) => `@${u.account_id}`;
  const getFirstLetter = (u: User) => getDisplayName(u).charAt(0).toUpperCase();

  const titleNode = (
    <div className={styles.headerTitleBox}>
      <span>待處理好友邀請</span>
      {pendingRequests.length > 0 && (
        <span className={styles.countBadge}>{pendingRequests.length}</span>
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={titleNode}
      icon={<UserCheck size={20} />}
      maxWidth="460px"
    >
      {pendingRequests.length === 0 ? (
        <div className={styles.emptyState}>
          <Inbox size={40} opacity={0.4} />
          <p>目前沒有待處理的好友邀請</p>
        </div>
      ) : (
        <div className={styles.requestsList}>
          {pendingRequests.map((req) => (
            <div key={req.id} className={styles.requestCard}>
              <div className={styles.userInfo}>
                <div className={styles.avatar}>{getFirstLetter(req)}</div>
                <div className={styles.meta}>
                  <div className={styles.name}>{getDisplayName(req)}</div>
                  <div className={styles.handle}>{getAccountTag(req)}</div>
                </div>
              </div>

              <div className={styles.actionGroup}>
                <button
                  className={styles.acceptBtn}
                  onClick={() => onAccept(req.id)}
                  title="同意好友邀請"
                >
                  <Check size={16} />
                </button>
                <button
                  className={styles.rejectBtn}
                  onClick={() => onReject(req.id)}
                  title="拒絕好友邀請"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseModal>
  );
};

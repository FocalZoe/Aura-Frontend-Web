// Context: [側邊欄頂部個人資訊] 簡約大方的個人身份區塊，點擊頭像或區塊開啟個人資料編輯名片
import React from 'react';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';
import { ChevronRight } from 'lucide-react';
import styles from '../Sidebar.module.css';

interface SidebarHeaderProps {
  user: User | null;
  onOpenMyProfile: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  user,
  onOpenMyProfile,
}) => {
  const displayName = user?.display_name || user?.account_id || '';

  return (
    <div
      className={styles.sidebarHeader}
      onClick={onOpenMyProfile}
      title="點擊查看或編輯個人資料"
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.userProfile}>
        <Avatar
          src={user?.avatar}
          name={displayName}
          size={42}
          isOnline={true}
        />
        <div className={styles.profileInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <h3>{displayName}</h3>
          </div>
          <p>@{user?.account_id}</p>
          {user?.bio && (
            <p className={styles.userBioPreview}>{user.bio}</p>
          )}
        </div>
      </div>

      <div className={styles.headerRightAction}>
        <span className={styles.viewProfileTip}>
          <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
};


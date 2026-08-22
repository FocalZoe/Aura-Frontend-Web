import React, { useContext, useEffect, useState, MouseEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { UserSearchModal } from './UserSearchModal';
import { UserProfileModal } from './UserProfileModal';
import { PendingRequestsModal } from './PendingRequestsModal';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupMembersModal } from './GroupMembersModal';
import { User, Group } from '../types';

import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarTabs } from './sidebar/SidebarTabs';
import { FriendList } from './sidebar/FriendList';
import { StrangerList } from './sidebar/StrangerList';
import { UserContextMenu } from './sidebar/UserContextMenu';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { apiClient } from '../services/apiClient';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const { user, logout, token, API_BASE } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { notify } = useNotification();

  const {
    activeChatUser,
    setActiveChatUser,
    unreadCounts,
    incomingStrangerUsers,
    sentStrangerUsers,
    onlineUsers,
    groups,
    setGroups,
    activeGroup,
    setActiveGroup,
    removeConversation,
    removeGroup,
    friends,
    setFriends,
    pendingRequests,
    setPendingRequests,
  } = useChatStore();

  const isUserOnline = (id: number) => onlineUsers.includes(Number(id));

  const {
    currentTab,
    setCurrentTab,
    showSearchModal,
    setShowSearchModal,
    showPendingModal,
    setShowPendingModal,
    showGroupMembersModal,
    setShowGroupMembersModal,
    setActiveGroupForModal,
    selectedProfileUser,
    setSelectedProfileUser,
    contextMenu,
    setContextMenu,
    showConfirmModal,
  } = useUIStore();

  const chatUsers = React.useMemo(() => {
    const friendIds = new Set(friends.map((f) => f.id));
    const uniqueSentStrangers = (sentStrangerUsers || []).filter((s) => !friendIds.has(s.id));
    return [...friends, ...uniqueSentStrangers];
  }, [friends, sentStrangerUsers]);

  const fetchFriendsAndPendingAndGroups = async () => {
    if (!token) return;

    try {
      const friendsData = await apiClient.get<User[]>('/friends', token);
      if (Array.isArray(friendsData)) {
        setFriends(friendsData);
      }
    } catch (e) {
      console.error('獲取好友清單失敗:', e);
    }

    try {
      const pendingData = await apiClient.get<User[]>('/friends/pending', token);
      if (Array.isArray(pendingData)) {
        setPendingRequests(pendingData);
      }
    } catch (e) {
      console.error('獲取待處理邀請失敗:', e);
    }

    try {
      const groupsData = await apiClient.get<Group[]>('/groups', token);
      if (Array.isArray(groupsData)) {
        setGroups(groupsData);
      }
    } catch (e) {
      console.error('獲取群組清單失敗:', e);
    }
  };

  useEffect(() => {
    fetchFriendsAndPendingAndGroups();

    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [token, API_BASE]);

  const handleSendFriendRequest = async (accountID: string) => {
    setContextMenu(null);
    try {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ account_id: accountID }),
      });
      const data = await res.json();
      if (res.ok) {
        notify({ message: '好友邀請已成功發送！', type: 'success' });
        fetchFriendsAndPendingAndGroups();
      } else {
        notify({ message: data.error || '發送好友邀請失敗', type: 'danger' });
      }
    } catch (err: any) {
      notify({ message: err.message || '發送好友邀請失敗', type: 'danger' });
    }
  };

  const handleConfirmDeleteFriend = (targetUser: User) => {
    setContextMenu(null);
    const name = targetUser.display_name || targetUser.account_id;
    showConfirmModal({
      title: '刪除好友關係',
      message: `確定要刪除好友「${name}」嗎？刪除後將無法繼續互相發送訊息。`,
      danger: true,
      confirmText: '確認刪除',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/friends/reject/${targetUser.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            if (activeChatUser?.id === targetUser.id) {
              setActiveChatUser(null);
            }
            notify({ message: `已移除好友 ${name}`, type: 'info' });
            fetchFriendsAndPendingAndGroups();
          }
        } catch (err: any) {
          notify({ message: err.message || '刪除失敗', type: 'danger' });
        }
      },
    });
  };

  const handleConfirmBlockUser = (targetUser: User) => {
    setContextMenu(null);
    const name = targetUser.display_name || targetUser.account_id;
    showConfirmModal({
      title: '確認封鎖使用者',
      message: `確定要封鎖「${name}」嗎？封鎖後將無法接收對方的訊息與邀請。`,
      danger: true,
      confirmText: '確定封鎖',
      onConfirm: async () => {
        try {
          await apiClient.post(`/blocks/${targetUser.id}`, {}, token);
          if (activeChatUser?.id === targetUser.id) {
            setActiveChatUser(null);
          }
          notify({ message: `已將「${name}」加入封鎖名單`, type: 'warning' });
          fetchFriendsAndPendingAndGroups();
        } catch (err: any) {
          notify({ message: err.message || '封鎖失敗', type: 'danger' });
        }
      },
    });
  };

  const handleConfirmRemoveChatroom = (id: number, isGroup = false) => {
    setContextMenu(null);
    const targetName = isGroup
      ? groups.find((g) => g.id === id)?.name || '群組'
      : chatUsers.find((u) => u.id === id)?.display_name || '使用者';

    showConfirmModal({
      title: '確認移除聊天室',
      message: `確定要移除與「${targetName}」的聊天室嗎？這將會清除當前的對話紀錄與聊天列表。`,
      danger: true,
      confirmText: '移除聊天室',
      onConfirm: async () => {
        try {
          if (!isGroup) {
            await apiClient.delete(`/messages/conversations/${id}`, token);
          }
          removeConversation(id, isGroup);
          notify({ message: `已移除聊天室「${targetName}」`, type: 'info' });
        } catch (err: any) {
          notify({ message: err.message || '移除失敗', type: 'danger' });
        }
      },
    });
  };

  const handleConfirmLeaveGroup = (group: Group) => {
    setContextMenu(null);
    showConfirmModal({
      title: '確認退出群組',
      message: `確定要退出群組「${group.name}」嗎？`,
      danger: true,
      confirmText: '退出群組',
      onConfirm: async () => {
        try {
          await apiClient.post(`/groups/${group.id}/leave`, {}, token);
          removeGroup(group.id);
          notify({ message: `已退出群組「${group.name}」`, type: 'info' });
        } catch (err: any) {
          notify({ message: err.message || '退出群組失敗', type: 'danger' });
        }
      },
    });
  };

  const handleConfirmDeleteGroup = (group: Group) => {
    setContextMenu(null);
    showConfirmModal({
      title: '確認解散群組',
      message: `確定要解散群組「${group.name}」嗎？此操作無法恢復！`,
      danger: true,
      confirmText: '解散群組',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/groups/${group.id}`, token);
          removeGroup(group.id);
          notify({ message: `群組「${group.name}」已解散`, type: 'warning' });
        } catch (err: any) {
          notify({ message: err.message || '解散群組失敗', type: 'danger' });
        }
      },
    });
  };

  const handleContextMenuUser = (e: MouseEvent, targetUser: User) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetUser,
    });
  };

  const handleContextMenuGroup = (e: MouseEvent, targetGroup: Group) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetGroup,
    });
  };

  const handleAcceptRequest = async (targetUserId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/friends/accept/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        notify({ message: '已成功同意好友邀請！', type: 'success' });
        fetchFriendsAndPendingAndGroups();
      } else {
        const data = await res.json();
        notify({ message: data.error || '同意邀請失敗', type: 'danger' });
      }
    } catch (err: any) {
      notify({ message: err.message || '操作失敗', type: 'danger' });
    }
  };

  const handleRejectRequest = async (targetUserId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/friends/reject/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        notify({ message: '已拒絕好友邀請', type: 'info' });
        fetchFriendsAndPendingAndGroups();
      } else {
        const data = await res.json();
        notify({ message: data.error || '拒絕邀請失敗', type: 'danger' });
      }
    } catch (err: any) {
      notify({ message: err.message || '操作失敗', type: 'danger' });
    }
  };

  return (
    <div className={styles.sidebar}>
      <SidebarHeader
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenSettings={onOpenSettings}
        onOpenPendingModal={() => setShowPendingModal(true)}
        pendingCount={pendingRequests.length}
        logout={logout}
      />

      <SidebarTabs
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        incomingStrangerCount={incomingStrangerUsers.length}
        onOpenSearchModal={() => setShowSearchModal(true)}
      />

      <div className={styles.sidebarContent}>

        {currentTab === 'chats' || currentTab === 'groups' ? (
          <FriendList
            currentTab={currentTab}
            chatUsers={chatUsers}
            groups={groups}
            friends={friends}
            activeChatUser={activeChatUser}
            activeGroup={activeGroup}
            onSelectChat={setActiveChatUser}
            onSelectGroup={setActiveGroup}
            onContextMenuUser={handleContextMenuUser}
            onContextMenuGroup={handleContextMenuGroup}
            isUserOnline={isUserOnline}
            unreadCounts={unreadCounts}
          />
        ) : (
          <StrangerList
            incomingStrangerUsers={incomingStrangerUsers}
            activeChatUser={activeChatUser}
            onSelectChat={setActiveChatUser}
            unreadCounts={unreadCounts}
            onContextMenu={handleContextMenuUser}
          />
        )}
      </div>

      <UserContextMenu
        contextMenu={contextMenu}
        currentUserId={user?.id}
        onViewProfile={(u) => {
          setContextMenu(null);
          setSelectedProfileUser(u);
        }}
        onSendFriendRequest={handleSendFriendRequest}
        onConfirmDeleteFriend={handleConfirmDeleteFriend}
        onConfirmBlockUser={handleConfirmBlockUser}
        onConfirmRemoveChatroom={handleConfirmRemoveChatroom}
        onViewGroupMembers={(g) => {
          setContextMenu(null);
          setActiveGroupForModal(g);
          setShowGroupMembersModal(true);
        }}
        onConfirmLeaveGroup={handleConfirmLeaveGroup}
        onConfirmDeleteGroup={handleConfirmDeleteGroup}
        isFriend={!!contextMenu?.targetUser && friends.some((f) => f.id === contextMenu.targetUser?.id)}
      />

      <UserSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        friends={friends}
        onFriendChange={fetchFriendsAndPendingAndGroups}
      />

      <PendingRequestsModal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        pendingRequests={pendingRequests}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />

      <CreateGroupModal token={token} notify={notify} />

      <GroupMembersModal currentUserId={user?.id || 0} token={token} notify={notify} />

      <UserProfileModal
        userProfile={selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        isFriend={!!selectedProfileUser && friends.some((f) => f.id === selectedProfileUser.id)}
        onFriendChange={fetchFriendsAndPendingAndGroups}
      />
    </div>
  );
};

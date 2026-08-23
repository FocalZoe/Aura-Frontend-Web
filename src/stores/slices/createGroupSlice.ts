// Context: [群組領域 Slice] 管理群組列表、當前群組、群成員與群內暱稱

import { StateCreator } from 'zustand';
import { Group } from '../../types';

export interface GroupSlice {
  activeGroup: Group | null;
  groups: Group[];

  setActiveGroup: (group: Group | null) => void;
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  removeGroup: (groupId: number) => void;
  updateGroupInStore: (groupOrId: Group | number, group?: Group) => void;
}

export const createGroupSlice: StateCreator<any, [], [], GroupSlice> = (set, get) => ({
  activeGroup: null,
  groups: [],

  setActiveGroup: (group) =>
    set((state: any) => {
      let groupUnreadCounts = state.groupUnreadCounts;
      if (group && groupUnreadCounts[group.id]) {
        const next = { ...groupUnreadCounts };
        delete next[group.id];
        groupUnreadCounts = next;
      }
      const isSameGroup = group && state.activeGroup && state.activeGroup.id === group.id;
      return {
        activeGroup: group,
        activeChatUser: null,
        groupMessages: isSameGroup ? state.groupMessages : [],
        groupUnreadCounts,
      };
    }),

  setGroups: (groups) =>
    set((state: any) => {
      const normalizedGroups = groups.map((g) => ({
        ...g,
        id: Number(g.id) || g.id,
        owner_id: Number(g.owner_id) || g.owner_id,
        members: g.members?.map((m) => ({
          ...m,
          id: Number(m.id) || m.id,
          group_id: Number(m.group_id) || m.group_id,
          user_id: Number(m.user_id) || m.user_id,
        })),
      }));

      let updatedActive = state.activeGroup;
      if (state.activeGroup) {
        const activeId = Number(state.activeGroup.id);
        const found = normalizedGroups.find((g) => Number(g.id) === activeId);
        if (found) {
          updatedActive = { ...state.activeGroup, ...found, is_removed: false };
        } else {
          updatedActive = { ...state.activeGroup, is_removed: true };
        }
      }
      return { groups: normalizedGroups, activeGroup: updatedActive };
    }),

  addGroup: (group) =>
    set((state: any) => ({
      groups: [group, ...state.groups.filter((g: any) => Number(g.id) !== Number(group.id))],
    })),

  removeGroup: (groupId) =>
    set((state: any) => ({
      groups: state.groups.filter((g: any) => Number(g.id) !== Number(groupId)),
      activeGroup: state.activeGroup && Number(state.activeGroup.id) === Number(groupId) ? null : state.activeGroup,
    })),

  updateGroupInStore: (groupOrId, updatedGroup) =>
    set((state: any) => {
      const groupObj = typeof groupOrId === 'object' ? groupOrId : updatedGroup!;
      const id = typeof groupOrId === 'number' ? groupOrId : Number(groupOrId?.id);
      if (!groupObj || !id) return state;

      const normalizedObj = {
        ...groupObj,
        id: Number(groupObj.id) || groupObj.id,
        owner_id: groupObj.owner_id ? Number(groupObj.owner_id) : groupObj.owner_id,
        members: groupObj.members?.map((m: any) => ({
          ...m,
          id: Number(m.id) || m.id,
          group_id: Number(m.group_id) || m.group_id,
          user_id: Number(m.user_id) || m.user_id,
        })),
      };

      const nextGroups = state.groups.map((g: any) => (Number(g.id) === Number(id) ? normalizedObj : g));
      const nextActive = state.activeGroup && Number(state.activeGroup.id) === Number(id) ? normalizedObj : state.activeGroup;

      return {
        groups: nextGroups,
        activeGroup: nextActive,
      };
    }),
});

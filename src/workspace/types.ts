import type { AuthUser } from '../auth/types';

export interface Workspace {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceLoadResult {
  workspace: Workspace;
  created: boolean;
}

export interface WorkspaceService {
  getWorkspaceForUser(userId: string): Promise<Workspace | null>;
  loadOrCreateWorkspace(user: AuthUser): Promise<WorkspaceLoadResult>;
}

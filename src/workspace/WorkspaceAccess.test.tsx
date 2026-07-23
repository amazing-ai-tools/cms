import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalWorkspaceService } from './localWorkspaceService';

const owner: AuthUser = {
  id: 'google-owner',
  email: 'owner@example.com',
  name: 'Owner Example',
  avatarUrl: '',
  provider: 'google',
};

const secondOwner: AuthUser = {
  id: 'google-second-owner',
  email: 'second@example.com',
  name: 'Second Owner',
  avatarUrl: '',
  provider: 'google',
};

describe('authenticated workspace access', () => {
  test('creates a workspace for a first-time Google account and shows creation state', async () => {
    const authService = createLocalAuthService({
      initialUser: owner,
      storageKey: 'workspace-first-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'workspace-first-data',
      latencyMs: 10,
    });

    render(<App authService={authService} workspaceService={workspaceService} />);

    expect(await screen.findByText(/creating workspace/i)).toBeInTheDocument();
    expect(await screen.findByText("Owner Example's CMS Workspace")).toBeInTheDocument();
  });

  test('loads an existing workspace on later sign-ins', async () => {
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'workspace-existing-data',
      latencyMs: 10,
    });
    const existingWorkspace = await workspaceService.loadOrCreateWorkspace(owner);
    const authService = createLocalAuthService({
      initialUser: owner,
      storageKey: 'workspace-existing-auth',
    });

    render(<App authService={authService} workspaceService={workspaceService} />);

    expect(await screen.findByText(/loading workspace/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(existingWorkspace.workspace.name)).toBeInTheDocument();
    });
  });

  test('keeps workspace data isolated by Google account id', async () => {
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'workspace-isolation-data',
    });

    const ownerWorkspace = await workspaceService.loadOrCreateWorkspace(owner);
    const secondWorkspace = await workspaceService.loadOrCreateWorkspace(secondOwner);

    expect(ownerWorkspace.workspace.ownerUserId).toBe(owner.id);
    expect(secondWorkspace.workspace.ownerUserId).toBe(secondOwner.id);
    expect(secondWorkspace.workspace.id).not.toBe(ownerWorkspace.workspace.id);
    expect(await workspaceService.getWorkspaceForUser(owner.id)).toEqual(ownerWorkspace.workspace);
    expect(await workspaceService.getWorkspaceForUser(secondOwner.id)).toEqual(secondWorkspace.workspace);
  });
});

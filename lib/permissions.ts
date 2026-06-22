export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type WorkspacePermission =
  | 'manageWorkspace'
  | 'manageMembers'
  | 'manageSmtp'
  | 'manageContacts'
  | 'deleteContacts'
  | 'manageTemplates'
  | 'deleteTemplates'
  | 'manageCampaigns'
  | 'sendCampaigns'
  | 'importContacts'
  | 'exportContacts'
  | 'deleteWorkspace'
  | 'manageBilling'
  | 'viewAnalytics';

const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<WorkspacePermission>> = {
  owner: new Set([
    'manageWorkspace',
    'manageMembers',
    'manageSmtp',
    'manageContacts',
    'deleteContacts',
    'manageTemplates',
    'deleteTemplates',
    'manageCampaigns',
    'sendCampaigns',
    'importContacts',
    'exportContacts',
    'deleteWorkspace',
    'manageBilling',
    'viewAnalytics',
  ]),
  admin: new Set([
    'manageWorkspace',
    'manageMembers',
    'manageSmtp',
    'manageContacts',
    'deleteContacts',
    'manageTemplates',
    'deleteTemplates',
    'manageCampaigns',
    'sendCampaigns',
    'importContacts',
    'exportContacts',
    'viewAnalytics',
  ]),
  manager: new Set([
    'manageContacts',
    'deleteContacts',
    'manageTemplates',
    'deleteTemplates',
    'manageCampaigns',
    'sendCampaigns',
    'importContacts',
    'exportContacts',
    'viewAnalytics',
  ]),
  member: new Set([
    'manageContacts',
    'manageTemplates',
  ]),
  viewer: new Set([]),
};

export function hasPermission(role: WorkspaceRole, permission: WorkspacePermission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function assertPermission(role: WorkspaceRole, permission: WorkspacePermission) {
  if (!hasPermission(role, permission)) {
    return { error: 'You do not have permission to perform this action' };
  }

  return null;
}

export const canManageMembers = (role: WorkspaceRole) => hasPermission(role, 'manageMembers');
export const canManageSmtp = (role: WorkspaceRole) => hasPermission(role, 'manageSmtp');
export const canManageCampaigns = (role: WorkspaceRole) => hasPermission(role, 'manageCampaigns');
export const canSendCampaigns = (role: WorkspaceRole) => hasPermission(role, 'sendCampaigns');
export const canImportContacts = (role: WorkspaceRole) => hasPermission(role, 'importContacts');
export const canExportContacts = (role: WorkspaceRole) => hasPermission(role, 'exportContacts');
export const canDeleteWorkspace = (role: WorkspaceRole) => hasPermission(role, 'deleteWorkspace');
export const canManageBilling = (role: WorkspaceRole) => hasPermission(role, 'manageBilling');

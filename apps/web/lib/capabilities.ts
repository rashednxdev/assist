import type { LucideIcon } from 'lucide-react';
import { Route } from 'lucide-react';
import type { ModuleAccessGrant } from '@ibas/shared-types';
import type { MeUser } from '@/lib/auth';
import type { NavGroup, NavItem } from '@/components/layout/nav-config';

/** iBAS office workflow modules (seeded in setup-data). */
export const OFFICE_MODULE_CODES = [
  'BUDGET_PREP',
  'BUDGET_EXEC',
  'ACCOUNTING',
  'GL',
  'BILL',
  'REPORTING',
  'HR',
  'ESERVICE',
] as const;

export type OfficeModuleCode = (typeof OFFICE_MODULE_CODES)[number];

export function isSuperAdmin(user: Pick<MeUser, 'is_super_admin' | 'user_type'> | null): boolean {
  return !!user && (user.is_super_admin || user.user_type === 'system_admin');
}

export function isPlatformAdmin(user: Pick<MeUser, 'is_super_admin' | 'user_type'> | null): boolean {
  return !!user && (isSuperAdmin(user) || user.user_type === 'admin');
}

export function hasActiveWorkflowRole(user: Pick<MeUser, 'workflow_roles'> | null): boolean {
  return !!user?.workflow_roles.some((r) => r.is_active);
}

function grantFor(
  grants: ModuleAccessGrant[],
  moduleCode: string,
): ModuleAccessGrant | undefined {
  return grants.find((g) => g.module_code === moduleCode);
}

export function hasModuleRead(grants: ModuleAccessGrant[], moduleCode: string): boolean {
  return grantFor(grants, moduleCode)?.can_read === true;
}

export function hasModuleCreate(grants: ModuleAccessGrant[], moduleCode: string): boolean {
  const g = grantFor(grants, moduleCode);
  return g?.can_create === true || g?.can_update === true;
}

export function hasOfficeModuleRead(grants: ModuleAccessGrant[]): boolean {
  return grants.some(
    (g) => g.can_read && OFFICE_MODULE_CODES.includes(g.module_code as OfficeModuleCode),
  );
}

export function canSeeNavItem(
  user: MeUser,
  grants: ModuleAccessGrant[],
  item: NavItem,
): boolean {
  if (isSuperAdmin(user)) return true;

  if (item.requireWorkflowRole && !hasActiveWorkflowRole(user)) return false;

  if (item.requirePlatformAdmin && !isPlatformAdmin(user)) return false;

  if (!item.moduleCode) return true;

  if (item.requireCreate) {
    return hasModuleCreate(grants, item.moduleCode);
  }

  if (item.moduleCode === 'WORKFLOW') {
    return hasModuleRead(grants, 'WORKFLOW') || hasOfficeModuleRead(grants);
  }

  return hasModuleRead(grants, item.moduleCode);
}

/** Primary route per module — only these use the module display name in the sidebar. */
const MODULE_PRIMARY_HREF: Record<string, string> = {
  BOOKS: '/books',
  QUESTIONS: '/questions',
  EXAM: '/exams',
  PAPER: '/papers',
  WORKFLOW: '/guided-tasks',
  OCR: '/tools/pdf-to-word',
  USER: '/admin/users',
  SETUP: '/admin/setup/modules',
  AUDIT: '/admin/audit',
};

export function resolveNavLabel(item: NavItem, grants: ModuleAccessGrant[]): string {
  if (!item.moduleCode) return item.label;
  const grant = grantFor(grants, item.moduleCode);
  if (!grant) return item.label;
  if (MODULE_PRIMARY_HREF[item.moduleCode] === item.href) {
    return grant.module_name_en;
  }
  return item.label;
}

function officeNavItem(grant: ModuleAccessGrant, icon: LucideIcon): NavItem {
  return {
    href: '/guided-tasks',
    label: grant.module_name_en,
    icon,
    moduleCode: grant.module_code,
  };
}

export function buildVisibleNav(
  user: MeUser,
  grants: ModuleAccessGrant[],
  groups: NavGroup[],
  processIcon: LucideIcon = Route,
): NavGroup[] {
  const staticGroups = groups
    .map((group) => {
      if (group.adminOnly && !isSuperAdmin(user)) {
        const items = group.items
          .filter((item) => canSeeNavItem(user, grants, item))
          .map((item) => ({ ...item, label: resolveNavLabel(item, grants) }));
        if (items.length === 0) return null;
        return { ...group, items };
      }

      const items = group.items
        .filter((item) => canSeeNavItem(user, grants, item))
        .map((item) => ({ ...item, label: resolveNavLabel(item, grants) }));
      if (items.length === 0) return null;
      return { ...group, items };
    })
    .filter((g): g is NavGroup => g !== null);

  const officeItems: NavItem[] = [];
  if (!isSuperAdmin(user)) {
    for (const g of grants) {
      if (!g.can_read || !OFFICE_MODULE_CODES.includes(g.module_code as OfficeModuleCode)) continue;
      if (staticGroups.some((grp) => grp.items.some((i) => i.moduleCode === g.module_code))) continue;
      officeItems.push(officeNavItem(g, processIcon));
    }
  }

  if (officeItems.length === 0) return staticGroups;

  const processesIdx = staticGroups.findIndex((g) => g.title === 'Guided processes');
  if (processesIdx >= 0) {
    const merged = [...staticGroups];
    merged[processesIdx] = {
      ...merged[processesIdx]!,
      items: [...merged[processesIdx]!.items, ...officeItems],
    };
    return merged;
  }

  return [...staticGroups, { title: 'Office processes', items: officeItems }];
}

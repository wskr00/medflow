import { CanDeactivateFn } from "@angular/router";

export interface AdminDirtyAware {
  canLeave?: () => boolean;
}

/** Formulários administrativos permanecem em memória; nenhuma edição é gravada ao sair. */
export const preventAdminConfigurationLoss: CanDeactivateFn<AdminDirtyAware> = (
  component,
) => component.canLeave?.() ?? true;

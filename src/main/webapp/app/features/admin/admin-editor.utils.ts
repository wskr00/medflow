import { adminIssue } from "./admin.api";
import { AdminIssue } from "./admin.models";

export function savedConfiguration(description: string): AdminIssue {
  return {
    code: "SAVED",
    title: "Alterações salvas",
    description,
    conflict: false,
    fields: {},
  };
}
export function invalidConfiguration(
  fields: Record<string, string>,
): AdminIssue {
  return {
    code: "INVALID",
    title: "Revise os campos indicados",
    description: "As alterações ainda não foram salvas.",
    conflict: false,
    fields,
  };
}
/** All editing screens use the same explicit loss confirmation, including master/detail. */
export function discardAdminChanges(dirty: boolean): boolean {
  return (
    !dirty ||
    window.confirm("Há alterações não salvas. Descartar essas alterações?")
  );
}
export function confirmDeactivation(
  wasActive: boolean,
  active: boolean,
): boolean {
  return (
    !wasActive ||
    active ||
    window.confirm(
      "Desativar este cadastro? Ele deixará de estar disponível para novos usos. O servidor verificará reservas futuras antes de salvar.",
    )
  );
}
export function confirmReload(): boolean {
  return window.confirm(
    "Carregar a versão atual? O texto deste formulário será substituído pelos dados salvos. Essa ação não salva suas alterações.",
  );
}
/** Called after a selection/new action, never on ordinary typing. */
export function focusAdminEditor(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function failedAdminReload(error: unknown): AdminIssue {
  return {
    ...adminIssue(error),
    code: "VERSAO_DESATUALIZADA",
    conflict: true,
    description:
      "Não foi possível carregar a versão atual. O formulário foi preservado. Tente carregar novamente antes de salvar.",
  };
}

import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { provideBrnCalendarI18n } from "@spartan-ng/brain/calendar";
import { provideNativeDateAdapter } from "@spartan-ng/brain/date-time";
import { routes } from "./app.routes";
import { provideAuthentication } from "./auth/auth.provider";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAuthentication(),
    provideNativeDateAdapter(),
    provideBrnCalendarI18n({
      formatWeekdayName: (day) => ["D", "S", "T", "Q", "Q", "S", "S"][day],
      formatHeader: (month, year) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month)),
      formatYear: (year) => `${year}`,
      formatMonth: (month) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, month)),
      labelPrevious: () => "Mês anterior", labelNext: () => "Próximo mês",
      labelWeekday: (day) => ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][day],
      months: () => Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, month))) as [string, string, string, string, string, string, string, string, string, string, string, string],
      years: (start = 2020, end = 2035) => Array.from({ length: end - start + 1 }, (_, index) => start + index),
      firstDayOfWeek: () => 0,
    }),
  ],
};

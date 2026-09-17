import { CanDeactivateFn } from "@angular/router";
import { DoctorCareComponent } from "./doctor-care.component";

/** Nunca persiste texto clínico no navegador: apenas pede confirmação quando há edição local. */
export const preventDoctorCareLoss: CanDeactivateFn<DoctorCareComponent> = (
  component,
) => component.canLeave();

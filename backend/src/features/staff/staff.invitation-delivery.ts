import { AppError } from "../../utils/error";
import { env } from "../../utils/zodSchema";
import type { StaffInvitationDelivery } from "./staff.types";

export class DevelopmentInvitationDelivery implements StaffInvitationDelivery {
  constructor(private readonly frontendUrl: string) {}

  async deliver({ token }: Parameters<StaffInvitationDelivery["deliver"]>[0]) {
    const url = new URL("/staff-invitations/accept", this.frontendUrl);
    url.searchParams.set("token", token);
    return { developmentUrl: url.toString() };
  }
}

export class UnavailableInvitationDelivery implements StaffInvitationDelivery {
  async deliver(): Promise<never> {
    throw new AppError(
      "Invitation delivery is unavailable.",
      503,
      "INVITATION_DELIVERY_UNAVAILABLE"
    );
  }
}

export const invitationDelivery: StaffInvitationDelivery =
  env.NODE_ENV === "production"
    ? new UnavailableInvitationDelivery()
    : new DevelopmentInvitationDelivery(env.FE_URL);

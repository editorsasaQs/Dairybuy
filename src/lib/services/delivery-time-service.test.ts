import { describe, expect, it } from "vitest";
import {
  DELIVERY_TIME_ZONE,
  isDeliveryCancellationAllowed,
  isDeliveryOrderAllowed,
} from "./delivery-time-service";

const deliveryDate = "2026-11-13";

describe("Dairybuy Asia/Kolkata delivery clock", () => {
  it("declares the business timezone explicitly", () => {
    expect(DELIVERY_TIME_ZONE).toBe("Asia/Kolkata");
  });

  it("uses Kolkata local time rather than the runtime UTC date", () => {
    // 2026-11-12 20:00:00Z is already 2026-11-13 01:30:00 in Kolkata.
    expect(isDeliveryOrderAllowed(
      deliveryDate,
      "07:00:00",
      new Date("2026-11-12T20:00:00.000Z"),
    )).toBe(true);
  });

  it("accepts morning orders at 06:59:59 and rejects at the 07:00:00 cutoff", () => {
    expect(isDeliveryOrderAllowed(
      deliveryDate, "07:00:00", new Date("2026-11-13T01:29:59.000Z"),
    )).toBe(true);
    expect(isDeliveryOrderAllowed(
      deliveryDate, "07:00:00", new Date("2026-11-13T01:30:00.000Z"),
    )).toBe(false);
    expect(isDeliveryOrderAllowed(
      deliveryDate, "07:00:00", new Date("2026-11-13T01:30:01.000Z"),
    )).toBe(false);
  });

  it("accepts evening orders at 15:59:59 and rejects at the 16:00:00 cutoff", () => {
    expect(isDeliveryOrderAllowed(
      deliveryDate, "16:00:00", new Date("2026-11-13T10:29:59.000Z"),
    )).toBe(true);
    expect(isDeliveryOrderAllowed(
      deliveryDate, "16:00:00", new Date("2026-11-13T10:30:00.000Z"),
    )).toBe(false);
    expect(isDeliveryOrderAllowed(
      deliveryDate, "16:00:00", new Date("2026-11-13T10:30:01.000Z"),
    )).toBe(false);
  });

  it("allows cancellation through the morning deadline, inclusive", () => {
    expect(isDeliveryCancellationAllowed(
      deliveryDate, "07:30:00", new Date("2026-11-13T02:00:00.000Z"),
    )).toBe(true);
    expect(isDeliveryCancellationAllowed(
      deliveryDate, "07:30:00", new Date("2026-11-13T02:00:01.000Z"),
    )).toBe(false);
  });

  it("allows cancellation through the evening deadline, inclusive", () => {
    expect(isDeliveryCancellationAllowed(
      deliveryDate, "16:30:00", new Date("2026-11-13T11:00:00.000Z"),
    )).toBe(true);
    expect(isDeliveryCancellationAllowed(
      deliveryDate, "16:30:00", new Date("2026-11-13T11:00:01.000Z"),
    )).toBe(false);
  });

  it("allows future dates and rejects past dates", () => {
    const now = new Date("2026-11-13T12:00:00.000Z");
    expect(isDeliveryOrderAllowed("2026-11-14", "07:00:00", now)).toBe(true);
    expect(isDeliveryOrderAllowed("2026-11-12", "07:00:00", now)).toBe(false);
    expect(isDeliveryCancellationAllowed("2026-11-14", "07:30:00", now)).toBe(true);
    expect(isDeliveryCancellationAllowed("2026-11-12", "07:30:00", now)).toBe(false);
  });

  it("fails closed for invalid dates and database time values", () => {
    const now = new Date("2026-11-13T00:00:00.000Z");
    expect(isDeliveryOrderAllowed("2026-02-30", "07:00:00", now)).toBe(false);
    expect(isDeliveryOrderAllowed(deliveryDate, "25:00:00", now)).toBe(false);
    expect(isDeliveryCancellationAllowed(deliveryDate, "07:60:00", now)).toBe(false);
  });
});

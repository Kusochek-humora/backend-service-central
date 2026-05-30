import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { TicketEvent } from "./ticket-event.entity";
import { VenueSeat } from "./venue-seat.entity";

export enum EventSeatStatus {
  FREE = "free",
  RESERVED = "reserved",
  SOLD = "sold",
  BLOCKED = "blocked",
}

@Entity("t_event_seats")
export class EventSeat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  eventId!: number;

  @ManyToOne(() => TicketEvent, (e) => e.eventSeats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "eventId" })
  event!: TicketEvent;

  @Column()
  seatId!: number;

  @ManyToOne(() => VenueSeat, { onDelete: "CASCADE" })
  @JoinColumn({ name: "seatId" })
  seat!: VenueSeat;

  @Column({ type: "enum", enum: EventSeatStatus, default: EventSeatStatus.FREE })
  status!: EventSeatStatus;

  @Column({ nullable: true, type: "timestamp" })
  reservedUntil?: Date;

  @Column({ nullable: true, type: "int" })
  priceOverride?: number;

  @Column({ nullable: true })
  orderId?: number;
}

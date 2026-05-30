import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Venue } from "./venue.entity";
import { EventSeat } from "./event-seat.entity";

export enum TicketEventStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CANCELLED = "cancelled",
}

@Entity("t_events")
export class TicketEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  venueId!: number;

  @ManyToOne(() => Venue, (v) => v.events, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @Column()
  title!: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ type: "enum", enum: TicketEventStatus, default: TicketEventStatus.DRAFT })
  status!: TicketEventStatus;

  @OneToMany(() => EventSeat, (es) => es.event, { cascade: true })
  eventSeats!: EventSeat[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

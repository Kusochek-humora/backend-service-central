import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { TicketEvent } from "./ticket-event.entity";
import { Ticket } from "./ticket.entity";

export enum OrderStatus {
  PENDING = "pending",
  PAID = "paid",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

@Entity("t_orders")
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  eventId!: number;

  @ManyToOne(() => TicketEvent, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "eventId" })
  event!: TicketEvent;

  @Column()
  customerName!: string;

  @Column()
  customerEmail!: string;

  @Column()
  customerPhone!: string;

  @Column({ type: "int" })
  totalAmount!: number;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ nullable: true })
  paymentId?: string;

  @OneToMany(() => Ticket, (t) => t.order, { cascade: true })
  tickets!: Ticket[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

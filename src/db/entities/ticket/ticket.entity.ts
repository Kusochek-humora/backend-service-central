import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { Order } from "./order.entity";

@Entity("t_tickets")
export class Ticket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  orderId!: number;

  @ManyToOne(() => Order, (o) => o.tickets, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @Column()
  seatId!: number;

  @Column()
  eventId!: number;

  @Column({ unique: true })
  qrToken!: string;

  @Column({ nullable: true, type: "timestamp" })
  scannedAt?: Date;

  @Column({ type: "int" })
  price!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

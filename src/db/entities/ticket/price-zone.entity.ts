import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Venue } from "./venue.entity";

export enum SeatStatus {
  FREE = "free",
  RESERVED = "reserved",
  SOLD = "sold",
  BLOCKED = "blocked",
}

@Entity("t_price_zones")
export class PriceZone {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  venueId!: number;

  @ManyToOne(() => Venue, (v) => v.priceZones, { onDelete: "CASCADE" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @Column()
  name!: string;

  @Column()
  color!: string;

  @Column({ type: "int" })
  price!: number;

  @Column({ default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

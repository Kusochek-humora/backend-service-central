import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { SeatGroup } from "./seat-group.entity";
import { PriceZone } from "./price-zone.entity";
import { TicketEvent } from "./ticket-event.entity";

@Entity("t_venues")
export class Venue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column({ type: "text", nullable: true })
  svgBackground?: string;

  @Column({ default: 1920 })
  width!: number;

  @Column({ default: 1080 })
  height!: number;

  @OneToMany(() => SeatGroup, (g) => g.venue, { cascade: true })
  seatGroups!: SeatGroup[];

  @OneToMany(() => PriceZone, (z) => z.venue, { cascade: true })
  priceZones!: PriceZone[];

  @OneToMany(() => TicketEvent, (e) => e.venue)
  events!: TicketEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

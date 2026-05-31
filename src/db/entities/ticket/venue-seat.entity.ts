import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { SeatGroup } from "./seat-group.entity";
import { PriceZone } from "./price-zone.entity";

@Entity("t_venue_seats")
export class VenueSeat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  groupId!: number;

  @ManyToOne(() => SeatGroup, (g) => g.seats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "groupId" })
  group!: SeatGroup;

  @Column()
  venueId!: number;

  @Column()
  seatNumber!: number;

  @Column({ type: "float" })
  offsetX!: number;

  @Column({ type: "float" })
  offsetY!: number;

  @Column({ nullable: true })
  priceZoneId?: number;

  @ManyToOne(() => PriceZone, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "priceZoneId" })
  priceZone?: PriceZone;
}

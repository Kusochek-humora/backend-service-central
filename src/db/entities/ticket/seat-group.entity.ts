import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { Venue } from "./venue.entity";
import { VenueSeat } from "./venue-seat.entity";

export enum GroupType {
  TABLE_4 = "table_4",
  TABLE_5 = "table_5",
  SOFA_2 = "sofa_2",
  HIGH_TABLE_4 = "high_table_4",
  ROW = "row",
  BALCONY = "balcony",
}

@Entity("t_seat_groups")
export class SeatGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  venueId!: number;

  @ManyToOne(() => Venue, (v) => v.seatGroups, { onDelete: "CASCADE" })
  @JoinColumn({ name: "venueId" })
  venue!: Venue;

  @Column({ type: "enum", enum: GroupType })
  type!: GroupType;

  @Column()
  label!: string;

  @Column({ type: "float" })
  cx!: number;

  @Column({ type: "float" })
  cy!: number;

  @Column({ type: "float", default: 0 })
  rotation!: number;

  @Column({ nullable: true })
  priceZoneId?: number;

  @OneToMany(() => VenueSeat, (s) => s.group, { cascade: true })
  seats!: VenueSeat[];
}

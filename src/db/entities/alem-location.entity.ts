import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("alem_locations")
export class AlemLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  label!: string;

  @Column({ nullable: true })
  address_ru?: string;

  @Column({ nullable: true })
  address_kz?: string;

  @Column({ nullable: true })
  address_en?: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ nullable: true })
  zoom?: string;
}

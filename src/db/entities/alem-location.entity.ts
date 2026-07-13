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

  @Column({ type: "float", nullable: true })
  latitude?: number;

  @Column({ type: "float", nullable: true })
  longitude?: number;

  @Column({ nullable: true })
  zoom?: string;

  @Column({ nullable: true })
  twogis?: string;

  @Column({ nullable: true, type: "int" })
  order?: number;
}

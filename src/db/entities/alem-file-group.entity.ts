import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("alem_file_groups")
export class AlemFileGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  photo1!: string;

  @Column({ nullable: true })
  photo2?: string;

  @Column({ nullable: true })
  photo3?: string;

  @Column({ nullable: true })
  photo4?: string;

  @Column({ nullable: true })
  photo5?: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ nullable: true })
  label?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

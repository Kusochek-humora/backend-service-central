import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("alem_file_groups")
export class AlemFileGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  photo!: string;

  @Column({ nullable: true })
  photoStories?: string;

  @Column({ nullable: true })
  banner?: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column({ nullable: true })
  label?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from "typeorm";

@Entity("tours")
export class Tour {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true, type: "text" })
  description?: string;

  @Column()
  photo!: string;

  @Column({ default: false })
  isPublished!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column({ nullable: true })
  photoStories?: string;

  @Column({ default: false })
  publishToInternalChannel!: boolean;

  @Column({ nullable: true, type: "bigint" })
  internalMsgId?: string;

  @OneToMany(() => TourShow, (show) => show.tour, { cascade: true })
  shows!: TourShow[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("tour_shows")
export class TourShow {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  city!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "time" })
  time!: string;

  @Column()
  venue!: string;

  @Column()
  link!: string;

  @Column({ nullable: true })
  photo?: string;

  @Column({ nullable: true })
  notice?: string;

  @Column({ default: false })
  isSoldOut!: boolean;

  @Column({ default: false })
  isPublished!: boolean;

  @Column({ default: 0 })
  order!: number;

  @Column()
  tourId!: number;

  @ManyToOne(() => Tour, (tour) => tour.shows, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tourId" })
  tour!: Tour;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

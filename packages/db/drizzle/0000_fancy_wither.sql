CREATE TABLE "amenities" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block_amenities" (
	"block_id" integer NOT NULL,
	"amenity_id" integer NOT NULL,
	"distance_m" integer NOT NULL,
	CONSTRAINT "block_amenities_block_id_amenity_id_pk" PRIMARY KEY("block_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "block_land_use" (
	"block_id" integer NOT NULL,
	"land_use" text NOT NULL,
	"area_m2" integer NOT NULL,
	CONSTRAINT "block_land_use_block_id_land_use_pk" PRIMARY KEY("block_id","land_use")
);
--> statement-breakpoint
CREATE TABLE "block_programmes" (
	"block_id" integer NOT NULL,
	"programme" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"estimated_completion" text,
	CONSTRAINT "block_programmes_block_id_programme_name_pk" PRIMARY KEY("block_id","programme","name")
);
--> statement-breakpoint
CREATE TABLE "block_summary" (
	"block_id" integer PRIMARY KEY NOT NULL,
	"nearest_mrt_m" integer,
	"nearest_mrt_name" text,
	"nearest_hawker_m" integer,
	"nearest_primary_school_m" integer,
	"nearest_park_m" integer,
	"nearest_clinic_m" integer,
	"nearest_preschool_m" integer,
	"bus_stops_400m" integer DEFAULT 0 NOT NULL,
	"hawkers_1km" integer DEFAULT 0 NOT NULL,
	"primary_schools_1km" integer DEFAULT 0 NOT NULL,
	"primary_schools_2km" integer DEFAULT 0 NOT NULL,
	"playgrounds_500m" integer DEFAULT 0 NOT NULL,
	"fitness_corners_500m" integer DEFAULT 0 NOT NULL,
	"preschools_1km" integer DEFAULT 0 NOT NULL,
	"clinics_1km" integer DEFAULT 0 NOT NULL,
	"median_rent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"median_price" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rentals_12m" integer DEFAULT 0 NOT NULL,
	"resales_12m" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"block" text NOT NULL,
	"street" text NOT NULL,
	"town" text NOT NULL,
	"postal" text,
	"lat" double precision,
	"lng" double precision,
	"planning_area" text,
	"year_completed" integer,
	"lease_start_year" integer,
	"max_floor" integer,
	"total_units" integer,
	"has_market_hawker" boolean DEFAULT false NOT NULL,
	"has_carpark" boolean DEFAULT false NOT NULL,
	"has_commercial" boolean DEFAULT false NOT NULL,
	"unit_mix" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset" text NOT NULL,
	"status" text NOT NULL,
	"rows" integer,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rental_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"block_id" integer NOT NULL,
	"month" date NOT NULL,
	"flat_type" text NOT NULL,
	"rent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resale_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"block_id" integer NOT NULL,
	"month" date NOT NULL,
	"flat_type" text NOT NULL,
	"storey_low" integer NOT NULL,
	"storey_high" integer NOT NULL,
	"floor_area_sqm" real NOT NULL,
	"flat_model" text NOT NULL,
	"lease_start_year" integer NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"case_count" integer,
	"geometry" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "town_stats" (
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"town" text NOT NULL,
	"flat_type" text NOT NULL,
	"value" real NOT NULL,
	"value_high" real,
	CONSTRAINT "town_stats_metric_period_town_flat_type_pk" PRIMARY KEY("metric","period","town","flat_type")
);
--> statement-breakpoint
ALTER TABLE "block_amenities" ADD CONSTRAINT "block_amenities_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_amenities" ADD CONSTRAINT "block_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_land_use" ADD CONSTRAINT "block_land_use_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_programmes" ADD CONSTRAINT "block_programmes_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_summary" ADD CONSTRAINT "block_summary_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_transactions" ADD CONSTRAINT "rental_transactions_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resale_transactions" ADD CONSTRAINT "resale_transactions_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_kind_source_idx" ON "amenities" USING btree ("kind","source_id");--> statement-breakpoint
CREATE INDEX "block_amenities_amenity_idx" ON "block_amenities" USING btree ("amenity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_key_idx" ON "blocks" USING btree ("key");--> statement-breakpoint
CREATE INDEX "blocks_postal_idx" ON "blocks" USING btree ("postal");--> statement-breakpoint
CREATE INDEX "ingestion_runs_dataset_idx" ON "ingestion_runs" USING btree ("dataset","started_at");--> statement-breakpoint
CREATE INDEX "rental_block_type_month_idx" ON "rental_transactions" USING btree ("block_id","flat_type","month");--> statement-breakpoint
CREATE INDEX "rental_month_idx" ON "rental_transactions" USING btree ("month");--> statement-breakpoint
CREATE INDEX "resale_block_type_month_idx" ON "resale_transactions" USING btree ("block_id","flat_type","month");--> statement-breakpoint
CREATE INDEX "resale_month_idx" ON "resale_transactions" USING btree ("month");
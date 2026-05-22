CREATE TABLE `academic_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`semester` int,
	`level` enum('primary','secondary') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`startDate` date,
	`endDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academic_years_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`date` date NOT NULL,
	`status` enum('present','absent','late','excused') NOT NULL,
	`note` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`level` enum('primary','secondary') NOT NULL,
	`grade` int NOT NULL,
	`room` int NOT NULL,
	`academicYearId` int NOT NULL,
	`homeroomTeacherId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exported_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('por1','por6') NOT NULL,
	`title` varchar(300) NOT NULL,
	`classroomId` int,
	`studentId` int,
	`academicYearId` int NOT NULL,
	`fileUrl` text,
	`fileKey` varchar(500),
	`fileSize` int,
	`exportedBy` int NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exported_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grade_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`totalScore` decimal(6,2),
	`grade` varchar(5),
	`result` enum('pass','fail','incomplete','exempted'),
	`attendanceHours` int DEFAULT 0,
	`totalHours` int DEFAULT 0,
	`isFinalized` boolean NOT NULL DEFAULT false,
	`finalizedAt` timestamp,
	`finalizedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grade_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `score_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`maxScore` decimal(6,2) NOT NULL,
	`weight` decimal(5,2) DEFAULT '100.00',
	`order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `score_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`studentId` int NOT NULL,
	`score` decimal(6,2),
	`note` text,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentCode` varchar(20) NOT NULL,
	`prefix` varchar(10),
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`nationalId` varchar(13),
	`birthDate` date,
	`gender` enum('male','female'),
	`classroomId` int NOT NULL,
	`studentNumber` int,
	`status` enum('active','transferred','graduated','dropped') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_studentCode_unique` UNIQUE(`studentCode`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectCode` varchar(20) NOT NULL,
	`name` varchar(200) NOT NULL,
	`credits` decimal(3,1) DEFAULT '1.0',
	`level` enum('primary','secondary','both') NOT NULL,
	`gradeGroup` varchar(20),
	`subjectGroup` varchar(100),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`teacherCode` varchar(20),
	`prefix` varchar(10),
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`phone` varchar(20),
	`teachingLevel` enum('primary','secondary','both') NOT NULL DEFAULT 'secondary',
	`isHomeroom` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teaching_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teacherId` int NOT NULL,
	`subjectId` int NOT NULL,
	`classroomId` int NOT NULL,
	`academicYearId` int NOT NULL,
	`hoursPerWeek` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teaching_assignments_id` PRIMARY KEY(`id`)
);
